import { Router } from 'express';
import {
  listAllAppointments, createDoctor, updateDoctor, setDoctorPhoto, deleteDoctorPhoto,
  createHospital, updateHospital, setHospitalPhoto, deleteHospitalPhoto,
  listAdminDoctors, listAdminHospitals, getAdminHospital, setDoctorHidden, setHospitalHidden, deleteDoctor, deleteHospital,
} from '../controllers/admin.controller.js';
import {
  listAdminAmbulances, createAmbulance, updateAmbulance, setAmbulanceHidden, deleteAmbulance, getSamplePrices, updateSamplePrices,
} from '../controllers/adminContent.controller.js';
import { listVerifications, approveVerification, rejectVerification } from '../controllers/verifications.controller.js';
import { doctorPhotoUpload, hospitalPhotoUpload, catalogImageUpload } from '../upload.js';
import * as catalog from '../controllers/catalog.controller.js';
import { getSiteContent, updateSiteText, updateHomeContent, updateContacts, updatePhotoCredits, uploadSiteImage } from '../controllers/siteContent.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken, requireRole('admin'));
router.get('/appointments', listAllAppointments);
router.get('/doctors', listAdminDoctors);
router.get('/verifications', listVerifications);
router.post('/verifications/:id/approve', approveVerification);
router.post('/verifications/:id/reject', rejectVerification);
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
router.get('/ambulances', listAdminAmbulances);
router.post('/ambulances', createAmbulance);
router.patch('/ambulances/:id', updateAmbulance);
router.patch('/ambulances/:id/hidden', setAmbulanceHidden);
router.delete('/ambulances/:id', deleteAmbulance);
router.get('/sample-prices', getSamplePrices);
router.patch('/sample-prices', updateSamplePrices);
for (const kind of ['specialties', 'symptoms']) {
  router.get(`/${kind}`, catalog.listAdmin(kind));
  router.post(`/${kind}`, catalog.create(kind));
  router.patch(`/${kind}/:id`, catalog.update(kind));
  router.patch(`/${kind}/:id/hidden`, catalog.setHidden(kind));
  router.delete(`/${kind}/:id`, catalog.remove(kind));
  router.post(`/${kind}/:id/photo`, catalogImageUpload.single('photo'), catalog.uploadImage(kind));
  router.delete(`/${kind}/:id/photo`, catalog.deleteImage(kind));
}
router.get('/site-content', getSiteContent);
router.patch('/site-text', updateSiteText);
router.put('/home-content', updateHomeContent);
router.put('/contacts', updateContacts);
router.put('/photo-credits', updatePhotoCredits);
router.post('/site-images', catalogImageUpload.single('photo'), uploadSiteImage);

export default router;
