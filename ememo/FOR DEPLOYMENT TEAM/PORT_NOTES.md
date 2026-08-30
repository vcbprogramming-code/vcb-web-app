# PORT_NOTES — GAS → React mirror

This subfolder is a **live mirror** of the Google Apps Script portal at
`../_appsscript_live/`. The GAS project is the source of truth; this React app
mirrors its behavior. After any change to the GAS source, re-sync the affected
component / logic / CSS here (re-extract the `<style>` block **verbatim**).

## Last synced
- **GAS source:** `_appsscript_live/index.html` (client) + `_appsscript_live/Code.js` (server)
- **Live deployment at sync time:** **@76** (2026-07-27: mobile date-filter row fixes — see below). Pinned `/exec` unchanged.
- **Synced:** 2026-06-29 (initial full port); re-synced 2026-07-26 for the mobile date/project filter row, standardized filter-box heights, review-modal button reorder + Confirm gating, and the zoom/"Open original" removal; re-synced 2026-07-27 for the mobile date-filter fixes below (see `PROJECT_SUMMARY.md` dev-context log for details).
- **2026-08-18/19: several specific pieces synced on top of the still-outstanding gap below (GAS now at @138).** These were cherry-picked, not a full catch-up to @123–@138:
  - **New project `VC`** (ลาดหลุมแก้ว ตอน 3, doc-code prefix `VC/`/`VC-`) added to `PROJ_NAMES` (`i18n.ts`), the Add-Document `PROJECTS` list (`AddPanel.tsx`), the `LH_DEFAULTS`/`LH_PREFIX`/`LH_COMPANY` letterhead maps (`mock.ts`), and a `.VC` badge color in `styles.css`.
  - **`V&K` split out of the `PN4` tab into its own tab/badge** — V&K (พุทธมณฑล ตอน 3) and `BR3` had been sharing the `PN4` (พุทธมณฑล ตอน 4) sheet tab server-side, so every V&K document showed a "PN4" badge. Server-side fix lives in Code.js only (`migrateVkRowsFromPn4Once_`); nothing to port here since `App.tsx` already reads whatever project keys the server returns. What WAS ported: the badge-class collision bug this exposed — `"V&K".replace(/[^A-Za-z0-9]/g,'')` collapsed to `"VK"`, colliding with the real `VK`/`VK2` project. Fixed via a shared `projBadgeClass()` helper (`i18n.ts`) used by both the table row badge and the picker chips; `V&K` now has its own real color and its own `.VnK` CSS class (`.VnK{background:#e8eaf6;color:#283593}` in `styles.css`) instead of falling back to neutral gray.
  - **Project filter is single-select, rendered as a custom button + popover** (`.pfms` / `.pfmsBtn` / `.pfmsPanel`, state `af: string` + `pfmsOpen: boolean`, click-outside-closes via `pfmsRef`), **not** a native `<select>`. Each row shows the project's full name on the left and its badge chip (`pb <projBadgeClass(p)>`) on the right — matching the table badges. Picking a row sets `af` and closes the panel: one click per switch. It renders on all viewports (the old desktop-chips/mobile-dropdown split and its `.pf`/`.pfb` CSS are gone).
    - ⚠ A checkbox **multi-select** popover (same `.pfms` shell, `Set<string> | 'ALL'`) was built on 2026-08-18 and then **reverted the same day at the user's request** (GAS @131 → @132): switching projects cost an extra click every time, since you had to deselect the previous project before picking the next. Don't re-introduce it without asking — single-select is the deliberate choice, not an unfinished state.
    - **`PROJ_COLOR` was deleted from `i18n.ts` (2026-08-19).** It existed only because a native `<option>` can't carry a styled chip, so the palette had to be duplicated in JS and hand-synced with the `.BT1`/`.VK2`/… classes in `styles.css`. The chips now use those CSS classes directly, so the palette has exactly one home again. Don't reintroduce a JS colour map.
  - **"Clear dates" → "Clear all filters"** (2026-08-19). `clearFilters` (a `useCallback` in `App.tsx`) resets `q`, `dtf`, `stf`, `af`, `pfmsOpen`, `d1`, `d2`, `sortCol`, `sortDir`. The i18n key `clear_dates` was renamed `clear_filters` in the `Strings` interface and both language objects.
  - **Not applicable to this mirror:** the 2026-08-19 `repairShiftedRowsOnce_()` column-shift data repair is server-side only (Code.js), as is the `?action=rowDiag` inspector.
