import { Router } from 'express';
import {
  listAllAppointments, createDoctor, updateDoctor, setDoctorPhoto, deleteDoctorPhoto,
  createHospital, updateHospital, setHospitalPhoto, deleteHospitalPhoto,
  listAdminDoctors, listAdminHospitals, getAdminHospital, setDoctorHidden, setHospitalHidden, deleteDoctor, deleteHospital,
} from '../controllers/admin.controller.js';
import { doctorPhotoUpload, hospitalPhotoUpload } from '../upload.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken, requireRole('admin'));
router.get('/appointments', listAllAppointments);
router.get('/doctors', listAdminDoctors);
router.post('/doctors', createDoctor);
router.patch('/doctors/:id', updateDoctor);
router.patch('/doctors/:id/hidden', setDoctorHidden);
router.delete('/doctors/:id', deleteDoctor);
router.post('/doctors/:id/photo', doctorPhotoUpload.single('photo'), setDoctorPhoto);
router.delete('/doctors/:id/photo', deleteDoctorPhoto);
router.get('/hospitals', listAdminHospitals);
router.get('/hospitals/:id', getAdminHospital);
router.post('/hospitals', createHospital);
router.patch('/hospitals/:id', updateHospital);
router.patch('/hospitals/:id/hidden', setHospitalHidden);
router.delete('/hospitals/:id', deleteHospital);
router.post('/hospitals/:id/photo', hospitalPhotoUpload.single('photo'), setHospitalPhoto);
router.delete('/hospitals/:id/photo', deleteHospitalPhoto);

export default router;
