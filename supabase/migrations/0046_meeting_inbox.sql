-- กล่องรอจัดเก็บ — where a recording lands before anyone decides what it is about.
--
-- A recording arrives without knowing which project it belongs to. It goes into
-- an inbox, someone listens, and files it against one or more groups. Filing
-- does NOT move it: the inbox stays its home so the archive of "everything ever
-- recorded" is never broken up, and a recording that turns out to concern two
-- projects can be filed against both. That is the reference implementation's
-- rule and it is the right one — moving the row would make the second project
-- steal it from the first.

alter table mtg_groups
  add column if not exists is_inbox boolean not null default false;

-- The link back to the recording itself, wherever it is hosted.
alter table mtg_meetings
  add column if not exists recording_url text not null default '';

-- Where a recording has been filed. The meeting's own group_id stays the inbox;
-- these are additional appearances.
create table if not exists mtg_meeting_tags (
  meeting_id uuid not null references mtg_meetings(id) on delete cascade,
  group_id   uuid not null references mtg_groups(id) on delete cascade,
  tagged_by  uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (meeting_id, group_id)
);
create index if not exists mtg_meeting_tags_group_idx on mtg_meeting_tags (group_id);

-- Two inboxes, mirroring the two services the client's own setup records with.
-- They exist now so recordings can be filed by hand from day one; connecting the
-- services later fills the same boxes without moving anything.
insert into mtg_groups (code, name, name_en, cadence, color, is_inbox, sort_order)
values
  ('INBOX_FATHOM', 'กล่องรอจัดเก็บ · Fathom', 'Fathom Inbox', 'ตามที่บันทึก', '#8b949e', true, 900),
  ('INBOX_TRANSKRIPTOR', 'กล่องรอจัดเก็บ · Transkriptor', 'Transkriptor Inbox', 'ตามที่บันทึก', '#8b949e', true, 901)
on conflict (code) do nothing;
