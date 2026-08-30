# VCB 90-Day Onboarding Portal

A Google Apps Script web app that walks new hires at **Vichitbhan Construction Co., Ltd.** through a 90-day onboarding journey: required documents, department selection, and three 30-day checklist phases, ending in a completion celebration.

Live app is a Google Apps Script **web app deployment** (not a Node/npm project) — there is no build step, no server framework, no database. Everything runs as HTML Service pages served by `Code.gs`, with progress persisted to a Google Sheet and uploaded documents saved to Google Drive.

This is deliberately a **lightweight orientation aid, not an HR-monitored system**: the 90-day process is short, every employee prints a completion form at the end regardless, and there is no admin/HR progress-tracking dashboard or aggregate rollup across employees — that was an explicit, considered decision (read the raw Google Sheet directly if you need to know who's engaged), not a missing feature. Notification emails (welcome/stall/completion) were surveyed and explicitly deferred as out of scope. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#product-framing-a-lightweight-orientation-aid-not-an-hr-monitored-system) before proposing either.

**Mobile matters.** New hires open this on a phone. The mobile drawer has three separate traps that each render the whole app unusable (stuck-open sidebar, unscrollable page) and that a default Playwright harness will *not* reproduce — read [ARCHITECTURE.md's mobile drawer section](docs/ARCHITECTURE.md#the-mobile-drawer-below-980px--three-traps) before touching the sidebar, `styles.html`'s top-level `html, body` rule, or anything animated.

## Start here

| If you want to... | Read |
|---|---|
| Understand how the app is put together (files, data flow, rendering pipeline) | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Add/edit checklist content, documents, or department text | [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md) |
| Push a change and deploy it | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Know what's fragile / what broke before and why | [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) |

## Quick facts

- **Script ID**: `15EUqN1-tZYH6_jewkMaXmWpfe7tWIfBWKWaDmxX2XzU8YHA3R49EmLHa`
- **Active deployment ID**: `AKfycbwYEjPc_fS-0ygn4gPg8ePSBIm2DkTyS94BTon-IgC5AtiUYYQnZ6v3seV8GsGwGHrL`
- **Source root pushed by clasp**: [src/](src/) (see [src/.clasp.json](src/.clasp.json))
- **Departments**: Accounting, Finance, Procurement, Property & Asset Management, Engineering — an employee belongs to exactly one at a time.
- **Design system**: ported from the sibling "VCB Connect" web app (dark navy sidebar, electric blue accent, Orbitron/Inter fonts, card-based light/dark theme).

## Repo layout

This folder is the **Google Apps Script** half of the project. The React/TypeScript port lives in a sibling folder — see [../README.md](../README.md) for the top-level map.

```
ORIGINAL CODE/                   ← the Google Apps Script app (this folder)
├── README.md                    ← you are here
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CONTENT_GUIDE.md
│   ├── DEPLOYMENT.md
│   └── KNOWN_ISSUES.md
├── src/                         ← the actual Apps Script project (clasp root)
│   ├── Code.gs                  server-side: routing, Sheet/Drive persistence, admin auth
│   ├── Index.html                page shell (sidebar, topbar, footer)
│   ├── app.html                  client render engine (SPA-style router + section renderer)
│   ├── content.html               content data model (all page/section content lives here)
│   ├── progress.html              identity, progress state, celebrations, gating logic
│   ├── styles.html                 full CSS theme
│   ├── icons.html                   shared SVG icon library
│   ├── translations.html             EN → TH string dictionary
│   ├── images.html                    embedded base64 images (large file)
│   ├── admin.html                      password-gated checklist editor UI
│   └── appsscript.json / .clasp.json   Apps Script + clasp config
├── verify/                      ad-hoc local verification scripts (see below)
├── VCB Onboarding Portal.gscript             Drive shortcut → the live Apps Script project
└── VCB Onboarding Portal — Progress Data.gsheet   Drive shortcut → the progress spreadsheet
```

Run `clasp` commands from inside `src/` — that is where `.clasp.json` lives. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).


## Local verification (no live Apps Script needed)

There's no test framework — verification so far has been done with small one-off Node scripts that `new Function()` the stripped `<script>` contents of each `.html` file to catch syntax errors before pushing, and occasionally a `vm`/mocked-DOM harness to exercise a specific function in isolation. See [verify/](verify/) for examples and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#verify-before-you-push) for the pattern.

## Making changes

1. Edit files under [src/](src/) directly — they're plain HTML/JS/CSS, no compilation.
2. Run a syntax check (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).
3. `npx clasp push` from inside `src/`.
4. `npx clasp deploy --deploymentId <id> --description "..."` to update the live URL (a plain push alone does **not** update the deployed web app).
5. Ask a real person to click through the golden path in a browser — there is no automated UI test, and this app has a history of bugs that only showed up live (see [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md)).
