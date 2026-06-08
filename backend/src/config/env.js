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
};

export const isProd = env.nodeEnv === 'production';
