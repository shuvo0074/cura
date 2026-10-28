import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  // Session cookie is HTTPS-only in production; COOKIE_SECURE overrides.
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProduction,
  // Browser origins allowed to call the API cross-origin with credentials,
  // comma-separated. The web app goes through the Vite proxy (same origin)
  // and the mobile app sends no Origin, so neither needs to be listed.
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  // Express "trust proxy": which hops' X-Forwarded-For to believe, so rate
  // limits see the real client IP behind the Vite proxy / Docker network.
  trustProxy: process.env.TRUST_PROXY || 'loopback, uniquelocal',
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: Number(process.env.MINIO_PORT || 9000),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: required('MINIO_ACCESS_KEY'),
    secretKey: required('MINIO_SECRET_KEY'),
    bucket: process.env.MINIO_BUCKET || 'cura-media',
  },
};
