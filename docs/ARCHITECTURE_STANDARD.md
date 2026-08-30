# VCB Web Apps — shared architecture standard

One place that answers: *how many databases exist, where do they live, and how does
each app behave.* Audited + verified against Google Drive 2026-07-04. Each app folder
also has its own **`DATABASES.md`** manifest — open that when you click into a folder.

## Database inventory (the answer to "how many?")

Four apps own **one** live database each. Two own none. One is empty.

| App | Live DB | Doc id (live) | Discovery | Where it lives |
|-----|---------|---------------|-----------|----------------|
| Credit Facility | 1 Google Sheet | `1AP5bJBw…YnE8` | ScriptProp `MASTER_SHEET_ID` | its own app Drive folder ✓ |
| Meeting Minute | 1 Google Sheet | `1ouYa11i…CCfs` | ScriptProp `MINUTES_DB_SPREADSHEET_ID` | its own app Drive folder ✓ |
| E-Memo | 1 Sheet **+** 1 backup | `1PYXXfMs…Pa1s` | ScriptProp `MASTER_SHEET_ID` | its own app Drive folder ✓ |
| HR Work Log | 1 Google Sheet | `1MYHU0ic…5ZIQ` | hardcoded `DB_ID` constant | `_data` subfolder ✓ |
| SOP | none (JSON file) | — | env var / local file | `data\sop.json` (Node/Express) |
| VCB Connect | none | — | ScriptProperties only | — |
| Expense Planner | — | *(empty folder)* | — | — |

A healthy Drive contains **exactly 4 live master spreadsheets**, one per app above,
**each already inside its own app folder**. E-Memo additionally keeps 1 manual backup
sheet and generates a Doc + PDF per memo (filed into project subfolders, not root).

## Why a database looked like "litter" at E:\ root

`SpreadsheetApp.create()` **always** drops a new sheet at My Drive root (the API has
no folder argument), and Google Drive-for-Desktop mirrors My Drive onto `E:\`. The
loose file previously at `E:\` root was **not** a live database — it was a blank
**orphan** created by the 2026-07-01 reseed incident. It has been archived (see below).
Every *live* DB was already correctly filed in its app folder.

## The standard (all Apps Script apps)

1. **A DB lives in its own app's Drive folder — never at My Drive root.** All live DBs
   already satisfy this. As a safety net, `setupMaster_`/`getDb_` now `moveTo()` any
   *freshly created* DB into a shared `VCB App Data` folder so a disaster re-create can
   never litter root again.
2. **Never silently reseed.** If a DB id is stored but `openById()` fails, **throw
   loudly** — never create a blank replacement. Auto-create only on genuine first run.
   This is the guard that prevents the 2026-07-01 reseed incident from recurring.
3. **Discovery via a stable id** (ScriptProperties key, or a hardcoded `DB_ID`). Keys
   are **not** renamed on live apps — a rename would orphan the live DB.
4. **Temp/export files:** create → `setTrashed(true)` immediately. Never leave at root.
5. **One authoritative source dir per project.** No stale duplicate script copies.
6. **Each folder carries a `DATABASES.md`** listing its live DB (id + link), any
   backups/orphans, and the transient files it creates — so the count is obvious.

## Per-app conformance (2026-07-04, verified)

| App | DB in app folder | No silent reseed | Temp files cleaned | DATABASES.md |
|-----|:---:|:---:|:---:|:---:|
| Credit Facility | ✅ | ✅ (already hardened) | ✅ | ✅ |
| Meeting Minute | ✅ | ✅ **(fixed 07-04)** | n/a | ✅ |
| E-Memo | ✅ | ✅ (hot path fails loudly) | ✅ | ✅ |
| HR Work Log | ✅ | ✅ (opens by id, throws) | ✅ | ✅ |
| VCB Connect / SOP | n/a (no Google DB) | n/a | n/a | ✅ |

## What was done 2026-07-04

- **Deleted the two orphan sheets** → Google Drive Trash (recoverable 30 days):
  Credit Facility blank reseed orphan (`1dugu…`) and HR stale twin (`1HCI…`). Verified
  first — neither held real user work; the live DBs (`1AP5…`, `1MYHU…`) were untouched.
  `E:\` root now has zero loose sheets and each DB name maps to exactly one sheet.
- **Hardened** Meeting Minute `getDb_()` against silent reseed — **deployed live @42**.
- **Removed** stale duplicate code: E-Memo `_appsscript_new\`; HR `Code.js`/`History.js`
  shadow copies (git-removed, recoverable).
- **Added** a `DATABASES.md` manifest to every app folder; removed the temporary
  `_ARCHIVE` folder once empty.

Kept on purpose: E-Memo's dated backup sheet `1tWQE…` (a deliberate restore point).

## Still your call

- **Credit Facility deploy was intentionally skipped.** Its reseed guard is already
  live, and its only new code (`moveMasterToFolder`) is dormant unless a fresh DB is
  ever created — so it needs no deploy. Its working tree also holds unrelated
  in-progress edits (`Seed.js`, `index.html`, `README.md`); since `deploy.ps1` pushes
  the whole working tree, deploy it yourself only when those edits are ready to go live.
- The two deleted sheets sit in **Drive Trash** for 30 days — empty it whenever you're
  sure, or restore from there if anything ever looks off.
