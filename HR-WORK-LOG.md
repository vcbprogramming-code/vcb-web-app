# HR Work Log Web App — Architecture & Session Notes

> This document covers **only the HR Work Log app** (`Code.gs`, `History.gs`, `appsscript.json` at this
> project root). This monorepo folder also contains several unrelated apps (`backend/`/`frontend/`
> = a separate E-Memo/Credit-Facility/Onboarding system, `sop/`, `portal/`, `meeting-minutes/`,
> `credit-facility/`, `System Operating Map/`, etc.) — their own docs (`README.md`,
> `เอกสารสรุปฟังก์ชันระบบ.md`) describe **that other system**, not this one. Do not conflate them.

**Live app URL:**
`https://script.google.com/macros/s/AKfycbzEg5Sn0tNnciRkWmwnsEM9cmq0NVmy6weblTLPqlAOccsDKkh9m6dmLMRVBpqspBblUA/exec`

**Apps Script project (standalone, script ID):** `13GL834YDPhar_j-IZTT_f4mDYPUDMJELPIh2XzWHJr4VfZIybZ0gxVzu`
Editor: `https://script.google.com/d/13GL834YDPhar_j-IZTT_f4mDYPUDMJELPIh2XzWHJr4VfZIybZ0gxVzu/edit`

**Live deployment status as of this session's last push:** version `@49` (2026-08-19).

---

## 1. What this app is

A single-page Google Apps Script web app for daily HR work-log entry across multiple construction
sites (โครงการ) plus head office. Fully public — **no login, no accounts** (manifest
`access: "ANYONE_ANONYMOUS"`, `executeAs: "USER_DEPLOYING"`). Every visitor is treated as an
anonymous "(guest) admin" with full read/write access to all sites. This is an intentional design
decision from earlier work, not an oversight.

### Architecture, in one line
`Code.gs` is the **entire app** — one file containing both the server-side Apps Script functions
(`api_*`, `SETUP()`, sheet helpers) and, embedded as one giant JS template literal (`PAGE_HTML_`),
the entire client: HTML shell + CSS + all client-side JavaScript. `History.gs` holds a static
embedded JSON blob of historical daily-log data used for one-time import. There is no build step,
no bundler, no separate frontend framework — it's server-rendered-once, then a single-page
client-side app takes over via `google.script.run`.

### Data store
Google Sheets, opened by hardcoded ID (`DB_ID` in `Code.gs`), never via
`getActiveSpreadsheet()` (that returns null in a deployed web app). Key sheets:
`Config`, `Sites`, `Teams`, `Employees`, `Users`, `MasterIndex`, `CostIndex`, `AuditLog`,
`Migrations`, `LeaveRequests`, plus one wide-format monthly tab per site per month
(`{siteName} · {BE_year}-{MM}`).

`Sites` carries an `active` flag (blank = active) and `LeaveRequests` a `leave_type` column;
both are appended by `ensureSitesColumns_` / `ensureLeaveSheet_` on sheets that predate them.

### React mirror
`hr-worklog/` in this repo is a **static, mock-data-driven UI preview** of this app — it has no
live backend call of its own and cannot fail/succeed against a real server. UI-visible changes
get ported there; purely backend behaviour (DB self-healing, sheet migrations) has no equivalent
to port, since the mirror has nothing to call.

As of 2026-08-19 it mirrors Dashboard, Entry, Work Index, Settings **and Requests** (the full
leave hub, against a stateful mock). `src/i18n_data.ts` is **auto-extracted from `Code.gs`** —
do not hand-edit it; re-extract when the `T` dictionary changes. Verify with
`npm run typecheck` and `npm run build` in `hr-worklog/`.

> `react-app/` at the repo root is **not** this mirror — its `src/` is empty (a stray `dist/`
> and `node_modules/` only) and it is untracked. The live mirror is `hr-worklog/`.

---

## 2. Session 2026-08-17/18 — DB loss, Leave Requests introduced

### 2.1 Incident: the live database was permanently deleted
The original `DB_ID` spreadsheet was deleted outside of any tool available here (not by
Claude — no tool used in this session can delete a Drive file) and could not be recovered from
Trash. Response:
- `ss_()` now **self-heals**: if `DB_ID` (or a previously-recorded override) can't be opened, it
  auto-creates a fresh spreadsheet via `SpreadsheetApp.create()`, files it into the correct Drive
  folder (`WORK / 08 CLAUDE CODE / HR Work Log Web App`), remembers its ID in
  `PropertiesService` under `DB_ID_OVERRIDE_`, and runs `SETUP()` on it automatically.
