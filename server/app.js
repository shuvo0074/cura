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
import { listAmbulances } from './controllers/ambulances.controller.js';

export const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(httpLogger);

app.get('/api/health', (_req, res) => res.json({ ok: true }));
// Ambulance vendors (edited in the admin panel), each with its source and checked-on date.
app.get('/api/ambulances', listAmbulances);
app.use('/api/doctors/me', doctorMeRoutes);
app.use('/api/doctors', doctorsRoutes);
app.use('/api/hospitals', hospitalsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/admin', adminRoutes);

app.use(errorHandler);
