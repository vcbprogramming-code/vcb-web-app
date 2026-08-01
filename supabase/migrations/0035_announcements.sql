-- Portal announcements — short notices shown on the launcher dashboard, managed
-- by admins. Additive; no other table touched.
create table if not exists announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text,
  level       text not null default 'info',   -- info | warning | success
  is_active   boolean not null default true,
  pinned      boolean not null default false,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists announcements_feed_idx
  on announcements (is_active, pinned desc, created_at desc);
