-- =============================================================================
-- Migration 0026: bind each project to a fixed letterhead company (client #4).
--
-- The client wants the letterhead (บริษัท/ตรา) to be FIXED per project: choosing
-- project A must always produce project A's header — the clerk can't switch it to
-- another company's letterhead. We store the bound company on project_letterhead
-- (the per-project config table). When creating a document the company is taken
-- from here and locked; the free "บริษัท/ตรา" picker no longer lets them override.
-- Null = fall back to the default company (backwards compatible).
-- =============================================================================

alter table project_letterhead
  add column if not exists company_id uuid references companies(id) on delete set null;
