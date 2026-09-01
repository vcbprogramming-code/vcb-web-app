// Postgres access. One pool for the whole API.
//
// No ORM by design — every statement below is SQL written by hand. Two rules
// that are not negotiable:
//
//   1. Always parameterise ($1, $2 …). Never build SQL by joining strings with
//      user input, not even for a column name that "obviously" comes from our
//      own code — that is how injection gets in.
//   2. Table names are schema-qualified (hr.employees, onboarding.employees).
//      Both modules have a table called `employees` and they are NOT the same
//      thing, so an unqualified name is always a bug waiting to happen.

import pg from 'pg';

const { Pool } = pg;

// Supabase requires TLS. `rejectUnauthorized:false` is what Supabase's own
// connection docs specify: their certificate chain is not in Node's default
// trust store, and without this every query fails with SELF_SIGNED_CERT_IN_CHAIN.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  // An idle client blew up (network blip, Supabase restart). Log it and let the
  // pool replace the client — never crash the API over this.
  console.error('[db] idle client error:', err.message);
});

/** Run a query. Returns the full pg result. */
export function query(text, params) {
  return pool.query(text, params);
}

/** Run a query, return the rows array. */
export async function rows(text, params) {
  const res = await pool.query(text, params);
  return res.rows;
}

/** Run a query expected to match at most one row. Returns the row or null. */
export async function one(text, params) {
  const res = await pool.query(text, params);
  return res.rows[0] ?? null;
}

/**
 * Run several statements as one transaction.
 *
 *   await tx(async (c) => {
 *     await c.query('insert into … values ($1)', [a]);
 *     await c.query('update … set … where id = $1', [b]);
 *   });
 *
 * Rolls back on any throw, and always returns the client to the pool.
 */
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    try {
      await client.query('rollback');
    } catch {
      // The connection is already gone; the rollback is moot.
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function close() {
  await pool.end();
}

export default { query, rows, one, tx, close };
