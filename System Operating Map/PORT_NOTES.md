# PORT_NOTES — React mirror of the System Operating Map

This folder is a **downstream mirror** of the canonical app. Source of truth =
the standalone Google Apps Script `Index.html` (v8.86) + `Code.js` `doGet()`
wrapper at `E:\WORK\08 CLAUDE CODE\System Map App\Index.html` (this repo does
not track a live `script.google.com` deployment the way some sibling ports
document one — there is no separate `Code.js` file alongside `Index.html` in
the source folder; the app is fully self-contained in the one HTML file, and
`Code.js`/`doGet()` is only referenced here because that's the standard GAS
wrapper pattern this file is deployed with).

- **Last synced from:** the standalone `Index.html` (v8.86 · Jun 2026),
  2026-08-01.
- **Stack:** Vite + React 18 + TypeScript (strict). No UI library (original
  has none).
- **Data layer:** typed, **verbatim** transcription of every top-level `const`
  in the original `<script>` block — no backend, no mock/seed distinction
  (unlike `sop/`, this app has no write path at all; it's a pure data browser).
  Extracted programmatically (balanced-bracket scan of the original script +
  `vm` evaluation + `JSON.stringify`) rather than hand-retyped, to guarantee
  byte-for-byte fidelity on ~450KB of dense data (Thai text included).

## File mapping (canonical → React)

| Canonical (Index.html)                                   | React port                              |
|------------------------------------------------------------|------------------------------------------|
| `<style>` block (lines 8–430) **verbatim**                | `src/styles.css`                          |
| `DEPTS`                                                    | `src/data/depts.ts`                       |
| `LANES` (10 lanes / 79 nodes)                              | `src/data/lanes.ts`                       |
| `CROSS_CONNS` (129 edges)                                  | `src/data/crossConns.ts`                  |
| `DOC_NODES` (7)                                            | `src/data/docNodes.ts`                    |
| `MODULES`                                                  | `src/data/modules.ts`                     |
| `AI_OPPS` (35)                                              | `src/data/aiOpps.ts`                      |
| `FUNCTION_REGISTRY` (8 depts / 158 rows)                    | `src/data/functionRegistry.ts`            |
| `LANG_TH` (incl. the separately-assigned `LANG_TH.registry`, 141 entries — see note below) | `src/data/langTh.ts` |
| `NODE_FN` (79)                                              | `src/data/nodeFn.ts`                      |
| `FUNCTION_OWNER` (16)                                       | `src/data/functionOwner.ts`               |
| `FUNCTION_HIDE` (empty Set)                                 | `src/data/functionHide.ts`                |
| `FUNCTION_LOC` (25)                                         | `src/data/functionLoc.ts`                 |
| `FUNCTION_DEPT2` (empty object)                             | `src/data/functionDept2.ts`               |
| `AI_REGISTRY_FNS` (60)                                       | `src/data/aiRegistryFns.ts`               |
| `FIELD_ACT_CODES` (18)                                       | `src/data/fieldActCodes.ts`               |
| `FUNCTION_AI` (108)                                           | `src/data/functionAi.ts`                  |
| `DEPT_META`                                                  | `src/data/deptMeta.ts`                    |
| `STAGES` (5)                                                  | `src/data/stages.ts`                      |
| `SUPPORT` (4)                                                 | `src/data/support.ts`                     |
| shared shapes (implicit in the untyped JS literals)           | `src/data/types.ts`                       |
| barrel re-export                                               | `src/data/index.ts`                       |
| `NODE_INDEX` / `CONN_FROM` / `CONN_TO`                          | `src/lib/derived.ts`                      |
| `tNode`/`tDoc`/`tLane`/`tUI`/`tDept`/`esc`                       | `src/lib/i18n.ts`                         |
| `state` (module-level `let`s) + all handler functions            | `src/store.tsx` (`useStore`)               |
| Brand banner + `.app-header` (layer/direct/indirect/dept filters, functions/AI/lang buttons) | `src/components/TopBar.tsx` |
| `renderLanes()` / `buildNode()` / `highlightConnections()` (node half) | `src/components/Lanes.tsx` (exports `connectedSet()`) |
| `drawArrows()` / `highlightConnections()` (arrow half)          | `src/components/SvgEdges.tsx`              |
| `buildDocNode()` (site docs strip)                               | `src/components/DocsLayer.tsx`             |
| `.map-legend` markup + collapse toggle                            | `src/components/Legend.tsx`                |
| `showSidebar()`/`buildConnectionsPane()`/`showDocSidebar()`/`closeSidebar()` | `src/components/Sidebar.tsx` |
| `renderOverview()`/`openStage()`/`setAudience()`/`aiCountForLanes()`/`allStages()`, `#l1Crumb` | `src/components/Overview.tsx` (exports `StageCrumb`, `allStages`) |
| `fEdges()`/`openFocus()`/`renderFocusDetail()`/`hlFocusEdges()`/`clrFocusEdges()` | `src/components/FocusTrace.tsx` |
| `openRegistry()`/`closeRegistry()`/`buildFnTabs()`/`getFnBadge()`/`renderRegistry()`/`filterFunctions()`/`toggleSiteOnly()` | `src/components/FunctionRegistry.tsx` |
| `syncHeaderHeight()` + tail wiring (resize/Escape/body-class listeners) | `App.tsx` |

## Behaviour parity notes

- **`<body>` classes** the CSS keys off (`layer-erp`/`layer-manual`,
  `hide-direct`/`hide-indirect`, `sb-open`, `ai-mode`, `focus-armed`,
  `aud-orient`/`aud-ai`/`aud-mgmt`) are set by effects in `App.tsx`, exactly
  as the imperative original did via scattered `classList.toggle()` calls.
- **`--header-h` CSS var** is kept in sync with the actual rendered
  brand-banner + header height (both wrap at narrow widths) via a
  `useLayoutEffect` + resize listener in `App.tsx`, mirroring
  `syncHeaderHeight()`.
- **`LANG_TH.registry` is a separate, later assignment** in the canonical
  script (`LANG_TH.registry = {...}` at line 1105, not part of the initial
  `const LANG_TH = {...}` literal at line 972) — merged into one `LangTh`
  object here so the type is total; if the source LANG_TH ever changes, both
  the initial literal AND this later assignment need re-extracting.
- **`showOverview()`/`backToOverview()` are unreachable in the shipped v8.86**:
  `#ovLayer` renders with the `ov-hidden` class present in the static markup,
  and nothing in the header/banner/anywhere else calls `showOverview()` —
  only `renderOverview(); setAudience('orient');` run at load, which build
  the content but never remove `ov-hidden`. The L0 overview screen therefore
  never becomes visible in the canonical app. This is ported faithfully:
  `Overview.tsx` and all its handlers (`openStage`, `setAudience`,
  `clearFocusStage`, `showOverview`, `backToOverview`) are fully implemented
  and wired in the store, but `overviewOpen` defaults to `false` (matching
  what actually renders) and nothing currently sets it to `true` — same as
  source. Not a bug fix, not a feature removal — a faithful mirror of dead
  wiring already present in v8.86.
- **The focus/trace layer's side detail panel is dead code in the source,
  also faithfully NOT rendered here**: the original defines
  `renderFocusDetail()` and a `.focus-detail` CSS rule, but
  `renderFocusDetail()` is never called anywhere in the script, and the
  static markup for `#focusLayer` has no `.focus-main`/`#focusDetail`
  wrapper — only `.focus-scroll > .focus-canvas`. `FocusTrace.tsx` keeps a
  ported (but intentionally unused/unrendered) `FocusDetail` component for
  reference, matching the source's actual behavior of never showing it.
- **`aiAll` reference bug in the original `renderRegistry()`**: the source's
  stats line reads `...+(showAiMode?' · '+aiAll+' with AI opps':''`) where
  `aiAll` is never declared anywhere in the script — toggling AI mode while
  the registry is open would throw a `ReferenceError` in the original.
  `FunctionRegistry.tsx` computes the equivalent count properly
  (`Object.values(FUNCTION_REGISTRY).flat().filter(f => FUNCTION_AI[f[0]]).length`)
  instead of reproducing the crash — the only place this port deliberately
  fixes rather than mirrors a source defect, since mirroring it would mean
  shipping a guaranteed runtime crash on a normal user action.
