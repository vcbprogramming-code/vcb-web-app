-- 001 — the six module schemas, and the session variables the API sets.
--
-- WHERE ACCESS CONTROL LIVES: api/src/middleware/auth.js, plus the role guard on
-- each route. NOT here.
--
-- Row Level Security is deliberately absent from every migration in this
-- directory, and the 45 policies the per-module schema.sql files carried were
-- dropped rather than ported. RLS worked when the browser held a Supabase anon
-- key and talked to Postgres directly: auth.jwt() ->> 'email' named the actual
-- caller, so a policy could tell one from another. The browser no longer does
-- that. Express is the only client, it connects as ONE database user, and every
-- request therefore looks identical to Postgres. A policy written against
-- auth.jwt() in this architecture does not restrict anyone — it returns null for
-- every caller and either locks everybody out or lets everybody through. That is
-- worse than no policy, because it reads like protection.
--
-- Do not "restore" RLS here without first moving the API off its single
-- connection identity. Until then the honest place for the rules is the API, and
-- splitting them across two layers means the SQL half silently rots.
--
-- WHY SEPARATE SCHEMAS, not one `public`:
-- hr.employees and onboarding.employees are different tables — different primary
-- key (eid vs. name), different lifecycle, different meaning. In one `public`
-- schema one of them has to be renamed, and every unqualified `employees` in the
-- codebase becomes a coin flip. Six schemas makes the collision impossible and
-- makes an unqualified reference an error instead of a silent wrong answer.

create schema if not exists portal;
create schema if not exists credit;
create schema if not exists hr;
create schema if not exists minutes;
create schema if not exists sop;
create schema if not exists onboarding;

comment on schema portal     is 'Front-door launcher: app tiles and the announcement banner.';
comment on schema credit     is 'Credit Facility: facilities, transactions, requests, limits, cash plan.';
comment on schema hr         is 'HR Work Log: roster, daily work entries, leave, audit.';
comment on schema minutes    is 'Meeting Minutes: projects, meetings, versions, ingest logs.';
comment on schema sop        is 'VCB-MANGO ERP SOP: one JSON document plus its version history.';
comment on schema onboarding is 'Onboarding Portal: new-hire checklist progress.';

-- ------------------------------------------------------- the actor contract --
--
-- The HR triggers (004) need to know WHO is writing and WITH WHAT ROLE. They
-- used to ask auth.jwt(), which no longer carries anything. The API supplies it
-- instead, per transaction:
--
--   set local app.actor_email = 'someone@vcb-con.com';
--   set local app.actor_role  = 'admin';
--
-- `set local` scopes the value to the surrounding transaction, so it cannot leak
-- into the next request that borrows the same pooled connection. That property
-- is the whole reason for `local` — a plain `set` on a pooled connection would
-- hand one user's identity to the next.
--
-- These helpers read those settings with the missing_ok flag, so a statement run
-- outside the API (a psql session, a migration) does not error; it simply has no
-- actor. What it gets instead is '' and 'none', which fail closed everywhere
-- they are used.

create or replace function hr.actor_email()
returns text language sql stable as $$
  select lower(coalesce(nullif(current_setting('app.actor_email', true), ''), ''));
$$;

create or replace function hr.actor_role()
returns text language sql stable as $$
  select coalesce(nullif(current_setting('app.actor_role', true), ''), 'none');
$$;

comment on function hr.actor_email() is
  'The email the API set with `set local app.actor_email`; '''' when unset.';
comment on function hr.actor_role() is
  'The role the API set with `set local app.actor_role`; ''none'' when unset, which fails closed.';
