-- 004 — hr: roster, the daily work entries, leave, migrations, audit.
--
-- ACCESS CONTROL LIVES IN THE API: api/src/routes/hr.js mounts
-- requireAuth + requireRole('hr', …) for the whole module, and each route adds
-- requireHrSite() or a stricter role. api/src/auth.js:hrSitesFor() resolves
-- which sites a person may see, from hr.employees.email.
--
-- No RLS here. See 001_schemas.sql. The old can_access_site() / is_hr_admin()
-- policies read auth.jwt(), which is empty under this architecture, so they
-- would evaluate the same for every caller. Do not add them back.
--
-- BUT NOTE THE DELIBERATE EXCEPTION BELOW: the edit-window, site-consistency and
-- audit rules ARE still triggers, and must stay triggers. They are not access
-- control — they are data integrity — and the point of keeping them in the
-- database is that a psql session or a one-off script cannot bypass them the way
-- it can bypass an Express middleware. They needed rewriting rather than
-- dropping, because they too used to ask auth.jwt(); they now read the session
-- variables the API sets (see 001_schemas.sql and the README).

-- ---------------------------------------------------------------- identity --

-- Sheet tab: Users. This is also the password-login table for the whole portal:
-- POST /api/auth/login reads email, name and password_hash from here.
create table if not exists hr.users (
  email      text primary key,
  role       text not null default 'staff' check (role in ('admin','manager','staff')),
  site_key   text,
  eid        text,
  created_at timestamptz not null default now()
);

-- password_hash and name were missing entirely: the sheet had no passwords
-- (Apps Script got identity from Google) and no display name. Both are required
-- now — /api/auth/login cannot verify anyone without the hash, and the JWT
-- carries the name.
--
-- password_hash is NULLABLE on purpose. A Google Sign-In user legitimately has
-- no password, and verifyPassword() in api/src/auth.js compares against a dummy
-- hash when it is null so that "no such user" and "wrong password" take the same
-- time — an early return here would let response timing enumerate real accounts.
alter table hr.users add column if not exists password_hash text;
alter table hr.users add column if not exists name          text;

comment on column hr.users.password_hash is
  'bcrypt hash, or null for a Google-only account. Never a plaintext password.';

-- ------------------------------------------------------------ reference data --

create table if not exists hr.config (
  key   text primary key,
  value text
);

-- LOCK_DAYS: how far back a non-admin may still edit. The API and the window
-- trigger both fall back to 3 when the row is missing, but seeding it means the
-- number is visible and adjustable in one place.
insert into hr.config (key, value) values ('LOCK_DAYS', '3')
on conflict (key) do nothing;

-- Sheet tab: Sites.
--
-- The primary key is site_key, not `key`. The old schema called it `key` while
-- auth.js and every route in hr.js query site_key — one of the two had to move,
-- and site_key is the name that appears in hr.users, hr.employees,
-- hr.work_entries and hr.leave_requests, so renaming those four to match a
-- single table's `key` would have been the larger change.
create table if not exists hr.sites (
  site_key text primary key,
  name     text not null,
  company  text,
  active   boolean not null default true
);

-- Carry a database created before that rename. Harmless when the column is
-- already correct — the rename runs only if `key` is still there.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'hr' and table_name = 'sites' and column_name = 'key')
     and not exists (select 1 from information_schema.columns
              where table_schema = 'hr' and table_name = 'sites' and column_name = 'site_key')
  then
    alter table hr.sites rename column key to site_key;
  end if;
end $$;

create table if not exists hr.teams (
  site_key    text not null references hr.sites(site_key) on delete cascade,
  name        text not null,
  description text,                     -- sheet: desc (reserved word)
  primary key (site_key, name)
);

