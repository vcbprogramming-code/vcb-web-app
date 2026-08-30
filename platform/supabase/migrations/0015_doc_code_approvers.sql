-- E-Memo: per-document-code default approver chain.
-- When a document code is chosen on the create form, its required approvers are
-- auto-filled (and locked) from this config instead of being typed by hand.
-- Stored as an ordered JSON array of { name, email }.

alter table doc_code_departments
  add column if not exists default_approvers jsonb not null default '[]'::jsonb;
