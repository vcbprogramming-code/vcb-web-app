# Port notes

This file records only the places where a 1:1 port was **not possible**, and
what was done instead — so nobody spends a day rediscovering why.

The module now follows `TECH_STACK.md`: JavaScript only, React 18, Vite 5,
Tailwind 3, React Router 6, state via Context + `useState`, and every request
going through the single Express API at `api/`. The browser reaches no database.

`../../onboarding/ORIGINAL CODE/` still describes the live Apps Script app and
is **not** invalidated by this port — `CONTENT_GUIDE.md` and `KNOWN_ISSUES.md`
there document that app, which still runs. Where a fact in those files no longer
holds *for this React build*, it is called out below.

## The version downgrade

This module was the odd one out: React 19.2, Vite 8.2, TypeScript 6.0 and
react-router-dom 7.18, against a contract that says React 18, Vite 5, Router 6,
no TypeScript. All four are now on the contract's versions.

The downgrade needed **no API changes**, which is worth recording because it is
the surprising outcome. What was checked and found absent:

- No `use()`, `useOptimistic`, `useActionState` or `useFormStatus` — nothing
  used React 19's form-action or promise-reading APIs.
- No ref-as-prop. The one place a ref is held (`wasPhaseDone` in `PhasePage`)
  is a plain `useRef` inside the component, not a ref forwarded as a prop, so
  React 18's `forwardRef` was not needed anywhere.
- No data-router APIs — no `createBrowserRouter`, `RouterProvider`, loaders,
  actions, `useLoaderData` or `defer`. Routing was already `<BrowserRouter>` +
  `<Routes>`/`<Route>`, which is identical in v6 and v7.

The entry point moved from `createRoot` under React 19 to `createRoot` under
React 18 — same call, different package version. `tsc -b` is gone from the build
script, so `npm run build` is now just `vite build`.

## Where this port differs, and why

**Backend.** `src/lib/supabaseClient.ts` and every `supabase.from(...)` /
`supabase.storage` call are gone. This module was the one that queried Supabase
*for real* rather than through a mock, so this was a genuine rewiring, not a
mock swap. All data now goes through `api/src/routes/onboarding.js`, wrapped in
`src/lib/onboardingApi.js`. `@supabase/supabase-js` is removed from
`package.json` and is not in `node_modules`.

One `createApi()` instance is created in `lib/onboardingApi.js` and handed to
`AuthProvider` in `main.jsx`. A second instance would leave admin calls
unsigned.

**Most of this module stays anonymous — deliberately.** New hires use it on
their first day, before anyone has created an account for them. Mounting
`AuthProvider` does **not** put a sign-in wall in front of the employee flows;
identity is still a name in `localStorage` (`lib/identity.js`), matching
`allowAnonymous` on the API. Do not "tighten" this: it would lock out exactly
the users the module exists for.

**The shared admin password is gone.** The old editor asked for one password
shared by every admin and checked it with `check_admin_password()` — a
security-definer Postgres function granted to `anon`, whose fallback literal
(`'__unset__'`) was readable by anyone. `007_onboarding.sql` **drops** that
function and its two write helpers, and they must not come back.

`PUT`/`DELETE /api/onboarding/checklist` and `GET /api/onboarding/admin/employees`
are now `requireAuth + requireRole('portal','admin')`. So `/admin` asks for a
real email/password sign-in (`components/AdminSignIn.jsx`), and no password is
threaded down to each row — there is no password. `AdminItemRow` lost its
`password` prop entirely; the JWT authorises the write and the API is the gate.
Hiding the editor from someone without the role is only a courtesy so they do
not fill in a form that would 403.

This means `ORIGINAL CODE/KNOWN_ISSUES.md`'s "RESOLVED (v184): the admin
password gated the UI, not the data" describes a fix **to the Apps Script app**.
In this build the whole mechanism it describes no longer exists.

**Rename is now one transactional call.** The client used to read the target
name's rows, union them in JavaScript, write them back, then delete the old
ones — four Supabase round trips with no transaction, where a failure part-way
orphaned the progress. `POST /employees/:name/rename` does the whole merge in
one transaction server-side, so `useProgress.renameEmployee` is now a single
call. The union semantics are unchanged: a task completed under either spelling
stays completed.

**Department switch still sends explicit task ids.** `switchDepartment` passes
the old department's task ids from its own content file. This is not an
optimisation to remove: the original matched ids against the *page-key* prefix
(`accounting-`) while ids use an abbreviated scheme (`acct-p1-know-3`), so it
silently deleted nothing and the old checkmarks came back on the next load.

**404 from `GET /progress/:name` is a success case.** The API returns 404 for an
unknown name specifically so "new employee" and "could not load" stay
distinguishable. `useProgress` treats 404 as an empty checklist and everything
else as a genuine load failure, which keeps the original's most important
behaviour: **a failed load leaves `loaded` false** so it retries on the next
mount, rather than rendering a network blip as a fully-unticked checklist that
an employee then re-ticks over saved state they cannot see.