-- Sheet tab: Employees. Keyed by eid — NOT the same thing as
-- onboarding.employees, which is keyed by name. That is why these live in
-- separate schemas.
create table if not exists hr.employees (
  eid        text primary key,
  site_key   text references hr.sites(site_key),
  emp_id     text,
  name       text not null,
  position   text,
  department text,
  -- 'support' or 'operation'. Drives display (the grid shows งานหลัก as `team`
  -- for operation staff and `detail` for support), not storage.
  kind       text,
  division   text
);

-- email was missing, and its absence broke every non-admin.
--
-- It is the ONLY link between a login and a site: hrSitesFor() in
-- api/src/auth.js resolves a caller's site scope with
--   select site_key from hr.employees where lower(email) = $1
-- With no column, that query returns nothing, hrSites is [], and requireHrSite()
-- refuses every request from anyone who is not an HR admin. Silent, total, and
-- looks like a permissions bug rather than a missing column.
alter table hr.employees add column if not exists email text;

comment on column hr.employees.email is
  'Links a login to a site. hrSitesFor() resolves site scope through this; '
  'without it every non-admin gets an empty site list and is refused everywhere.';

create index if not exists employees_site_idx  on hr.employees(site_key);
create index if not exists employees_email_idx on hr.employees(lower(email));

-- Sheet tab: MasterIndex — the activity catalogue the picker offers.
create table if not exists hr.master_index (
  id           text primary key,
  code         text,
  name         text,
  description  text,                    -- sheet: desc
  category     text,
  sites        text[] not null default '{}',
  mapping      text,
  fixed_cost   numeric(18,2),
  allowed_cost numeric(18,2)
);

-- Sheet tab: CostIndex — the ERP cost codes.
create table if not exists hr.cost_index (
  id      text primary key,
  code    text,
  name    text,
  name_en text
);

-- Sheet tab: Migrations — an employee moving between sites. Recorded and applied
-- in one transaction by the API: half of it leaves enforce_entry_site rejecting
-- every later write for that person with no obvious cause.
create table if not exists hr.migrations (
  id        bigint generated always as identity primary key,
  eid       text references hr.employees(eid),
  from_site text,
  to_site   text,
  move_date date,                       -- sheet: date
  moved_by  text,                       -- sheet: by
  at        timestamptz not null default now()   -- sheet: ts
);

create index if not exists migrations_at_idx on hr.migrations(at desc);

create table if not exists hr.leave_requests (
  id           text primary key,        -- 'LV' + timestamp; printed slips carry it
  eid          text references hr.employees(eid),
  site_key     text references hr.sites(site_key),
  emp_name     text,
  from_date    date,
  to_date      date,
  reason       text,
  status       text not null default 'pending',
  requested_at timestamptz not null default now(),
  decided_by   text,
  decided_at   timestamptz,
  leave_type   text
);

create index if not exists leave_site_status_idx on hr.leave_requests(site_key, status);
create index if not exists leave_requested_idx   on hr.leave_requests(requested_at desc);

-- Sheet tab: AuditLog — one row per changed cell. Append-only, and written by
-- the trigger below rather than by the API, so an edit made from a SQL client is
-- audited too. There is deliberately no write endpoint: an audit log a client
-- can write is not evidence of anything.
create table if not exists hr.audit_log (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),   -- sheet: ts
  email    text,
  site     text,
  year     int,
  month    int,
  eid      text,
  emp_name text,
  day      int,
  field    text,
  old_val  text,
  new_val  text
);

create index if not exists hr_audit_at_idx   on hr.audit_log(at desc);
create index if not exists hr_audit_site_idx on hr.audit_log(site, eid);

-- ------------------------------------------------------- the daily entries --

