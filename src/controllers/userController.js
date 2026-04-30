import { prisma } from "../config/db.js";

export const getNumber = async (req, res) => {
    const { stateCode, name } = req.body
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