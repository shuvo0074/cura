import { Router } from 'express';
import { listDoctors, getDoctor, getDoctorSlots, shareDoctor } from '../controllers/doctors.controller.js';

const router = Router();

router.get('/', listDoctors);
router.get('/:id', getDoctor);
router.get('/:id/slots', getDoctorSlots);
router.post('/:id/share', shareDoctor);

export default router;
