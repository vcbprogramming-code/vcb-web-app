# Port notes

This file records only the places where a 1:1 port from `../ORIGINAL CODE/` was
**not possible**, and what was done instead — so nobody spends a day
rediscovering why.

The module now follows `TECH_STACK.md`: JavaScript only, React 18, Vite 5,
Tailwind 3, React Router 6, state via Context + `useState`, and every request
going through the single Express API at `api/`. The browser reaches no database.

## Where this port differs, and why

**Backend.** The `localStorage` mock (`src/mockBackend.ts`) and the direct
Supabase client (`src/lib/supabaseClient.ts`) are both gone. All data now comes
from `api/src/routes/portal.js`, wrapped in `src/lib/portalApi.js`. Apps Script
exposed its functions only through `google.script.run`, which works inside
Google's own iframe; a standalone SPA cannot call them over HTTP, and per
`TECH_STACK.md` the browser must never hold database credentials.

**The admin password is gone.** The Apps Script version gated the editor on
`unlockAdmin(password)` against a hash in ScriptProperties. That cannot survive
in a SPA — the hash and the comparison would both ship in the browser bundle.
Writes are now guarded by `requireAuth + requireRole('portal','admin')` on the
server, backed by `portal.portal_admins`. `hasRole()` on the client only decides
whether to draw the form.

**The announcement id changed shape.** It was a fresh uuid per save; the schema
bumps a `revision` bigint instead and the API exposes `String(revision)`. The
per-device dismissal key therefore holds `"3"`, not a uuid. A browser upgrading
from the old build still has a uuid in storage:
`src/lib/announcementDismissal.js` compares opaque strings and never parses, so
a leftover value can only ever mean "not the banner you dismissed" — the banner
shows again, which is the correct outcome. The pre-port key
(`vcb_connect_ann_dismissed`) is swept on first read.

**Tile copy now prefers the database.** The API returns `nameTh`/`descTh` from
`portal.apps`. The old client ignored them in favour of its local `I18N` table,
so a tile renamed in the database still showed the old name until someone
redeployed. `src/lib/appCopy.js` takes the API value first and falls back to the
dictionary, so copy can migrate into the database without a second change here.

**User identity.** `DEMO_EMAIL` is gone. Identity comes from the JWT via
`/api/auth/me`; an unauthenticated visitor is "Guest", which is the correct
front-door state — `GET /apps` and `GET /announcement` are `allowAnonymous`.

## What the API does not provide, and the UI wants

**Issue reports (Help & Support).** The Apps Script version called
`sendIssueReport()` via MailApp. There is no such route in
`api/src/routes/portal.js` and no table in `002_portal.sql`. `HelpModal.jsx`
composes a `mailto:` to `it@vcb-con.com` and tells the person that is what will
happen (`help.unavailable`). Replace `openMailClient` with a `post()` and delete
that dictionary entry when a route exists.

**Tile hover previews.** `portal.apps` has `description`/`description_th` but no
column for the longer paragraph the card tooltips show. Those live in
`src/i18n.js` as `app.<key>.preview` and are the one piece of app copy the
database cannot yet own. Adding a `preview`/`preview_th` column would finish the
migration.

**Birthdays and leave.** Both panels are still sample data in `src/data.js`.
Neither has an endpoint nor a table; the birthday panel says so on its own face
(`panel.birthdaysNote`) and leave renders its empty state, matching the Apps
Script portal's default.

**Holidays.** `getHolidays()` stays client-side in `src/data.js`. It is a fixed
calendar, not company data, so it is compiled into the bundle exactly as Code.js
kept it. Lunar/Buddhist holidays and cabinet-announced compensation days are
still excluded — both shift yearly.

**Footer version.** Left at `v1.1` to match the Apps Script source exactly. That
source is itself behind its deployed version — a discrepancy in the original,
deliberately not "fixed" here.
