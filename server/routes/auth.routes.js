import { Router } from 'express';
import {
  registerPatient, registerDoctor, login, doctorLogin, adminLogin,
  requestOtp, verifyOtp, me, changePassword, logout, logoutAll,
} from '../controllers/auth.controller.js';
import { verifyToken, optionalAuth } from '../middleware/auth.js';
import { limitByIp } from '../middleware/rateLimit.js';

const router = Router();
const MIN = 60 * 1000;

// Per-IP ceilings sit above the per-account limits in the controller, so a
// shared connection (an office, a mobile carrier NAT) isn't locked out by
// one person's typos.
const registerLimit = limitByIp('register', { max: 10, windowMs: 60 * MIN });
const loginLimit = limitByIp('login', { max: 50, windowMs: 15 * MIN });
const otpLimit = limitByIp('otp', { max: 20, windowMs: 60 * MIN });

router.post('/register', registerLimit, registerPatient);
router.post('/register/doctor', registerLimit, registerDoctor);
router.post('/login', loginLimit, login);
router.post('/doctor/login', loginLimit, doctorLogin);
router.post('/admin/login', loginLimit, adminLogin);
router.post('/otp/request', otpLimit, requestOtp);
router.post('/otp/verify', otpLimit, verifyOtp);
router.get('/me', verifyToken, me);
router.patch('/password', verifyToken, loginLimit, changePassword);
router.post('/logout', optionalAuth, logout);
router.post('/logout-all', verifyToken, logoutAll);

export default router;