- `SETUP()` reseeds roster data from the **embedded `FULL_ROSTER` constant** in `Code.gs`
  (real site/team/employee data baked directly into the source, not an external file) — this is
  why the roster survives even a full DB wipe.
  - A separate external seed path (`hr_seed.json`, referenced by `SEED_FILE_ID`) also existed;
    that Drive file is also gone. `loadSeed_()` now degrades to an empty seed instead of
    throwing, since `FULL_ROSTER`/`ensureSync_()` is the real, current source of truth for roster
    data — `hr_seed.json` was legacy/redundant.
  - `History.gs`'s embedded `HISTORY_DATA` blob (Jan–Mar 2026 records for two sites) still exists
    separately and re-imports on first bootstrap into an empty DB (the yellow "นำเข้าข้อมูลย้อนหลัง"
    banner you may see once per fresh DB).
- **Client shell resilience**: if the data layer is *still* unreachable after the self-heal
  attempt, `api_bootstrap` now returns `{ok:true, degraded:true, degradedError:...}` instead of
  `{ok:false}`, and the client (`bootDegraded_()`) renders the normal header/nav with an inline
  "data unavailable, retry" notice in the content area — instead of the whole page going blank.
  Diagnostic helper still in the file for manual use: `WHERE_IS_DB()` (run from the editor;
  logs and moves the active DB into the correct Drive folder).

### 2.2 Dashboard toolbar cleanup
Removed redundant `<label>` text above the view-tabs/month-picker/export-button row on the
dashboard (they were self-explanatory), and changed `.statrow`'s `align-items` from `end` to
`center` for that row now that nothing tall sits above the controls. Ported to the React mirror
(`hr-worklog/src/Dashboard.tsx`) since this is purely visual.

### 2.3 Head Office added as a real site
`FULL_ROSTER.sites` now includes `{"key":"headoffice","name":"สำนักงานใหญ่", ...}` with empty
`teams`/`employees` (no roster data was available to seed it with — **head office staff still
need to be added**, see §4). `FULL_ROSTER_VERSION` was bumped to `"2026-08-16-headoffice"` so
`ensureSync_()` picks up the new site on next bootstrap (it's additive/idempotent — safe to
re-run, never overwrites existing rows). Once synced, `ensureLogSheets_()` auto-creates its
daily-log tab the same as any other site — no special-casing needed anywhere else in the app.

### 2.4 New feature: Leave Requests ("คำขอ")
Employee self-service leave request + admin approval, reusing the existing `Z-2` (ลา) leave
code so approved leave shows up on the dashboard/entry grid exactly like an HR-typed entry —
no new rendering logic needed there.

**Data model** — new sheet `LeaveRequests`, columns:
`id, eid, site_key, emp_name, from_date, to_date, reason, status, requested_at, decided_by, decided_at`
(`status`: `pending` | `approved` | `rejected`).

**Server functions** (`Code.gs`, search `LEAVE REQUESTS`):
- `api_rosterForLeave(siteKey)` — open roster listing (name+eid only) for the request form's
  employee picker. No login/role required, matching the app's fully-public model.
- `api_requestLeave(eid, fromDate, toDate, reason)` — appends a pending row. No `LockService`
  lock (see §3.1 for why). ID is `Date.now()*1000 + random 0-999` — unique and sortable without
  needing a lock to avoid collisions.
- `api_myLeaveRequests(eid)` — a requester's own history.
- `api_pendingLeaveRequests()` — admin/manager queue, scoped to the caller's sites
  (`requireEntry_()` + `scopedSiteKeys_()`).
- `api_decideLeaveRequest(id, approve)` — approve/reject. On approve, writes `Z-2` into every day
  in the range via the same `writeWideCells_()` path daily entries use. Still uses a short
  (10s) `LockService` lock, wrapped in try/catch, since this one legitimately needs cross-sheet
  write consistency.

