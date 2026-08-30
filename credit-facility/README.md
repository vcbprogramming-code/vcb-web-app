# VCB Credit Facility Web App

> **Live app:** <https://script.google.com/macros/s/AKfycbytkA07aNklbDv3gKca-iI02FPCdC1Q0i3gAtE1Ls1ry9MCoIUmG_KabhCBip8C0vn91g/exec>
> **Access:** the whole app requires signing in with a Google account (deployment access = "Anyone with Google Account"). The dashboard cards sit on top of every tab; there are three tabs — Facilities, Credit Ledger, T-bar.
> **Deployed from:** [ORIGINAL CODE/](ORIGINAL%20CODE/), via `clasp` — see [ORIGINAL CODE/SETUP.md](ORIGINAL%20CODE/SETUP.md)
> **Thai stakeholder summary:** [ORIGINAL CODE/สรุปโปรเจกต์.md](ORIGINAL%20CODE/สรุปโปรเจกต์.md)
> **UI / design conventions:** [ORIGINAL CODE/DESIGN.md](ORIGINAL%20CODE/DESIGN.md) · **Change history:** [ORIGINAL CODE/CHANGELOG.md](ORIGINAL%20CODE/CHANGELOG.md)
> **React/Vercel mirror:** [FOR DEPLOYMENT TEAM/](FOR%20DEPLOYMENT%20TEAM/) — a deploy-ready Vite + React + TS replica of this app
> (typed mock backend). It's a **live mirror of the GAS source**; re-sync after any change here —
> see [FOR DEPLOYMENT TEAM/PORT_NOTES.md](FOR%20DEPLOYMENT%20TEAM/PORT_NOTES.md). The GAS files in `ORIGINAL CODE/` stay canonical.

## Overview
This project is a Google Apps Script-based web application for managing credit facilities and credit requests across multiple projects for VCB Group. It provides:
- credit facility tracking by project and facility type
- request creation and approval workflows
- ledger-style transaction recording for credit usage
- limit override management and audit logging
- an interactive browser UI served from Google Apps Script

The application is backed by a master Google Sheet and seeded from embedded project and facility data.

## Key Files
- `Code.js`
  - Main server-side script for Google Apps Script
  - Handles web app rendering (`doGet`), sheet schema setup, data reads, and write operations
  - Implements request/transaction operations, limit overrides, status updates, settlements, and audit logging
- `Seed.js`
  - Contains seed datasets:
    - `SEED_PROJECTS` (project codes, Thai names, companies)
    - `SEED_FAC_TYPES` (facility types and document kinds)
    - `SEED_FACILITIES` (baseline facility lines with limits and used amounts)
    - `SEED_TXNS` (seeded transactions used to initialize balances)
- `index.html`
  - Client-side UI and CSS
  - Uses inline JavaScript to render facilities, requests, ledger tables, filters, modals, and export functionality
  - Provides controls for adding requests, adding transactions, exporting data, and toggling dark mode
- `appsscript.json`
  - Google Apps Script manifest
  - Configured with scopes for Sheets, Drive, external requests, and user email
  - Web app access: `ANYONE`, executed as `USER_DEPLOYING`

## Data Model
The app uses a master Google Spreadsheet with these tabs:
- `Facilities` — seeded facility lines for each project and credit type
- `Transactions` — all ledger entries, including credit requests, approvals, settlements, and quick credit usage
- `Requests` — request records for credit proposals (mapping back to transactions)
- `Limits` — optional per-project override values for facility limits
- `Audit` — audit trail of add/edit/delete/status changes with user/time metadata
- `CashPlan` — monthly cash planning rows (not yet fully described in current code)

The sheet schema is enforced in `ensureSchema_` so new columns can be appended safely and missing tabs are auto-created.

## Runtime Behavior
- `doGet()` serves the `index.html` UI when the web app is opened.
- `getData()` reads from the master sheet and returns:
  - authenticated user info (`whoAmI()`)
  - seed project and facility metadata
  - merged facility balances with applied limit overrides
  - transaction records and request records
- `getMaster_()` opens the master sheet by ID from script properties or creates a new master sheet automatically (`setupMaster_`).
- Seed data is used as a baseline for facilities and initial ledger state, while sheet data captures all user interactions.

## Core Features
### Facility Tracking
- Facilities are defined by project, facility number, type, limit, used amount, interest, and notes.
- Available balance is computed from the seeded baseline and transaction deltas.
- Limit overrides stored in the `Limits` tab can change a facility cap without altering seed data.

### Transaction Ledger
- Transactions include entries for credit usage, settlements, and request lifecycle events.
- Only authorized entries (`อนุมัติแล้ว` / `active`) count toward used facility balances.
- Settled entries (`ชำระแล้ว`) release used credit.
- Seed transactions are treated as pre-existing baseline history and only affect balances when settled.

### Requests and Approvals
- Requests are created through the UI and stored as transaction records with a pending status.
- Manager approval logic exists in `decideRequest()` but is primarily implemented for the `Requests` sheet.
- When a request is approved, a linked transaction is created to convert it into an active credit usage entry.

### Write Operations
Supported operations include:
- `addRequest()` — save a new credit request as a transaction entry
- `updateRequest()` — edit an existing transaction/request row
- `addTransaction()` — quick-add a direct authorized credit usage entry
- `setTxnStatus()` — update transaction status (approve, settle, etc.)
- `settleTxn()` — mark a transaction as paid
- `deleteRequest()` / `deleteTxn()` — remove a transaction row
- `setLimit()` — add or update facility limit overrides

