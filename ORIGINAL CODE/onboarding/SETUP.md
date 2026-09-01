# Deployment

This is a Google Apps Script project managed with [`clasp`](https://github.com/google/clasp) (Google's official CLI). There is no CI/CD — deploys are manual, run from a developer machine.

## Key IDs

- **Script ID**: `15EUqN1-tZYH6_jewkMaXmWpfe7tWIfBWKWaDmxX2XzU8YHA3R49EmLHa` (see [src/.clasp.json](../src/.clasp.json))
- **Active web app deployment ID** (the URL HR/employees actually use): `AKfycbwYEjPc_fS-0ygn4gPg8ePSBIm2DkTyS94BTon-IgC5AtiUYYQnZ6v3seV8GsGwGHrL`
- There is also a separate `@HEAD` deployment (`AKfycbwW09hSJ-a1JnoC-YiWb3VpyjjYYfCVcEk7JhAa_-Q`) that clasp creates by default — **this is not the one that matters**. Always deploy to the deployment ID above (or whatever ID you're given) explicitly, or your change will push to the script project but never reach the live URL.

If you're not sure which deployment ID is currently live, ask before assuming — deploying to the wrong ID silently does nothing visible and wastes a round trip of "why isn't my change showing up."

## The two-step deploy

`clasp push` alone is **not enough**. It uploads your source to the script project, but the web app's live URL keeps serving whatever was deployed last until you explicitly redeploy that deployment ID.

```bash
cd src
npx clasp push
npx clasp deploy --deploymentId AKfycbwYEjPc_fS-0ygn4gPg8ePSBIm2DkTyS94BTon-IgC5AtiUYYQnZ6v3seV8GsGwGHrL --description "short description of what changed"
```

Both commands must be run from inside `ORIGINAL CODE/src/` (that's where `.clasp.json` lives, pointing at the script ID above).

If `clasp` prompts a re-auth / `invalid_grant` error, that's a local credential expiry (`clasp login` again) — not a project misconfiguration.

## Verify before you push

There's no automated test suite. The one mechanical check available is a syntax pass over every `<script>` block, using plain Node (`new Function(code)` throws on real syntax errors without executing anything):

```bash
node verify/check-syntax.js
```

This catches typos and mismatched braces before they reach production — it does **not** catch logic bugs. It will report one expected failure on `Index.html`'s first script block (`<script>window.INITIAL_PAGE = <?!= ... ?>;</script>`), which contains Apps Script templating that isn't valid JS until the server renders it — that one failure is normal and documented in the script's own comments.

Beyond that, this project has relied on ad-hoc Node scripts (mocked `localStorage`/`document`, or a `vm` sandbox loading the stripped `<script>` contents) to exercise a specific function in isolation before deploying — e.g. simulating `getDepartmentPhaseChain()` against the real `PAGES` keys to catch a page-key matching bug, or stepping through `performToggle`/`updateChecklistUI`'s before/after state to confirm a celebration actually fires. There's no fixed harness for this; write a throwaway script in the scratchpad, or add a durable one under `verify/` if it's likely to be needed again.

## Rendering harness (Playwright) — and the settings that make it lie

For anything visual, the useful harness resolves `Index.html`'s `include()` calls to the real partials in real order, stubs the two `<?!= ?>` scriptlets, and drives the result with Playwright. Write it in the scratchpad (install Playwright there, not in the project — see the "deliberately reverted" note in [KNOWN_ISSUES.md](KNOWN_ISSUES.md) about not leaving npm deps behind).

Three defaults in that harness have each produced a *confidently wrong* verification in this project. Set them explicitly:

1. **`reducedMotion`.** Playwright defaults to `'reduce'`. `styles.html` has a `prefers-reduced-motion` block that changes real layout behavior, so the default tests only one branch — this is exactly how a completely broken mobile drawer passed a full round of verification (v184). Always run **both** `newContext({reducedMotion:'reduce'})` and `'no-preference'`.
2. **The iframe.** Apps Script serves the app inside a sandboxed iframe where `vw` units resolve against a viewport that need not match the visible frame. Load your harness inside an `<iframe>` before trusting any viewport-relative measurement.
3. **`scroll-behavior: smooth`** is set globally, so `window.scrollTo(0, N)` followed by an immediate read returns `0`. Wait for it to settle or pass `behavior:'instant'` before concluding scrolling is broken.

Assert real geometry (`getBoundingClientRect()`, computed styles), not state classes: the drawer's `.open` class was present and correct the entire time the drawer was visibly broken. And when a user reports something the harness cannot reproduce, **suspect the harness's defaults before blaming browser cache** — that misdiagnosis cost a full round trip.

## After deploying: test live

This app has a real history of bugs that passed every static/simulated check but only showed up in an actual browser against the live deployment (see [KNOWN_ISSUES.md](KNOWN_ISSUES.md) — the old in-place gated-panel reveal, since replaced by a dedicated Completion page, took five rounds precisely because of this). After any change touching:
- progress/completion state,
- the Completion page (`PAGES['completion']`) or `celebrateOnboardingComplete()`,
- department switching,
- document upload,
- **the sidebar, `html`/`body` sizing, or anything animated** — check on a real phone, in both Reduce Motion states,

click through the actual golden path in a browser against the live URL (ideally as a fresh employee — clear `localStorage` for the domain, or use a private window) before considering the change done. Don't rely solely on "the syntax check passed."

## What clasp actually pushes

Only the files matched by `.clasp.json`'s extension filters (`.gs`, `.html`, `.json`) under `src/` are pushed — currently: `Code.gs`, `Index.html`, `admin.html`, `app.html`, `content.html`, `icons.html`, `images.html`, `progress.html`, `styles.html`, `translations.html`, `appsscript.json`. Nothing outside `src/` (this repo's `docs/`, `verify/`, `README.md`, the `VCB Onboarding Portal - Images/` source-asset folder) is ever deployed — those are developer-facing only.

## Backend data created on first use (not part of source control)

- **Progress spreadsheet** — "VCB Onboarding Portal — Progress Data", created automatically by `Code.gs`'s `getProgressSheet_()` the first time any employee's progress is read or written. Its ID is stored in the script's Property Store (`PROGRESS_SS_ID`), not in source.
- **Document upload folder** — "VCB Onboarding Portal — Document Uploads" in Drive, created by `getDocUploadFolder_()` similarly, ID stored as `DOC_UPLOAD_FOLDER_ID`.

If you ever need to reset all progress data for testing, the safe way is to find these by name in the Sheets/Drive UI (or `PropertiesService.getScriptProperties()` in the Apps Script editor) — don't guess at IDs.
