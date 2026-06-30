# Status: FRONTEND PREVIEW ONLY — backend pending

**App:** VCB Connect (the portal / home page)
**Stack:** React + TypeScript + Vite

## What this is
The **frontend only** for the VCB Connect home page — the hub users land on and
navigate from to the other apps (E-Memo, HR Work Log, Meeting Minute, SOP, Credit
Facility). Data is **mock/sample data** — see `src/mockBackend.ts` / `src/data.ts`.
**Nothing is saved** (no real login, no persistence).

## What's NOT here yet
A **backend** — most importantly **authentication / single sign-on** (one login
that carries across all the apps) and the real links/permissions to each live app.
Right now the tiles/navigation use placeholder data.

## To make it fully functional, later
1. **Add real auth (SSO)** so a single login works across every VCB app — ideally a
   shared auth service the other apps also use.
2. **Wire each tile** to the deployed URL of its app, gated by the user's permissions.
3. Back it with a real database/server (e.g. Node + Supabase) like the E-Memo app.

## Source of truth
The canonical app is the **Google Apps Script** project. This React folder is a
downstream mirror — see `PORT_NOTES.md`.

## Run locally
```sh
npm install && npm run dev
```
Deploy: Vercel, Root Directory = this folder, framework Vite.
