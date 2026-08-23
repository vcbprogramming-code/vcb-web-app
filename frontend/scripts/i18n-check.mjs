/**
 * Every t('…') on screen must resolve to the translate function.
 *
 * Two ways it silently does not, both of which blank a page at run time while
 * the build stays green:
 *
 *   1. no `const t = useT()` in the component at all
 *   2. something nearer is called `t` — a loop variable, a timer handle — and
 *      wins the lookup
 *
 * Both happened while this layer was being built, which is why this is a file
 * and not a habit. Class components are called out too: a class cannot hold a
 * hook, so its translated text has to move into a function component.
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
const lineAt = (s, i) => s.slice(0, i).split('\n').length;

for (const file of files) {
  if (/lib\/i18n\.jsx$/.test(file)) continue;
  const raw = fs.readFileSync(file, 'utf8');
  // comments are prose; blank them so their text never counts as code
  const src = raw.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'\\])\/\/[^\n]*/g, (m, lead = '') => lead + ' '.repeat(m.length - lead.length));
  const calls = [...src.matchAll(/\bt\(\s*['`]/g)];
  if (!calls.length) continue;

  if (!/from '[^']*i18n\.jsx'/.test(src)) {
    problems.push(`${file}: เรียก t() แต่ไม่ได้ import useT`);
    continue;
  }
  if (!/const\s+t\s*=\s*useT\(\)/.test(src)) {
    problems.push(`${file}: เรียก t() แต่ไม่มี const t = useT() เลยทั้งไฟล์`);
  }

  // scopes where some other `t` wins the name
  const shadows = [];
  const bind = [
    /\(\s*(t)\s*(?:,[^)]*)?\)\s*=>\s*[({]/g,   // (t) => (   /   (t, i) => {
    /(?:^|[^\w.$])(t)\s*=>\s*[({]/g,           // t => {
    /const\s+(t)\s*=\s*(?!useT\(\))/g,         // const t = anything else
    /function\s+\w*\s*\([^)]*\b(t)\b[^)]*\)/g, // function f(t)
  ];
  for (const re of bind) {
    let m;
    while ((m = re.exec(src))) shadows.push([m.index, scopeEnd(src, m.index + m[0].length - 1)]);
  }
  for (const c of calls) {
    const hit = shadows.find(([a, b]) => c.index > a && c.index < b);
    if (hit) problems.push(`${file}:${lineAt(src, c.index)} มีตัวแปรชื่อ t บังฟังก์ชันแปลอยู่`);
  }

  // a class cannot call a hook
  for (const m of src.matchAll(/class\s+(\w+)\s+extends\s+React\.Component\s*\{/g)) {
    const body = src.slice(m.index, scopeEnd(src, src.indexOf('{', m.index)));
    if (/\bt\(\s*['`]/.test(body)) problems.push(`${file}: class ${m[1]} เรียก t() แต่ class ใช้ hook ไม่ได้`);
  }
}

/** End of the block or parenthesised body that starts at or after `from`. */
function scopeEnd(s, from) {
  const open = s.indexOf('{', from) === from ? from : s.slice(from, from + 4).search(/[({]/) + from;
  const ch = s[open];
  if (ch !== '{' && ch !== '(') return from;
  const close = ch === '{' ? '}' : ')';
  let d = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === ch) d++;
    else if (s[i] === close) { d--; if (!d) return i; }
  }
  return s.length;
}

if (problems.length) {
  for (const p of [...new Set(problems)]) console.log('  ✗ ' + p);
  console.log(`\n${new Set(problems).size} จุดต้องแก้`);
  process.exit(1);
}
console.log(`✓ ทุก t() มีฟังก์ชันแปลจริงในขอบเขต (${files.length} ไฟล์)`);
