-- =============================================================================
-- Migration 0019: allow a 'combined_pdf' attachment kind.
--
-- document_attachments.kind was an enum ('upload','generated_pdf'). We now also
-- store a merged "one file" document (letter + PDF/image attachments) as kind
-- 'combined_pdf'. ALTER TYPE ... ADD VALUE cannot run inside a transaction (and
-- our migration runner wraps every file in one), so — as migration 0009 did for
-- the version column — we convert the column to text. All existing values are
-- preserved; the app is the source of truth for valid kinds now.
-- =============================================================================

alter table document_attachments
  alter column kind type text using kind::text;

alter table document_attachments
  alter column kind set default 'upload';