**i18n changed shape, not content.** `lib/translations.ts` mapped an exact
English *sentence* to its Thai translation. `src/i18n.js` is now a
`createDictionary()` of stable dot keys holding `{ th, en }`, Thai first, merged
over `commonDictionary`. All **481** Thai strings were carried across
byte-for-byte and verified programmatically; none was re-typed or
re-translated, and the English side is recovered from the old key.

Because the department content in `src/data/` is a large body of English text
held as data, `lib/contentText.js` resolves a raw content string to its dot key
by value (`CONTENT_KEY_BY_EN`), falling through to the string itself when
unmapped — which is exactly what the old `t()` did. **New UI copy should use a
dot key directly**; that shim exists for the migrated content body only.

Thai is now the default language (it was `'en'` before), per the shared
provider. Language and theme also moved to the shared keys `vcb_lang` /
`vcb_theme`, so the choice follows the person across every VCB app; the old
`vcb-lang` / `vcb-theme` keys and the `[data-theme]` attribute are gone in
favour of `class="dark"`, which is what Tailwind's `darkMode: 'class'` reads.

**CSS.** `App.css` (853 lines) and `orgchart.css` (393 lines) are deleted, along
with `index.css`'s ~25 CSS custom properties duplicated across light, dark and a
`prefers-color-scheme` block. Colour now comes from the shared Tailwind preset
and dark mode is one `dark:` variant per utility.

`src/index.css` keeps only what Tailwind 3 genuinely cannot express: the org
chart's tree connector guides, which need `::before` pseudo-elements on three
selectors — one of them (`.tree-row > *`) styling children the component does
not render — plus a print reset. Those guides remain border-drawn rather than
the original app's measured `getBoundingClientRect()` connectors, which
`ORIGINAL CODE/KNOWN_ISSUES.md` calls the second most fragile part of that app.

**A React correctness fix.** `CompletionCertificate` mapped blocks to a bare
`<>` fragment containing multiple rows, with the `key` on an inner element. That
warns and makes reconciliation positional. It is now a keyed `<Fragment>`.

## What the API does not provide, and the UI wants

**Document upload has no presigned URL.** This is the one genuine gap and it
blocks a real feature.

`GET /api/onboarding/documents/:name/path` returns `{ bucket, path }` **only**.
`api/src/lib/storage.js` exports `presignUpload()`, and its own header says the
browser is meant to upload to a presigned URL so the bytes never occupy an
Express worker — but **no onboarding route calls it**. There is therefore no way
for the browser to obtain an upload URL, and the old code path (the browser
uploading straight to Supabase Storage with the anon key) is exactly the
coupling `TECH_STACK.md` forbids.

