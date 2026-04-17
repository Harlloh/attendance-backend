import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { prisma } from './db.js';
export const generateAccessToken = (adminId, res) => {
    const expiryTime = process.env.ACCESS_EXPIRY_TIME || '30m';
    const token = jwt.sign({ id: adminId }, process.env.JWT_ACCESS_SECRET, { expiresIn: expiryTime })
    // Parse expiry time to milliseconds (default: 30 minutes)

    const maxAgeMs = parseInt(expiryTime.replace('m', '')) * 60 * 1000;
    res.cookie('accessToken', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: maxAgeMs
    })
    return token;
}
export const generateRefreshToken = async (adminId, res) => {
    const token = crypto.randomBytes(64).toString('hex');
    try {
        await prisma.verificationToken.upsert({
            where: { adminId },
            update: {
                token,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            },
            create: {
                token,
                adminId,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
        });

        res.cookie('refreshToken', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: parseInt(process.env.REFRESH_EXPIRY_TIME) * 24 * 60 * 60 * 1000 ///30 days in milli second
        })
        return token
    } catch (error) {
        console.log("error saving refresh token: ", error);
        throw new Error('Failed to generate refresh token');

    }

}