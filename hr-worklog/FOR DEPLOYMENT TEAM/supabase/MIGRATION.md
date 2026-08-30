# HR Work Log — moving off Apps Script

Status: **schema written, nothing connected.** The live app is still the Apps
Script one in `../../ORIGINAL CODE/`, backed by the "HR Work Log — Database"
Google Sheet (`1lyn78vJ…CAgEn-A`). Nothing here touches it.

> **Migrate this one LAST.** It is 8,043 lines with 50 server functions, in
> daily use by employees, against a live database. Credit Facility is 1,060
> lines and not yet in daily use — do that one first and learn the real cost
> before starting here. See
> `../../../credit-facility/FOR DEPLOYMENT TEAM/supabase/MIGRATION.md`.

## The one transformation that is not a copy

Every other app's migration is a straight table-for-tab copy. This one is not.

The sheet keeps daily work in a **wide tab per (site, month)** —
`wideTabName_()` produces e.g. `สำนักงานใหญ่ · 2569-08`. Each such tab has one
row per employee and 98 columns:

```
eid | emp_id | name | kind | department |
AM 1 | Note 1 | AM 2 | Note 2 | … | AM 31 | Note 31 |     ← the AM/note block
PM 1 | PM 2 | … | PM 31                                    ← appended later
```

That layout exists only because a spreadsheet cannot cheaply hold one row per
person per day. It costs a hard 31-day ceiling, columns whose meaning depends on
position, and a schema migration every time a per-day field is added — the PM
block had to be appended at the end precisely to avoid shifting existing
columns.

`work_entries` replaces it with **one row per (eid, entry_date, slot)**. The
import therefore has to *pivot*: for each wide tab, for each employee row, for
each day 1–31, emit up to two rows.

**`slot` is not a time of day.** The sheet's columns are still called "AM N" and
"PM N", but the app does not work that way: it shows งานหลัก (main task) and
"+ งานที่ 2 (ถ้ามี)" (optional second task). The AM→PM auto-mirror was
deliberately switched off, with this comment in `Code.gs`:

> "the second slot is now optional งานเสริม (extra work), not a duplicate
> afternoon shift — copying งานหลัก into it would turn every single-task day
> into a 2-task day and break the 1-manday-per-day math"

So "AM N" → slot 1, "PM N" → slot 2, and a day with both slots filled is still
**one manday**. Use the `mandays` view for any total; counting `work_entries`
rows double-counts every two-task day.

```
tab "สำนักงานใหญ่ · 2569-08", employee E123, day 5
  AM 5 = 'A-1', Note 5 = 'ตรวจงาน', PM 5 = 'B-2'
    → work_entries (E123, 2026-08-05, slot 1, 'A-1')   -- งานหลัก
    → work_entries (E123, 2026-08-05, slot 2, 'B-2')   -- งานเสริม
    → work_days    (E123, 2026-08-05, note = 'ตรวจงาน')
```

Note the split: `Note N` is ONE column per day in the sheet, shared by both
slots, so it goes to `work_days` — one row per employee per day. Putting it on
`work_entries` would create two copies that could disagree.

Notes for whoever writes the import script:

- **Tab names are Buddhist-era.** `2569-08` is Gregorian `2026-08`
  (`parseWideTabName_` subtracts 543). Getting this wrong silently files a whole
  month under the wrong year.
- **Skip empty cells.** A blank AM/PM cell means no entry, not an entry with a
  blank value. Writing rows for them would inflate every count.
- **Days 29–31 do not exist in every month.** Ignore those columns for shorter
  months rather than creating impossible dates.
- **`site_key` comes from the tab name**, via the reverse of `siteSheetMap_()`.

This is the step most likely to lose or misplace data. Verify it before anything
else.

## Steps

### 1. Create the Supabase project

Create a project, then in **SQL Editor** run `schema.sql` once.

### 2. Turn on real authentication

- **Authentication → Providers → Google**: enable, restricted to your workspace
  domain.
- Import the `Users` tab into `public.users` — it already has the
  `email | role | site_key | eid` shape the schema expects.

Roles carry over unchanged: `admin` sees every site, `manager` and `staff` only
their own (`can_access_site()`), which is what the sheet's per-site tabs
enforced structurally.

### 3. Import reference data first

Order matters — foreign keys depend on it:

1. `Config` → `config`
2. `Sites` → `sites`
3. `Teams` → `teams` (`desc` → `description`, a reserved word)
4. `Employees` → `employees`
5. `Users` → `users`
6. `MasterIndex` → `master_index` (`desc` → `description`; `sites` becomes `text[]`)
7. `CostIndex` → `cost_index`

### 4. Import the rest

8. `LeaveRequests` → `leave_requests`
9. `Migrations` → `migrations` (`date` → `move_date`, `by` → `moved_by`, `ts` → `at`)
10. `AuditLog` → `audit_log` (`ts` → `at`)
11. **Every wide tab → `work_entries`**, pivoted as described above.

### 5. Wire the client

```sh
cp .env.example .env      # fill in from Supabase → API
npm install
npm run dev
```

### 6. Verify

- `select count(*) from work_entries` against a hand-count of non-empty cells in
  one known month. Do this for at least two sites and two months.
- Pick one employee and one week; compare the app's current display with the
  imported rows, cell by cell.
- Sign in as a `staff` user from site A and confirm site B's entries are not
  readable.
- Confirm a `manager` can decide a leave request and a `staff` user cannot.

## What is NOT done — and it is most of the work

The 50 `api_*` server functions have no equivalent yet. The React port
(2,447 lines against the GAS app's 8,043) covers the screens on mock data; these
are not ported at all:

- three Excel exports (`exportSiteXlsx`, `exportMasterIndexXlsx`,
  `exportCostIndexXlsx`)
- the leave-request workflow and its pending badge
- employee site-migration (`openMigrateEmp`)
- cost indexing and OT handling

Audit logging is the one exception — `schema.sql` now writes an `audit_log` row
from a trigger on every value change, so that behaviour survives the move for
free and applies even to a direct API call.

The two edit-window rules are also enforced in the database now (no filling more
than one day ahead; non-admins locked out beyond `LOCK_DAYS`, default 3). In the
Apps Script app those live only in `api_saveCells`, so anything talking to the
data directly bypasses them.

Each needs rebuilding against Postgres. That is the real scope of this
migration, and it is why this app should go last.

The Apps Script app remains the live system and the source of truth.
