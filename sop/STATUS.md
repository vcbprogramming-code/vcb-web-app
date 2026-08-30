# Status: FRONTEND PREVIEW ONLY — backend pending

**App:** SOP (Standard Operating Procedure)
**Stack:** React 18 + TypeScript (strict) + Vite

## What this is
The **frontend only** (the screens/UI), ported from the Google Apps Script demo.
It runs and looks complete, but the data is **mock/sample data** — see
`src/data/sop.json` and `src/lib/api.ts`. **Nothing is saved** (no real database,
no login, no persistence).

## Latest sync (2026-08-29) — @116

Brought up from @82: full-screen edit/create modals, per-file attachment rows
(name + URL, replacing `Label | URL` pipe syntax), a grouped swap dropdown, and
a CSS re-extract carrying the dark-mode contrast fixes plus the iPad layout fix
(the attachments rail was crushing the case text to 334px at 1366px). See
`PORT_NOTES.md` for the detail, including the one thing that cannot work here:
the Drive filename auto-fill needs a server this port doesn't have.

## Earlier sync (2026-08-25)
Mirrors the live Apps Script app at **@101**. Adds the **Related Files** rail:
each case can carry reference files (the 31 SOP flow-diagram PDFs), rendered as
Drive preview thumbnails in a fixed-width column beside the case body. Links
only — the app never uploads or stores a file, which deliberately avoids the
`drive` OAuth scope whose absence had been silently hanging every save.

`src/data/sop.json` was re-exported from the live app in the same pass. The
previous snapshot had drifted badly — **29 of 31 cases** carried a different
display number, title, or both. Treat that file as a point-in-time snapshot,
never as truth: re-export from the live app's `/exec?dump=1` before relying on
case numbering.

## What's NOT here yet
A **backend** — a server + database to actually store SOPs/flows, handle logins,
and enforce rules. Edits update local state only and are lost on refresh.

> Note: only the React preview (`react-preview/` in the source project) was
> pushed here. The SOP source project also has a separate root-level server
> (`src/server.ts`, `Dockerfile`) that is NOT included — add it as its own
> backend folder later if needed.

## To make it fully functional, later
Pick one:
1. **Reuse the Google Apps Script backend** — point the React app's data calls
   (`src/lib/api.ts`) at the GAS `/exec` endpoint, keeping the same data shapes.
2. **Build a real backend** (Node + a database such as Supabase) — the way the
   E-Memo app (`backend/` + `supabase/`) is built.

## Source of truth
The canonical app is the **Google Apps Script** project. This React folder is a
downstream mirror — see `PORT_NOTES.md`.

## Run locally
```sh
npm install && npm run dev
```
Deploy: Vercel, Root Directory = this folder, framework Vite.
