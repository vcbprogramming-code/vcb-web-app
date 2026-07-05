-- =============================================================================
-- Migration 0024: per-user document visibility scopes (client request #8).
--
-- Lets an admin restrict which documents a user can SEE, by project and/or by
-- doc code (document type, e.g. "08"). Rules:
--   * A user with NO visibility rows sees ALL documents (backwards compatible —
--     current behaviour is unchanged for every existing account).
--   * Once a user has any rows, they see only documents whose project_id is in
--     their allowed projects (if any project rows exist) AND whose doc_code is
--     in their allowed codes (if any code rows exist). The two dimensions are
--     independent: only project rows → filter by project only; only code rows →
--     filter by code only; both → must match both.
--   * admins always see everything (enforced in code, not here).
-- =============================================================================

create table if not exists document_visibility (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  scope_type  text not null check (scope_type in ('project', 'doc_code')),
  scope_value text not null,          -- a projects.id (project) or a doc code string
  created_at  timestamptz not null default now(),
  unique (profile_id, scope_type, scope_value)
);

create index if not exists document_visibility_profile_idx
  on document_visibility(profile_id);
