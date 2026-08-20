# PORT_NOTES — React mirror of the Google Apps Script app

This folder is a **downstream replica** of the canonical Google Apps Script
project (`../Code.gs`). The GAS app is the source of truth; this React app mirrors
it. When `Code.gs` changes, re-sync this folder (diff → update only what changed →
re-extract the CSS + `T` dictionary verbatim → bump the row below).

## Last synced

| Field | Value |
|---|---|
| GAS source | `../Code.gs` |
| Size at sync | 603,790 bytes |
| GAS mtime at sync | 2026-08-20 |
| Deployed version referenced | `@54` |
| Stack | Vite + React 18 + TypeScript (strict) |
| Data layer | **Typed mock** mirroring the GAS API (`src/mock.ts`) — visual/UX parity, no backend |

## Verbatim-extracted (regenerate on every sync — never hand-edit)

| Artifact | Source in Code.gs | React file |
|---|---|---|
| Stylesheet | `<style>…</style>` block | `src/app.css` |
| Work index | `var VCB_WORK_TYPES = […]` (44 rows) | `ACTIVITIES` in `src/mock.ts` |
| i18n dictionary | `var T = {…}` (318 entries as of 2026-08-19) | `src/i18n_data.ts` |

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
| `renderRequestsHub` (leave hub) | `src/Requests.tsx` | ✅ submit form, 3 sibling tabs, column-aligned tickets, dd/mm/yy dates, cancel, busy rows |
| `api_myLeaveRequests` / `api_pendingLeaveRequests` / `api_decidedLeaveRequests` | `myLeaveRequests()` / `pendingLeaveRequests()` / `decidedLeaveRequests()` | ✅ shape-faithful, **stateful** (approving moves a row queue→history) |
| `api_requestLeave` / `api_decideLeaveRequest` / `api_cancelLeaveRequest` | same names in `src/mock.ts` | ✅ incl. pending-only cancel + ownership check |
| `api_adminListSites` / `api_addSite` / `api_setSiteActive` | `allSitesAdmin()` / `addSite()` / `setSiteActive()` | ✅ incl. derived ASCII/hash keys, duplicate-name reject, employee counts |
| leave provenance marker (`[LV]` note → `.fromleave`/`.lvmark`) | `parseLeaveNote()` in `src/Entry.tsx` | ✅ matches the ASCII marker, not the Thai wording |

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
- [x] Requests hub: submit form (site → name → leave type → dates → reason),
      three sibling tabs (My Requests / Pending Approval / Decision History) with
      counts, column-aligned ticket rows, dd/mm/yy day-first dates with range
      collapsing, amber pending badge, busy rows held until the list re-renders,
      cancel on own still-pending requests
- [x] Projects admin: add a project (derived ASCII/hash key, duplicate-name
      reject), close/reopen one, employee counts; closed projects leave the entry
      and leave-request pickers but stay in the dashboard
- [x] Schedule shows which days came from an approved leave request
      (indigo inset edge + caption, doc number in the tooltip)
- [ ] **Stubbed (visual only, no backend):** Excel export, + เพิ่มพนักงาน dialog,
      ⇄ transfer flow, Master Index import, autosave to a real store, history import,
      printed leave slip (the GAS version opens a print window; not ported)

## Known intentional differences

- **Backend:** GAS talks to a Google Sheet. Vercel can't run that, so data comes
  from a typed mock (`src/mock.ts`) with the SAME return shapes (`src/types.ts`).
  To go fully functional: replace mock calls with `fetch()` to the GAS `/exec`
  endpoint, or rebuild the API — keep the `src/types.ts` contracts either way.
- **"Today"** is pinned to `2026-05-18` (`TODAY` in `src/App.tsx`) so the sample
  month shows a realistic locked/editable/future mix. Real app uses the live date.
- **The printed leave slip is not ported.** The GAS version opens a print window and
  writes a standalone A4 document into it; there is no meaningful React equivalent in a
  preview that has no backend. Its layout rules (one 10.5pt type scale, a 34mm/1fr field
  grid, nowrap labels, full-cell fill-in rules, mm/pt units) live only in `Code.gs`.
- **`Z-1`/`Z-2`/`Z-3` are `one-to-one` with an EMPTY `fixed_cost`.** `composite()` in
  `mock.ts` must therefore emit the bare code for them, matching the GAS rule
  (`fixed ? code + ' / ' + fixed : code`). Asserting `fixed_cost!` writes
  "Z-2 / undefined" into cells — that was a real bug, found when the real index replaced
  the sample one.
- **Leave-request state is in-memory** (module-level in `src/mock.ts`), so submits,
  approvals and cancels behave correctly within a session but reset on reload. The
  GAS app persists to the `LeaveRequests` sheet.
- **Dates are typed `string`, never `Date`**, throughout the leave models. The GAS
  server normalises before returning (Sheets hands back Date objects for anything
  date-shaped and rounds long numeric ids — see `leaveRowOut_`), so typing them as
  `Date` here would misrepresent what actually crosses the wire.
- **36 `t()` keys in `Entry.tsx`/`Picker.tsx`/`SettingsPage.tsx` have no entry in
  the `T` dictionary** — they are mirror-only strings that never existed in
  `Code.gs`. Harmless (`translate()` falls back to the Thai source string), but they
  will not switch to English. Pre-existing, not introduced by the 2026-08-19 sync.
