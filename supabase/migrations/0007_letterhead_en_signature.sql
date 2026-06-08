-- =============================================================================
-- Migration 0007: more letterhead fields to match the client's real letter
--   company_name_en — English company name line (Vichitbhan Construction Co.,Ltd.)
--   signature_url   — S3 key of the signatory's signature image
-- =============================================================================

alter table project_letterhead add column if not exists company_name_en text;
alter table project_letterhead add column if not exists signature_url text;
