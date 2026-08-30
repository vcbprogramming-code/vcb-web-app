-- =============================================================================
-- Migration 0021: 2-way communication on a document (client request 2026-07-04).
--
-- A conversation thread on each document: any in-system user can post a message
-- (text) with optional file attachments, shown on the detail page merged with
-- the approval-chain timeline. Attachments reuse document_attachments with a new
-- kind 'message' and a message_id link.
-- =============================================================================

create table if not exists document_messages (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  author_id    uuid references profiles(id) on delete set null,
  author_label text,                         -- name snapshot (in case profile is removed)
  body         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_document_messages_doc
  on document_messages(document_id, created_at);

-- link a message to its attachments (document_attachments.kind='message')
alter table document_attachments
  add column if not exists message_id uuid references document_messages(id) on delete cascade;
