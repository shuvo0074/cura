import { Router } from 'express';
import { requestOtp, verifyOtp, doctorLogin, adminLogin, me, logout } from '../controllers/auth.controller.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.post('/otp/request', requestOtp);
router.post('/otp/verify', verifyOtp);
router.post('/doctor/login', doctorLogin);
router.post('/admin/login', adminLogin);
router.get('/me', verifyToken, me);
router.post('/logout', logout);

export default router;
