import { Router } from 'express';
import { listDoctors, getDoctor, getDoctorSlots, shareDoctor, logCall } from '../controllers/doctors.controller.js';

const router = Router();

router.get('/', listDoctors);
router.get('/:id', getDoctor);
router.get('/:id/slots', getDoctorSlots);
router.post('/:id/share', shareDoctor);
router.post('/:id/call', logCall);

export default router;
