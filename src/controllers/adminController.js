import { prisma } from "../config/db.js";
import jwt from 'jsonwebtoken';
import redis from "../config/redis.js";
import ExcelJS from 'exceljs';


const generateSlug = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz';

    const group = (length) =>
        Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

    return `${group(3)}-${group(4)}-${group(3)}`;
};
export const updateLgaDetails = async (req, res) => {
    try {
        const { name, latitude, longitude, radius } = req.body
        if (!name || !latitude || !longitude || !radius) {
            return res.status(400).json({ success: false, message: 'name, latitude, longitude, and radius are required.' });
        }
        console.log({ name, latitude, longitude, radius });
        const adminId = req.admin.id;

        const checkInSlug = generateSlug()

        const lga = await prisma.lGA.upsert({
            where: { adminId },
            update: {
                latitude,
                longitude,
                name,
                radius,
            },
            create: {
                latitude,
                longitude,
                name,
                radius,
                adminId,
                checkInSlug
            }
        })
        await redis.del(`lgaLocation:${lga.checkInSlug}`);
        res.json({ success: true, lga })
    } catch (error) {
        console.error('Admin update error:', error.message)
        return res.status(500).json({ success: false, message: 'Internal server error' })
    }
}
export const openSession = async (req, res) => {
    const adminId = req.admin.id;
    // const { sessionId } = req.body
    // if (!sessionId) {
    //     return res.status(400).json({ success: false, message: 'sessionId is required.' });
    // }
    try {
        // need the admin's lgaId to associate the session

        const [admin, existingSession] = await Promise.all([
            prisma.admin.findUnique({
                where: { id: adminId },
                include: { lga: true }
            }),
            prisma.session.findFirst({
                where: {
                    adminId,
                    isOpen: true
                }
            })
        ]);
        if (!admin?.lga) {
            return res.status(400).json({
                success: false,
                message: 'LGA not configured. Set up geofence first.'
            });
        };

        if (existingSession) {
            return res.status(400).json({
                success: false,
                message: 'You already have an open session',
                session: existingSession
            })
        }

        const session = await prisma.session.create({
            data: {
                adminId,
                lgaId: admin.lga.id,
                isOpen: true,
                openedAt: new Date(),
            }
        });

        //create redis counter for all sessions that are just created. this might not be relevant since we already have a check for open session above, but just to be safe and to prevent
        // const maxRecord = await prisma.attendanceRecord.findFirst({
        //     where: { sessionId: session.id },
        //     orderBy: { queueNumber: 'desc' },
        //     select: {queueNumber:true}
        // });

        //initialize counter from the current max
        await redis.set(`session: ${session.id}:counter`,0);
        await redis.set(`session:${session.id}:open`, '1');

        res.status(201).json({ success: true, session });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to open session.' });
    }
};

export const closeSession = async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) {
        return res.status(400).json({ success: false, message: 'sessionId is required.' });
    }
    const adminId = req.admin.id;

    try {

        const sessionExist = await prisma.session.findUnique({
            where: { id: sessionId, adminId },
            include: {
                lga: {
                    select: {
                        checkInSlug: true
                    }
                }
            }
        })
        if (!sessionExist) {
            return res.status(400).json({ success: false, message: "Session does not exist." })
        }
        if (!sessionExist.isOpen) {
            return res.status(400).json({ success: false, message: "Session is closed already", session: sessionExist })
        }

        const session = await prisma.session.update({
            where: { id: sessionId },
            data: {
                isOpen: false,
                closedAt: new Date(),
            }
        });
        console.log(sessionExist.lga.checkInSlug, 'Checkin slug');
        await redis.del(`session:${sessionExist.lga.checkInSlug}`);
        await redis.del(`lgaLocation:${sessionExist.lga.checkInSlug}`);
        //this one is to prevent any new check-ins after session is closed, by invalidating the session in redis.
        await redis.set(`session:${sessionId}:open`, '0');

        res.status(200).json({ success: true, message: 'session closed successfully', session });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to close session.' });
    }
};


export const manualAssignment = async (req, res) => {
    const { sessionId, stateCode, name, } = req.body
    if (!sessionId || !stateCode || !name) {
        return res.status(400).json({ success: false, message: 'sessionId, stateCode and name are required.' });
    }
    const adminId = req.admin.id
    try {
        const confirmSession = await prisma.session.findFirst({
            where: { id: sessionId, adminId, isOpen: true }
        })

        if (!confirmSession) {
            return res.status(400).json({ success: false, message: 'Session cannot be found' })
        }
        const attendance = await handleNumberAssignment(true, sessionId, stateCode, name,)

        res.status(201).json({ success: true, message: 'Number assigned successfully.', attendance });
    }
    catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ success: false, message: 'Corps member already has a number for this session.' });
        }
        res.status(500).json({ success: false, message: 'Failed to assign number.' });
    }
}

