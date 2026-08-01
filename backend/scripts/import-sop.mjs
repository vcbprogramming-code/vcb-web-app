// Import the client's SOP export (DATABASE_DATA.sql) into our sop_* tables.
//
// Their INSERTs are already valid Postgres; the only differences are the table
// names (ours are `sop_`-prefixed) and the `admins` allow-list, which we drop in
// favour of the app's own permission system. So instead of re-parsing 200KB of
// Thai content — and risking mangling it — we rewrite the statement headers and
// execute the file as-is inside one transaction.
//
//   node scripts/import-sop.mjs [path-to-DATABASE_DATA.sql]
//
// Idempotent: clears the sop_* tables first, so re-running re-imports cleanly.
import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../src/config/db.js';

const DEFAULT_SRC = path.resolve(process.cwd(), '../../DATABASE_DATA.sql');
const src = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SRC;

if (!fs.existsSync(src)) {
  console.error(`✗ ไม่พบไฟล์ข้อมูล: ${src}`);
  process.exit(1);
}

const TABLE_MAP = {
  modules: 'sop_modules',
  sop_meta: 'sop_meta',
  scenarios: 'sop_scenarios',
  scenario_steps: 'sop_scenario_steps',
  scenario_extra_modules: 'sop_scenario_modules',
  reports: 'sop_reports',
  process_flows: 'sop_flows',
};

/**
 * Their export escapes a double quote inside text[] elements CSV-style ("")
 * — Postgres array literals want \" and reject "" as malformed. Fix it only
 * inside array literals: those start with '{" while the JSONB columns
 * (lanes/nodes/edges) start with '[{ , so they're never touched. The `","`
 * element separator always has a comma between the quotes, so a bare "" is
 * unambiguously an escaped quote.
 */
function fixArrayLiterals(sql) {
  return sql.replace(/'\{"[\s\S]*?\}'/g, (lit) => lit.replace(/""/g, '\\"'));
}

const raw = fixArrayLiterals(fs.readFileSync(src, 'utf8'));

// Split into statements on ";\n" at top level — their file has one INSERT per
// table, each ending with ";\n". BEGIN/COMMIT are handled by us.
const statements = raw
  .split(/;\s*\n/)
  // each block is preceded by "-- ---- table ----" banners; strip leading comment
  // lines rather than dropping the block (that swallowed every INSERT).
  .map((s) => s.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n').trim())
  .filter((s) => s && !/^(BEGIN|COMMIT)$/i.test(s));

const client = await pool.connect();
let imported = 0;
try {
  await client.query('begin');
  // wipe in FK-safe order
  await client.query(`truncate sop_scenario_steps, sop_scenario_modules, sop_reports,
                      sop_flows, sop_scenarios, sop_meta, sop_modules restart identity cascade`);

  for (const stmt of statements) {
    const m = stmt.match(/^INSERT INTO (\w+)/i);
    if (!m) continue;
    const table = m[1];
    if (table === 'admins') {
      console.log('  • ข้าม admins (ใช้ระบบสิทธิ์ของเราแทน)');
      continue;
    }
    const target = TABLE_MAP[table];
    if (!target) { console.log(`  • ข้ามตารางที่ไม่รู้จัก: ${table}`); continue; }

    const rewritten = stmt.replace(/^INSERT INTO \w+/i, `INSERT INTO ${target}`);
    const res = await client.query(rewritten);
    console.log(`  ✓ ${target.padEnd(22)} ${res.rowCount} rows`);
    imported += res.rowCount;
  }

  // `sort_order` isn't in their export — seed it from the original `no` order so
  // cases keep the numbering the printed manual uses, then reorder is possible.
  await client.query(`
    update sop_scenarios s set sort_order = t.rn
      from (select no, row_number() over (partition by module order by no) as rn
              from sop_scenarios) t
     where t.no = s.no`);
  await client.query('update sop_reports set sort_order = id where sort_order = 0');

  await client.query('commit');
  console.log(`\n✅ นำเข้าข้อมูล SOP สำเร็จ (${imported} แถว)`);
} catch (e) {
  await client.query('rollback');
  console.error('\n✗ นำเข้าไม่สำเร็จ (rollback แล้ว):', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
