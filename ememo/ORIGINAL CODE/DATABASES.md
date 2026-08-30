# Databases for this app — E-Memo Web App

Verified against Google Drive on 2026-07-04; tab list and the note below refreshed
2026-08-18. See the cross-app [ARCHITECTURE_STANDARD.md](../ARCHITECTURE_STANDARD.md).

> **There is exactly one database and it is the Google Sheet below.** A local
> `VCB Document Control — Master.xlsx` file used to sit in this folder, written by a
> separate `SKILL.md` Gmail-scraping pipeline; it was a disconnected duplicate ledger that
> the web app never read. Both the `.xlsx` and that `SKILL.md` were **deleted on
> 2026-08-18** — Gmail logging now runs solely through the self-contained `gmailAutoLog`
> Apps Script trigger, which writes straight into the Sheet below.

## Live database — count: **1**

| | |
|---|---|
| **Name** | `VCB Document Control — Master` |
| **Doc id** | `1PYXXfMszDoQiQmhPqUimOc5QLIHNK3fjFUtriGHPa1s` |
| **Link** | https://docs.google.com/spreadsheets/d/1PYXXfMszDoQiQmhPqUimOc5QLIHNK3fjFUtriGHPa1s/edit |
| **Lives in** | this app's own Drive folder (correctly placed) |
| **App finds it via** | ScriptProperty `MASTER_SHEET_ID` |
| **Tabs** | one per project (BT1, VK2, BV, V&K, PN4, LPB, EP, CVE, VC, UNCLASSIFIED) + discussion |

Tabs are **created on demand** by `getMasterSheetForProject_()` (Code.js) the first time a
row is written for a project, using the shared 15-column `MASTER_HEADER` schema — there is
no fixed tab list to maintain. `getDocuments()` likewise enumerates `ss.getSheets()` and
surfaces whatever tabs exist, so a new project appears in the portal automatically. Two
tabs were added/reshaped on 2026-08-18 by guarded one-time migrations that run from
`getDocuments()`: **`VC`** (ลาดหลุมแก้ว ตอน 3, split out of `BT1`) and **`V&K`**
(พุทธมณฑล ตอน 3, split out of `PN4`, which had been holding both sites' rows). See the
2026-08-18 entry in [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md).

## Intentional backup (keep) — count: **1**

| | |
|---|---|
| **Name** | `VCB Master BACKUP 20260523-151745 (pre-row-cleanup)` |
| **Doc id** | `1tWQE8oLXJMqxKUa0VgHuWQ_pc0r-6O66njLYQjb_tLE` |

A deliberate pre-cleanup snapshot (untouched since 2026-05-23). Not used by the app;
kept as a manual backup. Delete it if you no longer need that restore point.

## Other Drive artifacts the app generates (not databases)

- **Per-memo Google Docs + PDFs** — one per generated memo, filed into the project
  subfolder (not root). These are documents, not databases.
- **Email attachments** — saved into project folders by the Gmail auto-log.
- **Auth-check Doc** (`VCB auth check — safe to delete`) — created then **trashed
  immediately** on each auth check; never persists.

## Summary

**2 spreadsheets** relate to this app: 1 live master + 1 manual backup. Everything
else it creates is per-memo document output, not a database.
