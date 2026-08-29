# PORT_NOTES — React mirror of the SOP web app

This folder is a **live mirror** of the canonical app. Source of truth =
`../index.html` (UI) + `../apps-script/Code.gs` (server contract) + `../data/sop.json`
(seed data). After **any** change to those, re-sync the affected piece here.

- **Last synced from:** the live `script.google.com` deployment **@116** (2026-08-29).

  **@82→@116 pass.** The mirror could *display* attachments but had no way to edit
  them, and the edit modal was still the old 780px box. Transplanted piece by piece
  rather than copying the folder — this mirror carries `ExtraModuleChecks.tsx`,
  `NewScenarioModal.tsx` and `STATUS.md` that the source repo's `react-preview/`
  does not, and a wholesale copy would have destroyed them.
  - **Full-screen edit + create modals.** `.modal-full` shell, two-column `.mf-grid`
    body, ปัญหา/หมายเหตุ fixed and ขั้นตอน on `.ta-fill` absorbing the remainder.
    อ้างอิง moved into the left metadata column to match canonical field order.
    **`.ta-fill` must stay a grid row** — making it a flex column inherits
    `align-items:start` from `.modal .row` and packs the textarea to its content
    width, which is a bug that shipped three times upstream before it was understood.
  - **Attachment editing** — new `src/components/AttachmentRows.tsx` (name + URL +
    delete per file). `attachments` added to `ScenarioEdit`/`ScenarioCreate` and to
    the `editScenario`/`createScenario` mocks; without that the field had nowhere to
    round-trip. Wired into **both** `EditModal.tsx` and `NewScenarioModal.tsx`.
  - **Swap target is a grouped `<select>`**, not free text (canonical @93, never
    mirrored). Added the `swapPick` i18n key, which was missing here entirely — `t()`
    is typed `(key: string) => any`, so it would have rendered blank with no error.
  - **CSS re-extracted verbatim** (758 → 907 lines). Brings the dark-mode contrast
    fixes (flow Start/End pills were 1.06:1 — invisible) **and the iPad layout fix**:
    the attachments rail stacked only below 1180px, so at 1366px it still took a hard
    238px and the case title wrapped one word per line. It now stacks below 1600px as
    a compact chip strip, and the body grid gained a 1440px step.

  **The Drive filename auto-fill is inert here.** `getDriveFileName()` exists and is
  wired, but always resolves `{name:''}` — reading Drive metadata needs an
  authenticated server call, this port has no server, and the browser can't fetch it
  directly. That is also the real function's failure shape, and the caller already
  treats it as "leave the field alone", so the editor degrades to manual typing. The
  guards around it are fully ported: a row locks the moment the admin types in it, a
  stored label is never overwritten, and the async handler re-checks the lock, the
  name, and that the URL hasn't changed mid-flight.

  **Verified:** typecheck ✓ · build ✓ · attachment helpers unit-tested (12 assertions)
  · i18n parity checked by importing the compiled config (85 keys each side).
  **Not browser-verified** — no headless tooling available in that environment.

  Previous marker: **@82** (2026-08-06).
  Brought in everything shipped since `@77`: **shareable direct links** — a
  Share button (`ShareButton` in `DetailPane.tsx`) on both case-study and
  process-flow detail views copies a URL (`?case=N` / `?flow=ID`, built by
  `buildShareUrl()` in `store.tsx` from `window.location.origin+pathname`
  since there's no server to inject an `appUrl` the way `doGet` does) that
  jumps straight to that item on load. Resolved client-side in `store.tsx`'s
  `resolveInitialTarget()`/`initialNav()` (mirrors `openInitialCase()` +
  `SOP_META.initialCase`/`initialFlow`): `?case=N` must match a real scenario,
  `?flow=ID` falls back to the normal landing view if it doesn't resolve —
  same intent as canonical's server-validated-case/client-validated-flow
  split, just both done client-side here since this mock has no real backend
  distinction to preserve. Also ported: `copyText()` (`src/lib/copy.ts`,
  races the Clipboard API against a 600ms timeout before falling back to
  `execCommand('copy')` — strictly safer than a bare `writeText()` call even
  though this port isn't hosted inside Apps Script's sandboxed iframe where
  the hang was originally observed), which `ShareButton` and `SettingsModal.tsx`'s
  `copyEmail()` both now route through instead of each having their own
  clipboard fallback code. **Mobile layout:** Share/Edit move from the detail
  title row into the sticky back-bar (`.mback-row` wraps the back button + a
  `#mbackDetailActions` slot) on mobile only — done via a `createPortal` in
  `DetailPane.tsx` (`DetailActions`) rather than the canonical's imperative
  `moveDetailActionsMobile()` DOM-node relocation, since React re-renders
  instead of moving nodes; desktop keeps the buttons inline in `.d-head`,
  unchanged. Desktop sidebar/case-list column widths also widened ~1cm
  (`styles.css`, `.body` grid-template-columns) to match the @75–77 catch-up.
  **Not ported** (server-only, no client-visible behavior — see the
  architecture note below): Drive backup snapshots (`backupToDrive_`), the
  one-time `renumberAllSteps_()` migration, and the `?migrate=1` debug
  endpoint.
- **Earlier sync (@76, 2026-07-31):** Brought in everything shipped since `@69`:
  **report-row creation**
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
- **Architecture note (Drive backups, @78–82):** canonical's `backupToDrive_()`
  (a timestamped JSON snapshot dropped into a Drive folder after every
  mutation, for recovery independent of the Doc/Cache/Properties), the
  one-time `renumberAllSteps_()` migration, and the `?migrate=1` debug
  endpoint are all **server-only** — no client-visible behavior, nothing for
  the UI to render or call. This is a mock/preview React app with no real
  backend (`src/lib/api.ts`), so there's nothing meaningful to port here;
  intentionally not mirrored. If a real backend is ever wired in (see the
  Data layer note above), that would be the place to add an equivalent
  snapshot/backup step, not this app's `src/`.
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
| `copyText()` (Clipboard API race + `execCommand` fallback) | `src/lib/copy.ts` (`copyText()`, Promise-based; used by `ShareButton` and `SettingsModal.tsx`'s `copyEmail()`) |
| `shareLink()`/`shareCase()`/`shareFlow()`            | `buildShareUrl()` in `src/store.tsx` + `ShareButton` in `src/components/DetailPane.tsx` |
| `openInitialCase()` + `SOP_META.initialCase`/`initialFlow` (deep-link init) | `resolveInitialTarget()`/`initialNav()` in `src/store.tsx` (reads `window.location.search` directly — no server bootstrap payload to inject into) |
| `.mback-row`/`#mbackDetailActions` + `moveDetailActionsMobile()` | `DetailActions` (a `createPortal`) + `MBackDetail` in `src/components/DetailPane.tsx` — React re-renders the buttons into the portal target instead of literally relocating DOM nodes |

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

**@77–82 pass (Share links + mobile action-bar move):** `npm run build` and
`tsc --noEmit` both pass cleanly — no browser (headless or otherwise) was
available in this pass, so none of the following were visually confirmed,
only traced through by reading the code: the Share button copying a working
`?case=N`/`?flow=ID` URL and flashing "Link copied"; a `?case=N`/`?flow=ID`
link actually landing on the right item on load (`resolveInitialTarget()`/
`initialNav()`); the portal correctly relocating Share/Edit into the mobile
back-bar (`DetailActions`/`#mbackDetailActions`) versus staying inline in
`.d-head` on desktop; and the `.mback-row`/`.d-edit.copied` CSS rendering as
intended in both themes. Treat this pass as code-reviewed and type/build-clean,
not click-tested — worth a manual pass (or a Playwright session) before
treating the mobile layout or the copy-to-clipboard flash as confirmed.

## Re-sync checklist

1. `<style>` changed → re-extract `index.html` lines 33–692 → `src/styles.css`.
2. `SOP_FLOWS` changed → re-extract the array → `src/data/flows.ts` (keep the typed export header).
3. `I18N`/`MODULES`/`MODULE_INFO`/`CHANGELOG`/`APP_VERSION` changed → update `src/data/config.ts`.
4. `data/sop.json` changed → copy to `src/data/sop.json`.
5. A render/handler changed → update the matching component / `store.tsx`.
6. Bump **Last synced from** above.
