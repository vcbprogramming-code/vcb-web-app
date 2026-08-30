# Architecture

## What this is

A single Google Apps Script **web app** (`doGet` entry point) serving an SPA-like onboarding portal. There is no framework (no React/Vue), no bundler, no npm dependencies at runtime — every `.html` file under [src/](../src/) is either a page shell or a `<script>`/`<style>` partial pulled in via Apps Script's `include()` templating, and the client-side "app" is hand-written vanilla JS that does its own routing and DOM string-building.

Two backends, both native Google services, no external database:
- **Google Sheets** — one spreadsheet ("VCB Onboarding Portal — Progress Data"), created automatically on first use, with two sheets:
  - "Onboarding Progress" — columns `Employee | TaskId | Completed | Timestamp`.
  - "Checklist Content" — columns `ItemId | PageKey | BlockIndex | Text | Level | Deleted | Order`. Admin edits to checklist items, layered onto the hardcoded `PAGES` baseline at render time — see [Admin checklist editor](#admin-checklist-editor) below.
- **Google Drive** — one folder ("VCB Onboarding Portal — Document Uploads") with a subfolder per employee, holding uploaded document files.

## Request flow

1. Browser hits the deployed web app URL → `doGet(e)` in [Code.gs](../src/Code.gs) reads `?page=` from the query string (defaults to `home`), evaluates the `Index` HTML template, and returns it.
2. [Index.html](../src/Index.html) is the page shell: sidebar, topbar, breadcrumb, an empty `<div id="app">`, footer. It pulls in every partial via `<?!= include('...'); ?>`, **in this exact order**:
   ```
   icons.html → translations.html → images.html → content.html → progress.html → admin.html → app.html
   ```
3. Once all scripts have loaded, `app.html`'s bottom-of-file bootstrap calls `renderPage(window.INITIAL_PAGE)`, which builds the current page's HTML from data in `content.html` and injects it into `#app`.
4. All subsequent navigation is client-side: clicks on `[data-link]` elements are intercepted, `history.pushState` updates the URL, and `renderPage(newPageKey)` re-renders `#app` — no full page reload, no additional server round-trip (except for saving progress, which happens via `google.script.run` calls in the background — optimistic, but no longer fire-and-forget: see [Progress cache](#progress-cache) for the retry/revert/toast path).

### Why the include order matters

`content.html` calls `esc()` and `t()`, both of which are defined later in the include chain (`progress.html` and `translations.html` respectively). This works because **none of these files are IIFE-wrapped except `app.html`** — `esc`, `t`, and everything in `progress.html` are plain top-level `function`/`var` declarations, so they become globals attached to `window` the moment their `<script>` block runs, and are only *called* later, at render time, after every script has finished loading. If you wrap `progress.html` or `content.html` in an IIFE, anything outside that file that tries to call their functions will break silently (this exact mistake bit `progress.html` trying to call `app.html`'s `pageUrl()` — see [KNOWN_ISSUES.md](KNOWN_ISSUES.md)).

`app.html` **is** IIFE-wrapped (`(function () { 'use strict'; ... })()`) — its internal helpers (`pageUrl`, `crumbLabel`, `renderPage`, etc.) are private. The one function other files need to call — `navigate(pageKey, push, anchor)`, used by `celebrateOnboardingComplete`'s Continue button (`progress.html`) to leave the popup and land on the real `PAGES['completion']` page — is deliberately exposed as `window.navigate` for exactly that reason.

## File responsibilities

| File | Role |
|---|---|
| [Code.gs](../src/Code.gs) | Server-side only. `doGet`/`include` routing, Sheet-backed progress CRUD (`getProgress`, `setTaskDone`, `clearDepartmentProgress`, `renameEmployee`), Drive-backed document upload (`uploadRequiredDocument`), admin content overrides (`saveChecklistItem`/`deleteChecklistItem`, gated by `requireAdmin_`). **Every mutating function wraps its read-then-write in `LockService.getScriptLock()`** — see "Concurrency" below. |
| [Index.html](../src/Index.html) | Static page shell markup: sidebar, topbar (language/theme settings), breadcrumb, `#overall-progress-widget`, `#app` mount point, footer. Includes every other file. |
| [content.html](../src/content.html) | **The entire content data model.** `NAV`, `PAGE_TITLES`, `IMAGES`, `PAGES` (every page's hero + sections), and small builder functions (`ph()`, `img()`, `docCard()`, `phasePage()`, `homeFeatureGridSection()`, `deptLanding()`). Editing onboarding content almost always means editing this file — see [CONTENT_GUIDE.md](CONTENT_GUIDE.md). |
| [app.html](../src/app.html) | The render engine: `renderPage(pageKey)` builds a page's HTML from `PAGES[pageKey]` by switching on each section's `type` (`text`, `quote`, `values`, `trackrecord`, `feature`, `featuregrid`, `list`, `checklist`, `doclist`, `deptgrid`, `phaselinks`, `teamgroup`, `gallery`, `orgchart`). Also owns SPA routing (`[data-link]` click handling, `history.pushState`, `window.navigate`), the `PAGES['completion']` gate (`isEmployeeOnboardingComplete()` check inside `renderPage`), the org chart / Group Structure tree renderer (`initOrgChart`, `renderOrgConnectors`, `renderGroupStructureTrunk` — see [Org Chart & Group Structure](#org-chart--group-structure) below), and building the sidebar (`buildNav` → delegates to `progress.html`'s `renderSidebarProgress`). |
| [progress.html](../src/progress.html) | Everything about *who the employee is* and *how far they've gotten*: identity modals, `PROGRESS_CACHE` (in-memory mirror of the Sheet), department lock/switch logic, phase-unlock logic, the journey stepper (`getJourneySteps`/`renderSidebarProgress`), the three celebration overlays (see [Celebrations](#celebrations--three-tiers)), and save-failure handling (`syncTaskDone`/`showSaveFailedToast`). See [Progress & gating model](#progress--gating-model) below. |
| [styles.html](../src/styles.html) | Full CSS theme — design tokens (`--accent`, `--sidebar-w`, etc.), light/dark mode via `:root[data-theme]` + `prefers-color-scheme`, every component's styling. |
| [icons.html](../src/icons.html) | `ICONS` object + `icon(name)` helper — inline SVGs (24×24, `stroke="currentColor"`), no icon font, no external requests. |
| [translations.html](../src/translations.html) | `TH_DICT` (English string → Thai) + `t(str)` lookup. Missing keys fall back to the English string, so it's always safe to call `t()` on new copy before translating it. |
| [images.html](../src/images.html) | Large file — `EMBEDDED_IMAGES`, base64 data URIs for images baked directly into the deploy (avoids depending on an external image host at runtime). |
| [admin.html](../src/admin.html) | Password-gated checklist editor UI, reachable at `?page=admin` or via the "Admin" link in the Settings panel (Index.html). See [Admin checklist editor](#admin-checklist-editor) below. |

## Content data model (the part you'll touch most)

Every page lives in the `PAGES` object in `content.html`, keyed by a page key (e.g. `'home'`, `'accounting-day-1-30'`). A page is:

```js
PAGES['some-page-key'] = {
  hero: { eyebrow, title, subtitle },   // optional page header
  sections: [ /* array of section objects, rendered top to bottom */ ],
  nextPhase: { label, page }            // optional — powers the "Next" link + phase unlocking
};
```

Each section has a `type` that `app.html`'s `renderSectionContent` switches on. The ones you're most likely to touch:

- **`checklist`** — a department phase's task list. `{ type: 'checklist', heading, sub, items: [...] }`. Each item is built with `it(id, text, opts)` (content.html) and carries its own **permanent id** (e.g. `acct-p1-read-1`), not a position-derived one — progress is tracked per item id, so reordering, inserting, or deleting items (including via the admin editor) never repoints an employee's saved checkmark at a different task. (This replaced an earlier `pageKey::sectionIndex::itemIndex` scheme in August 2026 — see [Admin checklist editor](#admin-checklist-editor) below for why.)
- **`doclist`** — the Required Documents grid on Home. Each doc needs a stable `id` (task ID becomes `doc::<id>`) — see `REQUIRED_DOC_IDS` in `progress.html`, which must be kept in sync with the doc list in `content.html`.
- **`deptgrid`** — the Department Selection cards. Each entry needs a `deptId` matching one of the five IDs in `DEPARTMENTS` (`progress.html`).
- **`featuregrid`** — used exactly once, unconditionally, inside `PAGES['completion']`'s `sections` array (built by `homeFeatureGridSection()`, content.html). It is no longer a gated/conditional section type in its own right — the completion gate lives one level up, on `PAGES['completion']` itself. See [Progress & gating model](#progress--gating-model).

### `phasePage(opts)` — the department checklist page builder

All 15 department phase pages (5 departments × 3 phases) are built by calling `phasePage({ eyebrow, title, subtitle, blocks: [...], closing, nextPhase })`, not written out by hand. `blocks` becomes one `checklist` section per entry. If `opts.closing` is a plain string (only true on each department's Day 61–90 page), `phasePage` appends a plain `text` section with that closing message — and, once `isEmployeeOnboardingComplete()` is genuinely true, a "Continue to Completion" link to `PAGES['completion']` (see `renderPage`, app.html). It does **not** append `homeFeatureGridSection()` here anymore — that used to happen, as an in-place gated reveal; see [Progress & gating model](#progress--gating-model) for why that was replaced.

## Progress & gating model

### Identity

- `localStorage['vcb-employee-name']` / `localStorage['vcb-employee-department']` — set via one of two modals in `progress.html`: `promptForEmployeeName` (name + department, used the first time a checklist task is touched) or `promptForNameOnly` (name only, used for Required Documents actions since those happen *before* Department Selection in the journey).
- **Correcting a name**: Settings → "Change my name" (`promptToChangeName`, progress.html). A typo'd name silently starts a fresh, empty progress record — the server cannot distinguish a typo from a genuinely new employee — and until August 2026 there was no way to fix one from anywhere in the UI, since the name modals only appear when no name is set at all. The rename calls `Code.gs`'s `renameEmployee`, which moves the saved rows server-side; without that a rename would just rewrite `localStorage` and orphan every row saved under the old spelling. If rows already exist under the target name (merging a typo back onto a real record), the two are **unioned** — a task completed under either spelling stays completed — rather than one clobbering the other.
- An employee has **exactly one department at a time**. Switching departments (`switchDepartment`) deletes all progress for the old department, both locally and via `Code.gs`'s `clearDepartmentProgress`, after an explicit confirmation modal (`promptDepartmentSwitchConfirm`). Note `clearDepartmentProgress` takes **page-key** prefixes (`"accounting-"`) but task ids on the sheet use the **abbreviated** stable-id scheme (`acct-p1-know-3`); it translates between them via `TASK_ID_DEPT_ABBR_`. Passing one where the other is expected silently matches nothing — that was a real bug, see [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

### Progress cache

`PROGRESS_CACHE` (in `progress.html`) is an in-memory `{ taskId: true }` map, loaded once per page session via `loadProgress()` (calls `Code.gs`'s `getProgress`), and kept in sync with the Sheet via `setTaskDone` calls on every toggle. All "is this done" questions (`isTaskDone`, `isPagePhaseComplete`, `isEmployeeOnboardingComplete`, etc.) read from this cache, never re-fetch.

**Read failures are not silent.** `loadProgress`'s failure handler deliberately does *not* set `PROGRESS_LOADED`, so the next navigation genuinely retries, and it shows a warning toast. It previously set the flag and returned the empty cache, which rendered a transient network failure as a fully-unchecked checklist — visually identical to a genuinely new employee. An employee re-ticking boxes was then writing on top of saved state they could not see. If you touch this handler, keep both properties: no flag, and a visible warning.

The UI is still optimistic — `performToggle` (checklist items) and `toggleDocTask` (Required Documents cards) flip `PROGRESS_CACHE` and the checkbox immediately, before the server round-trip resolves — but the save itself is no longer truly fire-and-forget. Both route through `syncTaskDone(name, taskId, newState, checkboxEl, onReverted)`: it calls `Code.gs`'s `setTaskDone`, and on failure retries once automatically; if the retry also fails, it reverts `PROGRESS_CACHE` and the checkbox back to the last confirmed state and shows a red warning toast (`showSaveFailedToast()`, `.reward-toast.is-warning` in styles.html, `warning` icon in icons.html) — "Could not save — please try again." `onReverted` lets each call site re-sync whatever UI it separately derived from the optimistic state (group progress bars, the completion celebration check). This closes a previously-silent gap: a failed Sheet write used to leave a checkbox visually checked with nothing actually persisted, with no indication anything went wrong.

### Concurrency (server-side)

Every sheet mutation in `Code.gs` — `setTaskDone`, `saveChecklistItem`, `clearDepartmentProgress`, `renameEmployee` — is a **read-scan-then-write upsert with no atomicity of its own**. Two concurrent calls for the same key both scan, both find nothing, and both append, producing duplicate rows. That is reachable in normal use: `syncTaskDone` retries once automatically (so a call that times out client-side but succeeded server-side hits it), and the admin reorder fires one `saveChecklistItem` per item in parallel.

A duplicate row is near-permanent: the scan stops at the first match (`break`), so a later un-tick updates only one row while `getProgress` still sees the stale `true` from the other — the task appears permanently complete and cannot be unticked.

All four therefore wrap their read-write in `LockService.getScriptLock()` with a 15s timeout, throwing `"Server busy, please try again."` on contention (surfaced by `syncTaskDone`'s existing retry-then-revert path). **Any new function that writes to a sheet must do the same.**

Known and accepted: these functions full-scan the sheet on every call, so per-click latency grows with total row count. Fine at current scale; revisit with a per-employee sheet or `CacheService` if the sheet reaches several thousand rows.

### Required-document uploads

`triggerDocUpload` → `handleDocFileSelected` (progress.html) → `uploadRequiredDocument` (Code.gs) → Drive, then `setTaskDone('doc::<id>')`.

- **Validation is enforced server-side.** The `<input accept="...">` attribute is only a file-picker filter — "All Files" in the OS dialog bypasses it, as does any direct `google.script.run` call. `uploadRequiredDocument` checks an extension allowlist (`ALLOWED_DOC_EXTENSIONS_`) and a 10MB ceiling (`MAX_DOC_UPLOAD_BYTES_`, mirrored client-side as `MAX_DOC_UPLOAD_BYTES` for a fast, clear error). The client check is for UX; the server check is the real one.
- **Files are named by `docId`, not by the user's filename**, and any existing file for that `docId` is trashed first — so re-uploading genuinely *replaces*. Previously the file kept the user's own name and a re-upload appended another file, silently accumulating duplicates that nobody could tell apart or identify as satisfying a given requirement.
- **The employee sees what was received.** The server returns `{fileUrl, fileName}`; `setUploadedDocInfo`/`getUploadedDocs` (progress.html) stash it in `localStorage` keyed per employee, and `updateDocCardUI` renders a "You uploaded: <file>" link into the `[data-doc-uploaded]` slot in `docCard` (content.html). This is a convenience receipt only — the authoritative copy is the Drive file, so a cleared browser loses the link, not the file.
- **The Drive folder is keyed by the normalized name**, matching the progress sheet. It previously used the raw `employeeName`, so "Somchai" and "somchai" shared one set of progress rows but got two different Drive folders.
- **Still true**: a document's task is marked complete on *any* successful upload, and the "Complete" checkbox marks it done with no file at all. The required-documents gate is self-certifiable by design.

### Celebrations — three tiers

Completion is marked at three levels, all dispatched from `updateChecklistUI` (progress.html) in strict priority order, because finishing the last task of a phase can satisfy more than one at once and stacked overlays fight:

1. **Whole program** — `celebrateOnboardingComplete()`. Wins over everything.
2. **Phase** — `celebratePhaseComplete(pageKey)`. Added August 2026. Fires when every task in the current 30-day phase is done. Names the phase, says "You can now proceed to the next phase.", and offers a button straight to the next phase (or a plain Continue on the last one). Unlike the section card it has **no auto-dismiss timer** — it asks the employee to make a choice, so it waits for them.
3. **Section** — `celebrateSectionComplete(group)`. Fires 3x per phase (Required Reading / Knowledge Requirements / Required Outputs).

Each tier needs a "was" snapshot taken in `performToggle` **before** `PROGRESS_CACHE` is mutated (`wasOnboardingComplete`, `wasPhaseComplete`) — `updateChecklistUI` runs after the mutation and cannot observe a before-state on its own. Getting this wrong is precisely the bug documented in KNOWN_ISSUES' gated-panel history: the true→false→true transition becomes unobservable and the celebration never fires. The revert path in `syncTaskDone` deliberately passes the *current* states as the "was" values, so nothing re-fires for a save that ultimately failed.

**Test the full state cycle, not just the happy path**: complete → popup; untick → **no** popup and the next phase re-locks; re-tick → popup fires **again**, without a reload.

### The phase trail (bottom of every phase page)

`renderPhaseTrail(pageKey)` (app.html) renders the Day 1–30 / 31–60 / 61–90 pills. States: `.done`, `.current`, `.locked`, and `.next-up` — the phase that just became reachable because the one being viewed was completed. `.next-up` carries a visible "Next up" text badge, not just accent styling and a pulse, since a colour cue alone conveys nothing to a screen reader.

The trail is wrapped in `[data-phase-trail="<pageKey>"]` so `window.refreshPhaseTrail()` can re-render it **in place on every checkbox toggle**. Without that it kept whatever lock states it had at page-render time, so the next phase still looked locked immediately after the employee finished unlocking it — the state only caught up if they happened to navigate away and back. The regenerated node carries `data-phase-trail` from `renderPhaseTrail` itself, so repeat refreshes keep working (cf. the KNOWN_ISSUES lesson about a DOM replacement dropping the attribute a later lookup depends on).

### Phase locking

Phases unlock strictly in order. `getPrevPhaseMap()` builds a `page → prerequisite page` map by walking every `PAGES[x].nextPhase` link backwards — so the Day 1-30 → 31-60 → 61-90 order for each department is *derived from content.html's own data*, not hardcoded a second time. `isPhasePageUnlocked(pageKey)` checks whether the prerequisite page's tasks are all done.

### The journey stepper (sidebar)

Replaces what used to be a flat nav list. `getJourneySteps()` builds a fixed 7-step array — Pre-boarding → Required Documents → Department Selection → [department's 3 phases] → Completion — and `renderSidebarProgress` renders it with done/current/locked states and a connecting line. The department's 3 phase-step labels are built from two separate fields, `deptShort` + `dayRange`, joined *at render time* (not baked into one string), specifically so each half can be translated independently.

### The Completion page (Meet Our Team / Life on Site / Return to Portal)

This used to be an in-place "gated reveal" panel that conditionally appeared on Home/each department's final phase page once onboarding was detected complete. It went through five real rounds of bugs (full history in [KNOWN_ISSUES.md](KNOWN_ISSUES.md)) and was **replaced entirely** with a real dedicated page, `PAGES['completion']` (content.html), per explicit client request ("it's better for it to be its own actual completion page"). There is no async placeholder-swap anymore — this is a genuine page render, gated the same way any other access-controlled page in this app already works.

The contract is unchanged from before, just implemented differently:

- The real completion content is visible **if and only if** `isEmployeeOnboardingComplete()` is true — no exceptions in either direction.
- On a normal page load/reload where onboarding is already complete: the page renders the real content immediately, synchronously, like every other page — no animation, no popup, nothing to "reveal."
- On the live moment the last checklist box is checked: `celebrateOnboardingComplete()`'s full-screen popup shows first (`progress.html`); its Continue button calls `window.navigate('completion')` (exposed from `app.html`'s IIFE) to actually leave the popup and land on the page.
- If the employee reaches `/?page=completion` before actually finishing (a typed URL, a stale sidebar link, or clicking the sidebar's Completion step early), the page still renders something real — never a blank/pending state.

How it's implemented:
- `PAGES['completion']` carries **two** parallel content sets: `sections` (the real Meet Our Team / Life on Site / Return to Portal content, built from `homeFeatureGridSection()`) and `notCompleteSections` (a plain "Not finished yet — return to your checklist" message).
- `renderPage` (app.html) checks `pageKey === 'completion'` and, if `isEmployeeOnboardingComplete()` is false, substitutes `data.notCompleteSections` for `data.sections` before rendering — a plain synchronous branch, the same pattern `isPhasePageUnlocked` uses to gate checklist interactivity on a phase page, not a distinct mechanism of its own.
- Reached two ways: (1) the Continue button in `celebrateOnboardingComplete()`'s popup, and (2) the sidebar stepper's "Completion" step (`getJourneySteps`, progress.html), any time afterward. Like `required-documents`, it's reachable but not a persistent top-level `NAV` entry.
- `phasePage()`'s `closing` handling (content.html) no longer appends `homeFeatureGridSection()` after a department's last phase — it just renders the closing text plus (once actually complete) a "Continue to Completion" link to the real page.

**Do not change the visual content/styling of `celebrateOnboardingComplete()` or `celebrateSectionComplete()`** — the client explicitly signed off on these as final ("It's already perfect").

**Exactly 2 feature cards, deliberately** — `homeFeatureGridSection()` (content.html) ships Meet Our Team and Check Out Life on Site, and nothing else. A "Your Documents" card and a "What's Next" card (naming the receiving department head) were both tried and explicitly rejected by the client: this page is a lightweight orientation aid, not the primary onboarding record, and everything else already lives on the main VCB Portal the "Return to VCB Portal" button links to. `.feature-grid` (styles.html) has a fixed `max-width: 920px` instead of the page's usual full `--maxw` (1520px) specifically so a 2-card row stays a sensible, centered card width instead of stretching edge to edge — see the comment directly above `.feature-grid`. Don't casually re-add a third card without knowing both alternatives were already tried and turned down.

## Product framing: a lightweight orientation aid, not an HR-monitored system

Deliberate, explicit product decisions worth knowing before proposing anything that assumes otherwise:

- **No admin/HR progress-tracking dashboard, no aggregate rollup across employees.** The 90-day process is short, and every employee prints a completion form at the end regardless of anything the app tracks. If someone needs to know who's engaged and how far along, the answer is "read the raw Google Sheet directly" (the "Onboarding Progress" sheet — see [Backend data](DEPLOYMENT.md#backend-data-created-on-first-use-not-part-of-source-control)) — not a gap to fill, an explicit choice already made.
- **No notification system.** Welcome/stall/completion emails were surveyed and explicitly deferred as out of scope for now. There is no `MailApp`, `GmailApp`, or `ScriptApp.newTrigger`-based automation anywhere in `Code.gs` — confirm this is still true (`grep -i "mailapp\|gmailapp\|newTrigger" src/Code.gs`) before assuming a notification hook already exists somewhere to hang a feature off of.

## Admin checklist editor

Added August 2026 so department task lists (Required Reading / Knowledge Requirements / Required Outputs) can be edited as new information comes in, without a code deploy.

- **Access**: `?page=admin`, or the "Admin" link at the bottom of the Settings panel (always visible to everyone — the password gate is the real access control, not obscurity). Gated by a single shared password (`checkAdminPassword` in Code.gs, checked against Script Property `ADMIN_PASSWORD`). No password set = editor stays locked (fails closed, not open). The client never holds the real password — every unlock attempt round-trips to the server. Not a per-admin identity system; there's no login session, no audit-by-user, just one shared secret.
- **Authorization is enforced on the mutations themselves, not just the UI.** `saveChecklistItem(itemId, fields, password)` and `deleteChecklistItem(itemId, password)` each call `requireAdmin_(password)`, which throws on a bad password. This matters because `appsscript.json` deploys with `access: ANYONE`: until August 2026 these functions took no password and did no check at all, so any visitor could open devtools and call `google.script.run.deleteChecklistItem('acct-p1-know-1')` to rewrite or delete any department's checklist without ever seeing the prompt. **If you add another mutating server function, call `requireAdmin_` in it** — a gate in `admin.html` alone protects nothing. `getChecklistOverrides` is intentionally unauthenticated (its content is rendered into every employee's page anyway).
- **No real audit trail.** Soft-deleted rows survive with `Deleted=TRUE`, but rows are upserted in place — an edit overwrites the previous text with no history, and there is no actor or timestamp column. Google Sheets' own version history is the only record of who changed what. (An earlier comment in `Code.gs` claimed this was "a full audit trail"; it is not.)
- **Same-app links must use `data-link`, not a plain `href`** — this app runs inside Google's sandboxed iframe, where a raw `href` navigates that iframe to an unresolvable relative URL (blank page, no error). The admin page's own "Exit to portal" link shipped as a plain `href` once and broke exactly this way; fixed to `data-link="home"` like every other in-app link.
- **What's editable**: only checklist item text, junior/senior visibility, order, and existence (add/soft-delete) — not department names, org chart, or any other page content. A deliberate scope decision, not a limitation of the mechanism.
- **How it persists**: `admin.html` calls `saveChecklistItem(itemId, fields, adminPassword)` / `deleteChecklistItem(itemId, adminPassword)` (Code.gs), which upsert a row in the "Checklist Content" sheet. `getChecklistOverrides()` reads that sheet back as `{ itemId: {text, level, deleted, order, pageKey, blockIndex} }`.
- **How it reaches employees**: `doGet` (Code.gs) fetches `getChecklistOverrides()` server-side and injects it as `window.CHECKLIST_OVERRIDES` (same pattern as `window.INITIAL_PAGE`, see Index.html) — **before** the page is sent, not loaded async afterward like progress checkmarks. `applyChecklistOverrides()` (content.html) applies it to the in-memory `PAGES` object immediately after `PAGES` is built: edits existing items in place by id, appends brand-new items (an override id with no hardcoded counterpart, carrying `pageKey`/`blockIndex` to say where it belongs), removes soft-deleted ones, and re-sorts any block that received an explicit `order`. A page that's never had any of its items edited behaves identically to before this feature existed — overrides are additive, not a replacement data source.
- **Why item ids had to become stable first**: task completion is tracked per checklist-item id (see `getPageTaskIds`/`getPageBlockTaskIds`, progress.html). Before this feature, that id was computed from the item's raw array position (`pageKey::blockIndex::itemIndex`) — safe as long as nothing ever reordered/inserted/deleted an item, which a code-only content model guaranteed. An admin editor breaks that guarantee, so every checklist item first got a permanent id via `it(id, text, opts)` (content.html) that travels with it regardless of position. `pageKeyFromTaskId()` (progress.html) is a reverse lookup (id → pageKey) built once from `PAGES`, replacing the old `taskId.split('::')[0]` parsing three call sites relied on (department inference, phase-lock checks, the checklist init pass) — a stable id has no `pageKey` embedded in its own string the way the old scheme did.
- **Migration**: `migrateTaskIdsToStableIds()` (Code.gs) is a one-time, manually-run function that remaps any pre-existing "Onboarding Progress" rows from the old positional scheme (`pageKey::blockIndex::itemIndex`) to the abbreviated stable-id scheme (`acct-p1-know-3`), via `TASK_ID_DEPT_ABBR_`. If ever needed, run it from the Apps Script editor exactly once.
- **The abbreviated ids are load-bearing elsewhere.** `TASK_ID_DEPT_ABBR_` maps `accounting- → acct`, `finance- → fin`, `procurement- → proc`, `property- → prop`, `engineering- → eng`. Anything that matches a task id against a *department* must translate through that map — `clearDepartmentProgress` did not, and silently deleted nothing for over a deploy cycle (see [KNOWN_ISSUES.md](KNOWN_ISSUES.md)). **When you change an id format, grep for every `indexOf(`/`startsWith(`/`split(` against those ids across the whole codebase**, not just the function you're editing; this is a shear that breaks code you aren't looking at.

## Org Chart & Group Structure

Lives on Home, directly beneath Our Track Record (`type: 'orgchart'` section in `content.html`'s `PAGES['home']`, see `renderOrgSection`/`initOrgChart` in app.html) — no separate page/navigation, embedded in place. A view toggle (`.org-view-toggle`, `data-org-view="chart"|"group"`) switches between two sibling panels sharing the same container:

- **Org Chart** — roles/people within Vichitbhan itself (Leadership → Department Heads → Project Managers/crews), the click-to-expand `.org-team`/`.org-team-btn`/`.org-team-people` pattern.
- **Group Structure** (`renderGroupStructureHtml`) — Vichitbhan's position within the wider Vichitbhan Group: who owns it (Chavananand Family, drawn above), and what it owns/co-owns (Subsidiaries — CVE, CVN — and Joint Ventures — VK, V&K, VN, VC — drawn below as two side-by-side branches).

**Accessibility**: every click-to-expand trigger — `.org-team-btn`, `.org-person-btn` (`orgTeamNodeHtml`/`orgPersonHtml`, app.html), and `[data-org-expand-all]` — carries `aria-expanded`, kept in sync in `initOrgChart`'s open/close handlers (`setAttribute('aria-expanded', ...)` right alongside the existing class toggles). A person node only gets the attribute at all if it actually has a role to expand (`m.role ? ' aria-expanded="false"' : ''`) — nodes with nothing to disclose don't claim to be expandable.

### Project card layout — one layout, always side by side (settled August 2026)

A project card's expanded panel (`orgProjectNodeHtml`, app.html) renders a Project Manager header (`.org-project-lead`, full width, outside/above everything else) followed by `.org-project-groups` — Site Operations **LEFT**, Site Administration **RIGHT**, dashed *vertical* divider between them — for **every opened project, unconditionally**, whether it's the only one open or one of several. This went through three rounds before landing here:

1. First version: always side by side (no distinction from any other state).
2. Second version, after explicit correction: side by side only when a project is clicked in isolation (`.org-chart.focused .org-project.open`); the "everything expanded at once" default reverted to a plain vertical stack, matching the shape the chart had before named departments existed.
3. **Final version, after a further explicit follow-up**: back to always side by side, dropping the `.focused` distinction entirely — both states had shown identical content, so keeping two different layouts for the same data added complexity without a real payoff. `.org-project.open` (380px wide, up from the 190px collapsed width) and the row layout apply to every opened project now, regardless of `.focused`.

Matches a real matrix-reporting org chart the client provided: the PM heads the whole project (both branches); Site Operations additionally runs through the normal Engineering Team chain of command; Site Administration additionally reports to Head Office instead (`hqDept`, `orgAdminPersonHtml`) — the two columns read as genuinely separate branches under one shared head.

**The Project Manager is a standalone header, not a Site Operations department** (August 2026 correction — an earlier draft nested the PM inside the Operations group, which read as Administration not ultimately answering to the PM at all). `project.lead` renders via `.org-project-lead`, outside `.org-project-groups` entirely, with a small "PM" role tag (`.org-project-pm-tag`) next to their name — name stays the primary label, consistent with every other lead in this chart being shown by name first, not reduced to a bare role abbreviation. **Every PM shares one description** (`PM_ROLE`, a top-level constant in content.html, referenced by every `projects[].lead.role`) — an earlier version gave each of the 5 PMs a distinct sentence describing different responsibilities, which was factually wrong: every PM at every site does the same job, so per-project variation misrepresented that.

**The dashed line from Site Administration is a real connector, not just a decorative stub** — it visibly rises from the Administration group's own top. It does **not** reach all the way to the outer card edge past the PM header, and deliberately does **not** reach across the chart to Head Office's own cards (a completely different `.org-segment`, often scrolled far away — routing an actual measured line that far would reintroduce the exact cross-container stale-selector fragility the Connector lines section below warns about). Both of those "doesn't reach further" limits are explicit, confirmed scope decisions, not oversights:
- Escaping past the PM header would require positioning the line outside `.org-team-people`, the shared expand/collapse panel every team card in this chart depends on (`overflow: hidden`, load-bearing for its `max-height` animation) — anything positioned above that panel's own top edge gets silently clipped with no console warning (caught only by comparing `getComputedStyle`'s declared height against the element's actual `getBoundingClientRect()` height in the Playwright harness — they disagreed on the first attempt). Restructuring the PM header out of that shared panel was explicitly ruled out as disproportionate for a decorative connector.
- The "who reports where" source of truth for the Head Office relationship stays the existing per-person "Reports to X" text tag (`.org-member-hq-tag`) either way — the line is a visual gesture toward that, not a replacement for it.

Implementation notes if you touch this again:
- `.org-project-groups { flex-direction: row }` and `.org-project.open`'s 380px width both apply unconditionally now — no `.focused` scoping left anywhere in this feature. If you're tempted to reintroduce a conditional layout, note this has been tried and reverted once already (see history above).
- `.org-project-admin-uplink`'s positioning context is `.org-project-admin-group` (`position: relative`), not `.org-project` or `.org-team-people` despite both of those also being positioned ancestors — `.org-team > * { position: relative; z-index: 1 }` (near `.org-team`'s own definition) makes every direct child of `.org-team` its own positioning context first, so the nearest ancestor is whichever wrapper the uplink actually sits inside, not necessarily the outermost one you might expect.
- A more-specific-selector-only-wins-declared-properties CSS trap (omitting `flex-direction` when overriding `display: flex` for a different layout shape) hit this feature twice while it went through its two-state phase — now moot since there's only one layout, but the general lesson (always verify a layout change by rendering, not by reading the CSS) still applies broadly in this file.

#### Named sub-departments, each with a lead + staff (August 2026 revision)

Each group (Operations/Administration) no longer holds a flat person list — it holds **named sub-departments**, each a small labeled card (`.org-project-dept`, `orgProjectDeptHtml` in app.html) with a lead PLUS 2 generic staff (`dept.staff` in content.html — added after "one lead only" per department read as too sparse). Translated/adapted from a real site org chart the client provided (Thai labels — see `content.html`'s own comment above `opsDepartments`/`adminDepartments` for the source department names):

- **Site Operations (5 departments)**: Budgeting / Shop Drawing, Survey, Structural & Bridge Works, Roadworks / Drainage Systems, Safety / Traffic Control.
- **Site Administration (4 departments)**: Maintenance, Supplies & Asset Management, Accounting - Finance - Procurement, HR - Administration.

Still deliberately **NOT the source chart's full numbered staff/equipment rosters** — that level of detail reads as a live project's real staffing sheet, not stable org-chart content. 2 generic staff per department (drawn from the same source chart's own staff-role vocabulary — foreman, technician, officer, etc.) is a middle ground between the original single-lead version (too sparse) and transcribing exact headcounts (too granular for stable content). All 5 projects share one department template (`opsDepartments`/`adminDepartments` built once, reused via `.map`) — same precedent as the flat role list it replaced, since no real per-project staffing data exists in this app. Every staff member in an Administration department shares that department's own `hqDept` (the matrix relationship is per-function, not per-individual), same as the lead.

The collapsed project card's badge (`.org-team-count`) counts **departments** (9), not people — deliberately excludes the Project Manager from that count, since "10 departments" read as wrong once the badge stopped being a headcount.

### Connector lines are real DOM, not CSS

Every branch bar/drop line in both views (`.org-branch-bar` horizontal, `.org-branch-drop` vertical) is a plain absolutely-positioned `<div>`, appended as a direct child of its row/frame container and positioned via measured `getBoundingClientRect()` math — **not** CSS pseudo-elements or border tricks. `renderOrgConnectors(container)` (Org Chart's own rows) and `renderGroupStructureTrunk(container)` (the Group Structure frame; called at the end of `renderOrgConnectors`) both wipe and redraw their lines from scratch on every call. This is called on initial render, on the chart/group view toggle, on window resize, and after any `.org-team` expand/collapse (`refreshConnectors()`, called once immediately and again after a 380ms delay to catch the panel's own height-transition settling).

This area has broken silently and repeatedly across sessions, almost always the same two ways:
1. **A selector that measures the wrong/stale element.** If a card's DOM structure changes (e.g. adding a click-to-expand wrapper, or later removing it again for a hover tooltip), every function that does `slot.querySelector('.some-class')` to find that card's position must be updated too — a stale selector returns `null`/wrong-position silently, with no console error, just a missing or misplaced line.
2. **N independent parallel drops instead of a real fork.** A visual "one thing splits into several" only reads correctly with an explicit horizontal `.org-branch-bar` spanning every branch's center, drawn *before* the per-branch vertical drops — not N separately-computed vertical lines that happen to start at the same Y coordinate with nothing joining them at the top.

**Never trust a connector-line change without rendering it.** Build a throwaway harness (concatenate `Index.html` with its `include()` calls resolved to the real partial files, in real order, set `window.INITIAL_PAGE`, drive it with Playwright), screenshot it, and — for anything involving `getBoundingClientRect()` — assert the actual measured values, not just that the code "looks right." Reasoning about box models alone has produced confidently-wrong fixes multiple times in this exact section.

### Group Structure family row (VPO / Chavananand Holding)

As of August 2026, the Group Structure tree also shows two companies that share ownership (the Chavananand Family) but are **not** part of Vichitbhan's own corporate structure: **VPO** (Vichitbhan Palm Oil PCL) and **Chavananand Holding Co., Ltd.** They flank VCB's own card in `.org-tree-top`, all three forking from one shared horizontal bar under the "Chavananand Family" box.

- **VCB stays visually dominant.** Its card (`.group-entity-parent`) is a distinct 380px-wide accent-colored card with its own always-visible description paragraph; VPO/Holding are small plain 200px cards.
- **"Not affiliated with VCB" is conveyed by line style alone**, not text — VCB's drop is a solid line, VPO/Holding's are dashed (`.group-family-connector`, a `repeating-linear-gradient` background since these are plain divs, not bordered boxes). An earlier version added a text caption under VPO/Holding explaining the non-affiliation; removed after explicit client feedback that it looked unprofessional ("cringe") — don't reintroduce a caption without checking first.
- **VPO/Holding's descriptions are a pure CSS hover tooltip**, not click-to-expand. `groupFamilyCompanyCardHtml` (app.html) renders `.group-family-hover > .group-family-btn` (the always-visible name+icon) plus an absolutely-positioned `.group-family-tooltip` that fades in/out on `:hover`/`:focus-visible`/`:focus-within` — no JS, no click state, and critically no interaction with `initOrgChart`'s `.org-team` click machinery at all, since these elements no longer are `.org-team`. (An earlier version *did* reuse the `.org-team` click-to-expand pattern; that required a special-case exclusion in `initOrgChart` so opening VPO didn't trigger `.focused`, a chart-wide class that fades every other `.org-team` sibling — including unrelated JV cards elsewhere in the same container. The hover-tooltip rewrite removed the need for that exclusion entirely, and it was deleted as dead code.)
- `renderGroupStructureTrunk`'s connector-drop measurement for VPO/Holding anchors to `.group-family-btn` specifically (not the tooltip, and not the outer `.group-family-hover` wrapper) — that's the one part of the card whose position never changes regardless of hover state, so the line never jumps.
- VCB's own slot needs its own width class (`.group-family-slot-parent { width: 380px }`) distinct from the shared `.group-family-slot { width: 200px }` VPO/Holding use — a flex child can't exceed a `width`-constrained parent even if the child itself declares a wider `width`, so without this VCB's card was silently clamped to 200px despite its own CSS saying 380px.

## Accessibility

The baseline here is better than it looks at first glance and worth not regressing: interactive elements are real `<button>`/`<input>` elements rather than clickable `<div>`s (including every org-chart expander), there is a working skip link (`.skip-link`, Index.html), semantic landmarks (`<aside>`/`<nav>`/`<main>`/`<footer>`), an `alt` on every `<img>`, `aria-expanded` kept genuinely in sync on disclosure triggers, and `prefers-reduced-motion` handled in six CSS blocks plus two JS checks (`app.html` skips carousel autoplay; `progress.html` skips the confetti animation but still shows the card).

Pieces added August 2026, each closing a specific hole:

- **The toast is a live region.** `#reward-toast` (`showToast`, progress.html) is created with `role="status"` + `aria-live="polite"`. It is the *only* channel for a failed save (`showSaveFailedToast`) and for the locked-task explanation (`showLockedToast`), so without a live region both were completely silent to screen-reader users — a save failure passed with no indication at all. `polite` rather than `alert` so a celebration toast doesn't interrupt mid-sentence.
- **`<html lang>` follows the language toggle.** `applyLangUI` (app.html) sets `document.documentElement.lang = LANG`. Index.html hardcodes `lang="en"` and nothing updated it, so after switching to Thai a screen reader announced Thai text with an English voice. `applyLangUI` runs on first load as well as on every switch, so the attribute always matches what is actually rendered.
- **Modal inputs have real accessible names.** The name and rename modals use a visually-hidden `<label class="sr-only" for="...">` — a `placeholder` is not an accessible name. Their dialogs also carry `aria-labelledby` pointing at the modal's own `<h3>`, which they previously lacked entirely (a `role="dialog"` with no name).
- **`.sr-only`** (styles.html) is the standard clip-rect visually-hidden utility. Use it rather than `display: none`, which removes the element from the accessibility tree along with the visual layout.

Known and unaddressed, so nobody re-discovers them as "new": modals do not trap focus or restore focus on close; the milestone/completion overlays have no `role="dialog"`; several interactive elements rely on the UA default focus ring rather than an explicit `:focus-visible` style; and `.group-family-hover` is a `tabindex="0"` div whose tooltip is hover/focus-CSS-only with no keyboard activation handler.

**Do not add a colour-only state cue.** `.next-up` on the phase trail pairs its accent styling with a literal "Next up" text badge for exactly this reason.

## Theming

Design tokens were ported from the sibling "VCB Connect" web app: dark navy sidebar, electric blue accent (`--accent: #3a5bff` light / `#4fd1ff` dark), Orbitron display font + Inter body font, card-based shadow system. Both light and dark mode are supported via `:root[data-theme="light"|"dark"]` plus a `prefers-color-scheme` fallback. All tokens are CSS custom properties on `:root` in `styles.html` — new components should read from those tokens rather than hardcoding colors.

### The mobile drawer (below 980px) — three traps

The sidebar becomes an off-canvas drawer below 980px, hidden with `transform: translateX(-100%)` and revealed by an `.open` class. Three separate things have broken this, all of which produced the *same* symptom — the drawer stuck open across the content, unclosable, with the page unusable — and none of which are obvious from reading the drawer's own CSS:

1. **`.sidebar { animation: app-enter .55s ease both }`** (the desktop entry fade) animates `transform` and uses fill-mode `both`, so its final `transform: none` **permanently overrides** the `translateX(-100%)`. A running animation's value beats a plain declaration, so this must be *cancelled* (`animation: none` inside the 980px block), not overridden. Without it the drawer never hides — it is not "opening", it simply never left.
2. **The `prefers-reduced-motion` block must not put `transform: none !important` on `.sidebar`.** It is meant to suppress the entry animation, but that `!important` also cancels the drawer's off-screen positioning — so every phone with "Reduce Motion" enabled got a permanently-open drawer. The block now applies `transform: none !important` to `.settings-wrap`/`#app.app-enter > *` only.
3. **Never add a `body { overflow: hidden }` scroll lock.** `html, body` carry `min-height: 100vh`; they previously had `height: 100%`, and that combination with `overflow-x: hidden` clipped the whole document to a single viewport — the page could not scroll at all and everything below the fold was unreachable. `height` was changed to `min-height` for exactly this reason. A scroll lock re-creates the same failure.

**Testing implication**: Playwright defaults to `reducedMotion: 'reduce'`, which *suppresses* trap #1 — so the drawer tests correctly in a default harness while being broken on every real phone. Always test this drawer under **both** motion settings (`newContext({reducedMotion: 'reduce' | 'no-preference'})`), and inside an iframe, since Apps Script serves the app sandboxed. Assert the sidebar's real `getBoundingClientRect().x` (negative when closed, 0 when open) rather than checking for the `.open` class, which was present and correct the entire time the drawer was visibly broken.

**Responsive breakpoints**: besides the existing tablet/small-laptop breakpoints (980/860/780/720/640/560px), `styles.html` ends with two phone-specific passes — search for "Phone-width pass" (`@media (max-width: 480px)`) and "Narrow-phone pass" (`@media (max-width: 380px)`). The 480px pass is broad: hero, section padding, quote/value cards, feature cards/`.feature-grid`, the carousel, document cards, department-selection cards, phase cards, org chart/team-members, the checklist/progress bar, modals, the footer, and — specifically — the admin editor's `.admin-item-row` (stacks to a column layout on phone widths). The 380px pass is intentionally short, only covering what's still tight at 360–375px (hero heading size, sidebar brand name, dept card icon height, `.org-chart` zoom, team-members grid, admin tab sizing). Any future edit to those regions should check both blocks, not just the tablet breakpoints above them.

## What's deliberately not here

- **No "Knowledge Library"** — out of scope; a separate application handles that.
- **No search box in the topbar** — removed per client instruction.
- **No npm dependencies at runtime** — `jsdom` and `sharp` were installed temporarily during development (local testing, image cropping) and explicitly uninstalled afterward. `clasp push` only ever pushes `.gs`/`.html`/`.json` files regardless, so a `node_modules` folder would do nothing for the deployed app — don't reintroduce one unless you have a concrete local-tooling reason.
