import express from 'express'
import { loginController, registerController, refreshAccessToken, logout } from '../controllers/authController.js'
const router = express.Router()

router.post('/login', loginController)
router.get('/refresh', refreshAccessToken)
router.get('/logout', logout)
//router.post('/register', registerController)

export default router
