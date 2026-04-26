import { prisma } from "../config/db.js"
import { generateAccessToken, generateRefreshToken } from "../config/utils.js"
import bcrypt from 'bcryptjs';

export const loginController = async (req, res) => {
    try {
        const { email, password } = req.body

        const user = await prisma.admin.findFirst({
            where: { email: email },
            include: { lga: true, sessions: true }
        })
        if (!user) {
            return res.json({ success: false, message: 'Invalid Credentials' })
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.json({ success: false, message: 'Invalid Credentials' })
        }
        generateAccessToken(user.id, res)
        await generateRefreshToken(user.id, res)
        // console.log(user.sessions, 'THis is the user response from the db');
        const sessionDetails = user.sessions.length > 1 ? user.sessions[user.sessions.length - 1] : user.sessions[0]
        return res.status(200).json({
            success: true,
            admin: {
                id: user.id,
                email: user.email,
                lgaDetails: user.lga ? {
                    id: user.lga.id,
                    name: user.lga.name,
                    state: user.lga.state,
                    latitude: user.lga.latitude,
                    longitude: user.lga.longitude,
                    radius: user.lga.radius,
                    radius: user.lga.radius,
                    checkInSlug: user.lga.checkInSlug
                } : null,
                sessionDetails: sessionDetails ? sessionDetails : null
            }
        })
    } catch (error) {
        console.error('Login error:', error.message)
        return res.status(500).json({ success: false, message: 'Internal server error' })
    }
}

export const registerController = async (req, res) => {
    // const email = process.env.ADMIN_EMAIL
    // const password = process.env.ADMIN_PASSWORD
    console.log(req.body);
    try {
        const { email, password, lga } = req.body

        const userExist = await prisma.admin.findFirst({
            where: { email: email }
        })
        if (userExist) {
            return res.status(409).json({ success: false, message: "User already exist with this email!" })
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt)

        const user = await prisma.admin.create({
            data: {
                password: hashedPassword,
                email
            }
        });

        return res.status(200).json({ success: true, message: 'Admin account created successfully' })
    } catch (error) {
        console.error('Account creation error:', error.message)
        return res.status(500).json({ success: false, message: 'Internal server error' })

    }
}

export const refreshAccessToken = async (req, res) => {
    const { refreshToken } = req.cookies
    if (!refreshToken) {
        return res.status(400).json({ success: false, message: "Refresh token missing!", code: 'NO_TOKEN' })
    }

    const token = await prisma.verificationToken.findFirst({
        where: { token: refreshToken }
    })
    console.log('This should be the token: ', token);
    if (!token) {
        return res.status(400).json({ success: false, message: "Invalid refresh token missing!", code: 'INVALID_REFRESH_TOKEN' })
    }

    if (token.expiresAt < new Date()) {
        await prisma.verificationToken.delete({
            where: { token: refreshToken }
        })

        return res.status(401).json({
            success: false,
            message: 'Refresh token expired. Please log in again.',
            code: 'REFRESH_TOKEN_EXPIRED'
        });
    }

    const newAccessToken = generateAccessToken(token.adminId, res)

    return res.status(200).json({
        message: 'Access token refreshed successfully',
        accessToken: newAccessToken
    });
}

export const logout = async (req, res) => {
    const { refreshToken } = req.cookies;
    try {
        if (refreshToken) {
            await prisma.verificationToken.delete({
                where: { token: refreshToken }  // delete THIS device's token only
            });
        }
    } catch (error) {
        if (error.code === 'P2025') {
            // Token already gone (other device logged out, or expired)
            // This is fine — still clear cookies and proceed
            console.log('Refresh token not found — already invalidated or logged out elsewhere');
        } else {
            // Actual unexpected error
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }

    // Always clear cookies, regardless of whether DB delete succeeded
    res.clearCookie('accessToken', { httpOnly: true });
    res.clearCookie('refreshToken', { httpOnly: true, secure: true, sameSite: 'none' });

    return res.status(200).json({ success: true, message: 'Logged out successfully' });
};