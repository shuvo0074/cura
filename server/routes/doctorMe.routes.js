import { Router } from 'express';
import { myAppointments, completeAppointment } from '../controllers/doctorMe.controller.js';
import {
  getMyProfile, updateMyProfile, addMyItem, updateMyItem, deleteMyItem, setMyPhoto, deleteMyPhoto,
} from '../controllers/doctorProfile.controller.js';
import { myInsights } from '../controllers/doctorInsights.controller.js';
import { verifyToken, requireRole, requireLinkedDoctor } from '../middleware/auth.js';
import { doctorPhotoUpload } from '../upload.js';

const router = Router();

router.use(verifyToken, requireRole('doctor'), requireLinkedDoctor);
router.get('/appointments', myAppointments);
router.patch('/appointments/:id/complete', completeAppointment);
router.get('/insights', myInsights);
router.get('/profile', getMyProfile);
router.patch('/profile', updateMyProfile);
router.post('/profile/items', addMyItem);
router.patch('/profile/items/:itemId(\\d+)', updateMyItem);
router.delete('/profile/items/:itemId(\\d+)', deleteMyItem);
router.post('/profile/photo', doctorPhotoUpload.single('photo'), setMyPhoto);
router.delete('/profile/photo', deleteMyPhoto);

export default router;
