# Port notes & sync log

**Last synced to GAS:** live deploy **@117** (root `index.html`, `Code.js`, `Seed.js`
as of 2026-06-29). Re-sync whenever the GAS source changes.

## Goal

A **pixel- and behaviour-identical** replica of the canonical Apps Script app —
never invent, drop, or "improve" a feature. The GAS project is the spec.

## Architecture decision (why the view layer is verbatim)

The GAS UI is a single ~3,300-line `index.html`: one `<style>` block and ~2,600
lines of imperative inline JS (dashboard, three tabs incl. the intricate T-bar
cash planner, seven modals, DOM-level Thai↔English i18n, dark mode, optimistic
cash-plan autosave, server-built Excel export). Re-expressing all of it as
idiomatic typed React components risked subtle behavioural drift on an app that
must match the bank-facing original exactly.

So the split is:

- **Typed, strict TypeScript** for everything at the data boundary — the GAS API
  models (`types.ts`), a faithful mock backend (`mock/api.ts`, a direct re-impl
  of `Code.js`), the seed data (`mock/seed.ts`), and the `google.script.run`
  shim (`gas.ts`).
- **Verbatim** for the view — the GAS `<style>`, `<body>` markup, and inline app
  JS are copied byte-for-byte and mounted by React (`App.tsx` injects the markup,
  then runs the app code as a classic script in global scope exactly as Apps
  Script serves it). This **guarantees** parity: it is the same code, same DOM,
  same CSS.

`npm run typecheck` (strict) and `npm run build` both pass; the typed layer is
fully checked. The verbatim `legacy.js` is a runtime asset, not type-checked
(same as it isn't in Apps Script).

## File mapping (GAS → React)

| GAS source (root) | React file | How copied |
|-------------------|------------|------------|
| `index.html` `<style>` (lines ~36–435) | `src/styles.css` | verbatim |
| `index.html` `<body>` (header → toast, lines ~439–683) | `src/app/body.html` | verbatim |
| `index.html` app `<script>` (lines ~686–3283) | `src/app/legacy.js` | verbatim (`sed -n '686,3283p'`) |
| `index.html` `<head>` mobile-detect + fonts | `index.html` | verbatim |
| `Seed.js` `SEED_*` arrays | `src/mock/seed.ts` | verbatim arrays, typed |
| `Code.js` server functions | `src/mock/api.ts` | re-implemented, contract-faithful |
| `google.script.run` transport | `src/gas.ts` | shim → mock |

## How to re-sync after a GAS change

1. **CSS changed?** Re-extract the `<style>` block into `src/styles.css` verbatim
   (do not hand-edit).
2. **Markup changed?** Re-copy the `<body>` (header → toast) into
   `src/app/body.html`.
3. **App JS changed?** `sed -n '686,3283p' ../index.html > src/app/legacy.js`
   (adjust the line range if the script bounds moved).
4. **Server logic changed (`Code.js`)?** Mirror the change in `src/mock/api.ts`
   and, if the return/argument shape changed, in `src/types.ts`.
5. **Seed changed (`Seed.js`)?** Replace the four arrays in `src/mock/seed.ts`.
6. Run `npm run typecheck && npm run build`, then smoke-test the affected screen.
7. Update the **Last synced** line at the top of this file.

## Backend mock — deliberate deviations

These are mock conventions, not behaviour changes to the UI:

- **Identity:** `whoAmI()` returns `c.chavananand@vcb-con.com` (a manager), so
  attribution and manager-only paths are exercisable. In real GAS this is the
  signed-in Google user.
- **Persistence:** in-memory; resets on a hard browser refresh. GAS persists to
  the master Google Sheet.
- **Excel export:** built client-side with SheetJS (`xlsx`) to the same two
  sheets/columns/filters as `Code.js#exportXlsx` (GAS builds it via a temp Sheet
  + Drive export). Output is the same `{name, b64}` the client downloads.

## Verified (real browser, MS Edge headless)

Data load · dashboard (4 sections / 8 cards) · Facilities/Ledger/T-bar tabs ·
category summary · add-request flow (ledger 65→66) · live availability hint ·
T-bar add-project materializes sections · dark mode · Thai↔English · Excel
download. **No console/page errors.**

## Parity checklist (all present)

- [x] Dashboard cards on every tab — credit-line / due / status panels, per-panel
      Settings toggles, click-to-drill (jumpFac/jumpBG/jumpBE/jumpDue/jumpStatus)
- [x] Facilities tab — table, % meters, limit/used-override modal, sorting
- [x] Credit Ledger tab — merged ledger, add/edit/view/delete, settle, row count,
      cost-category summary accordion with caps
- [x] T-bar tab — monthly per-project planner, income/deduction/aval sections,
      P/N interest, copy-from-previous, move/remove items, autosave, project switch
- [x] Modals — Request, View, Txn, Confirm, Settings, Cap, Limit (styled, never native)
- [x] i18n Thai↔English (DOM dictionary), dark mode, mobile/desktop layer
- [x] Money/date formatting (dd/MM/yyyy, tabular nums), filters, search, persistence
- [x] Excel export honouring on-screen filters
