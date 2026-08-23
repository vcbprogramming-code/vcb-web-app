-- รายงานการประชุม — minutes kept per project, with every version behind them.
--
-- All new (mtg_*). Nothing existing is touched, so E-Memo cannot be affected.
--
-- Groups are seeded from the projects we already have, because the reference
-- implementation's own "projects" turned out to be the same construction
-- projects E-Memo uses. They live in their own table rather than pointing at
-- projects directly: minutes are also kept for things that are not a
-- construction project at all — a department, a board — and those need
-- somewhere to live too.

create table if not exists mtg_groups (
  id          uuid primary key default gen_random_uuid(),
  code        text unique,
  name        text not null,
  name_en     text not null default '',
  cadence     text not null default '',    -- "ทุกสัปดาห์", "ตามวาระ"
  color       text not null default '#64748b',
  -- set when this group mirrors a construction project, so per-user project
  -- visibility can be applied without a second list to maintain
  project_id  uuid references projects(id) on delete set null,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists mtg_groups_project_idx on mtg_groups (project_id);

create table if not exists mtg_meetings (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references mtg_groups(id) on delete cascade,
  title       text not null,
  meeting_date date,
  time_label  text not null default '',
  -- the body, as sanitised HTML. Stored rendered rather than as markup the
  -- client has to interpret: what the author saw is what everyone else sees.
  content     text not null default '',
  -- first 200 characters of the text, for the list. Derived on write so the
  -- list query never has to strip tags across every row.
  excerpt     text not null default '',
  attendees   jsonb not null default '[]'::jsonb,
  pinned      boolean not null default false,
  -- hidden minutes are drafts: the author can see them, nobody else can
  visible     boolean not null default true,
  source      text not null default 'manual',   -- manual | doc-import | fathom | transkriptor
  created_by  uuid references profiles(id) on delete set null,
  updated_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists mtg_meetings_group_idx on mtg_meetings (group_id, meeting_date desc nulls last);
create index if not exists mtg_meetings_pinned_idx on mtg_meetings (pinned) where pinned;

-- Every edit keeps what was there before.
--
-- title/time/date are stored WITH the snapshot, not read back off the live row.
-- The reference implementation shipped without them and hit a real bug: rename
-- a meeting and its own "original" preview showed the new name, as though it had
-- always been called that.
create table if not exists mtg_versions (
  id          bigserial primary key,
  meeting_id  uuid not null references mtg_meetings(id) on delete cascade,
  seq         int not null,
  content     text not null default '',
  title       text not null default '',
  meeting_date date,
  time_label  text not null default '',
  saved_by    uuid references profiles(id) on delete set null,
  saved_at    timestamptz not null default now()
);
create unique index if not exists mtg_versions_seq_idx on mtg_versions (meeting_id, seq);

create table if not exists mtg_attachments (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid not null references mtg_meetings(id) on delete cascade,
  -- 'file' hangs off the minutes; 'inline' is an image placed in the body, kept
  -- here too so deleting the meeting takes its pictures out of storage with it
  kind        text not null default 'file',
  file_name   text not null,
  content_type text not null default '',
  size_bytes  bigint not null default 0,
  storage_key text not null,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists mtg_attachments_meeting_idx on mtg_attachments (meeting_id, created_at);

create table if not exists mtg_comments (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid not null references mtg_meetings(id) on delete cascade,
  author_id   uuid references profiles(id) on delete set null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists mtg_comments_meeting_idx on mtg_comments (meeting_id, created_at);

-- Seed one group per active project, so the module is usable the moment it is
-- switched on rather than presenting an empty list nobody knows how to fill.
insert into mtg_groups (code, name, name_en, color, project_id, sort_order)
select p.code, p.name, coalesce(p.name, ''), coalesce(p.color, '#64748b'), p.id,
       row_number() over (order by p.code)
  from projects p
 where p.is_active = true
   and not exists (select 1 from mtg_groups g where g.project_id = p.id)
on conflict (code) do nothing;
