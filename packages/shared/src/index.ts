/** Public surface of the shared package. */

export * from './design/palette';
export * from './design/theme';

export * from './config/app-config';

export * from './domain/enums';
export * from './domain/models';

export * from './validation/schemas';

export * from './utils/result';
export * from './utils/format';

/**
 * Platform-agnostic runtime: MVVM base, HTTP transport and the ViewModels.
 *
 * These contain no DOM and no React Native API, so the web app and the mobile
 * app run the same behaviour and differ only in their Views.
 */
export * from './runtime/view-model';
export * from './runtime/token-store';
export * from './runtime/http-client';
export * from './runtime/api-services';
export * from './runtime/login.view-model';
export * from './runtime/calendar.view-model';
export * from './runtime/clinical-services';
export * from './runtime/onboarding.view-model';
export * from './runtime/patient-dashboard.view-model';
