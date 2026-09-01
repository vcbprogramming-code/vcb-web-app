-- 007 — onboarding: new-hire employees, checklist progress, content overrides.
--
-- ACCESS CONTROL LIVES IN THE API: api/src/routes/onboarding.js.
--
-- This is the widest surface in the system and that is deliberate, not an
-- oversight. The people who use this module are new hires on their first day,
-- BEFORE anyone has created an account for them; the Apps Script version had no
-- sign-in at all. So most routes are allowAnonymous, scoped to one named
-- employee per request. The exceptions are checklist_overrides (shared content
-- rendered into everyone's page — requireRole('portal','admin')) and the admin
-- cohort view. Nothing sensitive lives here: names, a department, a level, and a
-- set of ticked checkboxes. Do not put anything here that would be damaging to
-- read or forge — if this module ever needs to hold something real, it needs
-- real accounts first.
--
-- No RLS. See 001_schemas.sql. The old policies were all "anyone" anyway, so
-- nothing is lost by their absence — but see the DROPPED FUNCTIONS section at
-- the foot of this file, which removes something that was worse than useless.

-- -------------------------------------------------------------- employees --

-- Name-only identity, matching the original app: identity is a name typed into
-- a box and kept in localStorage.
--
-- NOT the same table as hr.employees, which is keyed by eid and holds the real
-- roster. Two different tables with the same name is precisely why these live in
-- separate schemas — in one `public` schema an unqualified `employees` would be
-- a coin flip.
--
-- The name IS the primary key, so the API trims it everywhere before it reaches
-- here: an untrimmed variant creates a second, empty record that looks to the
-- employee exactly like their progress having been lost.
create table if not exists onboarding.employees (
  name       text primary key,
  department text,
  level      text default 'junior' check (level in ('junior','senior')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists onboarding.progress (
  id            bigint generated always as identity primary key,
  employee_name text not null references onboarding.employees(name) on delete cascade,
  task_id       text not null,
  completed     boolean not null default false,
  updated_at    timestamptz not null default now(),
  unique (employee_name, task_id)
);

-- The foreign key is load-bearing: it turns a typo'd name into a 23503 the API
-- reports as a 409, instead of an orphan progress row nothing will ever read.
create index if not exists progress_employee_name_idx on onboarding.progress(employee_name);

-- ------------------------------------------------------ checklist overrides --

-- Overlays onto the hardcoded department content in the React bundle at render
-- time. Nothing here is ever the sole source of truth for content that has no
-- row.
--
-- Deleted rows are kept (deleted = true) rather than removed, because the client
-- needs the row in order to know to hide the hardcoded item it overlays. A hard
-- delete would make the item reappear.
--
-- Note this is not an audit trail: rows are upserted in place, so an edit
-- overwrites the previous text with no history and no actor column.
create table if not exists onboarding.checklist_overrides (
  item_id     text primary key,
  page_key    text,
  block_index int,
  text        text,
  level       text check (level in ('junior','senior')),
  deleted     boolean not null default false,
  sort_order  int,
  updated_at  timestamptz not null default now()
);

create index if not exists checklist_page_idx on onboarding.checklist_overrides(page_key, sort_order);

-- -------------------------------------------------------- document storage --

-- Replaces the original Drive-upload flow. The bytes go to Supabase Storage via
-- the shared storage lib, which signs the URL; the API only tells the client
-- which object path a document belongs at.
--
-- The path is keyed by employee name + docId + extension and NOT by the uploaded
-- filename: with the filename in the path, re-uploading a differently-named file
-- for the same requirement created a SECOND object instead of replacing the
-- first, and nobody could tell which was current.
--
-- This insert needs the service role in some Supabase projects. If it fails,
-- create the bucket by hand (Storage → New bucket, id 'required-documents',
-- not public) and re-run; everything else in this file is independent of it.
insert into storage.buckets (id, name, public)
values ('required-documents', 'required-documents', false)
on conflict (id) do nothing;

-- ------------------------------------------------------- DROPPED FUNCTIONS --
--
-- check_admin_password() and admin_save_checklist_item() /
-- admin_delete_checklist_item() are dropped, and must not come back.
--
-- They implemented a shared-password back door: security-definer functions that
-- compared a caller-supplied string against a Postgres setting and, if it
-- matched, wrote the table on the caller's behalf — bypassing the fact that the
-- table had no write policy. Granted to `anon`, by design, because the whole
-- point was to let an unauthenticated browser write.
--
-- Three separate reasons that is a live vulnerability rather than merely dated:
--   * One password shared by every admin, with no identity attached, so the
--     "who edited this" question has no answer even in principle.
--   * `current_setting('app.admin_password', true)` returns NULL when the
--     setting was never applied, and the function's own fallback ('__unset__')
--     is a literal that anyone reading this file can send.
--   * A security-definer function granted to anon is a standing offer: it runs
--     as its owner, so anything wrong with the check is a full write to shared
--     content that renders into every employee's page.
--
-- What replaces it: requireAuth + requireRole('portal','admin') on
-- PUT/DELETE /api/onboarding/checklist. Same gate, an actual named person, and
-- an audit trail becomes possible.
--
-- Dropped in dependency order — admin_delete_checklist_item calls
-- admin_save_checklist_item, which calls check_admin_password.
drop function if exists public.admin_delete_checklist_item(text, text);
drop function if exists public.admin_save_checklist_item(text, text, text, int, text, text, boolean, int);
drop function if exists public.check_admin_password(text);

-- Same for the onboarding schema, in case a copy was ever created there.
drop function if exists onboarding.admin_delete_checklist_item(text, text);
drop function if exists onboarding.admin_save_checklist_item(text, text, text, int, text, text, boolean, int);
drop function if exists onboarding.check_admin_password(text);
