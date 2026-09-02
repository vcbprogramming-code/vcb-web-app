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

// Fail at boot rather than at the first query. With DATABASE_URL unset, pg
// falls back to libpq defaults and quietly tries localhost:5432 as the current
// OS user - so every request times out or reports "role does not exist", and
// none of it says the connection string is missing.
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Use the Supabase POOLER string on port 6543, not the " +
      "direct connection: Render is IPv4-only and the direct host resolves to IPv6 " +
      "only, which fails with ENETUNREACH. See .env.example."
  );
}

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
 *   await tx(async (c) => { … });                 // no actor context
 *   await tx(req.user, async (c) => { … });       // actor context set
 *
 * Rolls back on any throw, and always returns the client to the pool.
 *
 * **Pass the user whenever the statements touch HR.** HR's triggers
 * (`enforce_entry_window`, `audit_work_entry`) read `app.actor_email` and
 * `app.actor_role` to decide who is editing and whether they may edit outside
 * the normal window. Both fail closed — unset means role 'none' and an empty
 * email — so omitting the user does not error, it silently locks admins out
 * past the edit window and writes audit rows with no actor. That is the failure
 * this parameter exists to prevent, and it is invisible until someone goes
 * looking at the audit log months later.
 *
 * The settings are `set local`, so they live and die with the transaction and
 * cannot leak to the next caller that borrows this pooled connection.
 */
export async function tx(userOrFn, maybeFn) {
  const fn = typeof userOrFn === 'function' ? userOrFn : maybeFn;
  const user = typeof userOrFn === 'function' ? null : userOrFn;

  const client = await pool.connect();
  try {
    await client.query('begin');

    if (user) {
      // Parameterised: `set local` will not take $1, so this goes through
      // set_config(), which does — never interpolate an email into SQL text.
      await client.query('select set_config($1, $2, true)', [
        'app.actor_email',
        String(user.email || ''),
      ]);
      await client.query('select set_config($1, $2, true)', [
        'app.actor_role',
        String(user.roles?.hr || 'none'),
      ]);
    }

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
