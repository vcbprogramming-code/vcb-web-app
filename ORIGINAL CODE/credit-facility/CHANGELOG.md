# Changelog & Status

## Current state  _(overwrite this block — keep it true, don't grow it)_

- **Apps Script project recovered (2026-08-05), version reset to @2:** the project from the 2026-05-23
  recovery (`1rvARww1jMh…`) was itself deleted from Drive — `/exec` showed Google Drive's "file does not
  exist" page, `clasp deployments` returned "Requested entity was not found". Recovered by creating a fresh
  standalone project (`183uDd0fXOiniijzMXZuz3Y7ZryuOkuULDDupa3mSfQM_oawzcL2AVIqW`), pushing this folder's
  source, deploying, then running `bindMaster('1AP5bJBw…')` (Code.js) once from the Apps Script editor to
  rebind `MASTER_SHEET_ID` — **no data lost**. New live `/exec` URL, new deployment ID — both updated in
  README.md, SETUP.md, deploy.ps1, the `.url` shortcut, and สรุปโปรเจกต์.md. Version numbering restarted from
  @1 (new project), so "@174" references below predate this incident and refer to the *old* project's
  version count, not this one. **Root cause of the deletion is still unknown** — if it happens a third time,
  check Drive's activity/audit log on the script file. See [SETUP.md](SETUP.md#master-sheet-status) for
  full recovery steps.
- **Live deploy (pre-incident history below refers to the old, now-dead project):** version **@174** (Apps Script; stable `/exec` URL — see [../README.md](../README.md)).
- **Folder reorganized (2026-08-30):** split the working folder into `ORIGINAL CODE/` (this GAS project —
  `Code.js`, `Seed.js`, `index.html`, `appsscript.json`, clasp config, `deploy.ps1`, and these docs) and
  `FOR DEPLOYMENT TEAM/` (the React/TS mirror, formerly `react/`) so the two codebases (JS/GAS vs. TS/React)
  are unambiguous. `README.md`, `CLAUDE.md`, and the Drive shortcuts stay at the true project root. Verified
  `clasp status`/`clasp deployments` still resolve correctly from the new `ORIGINAL CODE/` location — no
  scriptId change, deploy pipeline unaffected.
- **React mirror re-synced + pushed (2026-08-01):** `react/` was badly stale (last real sync @117–118; the
  live app had moved on through the T-bar redesign, cost-summary tab, and Actual/Variance tabs without those
  landing in the mirror). Fully re-synced to @174 — verbatim `styles.css`/`body.html`/`legacy.js` re-copied
  from `index.html`, `api.ts`/`seed.ts`/`types.ts` updated to match `Code.js`/`Seed.js` (new PN-POST facility
  type, cash-plan `variant`/`extraRows`). `npm run typecheck && npm run build` both pass. Pushed to GitHub
  `vcbprogramming-code/vcb-web-app`, branch `VCB-dev`, `credit-facility/` folder (commit `827a453`) — this
  local repo has no git remote configured, so pushes go via a throwaway clone of that repo, not from here.
  See [FOR DEPLOYMENT TEAM/PORT_NOTES.md](../FOR%20DEPLOYMENT%20TEAM/PORT_NOTES.md).
- **Project→company fix (@174):** `projCompany()` now reads the `company` field straight from `SEED_PROJECTS`
  (Seed.js) instead of guessing it from `(parentheses)` in the project's Thai name. That guess defaulted to
  "วิจิตรภัณฑ์ก่อสร้าง" whenever a project name had no parentheses — silently wrong for CVE (บริษัท ชวนา
  เอ็นจิเนียร์ริ่ง, now corrected in Seed.js) and for PN4 (was borrowing an unrelated JV suffix from its own
  parenthesized name). BT1/BV keep their sub-project suffix e.g. "วิจิตรภัณฑ์ก่อสร้าง (บางเตย ตอน 1)", now read
  from `company` verbatim instead of parsed. Same fix mirrored into `Code.js` (xlsx export) and the WIP
  `react/` port (`legacy.js`, `seed.ts`, `api.ts`) to keep them in sync.
