# Status: FRONTEND PREVIEW ONLY — backend pending

**App:** Credit Facility
**Stack:** React + TypeScript + Vite

## What this is
The **frontend only** (the screens/UI), ported from the Google Apps Script demo.
It runs and looks complete, but the data is **mock/sample data** — see `src/mock/`.
**Nothing is saved** (no real database, no login, no persistence).

## What's NOT here yet
A **backend** — a server + database to actually store records, handle logins, and
enforce rules. Edits update local state only and are lost on refresh.

## To make it fully functional, later
Pick one:
1. **Reuse the Google Apps Script backend** — `src/gas.ts` is already set up to call
   a GAS endpoint; point it at the live `/exec` URL and switch off the mock layer.
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