export const handleNumberAssignment = async (addedByAdmin, sessionId, stateCode, name, deviceFingerprint) => {
    const attendanceRecord = await prisma.$transaction(async (tx) => {
        const last = await tx.attendanceRecord.findFirst({
            where: { sessionId },
            orderBy: { queueNumber: 'desc' },
            select: { queueNumber: true }
        });
        const nextNumber = (last?.queueNumber ?? 0) + 1;

        return tx.attendanceRecord.create({
            data: {
                sessionId,
                name,
                stateCode,
                queueNumber: nextNumber,
                deviceFingerprint: addedByAdmin ? null : deviceFingerprint,
                addedByAdmin,
            }
        })
    })
    return attendanceRecord
}


export const getAttendanceList = async (req, res) => {
    const { sessionId } = req.query
    const pageSize = parseInt(req.query.pageSize);
    const pageIndex = parseInt(req.query.pageIndex);

    if (!pageSize || !pageIndex) {
        return res.status(400).json({ success: false, message: 'The pagesize and page index is required' })
    }

    try {
        const skip = (pageIndex - 1) * pageSize
        const [attendance, totalCount] = await Promise.all([
            prisma.attendanceRecord.findMany({
                where: { sessionId },
                take: pageSize,
                skip,
            }),
            prisma.attendanceRecord.count({
                where: { sessionId }
            })
        ])
        const hasMore = pageIndex * pageSize < totalCount

        console.log(attendance, hasMore);
        res.status(200).json({ success: true, message: 'Testing', attendanceList: attendance, hasMore, totalCount })

    } catch (error) {
        console.error('Attendance list getting error:', error.message)
        return res.status(500).json({ success: false, message: 'Internal server error' })
    }
}

export const searchAttendance = async (req, res) => {
    const { sessionId, query } = req.query

    if (!sessionId) {
        return res.status(400).json({ success: false, message: 'sessionId is required' })
    }
    if (!query) {
        return res.status(400).json({ success: false, message: 'query is required' })
    }

    try {
        const results = await prisma.attendanceRecord.findMany({
            where: {
                sessionId,
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { stateCode: { contains: query, mode: 'insensitive' } }
                ]
            },
            take: 20
        })

        return res.status(200).json({ success: true, results })
    } catch (error) {
        console.error('Attendance search error:', error.message)
        return res.status(500).json({ success: false, message: 'Internal server error' })
    }
}

export const getAdmin = async (req, res) => {
    const adminId = req.admin.id;
    try {
        const adminExist = await prisma.admin.findUnique({
            where: { id: adminId },
            include: {
                lga: true,
                sessions: {
                    take: 1,
                    orderBy: {
                        date: 'desc', // THIS defines "last session"
                    },
                },
            },
        });
        console.log(adminExist);

        return res.status(200).json({
            lgaDetails: adminExist.lga,
            session: adminExist.sessions[0],
            success: true,
            message: "LGA details gotten successfully"
        });
    } catch (error) {
        console.error('Error getting LGA & Admin details:', error.message)
        return res.status(500).json({ success: false, message: 'Internal server error' })
    }

};

