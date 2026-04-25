import express from 'express'
import { getNumber, validateSession, validateLocation } from '../controllers/userController.js'
const router = express.Router()

router.get('/validateSession', validateSession)
router.get('/validateLocation', validateLocation)
router.post('/getNumber', getNumber)
export default router