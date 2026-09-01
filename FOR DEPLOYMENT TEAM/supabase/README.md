# Supabase — schema migrations for VCB Connect

One schema for the whole system, split into seven numbered migrations. These
replace the six per-module `schema.sql` files that used to live under
`<module>/supabase/`; those have been deleted and must not be recreated.

## Run order

Run them in numeric order. `001` must go first — it creates the schemas
everything else writes into, and the two helper functions the HR triggers call.

| File | Creates |
|---|---|
| `001_schemas.sql` | the six schemas, plus `hr.actor_email()` / `hr.actor_role()` |
| `002_portal.sql` | `portal.*` — app tiles, announcement, admin list |
| `003_credit.sql` | `credit.*` — facilities, transactions, requests, cash plan, **and the projects / facility-types reference tables** |
| `004_hr.sql` | `hr.*` — roster, work entries, leave, audit, and the edit-window triggers |
| `005_minutes.sql` | `minutes.*` — projects, meetings, versions, ingest log |
| `006_sop.sql` | `sop.*` — the single SOP document and its history |
| `007_onboarding.sql` | `onboarding.*` — new-hire progress, and it **drops** the old password back door |

Against Supabase, either paste each file into the SQL Editor in order, or use the
CLI:

```
supabase db push
```

## They are idempotent — re-run them freely

Every file is safe to run again on a database that already has it. That is not
incidental; it is how you apply a change. Edit the migration, re-run it, and only
the new part takes effect.

The mechanics, so you can keep new statements safe the same way:

- `create schema if not exists` / `create table if not exists` /
  `create index if not exists`
- `create or replace` for every function and view
- `drop trigger if exists` before each `create trigger` — Postgres has no
  `create or replace trigger`
- `drop function if exists` with the full argument list, for the functions 007
  removes
- `add column if not exists` for columns added to a table that already shipped
- every seed `insert` ends in `on conflict … do nothing` or `do update`

What re-running does **not** do is drop anything you have added by hand or
narrow a column that already holds data. Adding a `not null` or a new `check`
to a populated table still needs a considered migration of its own.

One deliberate asymmetry worth knowing: the inbox seed in `005` re-asserts
`builtin = true` on conflict (an inbox must stay undeletable) but leaves
`visibility` and `domain` alone, because an admin may legitimately have changed
those and a re-run must not quietly undo it.

## Access control is in the API, not the database

**There is no Row Level Security in these migrations, and adding it back would
not do what it looks like it does.**

The old per-module schemas carried 45 RLS policies. They worked because the
browser held a Supabase anon key and talked to Postgres directly, so
`auth.jwt() ->> 'email'` named the actual person making the request and a policy
could tell one caller from another.

That is no longer the architecture. The browser talks to Express; Express talks
to Postgres as **one database user**. Every request now looks identical to the
database. A policy written against `auth.jwt()` does not restrict anyone — it
evaluates the same for a visitor, a guest and an admin, and either locks
everybody out or lets everybody through. That is worse than having no policy,
because it reads like protection and nobody re-checks it.

So the rules live in one place:

- `api/src/middleware/auth.js` — `requireAuth`, `requireRole`, `requireHrSite`,
  `allowAnonymous`
- each route file, which states its own guard

A route with no guard is public to the entire internet, and that failure is
silent. When you add a route, add its guard in the same commit.

Restoring RLS only makes sense if the API is first moved off its single
connection identity — for example by connecting as the end user, or by setting a
per-request role. Until that happens, splitting the rules across two layers means
the SQL half rots without anyone noticing.

**The identity tables are still authoritative.** `hr.users`, `credit.managers`,
`minutes.admins`, `minutes.editors`, `sop.sop_editors` and
`portal.portal_admins` remain the source of truth for who holds which role —
`resolveRoles()` in `api/src/auth.js` reads all six at sign-in and bakes the
result into the JWT. They stopped being policy inputs; they did not stop
mattering.

### What is still enforced in the database, and why

Three things in `004_hr.sql` are deliberately still triggers:

- **the edit window** — nobody may fill more than one day ahead; non-admins may
  not edit further back than `LOCK_DAYS`
- **site consistency** — an entry must sit on the employee's own site
- **the audit log** — one row per changed cell

These are data-integrity rules, not access rules. Keeping them in the database
means the one-off import script, a `psql` session and any future service obey
them too — which an Express middleware cannot promise. `api/src/routes/hr.js`
deliberately does not duplicate them; it only translates the `42501` the window
trigger raises into a `403` with a reason.

## `app.actor_email` and `app.actor_role` — the API must set these

Those HR triggers need to know who is writing and with what role. They used to
ask `auth.jwt()`, which is empty here — so before the rewrite in `004`, an HR
admin was locked out past the edit window exactly like a staff member (the one
person the exception exists for), and every audit row was written with
`email = ''`, losing the actor.