export const validateUser = async (req, res) => {
    const { sessionId, stateCode, queueNumber, checkInSlug } = req.body;

    if (!sessionId || !stateCode || !queueNumber || !checkInSlug) {
        return res.status(400).json({
            success: false,
            message: 'sessionId, stateCode, queueNumber and checkInSlug are required.'
        });
    }

    try {
        // 1. Is session active?
        const cachedSession = await redis.get(`session:${checkInSlug}`);
        if (!cachedSession) {
            return res.status(400).json({
                success: false,
                message: 'The session for this qr code has expired. from invalid session in cache',
                status: 'session_ended'
            });
        }

        // 2. Is this the CURRENT session? (catches old numbers)
        const session = JSON.parse(cachedSession);
        console.log(session, 'hmmm hello', sessionId);
        if (session.id !== sessionId) {
            return res.status(400).json({
                success: false,
                message: 'The session for this qr code has expired..',
                status: 'session_ended'
            });
        }

        // 3. Does this attendance record exist in Redis?
        const attendanceKey = `attendance:${sessionId}:${queueNumber}`;
        const cachedAttendance = await redis.get(attendanceKey);
        if (!cachedAttendance) {
            return res.status(400).json({
                success: false,
                message: 'This users attendance does not exist',
                status: 'invalid_qr'
            });
        }

        const attendance = JSON.parse(cachedAttendance);

        // 4. Does stateCode match? (prevents tampered QRs)
        if (attendance.stateCode !== stateCode) {
            return res.status(400).json({
                success: false,
                message: 'Invalid QR code.',
                status: 'invalid_qr'
            });
        }

        // 5. Already scanned?
        // const scannedKey = `scanned:${sessionId}:${queueNumber}`;
        // const alreadyScanned = await redis.get(scannedKey);
        // if (alreadyScanned) {
        //     return res.status(400).json({
        //         success: false,
        //         message: 'This number has already been validated.',
        //         status: 'already_scanned'
        //     });
        // }

        // // 6. Mark as scanned
        // await redis.set(scannedKey, '1', { EX: 86400 });

        return res.status(200).json({
            success: true,
            status: 'valid',
            name: attendance.name,
            stateCode: attendance.stateCode,
            queueNumber: attendance.queueNumber,
        });

    } catch (error) {
        console.error('validateUser error:', error.message);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


export const getAllSessions = async (req, res) => {
    const adminId = req.admin.id;
    let { pageSize, pageIndex } = req.query;
    pageSize = parseInt(pageSize)
    pageIndex = parseInt(pageIndex)

    if (!pageSize || !pageIndex) {
        return res.status(400).json({ success: false, message: 'The pagesize and page index is required' })
    }

    try {
        const skip = (pageIndex - 1) * pageSize
        const [sessionList, totalCount] = await Promise.all([
            prisma.session.findMany({
                where: { adminId, isOpen: false },
                take: pageSize,
                skip,
                orderBy: { date: 'desc' },
                include: {
                    _count: { select: { attendance: true } }
                }
            }),
            prisma.session.count({
                where: { adminId, isOpen: false }
            })
        ])
        const formatted = sessionList.map(s => ({
            id: s.id,
            date: s.date,
            openedAt: s.openedAt,
            closedAt: s.closedAt,
            totalCheckIns: s._count.attendance
        }))
        const hasMore = pageIndex * pageSize < totalCount

        res.status(200).json({ success: true, message: 'Testing', sessionList: formatted, hasMore, totalCount })

    } catch (error) {
        console.error('Attendance list getting error:', error.message)
        return res.status(500).json({ success: false, message: 'Internal server error' })
    }
}

export const exportSession = async (req, res) => {
    const adminId = req.admin.id;
    const { sessionId } = req.params;

    try {
        // Verify session belongs to this admin
        const session = await prisma.session.findFirst({
            where: { id: sessionId, adminId },
            select: { id: true, date: true }
        });

        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        const records = await prisma.attendanceRecord.findMany({
            where: { sessionId },
            orderBy: { queueNumber: 'asc' },
            select: {
                queueNumber: true,
                name: true,
                stateCode: true,
                timestamp: true,
            }
        });

        const dateStr = new Date(session.date).toISOString().split('T')[0];
        const filename = `Attendance_${dateStr}.xlsx`;

        //tells the browser what is coming is an excel file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        //tells the browser to download it
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);


        //this is the actual excel file
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
        //the sheet is like the tabs inside, so in this case we are creating one sheet
        const sheet = workbook.addWorksheet('Attendance');

        sheet.columns = [
            { header: 'Queue No.', key: 'queueNumber', width: 12 },
            { header: 'Full Name', key: 'name', width: 35 },
            { header: 'State Code', key: 'stateCode', width: 15 },
            { header: 'Check-in Time', key: 'timestamp', width: 25 },
        ];

        // Bold the header row
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).commit();
        //always commit to the sheet after making an adjustment to it


        //add all the records to the rows in the sheet
        for (const record of records) {
            sheet.addRow({
                queueNumber: record.queueNumber,
                name: record.name,
                stateCode: record.stateCode,
                timestamp: new Date(record.timestamp).toLocaleString('en-NG', {
                    timeZone: 'Africa/Lagos',
                    dateStyle: 'medium',
                    timeStyle: 'short',
                }),
            }).commit();
        }

        await sheet.commit();
        await workbook.commit();
        //so here we are not sending a normal json response, the workbook.commit is the final response

    } catch (error) {
        console.error('Export error:', error.message);
        if (!res.headersSent) {
            return res.status(500).json({ success: false, message: 'Export failed' });
        }
    }
};