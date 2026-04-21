import express from 'express';
import { updateLgaDetails, openSession, closeSession } from '../controllers/adminController.js';

const router = express.Router();

router.post('/update-lga', updateLgaDetails)
router.post('/open-session', openSession)
router.post('/close-session', closeSession)

export default router