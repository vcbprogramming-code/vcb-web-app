#!/usr/bin/env node
// Documentation drift checker.
//
// Every check here exists because the thing it checks for ACTUALLY WENT WRONG,
// and was found by a person reading rather than by any tool:
//
//   1. portal/STATUS.md claimed "App: HR Work Log", TypeScript, and a mock
//      backend — all three false. Nothing flagged it for months.
//   2. hr-worklog.md scored 100% on "is every file mentioned" while leaving
//      Excel export, the whole leave workflow and employee transfers
//      undocumented. A weak check that passes is worse than no check.
//   3. Specs referenced files that had been deleted.
//
// Run: node scripts/check-docs.mjs            (report only, exit 1 on failure)
//      node scripts/check-docs.mjs --json     (machine-readable, for the agent)
//
// This script only REPORTS. It never edits. Fixing is a judgement call —
// see .claude/commands/docs-sweep.md for the agent loop that does that.

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_DIR = join(ROOT, 'docs/functional-spec');

const MODULES = [
  { id: 'portal', route: 'portal' },
  { id: 'hr-worklog', route: 'hr' },
  { id: 'credit-facility', route: 'credit' },
  { id: 'meeting-minutes', route: 'minutes' },
  { id: 'sop', route: 'sop' },
  { id: 'system-map', route: null },
  { id: 'onboarding', route: 'onboarding' },
  { id: 'ememo', route: null },
];

// Generic UI widgets. Documenting each one adds noise, not information —
// what matters is app capability (exportSiteMonth), not <Spinner/>.
const UI_PRIMITIVES = new Set([
  'Spinner', 'Select', 'Tabs', 'TextInput', 'Empty', 'Hint', 'PageHeader',
  'Card', 'Field', 'Button', 'Modal', 'Badge', 'Icon', 'Toast', 'Flash',
  'Page', 'PageTitle', 'Eyebrow', 'Section', 'Notice', 'ErrorBanner',
  'CtaLink', 'CtaButton', 'Stat', 'Row', 'Col', 'Label', 'Input', 'Textarea',
  'Checkbox', 'Table', 'Th', 'Td', 'Tr', 'Skeleton', 'Divider', 'Chip',
  'Pill', 'Avatar', 'Tooltip', 'Spacer', 'Kbd', 'Link',
]);

// Entry points and vendored third-party code: nothing to explain.
const SKIP_FILES = new Set(['main.jsx', 'main.tsx', 'vite-env.d.ts', 'qrcodeGenerator.js']);

const findings = [];
const add = (severity, module, check, detail, fixable) =>
  findings.push({ severity, module, check, detail, fixable });

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e !== 'node_modules' && e !== 'dist') walk(p, out);
    } else if (/\.(jsx?|tsx?)$/.test(e)) out.push(p);
  }
  return out;
}

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

