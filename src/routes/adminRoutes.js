import express from 'express';
import { updateLgaDetails } from '../controllers/adminController.js';

const router = express.Router();

router.post('/update-lga', updateLgaDetails)

export default router