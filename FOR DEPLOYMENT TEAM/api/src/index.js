// VCB Connect API — one Express app for every module.
//
// React SPA (Vercel) ──► this (Render) ──► Supabase Postgres + Storage
//
// One API rather than one per module, so a person signs in once and the same
// JWT works across HR, Credit Facility, Minutes, SOP and Onboarding.

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

import { notFound, errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import hrRoutes from './routes/hr.js';
import creditRoutes from './routes/credit.js';
import minutesRoutes from './routes/minutes.js';
import sopRoutes from './routes/sop.js';
import onboardingRoutes from './routes/onboarding.js';
import portalRoutes from './routes/portal.js';
import { assertFontsPresent } from './lib/pdf.js';

const app = express();

// Render sits behind a proxy; without this req.ip is the proxy's address and
// secure-cookie detection is wrong.
app.set('trust proxy', 1);

app.use(helmet());

// The SPAs are on Vercel, on a different origin, so CORS is required rather
// than optional. Allowlist explicitly — never reflect an arbitrary Origin.
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      // No Origin header: curl, health checks, server-to-server. Allowed —
      // these carry no browser credentials, so CORS is not what protects them.
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`Origin not allowed: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/credit', creditRoutes);
app.use('/api/minutes', minutesRoutes);
app.use('/api/sop', sopRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/portal', portalRoutes);

app.use(notFound);
app.use(errorHandler);

// Fail at startup, not at the first download. PDFKit does not error on a
// missing glyph - it writes nothing - so without the Thai fonts every PDF
// comes out with correct margins and no Thai text, and nobody notices until a
// signed document reaches someone. A container that cannot produce a valid
// document should not report itself healthy.
//
// Set PDF_FONTS_OPTIONAL=1 only for a deployment that genuinely issues no PDFs.
try {
  assertFontsPresent();
} catch (err) {
  if (process.env.PDF_FONTS_OPTIONAL === '1') {
    console.warn('[api] ' + err.message);
    console.warn('[api] PDF_FONTS_OPTIONAL=1 - starting anyway; PDF routes will fail.');
  } else {
    console.error('[api] ' + err.message);
    process.exit(1);
  }
}

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`[api] listening on ${port}`);
});

export default app;
