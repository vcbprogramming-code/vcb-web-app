# PORT_NOTES — React mirror of the SOP web app

This folder is a **live mirror** of the canonical app. Source of truth =
`../ORIGINAL CODE/apps-script/index.html` (UI) + `../ORIGINAL CODE/apps-script/Code.js`
(server contract). After **any** change to those, re-sync the affected piece here.

- **Last synced from:** `apps-script/index.html` + `apps-script/Code.js` @ production **@116** (2026-08-29)

  **@116 — iPad/medium-width layout fix**, mirrored here by re-extracting `styles.css`:
  the attachments rail stacked only below 1180px, so at 1366px (iPad Pro landscape) it still
  took a hard 238px and the case title wrapped one word per line. The rail now stacks below
  **1600px** as a compact chip strip (filename + file glyph, no thumbnail), and the
  sidebar/list grid gained a 1440px step — without it a 1280px window read *worse* than a
  1024px one. Reading column at 1366px: **334px → 624px**.

  **@82→@115 pass** — the port had drifted badly (it could *display* attachments but had
  no way to edit them, and the modal was still the old 780px box). Brought over:
  - **Full-screen edit modal.** `.modal-full` shell + two-column `.mf-grid` body, ปัญหา/หมายเหตุ
    at fixed heights and ขั้นตอน on `.ta-fill` absorbing the remainder. The field order was
    also changed to match canonical: อ้างอิง moves up into the left metadata column.
    **`.ta-fill` must stay a grid row** — see `../ORIGINAL CODE/DESIGN.md`; making it a flex column
    inherits `align-items:start` and packs the textarea to its content width.
  - **Attachment editing** — new `src/components/AttachmentRows.tsx`. The canonical builds
    rows imperatively and tracks "the admin named this" with a `data-named` DOM attribute;
    here that is `named` on a typed `AttachmentRow`, which is the same contract stated the
    way React would. Rows carry a `key` counter rather than using array indices, so deleting
    a middle row doesn't reshuffle the ones below it. Also added `attachments` to
    `ScenarioEdit`/`ScenarioCreate` and to the `editScenario`/`createScenario` mocks —
    without that the field had nowhere to round-trip to.
  - **Swap target is a `<select>`, not a text input** (canonical @93, missed at the time) —
    grouped by module, titles truncated to 42 chars with the full text on the option's
    `title`. Added the `swapPick` i18n key, which was missing from this port entirely;
    `t()` is typed `(key: string) => any`, so it would have silently rendered nothing.
  - **CSS re-extracted verbatim** (759 → 874 lines), which also brings the dark-mode contrast
    fixes: flow Start/End pills were `#16284a` on `#1c2d4a` (**1.06:1**, invisible), the
    Related-Files heading 1.49:1, links 3.57:1.
  - `APP_VERSION` and `CHANGELOG` re-synced from canonical (was still `build 26 · 2026-06-03`).

  **Deliberately NOT mirrored: the Drive filename lookup actually works.**
  `getDriveFileName()` exists in `src/lib/api.ts` and is wired into the UI, but it always
  resolves `{name:''}` — reading Drive metadata needs an authenticated server call, this
  port has no server, and the browser can't fetch it directly (no permissive CORS on Drive
  file metadata). `{name:''}` is also exactly what the real function returns for an
  unresolvable file, and the caller already treats that as "leave the field alone", so the
  editor degrades to manual typing with no error path. **Everything else about the feature
  is real** — the guards, the paste/blur triggers, the never-overwrite contract.

  Previous sync marker for reference: **@82** (2026-08-06)
  (server contract: `getSopDataForClient` / `editScenario` / `createScenario` / `createReport` / `swapScenarioPositions` / `deleteScenario` —
  `syncFromDoc`/`removeSyncTrigger`/`installSyncTrigger` no longer exist anywhere; the Doc is a write-only backup, never read back).
  This pass (@71→@82) added:
  - **`createReport`** admin feature — a "+ New report" flow (`NewReportModal.tsx`, mirroring `EditModal.tsx`'s
    create-case flow) to add a row to the Reports table. Mock: `createReport()` in `src/lib/api.ts`.
  - **Numbered/sub/caption steps model** — `Scenario.steps[]` entries are now one of `"N. text"` (numbered
    top-level step), `"» text"`/`"» » text"` (sub-bullet, depth = repeat count), or `"· text"` (plain caption,
    no marker). New `src/lib/steps.ts` (`stepsToStorage`/`stepsFromStorage`/`classifyStep`) is the single
    conversion boundary, shared by `EditModal.tsx`'s textarea and `DetailPane.tsx`'s `<Steps/>` renderer.
    Old un-migrated seed content (bare lines, no literal number) still renders correctly — `classifyStep()`
    falls through to `kind: 'numbered'` when there's no leading digit, same as the canonical parser/renderer.
  - **Shareable direct links** — a Share button on case-study and process-flow detail views copies a
    `?case=N` / `?flow=ID` URL. Since this port has no real server to inject `SOP_META.appUrl`/`initialCase`/
    `initialFlow`, the equivalent is built entirely client-side: `buildShareUrl()` in `store.tsx` uses
    `window.location.origin + pathname`, and `resolveInitialTarget()` (also `store.tsx`) parses
    `window.location.search` once at boot (mirrors `openInitialCase()`), taking priority over the saved
    default view exactly like the canonical `if (!openedFromShareLink) applyDefaultView()`. New
    `src/lib/copy.ts` (`copyText`) ports the Clipboard-API-vs-600ms-timeout race verbatim.
  - **Mobile layout: Share/Edit relocated off the title row.** `DetailPane.tsx`'s `MBackDetail` renders a
    `.mback-row` wrapping the back button + an `#mbackDetailActions` div; a callback ref exposes that div as
    a portal target, and a new `<DetailActions/>` wrapper component renders its children inline in the title
    row on desktop, or via `createPortal()` into the back-bar slot when `s.isMobile`. This is a React-native
    reinterpretation of the canonical's imperative `moveDetailActionsMobile()` DOM-move — same visual result,
    idiomatic to this codebase instead of copying the DOM-manipulation approach.
  - Desktop sidebar/list column widths widened (~1cm each): `.body{grid-template-columns:324px 418px 1fr}`
    (was `286px 380px 1fr`), extracted verbatim into `styles.css`.
  - **Drive backup snapshots, `renumberAllSteps_`, `?migrate=1`** are server-only Apps Script additions with
    NO client-visible behavior — intentionally NOT mirrored here, same treatment as every other server-only
    change in this port (e.g. the Doc-sync severance).
  Earlier pass (@70, still current): `displayNo`, `extraModules` (multi-module tagging + list-card badges that
  always show a case's own tags, never flip to its primary module), `dateAdded`, the NotebookLM report-view
  link, and full admin CRUD (create/edit/swap/delete a case). `APP_VERSION` string itself is unchanged
  (`build 26 · 2026-06-03`) — only the data/CRUD/i18n surface drifted.
- **Stack:** Vite + React 18 + TypeScript (strict). No UI library (original has none).
- **Data layer:** typed **mock** mirroring the Apps Script server contract (see
  `src/lib/api.ts`), seeded from `src/data/sop.json` + the 33 bundled flows.
  `src/data/sop.json` is now the **only** copy in the repo — the duplicate that fed
  the old Express port was removed with it on 2026-08-30. Refresh it from live with
  `curl "<exec-url>?dump=1" -o src/data/sop.json`.
  To wire a real backend, replace the three functions in `src/lib/api.ts` with
  `fetch` calls and add a Vite dev proxy to it.

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
| `addAttachmentRow`/`setAttachmentRows`/`readAttachmentRows`/`maybeFillAttachmentName` | `src/components/AttachmentRows.tsx` |
| `fillSwapOptions()`                                   | `swapGroups` in `src/components/EditModal.tsx` |
| `getDriveFileName(url)`                               | `getDriveFileName()` in `src/lib/api.ts` (**stub — always `{name:''}`**) |
| `#reportBg` + `openNewReportModal()` + `doSaveReport()` | `src/components/NewReportModal.tsx` |
| `#settingsBg` + `updateSettingsModal()` + `copyEmail()` | `src/components/SettingsModal.tsx` |
| `<head>` mobile-detection / pref IIFE                | `index.html` head + `src/store.tsx` effects |
| `stepsToStorage`/`stepsFromStorage`/`stepDepth`      | `src/lib/steps.ts` (`stepsToStorage`/`stepsFromStorage`/`classifyStep`) |
| `copyText()`                                          | `src/lib/copy.ts` (`copyText`)      |
| `shareLink()`/`shareCase()`/`shareFlow()`             | `ShareButton` in `src/components/DetailPane.tsx` + `buildShareUrl()` in `src/store.tsx` |
| `openInitialCase()` / `SOP_META.initialCase/initialFlow` | `resolveInitialTarget()` in `src/store.tsx` (parses `window.location.search` client-side; no server to inject from) |
| `.mback-row` / `#mbackDetailActions` / `moveDetailActionsMobile()` | `MBackDetail`/`DetailActions` (`createPortal`) in `src/components/DetailPane.tsx` |

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
- **Share links use `window.location`, not a server-injected URL.** The canonical
  app injects `SOP_META.appUrl` from `ScriptApp.getService().getUrl()` server-side
  because it runs inside Apps Script's sandboxed iframe, where `location.href` is
  the sandbox's own URL, not the shareable one. This port isn't sandboxed, so
  `buildShareUrl()` just reads `window.location.origin + pathname` directly —
  functionally equivalent, no server round-trip needed.
- **`?case=N` and `?flow=ID` are both validated client-side** (`resolveInitialTarget()`
  in `store.tsx`), unlike the canonical split (server validates `?case=N` against
  parsed Doc data; `?flow=ID` is client-validated only, since flows are static
  data). This mock has no server-parsed data to differ from, so both go through
  the same client-side lookup — same end behavior (bad id → normal placeholder).
- **Attachment auto-fill is wired but inert.** The name field pre-fills from the Drive
  filename in the canonical app; here `getDriveFileName()` always resolves `{name:''}`
  (no server — see the sync note above), so the field simply stays empty and is typed by
  hand. The *guards* are fully ported and are the part that matters: a row locks the moment
  the admin types in it, a stored label is never overwritten, and the async handler
  re-checks the lock, the name, **and** that the URL hasn't changed mid-flight.
- **Mobile action relocation is a portal, not a DOM move.** The canonical
  `moveDetailActionsMobile()` imperatively re-parents `.d-edit` button DOM nodes
  from `.d-head` into `#mbackDetailActions`. React can't/shouldn't do that —
  `DetailActions` in `DetailPane.tsx` instead renders its children via
  `createPortal()` into the back-bar slot when `s.isMobile`, or inline in the
  title row otherwise. Same visual result, idiomatic to a React codebase.

## Verified (headless Edge, this port)

build ✓ · typecheck ✓ · welcome/home ✓ · Case Studies 31 cards + detail/steps/ref ✓ ·
Reports 21-row table ✓ · Process Flows list (33 flows / 8 module groups) ✓ ·
flow diagram nodes+lanes+**SVG edges**+legend+narrative ✓ · dark theme ✓ ·
EN language ✓ · mobile single-pane (`is-mobile` ≤768px) ✓ · admin create/edit/swap/delete ✓.

**@82→@115 pass — typecheck ✓ / build ✓ / logic-tested, NOT browser-verified.**
`npm run typecheck` and `npm run build` both pass clean. The attachment helpers were
unit-tested against the same cases as the canonical implementation (12 assertions: storage→rows,
rows→storage, a real label locking the row, a legacy bare-URL label reading as empty and
staying unlocked, blank rows dropped, whitespace trimmed, the `driveFileId` gate), and the
save path was exercised end-to-end through the API mock (6 assertions, including that
*omitting* `attachments` leaves them alone while an empty array clears them). i18n key
parity was checked by importing the compiled config: 86 keys each side, none missing.
**Not verified in a browser** — no headless tooling in this environment — so the full-screen
modal's *appearance* (column balance, whether ขั้นตอน really fills the leftover height) is
unconfirmed here. Open `npm run dev`, edit a case, and check the layout plus adding/removing
attachment rows.

**@71→@82 pass — NOT browser-verified.** `npm run build` and `npm run typecheck`
both pass cleanly (zero errors/warnings), and `classifyStep()`/`stepsToStorage()`/
`stepsFromStorage()` were sanity-checked against sample inputs (numbered/sub/
sub-sub/caption lines, plus old un-migrated bare-line seed data) via a throwaway
Node script — logic confirmed correct. But the new admin "+ New report" modal,
the Share button's copy-to-clipboard flow, the `?case=N`/`?flow=ID` deep-link
boot path, and the mobile back-bar portal relocation have **not** been exercised
in an actual browser — this environment has no Playwright/headless-browser
tooling available. Treat as logically-verified-but-visually-unverified until
someone opens `npm run dev` (or `npm run preview` after `npm run build`) and
clicks through: Share on a case + a flow, the mobile view at ≤768px width, and
Reports → "+ New report" as an admin.

## Known gap vs. live production

The mock seed (`src/data/sop.json`, copied from `../data/sop.json`) has every
scenario's `extraModules: []` — the *real* live tag data (e.g. which cases are
actually cross-tagged into a second module) lives only in the Apps Script
project's server-side cache, populated from the Google Doc, and isn't
reachable from this repo. The badge/tagging *code path* is fully ported and
correct; it just has nothing to render against in the mock until real tags are
hand-added to the seed or a live data pull is wired in.

## Re-sync checklist

1. `<style>` changed → re-extract `index.html` lines 33–692 → `src/styles.css`.
2. `SOP_FLOWS` changed → re-extract the array → `src/data/flows.ts` (keep the typed export header).
3. `I18N`/`MODULES`/`MODULE_INFO`/`CHANGELOG`/`APP_VERSION` changed → update `src/data/config.ts`.
4. `data/sop.json` changed → copy to `src/data/sop.json`.
5. A render/handler changed → update the matching component / `store.tsx`.
6. Steps textarea/storage/render convention changed → update `src/lib/steps.ts`
   (shared by `EditModal.tsx` and `DetailPane.tsx` — don't duplicate the logic).
7. Attachment editing changed → update `src/components/AttachmentRows.tsx` (the pure
   helpers `attachmentsToRows`/`rowsToAttachments` are the storage boundary — keep them
   in step with `writeAttachments_` in `Code.js`).
8. A new `google.script.run` callable appeared → add a mock to `src/lib/api.ts` **and**
   say so in the header contract list; if it can't work without a server, make it return
   the real function's failure shape rather than faking success.
9. Bump **Last synced from** above.
