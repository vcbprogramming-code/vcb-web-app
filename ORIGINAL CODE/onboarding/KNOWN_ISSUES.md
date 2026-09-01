# Known Issues & Fragile Areas

This project has been built up over many iterative rounds with a client who tests live and reports bugs by screenshot. Several bugs took multiple rounds to actually fix because a change that looked correct in isolation didn't hold up against the live app. This doc exists so the next person doesn't have to rediscover the same failure modes.

## RESOLVED/HISTORICAL: the gated-panel reveal system (replaced by a real Completion page)

**This entire mechanism no longer exists in the current code.** Everything below describes an async placeholder-swap system (`requireOnboardingComplete`, `revealGatedSections`/`revealGatedSectionsForCurrentPage`, `syncGatedSectionsVisibility`, `data-gated-section` placeholder divs) that was **removed entirely** and replaced with a real dedicated page, `PAGES['completion']`, gated by a plain synchronous `isEmployeeOnboardingComplete()` check in `renderPage` — the same pattern every other access-gated page in this app already uses. See [ARCHITECTURE.md's Completion page section](ARCHITECTURE.md#the-completion-page-meet-our-team--life-on-site--return-to-portal). The replacement happened *specifically because* of the fragility documented below — five real rounds of bugs, and it still sometimes didn't appear right away even after all five fixes. `grep -r "revealGatedSections\|requireOnboardingComplete\|data-gated-section" src/` today only turns up comments narrating this history, not live code.

The specific bug chain below is kept for its lessons, not because it's a live risk — none of the functions it names (`revealGatedSections`, `syncGatedSectionsVisibility`) exist anymore, so this exact chain cannot recur. The general lesson in bug #5 (an `outerHTML`/`innerHTML` replacement silently dropping an attribute a later lookup depends on) is still broadly useful for any DOM-replacement code in this app — keep that pattern in mind elsewhere, just don't expect to find these specific functions to "fix."

<details>
<summary>Original entry (historical — mechanism no longer exists)</summary>

The Meet Our Team / Life on Site / Return to Portal panel went through at least five rounds of real bugs before it worked correctly end-to-end, back when it was an in-place gated reveal rather than its own page. If you're reading this while investigating a *different, new* live-render bug in this app, re-test the **full cycle live**, not just one direction — the underlying discipline (test the whole state cycle, not just the happy path) still applies even though this specific code is gone:

1. Complete every task → popup shows → close it → panel fades in.
2. Uncheck one task → panel fades out (no popup).
3. Re-check everything → popup shows *again* → panel fades in *again* — **without reloading the page**.
4. Reload the page while already complete → panel is visible immediately, no popup, no animation.

Bugs found and fixed, in order (each seemed like "the fix" at the time):

1. **Completion never detected at all.** `wasOnboardingComplete` was computed inside `updateChecklistUI`, which runs *after* `performToggle` had already mutated `PROGRESS_CACHE` — so "before" and "after" were always identical and the true→false→true transition could never be observed. Fixed by snapshotting `wasOnboardingComplete` in `performToggle`, before the mutation, and passing it in as a parameter.
2. **The gated section didn't exist on the pages where employees actually finish.** `homeFeatureGridSection()` was only ever added to `PAGES['home']`'s sections — never to the department phase pages themselves. An employee finishing Day 61–90 on, say, the Engineering page would never see it unless they separately navigated back to Home. Fixed by having `phasePage()` append `homeFeatureGridSection()` automatically whenever a phase's `closing` is a plain string (true only for each department's last phase).
3. **Checking the last box didn't trigger anything live.** `revealGatedSections()` — the function that actually swaps the placeholder for real content — was only ever called from `renderPage()`, i.e. only on navigation or reload. Checking a checkbox doesn't re-run `renderPage()`. Fixed by exposing `window.revealGatedSectionsForCurrentPage()` from `app.html` and calling it from `celebrateOnboardingComplete()`'s popup-close handler.
4. **Still invisible even with all of the above fixed.** Root cause: the CSS defaulted `.reveal-fade { opacity: 0; }`, made visible only by a separate `.reveal-fade-in` class added via nested `requestAnimationFrame` calls, on a DOM node that had also been juggled through a detached `wrapper.innerHTML` + `replaceWith()` step. Any single link in that chain failing silently left the section permanently invisible with no error. Fixed by (a) using a direct `el.outerHTML = ...` string replace instead of building and reattaching a detached node, and (b) inverting the CSS default so `.reveal-fade` is `opacity: 1` (visible) unless the *pending* class `.reveal-fade-pending` is explicitly present — correctness-first: a failed animation step just means "no animation," never "invisible forever."
5. **Worked on the first completion, but a second completion after unchecking something never came back — even without a reload.** Root cause: `syncGatedSectionsVisibility()` (the fade-out-on-uncheck path) was deleting the revealed `<section>` from the DOM entirely, but `revealGatedSectionsForCurrentPage` finds sections to fill in via `document.querySelector('[data-gated-section="pageKey::index"]')` — an attribute that only ever existed on the *original placeholder* `<div>`, never on the `<section>` that replaced it. Once deleted, there was nothing left in the DOM matching that selector for a future re-completion to find. Fixed by (a) stamping the rendered section with `data-gated-key="pageKey::index"` when it's first revealed, and (b) having the fade-out path read that key back and swap the section for a *fresh empty placeholder* carrying the matching `data-gated-section` attribute, instead of deleting it outright.

