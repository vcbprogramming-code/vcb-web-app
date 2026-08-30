import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

/**
 * Single shared Postgres connection pool for the whole API.
 * Connects directly to the database via DATABASE_URL (no Supabase client).
 * Supabase requires SSL; we enable it for any non-local host.
 */
const isLocal =
  env.databaseUrl.includes('localhost') || env.databaseUrl.includes('127.0.0.1');

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 10,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});

/** Run a parameterized query. Returns the pg result. */
export function query(text, params) {
  return pool.query(text, params);
}

/** Convenience: run a query and return the first row (or null). */
export async function queryOne(text, params) {
  const { rows } = await pool.query(text, params);
  return rows[0] ?? null;
}
