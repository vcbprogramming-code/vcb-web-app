-- =============================================================================
-- Migration 0027: link "อ้างถึง" to a real in-system document (client #3).
--
-- Previously the อ้างถึง field was free text and we regex-guessed which document
-- it pointed at. The client wants it ENFORCED: the clerk picks an existing memo
-- from a search box, so they can't typo a number that doesn't exist. We store the
-- chosen document's id; documents.reference (the printed text) is still kept for
-- display and for legacy rows. Null = no reference.
-- =============================================================================

alter table documents
  add column if not exists reference_doc_id uuid references documents(id) on delete set null;
