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