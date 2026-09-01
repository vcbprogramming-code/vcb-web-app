# Port notes

The React app is a 1:1 port of `../ORIGINAL CODE/`, now converted to the VCB
Connect stack (see `../../TECH_STACK.md`). This file records only the places
where a 1:1 port was **not possible**, and what was done instead — so nobody
spends a day rediscovering why.

## Stack conversion (TypeScript → JavaScript, CSS → Tailwind)

**All TypeScript is gone.** 35 `.ts`/`.tsx` files became `.js`/`.jsx`;
`tsconfig.json`, `tsconfig.tsbuildinfo`, `typescript` and `@types/*` were
deleted, `vite.config.ts` became `vite.config.js`, and Vite went 6 → 5.

**`src/data/types.ts` has no successor.** It held only interfaces and type
aliases — declarations that describe shapes the data literals already have.
Nothing survives type erasure, so the file is deleted rather than translated
into an empty module. The shapes are documented in prose where they are read
(`src/lib/derived.js`).

**`src/styles.css` (388 lines) became Tailwind utilities**, except the list kept
in `src/index.css`. Three things could not become utilities and must stay:

1. **Body-class cross-cutting filters** (`body.layer-erp`, `body.hide-direct`,
   `body.ai-mode`, `.lanes-wrap.dept-active`, `body.aud-*`, …). These dim or
   hide elements *elsewhere in the tree* from a class on `<body>` — a descendant
   selector rooted outside the component, which a utility class on one element
   cannot express. `SvgEdges` also reads these exact class names back off the
   DOM to decide which connectors to dim, so renaming them breaks the arrows.
2. **Node geometry and imperatively-created elements.** `.fnode`, `.fedge` and
   the registry row cells are built with `createElement`, not JSX, so they carry
   classes rather than utilities.
3. **`::after` content** (the `■ EXIT` terminal marker) and **`:empty`** (the
   trace breadcrumb collapsing when there is no trail) — no utility form exists.

The old rule "never hand-edit `styles.css`, re-extract it" is retired with the
file. Styling now lives on the elements.

## Providers: theme and i18n only — deliberately no auth

`src/main.jsx` wires `ThemeProvider` and `I18nProvider`. It does **not** wire
`AuthProvider`, and that is a decision, not an omission:

- This module stores nothing. There is no API client, no `fetch`, no database.
  `supabase/README.md` says the same thing from the data side.
- Nothing in it is role-gated. The only match for "role" in the entire source
  was `role="button"` — an ARIA attribute on a clickable span.
- Every user sees the same map, so an auth wrapper would add a login wall in
  front of a page with nothing to protect and nothing to fetch.

If access control is ever wanted, it belongs on the portal tile that links here.

**No `BrowserRouter` either.** The app is one view. What look like separate
screens — the L0 overview, the trace overlay, the function registry — are
overlays over the same map, toggled by store state, not addressable routes.

## Two dictionaries, on purpose

- `src/i18n.js` is the **UI chrome** — buttons, tabs, column headings, hints —
  as stable dot keys with `{ th, en }` pairs, per the shared i18n contract.
- `src/data/langTh.js` is the **map content** — Thai for ~1,000 node, lane,
  document and registry records, keyed by each record's own id. `src/lib/
  mapLang.js` reads it (the old `src/lib/i18n.ts`, renamed so it is not confused
  with the shared module).

Re-keying the content as dot keys would mean ~1,000 keys mirroring a structure
the data already has, keyed by the same ids. It stays as it is.

`lang` was removed from the store: language is now portal-wide shared state
(one `vcb_lang` key across all modules), read from `useI18n()`.

## Untranslated Thai — the reverse of hr-worklog's problem

hr-worklog's conversion found Thai strings with no dictionary entry, rendering
Thai to English readers. **This module had the opposite defect**: every Thai
string was correctly paired with English, but roughly 45 UI strings existed
**only in English** and rendered English to Thai readers even with the language
set to Thai. The whole L0 overview, the whole trace overlay, six of the eight
legend rows, the sidebar empty state, and most tooltips were English-only.

All of them now have Thai. They are marked `NEW-TH` in `src/i18n.js`. Every
pre-existing Thai string was carried over byte-for-byte from `LANG_TH.ui`.

Verified by rendering the entire tree in both languages: **0 chrome strings
render Thai to an English reader, and 0 render English to a Thai reader.** Eight
Thai runs remain in the English render and are correct — the bilingual brand
subtitle, and six Mango ERP module names (`รับวางบิล`, `ตั้งหนี้`, `ใบลดหนี้`, …)
whose Thai *is* the system's terminology.

## Behaviour differences from the original

**One source defect is fixed rather than mirrored.** Opening the AI-function
count while the registry is open throws a `ReferenceError` in the original.
`FunctionRegistry.jsx` computes the count properly. This is the only place the
port corrects rather than copies, because mirroring it would mean shipping a
guaranteed crash on a normal user action.

**`FocusDetail` is now deleted, not merely unrendered.** The previous port kept
it "in case the feature is wanted later". It could never have rendered: the
canonical `renderFocusDetail()` is never called from anywhere, and the focus
layer's markup has no `.focus-main`/`#focusDetail` container to hold it. Keeping
a component that cannot mount only invites someone to assume it works.

**`dangerouslySetInnerHTML` and the `esc()` helper are gone.** The original built
sidebar text and registry rows as HTML strings passed through a hand-written
escaper. React escapes text children on its own, so rows and panes are real JSX
and the focus-layer boxes are built with `textContent`. Same output, one less
way to inject markup.

**The brand link now points at `/`** instead of a hardcoded
`script.google.com/.../exec` URL. That URL is the old Apps Script deployment,
which this migration replaces; point it at the portal's real route at deploy
time if `/` is not correct for the final hosting layout.

## Diagram rendering

No chart library was present and none was added — `TECH_STACK.md` forbids them.
Both diagrams are hand-written SVG and stay that way:

- `SvgEdges.jsx` — the cross-lane connector router. Measures rendered node rects
  and draws `<path>` elements: corridor routing for direct flows, orthogonal
  routing with fan-out for indirect ones.
- `FocusTrace.jsx` — the linear-trace tree. Columns are hop distance from the
  focused node, rows are packed greedily, with a separate router for feedback
  edges.

Both stay imperative because each is a measure-then-paint pass: the geometry is
only knowable after layout, so it cannot be expressed as JSX in the same commit.
