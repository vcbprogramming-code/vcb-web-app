-- VCB HR Work Log — Supabase schema
--
-- Mirrors the live "HR Work Log — Database" Google Sheet: the fixed tabs in
-- HEADERS (../../ORIGINAL CODE/Code.gs) plus the per-site-per-month "wide" tabs
-- that hold the actual daily entries.
--
-- Run once against a fresh Supabase project (SQL Editor, or `supabase db push`).
--
-- THE ONE REAL DESIGN CHANGE
-- The sheet keeps daily work in a WIDE tab per (site, month): one row per
-- employee and 98 columns — "AM 1", "Note 1", … "AM 31", "Note 31", then an
-- appended "PM 1".."PM 31" block (wideHeaders_ in Code.gs). That shape exists
-- because a spreadsheet cannot cheaply hold one row per person per day, and it
-- forces awkward things: a fixed 31-day ceiling, columns whose meaning depends
-- on position, and a migration whenever a new per-day field is needed.
--
-- Here it is normalised to ONE ROW PER (employee, date, period) in
-- work_entries. Everything the wide tab could express is still expressible, the
-- 31-day limit disappears, and per-day queries stop being column arithmetic.
-- The import step in MIGRATION.md does that pivot; it is the only place where
-- the migration is not a straight copy, so verify it carefully.
--
-- SECURITY MODEL
-- The Apps Script app resolves the caller with Session.getActiveUser() and
-- reads a role from the Users tab (admin / manager / staff, scoped by site).
-- A SPA ships its anon key in the browser bundle, so all of that is enforced
-- here in the database instead of in the UI.

-- ---------------------------------------------------------------- identity --

