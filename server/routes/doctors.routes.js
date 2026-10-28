import { Router } from 'express';
import { listDoctors, getDoctor, getDoctorBySlug, getDoctorSlots, getDoctorSessions, shareDoctor, logCall, featuredDoctors, directoryStats } from '../controllers/doctors.controller.js';
import { getPublicProfile, endorse, unendorse } from '../controllers/doctorProfile.controller.js';
import { recordView } from '../controllers/doctorInsights.controller.js';
import { limitByIp } from '../middleware/rateLimit.js';
import { optionalAuth, verifyToken, requireRole, requireLinkedDoctor } from '../middleware/auth.js';

const router = Router();

// Reach counters feed the doctor's insights, so one address can't pump them.
const reachLimit = limitByIp('doctor-reach', { max: 120, windowMs: 60 * 60 * 1000 });

router.get('/', listDoctors);
// Before '/:id' so these paths aren't read as a doctor id.
router.get('/featured', featuredDoctors);
router.get('/stats', directoryStats);
router.get('/by-slug/:slug', getDoctorBySlug);
router.get('/:id', getDoctor);
router.get('/:id/slots', getDoctorSlots);
router.get('/:id/sessions', optionalAuth, getDoctorSessions);
router.post('/:id(\\d+)/share', reachLimit, shareDoctor);
router.post('/:id(\\d+)/call', reachLimit, logCall);
router.post('/:id(\\d+)/view', reachLimit, optionalAuth, recordView);
router.get('/:id(\\d+)/profile', optionalAuth, getPublicProfile);
// Only doctors whose account is linked to a listing can vouch for others.
router.post('/:id(\\d+)/endorsements', verifyToken, requireRole('doctor'), requireLinkedDoctor, endorse);
router.delete('/:id(\\d+)/endorsements', verifyToken, requireRole('doctor'), requireLinkedDoctor, unendorse);

export default router;
