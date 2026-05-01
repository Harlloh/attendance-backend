import { prisma } from "../config/db.js";
import jwt from 'jsonwebtoken';

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
        res.json({ success: true, lga })
    } catch (error) {
        console.error('Admin update error:', error.message)
        return res.status(500).json({ success: false, message: 'Internal server error' })
    }
}
export const openSession = async (req, res) => {
    const adminId = req.admin.id;
    const { sessionId } = req.body
    if (!sessionId) {
        return res.status(400).json({ success: false, message: 'sessionId is required.' });
    }
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
                    id: sessionId,
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
            where: { id: sessionId, adminId }
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