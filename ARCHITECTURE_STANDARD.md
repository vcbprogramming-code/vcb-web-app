# VCB Connect — architecture standard

The single place that answers: *what apps exist, where does each keep its data,
and what are the rules everyone follows.* Verified against live Google Drive and
the live Apps Script deployments on **2026-08-30**.

## Folder layout

```
VCB Connect/
├── ORIGINAL CODE/            Google Apps Script (plain JS) — 🟢 LIVE
│   ├── portal/               ├── credit-facility/   ├── system-map/
│   ├── sop/                  ├── hr-worklog/        ├── meeting-minutes/
│   └── onboarding/           └── ememo/
│
├── FOR DEPLOYMENT TEAM/      React 18 + Express + Postgres — ⚪ not deployed
│   ├── api/                  one Express API for every module
│   ├── shared/               api client, auth, i18n, theme, Tailwind preset
│   ├── supabase/migrations/  39 tables across six Postgres schemas
│   └── <module>/             one React SPA each
│
├── README.md
├── TECH_STACK.md             what the deployment side must be built with
└── ARCHITECTURE_STANDARD.md  ← this file
```

The split is by **owner**, one level from the top: everything the deployment
team builds is under `FOR DEPLOYMENT TEAM/`, everything running in production
today is under `ORIGINAL CODE/`. It was per-module until 2026-09-01, which put
deployment work in nine places and stopped the tree describing who owned what.

**`ORIGINAL CODE/` is canonical.** It is what employees actually use.
`FOR DEPLOYMENT TEAM/` is a downstream rewrite — read its `PORT_NOTES.md`
before assuming a feature exists there.

There is no `frontend/` + `backend/` split inside these folders, deliberately: in
Apps Script the backend is the `api_*` functions and the frontend is the HTML
served from the same file, so the split cannot exist.

## App inventory

| App | Script id | Data store |
|---|---|---|
| Portal | `1nHl05hM…0b0j5` | none — static link list |
| Credit Facility | `183uDd0f…AVIqW` | Sheet `1AP5bJBw…Tp-YnE8` (ScriptProp `MASTER_SHEET_ID`) |
| System Map | `1fHG0p18…G1EUO` | none — static renderer |
| SOP | `1oiWdc-1…8PVeY` | Google **Doc** `1emolyEx…HheJxo` + ScriptProperties (chunked) |
| HR Work Log | `16IoKsjX…6tMJR` | Sheet `1HOGRGzX…_POtqro` (`DB_ID`) |
| Meeting Minutes | `1Ozxm34T…7KE6vf` | Sheet `1ouYa11i…tRCCfs` (ScriptProp `MINUTES_DB_SPREADSHEET_ID`); attachments in Drive folder `1EPGohkA…j5zuJR` |
| Onboarding | `15EUqN1-…9EmLHa` | Sheet `1H5d-BwY…uhmfW0k` (ScriptProp `PROGRESS_SS_ID`) |
| E-Memo | `1TVYyTD7…GY92Op` | Sheet `1PYXXfMs…riGHPa1s` (ScriptProp `MASTER_SHEET_ID`) — handed to an external developer, not maintained here |

Portal and System Map hold no data, so they cannot have a "missing database".

### Where each database actually lives

Full ids, so nobody has to go hunting again. Confirmed 2026-09-01.

| App | Spreadsheet / Doc | Full id |
|---|---|---|
| HR Work Log | HR Work Log — Database | `1HOGRGzX2a0udCcW156W4EqPfca1WOHsVJtiE_POtqro` |
| Onboarding | VCB Onboarding Portal — Progress Data | `1H5d-BwYADdUMix_BjzzWgSo5tFNrgPCYr9nhuhmfW0k` |
| Meeting Minutes | VCB Meeting Minutes — Database | `1jE7V15Fr9SnYyPG2DohZd-i0_w-zjQt0ThlvcWuQMZM` |
| E-Memo | VCB Document Control — Master | `1kbqNZ5NAQcAxNamOHreoV7SbndSY2EwpB90mqV9ErHE` |
| Credit Facility | VCB Credit Facility Master | `1hZtE7druGaOjjm7FeH5VQQCzyhbHKwoQ0xhIEbiuoXY` |
| SOP | VCB-MANGO ERP SOP 2569 (a **Doc**, not a Sheet) | `1emolyExkvNIIEAp-8jWqM3laDF_H6c0v8qVuwHheJxo` |

