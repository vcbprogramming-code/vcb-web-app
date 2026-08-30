# Status: REFERENCE IMPLEMENTATION for the dev handoff — not itself the final app

**App:** Meeting Minute
**Stack:** React 18 + TypeScript (strict) + Vite

## What this is, and why it exists
Google Apps Script (the project one level up) is the **owner's personal sandbox** —
where the app's behavior is designed and validated first, throwaway once the real
product exists. This React folder is a **faithful spec/reference implementation**
of that behavior — every screen, every interaction, every data shape — for a
developer to pick up on GitHub and build the actual product from: their own real
backend, deployed independently (e.g. Vercel), with no ongoing dependency on Apps
Script. Apps Script will be **abandoned** once that real app exists.

Because of that, this folder is intentionally **never wired to call the live Apps
Script backend** — that would be a bridge to a system about to be retired. Its data
is mock/sample data (`src/api/mock.ts` / `src/api/seed.ts`) purely so every screen
is fully interactive and demonstrable; the mock's job is to prove the *shape and
behavior* are right, not to persist anything real.

## The actual bar for "done" here
Not "connected to real data" — **parity with the live Apps Script app.** Every
feature a user can do in the live app should have a corresponding, correctly
modeled equivalent here (down to exact field names, exact interaction flow), so
the developer is never left reverse-engineering a missing feature from the Apps
Script UI. See `PORT_NOTES.md` for the full GAS→React mapping and its "Last
synced" log — that's the checklist for verifying parity after any Apps Script change.

## What the eventual real app needs (out of scope here, the developer's job)
A real backend — server + database to actually store meetings/minutes, handle
logins, and enforce rules for the ACTUAL production deployment. This folder's
mock (`src/api/mock.ts`) documents the exact API contract (`src/types.ts`'s
`ServerApi`) that real backend should implement — swap `src/api/client.ts`'s
mock-backed calls for real HTTP calls against it once it exists.

## Source of truth for behavior
The **Google Apps Script** project (one directory up) is where new behavior is
built and proven first. This folder must be re-synced after any GAS change —
see `PORT_NOTES.md`.

## Run locally
```sh
npm install && npm run dev
```
Deploy (as a standalone preview, not the final app): Vercel, Root Directory =
this folder, framework Vite.