**Lesson for future "works once, breaks the second time" bugs in this app**: suspect that a DOM node produced via an `outerHTML`/`innerHTML` replacement dropped an attribute or reference that a *later* lookup depends on. Trace what selector the "restore" path uses, and confirm the "remove/hide" path actually leaves something matching it behind.

</details>

## Org Chart / Group Structure connector lines are the second most fragile part of this app

See [ARCHITECTURE.md](ARCHITECTURE.md#org-chart--group-structure) for how these lines actually work (real measured DOM divs, not CSS). This section has broken and been "fixed" many times across sessions, almost always one of two ways:

1. **Stale selector after a markup rework.** `renderGroupStructureTrunk` measures each family card's position via a specific child selector (`slot.querySelector('.some-class')`). When the family cards' markup changed from static `.group-entity-card` → click-to-expand `.org-team`/`.org-team-btn` → hover tooltip `.group-family-btn`, the trunk-drawing function had to be updated *every single time* to match — and once wasn't, which silently produced zero connector lines to those two cards (the selector matched `null`, so `if (!card) return` skipped them) with no console error. **Whenever you change a connector-participating card's DOM structure, grep every other function in `app.html` that queries into it by class name before considering the change done.**
2. **N parallel drops instead of a real fork.** Drawing 3 independent vertical lines from the same Y coordinate does not read as "one thing splitting into three" — it reads as three unrelated lines, because nothing visually joins them. Every real fork in this app (Org Chart segments, Subsidiaries/Joint Ventures split, the family row) needs an explicit horizontal `.org-branch-bar` spanning `min`/`max` of all branch centers, drawn *before* the vertical drops.

Also hit once: a chart-wide CSS class meant to scope one interaction (`.org-chart.focused`, fades sibling `.org-team` elements when one expands) leaked across unrelated sections sharing the same `[data-org-chart]` container — expanding a Group Structure family card was fading out unrelated Joint Venture cards elsewhere on the page. Any "focus mode" class shared by multiple unrelated sub-features needs either an explicit scope exclusion or (better, as eventually done here) for the triggering elements to not use that shared mechanism at all.

**Verification discipline that actually catches these**: build a throwaway harness resolving `Index.html`'s `include()` calls to the real partial files in real order, set `window.INITIAL_PAGE`, drive it with Playwright — screenshot AND assert real `getBoundingClientRect()`/computed-style values (bar count, drop count, positions, computed `color`/`opacity`), not just "looks right" by reading the code. Several fixes in this area that were correct by reasoning alone turned out wrong when actually rendered.

## Include-order / IIFE-wrapping trap

`Index.html` includes files in this exact order: `icons.html → translations.html → images.html → content.html → progress.html → admin.html → app.html`. `content.html` calls `esc()` and `t()` even though those are defined in files that load *after* it — this only works because `esc`/`t`/everything in `progress.html` are plain top-level declarations (globals), not wrapped in an IIFE, so they exist on `window` by the time anything actually *calls* them at render time.

`app.html` **is** wrapped in an IIFE. If you need another file to call something inside `app.html`, you must explicitly attach it to `window` (as already done for `revealGatedSectionsForCurrentPage`) — a plain function declaration inside `app.html`'s IIFE is invisible everywhere else. This exact mistake happened once already: `progress.html` tried to call `app.html`'s private `pageUrl()` helper and failed silently; the fix was to inline the URL-building logic (`'?page=' + encodeURIComponent(...)`) directly in `progress.html` instead of trying to share the helper.

**Do not wrap `content.html` or `progress.html` in an IIFE** without also auditing every cross-file call site — it will silently break things that currently work.

## RESOLVED: silent save failures on checklist/document toggles

Previously, `setTaskDone` calls from checklist and Required Documents toggles were genuinely fire-and-forget — no success or failure handler at all. A failed Sheet write (network blip, quota hiccup) left a checkbox visually checked with nothing actually persisted, with zero indication anything went wrong; the employee's eventual printed 90-day form could silently disagree with what they saw on screen. Fixed: both `performToggle` and `toggleDocTask` (progress.html) now route through `syncTaskDone(name, taskId, newState, checkboxEl, onReverted)`, which retries once automatically, and on a second failure reverts `PROGRESS_CACHE` + the checkbox and shows a red warning toast (`showSaveFailedToast()`). Still optimistic (the checkbox flips before the round-trip resolves) — just no longer silent on failure. See [ARCHITECTURE.md's Progress cache section](ARCHITECTURE.md#progress-cache).

## `getDepartmentPhaseChain` page-key matching

`getDepartmentPhaseChain(deptId)` finds a department's first phase page by filtering `PAGES` keys that start with the department's `prefix` **and contain `-day-`**. The `-day-` filter is load-bearing: without it, the department's plain landing page (e.g. `accounting-team`, which shares the same `accounting-` prefix but isn't a phase page and has no checklist) gets mistaken for "phase 1," and `isEmployeeOnboardingComplete()` silently reports `true` for anyone who has merely visited the landing page. If you add a new page whose key starts with an existing department's prefix, make sure it either contains `-day-` (if it really is a phase) or doesn't accidentally look like one.

