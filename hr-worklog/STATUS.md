# Status: FRONTEND PREVIEW ONLY — backend pending

**App:** HR Work Log
**Stack:** React 18 + TypeScript (strict) + Vite

## What this is
The **frontend only** (the screens/UI), ported from the Google Apps Script demo
with the original CSS reused verbatim. It runs and looks complete, but the data
is **mock/sample data** — see `src/mock.ts`. **Nothing is saved** (no real
database, no login, no persistence).

## What's NOT here yet
A **backend** — a server + database to actually store entries, handle logins, and
enforce rules. Editing in the UI updates local state only and is lost on refresh.

## To make it fully functional, later
Pick one:
1. **Reuse the Google Apps Script backend** — point the React app's data calls at
   the GAS `/exec` endpoint (keep the same data shapes in `src/types.ts`).
2. **Build a real backend** (Node + a database such as Supabase) — the way the
   E-Memo app (`backend/` + `supabase/`) is built.

## Source of truth
The canonical app is the **Google Apps Script** project (`Code.gs`). This React
folder is a downstream mirror — see `PORT_NOTES.md`.

## Run locally
```sh
npm install && npm run dev   # http://localhost:5173
```
Deploy: Vercel, Root Directory = this folder, framework Vite.
