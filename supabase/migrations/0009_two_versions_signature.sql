-- =============================================================================
-- Migration 0009: Two document versions (original / approved) + approver signatures
--
-- Each document can have:
--   * an ORIGINAL — either an uploaded PDF or one generated from the letterhead
--   * an APPROVED — generated after the chain completes, with signature images
--                   of every approver stamped onto it
--
-- We avoid touching the attachment_kind enum (ALTER TYPE ADD VALUE can't run
-- inside a transaction). Instead we tag attachments with a `version` column:
--   'original'  — the working document (uploaded or generated, pre-approval)
--   'approved'  — the signed final, generated when the chain completes
--   null        — supplementary files (เอกสารประกอบ)
-- =============================================================================

alter table document_attachments
  add column if not exists version text;  -- 'original' | 'approved' | null

-- Backfill existing rows: the generated_pdf ones were originals.
update document_attachments set version = 'original'
 where version is null and kind = 'generated_pdf';

-- A reusable signature image per login account (the approver uploads it once,
-- it gets stamped onto every approved PDF they sign).
alter table profiles add column if not exists signature_url text;
