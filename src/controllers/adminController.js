import { prisma } from "../config/db.js";
import jwt from 'jsonwebtoken';
export const updateLgaDetails = async (req, res) => {
    const { name, latitude, longitude, radius } = req.body
    const { accessToken } = req.cookies
    const decoded = jwt.verify(accessToken, process.env.JWT_ACCESS_SECRET);
    const adminId = decoded.id;

    console.log(decoded);

    const lga = await prisma.lGA.upsert({
        where: { adminId },
        update: {
            latitude,
            longitude,
            name,
            radius
        },
        create: {
            latitude,
            longitude,
            name,
            radius,
            adminId
        }
    })
    res.json({ success: true, lga })
}