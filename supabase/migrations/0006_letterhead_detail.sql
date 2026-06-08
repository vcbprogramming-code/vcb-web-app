-- =============================================================================
-- Migration 0006: Extra fields to match the client's real letterhead layout
--   documents.work_unit  — ชื่อหน่วยงาน (e.g. "บางเตย") shown under the header
--   documents.enclosures — สิ่งที่ส่งมาด้วย: list of { name, qty, unit }
--   project_letterhead.phone / telex / fax — the contact block (top-right)
-- =============================================================================

alter table documents add column if not exists work_unit text;
alter table documents add column if not exists enclosures jsonb not null default '[]'::jsonb;

alter table project_letterhead add column if not exists phone text;
alter table project_letterhead add column if not exists telex text;
alter table project_letterhead add column if not exists fax text;
