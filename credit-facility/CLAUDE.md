# Project guide for Claude

VCB Credit Facility web app — Google Apps Script, single-file UI (`index.html`), deployed via
`clasp` (`.\deploy.ps1 "message"`). Start with [README.md](README.md),
[ORIGINAL CODE/SETUP.md](ORIGINAL%20CODE/SETUP.md), and [ORIGINAL CODE/DESIGN.md](ORIGINAL%20CODE/DESIGN.md).
Stable `/exec` URL never changes; Apps Script caches HTML hard —
verify a deploy with `…/exec?v=<n>` or Ctrl+Shift+R.

## Folder layout (two codebases, kept apart on purpose)

- **`ORIGINAL CODE/`** — the canonical Google Apps Script app: `Code.js`, `Seed.js`, `index.html`,
  `appsscript.json`, clasp config (`.clasp.json`, `.claspignore`), `deploy.ps1`, and this project's docs
  (`SETUP.md`, `DESIGN.md`, `DATABASES.md`, `CHANGELOG.md`, the Thai summary). This is the clasp project
  root — run all `clasp`/`deploy.ps1` commands from inside this folder.
- **`FOR DEPLOYMENT TEAM/`** — the React + TypeScript mirror (Vite, deploy-ready for Vercel/Supabase),
  formerly `react/`. A behavior-identical replica kept in sync with `ORIGINAL CODE/` — see
  [FOR DEPLOYMENT TEAM/PORT_NOTES.md](FOR%20DEPLOYMENT%20TEAM/PORT_NOTES.md) for the re-sync process. Never
  mix JS from `ORIGINAL CODE/` into this tree or vice versa — the one deliberate exception is
  `src/app/legacy.js`, a byte-for-byte verbatim copy of the GAS client script (documented in PORT_NOTES.md);
  it stays untyped `.js` on purpose and is not a mistake to "fix."
- **True root** (this folder) — `README.md`, `CLAUDE.md`, and the Drive shortcuts (`.gsheet`, `.gscript`,
  `.url`) that apply regardless of which codebase you're in.

## Standing rule — keep this project pick-up-ready, without busywork

Most edits are tiny and frequent — **do NOT log every one.** Instead:

1. **CURRENT STATE (always accurate):** keep ONE short block at the top of
   [ORIGINAL CODE/CHANGELOG.md](ORIGINAL%20CODE/CHANGELOG.md) that you **overwrite — never append**: live
   deployed version, what's done, what's in progress / next. Refresh it whenever you pause or it goes stale.
   This is what lets a developer jump in exactly where we left off.

2. **HISTORY (milestones only, optional):** add ONE changelog line when a real feature or
   polish pass lands — roll all the small tweaks under it. Never one line per deploy.

3. **DOCS (only when it matters):** update README / SETUP / DESIGN / the Thai summary ONLY
   when you change actual behavior, structure, or a UI convention — not for cosmetic nudges.
   If you introduce a new pattern/convention, document it in DESIGN.md.

4. **GIT:** commit at logical checkpoints (a feature is done, or end of a working session),
   not every micro-change.

### File map — which file for which change
| Change | File |
|--------|------|
| Server logic / data | `ORIGINAL CODE/*.gs` / `*.js` (`Code.gs`/`Code.js`, `Seed.js`) |
| UI (markup, CSS, client JS) | `ORIGINAL CODE/index.html` |
| App config / scopes / access | `ORIGINAL CODE/appsscript.json` |
| Architecture, data model, features | `README.md` (true root) |
| Deploy / clasp workflow, IDs, env, gotchas | `ORIGINAL CODE/SETUP.md` |
| UI / design conventions (tokens, fonts, icons, components) | `ORIGINAL CODE/DESIGN.md` |
| Plain-language stakeholder summary (Thai) | `ORIGINAL CODE/สรุปโปรเจกต์.md` |
| Current state + milestones | `ORIGINAL CODE/CHANGELOG.md` (overwrite the state block; append milestones only) |
| React/TS mirror (deploy team's copy) | `FOR DEPLOYMENT TEAM/` — see its `PORT_NOTES.md` for the re-sync steps |

Don't guess which files matter — use the map. If a change spans areas, update all of them.
