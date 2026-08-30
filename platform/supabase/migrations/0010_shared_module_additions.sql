-- =============================================================================
-- Migration 0010: Shared columns/tables introduced during the MongoDB era,
-- brought back into Postgres ahead of Modules 2-4.
-- =============================================================================

-- Employee gained a kind (operation/support) + free-text team for the daily log
create type employee_kind as enum ('operation', 'support');
alter table employees add column if not exists kind employee_kind not null default 'operation';
alter table employees add column if not exists team text;
create index if not exists employees_kind_idx on employees(kind);

-- Units gained company / accent color / backdate-lock window (Module 2 sites)
alter table units add column if not exists company text;
alter table units add column if not exists color text;
alter table units add column if not exists lock_days int not null default 3;

-- An HR user may cover several units. Keep profiles.unit_id as the primary,
-- and add a join table for the full in-scope set (empty = all, for admin/exec).
create table if not exists profile_units (
  profile_id  uuid not null references profiles(id) on delete cascade,
  unit_id     uuid not null references units(id) on delete cascade,
  primary key (profile_id, unit_id)
);

-- Profile gained a stored signature image key (S3)
alter table profiles add column if not exists signature_url text;

-- doc_code_departments gained a recipient title (added by 0008 already, guard here)
alter table doc_code_departments add column if not exists recipient_title text;

-- Documents gained work_unit + enclosures (jsonb) during the Mongo era
alter table documents add column if not exists work_unit text;
alter table documents add column if not exists enclosures jsonb not null default '[]'::jsonb;

-- approval_steps gained nothing new; document_attachments gained a version tag
-- (original vs approved PDF) — add if missing.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'attachment_version') then
    create type attachment_version as enum ('original', 'approved');
  end if;
end $$;
alter table document_attachments add column if not exists version attachment_version;

-- project_letterhead gained extra fields during the Mongo era
alter table project_letterhead add column if not exists company_name_en text;
alter table project_letterhead add column if not exists phone text;
alter table project_letterhead add column if not exists telex text;
alter table project_letterhead add column if not exists fax text;
alter table project_letterhead add column if not exists signature_url text;
