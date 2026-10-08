import { Router } from 'express';
import { listDoctors, getDoctor, getDoctorSlots, getDoctorSessions, shareDoctor, logCall, featuredDoctors, directoryStats } from '../controllers/doctors.controller.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', listDoctors);
// Before '/:id' so these paths aren't read as a doctor id.
router.get('/featured', featuredDoctors);
router.get('/stats', directoryStats);
router.get('/:id', getDoctor);
router.get('/:id/slots', getDoctorSlots);
router.get('/:id/sessions', optionalAuth, getDoctorSessions);
router.post('/:id/share', shareDoctor);
router.post('/:id/call', logCall);

export default router;
