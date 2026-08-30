-- =============================================================================
-- Migration 0023: companies (บริษัท / ตรา) — selectable letterhead identity.
--
-- Instead of the letterhead company being tied to the project, the user can pick
-- a company when creating a document. Each company carries its own name (TH/EN),
-- logo, address and contact block. One is the default (the main company).
-- documents.company_id records which company's letterhead a memo uses.
-- =============================================================================

create table if not exists companies (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,               -- ชื่อบริษัท (ไทย)
  name_en        text,                        -- ชื่อบริษัท (อังกฤษ)
  address        text,
  phone          text,
  telex          text,
  fax            text,
  logo_url       text,                        -- S3 key of the logo image
  is_default     boolean not null default false,
  is_active      boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);

-- only one default at a time
create unique index if not exists uq_companies_one_default
  on companies (is_default) where is_default = true;

-- which company's letterhead a document uses (null = fall back to the default)
alter table documents
  add column if not exists company_id uuid references companies(id) on delete set null;

-- seed the current main company (Vichitbhan) as the default, from any existing
-- project_letterhead that has the main name, else a plain default row.
insert into companies (name, name_en, is_default, sort_order)
select 'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด', 'Vichitbhan Construction Co., Ltd.', true, 0
where not exists (select 1 from companies where is_default = true);