## Explicit client constraints — do not violate these without checking first

- **Don't touch the visual content or styling of `celebrateOnboardingComplete()` or `celebrateSectionComplete()`** (both in `progress.html`). The client explicitly signed off: *"The completion screen looks perfect. Do not change anything about the pop-ups."* Logic around *when* they're called is fair game; their HTML/CSS content is not.
- **No "Knowledge Library."** Explicitly out of scope — a separate application handles that.
- **Exactly 3 checklist blocks per phase, 4–5 items each** (Required Reading / Knowledge Requirements / Required Outputs). This was a deliberate simplification from a much longer earlier version, to match "other company standard." Don't let a future content edit quietly grow a phase back past this.
- **One department at a time, strictly sequential phases, confirm-to-switch.** An employee cannot work on two departments simultaneously, and switching departments deletes the old department's progress (both locally and server-side) after an explicit confirmation modal. This was a deliberate client decision, not an oversight to "fix."

## Things that were tried and deliberately reverted

- `jsdom` and `sharp` were installed as npm dev dependencies temporarily (for local DOM simulation and cropping icon images out of a sprite sheet respectively), then explicitly uninstalled along with `node_modules`/`package.json` once no longer needed. `clasp` never pushes `node_modules` or `package.json` anyway (see [DEPLOYMENT.md](DEPLOYMENT.md#what-clasp-actually-pushes)), so there's no runtime reason to keep them — if you reintroduce either, uninstall and clean up again once done, per the same practice.
- An earlier icon system was plain emoji; replaced project-wide with the SVG icon library in `icons.html` to match the sibling VCB Connect app's design language. Don't reintroduce emoji icons.
- **Project Sites' card layout (Site Operations/Site Administration) went through a conditional-layout phase and back out of it.** One version made the side-by-side column layout appear ONLY when a project card was focused/isolated (`.org-chart.focused .org-project.open`), with a separate plain-stacked layout for the "everything expanded by default" state. This was explicitly reverted — both states rendered identical content, so maintaining two different CSS layouts for the same data added complexity with no real payoff. The side-by-side layout (Site Operations left, Site Administration right) is now unconditional for every opened project. See [ARCHITECTURE.md](ARCHITECTURE.md#project-card-layout--one-layout-always-side-by-side-settled-august-2026) for the full history — don't reintroduce a `.focused`-conditional layout here without a genuinely new reason, since this exact idea has already been tried and undone once.
- Each Project Manager originally had a distinct one-sentence description ("Oversees subcontractor performance...", "Tracks project milestones...", one per project). Reverted to one shared description (`PM_ROLE` in content.html) — every PM at every site does identical work, so distinct sentences misrepresented that rather than just being repetitive filler.

## RESOLVED (v184): department switch deleted nothing server-side

`clearDepartmentProgress` matched `taskId.indexOf(pagePrefix) === 0`, where the
client passes a PAGE-key prefix (`"accounting-"`, from `DEPARTMENTS` in
progress.html) but task ids on the sheet use the abbreviated stable-id scheme
(`acct-p1-know-3`) since `migrateTaskIdsToStableIds` ran. `"acct-...".indexOf("accounting-")`
is `-1`, and the same held for all five departments — so the function scanned the
sheet and deleted **zero rows, every time**.

User-visible effect: the confirm modal promised the old department's progress was
gone; only the in-memory `PROGRESS_CACHE` was actually cleared, so it *looked*
right until the next page load, when `getProgress` returned the untouched rows and
the old checkmarks came back. Switching back could show an employee as instantly
complete.

Fixed by translating through the same `TASK_ID_DEPT_ABBR_` map the migration used,
so the two cannot drift apart again. The failure handler also no longer swallows
errors silently.

**Lesson**: this is a migration-shear bug — the prefixes genuinely matched when
task ids were page-key-based, and changing the id scheme broke a *different*
function that had hardcoded an assumption about their shape. When you change an
id format, grep for every `indexOf(`/`startsWith(`/`split(` against that id
anywhere in the codebase, not just the code you're editing.

## RESOLVED (v184): the admin password gated the UI, not the data

`saveChecklistItem` and `deleteChecklistItem` took no password and performed no
authorization check whatsoever. The gate lived purely in `admin.html`'s render
flow: `adminPassword` was captured at the prompt and **never sent with any
save/delete call**. The comment on `checkAdminPassword` claimed the client
"resends it with every save (see saveChecklistItem's call sites in admin.html)" —
that was never true of any call site.

Because `appsscript.json` deploys with `access: ANYONE`, any visitor could open
devtools and call `google.script.run.deleteChecklistItem('acct-p1-know-1')` to
rewrite or delete any department's checklist without seeing the prompt. Deletes
are soft but not reversible from the UI.

Fixed: every mutating entry point now takes a `password` argument and calls
`requireAdmin_(password)`, which throws on failure; all four `admin.html` call
sites pass `adminPassword`. `getChecklistOverrides` stays unauthenticated by
design (its content is rendered into every employee's page anyway).

**Lesson**: a comment asserting that a security check happens is not evidence that
it does. Both false comments in this file were found by grepping for the variable
the comment named (`adminPassword` appeared at only 4 lines, none of them a send)
rather than by reading the prose.

## RESOLVED (v184): a failed progress load rendered as "nothing completed"

`loadProgress`'s failure handler set `PROGRESS_LOADED = true` and called back with
the empty cache, so a transient network failure rendered a fully-unchecked
checklist — visually identical to a genuinely new employee, with no error shown.
An employee re-ticking boxes was then writing on top of saved state they couldn't
see, and because the flag was set it never retried for the life of the page.

Fixed: the flag is no longer set on failure (so the next navigation genuinely
retries) and a warning toast is shown. Note the *write* path (`syncTaskDone`) had
already been hardened this way; only the read path was still silent.

## Sheet writes are now serialized with LockService

`setTaskDone`, `saveChecklistItem`, `clearDepartmentProgress`, and `renameEmployee`
are read-scan-then-write upserts with no atomicity of their own. Two concurrent
calls for the same key both scan, both find nothing, and both append — producing
duplicate rows. That is reachable in normal use: `syncTaskDone` retries once
automatically (so a call that times out client-side but succeeded server-side hits
it), and the admin reorder fires one `saveChecklistItem` per item in parallel.

A duplicate was near-permanent: the scan stops at the first match, so a later
un-tick updated only one row and `getProgress` still saw the stale `true` from the
other — the task appeared permanently complete and could not be unticked.

All four now wrap their read-write in `LockService.getScriptLock()` with a 15s
timeout, throwing "Server busy, please try again." on contention (surfaced by
`syncTaskDone`'s existing retry-then-revert path).

**Still unaddressed**: these functions full-scan the sheet on every call, so
per-click latency grows with total row count. Fine at current scale; revisit with
a per-employee sheet or `CacheService` if the sheet reaches several thousand rows.

## RESOLVED (v185): the mobile drawer was stuck open, and the page could not scroll

**The most severe bug this app has shipped** — the portal was effectively unusable on a phone: the sidebar covered the content, could not be closed, and nothing below the fold could be reached. It survived a full round of "verified" fixes (v184) because of how it was tested, which is the real lesson here.

Three independent causes, all producing the *same* symptom:

1. **`.sidebar { animation: app-enter .55s ease both }` overrode the drawer's positioning.** The desktop entry fade animates `transform` and ends on `transform: none`, and fill-mode `both` makes that final value stick permanently. A running animation's value beats a plain CSS declaration, so it silently defeated `transform: translateX(-100%)`. The drawer was never "opening" — it had simply never left the screen. Fixed with an explicit `animation: none` inside the `max-width: 980px` block; it must be *cancelled*, not overridden.

2. **The `prefers-reduced-motion` block cancelled the drawer's positioning too.** It applied `transform: none !important` to `.sidebar` (intending only to suppress the entry animation), which also killed `translateX(-100%)` — so every phone with "Reduce Motion" enabled got a permanently-open drawer. Fixed by scoping the `transform` override to `.settings-wrap`/`#app.app-enter > *` and leaving `.sidebar` with only `animation`/`opacity`.

3. **`html, body { height: 100% }` + `overflow-x: hidden` clipped the document to one viewport.** The page could not scroll at all; `scrollHeight` equalled `clientHeight` (780px on a 360px phone) even though the real content was ~5300px. Fixed by dropping to `min-height: 100vh`. A `body.nav-open { overflow: hidden }` scroll lock added in v184 compounded this and was removed — **do not reintroduce a body scroll lock here**, it re-creates the failure.

### Why two rounds of verification missed it

The local harness drove Playwright with its **default `reducedMotion: 'reduce'`**, which suppressed cause #1 — so the drawer measured and screenshotted *correctly* in the harness while being broken on every real phone. Worse, the correct-looking measurements were then used to argue the remaining problem was browser cache, which sent a round of debugging in the wrong direction entirely.

**Verification discipline for anything involving the drawer, animations, or viewport sizing:**

- Test under **both** motion settings: `newContext({ reducedMotion: 'reduce' })` **and** `'no-preference'`. A default-only run silently tests one branch of a two-branch stylesheet.
- Test **inside an iframe** — Apps Script serves the app sandboxed, and `vw` units resolve against a viewport that does not reliably match the visible frame. An attempted `min(86vw, 320px)` drawer width measured correctly locally and mis-sized here; percentages against the containing block behave correctly in both.
- Assert the sidebar's real `getBoundingClientRect().x` (negative when closed, `0` when open) — **not** the presence of the `.open` class, which was present and correct the entire time the drawer was visibly broken.
- Assert `document.documentElement.scrollHeight > clientHeight` and that `window.scrollY` actually changes. Note `scroll-behavior: smooth` is set globally, so an instant `scrollTo` followed by an immediate read returns `0` — wait for it to settle, or pass `behavior: 'instant'`, before concluding scrolling is broken.

**General lesson**: when a user reports a symptom your harness cannot reproduce, the harness's *defaults* are the first suspect — not the user's cache. A test environment that differs from production in one setting will confidently confirm the wrong answer.

## A CSS animation with `fill-mode: both` outranks later declarations

Generalizing cause #1 above, because this will bite again in this file: `styles.html` applies `animation: app-enter ... both` to `.sidebar`, `.settings-wrap`, and `#app.app-enter > *`, and the keyframes end on `transform: none`. Any rule that later tries to set `transform` on those elements — a slide-out drawer, a translated tooltip, a transformed card — **will be silently ignored for as long as the animation applies**, because animated values sit above normal declarations in the cascade. Symptoms look like "my CSS isn't applying" with no error and nothing obviously wrong in the rule itself.

If you need `transform` on one of those elements, cancel the animation for that state (`animation: none`) rather than trying to out-specify it. `!important` on the plain declaration *would* also win, but see cause #2 above for how an `!important` transform in a media block caused its own bug.

## RESOLVED (v187): the Leadership panel was squashed on phones

Leadership rendered as a narrow ~260px column on a 360px phone while Head Office and Project Sites directly below it used the full ~335px chart width.

Cause: `@media (max-width: 640px) { .org-team { width: 100%; max-width: 260px } }` — a cap intended for the small Head Office / Project Site team cards. The Leadership panel carries **both** classes (`class="org-team org-leadership"`, see `renderOrgChart` in app.html), so it silently inherited a constraint written for a different component. Fixed by scoping that rule to `.org-team:not(.org-leadership)`.

Two follow-on traps hit while fixing it, both caught by measuring rather than by reading the CSS:

1. **Removing the cap alone made it overflow.** `.org-leadership`'s base `width: 980px` is wider than `.org-tree`'s own layout box at these widths, so Leadership (and `.org-tree-top` above it) pushed past the chart's right edge. It needs `width: 100%`, not its fixed px width, inside the phone block.
2. **`width: 100%` alone collapsed it instead.** `.org-tree-top` is `display: flex; justify-content: center`, i.e. shrink-to-fit, so a `100%`-wide child just inherits the collapsed size. `.org-tree-top { align-self: stretch }` + `.org-segment-leadership { flex: 1 }` were both required before `width: 100%` meant anything.

### The zoom/media-query mismatch that makes this area deceptive

`.org-chart` is `zoom: 0.66` (→ `0.5` at 480px, `0.42` at 380px), but media queries test the **real** viewport. So at a 360px viewport the chart's internal layout box is ~838px: every px value written inside a phone media block lands at roughly 0.42× its apparent size relative to chart content. A "260px" cap is really ~110px of rendered width there. **When adding any px constraint to an org-chart descendant inside a phone breakpoint, measure the rendered `getBoundingClientRect()` rather than reasoning from the number you typed** — and compare against a sibling that already looks right (Head Office's row width was the reference here; matching it exactly is how the fix was confirmed).
