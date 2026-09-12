import { Router } from 'express';
import { listHospitals, getHospital } from '../controllers/hospitals.controller.js';

const router = Router();

router.get('/', listHospitals);
router.get('/:id', getHospital);

export default router;