**UI** — one nav entry ("คำขอ" / "Requests"), **not tabs**: a single page, left column = compact
submit form (site → name → dates, with end-date auto-filled from start-date, and a live
"N days" hint), right column = the requester's own requests shown as color-coded status
"tickets" (yellow=pending / green=approved / red=rejected) with a summary count line, plus — for
anyone with entry rights — a second ticket list of everything pending approval across their
sites, with approve/reject buttons right on each ticket. Each ticket has a 🖨 print button that
opens a clean, print-ready leave slip (name/site/dates/reason/status/signature lines) in a new
tab. This replaced two earlier UI iterations (a tabbed New/Mine/Approve layout, and before that
two separate nav items) based on live feedback that request workflows shouldn't sit flat
alongside data-management tools, and that tabs wasted the page's width.

All new strings have English translations in the `T` table — verified no untranslated leftovers
in the Requests section.

### 2.5 Bugs found and fixed that session (real ones, with root causes)
1. **`google.script.run` returning `null` instead of the actual data.** Cause: a debug line
   attached a custom property (`arr._debug = {...}`) directly onto an **Array** before returning
   it from a server function. Apps Script's client-communication serialization cannot handle an
   array with a non-index property attached and silently returns `null` to the browser instead of
   throwing. Fixed by removing all such array-mutation debug code — never attach properties to a
   returned array in an Apps Script `api_*` function.
2. **Whole-app-breaking syntax error** (page stuck forever on "กำลังโหลด…"). Cause: debug strings
   added inside the client-JS section of `Code.gs` used a single `\n` where the surrounding code
   already sits inside an **outer** JS template literal (`PAGE_HTML_ = \`...\``). A template
   literal evaluates `\n` into a real newline character at the point the outer literal is
   evaluated, so what reaches the browser is broken JS (a raw newline where `\n` two-characters
   were intended) — not the enclosing HTML rendering, the actual JS parser chokes on it,
   `document.write` throws `SyntaxError`, and the page never finishes booting. **Any backslash
   sequence written inside `PAGE_HTML_`'s client-JS section must be doubled** (`\\n`, `\\t`, etc.)
   so the outer literal reproduces a literal single backslash in the generated output. This is a
   known, documented gotcha for this file (see `page-html-regex-gotcha` project memory) — this
   session is a second confirmed instance of it. **`node --check` does not catch this class of
   bug** — it validates the raw source text, not what the outer template literal evaluates to.
3. **Likely stuck `LockService` lock causing an indefinite hang on leave-request submit.** Not
   fully confirmed live (see §3), but strongly indicated: after very heavy same-session iteration
   (dozens of pushes/deploys/manual editor runs), `api_requestLeave`'s `LockService.getScriptLock()`
   call may have been blocked by a prior execution that was killed by Apps Script's own execution
   time limit while holding the lock, before its `finally` block could release it — a documented
   real Apps Script failure mode, not specific to this app. Fixed by removing the lock dependency
   from that specific write path entirely (see §3.1) and hardening `api_decideLeaveRequest` with
   try/catch + a shorter lock timeout so it degrades to a clean error instead of hanging.

### 2.6 Housekeeping (that session)
- Recreated `.claspignore` (was missing/lost before this session) — now an **allowlist**
  (`Code.gs`, `History.gs`, `appsscript.json` only), immune to sibling app folders
  (`System Operating Map/`, etc.) accidentally getting swept into a push, which happened once
  this session with a denylist-style ignore file.
- `.clasp.json` recreated locally (gitignored — contains the live script ID, machine-specific).
- `.gitignore` updated: Google Drive sync junk (`desktop.ini`, `.tmp.driveupload/`,
  `.tmp.drivedownload/`, `*.gsheet`, `*.gscript`), `.claude/settings.local.json`.
- Cleaned up ~200 stray `desktop.ini` files that Google Drive for Desktop had written into every
  folder in this repo, including inside `.git/refs/` — the latter was actively corrupting git
  (`fatal: bad object refs/desktop.ini`, breaking `git log`/`git fetch`). Deleted; recommend
  keeping Drive from syncing `.git/` going forward if possible.
- Pushed to GitHub (`vcb-web-app` remote, `VCB-dev` branch) after merging in commits made by other
  sessions on `sop/`, `portal/`, `meeting-minutes/`, `credit-facility/`, `System Operating Map/`
  in the same monorepo — unrelated to this app, just sharing the branch.

---

## 2A. Session 2026-08-19 — leave requests hardened, projects admin, demo data

