/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_WS_BASE_URL?: string;
  readonly VITE_ENVIRONMENT?: 'development' | 'staging' | 'production';
  readonly VITE_SENTRY_DSN?: string;
  /** Cura Website's address, for the images it serves to both front ends. */
  readonly VITE_WEBSITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