- **DB location verified + root litter cleared (2026-07-04):** the live master (`1AP5bJBw…`) was confirmed via
  Drive metadata to already live inside this app's folder — no relocation needed. The loose file at `E:\` root
  was the **blank orphan** from the 2026-07-01 reseed incident; it's been archived to
  `_ARCHIVE - orphan & backup sheets…`. `setupMaster_` now also `moveTo()`s any *freshly created* DB into a
  `VCB App Data` folder as a safety net. See the Data section of [../README.md](../README.md) and the cross-app
  [ARCHITECTURE_STANDARD.md](../../ARCHITECTURE_STANDARD.md).
- **T-bar P/N-sale redesign (@159–172):** default section order = deduction first, then P/N ค่างาน, then
  P/N Workdone. Income section is now an OBJECT model (`planIncomeCalc`): ค่างาน mode = MIN(80% work, work−60%
  segment) − PN sold + RT×80%; Workdone mode = work×50%, no deductions (bank-advance on not-yet-billable
  progress, from รายงานความก้าวหน้า/ใบวิทยุ). Per-project editable P/N rate. Every section has a
  `+ เพิ่มรายรับจากแหล่งอื่น` extra-income row (new `ExtraRows` sheet column). งวดที่ = number-only box; filling
  Section 1 cascades (secs 1&2 = งวด N, sec 3 = N+1). Deduction rows red; due-list rows compacted to a uniform
  30px height. **Auto-save on every keystroke** (was blur-only). **Actual tab auto-mirrors the plan** (copies
  structure+amounts). Per-variant cache → instant plan↔actual switch. **PENDING:** live crisscross (plan's หัก PN
  ← prev-month Actual Workdone).
- **Persistence fix (@169):** `getCashPlan` now normalizes the Month cell (Sheets coerces `2026-05`→Date), so
  saved T-bar periods reload on refresh instead of vanishing. See helper `ymOf_` in Code.js.
- **T-bar 3-column layout (@153–155):** each section is now รับ · Cash in | จ่าย · Cash out | สุทธิ · Net
  (shared `PLAN_GRID`, Net col ~116px); subtotal row aligns รวมรับ/รวมจ่าย under their columns. P/N interest
  extracted to `planInterestBlock`/`planRefreshIncomeInterest` — auto-appears live on ค่างาน entry (no re-render,
  keeps focus), compact (title+rate merged into header), rows mirror income rows on the same latitude, box
  hidden when empty via `.tbar-int:empty`. Card header buttons `.sm` so selected/blank card headers match
  height. **📥 Export T-bar** button added to toolbar (stub — `planExportTbar`; Excel format TBD with user).
  Blank template Cash-out now has a รวมจ่าย total mirroring Cash-in.
- **Master-sheet recovery + hardening (@142–143):** a transient sheet-open failure had made `getMaster_`
  silently re-seed a blank sheet and repoint `MASTER_SHEET_ID`, orphaning a month of data. Recovered by
  repointing to the real sheet; `getMaster_` now throws instead of ever auto-creating when an ID is set.
  Dormant `recoverMaster()`/`peekSheet_` kept in Code.js as a safety net. See memory `master-sheet-reseed-incident`.
- **T-bar รับ/จ่าย + P/N interest + subtotals (@148–151):** blank starter template now uses the real
  `PLAN_LEFT_COLS` layout; explicit **รับ · Cash in / จ่าย · Cash out** band per card; always-visible
  **ดอกเบี้ย P/N ที่ต้องจ่าย** block (amount×days×rate/365) with per-project editable rate (default 6.35%,
  stored in localStorage via `planPnRate`/`planSetPnRate`); due lists auto-expand with a **รวมจ่าย** total in
  the summary; per-section subtotal (รับ/จ่าย/สุทธิ) before the grand total; columns rebalanced (`0.84fr/1.16fr`).
