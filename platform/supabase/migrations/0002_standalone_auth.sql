-- =============================================================================
-- Migration 0002: Switch from Supabase Auth to self-managed auth
-- HR Operations, E-Approval & Onboarding System — วิจิตรภัณฑ์ก่อสร้าง
--
-- The backend now connects to Postgres directly (no Supabase Auth / API keys).
-- Login is handled by the Express API: email + password (bcrypt) -> JWT.
--
-- Changes to `profiles`:
--   * drop the FK to auth.users(id) — that schema is no longer used
--   * id becomes a self-generated uuid (gen_random_uuid)
--   * add email (unique, login identity) + password_hash
--   * drop the auth.uid()-based RLS helpers/policies — the API is the only
--     writer/reader and connects as the postgres role (RLS does not apply).
--
-- Run with: node backend/scripts/db.mjs migrate   (or paste into SQL editor)
-- =============================================================================

-- 1) Detach profiles from Supabase auth and make it self-sufficient ----------
alter table profiles drop constraint if exists profiles_id_fkey;
alter table profiles alter column id set default gen_random_uuid();

alter table profiles add column if not exists email text;
alter table profiles add column if not exists password_hash text;

-- email is the login identity — unique, case-insensitive
create unique index if not exists profiles_email_key on profiles (lower(email));

-- 2) Remove RLS + auth.uid()-based helpers (no longer reachable) -------------
--    The direct Postgres connection runs as a superuser-ish role; RLS would
--    only matter for anon/authenticated API clients, which we no longer use.
drop policy if exists "read units" on units;
drop policy if exists "read departments" on departments;
drop policy if exists "read positions" on positions;
drop policy if exists "read employees" on employees;
drop policy if exists "read own profile" on profiles;

alter table units       disable row level security;
alter table departments disable row level security;
alter table positions   disable row level security;
alter table employees   disable row level security;
alter table profiles    disable row level security;

drop function if exists current_role_name();
drop function if exists current_unit_id();
