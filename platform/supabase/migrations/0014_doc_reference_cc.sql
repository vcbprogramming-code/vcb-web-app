-- E-Memo: add อ้างถึง (reference) and สำเนาเรียน / CC to documents.
-- The real memo letterhead has a "อ้างถึง" line and the add-document form
-- collects a CC list; both were missing from the schema.

alter table documents
  add column if not exists reference     text,        -- อ้างถึง (free text)
  add column if not exists cc_recipients text;        -- สำเนาเรียน / CC (comma-separated)
