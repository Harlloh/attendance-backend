import express from 'express';
import { adminTestController } from '../controllers/adminController.js';

const router = express.Router();

router.get('/', adminTestController)

export default router