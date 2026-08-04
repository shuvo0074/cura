/**
 * Single runtime configuration surface for the client applications.
 *
 * Business rules that both the web app and the mobile app must agree on live
 * here — not duplicated in components. Anything environment-specific is
 * injected through `createAppConfig()` so the same build artefact can run
 * against different backends.
 */

export interface ClientEnv {
  apiBaseUrl: string;
  wsBaseUrl: string;
  environment: 'development' | 'staging' | 'production';
  sentryDsn?: string;
}

export const businessRules = {
  auth: {
    /** Spec 1.4: "Remember me for 30 days". */
    rememberMeDays: 30,
    otpLength: 6,
    otpTtlSeconds: 300,
    otpMaxAttempts: 5,
    otpResendCooldownSeconds: 60,
    passwordMinLength: 10,
    /** Access token lifetime; refresh rotation handles longer sessions. */
    accessTokenTtlSeconds: 900,
    maxFailedLoginsBeforeLock: 5,
    accountLockMinutes: 15,
  },

  search: {
    /** Spec: "The system shall initiate a search after the third character". */
    minQueryLength: 3,
    debounceMs: 250,
    maxResults: 20,
  },

  calendar: {
    /** Spec 6.6.c.1.4.2: default appointment duration is 10 minutes. */
    defaultSlotMinutes: 10,
    allowedSlotMinutes: [5, 10, 15, 20, 30, 45, 60],
    views: ['day', 'threeDay', 'week', 'month'] as const,
    defaultView: 'week' as const,
    /** Spec: "Always show Today as the first day" checked by default. */
    todayFirstByDefault: true,
    infiniteScrollChunkDays: 7,
    workingHours: { start: '09:00', end: '21:00' },
  },

  patient: {
    /** Spec: 90-day privacy window before consent unlock is required. */
    privacyWindowDays: 90,
    recentFilterDays: 7,
    timelineMaxYears: 1,
    idPrefix: 'CURA',
  },

  onboarding: {
    totalSteps: 4,
    /** Spec 3.2.6(iii): steps 2-4 are skippable, step 1 is not. */
    skippableSteps: [2, 3, 4],
    autosaveDebounceMs: 1200,
  },

  uploads: {
    maxFileBytes: 10 * 1024 * 1024,
    acceptedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
    acceptedDocumentTypes: ['application/pdf'],
  },

  pagination: {
    defaultPageSize: 25,
    maxPageSize: 100,
  },
} as const;

/**
 * Feature flags. Modules the specification lists but does not fully define
 * (Practo integration, Prime Services, Community) ship dark by default.
 */
export type FeatureFlag =
  | 'telemedicine'
  | 'practoIntegration'
  | 'primeServices'
  | 'community'
  | 'facebookLogin'
  | 'twoFactorAuth'
  | 'offlineMode'
  | 'pushNotifications';

export type FeatureFlags = Record<FeatureFlag, boolean>;

export const featureFlags: FeatureFlags = {
  telemedicine: false,
  practoIntegration: false,
  primeServices: false,
  community: false,
  facebookLogin: true,
  twoFactorAuth: true,
  offlineMode: true,
  pushNotifications: true,
};

export const network = {
  requestTimeoutMs: 20_000,
  retry: { attempts: 3, baseDelayMs: 300, maxDelayMs: 4_000 },
  /** Realtime queue counters (spec: "update in real-time ... via WebSockets"). */
  websocket: {
    reconnectBaseDelayMs: 500,
    reconnectMaxDelayMs: 15_000,
    heartbeatIntervalMs: 25_000,
  },
} as const;

export const i18n = {
  defaultLocale: 'en' as const,
  supportedLocales: ['en', 'bn'] as const,
  fallbackLocale: 'en' as const,
};

export type SupportedLocale = (typeof i18n.supportedLocales)[number];

export interface AppConfig {
  env: ClientEnv;
  rules: typeof businessRules;
  flags: FeatureFlags;
  network: typeof network;
  i18n: typeof i18n;
}

export function createAppConfig(
  env: ClientEnv,
  overrides?: Partial<FeatureFlags>,
): AppConfig {
  return {
    env,
    rules: businessRules,
    flags: { ...featureFlags, ...overrides },
    network,
    i18n,
  };
}