`lib/useDocUpload.js` is written against the intended contract: it asks for the
path, and uploads with `PUT` when the response carries an `uploadUrl`. When that
field is absent it reports `doc.errorUploadUnavailable` ("please send your
documents to HR directly") rather than appearing to upload and silently
discarding the file. All local validation — extension, empty file, the 10MB cap
— still runs first.

**To close this**, add `uploadUrl` (and `downloadUrl`, for the receipt link) to
that route's response via `presignUpload`/`presignDownload`. No client change is
needed; the hook already uses both fields. Do **not** close it by putting a
Supabase key back in the browser.

**`tasks_done` has no denominator.** `GET /admin/employees` returns a count of
completed tasks but not how many a department defines — the API does not have
the content. `components/AdminCohort.jsx` therefore shows the count and scales
its bar against the largest count in the cohort, rather than inventing a
percentage. (The bar is a hand-drawn `div`; `TECH_STACK.md` rules out chart
libraries.)

**Rename still has no UI.** `useProgress` exposes `renameEmployee`, fully wired
to its endpoint, but no page calls it — the original React scaffold had no UI
for it either, so this is a pre-existing gap carried forward, not a
regression. The endpoint and hook are ready when someone builds the screen.

`switchDepartment` **does** have UI now: `components/DepartmentSwitchModal.jsx`,
shown from `PhasePage.jsx` when `identify()` detects the employee already has
progress in a different department than the one they just tried to act in
(mirrors the original's `promptDepartmentSwitchConfirm`).

## Images

The original carries ~7MB of base64 data URIs in `images.html`. The ones its
pages actually show are extracted to `public/img/` and referenced by path, so a
browser caches them instead of re-parsing them on every load. Filenames are the
kebab-cased `EMBEDDED_IMAGES` key, which is how a file is traced back to its
source.

`images.html` holds more keys than the pages use. Only the referenced ones are
extracted; an unreferenced key is not a missing image.

## Still not ported

Nothing known. The three items previously listed here — the sidebar journey
stepper, the embedded photographs, and the org chart being on a route rather
than inline on Home — have all been ported, and a later pass added the
overall-progress bar, the per-task reward toast, and the 90-day completion
celebration (see below), which had been missed even though their content
strings were already migrated.

## A locked phase page is still fully readable — only the checkboxes disable

An earlier version of this port gated the whole page: visiting a phase whose
prerequisite wasn't done rendered nothing but a "complete the previous phase"
notice, discarding the checklist entirely. The original never does this —
`isPhasePageUnlocked` (progress.html) only gates checkbox *toggling*
(`performToggle` reverts the click and returns), and its own comment says so
explicitly: every phase page can be viewed and read ahead of where the
employee has actually reached; the checkboxes just don't respond, with a
`renderPhaseLockNotice` banner above the checklist explaining why (worded
differently depending on whether Required Documents or the previous phase is
the blocker).

`PhasePage.jsx` now matches that: `unlocked` still exists as a check, but the
early return that swapped the page for a `Notice` is gone. Instead a `Notice`
banner renders above the checklist blocks when locked, and each checkbox gets
`disabled={!unlocked}` — the item text, descriptions and layout are identical
to the unlocked state, matching `pageLocked ? ' locked'`/`disabled` on
`<input>` in `app.html`.

## The 90-day completion celebration and per-task reward toast

Two pieces the original always had that this port didn't, until a later pass:

- **`showRewardToast`** (progress.html) — a small "Nice work!" / "Great job!" /
  etc. toast on every task checked ON (not off), randomly chosen from five
  messages. `components/RewardToast.jsx` + its `useRewardToast()` hook are the
  port; `PhasePage.jsx`'s `handleToggle` calls it right before `toggleTask`
  when the task is transitioning to done. All five message strings were
  already migrated content (`content.niceWork` etc.) with nothing rendering
  them.
- **`celebrateOnboardingComplete`** — the bigger, one-time popup for finishing
  all three phases (as opposed to `celebratePhaseComplete`'s per-phase one,
  which this port already had). `PhasePage.jsx` now tracks `isFinalPhase` and
  shows this overlay instead of the phase-complete one when the LAST phase's
  last task is ticked. Confetti is not ported (canvas-drawn in the original,
  `runConfetti`); the popup itself, its copy, and its Print/Continue actions
  are. "Print Completion Form" navigates to `/completion?print=1` —
  `CompletionPage.jsx` reads that param and calls `window.print()` after a
  short delay, then strips the param, because printing only works from that
  page (it's the only place the hidden `print:block` certificate exists).

## Overall progress bar

`renderOverallProgress` (progress.html) — "Your Onboarding Progress — NAME
(DEPARTMENT) NN%", with a fill bar and "X / Y tasks complete" — is now
`components/ProgressBar.jsx`, rendered in `Layout.jsx` above the journey
stepper. It renders nothing until both a name and a department exist, matching
the original. The fill transitions on mount/change via a one-frame delay
(`requestAnimationFrame`) rather than snapping, which is what gives it the
"has to slowly fill" behaviour the original's CSS transition provides for
free.

Building this exposed a real bug in `lib/departmentTasks.js`'s
`getDepartmentTaskIds`: it counted every task including Senior-only ones
regardless of the employee's own level, which is the exact bug the
*original's own comment* on its version of this function documents fixing —
a Junior who finished everything actually required of them would be stuck
below 100% because the denominator kept counting tasks they were never asked
to do. `getDepartmentTaskIds` now takes a `level` argument and filters by
`isItemVisible`, defaulting to `'junior'` (the strictest filter, so an
omitted level can't silently over-count). Its other two callers
(`hasStartedDepartment`, and `switchDepartment`'s progress-clearing) pass
`'senior'` explicitly instead, since both need the widest possible id set
regardless of the employee's actual level — "has this department been
started at all" and "delete every trace of the old department" are both
superset-safe operations that must not miss a stray senior-only id.

## Department Selection is rich cards, not plain buttons

The department grid on Required Documents was a plain button per department
(label only) — the original (`content.html`'s `deptgrid` section) is a
numbered card per department: an icon, a one-line description, "Led by
<head>", "Focus: <words>", and a "Choose this department →" CTA, plus a
footer note below the grid about switching later. `data/departments.js` now
carries a `deptCard` field per entry (icon key, desc, focus) copied verbatim
from `content.html`'s `depts` array, and `components/deptIcons.jsx` redraws
the five icons as simple line SVGs (the original's icon sprite isn't
portable, so these are redrawn, not traced — close enough to read the same at
a glance). `RequiredDocuments.jsx` renders the cards from `DEPARTMENTS`
joined with `ALL_DEPARTMENTS` (for routing), keeping the existing
`areRequiredDocsComplete` gate check in the card's click handler unchanged.

One deliberate discrepancy carried over intact: the "property" department's
card label is "Asset Management Team", while its own outer `label` field
(used elsewhere, e.g. page titles) is "Property & Asset Management" — this
is not a bug, `content.html`'s own `depts` array has the same split for this
one department.

## The sidebar has to stay pinned to the viewport

`<aside>` in `Layout.jsx` is `md:sticky md:top-0 md:h-screen`, not an ordinary
flex child. Left to size itself it stretches to the full document height —
2,821px on the home page — which pushes anything anchored to its bottom
(Settings, Admin, the signed-in email) down by the same amount. On a page that
tall, that footer sat around y=2700: present in the DOM, invisible without
scrolling the entire page first.

The original has the same shape for the same reason:
`position: fixed; top: 0; bottom: 0; overflow-y: auto`. Below `md` the sidebar
stays a normal stacked block, matching the original's mobile drawer behaviour.
