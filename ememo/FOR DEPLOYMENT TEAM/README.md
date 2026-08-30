# VCB E-Memo — React (TypeScript) port

A **TypeScript-strict, deploy-ready** React mirror of the Google Apps Script
document-control portal in [../\_appsscript_live/](../_appsscript_live/). The GAS
project is the source of truth; this app reproduces its UI and behavior 1:1, with
the Google backend replaced by a **typed mock layer** that mirrors every server
return shape (see [PORT_NOTES.md](PORT_NOTES.md)).

## Run locally
```bash
npm install
npm run dev        # http://localhost:5173 (or next free port)
```

## Quality gates
```bash
npm run typecheck  # tsc -p tsconfig.json — strict, zero errors
npm run build      # typecheck + vite build → dist/
```

## Deploy (Vercel)
Self-contained — deploy this folder alone. Vercel auto-detects Vite; `vercel.json`
pins the framework, build command, and `dist` output. No env vars required (mock
data layer).

## Layout
```
src/
  api/        types.ts (GAS shapes) · mock.ts (impl) · index.ts (swap point)
  components/ SettingsModal · AccessControl · AddPanel · ReviewModal · AckDialog
  store.tsx   prefs (lang/era/theme) + mock auth, persisted to localStorage
  i18n.ts     I18N + PROJ_NAMES + TO_BY_CODE + CODE_LABEL + helpers (verbatim)
  styles.css  the original GAS <style> blocks, extracted VERBATIM
  App.tsx     browse: header, filters, date bar, table, sort, renumber
```

## Sign-in (preview)
The OAuth popup is mocked. Click the **Sign in** pill (or Settings) to sign in as
the owner (manager/admin), or “Sign in as staff” to see the non-manager view.

See [PORT_NOTES.md](PORT_NOTES.md) for the full GAS↔React map, the 21-function API
contract, verified flows, and documented deltas.
