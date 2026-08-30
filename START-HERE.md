# Start here

New to this repo? Read this page, then `ARCHITECTURE_STANDARD.md`. Everything
else is per-app detail you can reach for when you need it.

## What this is

**VCB Connect** is the internal web portal for VCB Group (วิจิตรภัณฑ์ก่อสร้าง),
a Thai construction company. It is a launcher plus seven business apps that
employees use daily.

The apps are **live in production right now**, written in Google Apps Script,
serving real staff. Nothing here is a greenfield project.

## The one thing that confuses everyone

**Every module has two folders, and they are not the same app.**

```
meeting-minutes/
├── ORIGINAL CODE/         ← Google Apps Script. LIVE. Real users, real data.
└── FOR DEPLOYMENT TEAM/   ← React + TypeScript. Not deployed. Mock data.
```

| | `ORIGINAL CODE/` | `FOR DEPLOYMENT TEAM/` |
|---|---|---|
| Language | plain JavaScript (`.js` / `.gs`) | TypeScript + React |
| Runs on | Google's servers | nowhere yet |
| Data | real Google Sheets | **fake sample data** |
| Users | all staff, today | none |

`ORIGINAL CODE/` is canonical. If the two disagree, the Apps Script version is
right and the React one is behind.

**The React apps do not save anything.** Type into one, hit save, reload — it is
gone. There is no backend. That is by design, not a bug: Apps Script only
exposes its server functions through `google.script.run`, which works inside
Google's own iframe. A React app hosted anywhere else cannot call them, so each
port ships a typed mock layer that mirrors the real API's shapes. Read the
module's `PORT_NOTES.md` before assuming a feature exists on the React side.

## The apps

| App | What it does | Live data |
|---|---|---|
| **portal** | the launcher — tiles linking to everything else | none |
| **hr-worklog** | daily work log across 8 sites, ~345 staff | Google Sheet |
| **meeting-minutes** | minutes, with Fathom + Transkriptor auto-import | Google Sheet |
| **sop** | standard operating procedures for the MANGO ERP | Google Doc |
| **credit-facility** | credit limits, drawdowns, approvals | Google Sheet |
| **onboarding** | 90-day new-employee programme | Google Sheet |
| **system-map** | interactive map of company systems | none — static |
| **ememo** | document control / e-signature | handed to an external dev |

Much of the UI text is Thai. `ORIGINAL CODE/` files carry substantial comments,
usually explaining *why* something is the way it is — those are worth reading
before changing anything.

## Where to read next

1. **`ARCHITECTURE_STANDARD.md`** — app inventory with script IDs, where each
   app keeps its data, the rules everyone follows, and what changed recently.
2. **`<module>/FOR DEPLOYMENT TEAM/PORT_NOTES.md`** — what the React port
   covers and what it does not.
3. **`<module>/FOR DEPLOYMENT TEAM/supabase/MIGRATION.md`** — the plan for
   moving that app off Apps Script (see below).
4. **`<module>/ORIGINAL CODE/`** — the live app's own README, CHANGELOG and
   design notes, where they exist.

## The migration

The intent is to leave Apps Script for React + Supabase. Groundwork is done —
each module has a Postgres schema derived from its live Sheet, a Supabase
client, and a migration guide.

**Nothing is connected.** No Supabase project exists, no data has been imported,
and every React app still runs on mock data.

Recommended order, and why:

1. **credit-facility** — the pilot. 9 tables, not yet in daily use, so mistakes
   are cheap. Learn the real cost here.
2. **onboarding** — already queries Supabase for real, not a mock.
3. **sop** — simplest: no spreadsheet, one JSON document.
4. **system-map** — stores nothing; a static build.
5. **meeting-minutes** — the Fathom/Transkriptor triggers have no Vercel
   equivalent and must be rebuilt, or recordings silently stop arriving.
6. **portal** — last, because every tile points at another app's URL.
7. **hr-worklog** — last. 8,000 lines, 50 server functions, in daily use.

**The security model changes, and this is the part to get right.** Apps Script
gets identity free: `Session.getActiveUser().getEmail()` is supplied by Google
and cannot be spoofed, so a server-side allowlist is enough. A SPA ships its
anon key in the browser bundle, so any check written in the UI can be skipped by
calling the API directly. Every schema therefore enforces access in the database
via row level security. Treat the client-side role helpers as UI hints only.

## Working on the live apps

Each `ORIGINAL CODE/` folder is a `clasp` project. From inside it:

```sh
clasp pull    # ALWAYS first — someone may have edited in the browser
# make changes
clasp push    # overwrites the live code with your local files
```

Skipping the `pull` silently destroys anyone else's browser-side edits.

`clasp push` updates code only — the live `/exec` URL keeps serving its current
version until a new deployment is created, so pushing mid-day is safe.

`portal` deliberately has no `.clasp.json`, so it cannot be pushed to by
accident.

## Running the React side

```sh
cd "<module>/FOR DEPLOYMENT TEAM"
npm install
npm run dev
```

All seven build clean (`npm run build`, TypeScript included). `node_modules/` is
not committed.

## Two things that will bite you

**1. `.gscript` and `.gsheet` files are not shortcuts.** On Google Drive for
Desktop each one *is* the live Apps Script project or Spreadsheet. Copying one
makes Drive create a new empty project; deleting one trashes the real thing.
Both happened on 2026-08-30 and took six live apps offline until they were
restored from Drive Trash. Never `cp`, `mv` or `rm` them.

**2. Names outlive their meaning.** Several fields are called something the app
no longer does:

- HR Work Log's sheet columns are `AM 1`…`PM 31`, but the app has **no
  morning/afternoon split**. They are งานหลัก (main task) and งานเสริม
  (optional extra). A day with both filled is still **one manday** — counting
  them as two breaks every workload total.
- Meeting Minutes has `doc_id`, `tab_id` and `source = 'doc-import'`, but Google
  Docs stopped being the source of truth on 2026-07-19. The import path is
  permanently disabled; re-enabling it would overwrite real edits.
- SOP writes into a Google Doc on every save, so the Doc is a current mirror —
  but editing the Doc does **not** flow back into the app.

When in doubt, read what the code does, not what the column is called.

## Known gap

**Theme fragmentation.** All modules ship light and dark, but each implements it
differently — four CSS selectors (`html[data-theme]`, `body.dark`,
`html.theme-dark`, `html.dark`), five `localStorage` keys, and only HR Work Log
follows the OS setting. Under one domain they share an origin, so a user's
choice will not follow them between modules. `hr-worklog` has the most complete
implementation; use it as the model when converging.
