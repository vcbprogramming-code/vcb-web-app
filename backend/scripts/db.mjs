#!/usr/bin/env node
// Database admin CLI for the HR system.
//
//   node scripts/db.mjs migrate              run all SQL files in supabase/migrations (in order)
//   node scripts/db.mjs create-admin <email> <password> ["Full Name"]
//   node scripts/db.mjs list-users
//
// Connects via DATABASE_URL from backend/.env. Safe to re-run migrations:
// the SQL files use IF NOT EXISTS / ON CONFLICT guards.

import pg from 'pg';
import bcrypt from 'bcryptjs';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const { Client } = pg;
const migrationsDir = resolve(__dirname, '../../supabase/migrations');

function makeClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL is not set in backend/.env');
    process.exit(1);
  }
  const isLocal =
    connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  return new Client({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
}

async function migrate() {
  const client = makeClient();
  await client.connect();
  try {
    // Track which migration files have already run so re-running is safe even
    // when a file isn't itself idempotent.
    await client.query(
      `create table if not exists schema_migrations (
         filename   text primary key,
         applied_at timestamptz not null default now()
       )`
    );
    const { rows } = await client.query('select filename from schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));

    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let ran = 0;
    for (const f of files) {
      if (applied.has(f)) {
        console.log(`• ${f} (already applied, skipped)`);
        continue;
      }
      const sql = await readFile(join(migrationsDir, f), 'utf8');
      console.log(`▶ ${f}`);
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query(
          'insert into schema_migrations (filename) values ($1)',
          [f]
        );
        await client.query('commit');
        console.log(`  ✅ done`);
        ran++;
      } catch (err) {
        await client.query('rollback');
        throw err;
      }
    }
    console.log(ran ? `\n${ran} migration(s) applied.` : '\nNothing to apply.');
  } finally {
    await client.end();
  }
}

async function createAdmin(email, password, fullName) {
  if (!email || !password) {
    console.error('Usage: create-admin <email> <password> ["Full Name"]');
    process.exit(1);
  }
  const client = makeClient();
  await client.connect();
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await client.query(
      `insert into profiles (full_name, email, password_hash, role, is_active)
       values ($1, $2, $3, 'admin', true)
       on conflict (lower(email)) do update
         set password_hash = excluded.password_hash,
             full_name     = excluded.full_name,
             role          = 'admin',
             is_active      = true
       returning id, email, role`,
      [fullName || 'ผู้ดูแลระบบ', email, hash]
    );
    console.log('✅ Admin ready:', rows[0]);
  } finally {
    await client.end();
  }
}

async function listUsers() {
  const client = makeClient();
  await client.connect();
  try {
    const { rows } = await client.query(
      `select email, full_name, role, is_active from profiles order by created_at`
    );
    console.table(rows);
  } finally {
    await client.end();
  }
}

const [cmd, ...rest] = process.argv.slice(2);
const commands = { migrate, 'create-admin': () => createAdmin(...rest), 'list-users': listUsers };

if (!commands[cmd]) {
  console.log('Commands: migrate | create-admin <email> <password> ["name"] | list-users');
  process.exit(1);
}

commands[cmd]().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