Deployed `@28` → `@49` across this session. Everything below is live.

### 2A.1 "My Requests" always rendered empty — three root causes

Submitted requests saved correctly but never appeared. The write path was fine; the **read**
path was broken three separate ways, all from Google Sheets silently re-typing what was written:

1. **Date coercion.** `from_date`/`to_date`/`requested_at`/`decided_at` were written as ISO
   strings, but Sheets re-typed those cells as dates, so `getValues()` returned **Date objects**.
   `leaveRowOut_` passed them through untouched; the client then did `r.from_date+'T00:00:00'`
   on a Date and compared two Date instances with `!==`, so no ticket could render. Added
   `lvDate_`/`lvStamp_`; `leaveRowOut_` now normalises **every** field to a JSON-safe scalar.
2. **The id lost its last digit.** `newLeaveId_` returned `Date.now()*1000 + rand` — a
   **16-digit** number, but Sheets preserves only **15 significant digits**. `1787136800581044`
   was stored as `…040`, so the id read back never matched the one handed to print/approve. Ids
   are now strings (`LV<yyyyMMddHHmmss>-<rnd>`), stored verbatim.
3. **Type-sensitive filters.** `eid` is a *number* in `Employees` but arrives from the browser as
   a *string*; `status`/`site_key` could carry stray whitespace. All comparisons now trim both
   sides.

`ensureLeaveSheet_` additionally pins the sheet to plain-text format so new rows stop being
coerced, and re-applies it to sheets created before the fix. Rows written earlier keep their
coerced values and are normalised on read, so old and new rows both render.

### 2A.2 Leave requests — features added

- **Cancel.** `api_cancelLeaveRequest` deletes a row, but only when the caller passes the `eid`
  that owns it *and* the row is still `pending`. With no login, that eid is the same ownership
  proof used at submit time, so a guessed id can't cancel someone else's leave. Status is
  re-checked under the script lock in case an approver decides it in between. Approved/rejected
  rows stay immutable — they're a record, and an approved leave has already been written onto
  the schedule.
- **Leave type** (`leave_type` column). Six canonical codes
  (`sick/personal/vacation/maternity/ordination/other`). Codes are stored; Thai labels are i18n
  source strings, so switching language never rewrites stored data. `ensureLeaveSheet_` appends
  the header to older sheets rather than rewriting the row. Rows predating the column read back
  blank and render as "ไม่ระบุ" rather than being assigned a category they never had.
- **Decision history.** Approve/reject only ever stamped `status`/`decided_by`/`decided_at` — no
  data was ever lost — but `api_pendingLeaveRequests` filters `status==='pending'`, so a decided
  row vanished with no way back. `api_decidedLeaveRequests` returns them, newest first, capped at
  200. It returns `{rows,total,shown}` as a **plain object**, never an Array carrying a count
  property: attaching a property to a returned Array makes `google.script.run` resolve `null`
  with no error anywhere. Rows with no `decided_at` sort to the **bottom**, not by id — ids begin
  `"LV"`, which string-compares above any `"2026-…"` timestamp and would float undated legacy
  rows to the top as if newest.
- **Three sibling tabs.** My Requests / Pending Approval / Decision History share one tab strip
  in one card, each with a count. Users without entry rights see only the first.
- **Busy state.** Approve/reject/cancel previously called the server bare — the row sat looking
  idle then abruptly vanished, and stayed clickable throughout so the same decision could be
  fired repeatedly. `lvTicketBusy_` disables every button in the row, dims it, and shows a
  spinner. Crucially the success path does **not** release it: the row only leaves the queue when
  the *reloaded list* renders (a second round trip), so releasing on the write's response left a
  decided row looking clickable for a second or more. The refresh replaces the container's
  `innerHTML`, discarding the busy node outright.

### 2A.3 Printed leave slip — rebuilt

The old slip was a six-row table on a third of a page, and its heading rendered
"Leave Request Form (Leave Request Form)" in English (the Thai title was translated, then a
literal English suffix appended on top).

Now a proper A4 document: letterhead, document number, status chip, sectioned *Requester
Details* / *Leave Details*, a ticked checkbox row for leave type, a company radio row
(วิจิตรภัณฑ์ก่อสร้าง / ชวนา เอ็นจิเนียร์ริ่ง / ซีวีเอ็น Development), dotted fill-in rules for
contact-during-leave and work handover, and a bordered reason box set to `flex:1` so it absorbs
the leftover page height instead of bunching at the top.

