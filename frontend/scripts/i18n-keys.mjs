/** Every key the screens ask for, and which of them the dictionary still lacks. */
import fs from 'node:fs';
import path from 'node:path';
import { EN } from '../src/lib/en.js';

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (/\.jsx?$/.test(e.name)) files.push(p);
  }
})('src');

const keys = new Map();
for (const f of files) {
  if (/lib\/(en|i18n)\./.test(f)) continue;
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) {
    // read the literal the way JS will: \n is a newline, not two characters
    const k = m[1].replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    if (!keys.has(k)) keys.set(k, f);
  }
}
// A key defined twice loses its first meaning silently — that is how the Cancel
// button briefly read "Cancelled". Context-qualified keys (ctx::text) are exempt.
const dict = fs.readFileSync('src/lib/en.js', 'utf8');
const seenKeys = new Set(); const dupes = [];
for (const m of dict.matchAll(/^\s*'((?:[^'\\]|\\.)*)':/gm)) {
  if (seenKeys.has(m[1])) dupes.push(m[1]);
  seenKeys.add(m[1]);
}
if (dupes.length) {
  for (const d of [...new Set(dupes)]) console.log(`  ✗ พจนานุกรมมีคีย์ซ้ำ: ${d}`);
  console.log(`\n${new Set(dupes).size} คีย์ซ้ำ — ตัวหลังจะทับตัวแรกโดยไม่มีคำเตือน`);
  process.exit(1);
}

const missing = [...keys].filter(([k]) => !(k in EN));
if (process.argv.includes('--list')) for (const [k, f] of missing) console.log(`${k}\t${f}`);
console.log(`\nคีย์ที่หน้าจอใช้ ${keys.size} · แปลแล้ว ${keys.size - missing.length} · ยังขาด ${missing.length}`);
