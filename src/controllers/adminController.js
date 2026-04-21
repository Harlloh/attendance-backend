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
    try {
        // need the admin's lgaId to associate the session
        const admin = await prisma.admin.findUnique({
            where: { id: adminId },
            include: { lga: true }
        });

        if (!admin?.lga) {
            return res.status(400).json({
                success: false,
                message: 'LGA not configured. Set up geofence first.'
            });
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
    const adminId = req.admin.id;

    try {
        const session = await prisma.session.update({
            where: { id: sessionId, adminId },
            data: {
                isOpen: false,
                closedAt: new Date(),
            }
        });

        if (!session) {
            return res.status(400).json({
                success: false,
                message: 'Session not found'
            });
        }

        res.status(200).json({ success: true, session });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to close session.' });
    }
};