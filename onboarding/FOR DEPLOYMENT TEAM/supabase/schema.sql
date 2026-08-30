-- VCB Onboarding Portal — Supabase schema
-- Mirrors the original app's "Onboarding Progress" Google Sheet
-- (Employee | TaskId | Completed | Timestamp), plus one row per employee
-- for department/level, which the original app only ever stored in
-- localStorage (see React/README.md's "Ported behavior" section for why
-- that's now a real column instead).
--
-- Run this once against a fresh Supabase project (SQL Editor, or
-- `supabase db push` if you're using the Supabase CLI locally).

create table if not exists public.employees (
  -- Name-only identity, matching the original app exactly (no real auth
  -- yet — see React/README.md's "Auth" section for why this was a
  -- deliberate scope decision, not an oversight).
  name text primary key,
  department text,
  level text default 'junior' check (level in ('junior', 'senior')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.progress (
  id bigint generated always as identity primary key,
  employee_name text not null references public.employees(name) on delete cascade,
  task_id text not null,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (employee_name, task_id)
);

create index if not exists progress_employee_name_idx on public.progress(employee_name);

-- Row Level Security: open for now to match the original app's own lack of
-- real auth (anyone with the anon key can read/write, exactly like anyone
-- who could open the web app URL could read/write the Sheet before). If you
-- add real Supabase auth later, replace these permissive policies with
-- ones scoped to auth.uid() and stop accepting a plain employee_name from
-- the client.
alter table public.employees enable row level security;
alter table public.progress enable row level security;

create policy "employees are readable by anyone" on public.employees
  for select using (true);
create policy "employees are insertable by anyone" on public.employees
  for insert with check (true);
create policy "employees are updatable by anyone" on public.employees
  for update using (true);

create policy "progress is readable by anyone" on public.progress
  for select using (true);
create policy "progress is insertable by anyone" on public.progress
  for insert with check (true);
create policy "progress is updatable by anyone" on public.progress
  for update using (true);

-- Document uploads — replaces the original app's Drive-upload flow
-- (uploadRequiredDocument in Code.gs, which saved into a per-employee
-- subfolder of "VCB Onboarding Portal — Document Uploads"). Run this
-- separately in the Supabase dashboard (Storage → New bucket) if the SQL
-- below doesn't have permission to create buckets directly in your
-- project — the storage.buckets insert requires the service role in some
-- Supabase configurations.
insert into storage.buckets (id, name, public)
values ('required-documents', 'required-documents', false)
on conflict (id) do nothing;

create policy "anyone can upload their own required documents"
  on storage.objects for insert
  with check (bucket_id = 'required-documents');

create policy "anyone can read required documents"
  on storage.objects for select
  using (bucket_id = 'required-documents');

-- Admin checklist editor — replaces the original app's "Checklist Content"
-- Sheet (Code.gs: getChecklistOverrides/saveChecklistItem/
-- deleteChecklistItem). Same override-not-replace model: a row here
-- overlays onto the hardcoded department content in src/data/*.ts at
-- render time; nothing here is ever the sole source of truth for content
-- that has no row.
create table if not exists public.checklist_overrides (
  item_id text primary key,
  page_key text,
  block_index int,
  text text,
  level text check (level in ('junior', 'senior')),
  deleted boolean not null default false,
  sort_order int,
  updated_at timestamptz not null default now()
);

alter table public.checklist_overrides enable row level security;

-- Reading overrides needs to be public (every employee's page load applies
-- them), but WRITING is NOT open.
--
-- This used to be `for all using (true) with check (true)`, which meant the
-- password gate lived only in the UI: anyone with the anon key (it ships in
-- the browser bundle) could call
-- supabase.from('checklist_overrides').upsert(...) directly and rewrite or
-- delete any department's checklist without ever seeing the prompt. RLS by
-- itself cannot close that, because Postgres has no way to know whether the
-- client called check_admin_password() first.
--
-- The fix: reads stay open (this content is rendered into every employee's
-- page anyway), direct writes are denied outright, and every write goes
-- through admin_save_checklist_item() / admin_delete_checklist_item() below
-- — security-definer functions that verify the password *inside the same
-- call* that performs the write, so the check cannot be skipped. This
-- mirrors the original app's requireAdmin_() gate in Code.gs.
create policy "checklist overrides are readable by anyone" on public.checklist_overrides
  for select using (true);
-- No insert/update/delete policy is defined, so with RLS enabled those are
-- denied for anon/authenticated. The security-definer functions below bypass
-- RLS as their owner, which is exactly why they must check the password.

-- Writes a checklist override, but only for a caller who supplies the
-- correct admin password. security definer = runs as the function owner, so
-- it can write despite the absent write policy above; the password check is
-- therefore the real gate and must come first.
create or replace function public.admin_save_checklist_item(
  attempt text,
  p_item_id text,
  p_page_key text default null,
  p_block_index int default null,
  p_text text default null,
  p_level text default null,
  p_deleted boolean default false,
  p_sort_order int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.check_admin_password(attempt) then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;
  if coalesce(trim(p_item_id), '') = '' then
    raise exception 'Missing item id.' using errcode = '22023';
  end if;

  insert into public.checklist_overrides
    (item_id, page_key, block_index, text, level, deleted, sort_order, updated_at)
  values
    (p_item_id, p_page_key, p_block_index, p_text, p_level, coalesce(p_deleted, false), p_sort_order, now())
  on conflict (item_id) do update set
    -- Only overwrite a column the caller actually supplied, so a partial
    -- edit can't blank out fields it wasn't editing. Matches the original
    -- app's saveChecklistItem, which preserves existing values for any
    -- omitted field.
    page_key    = coalesce(excluded.page_key,    checklist_overrides.page_key),
    block_index = coalesce(excluded.block_index, checklist_overrides.block_index),
    text        = coalesce(excluded.text,        checklist_overrides.text),
    level       = coalesce(excluded.level,       checklist_overrides.level),
    deleted     = excluded.deleted,
    sort_order  = coalesce(excluded.sort_order,  checklist_overrides.sort_order),
    updated_at  = now();
end;
$$;

-- Soft-delete, matching the original app's deleteChecklistItem: the row
-- survives with deleted = true rather than being removed. Note this is NOT a
-- full audit trail — rows are upserted in place, so an edit overwrites the
-- previous text with no history, and there is no actor column.
create or replace function public.admin_delete_checklist_item(attempt text, p_item_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_save_checklist_item(attempt, p_item_id, p_deleted => true);
end;
$$;

-- Anon may CALL these (the password check inside is the gate); it may not
-- write the table directly.
grant execute on function public.admin_save_checklist_item(text, text, text, int, text, text, boolean, int) to anon, authenticated;
grant execute on function public.admin_delete_checklist_item(text, text) to anon, authenticated;


-- Stores the admin password as a Postgres setting rather than in the
-- client bundle. Set your own value after running this file:
--   select set_config('app.admin_password', 'your-real-password', false);
-- (that only lasts the current session — for a durable value, set it via
-- the Supabase dashboard's Database → Configuration → Custom Postgres
-- config, or bake it into this function directly if you're comfortable
-- keeping the password in this SQL file instead.)
create or replace function public.check_admin_password(attempt text)
returns boolean
language sql
security definer
as $$
  select attempt = coalesce(current_setting('app.admin_password', true), '__unset__');
$$;
