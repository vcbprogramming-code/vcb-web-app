# Databases for this app — Credit Facility Web App

Verified against Google Drive on 2026-07-04. See the cross-app
[ARCHITECTURE_STANDARD.md](../../ARCHITECTURE_STANDARD.md).

## Live database — count: **1**

| | |
|---|---|
| **Name** | `VCB Credit Facility Master` |
| **Doc id** | `1AP5bJBw7KXL7mAKI9iWYvv5rmAgvkwA32Zv9Tp-YnE8` |
| **Link** | https://docs.google.com/spreadsheets/d/1AP5bJBw7KXL7mAKI9iWYvv5rmAgvkwA32Zv9Tp-YnE8/edit |
| **Lives in** | this app's own Drive folder (already correctly placed — not root) |
| **App finds it via** | ScriptProperty `MASTER_SHEET_ID` |
| **Tabs** | Facilities, Transactions, Requests, Limits, CostCategories, CategoryCaps, CashPlan |

This is the **only** database the app reads/writes. The Facilities baseline also
comes from `Seed.js` in code; the sheet stores what users enter.

## Transient files (auto-deleted — do not count)

- On CSV/XLSX export the app creates a temp `cf-export-<timestamp>` sheet, then
  **trashes it immediately** (`Code.js`). It never persists.

## Orphan — DELETED 2026-07-04

- **Blank seed** `1duguMDN…` — created by the 2026-07-01 reseed incident, was
  littering `E:\` root. Verified to hold only seed rows (no real work) and sent to
  Google Drive Trash on 2026-07-04 (recoverable there for 30 days). Your live data
  (`1AP5…` above) was never involved.

## Safety note

`getMaster_()` throws loudly if `MASTER_SHEET_ID` won't open — it will **not**
auto-create a blank replacement (that is the hardening from the reseed incident).
`recoverMaster()` remains in `Code.js` as a dormant safety net.
