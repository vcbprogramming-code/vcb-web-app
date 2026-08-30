-- VCB-MANGO ERP SOP — Supabase schema
--
-- The SOP app has no spreadsheet. Its content lives as ONE JSON document,
-- parsed from a Google Doc (SOP_DOC_ID in ../../ORIGINAL CODE/apps-script/Code.js)
-- and cached into ScriptProperties in chunks because a single property has a
-- size limit. Every mutation also drops a timestamped JSON snapshot into Drive.
--
-- So the migration here is small: the chunking disappears (Postgres has no such
-- limit), and the Drive snapshots become rows in sop_versions.
--
-- Run once against a fresh Supabase project (SQL Editor, or `supabase db push`).
--
-- SECURITY MODEL
-- The Apps Script app is readable by anyone in the company and edited by
-- whoever has the app URL. Here reads stay open (the SOP is reference material
-- everyone needs), and writes require an authenticated user on the editors
-- list — enforced in the database, because the anon key ships in the bundle.

-- ---------------------------------------------------------------- identity --

create table if not exists public.sop_editors (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.sop_editors enable row level security;

create policy "sop editors readable by signed-in users" on public.sop_editors
  for select to authenticated using (true);
-- No write policy: manage this list from the Supabase dashboard.

create or replace function public.is_sop_editor()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.sop_editors e
                  where lower(e.email) = lower(coalesce(auth.jwt() ->> 'email','')));
$$;

grant execute on function public.is_sop_editor() to anon, authenticated;

-- ----------------------------------------------------------------- content --

-- The whole SOP tree, as one JSON document. Deliberately kept as a single row
-- rather than normalised into modules/steps: the client reads and writes it as
-- a whole (getSopData / renumberAllSteps_), and splitting it would mean
-- rebuilding that logic for no gain until something actually queries by step.
create table if not exists public.sop_document (
  id         int primary key default 1 check (id = 1),   -- single-row table
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Replaces the timestamped JSON snapshots written to Drive on every mutation.
create table if not exists public.sop_versions (
  id         bigint generated always as identity primary key,
  data       jsonb not null,
  taken_at   timestamptz not null default now(),
  taken_by   text,
  note       text
);

create index if not exists sop_versions_taken_idx on public.sop_versions(taken_at desc);

-- Snapshot the previous document before every overwrite, so the version history
-- happens in the database rather than depending on the client remembering to.
create or replace function public.sop_snapshot_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.sop_versions (data, taken_by, note)
  values (old.data, old.updated_by, 'auto-snapshot before update');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sop_snapshot on public.sop_document;
create trigger sop_snapshot before update on public.sop_document
  for each row execute function public.sop_snapshot_before_update();

-- ------------------------------------------------------- row level security --

alter table public.sop_document enable row level security;
alter table public.sop_versions enable row level security;

-- Reads open to everyone, matching the live app: the SOP is reference material
-- staff open without signing in.
create policy "sop readable by anyone" on public.sop_document
  for select to anon, authenticated using (true);

create policy "sop writable by editors" on public.sop_document
  for all to authenticated
  using (public.is_sop_editor()) with check (public.is_sop_editor());

create policy "sop versions readable by editors" on public.sop_versions
  for select to authenticated using (public.is_sop_editor());
-- Inserts come from the trigger above (security definer), not from clients.

-- ------------------------------------------------------------------ seeding --
--
--   1. insert into public.sop_editors (email) values (…);
--   2. Seed the document once from the live app's own JSON export:
--        open <exec-url>?diag=sopdata  (getSopData), copy the JSON, then
--        insert into public.sop_document (id, data) values (1, '<json>'::jsonb);
--   3. Enable Supabase Auth → Google, restricted to your workspace domain.
--
-- The Google Doc (SOP_DOC_ID) stays as the upstream source of truth until the
-- React app fully replaces the Apps Script one. Decide deliberately when to cut
-- that link — see MIGRATION.md in the credit-facility folder for the general
-- argument about what is gained and lost by leaving Apps Script.
