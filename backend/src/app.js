import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProd } from './config/env.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '5mb' }));
  app.use(morgan(isProd ? 'combined' : 'dev'));

  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
