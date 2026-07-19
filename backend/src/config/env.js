import dotenv from 'dotenv';

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',

  // Direct Postgres connection string (Supabase or any Postgres).
  databaseUrl: required('DATABASE_URL'),

  // Secret used to sign/verify our own JWT access tokens.
  jwtSecret: required('JWT_SECRET'),
  // Access-token lifetime (seconds). Default 7 days.
  jwtExpiresIn: Number(process.env.JWT_EXPIRES_IN) || 60 * 60 * 24 * 7,

  // Max attachment upload size (bytes). Default 200 MB.
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES) || 200 * 1024 * 1024,

  // S3-compatible object storage (Supabase Storage via the S3 protocol).
  s3: {
    endpoint: required('S3_ENDPOINT'),
    region: process.env.S3_REGION || 'ap-southeast-1',
    accessKeyId: required('S3_ACCESS_KEY_ID'),
    secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
    bucket: process.env.S3_BUCKET || 'documents',
  },

  // Public URL of the frontend, used to build approval links in emails.
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:5173',

  // Modules turned off for the current soft launch — their APIs return 404 until
  // enabled (defence in depth; the frontend also hides them in config/nav.js).
  // Comma-separated; set DISABLED_MODULES='' to enable everything.
  disabledModules: (process.env.DISABLED_MODULES ?? 'performance,credit,onboarding')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),

  // Google OAuth client id for "Sign in with Google" (public value — no secret
  // needed; the backend only verifies Google ID tokens against it). When unset,
  // the Google login route returns 501 and only email login works.
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
};

export const isProd = env.nodeEnv === 'production';
