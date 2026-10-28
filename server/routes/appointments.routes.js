import { Router } from 'express';
import { createAppointment, myAppointments, cancelAppointment } from '../controllers/appointments.controller.js';
import { reviewAppointment } from '../controllers/doctorProfile.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken, requireRole('patient'));
router.post('/', createAppointment);
router.get('/me', myAppointments);
router.patch('/:id/cancel', cancelAppointment);
router.post('/:id(\\d+)/review', reviewAppointment);

export default router;
