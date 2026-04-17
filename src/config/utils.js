import jwt from 'jsonwebtoken'
import { prisma } from './db.js';
export const generateAccessToken = (adminId, res) => {
    const token = jwt.sign({ id: adminId }, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.ACCESS_EXPIRY_TIME || '30m' })
    res.cookie('accessToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
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
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'none',
            maxAge: 30 * 24 * 60 * 60 * 1000 ///7 days in milli second
        })
        return token
    } catch (error) {
        console.log("error saving refresh token: ", error);
        throw new Error('Failed to generate refresh token');

    }

}