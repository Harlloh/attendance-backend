import express from 'express';
import { updateLgaDetails, openSession, closeSession, manualAssignment, getAttendanceList, searchAttendance, getAdmin, validateUser } from '../controllers/adminController.js';

const router = express.Router();

router.post('/update-lga', updateLgaDetails)
router.post('/open-session', openSession)
router.post('/close-session', closeSession)
router.post('/assign-number', manualAssignment)
router.get('/attendanceList', getAttendanceList)
router.get('/attendanceList/search', searchAttendance)
router.get('/getAdmin', getAdmin)
router.post('/scan', validateUser)

export default router