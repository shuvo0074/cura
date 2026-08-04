import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  HttpAppointmentApi,
  HttpAuthApi,
  HttpClient,
  HttpPatientApi,
  createAppConfig,
  type AppointmentApi,
  type AuthApi,
  type PatientApi,
} from '@cura/shared';
import { readEnv } from '../config/env';

/**
 * Composition root for the mobile client.
 *
 * Identical in shape to the web root — same `HttpClient`, same API adapters,
 * same interfaces handed to ViewModels. Only the environment source differs.
 */
export interface Services {
  http: HttpClient;
  auth: AuthApi;
  appointments: AppointmentApi;
  patients: PatientApi;
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ children }: { children: ReactNode }) {
  const services = useMemo<Services>(() => {
    const http = new HttpClient(createAppConfig(readEnv()));
    return {
      http,
      auth: new HttpAuthApi(http),
      appointments: new HttpAppointmentApi(http),
      patients: new HttpPatientApi(http),
    };
  }, []);

  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useServices must be used inside <ServicesProvider>');
  return ctx;
}
