import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';
export const authMiddleware = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
            token = req.headers.authorization.split(' ')[1]
        } else if (req.cookies?.accessToken) {
            token = req.cookies.accessToken
        }

        if (!token) {
            if (req.cookies.refreshToken) {
                return res.status(401).json({
                    error: 'Access token missing. Please wait while your session is refreshed',
                    code: 'NO_ACCESS_TOKEN'
                })
            }
            console.log('refresh token missing: ', token);
            return res.status(401).json({
                error: 'Not authorized. Please sign in.',
                code: 'NO_TOKEN'
            })
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET)

            const user = await prisma.admin.findFirst({
                where: { id: decoded.id }
            })

            if (!user) {
                return res.status(401).json({ error: 'User no longer exist' })
            }
            req.admin = user
            next()
        } catch (error) {
            if (error.name == 'TokenExpiredError') {
                if (req.cookies?.refreshToken) {
                    return res.status(401).json({
                        error: 'Access token expired',
                        code: 'NO_ACCESS_TOKEN' // same code, frontend handles it the same way
                    });
                }
                // access token expired AND no refresh token
                console.log('Refresh token expired: ');
                return res.status(401).json({
                    error: 'Session expired. Please sign in again.',
                    code: 'NO_TOKEN'
                });
            }

            if (error.name === 'JsonWebTokenError') {
                console.log('invalid refresh token');
                return res.status(401).json({
                    error: 'Invalid token',
                    code: 'NO_TOKEN'
                });
            }
            console.error('User token verification failed:', error.message)
            return res.status(500).json({ success: false, message: 'Internal server error hzxcjh' })
        }

    } catch (error) {
        console.error('Middleware failed the request:', error.message)
        return res.status(500).json({ success: false, message: 'Internal server error' })

    }

}