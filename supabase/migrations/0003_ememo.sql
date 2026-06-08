-- =============================================================================
-- Migration 0003: Module 1 — E-Memo & E-Signature
-- HR Operations, E-Approval & Onboarding System — วิจิตรภัณฑ์ก่อสร้าง
--
-- Builds the document register + auto running-number + letterhead config, and
-- lays the schema foundation for the real approval workflow (approve / reject /
-- return via a tokenised email link) and an audit trail. The approval UI ships
-- in a later phase, but the tables exist now so we don't migrate again.
--
-- Run with: node backend/scripts/db.mjs migrate
-- =============================================================================

-- -----------------------------------------------------------------------------
-- projects — โครงการ (the chips in the register: CVE, BV, PN4, V&K, EP, ...)
-- Each project owns its OWN running-number series (per requirement).
-- -----------------------------------------------------------------------------
create table if not exists projects (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,                 -- short chip code, e.g. 'BT1','CVE'
  name          text not null,                 -- full project name
  doc_prefix    text not null,                 -- prefix used in doc numbers, e.g. 'BT','Bv','CVE'
  color         text,                          -- chip color (hex) for the UI
  is_active     boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists projects_code_key on projects (lower(code));

-- -----------------------------------------------------------------------------
-- project_letterhead — per-project official-letter header config.
-- Used by the letterhead generator (later phase) to assemble the A4 letter.
-- One row per project (1:1).
-- -----------------------------------------------------------------------------
create table if not exists project_letterhead (
  project_id        uuid primary key references projects(id) on delete cascade,
  company_name      text,                      -- company / JV name on the letterhead
  address           text,
  logo_url          text,                      -- S3 URL of the logo
  signatory_name    text,                      -- default signer name
  signatory_title   text,                      -- default signer title
  closing_line      text,                      -- e.g. 'ขอแสดงความนับถือ'
  default_recipient text,                       -- default เรียน
  updated_at        timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- doc_code_departments — maps a document code to a department label.
-- 01→บริหาร, 02A/02B/02C→วิศวะ, 03→วิศวะ, 08→บุคคล, 09→บัญชี (default วิศวะ).
-- Editable so the client can extend the mapping without a code change.
-- -----------------------------------------------------------------------------
create table if not exists doc_code_departments (
  code        text primary key,                -- e.g. '02B'
  department  text not null                    -- e.g. 'วิศวะ'
);

-- -----------------------------------------------------------------------------
-- document_types — ประเภทเอกสาร (the "All document types" filter).
-- -----------------------------------------------------------------------------
create table if not exists document_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,            -- e.g. 'ขออนุมัติซื้อ', 'ขออนุมัติว่าจ้าง'
  sort_order  int not null default 0
);

-- -----------------------------------------------------------------------------
-- documents — the register itself. One row per memo/letter.
-- doc_number is assembled as <prefix>/<department>/<doc_code>/<run_no>.
-- run_no is unique PER PROJECT (each project its own series).
-- -----------------------------------------------------------------------------
create type doc_status as enum ('draft', 'pending', 'approved', 'rejected', 'returned', 'cancelled');
create type doc_source as enum ('manual', 'email');

create table if not exists documents (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete restrict,
  doc_code        text not null,               -- e.g. '02B'
  department      text not null,               -- derived from doc_code at creation
  run_no          int not null,                -- per-project sequential number
  doc_number      text not null,               -- full assembled number (denormalised)

  doc_type_id     uuid references document_types(id) on delete set null,
  subject         text not null,               -- เรื่อง / title shown in the list
  recipient       text,                        -- เรียน
  body            text,                        -- เนื้อความ (for letterhead generation)
  remarks         text,

  date_received   date not null default current_date,
  sender_email    text,                        -- for email-sourced docs
  source          doc_source not null default 'manual',
  status          doc_status not null default 'pending',

  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (project_id, run_no)
);

create index if not exists documents_project_idx  on documents(project_id);
create index if not exists documents_status_idx   on documents(status);
create index if not exists documents_date_idx     on documents(date_received desc);
create index if not exists documents_type_idx     on documents(doc_type_id);

-- -----------------------------------------------------------------------------
-- document_attachments — files attached to a document (stored in S3).
-- The generated letterhead PDF is also recorded here with kind='generated_pdf'.
-- -----------------------------------------------------------------------------
create type attachment_kind as enum ('upload', 'generated_pdf');

create table if not exists document_attachments (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references documents(id) on delete cascade,
  kind          attachment_kind not null default 'upload',
  file_name     text not null,
  content_type  text,
  size_bytes    bigint,
  storage_key   text not null,                 -- S3 object key
  uploaded_by   uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists attachments_document_idx on document_attachments(document_id);

-- -----------------------------------------------------------------------------
-- approval_steps — sequential approval chain for a document.
-- step_no defines order (1 = first approver). Each step gets a one-time token
-- so the approver can act directly from an email link without logging in.
-- -----------------------------------------------------------------------------
create type approval_action as enum ('pending', 'approved', 'rejected', 'returned');

create table if not exists approval_steps (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references documents(id) on delete cascade,
  step_no         int not null,                -- 1-based order in the chain
  approver_name   text,
  approver_email  text not null,               -- where the email link is sent
  approver_id     uuid references profiles(id) on delete set null, -- if they have an account
  action          approval_action not null default 'pending',
  comment         text,
  signature_url   text,                        -- e-signature image in S3
  action_token    text unique,                 -- one-time token for the email link
  token_expires_at timestamptz,
  acted_at        timestamptz,
  created_at      timestamptz not null default now(),
  unique (document_id, step_no)
);
create index if not exists approval_steps_document_idx on approval_steps(document_id);
create index if not exists approval_steps_token_idx    on approval_steps(action_token);

-- -----------------------------------------------------------------------------
-- audit_log — append-only trail of everything that happens to a document.
-- -----------------------------------------------------------------------------
create table if not exists audit_log (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid references documents(id) on delete cascade,
  actor_id      uuid references profiles(id) on delete set null,
  actor_label   text,                          -- name/email snapshot (survives deletes)
  action        text not null,                 -- 'created','submitted','approved','rejected',...
  detail        jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists audit_log_document_idx on audit_log(document_id);

-- -----------------------------------------------------------------------------
-- updated_at auto-touch for the new tables
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['projects','documents']
  loop
    execute format(
      'create trigger trg_%1$s_updated_at before update on %1$s
         for each row execute function set_updated_at();', t);
  end loop;
end $$;
