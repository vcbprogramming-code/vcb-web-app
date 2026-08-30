-- VCB Meeting Minutes — Supabase schema
--
-- Mirrors the live "VCB Meeting Minutes — Database" Google Sheet: the `Minutes`
-- tab (COLUMNS in ../../ORIGINAL CODE/Config.js), plus AUDIT_LOG, Versions and
-- FATHOM_RAW_LOG. Column names are snake_cased.
--
-- Run once against a fresh Supabase project (SQL Editor, or `supabase db push`).
--
-- SECURITY MODEL
-- The Apps Script app is deployed ANYONE_ANONYMOUS: a public project is
-- readable with no sign-in at all, a locked project only by admins, editors and
-- the emails named on it, and editing always requires signing in (Auth.js).
-- That three-tier model is reproduced here in RLS. The anon key ships in the
-- browser bundle, so every rule below is enforced in the database — never in
-- the UI, which a determined user simply skips.

-- ---------------------------------------------------------------- identity --

-- Replaces ADMIN_EMAILS in Config.js.
create table if not exists public.admins (
  email text primary key,
  created_at timestamptz not null default now()
);

-- Replaces the self-service EDITOR_EMAILS list managed from Settings.
create table if not exists public.editors (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admins  enable row level security;
alter table public.editors enable row level security;

create policy "admins readable by signed-in users" on public.admins
  for select to authenticated using (true);
create policy "editors readable by signed-in users" on public.editors
  for select to authenticated using (true);
-- No write policies: manage both lists from the Supabase dashboard.

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.admins a
                  where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email','')));
$$;

create or replace function public.is_editor()
returns boolean language sql security definer set search_path = public stable as $$
  select public.is_admin() or exists (
    select 1 from public.editors e
     where lower(e.email) = lower(coalesce(auth.jwt() ->> 'email','')));
$$;

grant execute on function public.is_admin()  to anon, authenticated;
grant execute on function public.is_editor() to anon, authenticated;

-- ---------------------------------------------------------------- projects --

-- SOURCE_DOCS in Config.js are the original five, never mutated. Projects added
-- later via "+ New project" lived in the EXTRA_PROJECTS script property. Both
-- become rows here; `builtin` marks the original five so they can be protected.
create table if not exists public.projects (
  id         text primary key,          -- FIN / BD / BT12 / BV / PN34 / …
  name       text not null,
  name_en    text,
  cadence    text,
  color      text,
  sort_order int,
  doc_id     text,                      -- source Google Doc, if imported
  builtin    boolean not null default false,
  -- 'public'  = readable by anyone, no sign-in (the app's 🔓 Public)
  -- 'locked'  = admins, editors and the guest list only (🔒 Locked)
  visibility text not null default 'locked' check (visibility in ('public','locked')),
  created_at timestamptz not null default now()
);

-- Per-project guest list — the emails named on a locked project.
create table if not exists public.project_guests (
  project_id text not null references public.projects(id) on delete cascade,
  email      text not null,
  primary key (project_id, email)
);

-- True when the current caller may READ this project. Mirrors Auth.js: public
-- projects are open to everyone including anon; locked ones need admin, editor,
-- or a named guest.
create or replace function public.can_read_project(p_project_id text)
returns boolean language sql security definer set search_path = public stable as $$
  select
    coalesce((select p.visibility = 'public' from public.projects p where p.id = p_project_id), false)
    or public.is_editor()
    or exists (
      select 1 from public.project_guests g
       where g.project_id = p_project_id
         and lower(g.email) = lower(coalesce(auth.jwt() ->> 'email','')));
$$;

grant execute on function public.can_read_project(text) to anon, authenticated;

-- ----------------------------------------------------------------- minutes --

-- Sheet tab: Minutes. One row per meeting.
create table if not exists public.minutes (
  id           text primary key,
  project_id   text not null references public.projects(id),
  meeting_key  text not null,           -- stable key within a project
  meeting_date date,                    -- sheet: date (ISO when parseable)
  date_label   text,                    -- original label as written
  time         text,
  title        text,
  kind         text check (kind in ('overview','meeting')),
  excerpt      text,
  fathom_url   text,
  attendees    jsonb not null default '[]'::jsonb,
  tab_id       text,
  source       text check (source in ('doc-import','manual','fathom','transkriptor')),
  visible      boolean not null default false,
  pinned       boolean not null default false,
  -- Inbox rows may ALSO be filed under other projects; project_id itself never
  -- changes (the row never leaves its inbox). Was a comma-separated string.
  tagged_project_ids text[] not null default '{}',
  attachments  jsonb not null default '[]'::jsonb,
  comments     jsonb not null default '[]'::jsonb,
  -- Full meeting body. In the sheet this lived outside the row (saveContent_);
  -- here it is a column, which removes the separate content store entirely.
  content_html text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (project_id, meeting_key)
);

create index if not exists minutes_project_idx on public.minutes(project_id);
create index if not exists minutes_date_idx    on public.minutes(meeting_date desc);
create index if not exists minutes_tagged_idx  on public.minutes using gin (tagged_project_ids);

-- Sheet tab: Versions — pre-edit snapshots. Append-only.
create table if not exists public.versions (
  id         bigint generated always as identity primary key,
  minute_id  text not null references public.minutes(id) on delete cascade,
  snapshot   jsonb not null,
  taken_at   timestamptz not null default now(),
  taken_by   text
);

create index if not exists versions_minute_idx on public.versions(minute_id, taken_at desc);

-- Sheet tab: AUDIT_LOG — append-only record of every content-changing mutation.
create table if not exists public.audit_log (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  actor     text,
  action    text,
  target    text,
  target_id text,
  changes   jsonb,
  note      text
);

create index if not exists audit_log_at_idx on public.audit_log(at desc);

-- Sheet tab: FATHOM_RAW_LOG — raw webhook payloads, kept for replay/diagnosis.
create table if not exists public.fathom_raw_log (
  id           bigint generated always as identity primary key,
  received_at  timestamptz not null default now(),
  payload      jsonb not null,
  recording_id text
);

create index if not exists fathom_raw_recording_idx on public.fathom_raw_log(recording_id);

-- ------------------------------------------------------- row level security --

alter table public.projects       enable row level security;
alter table public.project_guests enable row level security;
alter table public.minutes        enable row level security;
alter table public.versions       enable row level security;
alter table public.audit_log      enable row level security;
alter table public.fathom_raw_log enable row level security;

-- Projects: the list itself is public (the sidebar renders for anonymous
-- visitors); only admins may change it.
create policy "projects readable by anyone" on public.projects
  for select to anon, authenticated using (true);
create policy "projects writable by admins" on public.projects
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "guest lists readable by editors" on public.project_guests
  for select to authenticated using (public.is_editor());
create policy "guest lists writable by admins" on public.project_guests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Minutes: the three-tier rule. A row is readable when its project is readable
-- AND the row is marked visible — unless the caller is an editor/admin, who see
-- hidden rows too. Inbox rows tagged into another project are reachable through
-- that project as well.
create policy "minutes readable per project access" on public.minutes
  for select to anon, authenticated
  using (
    (public.can_read_project(project_id) and visible)
    or public.is_editor()
    or exists (
      select 1 from unnest(tagged_project_ids) t(pid)
       where public.can_read_project(pid) and minutes.visible)
  );

-- Editors may create and edit content. Only admins may change hidden/pinned
-- status or delete, matching the app's split of powers — enforced by the
-- trigger below, since RLS alone cannot compare old and new values per column.
create policy "minutes writable by editors" on public.minutes
  for insert to authenticated with check (public.is_editor());
create policy "minutes updatable by editors" on public.minutes
  for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "minutes deletable by admins" on public.minutes
  for delete to authenticated using (public.is_admin());

create or replace function public.minutes_guard_admin_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.visible is distinct from old.visible
      or new.pinned is distinct from old.pinned)
     and not public.is_admin() then
    raise exception 'Only an admin may change visible/pinned.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists minutes_guard on public.minutes;
create trigger minutes_guard before update on public.minutes
  for each row execute function public.minutes_guard_admin_fields();

-- Versions / audit: admin-only reading (the app's "Edit history" panel is
-- admin-only), append-only writing.
create policy "versions readable by admins" on public.versions
  for select to authenticated using (public.is_admin());
create policy "versions insertable by editors" on public.versions
  for insert to authenticated with check (public.is_editor());

create policy "audit readable by admins" on public.audit_log
  for select to authenticated using (public.is_admin());
create policy "audit insertable by editors" on public.audit_log
  for insert to authenticated with check (public.is_editor());

-- Raw webhook log: admin-only. Writes arrive from the server-side ingest
-- (service role), never from a browser, so no insert policy is granted here.
create policy "fathom raw log readable by admins" on public.fathom_raw_log
  for select to authenticated using (public.is_admin());

-- ------------------------------------------------------------------ seeding --
--
-- After running this file:
--   1. insert into public.admins (email) values (…);   -- from ADMIN_EMAILS
--   2. insert into public.editors (email) values (…);  -- from EDITOR_EMAILS
--   3. insert the five built-in projects from SOURCE_DOCS in Config.js with
--      builtin = true, then any EXTRA_PROJECTS entries with builtin = false.
--   4. Enable Supabase Auth → Google, restricted to your workspace domain.
--   5. Import the sheet data — see MIGRATION.md.