for (const { id, route } of MODULES) {
  const specPath = join(SPEC_DIR, `${id}.md`);
  const spec = read(specPath);
  if (!spec) {
    add('error', id, 'spec-exists', `docs/functional-spec/${id}.md is missing`, false);
    continue;
  }

  const srcFiles = walk(join(ROOT, id, 'src'));

  // --- CHECK 1: every source file is at least mentioned -------------------
  for (const f of srcFiles) {
    const b = basename(f);
    if (SKIP_FILES.has(b)) continue;
    if (!spec.includes(b)) {
      add('error', id, 'file-undocumented', `${b} exists in src/ but appears nowhere in the spec`, true);
    }
  }

  // --- CHECK 2: every exported app function is documented ------------------
  // This is the check that matters. "Is the filename mentioned" passed at
  // 100% for hr-worklog while 40 real functions were missing.
  const EXPORT_RE =
    /export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)|export\s+const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(/g;
  const fns = new Set();
  for (const f of srcFiles) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(EXPORT_RE)) {
      const name = m[1] || m[2];
      if (name && !UI_PRIMITIVES.has(name)) fns.add(name);
    }
  }
  for (const fn of fns) {
    if (!spec.includes(fn)) {
      add('error', id, 'function-undocumented', `${fn}() is exported but not documented`, true);
    }
  }

  // --- CHECK 3: spec must not reference deleted files ----------------------
  for (const m of spec.matchAll(/`(src\/[A-Za-z0-9_/.-]+\.(?:jsx?|tsx?|css))`/g)) {
    const rel = m[1];
    const hit =
      existsSync(join(ROOT, id, rel)) ||
      existsSync(join(ROOT, 'api', rel)) ||
      existsSync(join(ROOT, 'shared', rel));
    // A doc may legitimately mention a REMOVED file when explaining what the
    // port replaced. Thai/English past-tense markers nearby mean that.
    const idx = m.index ?? 0;
    const around = spec.slice(Math.max(0, idx - 260), idx + 260);
    const historical = /เดิม|แทนที่|ถูกลบ|ลบทิ้ง|เคย|removed|replaced|deleted|no longer|used to/i.test(around);
    if (!hit && !historical) {
      add('error', id, 'dangling-reference', `spec references ${rel}, which does not exist`, true);
    }
  }

  // --- CHECK 4: every API route is documented ------------------------------
  if (route) {
    const routeSrc = read(join(ROOT, 'api/src/routes', `${route}.js`));
    if (routeSrc) {
      const paths = new Set();
      const lines = routeSrc.split('\n');
      lines.forEach((line, i) => {
        if (/router\.(get|post|put|patch|delete)\(/.test(line)) {
          const chunk = lines.slice(i, i + 3).join(' ');
          const p = chunk.match(/'(\/[^']*)'/);
          if (p) paths.add(p[1]);
        }
      });
      for (const p of paths) {
        if (!spec.includes(p)) {
          add('error', id, 'route-undocumented', `API route ${p} is not in the spec`, true);
        }
      }
    }
  }

  // --- CHECK 5: structural integrity ---------------------------------------
  const heads = [...spec.matchAll(/^## (\d+)\./gm)].map((m) => Number(m[1]));
  const dupes = heads.filter((n, i) => heads.indexOf(n) !== i);
  if (dupes.length) {
    add('error', id, 'duplicate-section', `section number(s) used twice: ${[...new Set(dupes)].join(', ')}`, true);
  }
  const maxSec = Math.max(0, ...heads);
  for (const m of spec.matchAll(/หัวข้อ (\d+)/g)) {
    if (Number(m[1]) > maxSec) {
      add('error', id, 'broken-crossref', `points at "หัวข้อ ${m[1]}" but the last section is ${maxSec}`, true);
    }
  }
}

// --- CHECK 6: no doc claims a stack the code does not use -------------------
// portal/STATUS.md claimed TypeScript + a localStorage mock backend long after
// both were gone. Present tense only — "TypeScript is gone" is correct.
for (const { id } of MODULES) {
  const hasTS = walk(join(ROOT, id, 'src')).some((f) => /\.tsx?$/.test(f));
  for (const name of ['README.md', 'STATUS.md']) {
    const p = join(ROOT, id, name);
    const doc = read(p);
    if (!doc) continue;
    if (!hasTS && /(?:^|\n)[^\n]*\b(?:React 18 \+ TypeScript|Stack:[^\n]*TypeScript)/i.test(doc)) {
      add('error', id, 'stale-stack-claim', `${name} presents TypeScript as the current stack, but src/ has none`, true);
    }
    if (/nothing is saved|no real database|mock\/sample data/i.test(doc)) {
      add('error', id, 'stale-backend-claim', `${name} claims there is no backend; this module calls the real API`, true);
    }
  }
}

const asJson = process.argv.includes('--json');
const errors = findings.filter((f) => f.severity === 'error');

if (asJson) {
  console.log(JSON.stringify({ ok: errors.length === 0, findings }, null, 2));
} else if (errors.length === 0) {
  console.log('✓ documentation checks passed');
} else {
  console.log(`✗ ${errors.length} documentation problem(s)\n`);
  const byModule = {};
  for (const f of errors) (byModule[f.module] ??= []).push(f);
  for (const [mod, list] of Object.entries(byModule)) {
    console.log(`  ${mod}`);
    for (const f of list) console.log(`    [${f.check}] ${f.detail}`);
    console.log();
  }
  console.log('To fix: run the "docs-sweep" agent loop, or see');
  console.log('.claude/commands/docs-sweep.md for what it does.');
}

process.exit(errors.length ? 1 : 0);