`api_rosterForLeave` now also returns `emp_id`, `position`, `department` and the site's
`company` — they existed on `Employees`/`Sites` but never reached the client, which is why the
slip couldn't print them. When an approver prints someone *else's* request those identity fields
fall back to blank rules, since the roster only holds the selected employee.

> **Note:** stored company strings are `"ชวนา เอ็นจิเนียร์ริ่ง"`, which the existing
> `companyDisp()` normaliser does **not** match — it looks for `"ชนา"` / `"เอ็นจิเนียริ่ง"`.
> That function is used by other screens and was left alone; the slip matches on its own
> distinctive substrings. Worth fixing separately.

### 2A.4 Dates are day-first everywhere

Storage stays ISO `yyyy-MM-dd` (sortable, unambiguous). Every human-facing leave date now renders
**dd/mm/yy** via `lvFmtDate_`/`lvFmtRange_`. Ranges collapse when they share a month
(`12–18/08/26`); crossing a month or year boundary prints both halves in full. The printed slip
uses the full four-digit year — it's a formal document with no space pressure.

**The `mm/dd/yyyy` in the START/END DATE pickers cannot be changed.** Those are native
`<input type="date">` controls rendered in the browser/OS locale; HTML exposes no attribute to
override the display order. The hint under the pickers echoes the chosen range day-first so the
user can confirm what they actually picked.

### 2A.5 Schedule shows which days came from an approved request

An approval writes `Z-2` — byte-for-byte what HR types by hand — so the two were
indistinguishable and the request behind a day was invisible.

Approval now writes a structured note `[LV] <type> · <doc no>`, and the grid renders an indigo
inset edge plus a small caption on those cells, with the document number in the tooltip. The
client matches the **ASCII `[LV]` marker**, never the Thai wording: the wording is display text
that may be reworded or translated, and matching it would silently break the indicator.

Follows the existing marker vocabulary (amber inset = retro edit, green = moved-in), so the grid
keeps one visual language for "this cell has a story".

**Gap:** days approved before this change carry the old note and show no badge. Back-filling
would mean rewriting historical cells, so they're left alone.

### 2A.6 Projects / sites administration (new)

Previously there was **no way to add a site at all** — they existed only because `SETUP()` seeded
them from `FULL_ROSTER` — and the one "hide site" control wrote to `localStorage`, so it only
hid sites on the browser that set it. It looked like project administration without being it.

`Sites` gains an **`active`** column. Blank counts as ACTIVE, so every pre-existing row keeps
working; `ensureSitesColumns_` appends the header without touching existing data or column order.

- `api_adminListSites` / `api_addSite` / `api_setSiteActive`, all admin-gated. (This codebase has
  no `requireAdmin_` — only `requireEntry_`/`requireView_` — so the role is checked inline the way
  other admin paths do.)
- The list carries per-site employee counts so closing a project warns how many people are still
  assigned. It **warns rather than blocks**, because projects routinely end before HR moves staff.
- **Keys are derived, never typed.** `key` is a permanent internal id used as the wide-tab suffix
  and in `Users.site_key`, so it must be ASCII and unique. Thai names yield no ASCII, so they get
  a short stable hash suffix (`site840670`) rather than `site2`/`site3`, which would say nothing
  when read in the sheet.
- **Closed ≠ hidden from history.** Closed projects drop out of the entry pickers and the
  leave-request form but stay in `BOOT.sites` with their flag, so the **dashboard keeps showing
  their past months**. Filtering server-side would erase finished projects from history, which is
  the opposite of what closing should mean.
- `api_bootstrap` caches per user for 300 s, so both writes bust that cache *and* patch
  `BOOT.sites` in place — otherwise a new project wouldn't be selectable for five minutes.

### 2A.7 Demo data

`seedDemoData`/`seedDemoAllSites` already existed but were editor-only. Two real bugs found in
them:

- **Saturdays were skipped**, but `daysInMonth_` — what the dashboard divides by — defines
  วันหยุด = **SUNDAY ONLY**, so Saturday counts as an expected workday. Every Saturday was a hole
  in the denominator that no amount of seeding could fill, permanently capping the completion
  percentage. Now excludes Sunday only.
