import { prisma } from "../config/db.js";
import { handleNumberAssignment } from "./adminController.js";

export const getNumber = async (req, res) => {
    try {
        const { stateCode, name, browserId, checkInSlug } = req.body;
        if (!stateCode || !name) {
            return res.status(401).json({ success: false, message: 'Name and statecode are required.' })
        }

        if (!browserId) {
            return res.status(401).json({ success: false, message: 'Please refresh your browser, unique id could not be generated for you.' })
        }

        const lga = await prisma.lGA.findUnique({
            where: { checkInSlug },
            include: {
                sessions: { where: { isOpen: true }, take: 1 }
            }
        });
        console.log('88', lga, 'this is the lga that gives the session id');
        if (!lga || lga.sessions.length === 0) {
            return res.status(400).json({ success: false, message: "No active session", status: 'no_session' });
        }

        const sessionId = lga.sessions[0].id

        console.log(sessionId, 'Session Id');
        // Check fingerprint first
        const existingByDevice = await prisma.attendanceRecord.findUnique({
            where: {
                sessionId_deviceFingerprint: { sessionId, deviceFingerprint: browserId }
            }
        });
        // console.log(existingByDevice, 'Existing device value');
        if (existingByDevice) {
            return res.status(200).json({
                success: true,
                alreadyCheckedIn: true,
                queueNumber: existingByDevice.queueNumber,
                checkedInAt: existingByDevice.timestamp,
                name: existingByDevice.name,
                status: 'already_in'

            });
        }

        // Check state code
        const existingByStateCode = await prisma.attendanceRecord.findUnique({
            where: {
                sessionId_stateCode: { sessionId, stateCode }
            }
        });
        // console.log(existingByStateCode, 'existing by statecode');
        if (existingByStateCode) {
            return res.status(200).json({
                success: true,
                alreadyCheckedIn: true,
                queueNumber: existingByStateCode.queueNumber,
                checkedInAt: existingByStateCode.timestamp,
                name: existingByStateCode.name,
                status: 'already_in'

            });
        }
        console.log(sessionId, stateCode, name, browserId);
        const record = await handleNumberAssignment(false, sessionId, stateCode, name, browserId);
        return res.status(201).json({
            success: true,
            alreadyCheckedIn: false,
            queueNumber: record.queueNumber,
            checkedInAt: record.timestamp,
            name: record.name,
            stateCode: record.stateCode,
            status: 'success'
        });

    } catch (error) {
        console.error('Error getting number:', error.message)
        return res.status(500).json({ success: false, message: 'Internal server error', status: 'error' })

    }
}



















export const validateSession = async (req, res) => {
    const { checkInSlug } = req.query;
    if (!checkInSlug) {
        return res.status(400).json({ success: false, message: "A unique identifier is required" })
    }
    try {
        const lga = await prisma.lGA.findUnique({
            where: { checkInSlug },
            include: {
                sessions: {
                    where: { isOpen: true },
                    take: 1
                }
            }
        });
        if (!lga) {
            return res.status(404).json({ success: false, message: 'Invalid link.', status: 'invalid_link' });
        }

        if (lga.sessions.length === 0) {
            return res.status(400).json({ success: false, message: 'No open session for this LGA.', status: 'no_session' });
        }
        console.log(lga.sessions);
        const session = lga.sessions[0];

        res.status(200).json({ success: true, session })
    } catch (error) {
        console.error('Error validating session:', error.message)
        return res.status(500).json({ success: false, message: 'Internal server error' })
    }

}
export const validateLocation = async (req, res) => {
    const { checkInSlug, latitude, longitude, accuracy } = req.query;
    if (!checkInSlug || !longitude || !latitude) {
        return res.status(400).json({ success: false, message: "A unique identifier, correct link, latitude and longitude are required" })
    }
    try {
        const lga = await prisma.lGA.findUnique({
            where: { checkInSlug },
            include: {
                sessions: {
                    where: { isOpen: true },
                    take: 1
                }
            }
        });
        if (!lga) {
            return res.status(404).json({ success: false, message: 'Invalid link.', status: 'invalid_link' });
        }

        if (lga.sessions.length === 0) {
            return res.status(400).json({ success: false, message: 'No open session for this LGA.', status: 'no_session' });
        }
        const distance = haversineDistance(
            lga.latitude,
            lga.longitude,
            parseFloat(latitude),
            parseFloat(longitude)
        );
        const tolerance = lga.radius * 0.1
        const withinRadius = distance <= (lga.radius + tolerance);
        console.log(`Distance: ${distance}m, Radius: ${lga.radius}m, Within: ${withinRadius} with this location accuracy ${accuracy}`);
        console.log(lga.latitude,
            lga.longitude, 'and this are the lat and lng from the user', latitude, longitude, lga.radius, accuracy);

        res.status(200).json({
            success: true,
            withinRadius,
            sessionId: lga.sessions[0].id
        })
    } catch (error) {
        console.error('Error validating location:', error.message)
        return res.status(500).json({ success: false, message: 'Internal server error' })
    }

}
const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; // Earth radius in metres
    const toRad = (deg) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};