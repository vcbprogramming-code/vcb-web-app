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
    const k = m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    if (!keys.has(k)) keys.set(k, f);
  }
}
const missing = [...keys].filter(([k]) => !(k in EN));
if (process.argv.includes('--list')) for (const [k, f] of missing) console.log(`${k}\t${f}`);
console.log(`\nคีย์ที่หน้าจอใช้ ${keys.size} · แปลแล้ว ${keys.size - missing.length} · ยังขาด ${missing.length}`);
