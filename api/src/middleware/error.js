// Error handling and 404s.

import { ZodError } from 'zod';

/** Wrap an async handler so a rejected promise reaches the error handler. */
export function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function notFound(_req, res) {
  res.status(404).json({ error: 'NOT_FOUND' });
}

// eslint-disable-next-line no-unused-vars -- Express needs all four params.
export function errorHandler(err, req, res, _next) {
  // Bad input from the client — report which fields, that is genuinely useful.
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'VALIDATION_FAILED',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }

  // Postgres errors carry a code. Translate the ones a caller can act on;
  // everything else is ours to fix, not theirs to see.
  if (err?.code === '23505') return res.status(409).json({ error: 'ALREADY_EXISTS' });
  if (err?.code === '23503') return res.status(409).json({ error: 'REFERENCED_ROW_MISSING' });
  if (err?.code === '23514') return res.status(400).json({ error: 'CHECK_CONSTRAINT_FAILED' });

  if (err?.status && err.status < 500) {
    return res.status(err.status).json({ error: err.code || 'REQUEST_FAILED', message: err.message });
  }

  // Anything else is a bug. Log it in full server-side; tell the client nothing
  // beyond that it failed — messages and stacks leak schema and file paths.
  console.error('[api] unhandled error on', req.method, req.originalUrl, '\n', err);
  res.status(500).json({ error: 'INTERNAL' });
}