-- The sheet keeps daily work in a WIDE tab per (site, month): one row per person
-- and 98 columns — "AM 1", "Note 1", … then an appended "PM 1".."PM 31" block.
-- That shape forces a 31-day ceiling and makes a column's meaning depend on its
-- position. Here it is one row per (employee, date, slot).
--
-- IMPORTING THE WIDE TABS — four things silently corrupt the pivot:
--   * Tab names are BUDDHIST ERA. "2569-08" is Gregorian 2026-08 (subtract 543).
--     Get this wrong and a whole month files under the wrong year, silently.
--   * A blank cell means NO entry, not an entry whose value is ''. Writing rows
--     for blanks inflates every count and every manday total.
--   * Days 29-31 do not exist in every month; skip those columns rather than
--     minting impossible dates.
--   * site_key comes from the tab name, via the reverse of siteSheetMap_().
-- Check row counts against a hand-count of one known month for two sites before
-- trusting the import, and look for surviving "_legacy_<siteName>" tabs first —
-- the old long-format migration renamed rather than deleted them.

-- The note belongs to the DAY, not to a slot: the sheet has one Note column per
-- day, shared by both slots. Hanging it off work_entries would let the two slots
-- disagree about the same remark.
create table if not exists hr.work_days (
  eid        text not null references hr.employees(eid) on delete cascade,
  entry_date date not null,
  site_key   text not null references hr.sites(site_key),
  note       text,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (eid, entry_date)
);

-- `slot` IS NOT A TIME OF DAY.
--
-- The sheet's columns are "AM N" / "PM N" and the legacy code still says so, but
-- the app shows งานหลัก (main task) and "+ งานที่ 2 (ถ้ามี)" (optional extra).
-- The AM→PM auto-mirror was deliberately disabled, with this reason recorded in
-- Code.gs: copying งานหลัก into the second slot "would turn every single-task
-- day into a 2-task day and break the 1-manday-per-day math".
--
-- So slot 1 = main task, slot 2 = optional extra work, and a day with both is
-- still ONE manday. Naming this column `period` with 'am'/'pm' — as an earlier
-- draft did — invites exactly that miscalculation.
create table if not exists hr.work_entries (
  id         bigint generated always as identity primary key,
  eid        text not null references hr.employees(eid) on delete cascade,
  site_key   text not null references hr.sites(site_key),
  entry_date date not null,
  slot       smallint not null check (slot in (1, 2)),
  -- The composite "<activity code> / <cost code>" written in the cell. The
  -- summary endpoint splits it with split_part(value, ' / ', n).
  value      text,
  updated_at timestamptz not null default now(),
  updated_by text,
  unique (eid, entry_date, slot)
);

create index if not exists work_entries_site_date_idx on hr.work_entries(site_key, entry_date);
create index if not exists work_entries_eid_date_idx  on hr.work_entries(eid, entry_date);
create index if not exists work_days_site_date_idx    on hr.work_days(site_key, entry_date);

-- ONE MANDAY PER EMPLOYEE PER DAY, however many slots are filled.
--
-- Use this for every workload and cost total. Counting work_entries rows instead
-- double-counts every two-task day, which inflates exactly the sites that log
-- งานเสริม and shows up nowhere as an error — the number is simply wrong.
--
-- `distinct` rather than `group by`: there is nothing to aggregate here. The
-- query wants the set of (employee, day) pairs that have any work at all, and
-- `group by` with no aggregate says that in a more roundabout way.
create or replace view hr.mandays as
  select distinct eid, site_key, entry_date, 1::int as mandays
    from hr.work_entries
   where coalesce(value, '') <> '';

comment on view hr.mandays is
  'One row per employee per day with any work logged. A day with both slots '
  'filled is ONE manday. Never recompute mandays by counting work_entries.';

-- --------------------------------------------------- the edit window rules --
--
-- Two time rules the sheet layout could not express:
--   * nobody may fill more than ONE DAY AHEAD — everyone, admins included, so a
--     month cannot be pre-filled before it happens
--   * non-admins may not edit further back than LOCK_DAYS (default 3)
--
-- WHY THIS IS A TRIGGER AND NOT MIDDLEWARE: it is a data rule, not an access
-- rule. Keeping it here means the one-off import script and a psql session obey
-- it too. api/src/routes/hr.js deliberately does not duplicate it — it only
-- translates the 42501 this raises into a 403 with a reason.
--
-- WHY IT WAS REWRITTEN: it used to call is_hr_admin(), which read auth.jwt().
-- With no Supabase JWT that returned 'none' for EVERY caller, so an HR admin was
-- locked out past the edit window exactly like a staff member — the one person
-- the exception exists for. It now reads the role the API set with
-- `set local app.actor_role`.
create or replace function hr.entry_window_ok(p_date date)
returns boolean language sql stable as $$
  select p_date <= (current_date + 1)
     and (hr.actor_role() = 'admin'
          or p_date >= (current_date - coalesce(
               (select value::int from hr.config where key = 'LOCK_DAYS'), 3)));