- **⚠ Still NOT synced: 2026-08-13/15 session (GAS reached @123 that session; now @138).** A large batch of GAS-only changes landed since @76 that this mirror does **not** have — deliberately deferred, not an oversight, per the user (docs-only pass that session; React port scoped as separate follow-up work). See the full write-up in `PROJECT_SUMMARY.md`'s "Active development context" (2026-08-13/15 entry). Summary of what's missing here:
  - **Shareable document links.** GAS `doGet` now handles `?doc=<id>`, opening straight into a read-only single-document view (dashboard chrome hidden, no fetch of the full list) with a 🔗 Share button that copies the link. No routing, no `?doc=` handling, and no read-only/shared mode exist anywhere in `react-app/` (`App.tsx` has no URL/query-string state at all — `reviewDoc` is plain `useState`, set only by clicking a table row).
  - **Review panel is a full page, not a modal-over-dashboard**, with document/comments split into two columns (a `position:sticky`, height-capped, internally-scrolling sidebar — Status/actions stay pinned, only the comment thread scrolls) and background scroll locked while open. `ReviewModal.tsx` is still the original centered-modal treatment.
  - **Comment/Approve/Reject composer simplified to direct-submit** (always-open textarea, no separate arm/confirm step; Reject now requires a reason, same as Comment already did). The **CC-notify picker (department chips + email field) is still present** — it was briefly removed in this session, then restored after the user caught that it silently broke email notifications, so don't treat its removal as the final state. It's now a collapsed-by-default "🔔 Also notify" toggle with compact wrapping chips, not the old rigid 2-column grid. **Draw/Apple-Pencil ink input was removed and stays removed.** `ReviewModal.tsx` still has the full original two-step arm→confirm flow with Draw intact — do not delete Draw from the React side without confirming that decision separately; the GAS removal was an explicit simplification request, not a data-model change (server endpoints/types are unaffected — `addReviewComment` etc. still accept `ink`/`ccDepts`/`ccEmails`, GAS's ink is just always sent empty now).
  - **Comment thread is a visual timeline** (connecting rail + colored dot per entry: gray/green/red/amber for comment/approve/reject/reopen) instead of a plain numbered list — a CSS design-token system (`--rv-*` custom properties scoped to the sidebar) drives the whole panel's palette/spacing now, not one-off values per element.
  - **No new `Api`/`types.ts` shapes needed for the share feature itself** — `getReview` gained a few extra return fields (`subject`/`proj`/`url`/`attachUrl`/`code`) server-side, but that's additive and only matters once/if a share view is actually built here.
- **2026-07-27 mobile date-filter fixes (GAS @68→@76), all mirrored here:**
  - Removed the external `<label>` ("Date received:") from the date row entirely — it
    only ever showed on desktop/non-mobile layouts and is dead weight now that both
    date boxes carry their own in-box placeholder (previous mobile-only behavior gave
    d1 the full "Date received" text and left d2 blank).
  - Both date boxes now show a short **"Date"** placeholder (`date_short` i18n key)
    inside the box when empty, same treatment on both sides.
  - **Root-cause fix for the boxes rendering solid black/navy:** the placeholder span
    reused CSS class name `ph`, which collided with an unrelated, unscoped `.ph` rule
    elsewhere in the stylesheet (a dark-navy-gradient **panel-header** style, white
    text) — that rule's `background` bled straight through onto the date placeholder.
    Renamed the placeholder class to **`dph`** everywhere (CSS + the class-toggle
    logic) to kill the collision. This is why `t('date_received')` is no longer
    referenced in the date row at all — replaced by `t('date_short')`.
  - Date `<input>` also got `-webkit-appearance:none; appearance:none; background:white`
    explicitly, since native iOS/Chrome date-input chrome can otherwise repaint over
    an author-supplied background.
  - Date box width bumped 46px→70px each (mobile only) to use the row's leftover
    space — sized against `#pfSel`'s fixed `calc(50vw - 15px)` width so the project
    selector's own width/position is never touched by this change.
  - Added a global `html,body{max-width:100vw;overflow-x:hidden}` safety net (GAS
    only, not required here since the React app doesn't run inside the Apps Script
    iframe wrapper that misreports viewport width).
- **CSS:** extracted verbatim from the three `<style>` blocks of `index.html`
  (lines ~7–966) → `src/styles.css` (52,294 bytes). **Never hand-edit** —
  re-run the extractor (below) when the GAS `<style>` changes.

### Re-extract CSS (run from the project root, `E-Memo Web App/`)
```bash
node -e 'const fs=require("fs");const h=fs.readFileSync("_appsscript_live/index.html","utf8");
let m,css="",re=/<style>([\s\S]*?)<\/style>/g;while((m=re.exec(h)))css+=m[1]+"\n";
fs.writeFileSync("react-app/src/styles.css",css);console.log("CSS",css.length)'
```

## Stack
- Vite + React 18 + **TypeScript (strict)**. Static SPA; deploys to Vercel alone
  (`vercel.json`, framework preset `vite`, output `dist`).
- No UI library (the original has none). CSS is the original's, verbatim.

## Data layer
`src/api/` is the single swap point.
- `types.ts` — TS mirror of every GAS `google.script.run` return shape.
- `mock.ts` — in-memory implementation of `Api` (seed register + review threads).
  Mirrors statuses, running-number logic, letterhead ref generation, manager gating.
- `index.ts` — exports `api` (= mock today) + `mockSignIn()` (stands in for the
  OAuth popup→claimAuth flow). To wire a real backend, implement `Api` over
  `google.script.run` (or a proxy) and export it from here — **no UI changes**.

## Source map (GAS identifier → React)

| GAS (index.html / Code.js) | React |
|---|---|
| 3× `<style>` blocks | `src/styles.css` (verbatim) |
| `I18N`, `PROJ_NAMES`, `TO_BY_CODE`, `CODE_LABEL`, `fmtCode`, `formatDateByEra`, `pad3` | `src/i18n.ts` |
| `LANG`/`DATE_ERA`/`html.dark` + `_authToken`/`_verifiedEmail`/`_rvManager` globals | `src/store.tsx` (StoreProvider/useStore) |
| `loadDocuments`→`buildIndex`→`go`, `sort`, renumber, header counts | `src/App.tsx` |
| `#stModal` + `setTheme`/`setLang`/`setDateEra` | `src/components/SettingsModal.tsx` |
| `getAccessConfig`/`renderAccessConfig`/`saveAccessConfig` (`#stAccessSection`) | `src/components/AccessControl.tsx` |
| `#panel` + `updateRunningNo`/`updateTemplateUI`/`needSignIn`/`submitForm` | `src/components/AddPanel.tsx` |
| `openPreview`→`previewLetter` (`#pvWrap`), `openBodyEditor` (`#bxWrap`) | `AddPanel.tsx` (nested overlays) |
| `#rvWrap` + `renderReview`/`updateReviewControls`/`rvPick`/`rvSubmit`/`rvDelete` | `src/components/ReviewModal.tsx` |
| `#ackWrap` styled confirm (no native `confirm()`) | `src/components/AckDialog.tsx` (`useConfirm`) |
| All 21 `google.script.run` endpoints | `src/api/types.ts` + `mock.ts` |

## Server API parity (21 functions, shapes in `types.ts`)
getDocuments · getLetterheadMeta · getDepartments · getReviewerRole · getOAuthUrl ·
claimAuth · getReview · addReviewComment · reopenDocument · submitDecision ·
deleteOwnLastEntry · sendToMangoERP · deleteDocument · previewLetter ·
submitDocument · finalizeLetter · streamFileForViewer · streamGmailAttachment ·
getDocAttachments · getAccessConfig · setAccessConfig.

## Behaviors verified (headless browser, every flow)
- Browse: search / code / status / project (chips+dropdown) / date-range + quick
  ranges; sortable columns; "commented floats to top" default sort; per-filter renumber.
- i18n TH/EN, theme light/dark, era พ.ศ./ค.ศ. — persisted to `vcb-lang`/`vcb-dm`/`vcb-era`.
- Add Document: sign-in gating, **running number** (`CVE/02A → 022, latest 021`),
  `TO_BY_CODE` recipient prefill, letterhead vs attach branching, Preview (Thai A4
  with generated ref `CVE/วิศวะ/02A/022`), Write-on-A4 editor, submit→finalize.
- Review: letter view (no zoom control — removed 2026-07-26, both apps; the doc
  preview's own expand-to-full-screen affordance covers that case), numbered
  thread (INK + CC parsing), action-first composer (disarm→arm→Confirm, with
  Step 2 — note box, CC, Confirm — hidden on mobile until an action is picked),
  Type/Draw canvas, CC dept chips + emails, **manager gating** (staff sees only
  Comment; manager sees Approve/Reject/Reopen/Mango/Delete), approve→**locked**→
  reopen, delete-own-last, styled delete confirm.

## Deliberate deltas vs GAS (documented, not bugs)
1. **Backend = typed mock.** No Gmail/Drive/Sheets; `getDocuments`/`getReview`/
   submit/decision run in-memory. Swap `src/api/index.ts` for a real bridge later.
2. **Sign-in is mocked.** `mockSignIn()` issues a token (owner = manager/admin;
   `staff@vcb-con.com` = staff) instead of the Google OAuth popup. Lets every
   role-gated flow be exercised without real OAuth.
3. **Attachment streaming stubbed.** `streamFileForViewer`/`streamGmailAttachment`/
   `getDocAttachments` return empty/native results (no real files to stream); the
   review modal renders the letter view (the GAS `combinedHtml` path for letters).
4. **Date inputs use native `<input type="date">`** on all devices. The GAS adds a
   custom `#dpModal` calendar only to dodge older iOS quirks; the native control is
   functionally equivalent and renders the OS picker on mobile. Re-add `#dpModal`
   here only if a target device regresses. (2026-07-26: on mobile the native input's
   own long locale text is now painted over by a short `d/m/yy` `.dlbl` label —
   `shortDate()` in `App.tsx` — matching the GAS `refreshDateLabels()`; this applies
   on top of the native-input choice, doesn't change it.)
5. **previewLetter / letter HTML** is a faithful Thai-A4 reconstruction (letterhead,
   ref `<PREFIX>/<DEPT>/<CODE>/<NNN>`, Thai-era date, closing, signature, typist).
   The GAS builds the canonical PDF server-side; pixel-exact letter typography lives
   there, not in the browser preview.

## Run
```bash
cd react-app
npm install
npm run dev        # http://localhost:5173 (or next free port)
npm run typecheck  # tsc -p tsconfig.json  (strict, no errors)
npm run build      # typecheck + vite build → dist/
```