-- Sheet tab: Users — email | role | site_key | eid
create table if not exists public.users (
  email      text primary key,
  role       text not null default 'staff' check (role in ('admin','manager','staff')),
  site_key   text,
  eid        text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users readable by signed-in users" on public.users
  for select to authenticated using (true);
-- No write policy: manage roles from the Supabase dashboard.

create or replace function public.my_role()
returns text language sql security definer set search_path = public stable as $$
  select coalesce(
    (select u.role from public.users u
      where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email',''))),
    'none');
$$;

create or replace function public.my_site()
returns text language sql security definer set search_path = public stable as $$
  select (select u.site_key from public.users u
           where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email','')));
$$;

create or replace function public.is_hr_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select public.my_role() = 'admin';
$$;

-- Admins see every site; managers and staff only their own.
create or replace function public.can_access_site(p_site text)
returns boolean language sql security definer set search_path = public stable as $$
  select public.is_hr_admin() or (public.my_site() is not null and public.my_site() = p_site);
$$;

grant execute on function public.my_role()            to authenticated;
grant execute on function public.my_site()            to authenticated;
create or replace function public.is_hr_admin() returns boolean language sql
  security definer set search_path = public stable as $$ select public.my_role() = 'admin'; $$;
grant execute on function public.is_hr_admin()        to authenticated;
grant execute on function public.can_access_site(text) to authenticated;

-- ------------------------------------------------------------ reference data --

-- Sheet tab: Config — key | value
create table if not exists public.config (
  key   text primary key,
  value text
);

-- Sheet tab: Sites — key | name | company | active
create table if not exists public.sites (
  key     text primary key,
  name    text not null,
  company text,
  active  boolean not null default true
);

-- Sheet tab: Teams — site_key | name | desc
create table if not exists public.teams (
  site_key    text not null references public.sites(key) on delete cascade,
  name        text not null,
  description text,                      -- sheet: desc (reserved word)
  primary key (site_key, name)
);

-- Sheet tab: Employees
create table if not exists public.employees (
  eid        text primary key,
  site_key   text references public.sites(key),
  emp_id     text,
  name       text not null,
  position   text,
  department text,
  kind       text,
  division   text,
  email      text
);

create index if not exists employees_site_idx on public.employees(site_key);

-- Sheet tab: MasterIndex — the job/activity catalogue.
create table if not exists public.master_index (
  id           text primary key,
  code         text,
  name         text,
  description  text,                     -- sheet: desc
  category     text,
  sites        text[] not null default '{}',
  mapping      text,
  fixed_cost   numeric(18,2),
  allowed_cost numeric(18,2)
);

-- Sheet tab: CostIndex
create table if not exists public.cost_index (
  id      text primary key,
  code    text,
  name    text,
  name_en text
);

-- Sheet tab: Migrations — employee moved between sites.
create table if not exists public.migrations (
  id        bigint generated always as identity primary key,
  eid       text references public.employees(eid),
  from_site text,
  to_site   text,
  move_date date,                        -- sheet: date
  moved_by  text,                        -- sheet: by
  at        timestamptz not null default now()   -- sheet: ts
);

-- Sheet tab: LeaveRequests
create table if not exists public.leave_requests (
  id           text primary key,
  eid          text references public.employees(eid),
  site_key     text references public.sites(key),
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

create index if not exists leave_site_status_idx on public.leave_requests(site_key, status);

-- Sheet tab: AuditLog — one row per field change. Append-only.
create table if not exists public.audit_log (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),   -- sheet: ts
  email     text,
  site      text,
  year      int,
  month     int,
  eid       text,
  emp_name  text,
  day       int,
  field     text,
  old_val   text,
  new_val   text
);

create index if not exists hr_audit_at_idx on public.audit_log(at desc);

-- ------------------------------------------------------- the daily entries --

-- Replaces the wide per-(site, month) tabs. One row per employee per day per
-- period. `period` is 'am' or 'pm' — the sheet's AM block and appended PM block.
create table if not exists public.work_entries (
  id         bigint generated always as identity primary key,
  eid        text not null references public.employees(eid) on delete cascade,
  site_key   text not null references public.sites(key),
  entry_date date not null,
  period     text not null check (period in ('am','pm')),
  -- The activity code written in the cell (e.g. 'A-1'), matching MasterIndex.
  value      text,
  note       text,
  updated_at timestamptz not null default now(),
  updated_by text,
  unique (eid, entry_date, period)
);

create index if not exists work_entries_site_date_idx on public.work_entries(site_key, entry_date);
create index if not exists work_entries_eid_date_idx  on public.work_entries(eid, entry_date);

-- ------------------------------------------------------- row level security --

alter table public.config         enable row level security;
alter table public.sites          enable row level security;
alter table public.teams          enable row level security;
alter table public.employees      enable row level security;
alter table public.master_index   enable row level security;
alter table public.cost_index     enable row level security;
alter table public.migrations     enable row level security;
alter table public.leave_requests enable row level security;
alter table public.audit_log      enable row level security;
alter table public.work_entries   enable row level security;

-- Reference data: readable by any signed-in user, writable by admins only.
do $$
declare t text;
begin
  foreach t in array array['config','sites','teams','master_index','cost_index'] loop
    execute format(
      'create policy "%1$s readable by signed-in users" on public.%1$I
         for select to authenticated using (true)', t);
    execute format(
      'create policy "%1$s writable by admins" on public.%1$I
         for all to authenticated
         using (public.is_hr_admin()) with check (public.is_hr_admin())', t);
  end loop;
end $$;

-- Employees: visible within your own site (admins see all).
create policy "employees readable within site" on public.employees
  for select to authenticated using (public.can_access_site(site_key));
create policy "employees writable by admins" on public.employees
  for all to authenticated using (public.is_hr_admin()) with check (public.is_hr_admin());

-- Work entries: the core rule — you may read and write entries for your own
-- site; admins may do so for any site. This is what replaces "which wide tab
-- am I allowed to open".
create policy "work entries readable within site" on public.work_entries
  for select to authenticated using (public.can_access_site(site_key));
create policy "work entries writable within site" on public.work_entries
  for all to authenticated
  using (public.can_access_site(site_key)) with check (public.can_access_site(site_key));

-- Leave requests: staff see their own site's; only managers/admins decide.
create policy "leave readable within site" on public.leave_requests
  for select to authenticated using (public.can_access_site(site_key));
create policy "leave insertable within site" on public.leave_requests
  for insert to authenticated with check (public.can_access_site(site_key));
create policy "leave decidable by managers" on public.leave_requests
  for update to authenticated
  using (public.my_role() in ('admin','manager') and public.can_access_site(site_key))
  with check (public.my_role() in ('admin','manager') and public.can_access_site(site_key));

-- Migrations and audit: admin-readable, append-only.
create policy "migrations readable by admins" on public.migrations
  for select to authenticated using (public.is_hr_admin());
create policy "migrations insertable by admins" on public.migrations
  for insert to authenticated with check (public.is_hr_admin());

create policy "hr audit readable by admins" on public.audit_log
  for select to authenticated using (public.is_hr_admin());
create policy "hr audit insertable by signed-in users" on public.audit_log
  for insert to authenticated with check (true);

-- Keep updated_at honest on every entry write.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists work_entries_touch on public.work_entries;
create trigger work_entries_touch before update on public.work_entries
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------ seeding --
--
-- After running this file:
--   1. Import Config, Sites, Teams, Employees, Users, MasterIndex, CostIndex.
--   2. Import LeaveRequests, Migrations, AuditLog.
--   3. Pivot every wide tab into work_entries — see MIGRATION.md. This is the
--      step to check twice.
--   4. Enable Supabase Auth → Google, restricted to your workspace domain.
