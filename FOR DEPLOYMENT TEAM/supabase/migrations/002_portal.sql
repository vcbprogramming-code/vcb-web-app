-- 002 — portal: the app-tile list, the announcement banner, and the admin list.
--
-- ACCESS CONTROL LIVES IN THE API: api/src/routes/portal.js reads with
-- allowAnonymous (the front door renders for a visitor with no session) and
-- writes behind requireAuth + requireRole('portal','admin').
--
-- No RLS here. See 001_schemas.sql for why: the API connects as one database
-- user, so a policy cannot tell one caller from another and only pretends to.
-- Do not add policies back.

-- ---------------------------------------------------------------- identity --

-- Replaces the ADMIN_PASSWORD_HASH ScriptProperty the Apps Script version used.
-- A shared password could not survive the move to a SPA — the hash and the
-- comparison would both ship in the browser bundle — so the gate became a named
-- list plus a real token. resolveRoles() in api/src/auth.js reads this table at
-- sign-in and bakes portal:'admin' into the JWT.
create table if not exists portal.portal_admins (
  email      text primary key,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------- app tiles --

-- Replaces the hardcoded APPS array. A tile is a row so that a moved launch URL
-- is an update, not a code change plus redeploy — the stale Credit Facility URL
-- fixed by hand on 2026-08-30 is exactly the failure this removes.
create table if not exists portal.apps (
  key            text primary key,      -- 'ememo', 'credit', 'sop', … ; the client
                                        -- keys its icon and i18n tables off this,
                                        -- which is why the API refuses to patch it
  name           text not null,
  name_th        text,
  description    text,
  description_th text,
  url            text not null,
  icon           text,
  accent         text,
  sort_order     int not null default 0,
  enabled        boolean not null default true
);

create index if not exists apps_order_idx on portal.apps(sort_order, name);

-- ---------------------------------------------------------- announcement --

-- One row, forever: `check (id = 1)` is what makes "the banner" a thing rather
-- than a list the UI has to choose from.
create table if not exists portal.announcement (
  id         int primary key default 1 check (id = 1),
  title      text,
  body       text,
  show       boolean not null default false,
  -- The client dismisses the banner per-device by this number. It must change
  -- on every save or a re-worded banner stays dismissed for everyone who had
  -- already dismissed the old one. The Apps Script version minted a fresh uuid
  -- for the same reason.
  revision   bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text
);

create or replace function portal.announcement_bump_revision()
returns trigger language plpgsql as $$
begin
  new.revision   := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists announcement_bump on portal.announcement;
create trigger announcement_bump before update on portal.announcement
  for each row execute function portal.announcement_bump_revision();

-- The row must exist before the first save: the API upserts on id = 1, and
-- DELETE /announcement blanks the text rather than removing the row, precisely
-- so revision never restarts and re-shows an old banner.
insert into portal.announcement (id, title, body, show)
values (1, '', '', false)
on conflict (id) do nothing;
