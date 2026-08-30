# Databases for this app — SOP Web App

Verified 2026-08-01. See the cross-app [ARCHITECTURE_STANDARD.md](../../ARCHITECTURE_STANDARD.md) *(cross-app doc, outside this repo)*.

This repo holds two parallel implementations of the same SOP viewer:

## 1. Google Apps Script (`ORIGINAL CODE/apps-script/`) — the live app

This is the version actually deployed and used for demos (not legacy). Storage:

- **Primary store:** a Google **Doc** (`SOP_DOC_ID`, hardcoded in `apps-script/Code.js`).
  Every admin mutation (`createScenario`, `editScenario`, `createReport`,
  `swapScenarioPositions`, `deleteScenario`) writes directly into this Doc via
  `DocumentApp.openById(SOP_DOC_ID)`, then re-parses it (`refreshFromDoc_()`) to
  refresh the served copy. The Doc is not auto-synced on a schedule or on page
  load — only written-then-read-back as part of each mutation.
- **Serving cache:** `CacheService` (fast, 6h TTL) backed by `PropertiesService`
  (durable, chunked — values >9KB are split across `sop_0`, `sop_1`, … keys).
- **Backup: none automated — the Doc itself is the backup of record.**
  `backupToDrive_()` still exists in `Code.js` but is **no longer called**.
  It was wired into `refreshFromDoc_()` at @71 and needed the `.../auth/drive`
  scope, which was declared but never authorized for the *deployed* web app —
  so it failed on every save, swallowed its own error, and left the
  `google.script.run` request hanging: saves spun forever with no message.
  Verified it had never once succeeded (no "SOP Backups" folder, zero snapshot
  files). Removed from the save path at @84 along with the unused scope.
  A `try/catch` guards against *errors*, not against a call that stalls — if
  snapshotting is ever restored, authorize the scope against the deployment
  and keep the write off the user-blocking save path.
- **Drive folders: address by ID, NEVER by name, and NEVER create one.** The SOP flow-diagram PDFs live in exactly one place — locally `E:\WORK\05 SYSTEMS\01 MANGO ERP\07 Diagrams`, on Drive folder id `1ZEG3lkQxdkC7Ix5J-yWPbKPiLaVBxukL` (`DIAGRAMS_FOLDER_ID` in `Code.js`). An earlier `backupToDrive_()` looked its folder up *by name* and called `DriveApp.createFolder()` on a miss, which silently produced a stray duplicate folder in the owner's Drive. All `createFolder`/`getFoldersByName` calls are now gone; if an id stops resolving, fix the id — never add a create-on-miss fallback.
- **Attachments:** each case can carry reference files (flow-diagram PDFs),
  stored as `ไฟล์แนบ: Label | URL` metadata lines in the SOLUTION cell —
  the same convention as `หมวดเพิ่มเติม:`/`วันที่เพิ่ม:`. **Link-only by
  design:** the app never uploads or holds a file; the PDFs live in a shared
  Drive folder. A file that isn't readable by the viewer silently falls back to
  a generic icon. Mirrored in Postgres as `scenario_attachments` (see
  `DATABASE_SCHEMA.sql`).
  - **Thumbnails are width-dependent, not guaranteed.** Above 1600px the rail
    renders Drive preview images via the `thumbnail?id=…` endpoint; at or below
    that it collapses to a filename-only chip strip and no thumbnail is
    requested at all (see DESIGN.md's responsive table). The stored data is
    identical either way — this is purely a rendering decision.
  - **The storage format has not changed**, but the editor UI has: as of
    2026‑08‑28 the admin edits one row per file (name + URL) instead of typing
    `Label | URL` pipe syntax into a textarea. `readAttachmentRows()` emits the
    same `{label,url}` objects `writeAttachments_` already wrote, so no
    migration was needed and old rows keep working.
  - **A `drive.readonly` scope IS now required** (added 2026‑08‑29) — this
    doc previously said none was needed, which was true until
    `getDriveFileName()` was added to look up a pasted file's name for the
    editor. It is read-only and touches nothing else; rendering thumbnails
    still needs no scope at all (that is a plain image URL the *browser*
    fetches, not the script).
  - **An empty label is not a bug.** `writeAttachments_` falls back to the URL
    when a label is blank, and `attachmentCardsHtml()` deliberately refuses to
    print a raw `/file/d/<id>/view` as a caption — it shows "เอกสารแนบ"
    instead. A card captioned that way means the stored label equals the URL.
- **Solution step model:** each scenario's SOLUTION cell parses into one of
  three step kinds — `numbered` (top-level, literal "N. " text written into
  the Doc by the one-time `renumberAllSteps_()` migration), `sub` (`» `
  repeated per nesting depth — now supports 2+ tiers, not just one), and
  `caption` (unmarked body text, no bullet). See `parseSolutionCell_` /
  `writeSteps_` in `Code.js` and `stepsToStorage`/`stepsFromStorage` in
  `index.html` for the authoring-syntax ↔ storage-format boundary.

## 2. Node/Express port (removed 2026-08-30) — Postgres migration target

Not a live Google Apps Script app. Runs on Node.js/Express and stores everything
in a local JSON file:

- **Live data:** `data\sop.json` (scenarios + reports + metadata), read/written by
  `src\store.ts`. Location overridable via the `SOP_DATA_FILE` env var.
  > **`FOR DEPLOYMENT TEAM/src/data/sop.json` is a snapshot, not truth.** It is a point-in-time export
  > of the live app and nothing keeps it in sync — it had drifted so far by
  > 2026-08-25 that **29 of 31 cases** carried a different `displayNo`, title,
  > or both. Never map anything to cases from this file; read the live app
  > first via `/exec?dump=1` (full payload) or `/exec?cases=1` (id/title list),
  > then re-export: `curl "<exec-url>?dump=1" -o data/sop.json` and copy into
  > `FOR DEPLOYMENT TEAM/src/data/`.
- No CRUD yet for `reports` or process flows in this port — only scenarios
  (`createScenario`/`editScenario`) have API routes; see the old Express port (removed 2026-08-30).

It creates **no** Google Sheets or Drive files at runtime.

A draft PostgreSQL schema for a future rewrite exists at `DATABASE_SCHEMA.sql`
(+ seed data in `DATABASE_DATA.sql`) but is not wired up to any running code yet.

## Summary

**Live app (ORIGINAL CODE/apps-script/):** Google Doc (primary store *and* backup of record —
there are no automated Drive snapshots; `backupToDrive_()` is unused).
**Node port (src/):** local `data\sop.json` file. **0 spreadsheets**, **0 running
Postgres** — `DATABASE_SCHEMA.sql`/`DATABASE_DATA.sql` are drafts for a planned
TypeScript/React rewrite, not yet connected.
