# Status: FRONTEND PREVIEW ONLY — backend pending

**App:** VCB Connect Portal
**Stack:** React 18 + TypeScript (strict) + Vite

## What this is

The **frontend only** — the screens, ported from the Google Apps Script app with
the original CSS reused verbatim. It runs and looks complete, but the data is
**mock**: `src/mockBackend.ts` keeps the announcement and admin state in
`localStorage`. Nothing is shared between visitors.

## What is NOT here yet

A backend. The app tile list is still hardcoded in `src/data.ts`, and the
announcement lives only in the browser that set it.

## To make it fully functional

`supabase/schema.sql` in this folder turns both into real tables — see
`supabase/MIGRATION.md`. Note the portal should be migrated **last**, because
every tile points at another app's URL and must keep doing so until each of
those apps has actually moved.

## Source of truth

The canonical app is the Google Apps Script project in `../ORIGINAL CODE/`. This
folder is a downstream mirror — see `PORT_NOTES.md` for what it does and does
not cover.

## Run locally

```sh
npm install && npm run dev   # http://localhost:5173
```

Deploy: Vercel, Root Directory = this folder, framework Vite.
