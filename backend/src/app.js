import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProd } from './config/env.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // CLIENT_ORIGIN may be a comma-separated list (dev + prod frontends).
  const allowedOrigins = env.clientOrigin.split(',').map((s) => s.trim()).filter(Boolean);
  const corsOrigin = (origin, cb) => {
    // allow same-origin / curl (no Origin header) and any whitelisted origin
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  };

  app.use(helmet());
  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json({ limit: '5mb' }));
  app.use(morgan(isProd ? 'combined' : 'dev'));

  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