**Four of these changed on 2026-09-01.** The previous ids were deleted from
Drive along with a batch of loose files at My Drive root, and Drive Trash was
emptied before anyone noticed. What survived were copies made on 2026-08-30 —
by accident, and dismissed as junk at the time. They are now the live
databases.

Meeting Minutes, Credit Facility and E-Memo were repointed by editing their
Script Properties; HR's id is in source (`DB_ID`). The copies were verified
byte-for-byte against what was lost where a comparison was possible: HR's 382
work entries are identical in both.

Backups of all six sit in **My Drive ▸ Backup**, named `BACKUP 2026-09-01 — …`.
Copies inside Drive protect against a bad edit, not against Drive itself —
a real backup needs to be off Drive entirely.

**Five of the six ids appear in no source file.** They live in that app's Script
Properties — Apps Script editor → ⚙️ Project Settings → Script Properties, at
the bottom of the page. No API can read them, so this table is the only place
outside Google where they are written down. Keep it current.

To check one yourself, paste the id after
`https://docs.google.com/spreadsheets/d/` (or `/document/d/` for the SOP Doc).
If it opens, the pointer is good.

Two ids in the code no longer resolve, and neither matters: `SEED_FILE_ID` in HR
Work Log (read once by SETUP — the code catches the failure and starts empty,
and the roster is hardcoded in `FULL_ROSTER` anyway), and E-Memo's
`STAGING_SHEET_ID` / `HTML_FILE_ID` (that app belongs to the external developer
now).

The apps also report this themselves: each throws an error naming the missing id
rather than quietly building a blank replacement, so if a database ever does go
missing, opening the app tells you which one.

## The rules

1. **A `.gscript` / `.gsheet` file IS the live cloud object, not a shortcut.**
   Never copy, move or delete one from the filesystem. Copying makes Google Drive
   create a **new empty project**; deleting **trashes the real one**. Both happened
   on 2026-08-30. To relocate one, move it in File Explorer within the synced tree.

2. **Never silently reseed.** If a stored database id will not open, throw loudly.
   Never stand up a blank replacement — the app then writes to an empty sheet and
   the real data looks lost. Auto-create only on a genuine first run with no id
   stored at all.

3. **Recover before failing.** Where a known-good id exists, try it before
   throwing, and write the correction back to the script property so the app
   self-heals. A guard that turns a working app into a hard failure is as bad as a
   silent reseed. (HR Work Log and Onboarding both do this.)

4. **Discovery via a stable id** — a ScriptProperties key or a hardcoded constant.
   Never rename a key on a live app; that orphans the database.

5. **Temp/export files:** create → `setTrashed(true)` immediately.

6. **One authoritative source per app.** No duplicate script copies.

## Reseed-guard conformance (2026-08-30)

| App | Can it invent a blank database? | Note |
|---|---|---|
| Credit Facility | no | guarded July 2026 |
| Meeting Minutes | no | guarded July 2026 |
| HR Work Log | no | **fixed 08-30** — see below |
| Onboarding | no | **fixed 08-30** — both sheet accessors |
| SOP / System Map / Portal | n/a | no spreadsheet at all |
| E-Memo | no | throws if id unset; setup is manual only |

## What changed on 2026-08-30

