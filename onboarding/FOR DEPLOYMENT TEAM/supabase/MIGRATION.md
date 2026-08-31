# Onboarding — moving off Apps Script

Status: **furthest along of the seven.** Unlike the others, this React app is
not a mock — `src/lib/useProgress.ts`, `useChecklistOverrides.ts`,
`useDocUpload.ts` and `pages/AdminPage.tsx` already query Supabase for real.

## Running it

```sh
cp .env.example .env    # then fill in your Supabase project's URL + anon key
npm install
npm run dev
```

Then run `schema.sql` once in your Supabase project's SQL Editor — it creates
the `employees`, `progress` and `checklist_overrides` tables, the storage bucket
for required documents, and the row level security policies.

The client throws at startup if the two env vars are missing, rather than
letting every query fail with a vague network error.

## Why this one is different

The other six were **ports**: built by reading the live Apps Script app and
mirroring its screens, with a typed mock standing in for the GAS backend that a
browser cannot call. Onboarding was scaffolded the other way round — as a React
+ Supabase app from its first commit (`Initial React/TypeScript/Supabase
scaffold`).

That is also why it runs React 19 / Vite 8 / TypeScript 6 while the rest are on
React 18 / Vite 5 / TS 5. Worth aligning eventually, but not urgent.

## What is still missing

**No `.env`.** Only `.env.example` with placeholders. The client throws at
startup without it, so the app does not currently boot. There is no Supabase
project behind it yet.

**Identity is name-only, not real auth.** The README calls this a deliberate
scope decision, and for a prototype it is. Before real employee data goes in, it
needs Supabase auth — otherwise anyone can claim to be anyone by typing a name.

**The open RLS policies are the consequence of that.** `employees` and
`progress` allow read/insert/update to anyone with the anon key, which ships in
the browser bundle. That mirrors the original app, which was equally open to
anyone holding the URL — but it is not something to keep once staff records are
in it.

Note what the schema already gets right: `checklist_overrides` is **not** open.
Writes there go through `admin_save_checklist_item()` /
`admin_delete_checklist_item()`, security-definer functions that verify the
password inside the same call that performs the write, so the UI gate cannot be
skipped. That is the pattern the `employees`/`progress` tables should follow when
auth is added.

## The live app is still Apps Script

Employees use the Apps Script version, backed by the Google Sheet
`1H5d-BwY…uhmfW0k` (script property `PROGRESS_SS_ID`). Nothing in this folder
affects it.

When you do cut over, that sheet is the data to import — `employees` from the
department/level values, `progress` from the
`Employee | TaskId | Completed | Timestamp` rows.

## Order

Migrate **credit-facility first** — it is smaller and not in daily use, so it is
where to learn the process without risk. Onboarding is a reasonable second,
precisely because its data layer is already written.
See `../../../credit-facility/FOR DEPLOYMENT TEAM/supabase/MIGRATION.md`.