- **Cost-summary alignment (@144–146):** per-project tables share `CSUM_COLS` (%-based, table-layout:fixed).
- **Settings modal (@136,147):** wider + one type-size up; Dashboard block compacted, category list enlarged
  (56vh) so all cost categories show without an inner scrollbar.
- **Prev live @138 baseline below (panel⇄filter, etc.):**
- **Panel ⇄ filter standardized (@137–138):** the type dropdown (`fType`) is now the single source of truth.
  Grouped dashboard panels (BG, B/E) select a visible `k:<kinds>` dropdown option instead of a hidden
  `kindFilter` variable (now removed). Every panel's selection is visible in the dropdown, and changing the
  dropdown fully replaces the prior filter — no empty-looking filter after BG/B-E, no "nothing shows" when
  overriding a grouped panel with a single type. `flt()` parses `k:` → kind filter, else facility-number filter.
  The grouped (no-number) options live in their own `<optgroup>` (@138), separated from the numbered
  per-facility rows so the two kinds of choice don't read as equals.
- **Settings modal polish (@136):** wider (760px) + one type-size up + roomier spacing, all scoped to
  `#ovlSettings` so other dialogs stay compact. Recommended future settings options noted (number format,
  default landing tab, due-date threshold) — not yet built.
- **T-bar grid + งวด mirror (@135–136):** editing a section's "งวดที่ N" box now live-updates the "งวด N" in its
  row labels (`planEditPeriodLabel`/`planSyncGuadLabels`, default-template rows only). All sections share one
  column grid (`PLAN_LEFT_COLS`, table-layout:fixed) so cells align vertically; deduction/aval amounts sit in
  the ขอเบิก P/N column with the ค่างาน and % columns as aligned gaps. (Shipped live at @136 — was previously
  only in the working copy, never deployed.)
- **Money input editing (@134):** money fields now show **raw digits while focused** (commas stripped on
  focusin, reapplied on focusout via `fmtMoneyStr`) so mid-number delete/replace no longer fights the caret.
  `fmtMoneyInput` is a no-op while editing; global focusin/focusout handlers on `inputmode="decimal"` (skipping
  readonly auto cells) do the strip/reformat.
- **T-bar onboarding (@133):** sequential first-use flow — the orange "เพิ่มโครงการ" button is grayed/disabled
  until the first T-bar exists (`planAddPickerHtml` checks `hasAny`); the "① เริ่มต้น" starter picker flashes
  (`.flash-pick`/`pickFlash`) so there's one clear starting point instead of two competing pickers.
- **T-bar layout (@132):** fixed the expanded due-list clipping (grid cells get `min-width:0` + `overflow-x`,
  so the right-most action buttons are no longer cut off by the `overflow:hidden` card); added a prominent
  **grand-total block at the end** of the plan body netting all T-bars into one signed คงเหลือสุทธิ.
- **T-bar tweaks (@131):** whole-project delete button in each card header (`planDelProject`); income **%**
  colours green when within the per-row P/N threshold (80/80/50) and **red when over** (signals selling above
  the usual limit); income row labels auto-fill "งวด N" from the section's period number (`planIncomeGuadNo`).
- **Filter bar scope (@130):** the filter bar (`#bar`: company/type/project/due/status + add/export actions)
  now shows only on **Facilities** and **Credit Ledger**. Hidden on T-bar/Actual (self-scoped per table) and
  Variance/Cost (whole-portfolio). `categorySummary` no longer narrows by project/company (shows all). `setView`
  toggles `#bar` display; `fStatus` shows only on the ledger.
- **Cleaner UI (@128–129):** _stage 1_ — 6 tabs grouped into 3 clusters via `.tab-div`; calmer tables (header
  border 2px→1px + lighter `#F4F7FB` tint, row padding 9/11→10/13). _stage 2 (progressive disclosure)_ —
  dashboard sections collapsible with remembered state (`grpOpen_`/`toggleGrp`, key per section); T-bar
  right-side "due items" list folds to a count summary (`<details class="tbar-due">`) until expanded.