- **Every activity came out at 2–3%.** Work codes were picked *uniformly at random*, so all ~44
  codes each landed on ~1/44 of days — mathematically flat, nothing like real work.
  `pickWorkCode_` replaces this with a Zipf-like popularity curve over a stable hash ranking
  (so the same activities stay popular month to month) plus per-employee specialisation (three
  codes drawn from the popular end, used ~75% of the time). Simulated over 107 employees × 26
  workdays the top activity goes 3.0% → ~7% and the max/min ratio 1.8× → ~39×, with each worker
  showing one clear main duty at 42–64% of their days.

A `wholeMonth` flag fills a complete month rather than stopping at today (right for real use,
wrong for a demo).

> **Seeding is deliberately editor-only.** `REGEN_DEMO_MONTH(year, month)` has **no `api_*`
> wrapper** and nothing in the client calls it, so no demo control can appear in front of an
> audience. Run it from the Apps Script editor, **one month per call** — three months × eight
> sites in a single execution exceeds the Apps Script limit.

### 2A.8 Incident: the app was broken for several minutes

An earlier attempt at auto-seeding called the seeder from the client via `call()` after boot.
`call()` routes any failure into the global `fatal()` handler, so when the seed timed out it
replaced the entire app with an error page. Reverted immediately (`@42`).

**The lesson, restated:** it is not enough to keep heavy work off `doGet`/`api_bootstrap`.
Anything invoked through `call()` can take the whole app down when it fails, regardless of *when*
it is invoked. Long-running work must go through a control that contains its own failure — the
way `withBtnLoading` does — or not be reachable from the client at all.

### 2A.9 UI polish

- Ticket rows use **fixed grid tracks** (name | project | dates | days | type | reason |
  status+actions) so every row's fields start at the same x-position, with a heading row sharing
  the same template. Every cell is emitted on every row — including an empty reason — because a
  skipped cell shifts the rest into the wrong track.
- **Pending badge is amber**, matching the bar on the row's left edge; grey read as "inactive"
  rather than "awaiting action".
- **Thai headings no longer squashed.** `letter-spacing` pulls Thai glyphs apart at joins they're
  meant to make, and `text-transform:uppercase` does nothing for a script with no case. Both
  removed from the list and slip headings; size and weight carry the hierarchy instead.
- Requests tab labels sized to match the adjacent card heading (scoped to `#lvQTabs`, so Work
  Index keeps its own sizing).

### 2A.10 React mirror brought in sync

`hr-worklog/` gained the whole Requests feature it never had:

- `types.ts` — `LeaveRequest`, `LeaveStatus`, `LeaveTypeCode`, `DecidedLeaveResult`,
  `LeaveRosterEntry`, `SiteAdminRow`, `SiteRefActive`. Every leave field is typed `string`
  deliberately: the server normalises before returning, so typing them as `Date` would
  misrepresent what crosses the wire.
- `mock.ts` — a stateful leave layer, so approving in the preview actually moves a row from the
  queue into history rather than just deleting it.
- `Requests.tsx` — the full hub: submit form, three tabs, column-aligned tickets, day-first
  dates, amber pending badge, busy rows, cancel on own pending requests.
- `Entry.tsx` — `parseLeaveNote()` plus the indigo provenance marker, so the preview grid
  distinguishes an approved-leave day from a hand-typed `Z-2` exactly as the live app does.
  `CellValue` gained `note`, and the mock now emits ~4% leave days so the marker is visible.
- `SettingsPage.tsx` — the projects admin (add / close / reopen, employee counts, derived
  ASCII-or-hash keys, duplicate-name reject). Closed projects drop out of the entry and
  leave-request pickers via `siteIsOpen()` but stay on the dashboard.
- `extra.css` — the ticket grid, tab, and badge styles.
- `i18n_data.ts` **re-extracted from `Code.gs`** as that file's own header instructs
  (228 → 318 keys, **0 lost**).

`npm run typecheck` and `vite build` both pass.

---

## 3. Known gaps / what to check first when you're back

### 3.1 ~~Leave-request submit~~ — RESOLVED 2026-08-19
Submitting works, and so does the whole read path (§2A.1). Requests appear immediately under
"คำขอของฉัน". Nothing to verify here any more.

