# VCB System Operating Map — React port

A pixel-faithful React rebuild of the VCB System Operating Map (v8.86), a
standalone Google Apps Script single-file web app. It mirrors the canonical
`Index.html` screen-for-screen: the swimlane operating-map diagram (10 lanes /
79 nodes / 129 cross-lane connections), the site document-flow strip, the
right-hand node/document detail sidebar, the collapsible legend, the L0
progressive-disclosure overview (stage + supporting-function cards with an
Orientation / AI Opportunity / Management audience toggle), the focus/linear
trace mode, and the searchable function registry (8 departments / 158
functions), with full TH/EN i18n.

Self-contained and deployable to Vercel on its own. See **PORT_NOTES.md** for
the canonical→React file mapping and the re-sync workflow.

## Stack

- Vite + React 18 + TypeScript (strict)
- No UI library — original CSS reused **verbatim** (`src/styles.css`)
- Typed, static data layer — every constant from the original `<script>`
  block, transcribed programmatically for byte-for-byte fidelity (see
  PORT_NOTES.md for the extraction method)

## Develop

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck    # tsc --noEmit (strict)
npm run build         # tsc -b && vite build  → dist/
npm run preview       # serve the production build
```

## Deploy to Vercel

Static SPA — Framework preset **Vite**, build `npm run build`, output `dist`.
The whole app ships client-side from the bundled data; no server required.

## Layout

```
src/
  App.tsx                 top-level shell: TopBar + map area + sidebar + overlays
  store.tsx                useStore() — state + handlers (mirror of Index.html's
                            module-level `let`s and handler functions)
  styles.css                VERBATIM extract of Index.html <style>
  data/    types · depts · lanes · crossConns · docNodes · modules · aiOpps ·
           functionRegistry · langTh · nodeFn · functionOwner · functionHide ·
           functionLoc · functionDept2 · aiRegistryFns · fieldActCodes ·
           functionAi · deptMeta · stages · support · index (barrel)
  lib/     derived (NODE_INDEX/CONN_FROM/CONN_TO) · i18n (tNode/tDoc/tLane/tUI/tDept/esc)
  components/
    TopBar             brand banner + header (layer/direct/indirect/dept filters,
                        functions/AI/lang buttons)
    Lanes               swimlane + node rendering, selection dim/highlight
    SvgEdges            cross-lane arrow overlay (DOM-measurement-based routing,
                        ported verbatim from drawArrows())
    DocsLayer           site document-flow strip
    Sidebar             node/doc detail — tabs + connections pane
    Legend               collapsible map key
    Overview             L0 stage/support cards + audience mode + stage crumb
    FocusTrace           linear in/out trace view (tree-layout algorithm ported
                        verbatim from openFocus())
    FunctionRegistry      searchable function table by department + site-only filter
```
