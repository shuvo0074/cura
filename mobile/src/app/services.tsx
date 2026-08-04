import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  HttpAppointmentApi,
  HttpAuthApi,
  HttpClient,
  HttpPatientApi,
  createAppConfig,
  type AppointmentApi,
  type AuthApi,
  type ClientEnv,
  type PatientApi,
} from '@cura/shared';

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

function readEnv(): ClientEnv {
  const environment = (process.env.EXPO_PUBLIC_ENVIRONMENT ?? 'development') as
    | 'development'
    | 'staging'
    | 'production';

  const env: ClientEnv = {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api',
    wsBaseUrl: process.env.EXPO_PUBLIC_WS_BASE_URL ?? 'ws://localhost:3000',
    environment,
  };

  // Certificate-protected transport is not optional for clinical data.
  if (environment === 'production' && !env.apiBaseUrl.startsWith('https://')) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must use https in production builds');
  }

  return env;
}

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