- **HR Work Log** — its hardcoded `DB_ID` was `1MYHU0ic…5ZIQ`, which **returned 404
  in Drive**; the app survived only via `DB_ID_OVERRIDE_`. Corrected to the real
  sheet, the `createFreshDb_()` fallback replaced with a loud error, and a
  recovery path added that falls back to `DB_ID` and clears a stale override.
- **Onboarding** — `getProgressSheet_()` and `getChecklistContentSheet_()` both
  silently created blank sheets on open failure (this produced two junk
  spreadsheets). Both now route through `openProgressSs_()`, which prefers the
  stored id, recovers onto the known-good one, and refuses to create anything.
- **Meeting Minutes** — `APP_FOLDER_ID` pointed at a **trashed** Drive folder, so
  every attachment upload would have thrown. Repointed at the live folder.
- All three fixes are deployed and verified by pulling the deployed code back.

## Working on these apps

Edit in `ORIGINAL CODE/`, then from that same folder:

```sh
clasp pull    # ALWAYS first — someone may have edited in the browser
# make changes
clasp push    # overwrites live code with your local files
```

`clasp push` updates code only. The live `/exec` URL keeps serving its current
version until a new deployment is created, so pushing mid-day is safe. It never
touches triggers, Script Properties, or webhook registrations.

Portal has no `.clasp.json` on purpose — it was removed so nobody pushes to
production by accident.

## Integrations (Meeting Minutes)

Fathom and Transkriptor feed transcripts in automatically:

- `doPost` webhook — Fathom POSTs finished recordings
- `processFathomQueue_` — every 1 minute
- `pollFathomMeetings_` / `pollTranskriptorMeetings_` — hourly

Transcripts are written as **rows in the database** (`FATHOM_INBOX` /
`TRANSKRIPTOR_INBOX`), not into any Drive folder. API keys live in Script
Properties (`FATHOM_API_KEY`, `TRANSKRIPTOR_API_KEY`).

## Migration off Apps Script — status

Each module's `FOR DEPLOYMENT TEAM/supabase/` now holds the Postgres schema that
would replace its Google Sheet, derived from the live app's own table
definitions. **Nothing is connected**: no Supabase project exists, no data has
been imported, and every React app still runs on its mock layer. The Apps Script
apps remain the live system.

| Module | Schema | Note |
|---|---|---|
| credit-facility | ✅ | the pilot — 9 tables |
| meeting-minutes | ✅ | 3-tier access (public / locked / guest) reproduced in RLS |
| hr-worklog | ✅ | wide monthly tabs normalised to one row per entry |
| sop | ✅ | one jsonb document + versions; no spreadsheet today |
| portal | ✅ | app tiles become editable rows, not hardcoded |
| system-map | n/a — see its `supabase/README.md` | stores nothing; a static build |
| onboarding | ✅ (pre-existing) | already scaffolded this way |

**The security model changes on migration, and this is the part to get right.**
Apps Script gets identity free: `Session.getActiveUser().getEmail()` is supplied
by Google and cannot be spoofed, so a server-side allowlist is enough. A SPA
ships its anon key in the browser bundle, so any check written in the UI can be
skipped by calling the API directly. Every schema therefore enforces access in
the database via row level security, and each app's `supabaseClient.ts` exposes
its role helper for hiding controls only — never for protecting data.

**Still to do per app, and it is the bulk of the work:** create the project, turn
on Google auth restricted to the workspace domain, seed the role tables, import
the data, then replace `src/mock/` with real queries. Do one end-to-end before
starting the next.

## Known gap

**Theme fragmentation across the React mirrors.** All modules ship light *and*
dark, but each implements it differently — four CSS selectors
(`html[data-theme]`, `body.dark`, `html.theme-dark`, `html.dark`), five
`localStorage` keys, and only HR Work Log supports follow-OS. Under one domain
they share an origin, so a user's choice will not follow them between modules.
Token names and palettes differ too. `hr-worklog` has the most complete
implementation — use it as the model when converging.
