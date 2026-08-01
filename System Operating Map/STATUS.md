# Status: FRONTEND PREVIEW ONLY — no backend, none needed

**App:** System Operating Map
**Stack:** React 18 + TypeScript (strict) + Vite

## What this is
The **frontend only** (the screens/UI), ported from the standalone Google
Apps Script `Index.html` (v8.86). Unlike some sibling ports in this repo,
this app has **no write path at all in the original** — it is a pure,
read-only operating-map / data browser (swimlane diagram, function registry,
focus/trace view). There is no mock API layer to eventually swap for a real
one; the entire app is the bundled static data plus client-side view state
(selected node, active filters, language, open overlays, etc.), same as the
canonical app.

## What's NOT here
Nothing is missing functionally — every render path, filter, toggle, and
overlay from the canonical `Index.html` v8.86 is ported (see PORT_NOTES.md
for the full file mapping and two intentionally-preserved dead-code notes:
the L0 overview screen and the focus-layer detail panel are both unreachable
in the *canonical* app too, not just this port).

If the underlying business process data ever needs to change (new lanes,
nodes, connections, function-registry entries, AI opportunities, Thai
translations, etc.), that requires editing `src/data/*.ts` directly — there
is no CMS or backend to edit it through, same as the original (which required
editing the inline `<script>` block).

## To make it "fully functional," later
This app doesn't need a backend to be functional — it already is. The only
things that would meaningfully extend it:
1. **A CMS/admin layer over `src/data/*.ts`** if non-engineers need to edit
   the operating-map content without a code change + redeploy.
2. **Deep-linking** (e.g. `?node=n-open` or `?stage=s-win` query params) if
   sharing a link directly into a specific node/stage/function becomes a
   requirement — not present in the canonical app either.

## Source of truth
The canonical app is the standalone Google Apps Script `Index.html` file
(`E:\WORK\08 CLAUDE CODE\System Map App\Index.html`, v8.86). This React folder
is a downstream mirror — see `PORT_NOTES.md` for the sync history and file
mapping.

## Run locally
```sh
npm install && npm run dev
```
Deploy: Vercel, Root Directory = this folder, framework Vite.
