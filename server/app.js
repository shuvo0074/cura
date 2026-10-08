import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import doctorsRoutes from './routes/doctors.routes.js';
import hospitalsRoutes from './routes/hospitals.routes.js';
import authRoutes from './routes/auth.routes.js';
import appointmentsRoutes from './routes/appointments.routes.js';
import adminRoutes from './routes/admin.routes.js';
import doctorMeRoutes from './routes/doctorMe.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { httpLogger } from './logger.js';

export const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(httpLogger);

app.get('/api/health', (_req, res) => res.json({ ok: true }));
// For the mobile app: versions older than minVersion must update before use,
// and photo paths in responses are relative to webBaseUrl.
app.get('/api/app-config', (_req, res) => res.json({
  minVersion: process.env.MOBILE_MIN_VERSION || '0.1.0',
  latestVersion: process.env.MOBILE_LATEST_VERSION || '0.1.0',
  webBaseUrl: process.env.PUBLIC_WEB_URL || null,
}));
app.use('/api/doctors/me', doctorMeRoutes);
app.use('/api/doctors', doctorsRoutes);
app.use('/api/hospitals', hospitalsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/admin', adminRoutes);

app.use(errorHandler);