### 3.2 Test data in the live sheet
Several test leave requests (reason: "TEST REASON", plus a handful of real-content test
submissions made while debugging) are sitting in the `LeaveRequests` sheet. Left in place
deliberately per your instruction ("clutter is fine... just make sure everything is working, and
then we can do just the final cleanup at the end") — delete these rows directly in the sheet
whenever convenient; nothing in the app depends on them.

### 3.3 Head Office has no employees yet
`สำนักงานใหญ่` exists as a site but its `Employees` roster is empty — no source data existed to
seed it with. It therefore shows 0 employees and 0% completion on the dashboard, and the demo
seeder legitimately writes nothing for it.

There is now a UI for adding **projects** (§2A.6) but still none for adding **employees**:
`api_addEmployee` exists server-side and is used by the entry grid's "+ เพิ่มพนักงาน" button,
otherwise rosters are maintained in the `Employees` sheet directly.

### 3.4 Feature scope still not built

**Real per-employee identity.** The app is fully anonymous, so a requester proves ownership only
by picking their own name from a roster — and cancel/history are scoped by that same choice, not
by an authenticated identity. Making this real needs an embedded Google Sign-In flow (the agreed
approach) or a second deployment with different access settings, since Apps Script's `access`
manifest setting is all-or-nothing per deployment, not per page. Scoping already agreed: sign-in
would gate only the Requests page, not Dashboard/Entry.

**Per-employee supervisor + email on submit.** A supervisor assigned in Settings, one per
employee, notified when their report submits. Deliberately deferred — build the in-app queue
first, which is now done (§2A.2), so this is the natural next step.

**Leave balance / entitlement** on the printed slip (e.g. "6 of 30 days used"). Every large org
shows this and it is the most useful thing still missing from the form, but the app holds no
entitlement data — no annual allowance per employee, no accrual, no carry-over. Inventing those
numbers on a signed document would be worse than omitting them. Given an allowance policy, the
balance can be computed from approved leave already in the sheet.

**Undo a decision.** Approve/reject is final in the UI; there is no way to reverse one. A real
undo must also clear the `Z-2` cells the approval wrote onto the schedule, so it is a feature,
not a one-liner.

**Back-fill old leave notes.** Days approved before §2A.5 carry the old note text and show no
provenance badge on the schedule.

---

## 4. Quick reference

**Deploy workflow** (from this folder):
```
clasp push
clasp deploy -i AKfycbzEg5Sn0tNnciRkWmwnsEM9cmq0NVmy6weblTLPqlAOccsDKkh9m6dmLMRVBpqspBblUA -d "description"
```
Always target `-i` with that exact deployment ID — it's what keeps the live `/exec` URL stable
across redeploys. `clasp deploy` without `-i` creates a **new** deployment (new URL) — avoid
unless intentionally creating a second, separate deployment.

**Where things live:**
- `Code.gs` — everything (server + entire client app in `PAGE_HTML_`)
- `History.gs` — static embedded historical data for one-time import
- `appsscript.json` — manifest (now also has an `executionApi: {access:"MYSELF"}` block added
  this session for `clasp run` diagnostics — harmless, doesn't affect the web app deployment)
- `.claspignore` — allowlist scoping `clasp push` to just the three files above
- `hr-worklog/` — React mirror (mock data, UI preview only, no live backend).
  `npm run typecheck` / `npm run build` from that folder. `src/i18n_data.ts` is auto-extracted
  from `Code.gs` — re-extract rather than hand-editing.
- `react-app/` — **not** the mirror: empty `src/`, untracked, ignore it.

**Regenerating demo data** (Apps Script editor only — deliberately not reachable from the app):
run `REGEN_DEMO_MONTH(year, month)`, **one month per run**. Three months across eight sites in a
single execution exceeds the Apps Script execution limit.

**Validating a `Code.gs` change before deploy.** The entire client lives inside the
`PAGE_HTML_` template literal, so `node --check Code.gs` alone is a false-positive trap — it
parses the outer file without ever parsing the client JS. Extract the literal, pull out the
`<script>` blocks, and `node --check` those separately; also count `{`/`}` in the `<style>`
blocks. Both checks caught real breakage this session.

**Standalone script migration history:** this app was moved off a container-bound script
(attached to the `Employees` sheet) to the current standalone project on 2026-07-18. See
git history / prior session notes if you need that context again.
