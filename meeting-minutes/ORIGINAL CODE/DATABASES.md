# Databases for this app — Meeting Minute Web App

Verified against Google Drive on 2026-07-04. See the cross-app
[ARCHITECTURE_STANDARD.md](../ARCHITECTURE_STANDARD.md).

## Live database — count: **1**

| | |
|---|---|
| **Name** | `VCB Meeting Minutes — Database` |
| **Doc id** | `1ouYa11iXkwi3tZiL6yKMy742c9nnh7ACQf0j_tRCCfs` |
| **Link** | https://docs.google.com/spreadsheets/d/1ouYa11iXkwi3tZiL6yKMy742c9nnh7ACQf0j_tRCCfs/edit |
| **Lives in** | this app's own Drive folder (already correctly placed — not root) |
| **App finds it via** | ScriptProperty `MINUTES_DB_SPREADSHEET_ID` |
| **Tabs** | Minutes (metadata), Content (HTML body chunked at 45k chars) |

This is the **only** database. It is the sole source of truth — meeting content
is created/edited directly in-app (Docs-as-source-of-truth sync was retired
2026-07-19) and never re-imported from Google Docs.

## Transient files

- None. The app does not create export/temp Drive files.

## Duplicates / orphans

- None found. Exactly one sheet is related to this app.

## Safety note

`getDb_()` was hardened on 2026-07-04: if `MINUTES_DB_SPREADSHEET_ID` won't open it
now **throws loudly** instead of silently creating a blank replacement (which would
orphan the real data). Live since @43.
