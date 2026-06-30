# Status: FRONTEND PREVIEW ONLY — backend pending

**App:** SOP (Standard Operating Procedure)
**Stack:** React 18 + TypeScript (strict) + Vite

## What this is
The **frontend only** (the screens/UI), ported from the Google Apps Script demo.
It runs and looks complete, but the data is **mock/sample data** — see
`src/data/sop.json` and `src/lib/api.ts`. **Nothing is saved** (no real database,
no login, no persistence).

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
