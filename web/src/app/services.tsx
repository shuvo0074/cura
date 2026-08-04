import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { appConfig } from '../config/env';
import { HttpClient } from '@cura/shared';
import {
  HttpBillingApi,
  HttpClinicalApi,
  HttpOnboardingApi,
  HttpSettingsApi,
  type BillingApi,
  type ClinicalApi,
  type OnboardingApi,
  type SettingsApi,
} from '@cura/shared';
import {
  HttpAppointmentApi,
  HttpAuthApi,
  HttpPatientApi,
  type AppointmentApi,
  type AuthApi,
  type PatientApi,
} from '@cura/shared';

/**
 * Composition root for the web client.
 *
 * Concrete adapters are constructed once here and handed to Views as
 * interfaces. A ViewModel receives `AuthApi`, not `HttpAuthApi`, so tests and
 * Storybook can inject fakes without touching the network.
 */
export interface Services {
  http: HttpClient;
  auth: AuthApi;
  appointments: AppointmentApi;
  patients: PatientApi;
  clinical: ClinicalApi;
  onboarding: OnboardingApi;
  settings: SettingsApi;
  billing: BillingApi;
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ children }: { children: ReactNode }) {
  const services = useMemo<Services>(() => {
    const http = new HttpClient(appConfig);
    return {
      http,
      auth: new HttpAuthApi(http),
      appointments: new HttpAppointmentApi(http),
      patients: new HttpPatientApi(http),
      clinical: new HttpClinicalApi(http),
      onboarding: new HttpOnboardingApi(http),
      settings: new HttpSettingsApi(http),
      billing: new HttpBillingApi(http),
    };
  }, []);

  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useServices must be used inside <ServicesProvider>');
  return ctx;
}
