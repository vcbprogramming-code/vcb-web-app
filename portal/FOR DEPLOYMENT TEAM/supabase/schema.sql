-- VCB Connect Portal — Supabase schema
--
-- The portal is a launcher: it renders a list of apps and one optional
-- announcement banner. It has no spreadsheet. In Apps Script the announcement
-- and the admin password hash live in ScriptProperties
-- (ANNOUNCEMENT_JSON / ADMIN_PASSWORD_HASH); the app list is the hardcoded
-- APPS array in ../../ORIGINAL CODE/Code.js.
--
-- This schema covers only what actually needs to persist. The app list becomes
-- a table so links can be edited without a redeploy — the stale Credit Facility
-- URL that had to be fixed by hand on 2026-08-30 is exactly the problem that
-- solves.
--
-- Run once against a fresh Supabase project (SQL Editor, or `supabase db push`).
--
-- SECURITY MODEL
-- The portal is read by everyone, signed in or not — it is the front door. So
-- reads are open to anon. Writes require an authenticated user on the admins
-- list. Note the Apps Script version gated the admin panel behind a password
-- hash in ScriptProperties; that approach cannot survive in a SPA, where the
-- comparison would happen in the browser. Real auth replaces it.

-- ---------------------------------------------------------------- identity --

create table if not exists public.portal_admins (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.portal_admins enable row level security;

create policy "portal admins readable by signed-in users" on public.portal_admins
  for select to authenticated using (true);
-- No write policy: manage from the Supabase dashboard.

create or replace function public.is_portal_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.portal_admins a
                  where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email','')));
$$;

grant execute on function public.is_portal_admin() to anon, authenticated;

-- -------------------------------------------------------------- app tiles --

-- Replaces the hardcoded APPS array. Editing a launch URL becomes a row update
-- instead of a code change plus redeploy.
create table if not exists public.apps (
  key         text primary key,          -- 'ememo', 'credit', 'sop', …
  name        text not null,
  name_th     text,
  description text,
  description_th text,
  url         text not null,
  icon        text,
  accent      text,
  sort_order  int not null default 0,
  enabled     boolean not null default true
);

-- ---------------------------------------------------------- announcement --

-- Single-row table, mirroring ANNOUNCEMENT_JSON. `show` controls whether the
-- banner renders; the client dismisses per-device by `id`, unchanged.
create table if not exists public.announcement (
  id         int primary key default 1 check (id = 1),
  title      text,
  body       text,
  show       boolean not null default false,
  -- Bumped on every save so a dismissed banner re-appears when the text
  -- changes. The Apps Script version used a uuid in the JSON for this.
  revision   bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text
);

create or replace function public.announcement_bump_revision()
returns trigger language plpgsql as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists announcement_bump on public.announcement;
create trigger announcement_bump before update on public.announcement
  for each row execute function public.announcement_bump_revision();

-- ------------------------------------------------------- row level security --

alter table public.apps         enable row level security;
alter table public.announcement enable row level security;

-- The front door is public: anyone can see the tiles and the banner.
create policy "apps readable by anyone" on public.apps
  for select to anon, authenticated using (true);
create policy "announcement readable by anyone" on public.announcement
  for select to anon, authenticated using (true);

create policy "apps writable by portal admins" on public.apps
  for all to authenticated
  using (public.is_portal_admin()) with check (public.is_portal_admin());
create policy "announcement writable by portal admins" on public.announcement
  for all to authenticated
  using (public.is_portal_admin()) with check (public.is_portal_admin());

-- ------------------------------------------------------------------ seeding --
--
--   1. insert into public.portal_admins (email) values (…);
--   2. Seed public.apps from the APPS array in ../../ORIGINAL CODE/Code.js.
--      Keep the /exec URLs — the Apps Script apps stay live until each one is
--      migrated, so the portal must keep pointing at them during the
--      transition, one row at a time as each app moves.
--   3. insert into public.announcement (id, show) values (1, false);
--   4. Enable Supabase Auth → Google, restricted to your workspace domain.
