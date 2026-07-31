# PORT_NOTES — React mirror of the SOP web app

This folder is a **live mirror** of the canonical app. Source of truth =
`../index.html` (UI) + `../apps-script/Code.gs` (server contract) + `../data/sop.json`
(seed data). After **any** change to those, re-sync the affected piece here.

- **Last synced from:** the live `script.google.com` deployment **@76** (2026-07-31).
  Brought in everything shipped since `@69`: **report-row creation**
  (`createReport()` — "+ เพิ่มรายงานใหม่" button + `NewReportModal.tsx`, admin-only,
  appended to `reports[]`, no server-assigned id — the `case` number is caller-
  supplied), the **NotebookLM link button** in the Reports detail header
  (`notebookLM` i18n key, `externalLink` icon — both were missing from this port
  entirely, predating its last sync), and a rewrite of the **steps authoring
  model** shared by `EditModal.tsx`/`NewScenarioModal.tsx`/`DetailPane.tsx` via
  the new `src/lib/steps.ts`: steps are now one of **numbered** ("N. text" —
  typed digit is only a signal, the CSS counter still drives the displayed
  number), **sub-bullet** ("» text" / "» » text", depth = repeat count, now
  supports a 3rd tier beyond the original 2), or **caption** ("· text", no
  number, no bullet — new). The textarea itself uses plain-keyboard syntax
  (a number, `>`, or `>>` at line start) converted to/from storage at the
  component boundary, so nobody needs to type or paste `»` by hand.
  `src/data/sop.json`'s existing top-level steps were migrated (literal "N. "
  prepended by position) so this rewrite doesn't silently un-number 31
  scenarios' worth of existing mock content — mirrors the same one-time
  migration run against the live Doc (`renumberAllSteps_()` in `Code.js`).
- **Earlier sync (@69, 2026-07-26):** **createScenario()**
  Hand-synced with everything shipped since build 26: **createScenario()**
  ("+ เพิ่มกรณีใหม่" button + modal, admin-only, server assigns `no`), **dateAdded**
  field on `Scenario` (Thai-formatted, stamped on create, shown under the ref footer),
  the edit-modal backdrop-click fix, **per-module running numbers** (`displayNo`,
  computed fresh from row order, never stored), **multi-module tagging**
  (`extraModules`) with a stable primary-first sort in filtered lists and a
  lighter-toned `.lc-badge-tag` on list cards (not a detail-header chip — that was
  tried and reverted for cluttering/misaligning the header), **swap** two cases'
  content/position (`swapScenarioPositions`), **delete** a case (`deleteScenario`,
  admin-only, lives inside the Edit modal footer, custom confirm dialog rather than
  native `confirm()`), and the case-detail header layout redesign (top-aligned
  badge/title/Edit button regardless of title wrapping).
- **Architecture note:** the canonical app is now **one-way** — Doc is a backup
  copy, never read back into the app (no `syncFromDoc` trigger, and as of `@69`
  no `syncFromDoc()` function at all — it was deleted, not just disconnected).
  **This port DID need a real code change for this**, contrary to what an earlier
  note here claimed: this mock's Settings modal had an actual live "Sync from Doc"
  button wired to a working `doSync()` → mock `syncFromDoc()` in `src/lib/api.ts`.
  It went unnoticed through one docs-sync pass because a docs-only pass doesn't
  necessarily re-audit every component for dead affordances. Removed end-to-end
  (2026-07-26, pushed to `VCB-dev`): the button in `SettingsModal.tsx`, `doSync()`/
  `syncing` state in `store.tsx`, `syncFromDoc()` in `lib/api.ts`, the `menuSync`
  i18n keys in `data/config.ts`, and the orphaned `gear-spin` CSS animation.
  **Lesson for future syncs:** when the canonical app removes a feature, grep this
  port's `src/` for the feature's name/handler — don't assume "the mock never
  talked to the Doc so there's nothing to remove." A UI affordance can still be
  live and clickable even if its backing call was always fake.
  There is still no real database anywhere in this stack — the mock's in-memory
  `store` is the only persistence, same as before.
- **Stack:** Vite + React 18 + TypeScript (strict). No UI library (original has none).
- **Data layer:** typed **mock** mirroring the REST contract (see `src/lib/api.ts`),
  seeded from `src/data/sop.json` (copy of `../data/sop.json`) + the 33 bundled flows.
  To wire a real backend instead, replace the functions in `src/lib/api.ts` with
  calls to whatever server ends up fronting the data (see the canonical app's
  `Code.js` for the write-path contract: `createScenario`/`editScenario`/
  `swapScenarioPositions`/`deleteScenario`). A PostgreSQL schema + full data export
  of the canonical app's content exists at the repo root of the SOP Web App project
  (`DATABASE_SCHEMA.sql` / `DATABASE_DATA.sql`) if a Postgres-backed rewrite is the
  direction chosen.

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
| `#editBg` + `openEditModal()` + `doSave()`/`doSwap()`/`doDelete()`/`showConfirm()` | `src/components/EditModal.tsx` (module select, swap-with field, delete button + confirm dialog all live here) |
| `#editBg` (create mode) + `openNewScenarioModal()`   | `src/components/NewScenarioModal.tsx` |
| `#reportBg` + `openNewReportModal()` + `doSaveReport()` | `src/components/NewReportModal.tsx` |
| `renderExtraModuleChecks(primaryMod, checked)`        | `src/components/ExtraModuleChecks.tsx` (shared by Edit + New-case modals) |
| `#settingsBg` + `updateSettingsModal()` + `copyEmail()` | `src/components/SettingsModal.tsx` (no Sync action — removed from the canonical app, see architecture note above) |
| `stepsToStorage()`/`stepsFromStorage()`/`stepDepth()` (textarea ⇄ storage conversion) | `src/lib/steps.ts` (shared by EditModal/NewScenarioModal/DetailPane) |
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

## Verified (headless Chromium via Playwright, this port)

build ✓ · typecheck ✓ · welcome/home ✓ · Case Studies 31 cards + detail/steps/ref ✓ ·
Reports 21-row table ✓ · Process Flows list (33 flows / 8 module groups) ✓ ·
flow diagram nodes+lanes+**SVG edges**+legend+narrative ✓ · dark theme ✓ ·
EN language ✓ · mobile single-pane (`is-mobile` ≤768px) ✓ · New case create ✓ ·
per-module displayNo recompute after edit/swap/delete ✓ · multi-module tag +
stable sort in filtered lists ✓ · tag badge in list cards (all views) ✓ · swap
two cases ✓ · delete with custom confirm dialog (no native `confirm()`) ✓ ·
case-detail header alignment at mobile viewport (390×844) ✓.

## Re-sync checklist

1. `<style>` changed → re-extract `index.html` lines 33–692 → `src/styles.css`.
2. `SOP_FLOWS` changed → re-extract the array → `src/data/flows.ts` (keep the typed export header).
3. `I18N`/`MODULES`/`MODULE_INFO`/`CHANGELOG`/`APP_VERSION` changed → update `src/data/config.ts`.
4. `data/sop.json` changed → copy to `src/data/sop.json`.
5. A render/handler changed → update the matching component / `store.tsx`.
6. Bump **Last synced from** above.
