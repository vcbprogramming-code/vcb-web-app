# ORIGINAL CODE — Google Apps Script (JavaScript)

**This is the app that is actually running in production.** Plain JavaScript and
HTML, deployed to Google Apps Script. Nothing here is compiled or bundled — what
you read is what runs.

Live URL:
<https://script.google.com/macros/s/AKfycby8FFhiGqjn2tSYaj8LjIPMHwBtkQk66hed7sq1q_tCFd7XhHeHef1_NTuv7qzJDIi8Dg/exec>

## Layout

```
ORIGINAL CODE/
  apps-script/          ← everything clasp deploys, and nothing else
    Code.js             BACKEND  — server logic
    index.html          FRONTEND — the whole UI in one file
    appsscript.json     manifest (OAuth scopes, access)
    .clasp.json         script id
    .claspignore        allowlist: only the 3 files above are pushed
  _gen_preview.js       local tool, never deployed
  README.md
```

### Why backend and frontend are not in separate folders

**Apps Script projects are flat — they cannot contain folders.** `clasp` pushes
every allowed file to the root of the script project, so `Code.js` and
`index.html` have to sit next to `.clasp.json`. Splitting them into
`backend/` and `frontend/` subfolders would break `clasp push`.

The separation is by *file* instead, and it is absolute:

| File | Role | Runs on |
|---|---|---|
| `Code.js` | **Backend.** Reads and writes the Google Doc, admin gating, and every mutation entry point (`editScenario`, `createScenario`, `swapScenarioPositions`, `deleteScenario`, `getDriveFileName`). | Google's servers |
| `index.html` | **Frontend.** All markup, CSS and client-side JS. Apps Script requires it to be a single file. | The user's browser |

They talk over `google.script.run` (browser → server) and Apps Script templating
`<?!= bootstrap ?>` (server → browser at page load).

`_gen_preview.js` sits **outside** `apps-script/` on purpose: it is a local
throwaway that renders the flow diagrams to `apps-script/flows-preview.html` for
eyeballing, and keeping it out of the deploy folder means it can never be pushed
by accident.

## Deploying

`clasp` reads `.clasp.json` from the current directory, so the `cd` is required:

```bash
cd "ORIGINAL CODE/apps-script"
clasp push -f
clasp create-deployment -i AKfycby8FFhiGqjn2tSYaj8LjIPMHwBtkQk66hed7sq1q_tCFd7XhHeHef1_NTuv7qzJDIi8Dg -d "what changed"
```

Always pass that **existing** deployment id. Running `create-deployment` without
`-i` mints a new `/exec` URL, which looks to users like an entirely new app.

If `clasp push` fails with `invalid_grant` / `invalid_rapt`, the credentials need
an interactive `clasp login` — nothing is wrong with the code.

## Rebuilding the diagram preview

```bash
cd "ORIGINAL CODE"
node _gen_preview.js        # writes apps-script/flows-preview.html (gitignored)
```

## Relationship to `FOR DEPLOYMENT TEAM/`

That folder holds the **React/TypeScript port** — a separate rebuild of the same
UI. It is not what serves users. **Any change that has to reach production has to
happen here.**

## Documentation for this stack

All of it now lives **in this folder**, beside the code it describes:

| File | What |
|---|---|
| `SETUP.md` | build & deploy workflow (`clasp`) |
| `PROJECT_SUMMARY.md` | full technical overview of this app |
| `DESIGN.md` | UI conventions — dark mode, modals, responsive budget |
| `DATABASES.md` | where the data actually lives (the Google Doc) |
| `DATABASE_SCHEMA.sql` / `DATABASE_DATA.sql` | PostgreSQL export, for a future rewrite |

The repo-wide `CHANGELOG.md` stays at the root — it is numbered by this app's
deployment ids (@116, @115, …) and also records the React port's syncs, so it
covers both stacks.
