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

  // MongoDB Atlas connection string.
  mongoUri: required('MONGODB_URI'),

  // Secret used to sign/verify our own JWT access tokens.
  jwtSecret: required('JWT_SECRET'),
  // Access-token lifetime (seconds). Default 7 days.
  jwtExpiresIn: Number(process.env.JWT_EXPIRES_IN) || 60 * 60 * 24 * 7,

  // Max attachment upload size (bytes). Default 25 MB. Files stored in GridFS.
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES) || 25 * 1024 * 1024,

  // Public URL of the frontend, used to build approval links in emails.
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:5173',
};

export const isProd = env.nodeEnv === 'production';
