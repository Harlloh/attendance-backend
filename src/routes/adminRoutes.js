import express from 'express';
import { updateLgaDetails, openSession, closeSession, manualAssignment } from '../controllers/adminController.js';

const router = express.Router();

router.post('/update-lga', updateLgaDetails)
router.get('/open-session', openSession)
router.post('/close-session', closeSession)
router.post('/assign-number', manualAssignment)

export default router