They now read two session variables, which **the API must set inside the
transaction that does the write**:

```js
await tx(async (c) => {
  await c.query('set local app.actor_email = $1', [req.user.email]);
  await c.query('set local app.actor_role  = $1', [req.user.roles.hr ?? 'none']);

  // … the inserts and deletes for this request …
});
```

### `set local`, not `set`

`set local` scopes the value to the surrounding transaction and discards it at
commit or rollback. That is the entire point: connections come from a pool, so a
plain `set` would leave one user's identity on the connection and hand it to
whichever request borrows it next. Use `set local`, and always inside an explicit
transaction — outside one it silently has no effect.

### What happens if you forget

Both helpers read their setting with the `missing_ok` flag, so nothing errors:

- `hr.actor_role()` returns `'none'`, which is not `'admin'`, so the caller is
  treated as a non-admin and the edit window closes on them. **Fails closed.**
- `hr.actor_email()` returns `''`, and the audit row is still written — just
  without a name. Losing one actor is bad; losing the entry *and* the trail is
  worse, so the write is not blocked.

If you suspect a code path is skipping this, look for audit rows with an empty
`email`:

```sql
select count(*), min(at), max(at) from hr.audit_log where coalesce(email,'') = '';
```

Only the HR module reads these today. Nothing breaks if you set them on every
request anyway, and doing so makes the habit uniform.

## Notes on individual modules

**`hr.mandays` is the only correct source of manday numbers.** A day with both
task slots filled is **one** manday, never two — `slot` is not a time of day
(slot 1 is งานหลัก, slot 2 is optional งานเสริม; the "AM/PM" column names in the
legacy sheet are historical and misleading). Counting `hr.work_entries` rows
instead double-counts every two-task day, which inflates exactly the sites that
log งานเสริม and surfaces nowhere as an error — the number is simply wrong.

**Importing the HR wide tabs.** The tab names are **Buddhist era**: `2569-08` is
Gregorian `2026-08`, so subtract 543. Getting this wrong files a whole month
under the wrong year and nothing complains. See the comment block in `004` for
the other three ways that pivot corrupts silently.

**`minutes.minutes.source` will not gain `'doc-edited'`.** This was decided, not
overlooked: `source` records where a meeting *came from*, not what has happened
to it since. Editing an imported minute is a tidy-up of an existing record, not
the creation of a new one, and knowing that a row originally came out of a Google
Doc stays useful long after somebody fixed a typo in it. Adding `'doc-edited'`
would destroy that distinction the first time anyone touched a row. The save
routes also pin the value in SQL, so an imported row keeps `'doc-import'` even if
a client sends something else.

**The two minutes inboxes are foreign-key targets.** `FATHOM_INBOX` and
`TRANSKRIPTOR_INBOX` are seeded by `005` because every incoming recording lands
with one of those as its `project_id`. Without the rows, ingestion fails on a
webhook — where nobody is watching and the recording is lost.

**`007` drops a live vulnerability.** `check_admin_password()` and
`admin_save_checklist_item()` implemented a shared-password back door: a
security-definer function granted to `anon` that compared a caller-supplied
string against a Postgres setting and then wrote shared content on their behalf.
One password, no identity, and a NULL-returning `current_setting` fallback that
is a literal anyone can read in the old file. It is replaced by
`requireRole('portal','admin')` on the checklist routes. Do not restore it.

## Seeding after the migrations

The migrations create structure and the reference data that the code depends on
(credit projects and facility types, the two minutes inboxes, `LOCK_DAYS`, the
announcement row, the storage bucket). Business data and the identity lists are
still yours to load:

1. **Identity lists** — insert the real addresses into `hr.users`,
   `credit.managers`, `minutes.admins`, `minutes.editors`, `sop.sop_editors`,
   `portal.portal_admins`.
2. **`hr.users.password_hash`** — bcrypt only, generated by the API's
   `hashPassword()`. Never a plaintext password. Leave it null for a
   Google-only account; `verifyPassword()` handles that case in constant time so
   response timing cannot enumerate real accounts.
3. **`hr.employees.email`** — this is the *only* link between a login and a
   site. Miss it and every non-admin resolves to an empty site list and is
   refused everywhere, which looks like a permissions bug rather than a blank
   column.
4. **`portal.apps`** — seed from the old `APPS` array, keeping the `/exec` URLs
   for any Apps Script app that is still live. The portal must keep pointing at
   each one until that module actually moves.
5. **`sop.sop_document`** — seed from the live app's own export
   (`<exec-url>?diag=sopdata`). It is left unseeded on purpose: the routes return
   `409 NOT_SEEDED`, which is a clear signal, whereas an empty `{}` row would let
   editors author into a document the real import then overwrites.
6. **The rest** — sheet data per module; see each module's `MIGRATION.md`.
