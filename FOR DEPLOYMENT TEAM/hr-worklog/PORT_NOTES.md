# Port notes — HR Work Log

Converted to the VCB Connect stack per `../../TECH_STACK.md`: React 18 + Vite 5,
JavaScript only, Tailwind 3, React Router 6, Context + `useState`, no Redux, no
UI kit, no chart library.

This file records only the places where a straight conversion was **not**
possible, and what was done instead.

## What changed

**TypeScript is gone.** Every `.ts`/`.tsx` became `.js`/`.jsx`; `tsconfig.json`,
`typescript` and `@types/*` were removed and the build no longer runs `tsc`.
`types.ts` had no runtime content and simply disappeared — its shapes are
documented as prose where they are read.

**The mock backend is gone.** `mock.ts` (493 lines of generated sample data) and
`lib/supabaseClient.ts` are replaced by `src/lib/hrApi.js`, which calls
`api/src/routes/hr.js` over REST. The browser now holds no database credentials
and reaches no database.

**One api instance.** `lib/hrApi.js` calls `createApi()` exactly once and
`main.jsx` hands that same instance to `<AuthProvider>`. A second `createApi()`
would get neither the token source nor the 401 handling, and every call through
it would go out unsigned.

**The dictionary was re-keyed.** `i18n_data.ts` keyed its 318 entries on the
Thai string itself, which made the Thai copy load-bearing — a typo fix or an
added space silently orphaned the English translation. `src/i18n.js` uses stable
dot keys with `{ th, en }` values via `createDictionary()`. Every Thai string was
carried across mechanically and verified byte-for-byte; nothing was retranslated.
34 Thai strings the React port had introduced without dictionary entries (they
would have shown Thai to an English reader) were given translations at the same
time. 352 entries total.

**`app.css` + `extra.css` (1128 lines) became `index.css` (about 130).** What
survived is only what Tailwind 3 cannot express: `content: attr(data-ph)`
placeholders on the grid's empty cells, the lock glyph, two animations that
interpolate a per-element CSS custom property, and scrollbar hiding on the day
strip. Colour comes from the shared preset; dark mode is `class="dark"` on
`<html>` (shared/src/theme.jsx), not the `body.dark` the old stylesheet toggled.

**Language and theme moved to `@vcb/shared`.** They used to be `hr_lang` and
`hr_theme` in this module's own localStorage. They are now one key each across
every VCB Connect app, so the choice follows a person through the portal.
`src/prefs.jsx` keeps only what is meaningless outside the work log: year format
(พ.ศ./ค.ศ.), cell display (code/name), the default dashboard view, and the
per-device hidden-sites list.

**`App.tsx` was split.** Routing and chrome stay in `App.jsx`; the month grid
became `Entry.jsx` (container and saving) plus `CoverageGrid.jsx` and
`WeekGrid.jsx`, and the cell-value rules were lifted into `lib/cells.js` so the
two grids cannot disagree about what a cell means.

## Domain rules the code depends on

**Slots are not times of day.** Slot 1 is งานหลัก, the main task. Slot 2 is
งานเสริม, optional extra work. The legacy sheet's `AM 1`…`PM 31` column names
are historical, and the API still calls slot 2's field `pm` for that reason —
but no UI string in this module names a time of day, and a test asserts the
dictionary contains no เช้า/บ่าย wording.

**A day with both slots filled is still ONE manday.** Nothing here counts
mandays. Every figure shown comes from `row.mandays` on `GET /api/hr/summary`,
which reads the `hr.mandays` view. `lib/cells.js` deliberately exports no
counting function at all.

**An empty value deletes the slot.** `Entry.jsx` sends `value: null` for a
cleared cell, and the API deletes rather than storing `''`. A blank stored row
would still be a row, and the mandays view would count it as a day worked.

**403 `OUTSIDE_EDIT_WINDOW` is a business rule, not a bug.** It is the database's
`enforce_entry_window` trigger refusing a date, translated by the API. It is
shown in the warning tone with the actual window named (`err.outsideEditWindow`),
never as a generic "save failed" — that would send someone to IT over a rule
working exactly as designed.

