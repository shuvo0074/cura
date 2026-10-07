import { Router } from 'express';
import { listDoctors, getDoctor, getDoctorSlots, getDoctorSessions, shareDoctor, logCall } from '../controllers/doctors.controller.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', listDoctors);
router.get('/:id', getDoctor);
router.get('/:id/slots', getDoctorSlots);
router.get('/:id/sessions', optionalAuth, getDoctorSessions);
router.post('/:id/share', shareDoctor);
router.post('/:id/call', logCall);

export default router;
