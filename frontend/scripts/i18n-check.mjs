/**
 * Every t() on screen must have a t() in scope.
 *
 * A missing hook is invisible at build time and blanks the whole page at run
 * time — it happened twice while this layer was being built, which is why the
 * check is a file rather than a habit.
 *
 *   node scripts/i18n-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (/\.jsx?$/.test(e.name)) files.push(p);
  }
})('src');

const problems = [];
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'\\])\/\/[^\n]*/g, (m, lead = '') => lead);
  if (!/\bt\(/.test(code)) continue;
  if (!/from '[^']*i18n\.jsx'/.test(code)) { problems.push(`${file}: เรียก t() แต่ไม่ได้ import useT`); continue; }

  // each function that calls t() must either declare it or receive it
  const re = /(?:export\s+default\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*\{|const\s+(\w+)\s*=\s*(?:\(([^)]*)\)|(\w+))\s*=>\s*\{/g;
  let m;
  while ((m = re.exec(code))) {
    const name = m[1] || m[3];
    const args = m[2] || m[4] || m[5] || '';
    const open = m.index + m[0].length;
    const body = code.slice(open, end(code, open));
    if (!/\bt\(/.test(body)) continue;
    const declares = /const\s+\{[^}]*\bt\b[^}]*\}\s*=\s*use\w+\(|const\s+t\s*=/.test(body);
    const receives = /\bt\b/.test(args);
    // a t() inside a nested component is that component's problem, not this one
    if (!declares && !receives && !/function\s+[A-Z]|=>\s*\{/.test(body.slice(0, 0))) {
      const outer = /^[A-Z]/.test(name || '');
      if (outer) problems.push(`${file}: ${name}() ใช้ t() แต่ไม่มี const t = useT()`);
    }
  }
}

function end(s, open) {
  let d = 1;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '{') d++; else if (s[i] === '}') { d--; if (!d) return i; }
  }
  return s.length;
}

if (problems.length) { for (const p of problems) console.log('  ✗ ' + p); console.log(`\n${problems.length} จุดต้องแก้`); process.exit(1); }
console.log(`✓ ทุกไฟล์ที่ใช้ t() มี useT() ครบ (${files.length} ไฟล์)`);
