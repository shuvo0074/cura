import { Router } from 'express';
import { myAppointments, completeAppointment } from '../controllers/doctorMe.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken, requireRole('doctor'));
router.get('/appointments', myAppointments);
router.patch('/appointments/:id/complete', completeAppointment);

export default router;
