/**
 * Second pass: the Thai that is displayed but never sits in a JSX text node —
 * toast messages, confirm dialogs, and display-only object properties.
 *
 * The allow-list of property names matters. Thai is a value in this system too:
 * a document status, an approval decision, a facility type are all Thai strings
 * the server reads back. Wrapping one of those would send English to an API that
 * expects Thai, so only names that can only ever be shown are touched, and only
 * inside a function where a hook is in scope.
 *
 *   node scripts/i18n-wrap2.mjs <dir> [--write]
 */
import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';

const TH = /[฀-๿]/;
const DISPLAY_PROPS = ['label', 'title', 'message', 'confirmLabel', 'cancelLabel', 'subtitle', 'placeholder', 'desc', 'hint', 'emptyText'];
const TOASTS = ['toast\\.success', 'toast\\.error', 'toast\\.info', 'toast'];

const target = process.argv[2];
const write = process.argv.includes('--write');
const files = [];
(function walk(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) { for (const e of fs.readdirSync(p)) walk(path.join(p, e)); return; }
  if (/\.jsx$/.test(p)) files.push(p);
})(target);

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
let total = 0; const notes = [];

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const hidden = [];
  let src = original.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'\\])\/\/[^\n]*/g, (m, lead = '') => {
    const body = m.slice(lead.length);
    if (!TH.test(body)) return m;
    hidden.push(body);
    return `${lead}/*__C${hidden.length - 1}__*/`;
  });
  let n = 0;

  // module scope has no hook, so only rewrite inside a function body
  const scopes = functionRanges(src);
  const inScope = (i) => scopes.some(([a, b]) => i > a && i < b);

  const wrap = (re, build) => {
    src = src.replace(re, (...args) => {
      const m = args[0];
      const offset = args[args.length - 2];
      if (!inScope(offset)) return m;
      n++;
      return build(...args);
    });
  };

  for (const fn of TOASTS) {
    wrap(new RegExp(`(${fn}\\()'([^'\\n]*[\\u0E00-\\u0E7F][^'\\n]*)'`, 'g'), (m, head, v) => `${head}t('${esc(v)}')`);
  }
  for (const prop of DISPLAY_PROPS) {
    wrap(new RegExp(`(\\b${prop}:\\s*)'([^'\\n]*[\\u0E00-\\u0E7F][^'\\n]*)'`, 'g'), (m, head, v) => `${head}t('${esc(v)}')`);
  }

  if (!n) continue;
  src = src.replace(/\/\*__C(\d+)__\*\//g, (m, i) => hidden[Number(i)]);
  try { esbuild.transformSync(src, { loader: 'jsx', jsx: 'automatic' }); }
  catch (e) { notes.push(`${file}: ไวยากรณ์เสีย ไม่เขียนทับ`); continue; }
  total += n;
  console.log(`${String(n).padStart(4)}  ${file}`);
  if (write) fs.writeFileSync(file, src);
}

/** [start, end) of every function body in the file. */
function functionRanges(s) {
  const out = [];
  const re = /function\s+\w*\s*\([^)]*\)\s*\{|\([^)]*\)\s*=>\s*\{|\w+\s*=>\s*\{/g;
  let m;
  while ((m = re.exec(s))) {
    const open = m.index + m[0].length - 1;
    let d = 0;
    for (let i = open; i < s.length; i++) {
      if (s[i] === '{') d++;
      else if (s[i] === '}') { d--; if (!d) { out.push([open, i]); break; } }
    }
  }
  return out;
}

console.log(`\nรวม ${total} ข้อความ ${write ? '(เขียนแล้ว)' : '(ยังไม่เขียน)'}`);
for (const x of new Set(notes)) console.log('  ⚠ ' + x);
