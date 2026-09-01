# VCB Connect — React port

A pixel-faithful **React + TypeScript (Vite)** replica of the VCB Connect intranet
portal. The canonical app is the Google Apps Script (GAS) project at the repository
root (`Code.js`, `index.html`, `appsscript.json`); this subfolder mirrors it and is
deployable to Vercel on its own.

> The GAS project is the source of truth. This folder is a **live mirror** — after any
> change to the GAS source it is re-synced. See [PORT_NOTES.md](PORT_NOTES.md) for the
> file-by-file mapping and last-synced version.

## Stack

- React 18 + TypeScript (strict)
- Vite 5
- No UI library (the original has none — all styling is the GAS `<style>` block reused verbatim)
- Typed **mock backend** ([src/mockBackend.ts](src/mockBackend.ts)) mirroring the GAS
  `google.script.run` API contracts, persisting to `localStorage`. No real server is
  required for visual/UX sign-off.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173 (Vite picks the next free port if taken)
```

Other scripts:

```bash
npm run typecheck  # tsc --noEmit (strict)
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
```

## Using it

- **Language toggle:** click the globe mark (top-left) to switch EN ⇄ TH. The choice
  persists per device.
- **Admin / announcement:** the gear icon is hidden by default — append `?admin=1` to
  the URL to reveal it (e.g. `http://localhost:5173/?admin=1`). First unlock sets the
  admin password (stored as a SHA-256 hash in `localStorage`); subsequent unlocks
  verify it. The announcement is persisted in `localStorage` and re-shows for everyone
  when re-published (fresh `id`).
- **User chip:** the mock `getActiveUserEmail` returns `''` by default → the public
  **Guest** state (matches `ANYONE_ANONYMOUS` access). Set `DEMO_EMAIL` in
  [src/mockBackend.ts](src/mockBackend.ts) to a real address to see the formatted-name
  state a signed-in same-domain visitor would get.

## Deploy to Vercel

This folder is self-contained. From the Vercel dashboard import the repo and set the
**Root Directory** to `vcb-connect-react`, or from the CLI:

```bash
cd vcb-connect-react
vercel            # framework + build are pre-set in vercel.json
```

The mock backend runs entirely in the browser, so the deployed site is fully functional
for demo without any server. To wire a real backend, replace the implementations in
`src/mockBackend.ts` (the exported signatures are the contract).

## Layout

```
vcb-connect-react/
├── index.html            Vite entry (loads src/main.tsx; <html class="js"> gates reveal)
├── src/
│   ├── main.tsx          React root
│   ├── App.tsx           Portal screen: topbar, banner, hero, apps grid, footer + all logic
│   ├── AdminModal.tsx    Admin unlock + announcement editor (styled inline confirm)
│   ├── Globe.tsx         Pure-CSS 3D globe markup
│   ├── icons.tsx         Line-art SVG icons
│   ├── data.ts           APPS list + EN/TH I18N dictionary (verbatim from GAS)
│   ├── mockBackend.ts    Typed mirror of the GAS server API (localStorage-backed)
│   ├── types.ts          Models mirroring the GAS API shapes
│   └── index.css         The GAS <style> block, extracted verbatim — do not hand-edit
├── vercel.json
├── tsconfig.json
└── PORT_NOTES.md         Sync ledger: GAS ↔ React mapping + last-synced version
```
