# PORT_NOTES — React mirror of the SOP web app

This folder is a **live mirror** of the canonical app. Source of truth =
`../index.html` (UI) + `../apps-script/Code.gs` (server contract) + `../data/sop.json`
(seed data). After **any** change to those, re-sync the affected piece here.

- **Last synced from:** `index.html` @ `APP_VERSION = 'build 26 · 2026-06-03'`
  (`../apps-script/Code.gs` server contract: getSopDataForClient / syncFromDoc / editScenario).
- **Stack:** Vite + React 18 + TypeScript (strict). No UI library (original has none).
- **Data layer:** typed **mock** mirroring the REST contract (see `src/lib/api.ts`),
  seeded from `src/data/sop.json` (copy of `../data/sop.json`) + the 33 bundled flows.
  To wire the real Express backend (`../src/server.ts`) instead, replace the three
  functions in `src/lib/api.ts` with `fetch('/api/data')`, `fetch('/api/sync',{method:'POST'})`,
  `fetch('/api/scenario',{method:'POST',…})` and add a Vite dev proxy to `:3000`.

## File mapping (canonical → React)

| Canonical (index.html / Code.gs)                     | React port                          |
|------------------------------------------------------|-------------------------------------|
| `<style>` block (lines 33–692) **verbatim**          | `src/styles.css`                    |
| `SOP_FLOWS` array (33 flows) **verbatim**            | `src/data/flows.ts`                 |
| `BOOTSTRAP` shape / `data/sop.json`                  | `src/data/sop.json` + `src/data/types.ts` |
| `MODULES`, `MODULE_INFO`, `MODULES_EN`, `I18N`, `CHANGELOG`, `APP_VERSION`, `DEV_*` | `src/data/config.ts` |
| `ICONS` map + `svgIcon()` / `renderIcons()`          | `src/lib/icons.tsx` (`<Icon/>`)     |
| `google.script.run` / REST `API` helper              | `src/lib/api.ts` (mock)             |
| `state` object + all `select*`/`set*`/`do*` handlers | `src/store.tsx` (`useStore`)        |
| Banner markup + `updateUserPill`                     | `src/components/TopBar.tsx`         |
| `buildSidebar()` + `setActiveSidebar()`              | `src/components/Sidebar.tsx`        |
| `renderList()` + `renderFlowList()`                  | `src/components/ListPane.tsx`       |
| `renderDetail()` + `placeholder()` + `stepsHtml()`   | `src/components/DetailPane.tsx`     |
| `diagramHtml/flowLegendHtml/narrativeHtml/layoutFlowEdges` | `src/components/FlowDiagram.tsx` |
| `#editBg` + `openEditModal()` + `doSave()`           | `src/components/EditModal.tsx`      |
| `#settingsBg` + `updateSettingsModal()` + `copyEmail()` | `src/components/SettingsModal.tsx` |
| `<head>` mobile-detection / pref IIFE                | `index.html` head + `src/store.tsx` effects |

## Behaviour parity notes

- **`<html>`/`<body>` classes** that the CSS keys off (`dark`, `is-mobile`,
  `reports-mode`, `m-list`, `m-detail`, sidebar `flows-open`/`cs-open`) are set by
  effects in `useStore()` / `Sidebar.tsx`, exactly as the imperative original did.
- **localStorage keys preserved:** `sop-night`, `sop-lang`, `sop-default-view`.
- **Admin:** the mock "signs in" the canonical admin email by default so the Edit
  affordances are visible for sign-off. Call `setSession(false)` in `src/lib/api.ts`
  to preview the anonymous (read-only) experience.
- **Intentionally omitted dead code:** `flowPlaceholder()` in the original is never
  called (`renderFlowDetail` uses `placeholder()`); not ported. No behaviour change.
- **`<style>` is verbatim** — never hand-edit `src/styles.css`; re-extract lines
  33–692 of `index.html` if the source CSS changes.

## Verified (headless Edge, this port)

build ✓ · typecheck ✓ · welcome/home ✓ · Case Studies 31 cards + detail/steps/ref ✓ ·
Reports 21-row table ✓ · Process Flows list (33 flows / 8 module groups) ✓ ·
flow diagram nodes+lanes+**SVG edges**+legend+narrative ✓ · dark theme ✓ ·
EN language ✓ · mobile single-pane (`is-mobile` ≤768px) ✓.

## Re-sync checklist

1. `<style>` changed → re-extract `index.html` lines 33–692 → `src/styles.css`.
2. `SOP_FLOWS` changed → re-extract the array → `src/data/flows.ts` (keep the typed export header).
3. `I18N`/`MODULES`/`MODULE_INFO`/`CHANGELOG`/`APP_VERSION` changed → update `src/data/config.ts`.
4. `data/sop.json` changed → copy to `src/data/sop.json`.
5. A render/handler changed → update the matching component / `store.tsx`.
6. Bump **Last synced from** above.
