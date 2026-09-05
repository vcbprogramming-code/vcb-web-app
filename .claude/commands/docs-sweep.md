---
description: Find and FIX documentation drift across all modules, then push
---

Repair documentation drift in this repository. Do not ask questions — fix what
is fixable, and report only what genuinely needs a human decision.

## Step 1 — measure

```
cd "FOR DEPLOYMENT TEAM" && node scripts/check-docs.mjs --json
```

If `ok` is true: stop. Say "documentation checks passed, nothing to fix" and do
nothing else. Do not invent work.

## Step 2 — fix each finding

Work through the findings. For each, READ THE ACTUAL CODE first — never write a
description from the function's name alone.

| check | what to do |
|---|---|
| `function-undocumented` | Read the function. Add it to the module's spec, in the section where it belongs. Real capabilities get a proper explanation with logic; small helpers get one row in a reference table. Do not pad. |
| `file-undocumented` | Read the file. Add it to the section covering that area. |
| `route-undocumented` | Add the route to the spec's endpoint table with its method, purpose and required role. |
| `dangling-reference` | The file is gone. Either drop the mention, or reword it as history ("เดิม…", "ถูกแทนที่ด้วย…") if it explains what the port replaced. |
| `duplicate-section` / `broken-crossref` | Renumber sequentially and repair every in-text `หัวข้อ N` reference you shift. |
| `stale-stack-claim` / `stale-backend-claim` | Rewrite the file to match reality. Keep it short — link to the functional spec rather than restating it. |

## Rules

- **Write in Thai**, matching each spec's existing style and register.
- **Never delete existing prose** except where it is factually wrong. Adding and
  renumbering is fine; rewriting someone's correct explanation is not.
- **Verify before writing.** If a function appears unused, grep the module to
  confirm before saying so. Report what the code does, not what its name implies.
- **Do not document history.** No "deleted on <date>, commit abc123" notes. Git
  holds that. The spec describes what the app does today.
- **One fact, one place.** Cross-reference an existing section rather than
  restating it.

## Step 3 — verify

Re-run `node scripts/check-docs.mjs`. It must pass. If a finding cannot be
fixed by editing documentation, leave it and report it in step 5.

## Step 4 — commit and push

Documentation only. Never commit source-code changes from this loop.

Run these as SEPARATE commands — a combined `git add && git commit` trips this
machine's Drive-protection hook:

```
git add "FOR DEPLOYMENT TEAM/docs" "FOR DEPLOYMENT TEAM/*/PORT_NOTES.md" "FOR DEPLOYMENT TEAM/*/README.md"
git commit -m "docs: <what you fixed, specifically>"
git push origin VCB-dev
```

## Step 5 — report

Two or three sentences: what was found, what you fixed, what still needs a
person. If nothing was found, say so in one line.

**Escalate rather than act** when:
- Fixing would require changing source code (only docs are in scope here)
- A check flags something that looks like a real bug in the app
- The correct answer depends on intent you cannot read from the code