### Audit Logging
- `audit_()` records user actions in the `Audit` sheet.
- Changes are captured as JSON or string diffs for visibility.
- All write methods use `withLock_()` to serialize updates and prevent race conditions.

## User Interface
- Built entirely inside `index.html` with CSS and inline JS.
- **Dashboard cards sit on top of every tab** (rendered by `cards()`), in four labelled sections — laid out 2×2 on desktop, stacked 2-up on phones. Clicking a card filters and jumps to the matching tab below:
  - `วงเงินสินเชื่อ (วงเงินกู้ระยะยาว)` — long-term: **T/L** + **BG** (the three guarantee lines combined)
  - `วงเงินสินเชื่อ (วงเงินหมุนเวียน)` — revolving: **B/E** + **P/N**
  - `ครบกำหนด` — due **this month** / **next month**
  - `สถานะ` — **รออนุมัติ** (new + proposed) / **อนุมัติ** (approved)
- Three tabs below the cards (no separate Dashboard tab — the cards are always visible):
  - `Facilities` — facility limit / used / available table with % bars
  - `Credit Ledger` — the merged request + usage ledger (add/edit, change status, settle)
  - `T-bar` — monthly cash-plan / due-date planner
- Filter controls for project, company, facility type, due window, status, and search. The status filter includes a combined **"รออนุมัติ (ใหม่/เสนอ)"** option matching the dashboard's pending card.
- Modal dialogs support adding/editing requests and transactions, limit adjustments, and confirmations.
- Dark mode persists via `localStorage`.
- The **"VCB Group" wordmark in the header links back to the VCB Connect portal** (`target="_top"`, so it escapes the Apps Script iframe). The portal URL is hard-coded in the `a.bg` markup — see [ORIGINAL CODE/DESIGN.md §6](ORIGINAL%20CODE/DESIGN.md).

### Design system
The UI follows a **"refined corporate"** design system documented in [ORIGINAL CODE/DESIGN.md](ORIGINAL%20CODE/DESIGN.md):
CSS design tokens (`--sh-*`, `--r-*`, palette), Inter + Sarabun typography with tabular
numerals, a **masked-SVG icon system** (`.ico-*` — no emoji), light data-grid table headers,
semantic button colors with focus rings, and the Thai↔English i18n approach. **Read DESIGN.md
before making UI changes** so new work stays consistent (e.g. how to add an icon, the
sticky-header caveat, the i18n emoji-key gotcha).

## Access model

The **entire app requires a Google sign-in.** The deployment's "Who has access" is set to **Anyone with Google Account**, so Google forces a login before `doGet` ever runs — every visitor is authenticated. There is a single deployment (the stable `/exec` URL above); no public/anonymous mode.

- The **dashboard cards sit on top of every tab** (rendered by `cards()` on each view), so there's no separate "Dashboard" tab — switching tabs just swaps the table below the cards.
- `executeAs: USER_DEPLOYING`, so server code runs as the deployer and the master sheet only needs to be shared with the deployer — visitors never need direct sheet access.
- Identity comes from `Session.getActiveUser().getEmail()`. For `vcb-con.com` Workspace users this returns their email (used for the `MANAGERS` check and write attribution); for out-of-domain Google accounts Apps Script returns an empty email, but the sign-in is still enforced by the deployment's access setting.

## Deployment
- **Live URL:** see banner at the top of this file (the `/exec` URL is stable across redeploys).
- **Apps Script editor:** open by scriptId `183uDd0fXOiniijzMXZuz3Y7ZryuOkuULDDupa3mSfQM_oawzcL2AVIqW` (or use the `VCB Credit Facility Web App.gscript` shortcut at the project root).
- **How to push a change / redeploy / verify:** run commands from inside `ORIGINAL CODE/` (the clasp project root) — see [ORIGINAL CODE/SETUP.md](ORIGINAL%20CODE/SETUP.md). The short version is `clasp push` → `clasp create-version` → `clasp redeploy <deploymentId> --versionNumber N` (or just run `.\deploy.ps1 "message"` from that folder).
- **Caching gotcha:** Apps Script serves the page in a sandbox iframe and caches HTML hard — a plain refresh often shows the old version. Force fresh with `…/exec?v=<n>`, **Ctrl+Shift+R**, or wait ~1–2 min.
- **Access mode:** `executeAs: USER_DEPLOYING`, `access: ANYONE` — i.e. any Google account must sign in to open the app (not restricted to the `vcb-con.com` domain). See [Access model](#access-model) and [ORIGINAL CODE/SETUP.md → Access model](ORIGINAL%20CODE/SETUP.md#access-model-whole-app-requires-google-login-single-deployment).

## Notes
- Seed data is a snapshot of project loan files and is embedded in `Seed.js`. Update numeric baselines by editing `Seed.js` and redeploying.
- Master sheet ID is stored in script properties under `MASTER_SHEET_ID`. If the app errors, confirm this property is set and the deployer account can open the sheet.
- Manager permissions are defined by the `MANAGERS` list in `Code.js`.
- To rebuild data from scratch, run `resetMaster()` in the Apps Script editor.

## Summary
This project is a credit facility management dashboard and ledger built on Google Apps Script, with a spreadsheet-backed master dataset, seeded project and facility metadata, transaction/request workflows, approval logic, and an interactive browser frontend.
