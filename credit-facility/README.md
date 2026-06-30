# VCB Credit Facility — React mirror

A self-contained **Vite + React + TypeScript (strict)** port of the canonical
Google Apps Script web app that lives in the **project root** (`Code.js`,
`Seed.js`, `index.html`). Deployable to **Vercel** on its own.

> The Apps Script project is the **source of truth**. This folder is a live
> mirror — see [PORT_NOTES.md](PORT_NOTES.md) for the mapping and re-sync steps.

## Run

```bash
cd react
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc --noEmit (strict)
npm run build      # tsc --noEmit && vite build  → dist/
npm run preview    # serve the production build
```

## Deploy to Vercel

Static SPA — no server needed (the backend is a typed mock, below).

- **Root directory:** `react`
- **Framework preset:** Vite
- **Build command:** `npm run build` · **Output dir:** `dist`

## Data layer

There is **no real backend**. A fully-typed mock (`src/mock/api.ts`) re-implements
the GAS server contracts (`getData`, the write ops, cash-plan CRUD, and the
2-sheet Excel export) over an in-memory store seeded from `Seed.js`. The app
talks to it through a `google.script.run` shim (`src/gas.ts`) — identical call
shape to Apps Script — so the view code is unchanged.

Writes persist for the session (in memory); a full browser refresh resets to the
seed snapshot. To wire a real backend instead, replace the `mockApi` dispatch in
`src/gas.ts`.

## Layout

| Path | What |
|------|------|
| `src/types.ts` | Strict TS models mirroring the GAS API shapes |
| `src/mock/seed.ts` | `SEED_*` arrays copied verbatim from root `Seed.js` |
| `src/mock/api.ts` | Typed mock backend (faithful re-impl of `Code.js`) |
| `src/gas.ts` | `window.google.script.run` shim → mock |
| `src/styles.css` | The GAS `<style>` block, **verbatim** |
| `src/app/body.html` | The GAS `<body>` markup (header/cards/tabs/modals), **verbatim** |
| `src/app/legacy.js` | The GAS inline app logic (~2,600 lines), **verbatim** |
| `src/App.tsx` / `src/main.tsx` | React shell that mounts the markup + boots the app |

See [PORT_NOTES.md](PORT_NOTES.md) for why the view layer is carried over verbatim.
