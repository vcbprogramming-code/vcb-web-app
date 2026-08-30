# Credit Facility — moving off Apps Script

Status: **schema written, nothing connected.** The live app is still the Apps
Script one in `../../ORIGINAL CODE/`, backed by the "VCB Credit Facility Master"
Google Sheet. Nothing here touches it.

This is the pilot for migrating all seven apps. Credit Facility was chosen
because it is the smallest app with a real database (1,060 lines, 9 tables) and
is not yet in daily use — so a mistake costs nothing.

## What exists now

| File | What it is |
|---|---|
| `schema.sql` | The nine sheet tabs as Postgres tables, with RLS |
| this file | The steps below |

## Steps

### 1. Create the Supabase project

Create a project, then in **SQL Editor** run `schema.sql` once.

### 2. Turn on real authentication

This is the part the Apps Script version got for free and a SPA does not.

- **Authentication → Providers → Google**: enable it.
- Restrict sign-in to your workspace domain, so only `@vcb-con.com` accounts can
  authenticate at all.

Then seed the manager list — the same addresses as the `MANAGERS` array in
`../../ORIGINAL CODE/Code.js`:

```sql
insert into public.managers (email) values
  ('someone@vcb-con.com'),
  ('another@vcb-con.com');
```

**Why this matters.** In Apps Script, `Session.getActiveUser().getEmail()` is
supplied by Google and cannot be faked. In a SPA the anon key ships inside the
JavaScript bundle, so anyone can read it out of DevTools and call the API
directly. That is why every write policy in `schema.sql` requires an
authenticated user on the managers list, checked in the database — not a check
in the UI, which a determined user simply skips.

### 3. Wire the client

```sh
cp .env.example .env      # then fill in the two values from Supabase → API
npm install
npm run dev
```

`src/lib/supabaseClient.ts` throws at startup if the env vars are missing,
rather than letting every query fail with a vague network error.

### 4. Import the existing data

Per sheet tab, in this order (foreign keys depend on it):

1. `Facilities` → `facilities`
2. `Limits` → `limits`
3. `CostCategories` → `cost_categories`
4. `CategoryCaps` → `category_caps`
5. `Transactions` → `transactions`
6. `Requests` → `requests`
7. `CashPlan` → `cash_plan`
8. `Audit` → `audit`

Export each tab as CSV and use Supabase's **Table Editor → Import CSV**. Column
names are snake_cased versions of the sheet headers, with three deliberate
renames noted in `schema.sql`: `Limit` → `limit_amt` (reserved word), `By` →
`created_by`, `Order` → `sort_order`.

Two columns are **not** imported:

- `Facilities.Used` — derived. Use the `facility_used` view, which applies the
  same rule as the live app: sum unpaid transactions, unless
  `limits.used_override` pins it.
- `Transactions.Updated` / `Requests.Updated` — replaced by `updated_at`.

### 5. Verify before switching anyone over

- Row counts per table match the sheet.
- `select * from public.facility_used` matches the "Used" column the live app
  currently displays. If it does not, the calculation has drifted — fix it here
  before anyone relies on it.
- Sign in as a non-manager and confirm writes are rejected.

## What is NOT done

- **The React app still runs on mock data.** `src/mock/` is untouched; nothing
  in `src/` imports the Supabase client yet. Swapping the data layer is the next
  step, and it is the bulk of the work.
- No data has been imported.
- The Apps Script app remains the live system and the source of truth.

## Open question for the whole migration

Apps Script gives you Google-account identity, Sheets as a database your staff
can open directly, and zero hosting cost. Moving to Supabase + Vercel means real
auth setup, a hosting bill, and staff losing direct spreadsheet access.

That is worth it if you need non-Google users, more complex UI, or scale that
Sheets cannot take. It is worth confirming that is actually the goal before
repeating this six more times — see the note at the end of
`../../../ARCHITECTURE_STANDARD.md`.