- **T-bar income + misc (@127):** income rows reordered to ค่างาน (orange, user-entered) → ขอเบิก P/N
  (auto = ค่างาน × threshold, editable) → %, with default P/N thresholds **80/80/50** (ค่างานรับสุทธิ /
  เงินประกันผลงาน / ผลงานแล้วเสร็จ) via `planIncomeApply`/`pnPct`. Actual tab renamed **หักค่างานตามจริง** (no
  "(T-bar)"). Dashboard B/E card shows **L/G วัสดุ / DLC / PN-post** as visible used-subsets of the shared B/E
  cap (new facility type **#10 PN-POST**, folded into B/E). Credit Ledger filter bar no longer wraps the
  export row (`.grow` flexes). T-bar due-item tables use a shared fixed colgroup (`PLAN_DUE_COLS`) so columns align.
- **Tabs (@126):** elevated segmented control — white card bar (`--sh-sm`), active tab = filled navy pill.
- **Plan T-bar month-switch reliability (@125):** `planAfterRender` now flushes queued edits before loading a
  different month/variant and applies fetches by matching the requested month+variant (was bailing on `_savingN`,
  which could leave a month showing empty/stale data when a save was in flight). Month-switch is read-only and
  saves upsert by unique period id, so no month ever deletes/overwrites another — data is safe in the sheet.
  Note: Cash Plan (`plan`) and Actual (`actual`) are separate variants — data entered on one tab won't show on the other.
- **Plan T-bar perf + live calc (@124):** `saveCashPlanPeriod` now writes the whole row in one `setValues`
  (was ~20 per-field `setValue` round-trips — the cause of slow keystroke saves). Income rows recompute
  the **%** column and the รวม P/N / ค่างาน totals live while typing (`planRefreshIncomeCells`). Note: TL/ML
  deductions key off "รับเงินค่างานสุทธิ" (the deduction section's net-payment input), not section-1 work value.
- **Actual T-bar + Variance tabs (@123):** the T-bar screen is now two tabs sharing one renderer via a
  `PLAN_VARIANT` global: **แผนการเงิน (Cash Plan, `plan`)** forecast and **บันทึกจริง (Actual, `actual`)** —
  the real recorded receipts/deductions, same 3-section structure, starts blank. A new **ผลต่าง (Variance)**
  tab compares them per project (Received / Deducted / Net — plan vs actual vs Δ), using `planTotalsForPeriods`
  (mirrors the T-bar card footer math). Backend: `CashPlan` gained a `Variant` column; `getCashPlan(project,
  month, variant)` filters by it (blank = `plan`); `saveCashPlanPeriod` stamps it. Tabs now: Facilities ·
  Credit Ledger · Cash Plan · Actual · Variance · Cost summary.
- **Cost summary tab (@122):** the cost-category summary is its own tab ("สรุปค่าใช้จ่าย" / *Cost summary*)
  instead of a panel on the Facilities + Credit Ledger tabs. Renders expanded; respects project/company filter.
- **Plan tab (@120–121):** (1) no longer narrows by the filter bar (`fProj`/`fCo`) — it is self-scoped
  via its own controls (the "เริ่มต้น" Start picker, each card's project switcher, the orange "เพิ่มโครงการ"
  button), fixing the bug where, with the filter pinned to e.g. BT1, any other project you added/selected
  saved but vanished from view. (2) `PLAN_EXCLUDE={HO,LPB}` hides projects that can't be a T-bar from every
  plan picker. (3) the orange Add-project list now live-refreshes after a swap (`planRefreshAddPicker`), so a
  swapped-away project reappears in it instead of staying hidden. See `planVisibleProjects()` / `planProjects()`.
- **Latest (@118–119):** Cost-category summary opens with every project's section pre-expanded and
  now respects the project/company filter bar (e.g. pick BT1 → only BT1). English-mode i18n
  fixes: the three tab labels render as *Credit Facilities · Credit Ledger · Cash Plan (T-bar)* (were
  jammed/Thai — each tab is one whole-node phrase now, EN paren-hint hidden via `html[lang=en]`),
  and the dashboard credit-line group headers translate (`วงเงินสินเชื่อ (…)` → `Credit lines (…)`).
  Project names stay Thai by design (proper nouns).
- **Access:** `ANYONE` — *Anyone with a Google account* (any Gmail, sign-in required; not domain-restricted). Re-applied to the live deployment @115. Note: external (non-`vcb-con.com`) users have no server-side identity, so manager-approval/attribution only work for domain users.
- **Done:** "Refined corporate" UI polish — masked-SVG icon system (no emoji), Inter+Sarabun
  typography with tabular numerals, lighter data-grid table headers, button/focus states +
  header accent, and the **"VCB Group" wordmark links back to the VCB Connect portal**.
  Design conventions are documented in [DESIGN.md](DESIGN.md).
- **React mirror:** a deploy-ready Vite + React + TS (strict) replica lives in [FOR DEPLOYMENT TEAM/](../FOR%20DEPLOYMENT%20TEAM/),
  deployable to Vercel on its own. It mirrors the GAS app verbatim (CSS / body markup / app JS)
  over a typed mock backend that re-implements `Code.js`; build + typecheck pass and every screen
  was browser-verified. **It's a live mirror — re-sync it after any GAS change** (see
  [FOR DEPLOYMENT TEAM/PORT_NOTES.md](../FOR%20DEPLOYMENT%20TEAM/PORT_NOTES.md) for the mapping + one-line re-sync commands).
  **Out of sync as of @118:** the cost-summary logic change was mirrored into `react/src/app/legacy.js`,
  but the tab-label + dashboard-header i18n fixes (in `index.html` markup/CSS/dict) were NOT — re-sync before relying on the mirror.
- **Next:** **Depth & motion** pass — consistent shadows on cards/modals/toasts, count-up
  animation on dashboard KPI numbers (`cards()`), smooth tab/modal transitions, and skeleton
  loaders during data load. Also pending: sticky table headers (needs the `overflow:hidden`
  corner-rounding refactor noted in [DESIGN.md §4](DESIGN.md)).

---

## History  _(milestones only — roll small tweaks up; do NOT log every deploy)_

### 2026-06-29 — React/Vercel mirror added _(react/)_
Self-contained Vite + React + TypeScript (strict) port in [FOR DEPLOYMENT TEAM/](../FOR%20DEPLOYMENT%20TEAM/), deployable to Vercel.
Verbatim re-use of the GAS CSS, body markup, and ~2,600-line app JS over a typed mock backend
(`react/src/mock/api.ts`) that re-implements `Code.js`, with a `google.script.run` shim. Pixel/
behaviour parity by construction; build + typecheck pass; browser-verified. Mapping + re-sync
steps in [FOR DEPLOYMENT TEAM/PORT_NOTES.md](../FOR%20DEPLOYMENT%20TEAM/PORT_NOTES.md). Also removed two dead files (`.clasp.json.deleted`,
the broken `VCB Credit Facility.gscript` shortcut).

### 2026-06-03 — Refined-corporate UI polish _(≈ v104–v114)_
Made the app look more professional. All in [index.html](index.html); conventions in [DESIGN.md](DESIGN.md):
icon system (emoji → `.ico-*` masked SVGs), Inter+Sarabun fonts + tabular numerals, lighter
table headers + zebra + total-row footer, button elevation/press + focus rings + orange header
accent, design tokens (`--sh-*`, `--r-*`), and the **VCB Group → VCB Connect** back-link.
Folded in along the way: ledger "showing X / Y" row count, cost-category row layout, and
Settings-modal sizing/gear tweaks.

### 2026-05-31 — Initial commit _(v98)_
VCB Credit Facility web app at its then-deployed state: Apps Script backend (`Code.js`),
seed data (`Seed.js`), single-file UI (`index.html`), manifest, and docs. See
[../README.md](../README.md) (what the app does) / [SETUP.md](SETUP.md) for backend architecture, data model, and deploy workflow.
