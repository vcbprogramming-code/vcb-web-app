-- Prevent duplicate combined ("รวมเอกสาร") PDFs. autoCombine runs fire-and-forget,
-- so two near-simultaneous uploads can each delete-then-insert a combined_pdf row,
-- leaving two "…-รวมเอกสาร.pdf" attachments. The combined file uses a deterministic
-- storage key per document, so duplicate rows share the same object — deleting the
-- extra rows orphans nothing.
--
-- 1) de-dupe existing rows, keeping the newest per document
delete from document_attachments a
 using document_attachments b
 where a.kind = 'combined_pdf' and b.kind = 'combined_pdf'
   and a.document_id = b.document_id
   and (a.created_at < b.created_at or (a.created_at = b.created_at and a.id < b.id));

-- 2) enforce at most one combined_pdf per document; a racing second insert now
--    fails the unique constraint (caught by autoCombine's try/catch) → one row wins
create unique index if not exists document_attachments_one_combined_idx
  on document_attachments (document_id)
  where kind = 'combined_pdf';
