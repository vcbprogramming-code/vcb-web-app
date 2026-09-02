-- 008 — one place to administer who may use which app.
--
-- WHY THIS EXISTS
--
-- Access currently lives in six tables with six different shapes: hr.users has
-- a role column, credit.managers is membership-only (being in it means
-- 'manager'), minutes has separate admins and editors tables, sop has
-- sop_editors, portal has portal_admins. api/src/auth.js resolveRoles() runs
-- six queries and normalises the results into one { hr: 'admin', credit:
-- 'manager', … } object.
--
-- That works for READING a person's roles. It is useless for ADMINISTERING
-- them: there is no single table an admin screen can list, no vocabulary of
-- what roles a given app even has, and adding an app means writing another
-- bespoke table and another branch in resolveRoles().
--
-- This migration adds the missing half. It does not change how anything is
-- enforced today — the existing tables stay, and resolveRoles() keeps reading
-- them — so nothing breaks while the admin UI is being built.
--
-- WHAT IT DOES NOT DO
--
-- It does not gate anything. No route starts refusing anyone because of this
-- migration. Enforcement is deliberately left to a later, separate change so
-- that the structure can land, be inspected, and be populated before it has
-- any power to lock someone out of their own portal.

-- --------------------------------------------------------------- roles ----

-- The vocabulary: which roles exist, per app, and what each one means.
--
-- Seeded from what the routes ALREADY check, so this table is a description of
-- the running system rather than an aspiration. api/src/routes/*.js is the
-- source of truth for these names; adding a row here does not create a role,
-- it documents one the code already understands.
create table if not exists portal.app_roles (
  app_key     text not null references portal.apps(key) on delete cascade,
  role        text not null,
  label       text not null,          -- English, for the admin screen
  label_th    text,                   -- Thai, same
  description text,                   -- what this role may actually do
  rank        int  not null default 0,-- higher = more powerful; for sorting
  primary key (app_key, role)
);

comment on table portal.app_roles is
  'The role vocabulary each app understands. Descriptive: the authoritative '
  'list is the requireRole() calls in api/src/routes/. Adding a row here does '
  'not grant anything.';

-- ------------------------------------------------------------- grants ----

-- Who has which role in which app. One row per person per app.
--
-- A person with no row for an app has no role there, which is the same thing
-- resolveRoles() reports today by returning null. The unique constraint is the
-- primary key: one role per person per app, matching the shape of the JWT
-- (roles = { hr: 'admin' }, not { hr: ['admin','staff'] }). If an app ever
-- needs multiple simultaneous roles, that is a schema change AND a token
-- change, and doing it accidentally by inserting a second row would silently
-- give whichever row sorted first.
create table if not exists portal.access_grants (
  email      text not null,
  app_key    text not null references portal.apps(key) on delete cascade,
  role       text not null,
  granted_by text,                    -- who clicked the button
  granted_at timestamptz not null default now(),
  note       text,                    -- "covering for X until March"
  primary key (email, app_key),
  foreign key (app_key, role) references portal.app_roles(app_key, role)
);

-- Lower-cased lookups: every email comparison in this codebase is
-- lower(email), because Google hands back mixed case and people type it
-- however they like.
create index if not exists access_grants_email_idx on portal.access_grants(lower(email));
create index if not exists access_grants_app_idx   on portal.access_grants(app_key, role);

comment on table portal.access_grants is
  'Who may use which app, in one place. NOT yet enforced: resolveRoles() still '
  'reads the per-module tables. Populate and verify this first, then switch '
  'resolveRoles() over in a separate change.';

-- --------------------------------------------------------------- audit ----

-- Every change to a grant, kept forever.
--
-- Separate from hr.audit_log deliberately: that one records edits to work
-- entries and is scoped to HR. This records who gave whom access to what,
-- which is the question asked after an incident, and it must survive the grant
-- row being deleted — hence no foreign key back to access_grants.
create table if not exists portal.access_audit (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor      text,                    -- who made the change
  email      text not null,           -- who it was about
  app_key    text not null,
  old_role   text,                    -- null = access granted
  new_role   text,                    -- null = access revoked
  note       text
);

create index if not exists access_audit_email_idx on portal.access_audit(lower(email), at desc);
create index if not exists access_audit_at_idx    on portal.access_audit(at desc);

-- Record grant changes automatically. A trigger rather than API code because
-- the one-off scripts and a psql session must be audited too — the value of
-- this log is that it has no gaps.
create or replace function portal.log_access_change() returns trigger
language plpgsql as $$
begin
  insert into portal.access_audit (actor, email, app_key, old_role, new_role, note)
  values (
    -- set by api/src/db.js tx(); null from a direct psql session, which is
    -- itself worth seeing in the log.
    nullif(current_setting('app.actor_email', true), ''),
    coalesce(new.email, old.email),
    coalesce(new.app_key, old.app_key),
    old.role,
    new.role,
    coalesce(new.note, old.note)
  );
  return coalesce(new, old);
end $$;

drop trigger if exists access_grants_audit on portal.access_grants;
create trigger access_grants_audit
  after insert or update or delete on portal.access_grants
  for each row execute function portal.log_access_change();

-- ---------------------------------------------------- the role vocabulary --

-- Seeded from the requireRole() calls that exist today. rank orders them in the
-- admin screen and makes "at least this powerful" expressible later without
-- hard-coding a list of names in the UI.
insert into portal.app_roles (app_key, role, label, label_th, description, rank) values
  ('hr',     'staff',   'Staff',        'พนักงาน',        'Log own work; request leave.',                        10),
  ('hr',     'manager', 'Manager',      'ผู้จัดการ',        'Everything staff can do, plus approve leave for own sites.', 20),
  ('hr',     'admin',   'Administrator','ผู้ดูแลระบบ',      'All sites, the roster, the work index, and the edit window.', 30),

  ('credit', 'viewer',  'Viewer',       'ผู้ดูข้อมูล',       'Read facilities, ledger and cash plan. No changes.',  10),
  ('credit', 'manager', 'Manager',      'ผู้จัดการ',        'Record usage, decide requests, edit limits.',          20),

  ('minutes','editor',  'Editor',       'ผู้แก้ไข',         'Write and edit minutes in permitted projects.',        20),
  ('minutes','admin',   'Administrator','ผู้ดูแลระบบ',      'All projects, project access, and deletion.',          30),

  ('sop',    'editor',  'Editor',       'ผู้แก้ไข',         'Edit scenarios, reports and version history.',         20),

  ('portal', 'admin',   'Administrator','ผู้ดูแลระบบ',      'Announcements, the app list, and everyone access.',    30)
on conflict (app_key, role) do nothing;

-- ememo, sysmap and onboarding are intentionally absent: they have no roles
-- today. An app with no rows here simply shows nothing to assign in the admin
-- screen, which is the correct rendering of "everyone who can sign in may use
-- it".
