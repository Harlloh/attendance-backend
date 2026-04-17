import { prisma } from "../config/db.js"
import { generateAccessToken, generateRefreshToken } from "../config/utils.js"
import bcrypt from 'bcryptjs';

export const loginController = async (req, res) => {
    try {
        const { email, password } = req.body

        const user = await prisma.admin.findFirst({
            where: { email: email }
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
        return res.status(200).json({
            success: true,
            admin: {
                id: admin.id,
                email: admin.email,
                lgaName: admin.lgaName
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
            where: { email }
        })
        if (userExist) {
            return res.json.status(409)({ success: false, message: "User already exist with this email!" })
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt)

        const user = await prisma.admin.create({
            data: {
                password: hashedPassword,
                email
            }
        });

        return res.json.status(200)({ success: true, message: 'Admin account created successfully' })
    } catch (error) {
        console.error('Account creation error:', error.message)
        return res.status(500).json({ success: false, message: 'Internal server error' })

    }
}