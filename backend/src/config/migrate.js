import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

// src/config -> backend/src/config; the SQL files live at repo-root/supabase/migrations
const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(__dirname, '../../../supabase/migrations');

/**
 * Apply any pending SQL migrations on server boot. This is the SAME logic as the
 * `npm run migrate` CLI (scripts/db.mjs) — applied files are tracked in
 * schema_migrations so it's safe to run on every start (already-applied files are
 * skipped). We do it at boot because Render's build-time migrate proved unreliable,
 * which let new code deploy against an old schema (e.g. a query hitting a column
 * that a not-yet-run migration was supposed to add). Best-effort: the caller logs
 * and keeps starting the server if this throws, so a deploy never hangs on it.
 */
export async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn('⚠️  DATABASE_URL not set — skipping auto-migrate');
    return;
  }
  // read the migration files first; if the folder isn't shipped in this runtime
  // (some deploy layouts don't include sibling dirs), skip quietly rather than crash.
  let files;
  try {
    files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  } catch {
    console.warn(`⚠️  migrations dir not found (${migrationsDir}) — skipping auto-migrate`);
    return;
  }

  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  const client = new pg.Client({ connectionString, ssl: isLocal ? false : { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(
      `create table if not exists schema_migrations (
         filename   text primary key,
         applied_at timestamptz not null default now()
       )`
    );
    const { rows } = await client.query('select filename from schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));

    let ran = 0;
    for (const f of files) {
      if (applied.has(f)) continue;
      const sql = await readFile(join(migrationsDir, f), 'utf8');
      console.log(`▶ auto-migrate: applying ${f}`);
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations (filename) values ($1)', [f]);
        await client.query('commit');
        ran++;
      } catch (err) {
        await client.query('rollback');
        throw err;
      }
    }
    if (ran) console.log(`✅ auto-migrate: ${ran} migration(s) applied on boot`);
  } finally {
    await client.end();
  }
}
