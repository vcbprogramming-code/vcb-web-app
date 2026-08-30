# VCB Connect

One company portal for VCB Group (vcb-con.com), made of modules that are
developed separately but ship as one website.

> **New here? Read [START-HERE.md](START-HERE.md) first.** It explains what this
> is, the two-folder layout, which apps are live, and the traps that are not
> obvious from the code.

Then **[ARCHITECTURE_STANDARD.md](ARCHITECTURE_STANDARD.md)** for the app
inventory, database ids, and the rules everyone follows.

## Structure

Every module has the same two folders, and nothing else:

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

| Module | Folder | Live data store |
|---|---|---|
| Portal (the launcher) | `portal/` | none |
| Credit Facility | `credit-facility/` | Google Sheet |
| System Map | `system-map/` | none |
| SOP | `sop/` | Google Doc + ScriptProperties |
| HR Work Log | `hr-worklog/` | Google Sheet |
| Meeting Minutes | `meeting-minutes/` | Google Sheet + Drive attachments |
| Onboarding | `onboarding/` | Google Sheet |
| E-Memo | `ememo/` | handed to an external developer |

## Editing an app

Work in `ORIGINAL CODE/`, then from that same folder:

```sh
clasp pull    # ALWAYS first — someone may have edited in the browser
# make changes
clasp push    # overwrites the live code with your local files
```

`clasp push` updates code only — the live `/exec` URL keeps serving its current
version until you create a new deployment, so pushing mid-day is safe.

Portal has no `.clasp.json` on purpose, so it cannot be pushed to by accident.

## ⚠ Never copy, move or delete a `.gscript` or `.gsheet` file

They are not shortcuts — each **is** the live Apps Script project or Spreadsheet.
Copying one makes Drive create a new empty project; deleting one trashes the real
thing. Both happened on 2026-08-30. Relocate them only by moving them in File
Explorer within the synced folder.

## Running the React side

`node_modules/` is not kept in this tree. In any `FOR DEPLOYMENT TEAM/` folder:

```sh
npm install && npm run dev
```

All seven build clean (`npm run build`, TypeScript included).

## Known gap

**Theme fragmentation.** All modules ship light *and* dark, but each implements it
differently — four different CSS selectors, five `localStorage` keys, and only
HR Work Log follows the OS setting. Under one domain they share an origin, so a
user's choice will not follow them between modules. Token names and palettes
differ too. `hr-worklog` is the model to converge on.
