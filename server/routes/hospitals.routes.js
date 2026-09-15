import { Router } from 'express';
import { listHospitals, getHospital, getHospitalDoctors } from '../controllers/hospitals.controller.js';

const router = Router();

router.get('/', listHospitals);
router.get('/:id', getHospital);
router.get('/:id/doctors', getHospitalDoctors);

export default router;
