import { prisma } from "../config/db.js";
import redis from "../config/redis.js";
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

        const lga = await findLGA(checkInSlug);

        if (!lga || lga.sessions.length === 0) {
            return res.status(400).json({ success: false, message: "No active session", status: 'no_session' });
        }

        const sessionId = lga.sessions[0].id
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

        const cacheKey = `session:${checkInSlug}`;

        //check cache first
        const cached = await redis.get(cacheKey);
        console.log(cached, 'Cached value');

        if (cached) {
            return res.status(200).json({ success: true, session: JSON.parse(cached) })
        }

        //cache miss - hit neon
        const lga = await findLGA(checkInSlug);
        if (!lga) {
            return res.status(404).json({ success: false, message: 'Invalid link.', status: 'invalid_link' });
        }

        if (lga.sessions.length === 0) {
            return res.status(400).json({ success: false, message: 'No open session for this LGA.', status: 'no_session' });
        }
        const session = lga.sessions[0];

        await redis.set(cacheKey, JSON.stringify(session), { EX: 3600 });

        res.status(200).json({ success: true, session })
    } catch (error) {
        console.error('Error validating session:', error.message)
        return res.status(500).json({ success: false, message: 'Internal server error' })
    }
};



export const validateLocation = async (req, res) => {
    const { checkInSlug, latitude, longitude } = req.query;
    if (!checkInSlug || !longitude || !latitude) {
        return res.status(400).json({ success: false, message: "A unique identifier, correct link, latitude and longitude are required" })
    }

    try {

        const cachedKey = `lgaLocation:${checkInSlug}`;
        let lgaData = null;
        const cached = await redis.get(cachedKey);
        console.log(cached, 'cached value location');
        if (cached) {
            lgaData = JSON.parse(cached);
        } else {
            const lga = await findLGA(checkInSlug);
            if (!lga) {
                return res.status(404).json({ success: false, message: 'Invalid link.', status: 'invalid_link' });
            }

            if (lga.sessions.length === 0) {
                return res.status(400).json({ success: false, message: 'No open session for this LGA.', status: 'no_session' });
            }
            lgaData = {
                latitude: lga.latitude,
                longitude: lga.longitude,
                radius: lga.radius,
                sessionId: lga.sessions[0].id
            };

            // TTL of 60s — short enough that session-close propagates quickly
            await redis.set(cachedKey, JSON.stringify(lgaData), 'EX', 3600);
        }

        const distance = haversineDistance(
            lgaData.latitude,
            lgaData.longitude,
            parseFloat(latitude),
            parseFloat(longitude)
        );
        const tolerance = lgaData.radius * 0.1
        const withinRadius = distance <= (lgaData.radius + tolerance);

        res.status(200).json({
            success: true,
            withinRadius,
            sessionId: lgaData.sessionId
        })
    } catch (error) {
        console.error('Error validating location:', error)
        return res.status(500).json({ success: false, message: 'Internal server error' })
    }

}
const findLGA = async (checkInSlug) => {
    return await prisma.lGA.findUnique({
        where: { checkInSlug },
        include: {
            sessions: {
                where: { isOpen: true },
                take: 1
            }
        }
    });
}
const haversineDistance = (lat1, lon1, lat2, lon2) => {
    console.log(lat1, lon1, lat2, lon2)
    const R = 6371000; // Earth radius in metres
    const toRad = (deg) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
