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

// Module 2 sites (units) + work types, Module 4 onboarding templates.
// Module 1 reference data (projects / doc codes / doc types) is seeded by the
// SQL migrations 0004/0005/0008.
const UNITS = [
  ['โครงการพุทธมณฑล', 'PTM', 'วิจิตรภัณฑ์ก่อสร้าง จำกัด', '#2563eb'],
  ['โครงการบางวัว', 'BWA', 'วิจิตรภัณฑ์ก่อสร้าง จำกัด', '#ea580c'],
  ['โรงงานสุพรรณบุรี', 'SPB', 'ชวนา เอ็นจิเนียริ่ง จำกัด', '#7c3aed'],
  ['โครงการบางเตย-บ้านพร้าว', 'BTBP', 'วิจิตรภัณฑ์ก่อสร้าง จำกัด', '#16a34a'],
  ['โครงการบ้านแพ้ว', 'BPW', 'วิจิตรภัณฑ์ก่อสร้าง จำกัด', '#0891b2'],
  ['ศูนย์ซ่อมฯ สาย 5', 'S5', 'วิจิตรภัณฑ์ก่อสร้าง จำกัด', '#d97706'],
];
const WORK_TYPES = [
  ['งานโครงสร้าง', 'ก่อสร้าง', 1], ['งานคอนกรีต', 'ก่อสร้าง', 2], ['งานเหล็ก', 'ก่อสร้าง', 3],
  ['งานระบบไฟฟ้า', 'งานระบบ', 4], ['งานระบบประปา', 'งานระบบ', 5],
  ['ควบคุมเครื่องจักร', 'เครื่องจักร', 6], ['ซ่อมบำรุงเครื่องจักร', 'เครื่องจักร', 7],
  ['ขนส่ง/ขับรถ', 'สนับสนุน', 8], ['งานทั่วไป', 'ทั่วไป', 9],
];
const TEMPLATES = [
  [30, 'ปฐมนิเทศและรับรู้นโยบายบริษัท', 'HR', 1],
  [30, 'รับอุปกรณ์และเข้าถึงระบบที่จำเป็น', 'IT/HR', 2],
  [30, 'ลงนามเอกสารจ้างงานและสวัสดิการ', 'HR', 3],
  [30, 'เรียนรู้ขั้นตอนการทำงานในตำแหน่ง', 'หัวหน้างาน', 4],
  [60, 'ประเมินความเข้าใจงานเบื้องต้น', 'หัวหน้างาน', 1],
  [60, 'มอบหมายงานจริงและติดตามผล', 'หัวหน้างาน', 2],
  [60, 'พบ HR เพื่อรับฟังปัญหา/ปรับตัว', 'HR', 3],
  [90, 'ประเมินผลทดลองงานครบ 90 วัน', 'หัวหน้างาน/HR', 1],
  [90, 'สรุปผลและวางแผนพัฒนาต่อเนื่อง', 'HR', 2],
];

async function seed() {
  const client = makeClient();
  await client.connect();
  try {
    for (const [name, code, company, color] of UNITS) {
      await client.query(
        `insert into units (name, code, company, color) values ($1,$2,$3,$4)
         on conflict (code) do nothing`,
        [name, code, company, color]
      );
    }
    console.log(`🏗️  Units/sites: ${UNITS.length} ensured`);
    for (const [name, category, sort] of WORK_TYPES) {
      await client.query(
        `insert into work_types (name, category, sort_order)
         select $1,$2,$3 where not exists (select 1 from work_types where name=$1)`,
        [name, category, sort]
      );
    }
    console.log(`🧰 Work types: ${WORK_TYPES.length} ensured`);
    for (const [phase, title, owner, sort] of TEMPLATES) {
      await client.query(
        `insert into onboarding_plan_templates (phase, title, owner, sort_order)
         select $1,$2,$3,$4 where not exists
           (select 1 from onboarding_plan_templates where phase=$1 and title=$2)`,
        [phase, title, owner, sort]
      );
    }
    console.log(`🎓 Onboarding templates: ${TEMPLATES.length} ensured`);
    console.log('\n✅ Seed complete.');
  } finally {
    await client.end();
  }
}

const [cmd, ...rest] = process.argv.slice(2);
const commands = { migrate, seed, 'create-admin': () => createAdmin(...rest), 'list-users': listUsers };

if (!commands[cmd]) {
  console.log('Commands: migrate | create-admin <email> <password> ["name"] | list-users');
  process.exit(1);
}

commands[cmd]().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
