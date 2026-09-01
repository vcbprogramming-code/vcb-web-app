# VCB Connect

The internal web portal for VCB Group (วิจิตรภัณฑ์ก่อสร้าง), a Thai construction
company — a launcher plus seven business apps that employees use daily.

The apps are **live in production right now**, written in Google Apps Script,
serving real staff. Nothing here is a greenfield project.

For the reference detail — script ids, exact data stores, the rules — see
**[ARCHITECTURE_STANDARD.md](ARCHITECTURE_STANDARD.md)**.

## The one thing that confuses everyone

**There are two codebases here, and they are not the same apps.**

```
VCB Connect/
├── ORIGINAL CODE/          ← Google Apps Script. LIVE. Real users, real data.
│   ├── hr-worklog/
│   ├── meeting-minutes/
│   └── … one folder per app
└── FOR DEPLOYMENT TEAM/    ← React + Express + Postgres. Not deployed yet.
    ├── api/                the one Express API, shared by every module
    ├── shared/             api client, auth, i18n, theme
    ├── supabase/           migrations
    ├── hr-worklog/         React SPA
    └── … one folder per app
```

| | `ORIGINAL CODE/` | `FOR DEPLOYMENT TEAM/` |
|---|---|---|
| Language | plain JavaScript (`.js` / `.gs`) | plain JavaScript (`.js` / `.jsx`) |
| Runs on | Google's servers | nowhere yet |
| Data | real Google Sheets | Postgres, via the Express API |
| Users | all staff, today | none |

`ORIGINAL CODE/` is canonical. If the two disagree, the Apps Script version is
right and the React one is behind.

**The React apps talk to `api/`, not to the database.** The browser never holds
database credentials; every request goes through Express, which is the only
thing that does. That also means access control lives in the API — the schemas
used to enforce it with row level security, which worked while the browser was
the Postgres client and does not now.

In Apps Script there is no frontend/backend split: the backend is the `api_*`
functions and the frontend is the HTML served from the same file. That is why
those folders are flat rather than split into `frontend/` + `backend/`.

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

1. **[ARCHITECTURE_STANDARD.md](ARCHITECTURE_STANDARD.md)** — app inventory with
   script ids, where each app keeps its data, the rules, and what changed
   recently.
2. **[TECH_STACK.md](TECH_STACK.md)** — what the deployment side must be built
   with, and what it must not.
3. **`FOR DEPLOYMENT TEAM/<module>/PORT_NOTES.md`** — what each React port
   covers and what it does not.
4. **`FOR DEPLOYMENT TEAM/supabase/migrations/`** — the Postgres schema, one
   file per module, with the app-specific traps noted inline.
5. **`ORIGINAL CODE/<module>/`** — the live app's own README, PROJECT_SUMMARY,
   SETUP, CHANGELOG and design notes, where they exist.

## Working on the live apps

Each `ORIGINAL CODE/<module>/` folder is a `clasp` project. From inside it:

```sh
clasp pull    # ALWAYS first — someone may have edited in the browser
# make changes
clasp push    # overwrites the live code with your local files
```

Skipping the `pull` silently destroys anyone else's browser-side edits.

`clasp push` updates code only — the live `/exec` URL keeps serving its current
version until a new deployment is created, so pushing mid-day is safe.

**A new deployment does not inherit the manifest's access setting.** `appsscript.json`
declaring `"access": "ANYONE_ANONYMOUS"` describes what the script asks for; the
permission that actually applies is set on the deployment itself, in the editor
under Deploy ▸ Manage deployments. A deployment created by `clasp` defaults to
restricted, and the only symptom is a Google sign-in page where the app should
be. This cost an afternoon on 2026-09-01.

## Running the React side

```sh
cd "FOR DEPLOYMENT TEAM/<module>"
npm install
npm run dev
```

The API it talks to lives in `FOR DEPLOYMENT TEAM/api/` and is shared by every
module — one Express app, one deploy, one JWT that works everywhere.

All seven build clean. `node_modules/` and `dist/` are not committed, and are
best deleted when you are done — Drive syncs this folder, and 26,000 build files
will stall its queue.

## Two things that will bite you

**1. `.gscript` and `.gsheet` files are not shortcuts.** On Google Drive for
Desktop each one *is* the live Apps Script project or Spreadsheet. Copying one
makes Drive create a new empty project; deleting one trashes the real thing.
Both happened on 2026-08-30 and took six live apps offline until they were
restored from Drive Trash. Never `cp`, `mv` or `rm` them — to relocate one, move
it in File Explorer within the synced folder.

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

## The migration

The intent is to leave Apps Script for React + Express + Postgres. The code is
written: seven SPAs converted, one Express API with every route, and migrations
creating 39 tables across six Postgres schemas.

**Nothing is connected.** No Supabase project exists and no data has been
imported. The SPAs build and the API parses; none of it has run against a real
database.

Recommended order, and why:

1. **credit-facility** — the pilot. Not yet in daily use, so mistakes are cheap.
   Learn the real cost here.
2. **onboarding** — was already querying Supabase directly, so its data shapes
   are proven.
3. **sop** — simplest: no spreadsheet, one JSON document.
4. **system-map** — stores nothing; a static build.
5. **meeting-minutes** — the Fathom/Transkriptor triggers have no Vercel
   equivalent and must be rebuilt, or recordings silently stop arriving.
6. **portal** — late, because every tile points at another app's URL.
7. **hr-worklog** — last. 8,000 lines, 50 server functions, in daily use.

**The security model changes, and this is the part to get right.** Apps Script
gets identity free: `Session.getActiveUser().getEmail()` is supplied by Google
and cannot be spoofed, so a server-side allowlist is enough.

That is gone. The browser now sends a JWT the API issued, so anything the React
app decides about roles only hides menus — the API is the real gate, and a route
without a guard is public to the internet. The schemas' 45 row level security
policies were **removed**, not carried across: they worked while the browser was
the Postgres client, but the API connects as a single database user, so every
policy would see the same principal and could not tell callers apart. Keeping
them would have implied a protection that was no longer there. Access control
lives in `api/src/middleware/auth.js` and in each route.

## Known gaps

**Theme fragmentation — resolved on the deployment side, still live in
`ORIGINAL CODE/`.** The Apps Script apps each implement light/dark differently:
four CSS selectors (`html[data-theme]`, `body.dark`, `html.theme-dark`,
`html.dark`) and five `localStorage` keys between them, so a user's choice does
not follow them from one app to the next. The React side converged on one
convention in `FOR DEPLOYMENT TEAM/shared/src/theme.jsx` — `html.dark`, key
`vcb_theme`, with `auto` following the OS. The live apps keep their own until
they are replaced.

**The live handles sit inside the repo.** Each `ORIGINAL CODE/<module>/` folder
contains the `.gscript` and `.gsheet` files that *are* the live cloud objects,
inside a git working tree on a Drive-synced volume. `.gitignore` keeps them out
of commits, but not out of the way of every git and sync operation that touches
those paths. Moving them somewhere Drive and git do not both reach is the one
protection no amount of care in the code provides.
