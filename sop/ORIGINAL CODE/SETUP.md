# SETUP — build & deploy workflow

The repo is split in two (see the root `README.md`):

| Folder | What | Where you run its commands |
|---|---|---|
| `ORIGINAL CODE/apps-script/` | the **live** Apps Script app (JavaScript) | `clasp` — from **inside that folder** |
| `FOR DEPLOYMENT TEAM/` | the React + TypeScript app (Vite) | `npm` — from **inside that folder** |

Project root: `E:\WORK\08 CLAUDE CODE\SOP Web App`.
Tooling: **clasp v3** (logged in as the deployer `c.chavananand@vcb-con.com`).

Only 3 files are ever pushed (`.claspignore` whitelists them): `index.html`, `Code.js`, `appsscript.json`. All `.md` docs and the preview helpers stay local.

## Deploy to production
`clasp` resolves `.clasp.json` from the current directory, so the `cd` is not
optional — running these from the repo root pushes nothing.
```bash
cd "ORIGINAL CODE/apps-script"
clasp push -f
clasp create-deployment -i AKfycby8FFhiGqjn2tSYaj8LjIPMHwBtkQk66hed7sq1q_tCFd7XhHeHef1_NTuv7qzJDIi8Dg -d "<msg>"
```
That `-i` id **is** the production URL — passing it updates the live app in place. Running `create-deployment` **without** `-i` makes a brand-new URL instead.

## Preview without touching production  ⚠
The `@HEAD` deployment's `/exec` URL did **not** reliably serve freshly-pushed code. To let someone review safely:
```bash
cd "ORIGINAL CODE/apps-script"
clasp push -f
clasp create-deployment -d "PREVIEW <date> — <what>"   # prints a NEW id → preview URL = .../macros/s/<newId>/exec
#   …reviewer looks…
clasp delete-deployment <newId>                          # clean up; keep only the 2 intended deployments
```
Promote to production with `create-deployment -i <prod id>` only after approval.

## Sanity check before deploy
```bash
# extract the main <script> block and syntax-check it
node -e 'const fs=require("fs");const s=fs.readFileSync("index.html","utf8");const l=s.lastIndexOf("</script>");const o=s.lastIndexOf("<script>",l);fs.writeFileSync("_logic.js",s.slice(o+8,l));'
node --check _logic.js && rm -f _logic.js
```

## Preview the flow diagrams locally
```bash
node _gen_preview.js     # rebuilds flows-preview.html from index.html
# then open flows-preview.html in a browser
```

## One-time / occasional
- **Auth expired** (`invalid_grant`/`invalid_rapt`): `clasp login` (must be run interactively by the user — can't be done remotely).
- **Add an editor:** add the email to `ADMIN_EMAILS` in `Code.js`, then push + `create-deployment -i <prod id>`.
- **Restyle the Doc:** `formatDoc()` (one-shot, idempotent, run from the Apps Script editor).
- **403 after deploy:** a new scope was added — open the editor, run any function once, approve consent.
- **Current OAuth scopes** (`appsscript.json`): `documents`, `drive.readonly` (added 2026-08-29 for `getDriveFileName()`), `script.scriptapp`. Adding one forces the re-consent above.

> **No Doc auto-sync anymore — fully removed, confirmed severed.** As of 2026-07 the app is one-way (app → Doc backup only, never Doc → app) — see CHANGELOG.md's "Architecture change" note. There is no trigger to install (the live trigger store was checked directly and confirmed empty), and `installSyncTrigger()`, `removeSyncTrigger()`, and `syncFromDoc()` are all **deleted from `Code.js` entirely** as of production `@69` — none of them exist anymore, not even as an unused escape hatch. There is still no real database; the Doc remains a write-only backup copy.

> **Standing instruction:** always push (`clasp push -f`) and deploy directly to the production deployment id above — never create a separate/preview deployment for routine changes, and don't ask for confirmation first. Reserve the preview flow (below) only for changes big enough that the user has actually asked to see a preview first.

## Release checklist
1. Make the change in the right file — for anything users will see, that means `ORIGINAL CODE/apps-script/` (see the folder map in the root `README.md`).
2. Bump `APP_VERSION` + prepend a `CHANGELOG` entry in `index.html` **only when a real feature/polish pass lands** (not every tweak).
3. `push` + `create-deployment -i <prod id>`.
4. Overwrite the **Current state** block in `CHANGELOG.md`.
5. Update README/DESIGN/SUMMARY **only if behavior, structure, or a UI convention changed.**

## Verifying a deploy from the command line
`curl -sL "<exec-url>"` returns the real page, so a deploy can be confirmed
without a browser — but **the served HTML is hex-escaped inside a
`goog.script.init(...)` payload**, not plain. A literal `grep` for a CSS rule
will report a false MISS. Decode first:

```js
const dec = raw.replace(/\\x([0-9a-fA-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
// then also unescape CSS punctuation: \{ \} \> \, \#
```

Two traps that produced wrong "it didn't deploy" conclusions:
- `indexOf('#ed_steps')` finds the **mobile** override first, since
  `html.is-mobile` rules appear earlier in the sheet. Search for all matches and
  check which block each is in.
- Bumping `APP_VERSION` gives a cheap positive check — if the new build string
  is present, the push landed, and any "missing" rule is a search-string
  problem rather than a deploy problem.
