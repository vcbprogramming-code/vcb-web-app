-- 005 — minutes: projects, meetings, versions, audit, ingest log.
--
-- ACCESS CONTROL LIVES IN THE API: api/src/routes/minutes.js. Read routes use
-- allowAnonymous and filter by tier in SQL (the app was deployed
-- ANYONE_ANONYMOUS, so a visitor with no session is an expected caller and a 401
-- would be a regression); write routes use requireRole('minutes', …).
--
-- The three tiers, reproduced there rather than here:
--   public  — readable by anyone, no sign-in       (the app's 🔓)
--   locked  — admins, editors, and minutes.project_guests  (🔒)
--   guest   — a locked project's named viewer: read-only, that project only
--
-- No RLS. See 001_schemas.sql: can_read_project() / is_editor() / is_admin() all
-- read auth.jwt(), which is empty now that Express is the only client, so they
-- would evaluate identically for a visitor, a guest and an admin. Do not add
-- them back.

-- ---------------------------------------------------------------- identity --

-- Replaces ADMIN_EMAILS in Config.js.
create table if not exists minutes.admins (
  email      text primary key,
  created_at timestamptz not null default now()
);

-- Replaces the self-service EDITOR_EMAILS list managed from Settings.
-- resolveRoles() collapses admin and editor into one role, since an admin is an
-- editor everywhere it matters.
create table if not exists minutes.editors (
  email      text primary key,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- projects --

create table if not exists minutes.projects (
  id         text primary key,          -- FIN / BD / BT12 / … ; slugified initials
  name       text not null,
  name_en    text,
  cadence    text,
  color      text,
  sort_order int,
  -- HISTORICAL ONLY. Google Docs stopped being the source of truth on
  -- 2026-07-19. Kept so pre-2026-07-19 rows keep their provenance; never used to
  -- re-import, which would overwrite real in-app edits with stale Doc content.
  -- Exposed to admins only.
  doc_id     text,
  -- The original five, protected from deletion: they carry the Doc-era history,
  -- and removing one would cascade away its guest list.
  builtin    boolean not null default false,
  visibility text not null default 'locked' check (visibility in ('public','locked')),
  created_at timestamptz not null default now()
);

-- The "all @vcb-con.com staff" opt-in.
--
-- This existed in the React types and the mock (ProjectAccess.domain) with no
-- column behind it, so an admin could turn it on and the setting evaporated on
-- reload. It is a THIRD, independent axis — not a synonym for visibility:
--   visibility='public' means anyone with the link, no sign-in, any domain
--   domain=true        means every signed-in @vcb-con.com address, and nobody else
-- A locked project with domain=true is readable company-wide but not publicly;
-- a public project says nothing about whether staff are allow-listed on it.
-- That is why the mock explicitly refuses to default one from the other.
alter table minutes.projects add column if not exists domain boolean not null default false;

comment on column minutes.projects.domain is
  'Opt-in: every signed-in @vcb-con.com address may read this project. '
  'Independent of visibility — do not derive one from the other.';

-- The emails named on a locked project.
create table if not exists minutes.project_guests (
  project_id text not null references minutes.projects(id) on delete cascade,
  email      text not null,
  primary key (project_id, email)
);

create index if not exists project_guests_email_idx on minutes.project_guests(lower(email));

-- ----------------------------------------------------------------- minutes --

create table if not exists minutes.minutes (
  id           text primary key,
  project_id   text not null references minutes.projects(id),
  meeting_key  text not null,           -- stable key within a project
  meeting_date date,                    -- ISO when the label could be parsed
  date_label   text,                    -- the label as originally written
  time         text,
  title        text,
  kind         text check (kind in ('overview','meeting')),
  excerpt      text,
  fathom_url   text,
  attendees    jsonb not null default '[]'::jsonb,
  -- HISTORICAL: the Docs tab a row was imported from. Dead since 2026-07-19
  -- along with projects.doc_id; kept only so old rows stay traceable.
  tab_id       text,
  -- 'doc-import' IS PERMANENT AND THE LIST DOES NOT GAIN 'doc-edited'.
  --
  -- This was decided deliberately, so do not "fix" it: `source` records where a
  -- meeting CAME FROM, not what has happened to it since. Editing an imported
  -- minute is a tidy-up of an existing record, not the creation of a new one, and
  -- knowing that a row's text originally came out of a Google Doc stays useful
  -- long after somebody corrected a typo in it. A 'doc-edited' value would
  -- destroy that: the moment anyone touched a row you could no longer tell an
  -- imported meeting from one authored in the app.
  --
  -- The save routes enforce it in SQL as well —
  --   source = case when source = 'doc-import' then 'doc-import' else $n end
  -- — so an imported row keeps the value even if a client sends something else.
  -- Nothing may ever set source TO 'doc-import' either; the import path is
  -- permanently disabled and re-importing would overwrite real in-app edits.
  source       text check (source in ('doc-import','manual','fathom','transkriptor')),
  visible      boolean not null default false,
  pinned       boolean not null default false,
  -- An inbox recording never leaves its inbox: project_id is permanent and
  -- filing it elsewhere only appends here. Was a comma-separated string.
  tagged_project_ids text[] not null default '{}',
  attachments  jsonb not null default '[]'::jsonb,
  comments     jsonb not null default '[]'::jsonb,
  -- The full meeting body. In the sheet this lived outside the row; as a column
  -- it removes the separate content store entirely.
  content_html text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (project_id, meeting_key)
);

create index if not exists minutes_project_idx on minutes.minutes(project_id);
create index if not exists minutes_date_idx    on minutes.minutes(meeting_date desc);
create index if not exists minutes_tagged_idx  on minutes.minutes using gin (tagged_project_ids);

-- Pre-edit snapshots. Append-only, written by the save routes inside the same
-- transaction as the edit.
--
-- The snapshot holds title, dateLabel and time as well as html: versioning only
-- the body made "View Original" show the row's CURRENT title after a rename
-- (confirmed 2026-07-22). Snapshots taken before that fix hold html alone, and
-- the API's documented contract is to return '' for the missing fields.
create table if not exists minutes.versions (
  id        bigint generated always as identity primary key,
  minute_id text not null references minutes.minutes(id) on delete cascade,
  snapshot  jsonb not null,
  taken_at  timestamptz not null default now(),
  taken_by  text
);

create index if not exists versions_minute_idx on minutes.versions(minute_id, taken_at desc);

-- Append-only record of every content-changing mutation.
create table if not exists minutes.audit_log (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  actor     text,
  action    text,
  target    text,
  target_id text,
  changes   jsonb,
  note      text
);

create index if not exists minutes_audit_at_idx     on minutes.audit_log(at desc);
create index if not exists minutes_audit_target_idx on minutes.audit_log(target_id, at desc);

-- Raw webhook payloads, kept for replay and diagnosis. Written by the
-- server-side ingest only — there is no write endpoint.
create table if not exists minutes.fathom_raw_log (
  id           bigint generated always as identity primary key,
  received_at  timestamptz not null default now(),
  payload      jsonb not null,
  recording_id text
);

create index if not exists fathom_raw_recording_idx on minutes.fathom_raw_log(recording_id);
create index if not exists fathom_raw_received_idx  on minutes.fathom_raw_log(received_at desc);

-- ------------------------------------------------------------------ seeding --

-- THE TWO INBOXES ARE FOREIGN KEY TARGETS, NOT DECORATION.
--
-- Every incoming Fathom or Transkriptor recording lands as a row whose
-- project_id is one of these two ids. Without the rows, minutes.minutes'
-- foreign key rejects the insert and ingestion fails — on a webhook, where
-- there is nobody watching and the recording is simply lost.
--
-- They are locked (a recording is not public until someone files it) and
-- builtin (the API refuses to delete a builtin project, which is what stops an
-- admin removing an inbox and breaking ingest). The tag routes also refuse to
-- tag INTO them by id, so an inbox stays an arrival point and never becomes a
-- destination.
insert into minutes.projects (id, name, name_en, cadence, color, sort_order, builtin, visibility, domain) values
  ('FATHOM_INBOX',      'กล่องขาเข้า Fathom',      'Fathom Inbox',      '', '#6639ba', 900, true, 'locked', false),
  ('TRANSKRIPTOR_INBOX','กล่องขาเข้า Transkriptor','Transkriptor Inbox','', '#0b3d62', 901, true, 'locked', false)
on conflict (id) do update set
  builtin = true,          -- re-assert: an inbox must stay undeletable
  name    = excluded.name,
  name_en = excluded.name_en;
  -- visibility and domain are NOT re-asserted: an admin may legitimately have
  -- opened an inbox to the domain, and a re-run must not quietly undo that.
