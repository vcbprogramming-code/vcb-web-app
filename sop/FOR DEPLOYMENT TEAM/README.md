# FOR DEPLOYMENT TEAM — React + TypeScript

A pixel-faithful React rebuild of the VCB-MANGO ERP Standard Operating Procedure
web app. It mirrors the live Apps Script app in
[`../ORIGINAL CODE/`](../ORIGINAL%20CODE/) screen-for-screen: **Process Flows**
(33 swimlane diagrams), **Case Studies** (31 scenarios), and **Reports**
(21-row table), with full TH/EN i18n, light/dark themes, mobile single-pane
navigation, search, an admin edit flow, and the settings panel.

> **This is not what serves users today.** Production is the Apps Script app in
> `../ORIGINAL CODE/`. This port exists so the app can move off Apps Script when
> the team is ready. It is re-synced by hand and lags — check the sync marker in
> **PORT_NOTES.md** before assuming a feature exists here.

## Frontend and backend

This app is **frontend-only today**. There is no server: `src/lib/api.ts` is a
typed mock over an in-memory copy of `src/data/sop.json`, so edits look real but
are lost on reload. That is deliberate — it lets the whole UI be reviewed and
deployed as a static site before any backend exists.

| Layer | Where | Status |
|---|---|---|
| **Frontend** | `src/` — components, store, styles, icons | ✅ complete |
| **Backend** | `src/lib/api.ts` (mock) | ⚠️ mock only — see *Wire the real backend* below |

The mock deliberately mirrors the real `google.script.run` contract call-for-call,
so swapping it for `fetch` against a real API is a change to one file.

## Stack

- Vite + React 18 + TypeScript (strict)
- No UI library — original CSS reused **verbatim** (`src/styles.css`)
- Typed **mock** data layer mirroring the Apps Script server contract
  (`src/lib/api.ts`), seeded from `src/data/sop.json` + the 33 bundled flows

## Develop

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck    # tsc --noEmit (strict)
npm run build        # tsc -b && vite build  → dist/
npm run preview      # serve the production build
```

## Deploy to Vercel

Static SPA — Framework preset **Vite**, build `npm run build`, output `dist`.
The whole app ships client-side from the bundled mock data; no server required.

## Wire the real backend (optional)

The mock in `src/lib/api.ts` mirrors three endpoints exactly:

| function                 | endpoint            |
|--------------------------|---------------------|
| `getSopDataForClient()`  | `GET  /api/data`    |
| `syncFromDoc()`          | `POST /api/sync`    |
| `editScenario(payload)`  | `POST /api/scenario`|

Replace those three with `fetch` calls against whatever backend you stand up,
and add a Vite dev proxy to it.

> An Express/TypeScript backend used to live in this repo. It was **removed on
> 2026-08-30**: it predated this React port, nothing imported it, and it had
> drifted eight builds behind production, so keeping it around only invited
> someone to deploy the wrong thing. Recover it from git if you want it as a
> starting point:
> `git show 0a6be92:"for deploy team/src/server.ts"`

## Layout

```
src/
  App.tsx                 three-pane shell + modals
  store.tsx               useStore() — state + handlers (mirror of index.html `state`)
  styles.css              VERBATIM extract of index.html <style>
  data/   types · config (i18n/modules) · flows (33) · sop.json
  lib/    api (mock) · icons
  components/  TopBar · Sidebar · ListPane · DetailPane · FlowDiagram · EditModal · SettingsModal
```
