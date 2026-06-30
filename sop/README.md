# VCB-MANGO ERP SOP — React port

A pixel-faithful React rebuild of the VCB-MANGO ERP Standard Operating Procedure
web app. It mirrors the canonical app (`../index.html` + `../apps-script/Code.gs`)
screen-for-screen: **Process Flows** (33 swimlane diagrams), **Case Studies**
(31 scenarios), and **Reports** (21-row table), with full TH/EN i18n, light/dark
themes, mobile single-pane navigation, search, an admin edit flow, and the
settings panel.

Self-contained and deployable to Vercel on its own. See **PORT_NOTES.md** for the
canonical→React file mapping and the re-sync workflow.

## Stack

- Vite + React 18 + TypeScript (strict)
- No UI library — original CSS reused **verbatim** (`src/styles.css`)
- Typed **mock** data layer mirroring the GAS/Express REST contract
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

Replace those three with `fetch` calls and add a Vite dev proxy to the Express
server (`../src/server.ts`, default `:3000`) to run against live data.

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
