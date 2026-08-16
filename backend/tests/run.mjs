/**
 * Runs every suite in this folder and prints one summary.
 *
 *   npm run test:ememo              → against PRODUCTION (the default)
 *   API=http://localhost:4000/api APP=http://localhost:5173 npm run test:ememo
 *
 * Suites ending .ui.mjs drive a real Chrome window; pass --api to skip them when
 * there is no display (CI, ssh) or you only want the fast checks.
 *
 * Every suite creates its own data marked ZZTEST and deletes it again, so a run
 * leaves production exactly as it found it. That is not a nicety: these run
 * against the client's live database.
 */
import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const apiOnly = process.argv.includes('--api');

const suites = readdirSync(here)
  .filter((f) => f.endsWith('.mjs') && !['run.mjs', 'harness.mjs'].includes(f))
  .filter((f) => !apiOnly || !f.endsWith('.ui.mjs'))
  .sort();

const run = (file) => new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, file)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  p.stdout.on('data', (d) => { out += d; process.stdout.write(d); });
  p.stderr.on('data', (d) => { out += d; process.stderr.write(d); });
  p.on('close', (code) => {
    const m = /(\d+) passed, (\d+) failed/.exec(out);
    resolve({ file, code, passed: m ? Number(m[1]) : 0, failed: m ? Number(m[2]) : null });
  });
});

console.log(`\n▶ ${suites.length} ชุด · API = ${process.env.API || 'production'}\n`);
const results = [];
for (const f of suites) {
  console.log(`\n╔══ ${f} ${'═'.repeat(Math.max(0, 50 - f.length))}`);
  results.push(await run(f));
}

console.log(`\n${'═'.repeat(62)}`);
let pass = 0;
let bad = 0;
for (const r of results) {
  const ok = r.code === 0 && r.failed === 0;
  pass += r.passed;
  if (!ok) bad += 1;
  // failed === null means the suite crashed before printing its own summary
  console.log(`  ${ok ? '✅' : '❌'} ${r.file.padEnd(28)} ${String(r.passed).padStart(3)} ผ่าน${r.failed ? ` · ${r.failed} ไม่ผ่าน` : ''}${r.failed === null ? ' · ชุดนี้ล้มก่อนสรุปผล' : ''}`);
}
console.log(`${'═'.repeat(62)}\n  รวม ${pass} ข้อผ่าน · ${bad ? `${bad} ชุดมีปัญหา` : 'ครบทุกชุด'}\n`);
process.exit(bad ? 1 : 0);
