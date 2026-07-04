-- =============================================================================
-- Migration 0020: per-user login method (client request 2026-07-04).
--
-- Each account is either a 'google' account (must Sign in with Google — the bare
-- email login is refused) or an 'email' account (email/passwordless login — the
-- Google button is refused). Cross-type login is blocked at both endpoints.
--
-- Backfill existing rows: @gmail.com addresses default to 'google' (they came in
-- via Google sign-in), everyone else to 'email'. Column is text (not enum) to
-- stay migration-friendly, with a check constraint for safety.
-- =============================================================================

alter table profiles
  add column if not exists login_method text not null default 'email';

update profiles
   set login_method = case
         when lower(email) like '%@gmail.com' then 'google'
         else 'email'
       end;

alter table profiles
  drop constraint if exists profiles_login_method_chk;
alter table profiles
  add constraint profiles_login_method_chk check (login_method in ('email', 'google'));
