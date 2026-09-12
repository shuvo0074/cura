import { Router } from 'express';
import {
  listAllAppointments, createDoctor, updateDoctor, createHospital, updateHospital,
} from '../controllers/admin.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken, requireRole('admin'));
router.get('/appointments', listAllAppointments);
router.post('/doctors', createDoctor);
router.patch('/doctors/:id', updateDoctor);
router.post('/hospitals', createHospital);
router.patch('/hospitals/:id', updateHospital);

export default router;
