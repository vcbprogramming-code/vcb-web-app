/**
 * Every t('…') on screen must resolve to the translate function.
 *
 * Three ways it silently does not, all of which blank a page at run time while
 * the build stays green:
 *
 *   1. the component never calls useT()
 *   2. something nearer is called `t` — a loop variable, a timer handle
 *   3. it is a class component, which cannot hold a hook at all
 *
 * All three happened while this layer was being built, which is why this is a
 * file and not a habit.
 *
 * Components here are declared at the left margin, one per region, so the file
 * is split on those declarations rather than by counting braces — brace counting
 * kept tripping over an apostrophe in JSX text. Shadowing is left to esbuild,
 * which renames the inner binding: a t2("…") in its output is precisely the
 * "t is not a function" the browser reports.
 *
 *   node scripts/i18n-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (/\.jsx?$/.test(e.name)) files.push(p);
  }
})('src');

// t('…') and t(meta.label) both count — the second is how a data-driven label
// gets translated, and missing it is what let a blank StatusBadge through.
const CALL = /\bt\(\s*['`\w]/;
const problems = [];

for (const file of files) {
  if (/lib\/i18n\.jsx$/.test(file)) continue;
  const raw = fs.readFileSync(file, 'utf8');
  if (!CALL.test(raw)) continue;

  if (!/from '[^']*i18n\.jsx'/.test(raw)) { problems.push(`${file}: เรียก t() แต่ไม่ได้ import useT`); continue; }

  // 1. a component that calls t() must hold the hook itself
  const lines = raw.split('\n');
  const starts = [];
  lines.forEach((l, i) => {
    const m = l.match(/^(?:export\s+default\s+)?(?:function\s+(\w+)|(?:const|let)\s+(\w+)\s*=)/);
    if (m) starts.push({ line: i, name: m[1] || m[2] });
  });
  starts.forEach((s, i) => {
    const region = lines.slice(s.line, starts[i + 1]?.line ?? lines.length).join('\n');
    if (!CALL.test(region)) return;
    if (/const\s+t\s*=\s*useT\(\)/.test(region)) return;
    problems.push(`${file}:${s.line + 1} ${s.name}() เรียก t() แต่ไม่มี const t = useT()`);
  });

  // 2. in a file that translates, nothing else may be called `t`. Deciding case
  //    by case whether a particular shadow is reachable was guesswork that both
  //    missed real breakage and cried wolf; the flat rule removes the whole
  //    class, and renaming a loop variable costs nothing.
  const shadows = [
    /\(\s*t\s*(?:,[^)]*)?\)\s*=>/g,          // (t) => …   /   (t, i) => …
    /(?:^|[^\w.$'"])t\s*=>/gm,                   // t => …
    /const\s+t\s*=(?!\s*useT\s*\()/g,           // const t = something else
    /function\s+\w*\s*\([^)]*\bt\b[^)]*\)/g, // function f(t)
  ];
  for (const re of shadows) {
    const m = re.exec(raw);
    if (m) problems.push(`${file}:${raw.slice(0, m.index).split('\n').length} มีตัวแปรชื่อ t อยู่ในไฟล์ที่ใช้ฟังก์ชันแปล — ตั้งชื่ออื่น`);
  }
  try { esbuild.transformSync(raw, { loader: 'jsx', jsx: 'automatic' }); }
  catch { problems.push(`${file}: ไวยากรณ์เสีย`); }

  // 3. a class cannot hold a hook
  for (const m of raw.matchAll(/class\s+(\w+)\s+extends\s+React\.Component/g)) {
    if (CALL.test(raw.slice(m.index))) problems.push(`${file}: class ${m[1]} เรียก t() แต่ class ใช้ hook ไม่ได้`);
  }
}

if (problems.length) {
  for (const p of [...new Set(problems)]) console.log('  ✗ ' + p);
  console.log(`\n${new Set(problems).size} จุดต้องแก้`);
  process.exit(1);
}
console.log(`✓ ทุก t() มีฟังก์ชันแปลจริงในขอบเขต (${files.length} ไฟล์)`);
