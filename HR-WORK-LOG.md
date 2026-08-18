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

**Live deployment status as of this session's last push:** version `@27`.

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
`Migrations`, `LeaveRequests` (new this session), plus one wide-format monthly tab per site
per month (`{siteName} · {BE_year}-{MM}`).

### React mirror
`hr-worklog/` in this repo is a **static, mock-data-driven UI preview** of this app — it has no
live backend call of its own and cannot fail/succeed against a real server. Only genuinely
UI-visible changes (e.g. the dashboard toolbar layout) get ported there; backend-only changes
(DB self-healing, the Requests feature's server logic) have no equivalent to port, since the
mirror has nothing to call.

---

## 2. What changed this session (chronological)

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

### 2.5 Bugs found and fixed this session (real ones, with root causes)
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

### 2.6 Housekeeping
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

## 3. Known gaps / what to check first when you're back

### 3.1 Leave-request submit — fix applied, **not yet confirmed live**
This is the most important thing to verify. Through most of this session, submitting a leave
request via the "คำขอ" page appeared to hang indefinitely (spinner/"Submitting…" forever, no
success or error message, even past the client's own 25-second timeout). Root-caused to two
confirmed bugs (§2.5 #1 and #2, both fixed and verified via static extraction+syntax-check of
the exact deployed template) plus a third suspected contributor (§2.5 #3, LockService) — for
which the lock has been removed from the write path as a direct, defensive fix regardless of
whether it was the actual cause.

**No tool available in this session could open a real browser and click the Submit button**, so
this has not been confirmed working end-to-end live. First thing to do:
1. Hard refresh the app (Ctrl+Shift+R).
2. Go to "คำขอ" (Requests), pick a site, pick a name, fill both dates, click Submit.
3. It should complete within 1-2 seconds and the new request should appear immediately under
   "คำขอของฉัน" as a yellow "รอดำเนินการ" (pending) ticket.

If it still hangs or fails, the next diagnostic step is checking the Apps Script **Executions**
dashboard (My Executions, left sidebar in the editor) for any long-running or stuck entries from
tonight's testing, and terminating them manually — that's the only way to force-clear a stuck
lock/execution; there is no way to do this from code or from clasp.

### 3.2 Test data in the live sheet
Several test leave requests (reason: "TEST REASON", plus a handful of real-content test
submissions made while debugging) are sitting in the `LeaveRequests` sheet. Left in place
deliberately per your instruction ("clutter is fine... just make sure everything is working, and
then we can do just the final cleanup at the end") — delete these rows directly in the sheet
whenever convenient; nothing in the app depends on them.

### 3.3 Head Office has no employees yet
`สำนักงานใหญ่` exists as a site (dashboard, entry grid, leave-request picker will all show it),
but its `Employees` roster is empty since no source data existed to seed it with. Populate it
the same way other sites' rosters are maintained (there's no dedicated "add employee" UI in this
app currently — employees are managed via the `Employees` sheet directly, or via the embedded
`FULL_ROSTER`/seed mechanisms described in §2.1).

### 3.4 Feature scope you asked for but is not yet built
You asked for a more advanced version of Leave Requests: real per-employee identity (Google
sign-in, since the app is otherwise fully anonymous), restricting regular employees to only see
their own requests (already true today, since the picker only shows their own submitted
history — but not enforced by real identity, just by what they choose to select), a
per-employee assigned supervisor/approver (configured in Settings), and email notifications to
that supervisor on submission. None of this is built yet. This is a genuinely large addition —
requiring either an embedded Google Sign-In flow (recommended approach, discussed and agreed on
this session) or a second Apps Script deployment with different access settings, since Apps
Script's `access` manifest setting is all-or-nothing for the whole deployment, not per-page.
Scoping questions already answered this session (see chat history): sign-in restricts only the
Requests page, not Dashboard/Entry; supervisor assignment goes in Settings, one per employee;
email is explicitly deferred to a later pass, build the in-app queue first.

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
- `hr-worklog/` — React mirror (mock data, UI preview only, no live backend)

**Standalone script migration history:** this app was moved off a container-bound script
(attached to the `Employees` sheet) to the current standalone project on 2026-07-18. See
git history / prior session notes if you need that context again.