**No bulk historical import.** Deliberately not carried over, matching the note
at the foot of `api/src/routes/hr.js`. The Apps Script version times out
part-way through a large sheet and is not resumable, so a retry double-writes
some months and skips others.

## Endpoints wired

| Screen | Calls |
|---|---|
| all | `GET /api/hr/bootstrap`, `GET /api/hr/index` (once, in `HrData.jsx`) |
| Dashboard | `GET /api/hr/summary?year&month` |
| Entry | `GET /api/hr/month?site&year&month`, `POST /api/hr/cells` |
| Requests | `GET /api/hr/sites/:siteKey/roster`, `GET /api/hr/leave`, `POST /api/hr/leave`, `POST /api/hr/leave/:id/decide`, `DELETE /api/hr/leave/:id` |
| Work Index | served from the cached `GET /api/hr/index` |
| Settings | `GET /api/hr/sites`, `POST /api/hr/sites`, `PATCH /api/hr/sites/:siteKey` |

`lib/hrApi.js` also wraps, unused by the current screens but part of the
contract: `PUT /api/hr/index/activity`, `GET /api/hr/sites/:siteKey/employees`,
`PUT /api/hr/employees`, `GET /api/hr/mandays`, `POST|GET /api/hr/migrations`,
`GET /api/hr/audit`.

## What the UI wants that the API does not provide

These were in the mock and are **not** available from `api/src/routes/hr.js`.
Each is either dropped or derived, never faked:

1. **Per-employee absence (`Employee.away`).** The mock marked days an employee
   was not yet at a site, and both grids greyed them out. `GET /api/hr/month`
   returns no such field, so those cells now render as ordinary empty days. The
   data exists — `hr.migrations` records every move — but there is no endpoint
   that projects it onto a month. Until there is, a transferred employee's
   pre-transfer days read as "missing" rather than "not here yet", which
   overstates the gap on the coverage view.

2. **`support_started` / `operation_started`.** The dashboard used to show "N of
   M employees have logged at least one day". `GET /api/hr/summary` returns
   headcount and mandays but no distinct-employee count, so the tile was
   dropped rather than approximated.

3. **A server-computed fill rate.** The old `fillRate`/`fillRateDenom` are not
   in the summary response. The ring is now computed in `Dashboard.jsx` as
   mandays-logged over (working days elapsed x headcount). Both halves come from
   API manday counts, but the denominator assumes today's headcount applied to
   the whole month — it will drift on a site whose roster changed mid-month.
   A `denominator` field on the summary row would remove the guess.

4. **Retro-edit markers (`SiteMonth.edits`).** The mock flagged cells edited
   after the fact. `GET /api/hr/audit` holds this (admin only) but is not
   per-month-per-cell shaped, so the marker is not rendered.

5. **Writing `LOCK_DAYS`.** The settings screen used to offer a number input.
   `hr.config` has no write route — it is enforced by a trigger for the whole
   company — so the value is displayed read-only.

6. **The printed leave slip.** Still not ported; `GET /api/hr/sites/:siteKey/roster`
   exists and serves exactly the identity fields it needs. Its layout rules
   (10.5pt scale, 34mm/1fr field grid, mm/pt units) live only in
   `../ORIGINAL CODE/Code.gs`. Per TECH_STACK.md this should be generated
   server-side with PDFKit and an embedded Sarabun font, not printed from the
   browser.

7. **Employee and activity editing.** `PUT /api/hr/employees` and
   `PUT /api/hr/index/activity` are wrapped in `lib/hrApi.js` but have no UI —
   the sheet's editor was the paste-from-Excel bulk importer that is
   deliberately not reproduced. The Work Index screen is read-only.

8. **Employee transfers.** `POST /api/hr/migrations` is wrapped; the "⇄" button
   the old weekly grid showed is not rendered, because without (1) the result of
   a transfer would not be visible on the grid anyway.
