/**
 * Wraps the Thai the screens already render in t(), and makes sure the file can
 * actually call it.
 *
 * Only text that is *rendered* is touched. Thai is also a value in this system —
 * a document status, an approval decision sent to the API — and translating one
 * of those would send English where the server expects Thai. So the rewrite is
 * limited to JSX text nodes and a short allow-list of display attributes, and
 * anything else is reported for a person to decide.
 *
 *   node scripts/i18n-wrap.mjs <file|dir> [--write]
 */
import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';

const TH = /[฀-๿]/;
const DISPLAY_ATTRS = ['placeholder', 'title', 'alt', 'aria-label', 'label', 'confirmLabel', 'cancelLabel', 'emptyText'];

// The A4 letter canvas is a picture of a PDF that is always Thai, so wrapping it
// would make the preview disagree with the file the user downloads.
const NEVER = [/ememo\/LetterheadPreview\.jsx$/];

const target = process.argv[2];
const write = process.argv.includes('--write');
if (!target) { console.error('ต้องระบุไฟล์หรือโฟลเดอร์'); process.exit(1); }

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
let totalWrapped = 0; const notes = [];

for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  // Comments are prose, not screen text, and this codebase comments in both
  // languages — hide them so a Thai sentence in a /* */ block is never wrapped.
  const hidden = [];
  let src = before.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'\\])\/\/[^\n]*/g, (m, lead = '') => {
    const body = m.slice(lead.length);
    if (!TH.test(body)) return m;
    hidden.push(body);
    return `${lead}/*__C${hidden.length - 1}__*/`;
  });
  // Template literals are code too — `${a} · ไฟล์แนบ ${b}` needs a person to
  // decide where the placeholders go, and its backticks confuse a text scan.
  src = maskTemplates(src, hidden);
  let wrapped = 0;

  // 1. JSX text between tags. The run may sit alongside {expressions} — those are
  //    stepped over untouched, and only the literal text around them is wrapped,
  //    so "รออนุมัติ {n} รายการ" keeps its variable and translates both words.
  src = src.replace(/(.)>([^<>]*[฀-๿][^<>]*)</g, (m0, prev, text) => {
    const m = m0.slice(1);
    // '=>' , '>=' , '<' , '->' : the '>' belongs to an operator, not to a tag
    if ('=<!-+'.includes(prev)) return m0;
    const keep = (v) => prev + v;
    if (/\bt\(/.test(text)) return m0;
    // a run holding operators is a comparison that happened to contain '>',
    // not screen text — leave it for a person
    // a quote inside the run means it is the tail of a ternary — '…' : 'ข้อความ'
    if (/&&|\|\||=>|\$\{|`|\?\s|===|!==|;|\breturn\b|=|'|"/.test(text)) return m0;
    let out = '';
    let i = 0;
    let any = false;
    while (i < text.length) {
      const brace = text.indexOf('{', i);
      if (brace === -1) { out += wrapRun(text.slice(i)); break; }
      out += wrapRun(text.slice(i, brace));
      const close = matchBrace(text, brace);
      if (close === -1) { out += text.slice(brace); break; }
      out += text.slice(brace, close + 1);
      i = close + 1;
    }
    return any ? keep(`>${out}<`) : m0;

    function wrapRun(run) {
      if (!TH.test(run)) return run;
      const lead = run.match(/^\s*/)[0];
      const trail = run.match(/\s*$/)[0];
      // JSX folds a wrapped sentence into one line, so the key is the folded
      // form — otherwise the dictionary would hold newlines and never match
      const core = run.slice(lead.length, run.length - trail.length).replace(/\s+/g, ' ');
      if (!core) return run;
      any = true; wrapped++;
      return `${lead}{t('${esc(core)}')}${trail}`;
    }
  });

  // 2. display attributes only — never a value the server reads back
  for (const attr of DISPLAY_ATTRS) {
    const re = new RegExp(`(\\s${attr}=)"([^"\\n]*[\\u0E00-\\u0E7F][^"\\n]*)"`, 'g');
    src = src.replace(re, (m, k, v) => { wrapped++; return `${k}{t('${esc(v)}')}`; });
  }

  // 3. a bare string expression already inside braces: {'ข้อความ'}
  src = src.replace(/\{'([^'\n]*[฀-๿][^'\n]*)'\}/g, (m, v) => {
    if (m.includes('t(')) return m;
    wrapped++; return `{t('${esc(v)}')}`;
  });

  if (!wrapped) { continue; }

  // give every component in the file its own t(), and import it once
  const needsHook = [];
  const compRe = /(?:export\s+default\s+)?function\s+([A-Z]\w*)\s*\([^)]*\)\s*\{|const\s+([A-Z]\w*)\s*=\s*(?:\([^)]*\)|\w+)\s*=>\s*\{/g;
  let m;
  while ((m = compRe.exec(src))) needsHook.push({ name: m[1] || m[2], at: m.index + m[0].length });
  // insert from the back so earlier offsets stay valid
  for (const c of needsHook.reverse()) {
    const body = src.slice(c.at, findEnd(src, c.at));
    if (!/\bt\(/.test(body)) continue;
    // only a real useT() counts — a timer handle called `t` once made this skip
    // the hook and the page died with "t is not defined"
    if (/const\s+t\s*=\s*useT\(\)|\bt\b[^}]*\}\s*=\s*useLang\(/.test(body)) continue;
    const indent = (src.slice(c.at).match(/^\n(\s*)/) || [, '  '])[1];
    src = `${src.slice(0, c.at)}\n${indent}const t = useT();${src.slice(c.at)}`;
  }

  // a plain helper cannot hold a hook — flag it instead of silently breaking it
  const helperRe = /function\s+([a-z]\w*)\s*\([^)]*\)\s*\{/g;
  while ((m = helperRe.exec(src))) {
    const body = src.slice(m.index, findEnd(src, m.index + m[0].length));
    if (/\bt\(/.test(body) && !/\bt\b\s*[,)]/.test(m[0])) notes.push(`${file}: ฟังก์ชัน ${m[1]}() ใช้ t() แต่เรียก hook ไม่ได้ — ต้องแก้เอง`);
  }

  if (!/from '.*lib\/i18n\.jsx'/.test(src)) {
    const depth = path.relative(path.dirname(file), path.join('src', 'lib')).replace(/\\/g, '/');
    const imp = `import { useT } from '${depth.startsWith('.') ? depth : `./${depth}`}/i18n.jsx';\n`;
    const lastImport = src.lastIndexOf('\nimport ');
    const end = src.indexOf('\n', lastImport + 1);
    src = src.slice(0, end + 1) + imp + src.slice(end + 1);
  }

  src = src.replace(/\/\*__C(\d+)__\*\//g, (m, i) => hidden[Number(i)]);
  try {
    esbuild.transformSync(src, { loader: 'jsx', jsx: 'automatic' });
  } catch (e) {
    notes.push(`${file}: แปลงแล้วไวยากรณ์เสีย จึงไม่เขียนทับ — ${String(e.errors?.[0]?.text || e.message).slice(0, 80)}`);
    if (process.env.I18N_DEBUG) {
      const ln = e.errors?.[0]?.location?.line;
      console.log(`--- ${file}:${ln} ---`);
      console.log(src.split('\n').slice(Math.max(0, ln - 3), ln + 1).join('\n'));
    }
    continue;
  }
  totalWrapped += wrapped;
  console.log(`${String(wrapped).padStart(4)}  ${file}`);
  if (write) fs.writeFileSync(file, src);
}

/** Hide every template literal behind a comment placeholder. */
function maskTemplates(s, hidden) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '`') { out += s[i]; continue; }
    let j = i + 1; let depth = 0;
    for (; j < s.length; j++) {
      if (s[j] === '\\') { j++; continue; }
      if (s[j] === '$' && s[j + 1] === '{') { depth++; j++; continue; }
      if (s[j] === '}' && depth) { depth--; continue; }
      if (s[j] === '`' && !depth) break;
    }
    const lit = s.slice(i, j + 1);
    hidden.push(lit);
    out += `/*__C${hidden.length - 1}__*/`;
    i = j;
  }
  return out;
}

function matchBrace(s, open) {
  let d = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '{') d++;
    else if (s[i] === '}') { d--; if (!d) return i; }
  }
  return -1;
}

function findEnd(s, open) {
  let d = 1;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '{') d++;
    else if (s[i] === '}') { d--; if (!d) return i; }
  }
  return s.length;
}

console.log(`\nรวม ${totalWrapped} ข้อความ · ${files.length} ไฟล์ ${write ? '(เขียนแล้ว)' : '(ยังไม่เขียน — ใส่ --write)'}`);
for (const n of new Set(notes)) console.log('  ⚠ ' + n);
