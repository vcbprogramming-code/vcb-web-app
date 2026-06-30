# Status: FRONTEND PREVIEW ONLY — backend pending

**App:** Meeting Minute
**Stack:** React 18 + TypeScript (strict) + Vite

## What this is
The **frontend only** (the screens/UI), ported from the Google Apps Script demo.
It runs and looks complete, but the data is **mock/sample data** — see
`src/api/mock.ts` / `src/api/seed.ts`. **Nothing is saved** (no real database,
no login, no persistence).

## What's NOT here yet
A **backend** — a server + database to actually store meetings/minutes, handle
logins, and enforce rules. Edits update local state only and are lost on refresh.

## To make it fully functional, later
Pick one:
1. **Reuse the Google Apps Script backend** — point the React app's data calls
   (`src/api/client.ts`) at the GAS `/exec` endpoint, keeping the same data shapes.
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
