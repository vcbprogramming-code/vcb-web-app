# HR Work Log — React (TypeScript) preview

A React + TypeScript replica of the Google Apps Script app in the parent folder
(`../Code.gs`). It mirrors the live UI pixel-for-pixel (the CSS is extracted
verbatim) with a typed mock data layer, so it runs with **no backend**.

> This folder is a **downstream mirror** of the canonical GAS project. See
> [PORT_NOTES.md](./PORT_NOTES.md) for the parity checklist, file mapping, and the
> last-synced GAS version. The GAS app is edited first; this is regenerated from it.

## Run locally

```sh
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```sh
npm run typecheck   # strict tsc, no emit
npm run build       # tsc --noEmit && vite build  → dist/
npm run preview     # serve the production build
```

## Deploy to Vercel

This subfolder is self-contained and deploys on its own.

- **Vercel dashboard:** New Project → import the repo → set **Root Directory** to
  `react-app` → Framework preset **Vite** → deploy. (Build `npm run build`,
  output `dist`.)
- **Vercel CLI:** from this folder, `vercel` (or `vercel --prod`).

## Tech

- React 18 + TypeScript (strict) + Vite
- `src/types.ts` — typed models mirroring the GAS server return shapes
- `src/mock.ts` — typed mock data layer (swap for `fetch()` to the GAS `/exec`
  endpoint, or a real API, keeping the same `types.ts` contracts, to go live)
- `src/settings.tsx` — language / theme / year-format / display prefs (localStorage)
- `src/app.css` — verbatim from the GAS `<style>` block (do not hand-edit)
- `src/i18n_data.ts` — verbatim Thai↔English `T` dictionary from the GAS source

## Structure

```
src/
  main.tsx          entry; mounts <SettingsProvider><App/>
  App.tsx           topbar + nav + view routing + MonthNav
  Dashboard.tsx     3 view modes, site cards, rings, mini-calendar
  Entry.tsx         site picker + Overview heatmap + Weekly grid + editing
  Picker.tsx        two-step Activity→Category searchable picker
  WorkIndex.tsx     Activity + Work Category tables
  SettingsPage.tsx  settings UI
  settings.tsx      settings context + t()/mname/be helpers
  i18n.ts           translate/month/dow helpers
  types.ts          API model interfaces
  mock.ts           typed mock API (BOOT / siteMonth / adminSummary)
  app.css           verbatim GAS stylesheet
  i18n_data.ts      verbatim GAS translation dictionary
  extra.css         small supplement (inline-built GAS elements)
```
