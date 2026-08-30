# VCB Connect

One company portal for VCB Group (vcb-con.com), made of modules that are
developed separately but ship as one website.

## Structure

Every module has the same two folders:

| Folder | What it is | Status |
|---|---|---|
| `ORIGINAL CODE/` | Google Apps Script — plain JavaScript, no build step. | 🟢 **LIVE — this is what users see** |
| `FOR DEPLOYMENT TEAM/` | React 18 + TypeScript (Vite) port. Backend is a typed mock. | ⚪ not deployed yet |

> **Edit `ORIGINAL CODE/` for anything real.** `FOR DEPLOYMENT TEAM/` is a
> downstream mirror that gets synced afterwards — read its `PORT_NOTES.md`
> before assuming a feature exists there.

In Apps Script there is no frontend/backend split: the backend is the `api_*`
functions and the frontend is the HTML served from the same file. That is why
these folders are flat rather than split into `frontend/` + `backend/`.

## Modules

| Module | Folder |
|---|---|
| Portal (the launcher/shell) | `portal/` |
| Credit Facility | `credit-facility/` |
| System Map | `system-map/` |
| SOP | `sop/` |
| HR Work Log | `hr-worklog/` |
| Meeting Minutes | `meeting-minutes/` |
| Onboarding | `onboarding/` |
| E-Memo | `ememo/` |

## Shared

| Folder | What it is |
|---|---|
| `platform/` | Node/Express API + React SPA + 23 Supabase migrations. Shared infrastructure with real auth/roles — **not a module**. |
| `shared/` | Cross-module design tokens and theme controller (see Known issues). |
| `docs/` | Architecture standards and setup notes. |

## A note on `frontend/` and `backend/`

No module has its own `frontend/` or `backend/` folder, and that is deliberate —
in Apps Script the backend is the `api_*` functions and the frontend is the HTML
served from the same file, so the split cannot exist.

Copies of the platform app previously sat inside `portal/`, `meeting-minutes/`
and `ememo/`. They were migration debris, not module code, and have been removed.
The one real backend lives in `platform/`. The copy found under `ememo/` turned
out to be **newer** than the one installed as `platform/` (23 migrations vs 17,
plus an action-level permissions system, PDF merging, and a reorganised admin
UI); it was promoted, and the older tree is archived in the backup folder.

## Known issues

**Theme fragmentation.** All modules ship light *and* dark, but each implements
it differently — four different CSS selectors (`html[data-theme]`, `body.dark`,
`html.theme-dark`, `html.dark`), five different `localStorage` keys, and only
HR Work Log supports `auto` (follow-OS). Under one domain they share an origin,
so a user's choice will not follow them between modules. `hr-worklog` has the
most complete implementation — use it as the model when converging into
`shared/`.

**Design tokens differ.** Token names and palettes are unrelated between modules
(`--brand` vs `--accent` vs `--blue`; navy `#1F3864` vs `#0b3d62`). They will not
look like one website until this is unified.

## Local setup

`node_modules/` is not kept in this tree. In any `FOR DEPLOYMENT TEAM/` folder:

```sh
npm install && npm run dev
```
