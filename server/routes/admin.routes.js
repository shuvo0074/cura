import { Router } from 'express';
import {
  listAllAppointments, createDoctor, updateDoctor, setDoctorPhoto, deleteDoctorPhoto,
  createHospital, updateHospital, setHospitalPhoto, deleteHospitalPhoto,
} from '../controllers/admin.controller.js';
import { doctorPhotoUpload, hospitalPhotoUpload } from '../upload.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken, requireRole('admin'));
router.get('/appointments', listAllAppointments);
router.post('/doctors', createDoctor);
router.patch('/doctors/:id', updateDoctor);
router.post('/doctors/:id/photo', doctorPhotoUpload.single('photo'), setDoctorPhoto);
router.delete('/doctors/:id/photo', deleteDoctorPhoto);
router.post('/hospitals', createHospital);
router.patch('/hospitals/:id', updateHospital);
router.post('/hospitals/:id/photo', hospitalPhotoUpload.single('photo'), setHospitalPhoto);
router.delete('/hospitals/:id/photo', deleteHospitalPhoto);

export default router;
