-- 006 — sop: the SOP document and its version history.
--
-- ACCESS CONTROL LIVES IN THE API: api/src/routes/sop.js. Reads are
-- allowAnonymous (the SOP is reference material staff open without signing in —
-- requiring auth would be a regression); writes are
-- requireRole('sop','editor'), as is the version history, which carries
-- pre-edit content.
--
-- No RLS. See 001_schemas.sql: is_sop_editor() reads auth.jwt(), which is empty
-- under this architecture. The editors table below is still the source of truth
-- for who may write — resolveRoles() reads it at sign-in — it just is not a
-- policy any more. Do not add policies back.

-- ---------------------------------------------------------------- identity --

create table if not exists sop.sop_editors (
  email      text primary key,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------- content --

-- The whole SOP tree — { meta, scenarios, reports } — as ONE row.
--
-- Deliberately not normalised into modules and steps. The client reads and
-- writes the tree as a whole and renumbers it on every save, so splitting it
-- would mean rebuilding that logic for no gain until something actually queries
-- by step. The single-row shape is enforced by `check (id = 1)`.
--
-- In Apps Script this lived in ScriptProperties, split across several keys
-- because one property has a size limit. Postgres has no such limit, so the
-- chunking disappears here.
create table if not exists sop.sop_document (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Replaces the timestamped JSON snapshots the app wrote to Drive on every save.
create table if not exists sop.sop_versions (
  id       bigint generated always as identity primary key,
  data     jsonb not null,
  taken_at timestamptz not null default now(),
  taken_by text,
  note     text
);

create index if not exists sop_versions_taken_idx on sop.sop_versions(taken_at desc);

-- Snapshot the previous document before every overwrite.
--
-- This is a trigger rather than an API call for a reason worth keeping: version
-- history that depends on each route remembering to snapshot is history with
-- holes in it, and the hole appears exactly on the code path somebody added in a
-- hurry. Here a restore is itself undoable — writing an old document back is an
-- ordinary update, so the current one is snapshotted first and nothing is lost.
create or replace function sop.snapshot_before_update()
returns trigger language plpgsql as $$
begin
  insert into sop.sop_versions (data, taken_by, note)
  values (old.data, old.updated_by, 'auto-snapshot before update');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sop_snapshot on sop.sop_document;
create trigger sop_snapshot before update on sop.sop_document
  for each row execute function sop.snapshot_before_update();

-- ------------------------------------------------------------------ seeding --
--
-- The document row is NOT seeded with an empty tree here. Every mutation route
-- returns 409 NOT_SEEDED when the row is missing, which is a clear signal that
-- content still has to be loaded; an empty `{}` row would instead let editors
-- start authoring into a document that the real import then overwrites.
--
-- To seed it, from the live app's own export:
--   open <exec-url>?diag=sopdata, copy the JSON, then
--   insert into sop.sop_document (id, data) values (1, '<json>'::jsonb);
--
-- NOTE ON THE GOOGLE DOC (SOP_DOC_ID). It was a LIVE ONE-WAY MIRROR: every save
-- in the Apps Script app wrote into it, but editing the Doc never flowed back.
-- After migration sop_document holds the content. Decide deliberately whether to
-- keep writing that mirror — if it silently stops it goes stale while still
-- looking authoritative, which is the worst of both.