$$;

create or replace function hr.enforce_entry_window()
returns trigger language plpgsql as $$
begin
  if not hr.entry_window_ok(new.entry_date) then
    raise exception
      'Entry date % is outside the editable window (max 1 day ahead; % days back for non-admins).',
      new.entry_date,
      coalesce((select value from hr.config where key = 'LOCK_DAYS'), '3')
      using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists work_entries_window on hr.work_entries;
create trigger work_entries_window before insert or update on hr.work_entries
  for each row execute function hr.enforce_entry_window();

drop trigger if exists work_days_window on hr.work_days;
create trigger work_days_window before insert or update on hr.work_days
  for each row execute function hr.enforce_entry_window();

-- Keep site_key honest: an entry must sit on the employee's own site, or the
-- roster and the entries drift apart with nothing to show for it.
create or replace function hr.enforce_entry_site()
returns trigger language plpgsql as $$
declare emp_site text;
begin
  select e.site_key into emp_site from hr.employees e where e.eid = new.eid;
  if emp_site is not null and new.site_key is distinct from emp_site then
    raise exception 'Employee % belongs to site %, not %.', new.eid, emp_site, new.site_key
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists work_entries_site on hr.work_entries;
create trigger work_entries_site before insert or update on hr.work_entries
  for each row execute function hr.enforce_entry_site();

-- ------------------------------------------------------------------ audit ---
--
-- One audit row per changed cell, exactly as writeWideCells_ does in the sheet.
--
-- WHY IT WAS REWRITTEN: the actor used to come from auth.jwt() ->> 'email',
-- which is null here, so every row was written with email = '' — an audit log
-- that records that something changed but not who changed it, which is the one
-- fact it exists to hold. It now reads `set local app.actor_email`.
--
-- If the API forgets to set it, the row still gets written with an empty actor
-- rather than the write failing: losing one name is bad, losing the entry AND
-- the trail is worse. The README says how to set it; check for '' actors if you
-- suspect a path is skipping it.
create or replace function hr.audit_work_entry()
returns trigger language plpgsql as $$
declare emp_name text;
begin
  if tg_op = 'UPDATE' and new.value is not distinct from old.value then
    return new;   -- nothing actually changed
  end if;

  select e.name into emp_name from hr.employees e where e.eid = new.eid;

  insert into hr.audit_log (email, site, year, month, eid, emp_name, day, field, old_val, new_val)
  values (
    hr.actor_email(), new.site_key,
    extract(year  from new.entry_date)::int,
    extract(month from new.entry_date)::int,
    new.eid, emp_name,
    extract(day   from new.entry_date)::int,
    'slot' || new.slot,
    case when tg_op = 'UPDATE' then old.value else null end,
    new.value
  );
  return new;
end;
$$;

drop trigger if exists work_entries_audit on hr.work_entries;
create trigger work_entries_audit after insert or update on hr.work_entries
  for each row execute function hr.audit_work_entry();

-- work_entries.updated_at is already stamped by enforce_entry_window above, on
-- both insert and update, so the separate touch trigger the old schema carried
-- would fire second and do the same assignment again. Dropped rather than kept:
-- two triggers writing one column is a puzzle for whoever reads this next, and
-- the window trigger cannot be skipped anyway.
drop trigger if exists work_entries_touch on hr.work_entries;

-- work_days has no touch trigger for the same reason: work_days_window stamps it.