- **`<style>` is verbatim** — never hand-edit `src/styles.css`; re-extract
  lines 8–430 of `Index.html` if the source CSS changes.
- **Data extraction method**: all `src/data/*.ts` files were generated (not
  hand-transcribed) via a balanced-bracket scan of the original `<script>`
  block, evaluated in a Node `vm` sandbox, then `JSON.stringify`'d — this
  guarantees the transcription is byte-exact (verified via independent grep
  counts on both source and generated files: 10 lanes / 79 nodes / 129
  cross-connections / 7 doc nodes / 8 function-registry departments / 158
  function rows / 108 AI-opportunity function entries / 141 Thai registry
  translations, all matching source exactly). If the source data ever
  changes, re-run the same extraction approach rather than hand-editing the
  generated files.

## Re-sync checklist

1. `<style>` changed → re-extract `Index.html` lines 8–430 → `src/styles.css`.
2. Any data `const` changed → re-run the extraction (balanced-bracket scan +
   `vm` eval + `JSON.stringify`) for that constant → the matching
   `src/data/*.ts` file. Remember `LANG_TH.registry` is a separate
   assignment, not part of the initial `LANG_TH` literal.
3. A render/handler function changed → update the matching component /
   `src/store.tsx`.
4. Bump **Last synced from** above.
