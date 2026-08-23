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

// The A4 letter canvas is a picture of a PDF that is always Thai, so wrapping it
// would make the preview disagree with the file the user downloads.
const NEVER = [/ememo\/LetterheadPreview\.jsx$/];

const target = process.argv[2];
const write = process.argv.includes('--write');
const files = [];
(function walk(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) { for (const e of fs.readdirSync(p)) walk(path.join(p, e)); return; }
  if (/\.jsx$/.test(p) && !NEVER.some((r) => r.test(p))) files.push(p);
})(target);

// Only the quote needs escaping. Escaping the backslash as well would turn an
// existing \\n into the two characters "\\" and "n", and a confirm dialog would
// print them instead of breaking the line.
const esc = (s) => s.replace(/'/g, "\\'");
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

  // same as the first pass: a component that now calls t() needs the hook, and
  // the file needs the import — without them the page dies at run time
  const comps = [];
  const compRe = /(?:export\s+default\s+)?function\s+([A-Z]\w*)\s*\([^)]*\)\s*\{|const\s+([A-Z]\w*)\s*=\s*(?:\([^)]*\)|\w+)\s*=>\s*\{/g;
  let cm;
  while ((cm = compRe.exec(src))) comps.push(cm.index + cm[0].length);
  for (const at of comps.reverse()) {
    const body = src.slice(at, blockEnd(src, at));
    if (!/\bt\(/.test(body)) continue;
    if (/const\s+t\s*=\s*useT\(\)/.test(body)) continue;
    const indent = (src.slice(at).match(/^\n(\s*)/) || [, '  '])[1];
    src = `${src.slice(0, at)}\n${indent}const t = useT();${src.slice(at)}`;
  }
  if (!/from '.*lib\/i18n\.jsx'/.test(src)) {
    const rel = path.relative(path.dirname(file), path.join('src', 'lib')).replace(/\\/g, '/');
    const imp = `import { useT } from '${rel.startsWith('.') ? rel : `./${rel}`}/i18n.jsx';\n`;
    const last = src.lastIndexOf('\nimport ');
    const eol = src.indexOf('\n', last + 1);
    src = src.slice(0, eol + 1) + imp + src.slice(eol + 1);
  }

  src = src.replace(/\/\*__C(\d+)__\*\//g, (m, i) => hidden[Number(i)]);
  try { esbuild.transformSync(src, { loader: 'jsx', jsx: 'automatic' }); }
  catch (e) { notes.push(`${file}: ไวยากรณ์เสีย ไม่เขียนทับ`); continue; }
  total += n;
  console.log(`${String(n).padStart(4)}  ${file}`);
  if (write) fs.writeFileSync(file, src);
}

function blockEnd(s, open) {
  let d = 1;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '{') d++; else if (s[i] === '}') { d--; if (!d) return i; }
  }
  return s.length;
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
