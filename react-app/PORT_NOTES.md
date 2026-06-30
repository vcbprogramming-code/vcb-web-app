# PORT_NOTES — React mirror of the Google Apps Script app

This folder is a **downstream replica** of the canonical Google Apps Script
project (`../Code.gs`). The GAS app is the source of truth; this React app mirrors
it. When `Code.gs` changes, re-sync this folder (diff → update only what changed →
re-extract the CSS + `T` dictionary verbatim → bump the row below).

## Last synced

| Field | Value |
|---|---|
| GAS source | `../Code.gs` |
| Size at sync | 490,758 bytes |
| GAS mtime at sync | 2026-06-28 |
| Deployed version referenced | `@189` (per README) |
| Stack | Vite + React 18 + TypeScript (strict) |
| Data layer | **Typed mock** mirroring the GAS API (`src/mock.ts`) — visual/UX parity, no backend |

## Verbatim-extracted (regenerate on every sync — never hand-edit)

| Artifact | Source in Code.gs | React file |
|---|---|---|
| Stylesheet | `<style>…</style>` block | `src/app.css` |
| i18n dictionary | `var T = {…}` (~470 entries) | `src/i18n_data.ts` |

`src/extra.css` is the ONLY hand-written CSS — it covers elements the GAS code
built inline via JS (month-nav arrows, Overview→Weekly focus ring).

## Screen / function mapping

| GAS (Code.gs) | React file | Status |
|---|---|---|
| `renderDashboard` / `loadDash` / `siteCard` | `src/Dashboard.tsx` | ✅ progress rings + mini-cal, top-activities, top-categories, expand |
| `renderEntry` / `renderCoverage` | `src/Entry.tsx` → `Coverage` | ✅ heatmap, per-day strip, lock colours, click-to-jump |
| `renderGrid` (weekly) | `src/Entry.tsx` → `Weekly` | ✅ AM/PM slots, lock/future states, transfer marker |
| `oppOpen` / `oppRender` / `oppPick` (picker) | `src/Picker.tsx` | ✅ 2-step Activity→Category, one-to-one auto-assign, clear, search |
| `renderMasterIndex` / `loadMaster` / `loadCost` | `src/WorkIndex.tsx` | ✅ Activity + Category tabs/tables |
| `renderSettings` | `src/SettingsPage.tsx` | ✅ theme/lang/year/dash-default/cell-names/hidden-sites/about |
| `t()` / `MNAME` / `setLang` | `src/i18n.ts` + `src/settings.tsx` | ✅ live Thai↔English |
| `applyTheme` / `setTheme` (light/dark/auto) | `src/settings.tsx` | ✅ OS listener in auto mode |
| `api_bootstrap` | `BOOT` in `src/mock.ts` | ✅ shape-faithful |
| `api_siteMonth` | `siteMonth()` in `src/mock.ts` | ✅ shape-faithful |
| `api_adminSummary` | `adminSummary()` in `src/mock.ts` | ✅ shape-faithful |

## Parity checklist

- [x] Topbar + nav (role-gated items), guest/admin identity
- [x] Dashboard: 3 view modes, month nav, BE/CE year, hidden-sites filter
- [x] Entry: site picker, ภาพรวม heatmap, รายอาทิตย์ grid, week nav
- [x] Two-step searchable picker with one-to-one auto-assign + clear
- [x] Editing persists to local state; Overview recolors live; save flash
- [x] Sunday-only weekend, 3-day lock + 1-day-ahead cap
- [x] Work Index: Activity + Category tables
- [x] Settings: theme (light/dark/auto), language (th/en), year (BE/CE),
      dashboard default, cell display (code/name), hidden sites
- [x] i18n via verbatim `T` dictionary; verbatim CSS; mobile `.is-mobile` class
- [ ] **Stubbed (visual only, no backend):** Excel export, + เพิ่มพนักงาน dialog,
      ⇄ transfer flow, Master Index import, autosave to a real store, history import

## Known intentional differences

- **Backend:** GAS talks to a Google Sheet. Vercel can't run that, so data comes
  from a typed mock (`src/mock.ts`) with the SAME return shapes (`src/types.ts`).
  To go fully functional: replace mock calls with `fetch()` to the GAS `/exec`
  endpoint, or rebuild the API — keep the `src/types.ts` contracts either way.
- **"Today"** is pinned to `2026-05-18` (`TODAY` in `src/App.tsx`) so the sample
  month shows a realistic locked/editable/future mix. Real app uses the live date.
