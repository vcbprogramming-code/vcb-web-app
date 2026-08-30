-- E-Memo: optional uploaded signature image for the document author.
-- When set, the letterhead draws this image above the author's name instead of
-- showing the name as plain text. Stored as an S3 storage key.

alter table documents
  add column if not exists author_signature_url text;
