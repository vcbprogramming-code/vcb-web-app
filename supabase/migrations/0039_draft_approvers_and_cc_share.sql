-- Two additive changes. Nothing existing reads these columns/tables, so a
-- deployed API that predates this migration keeps working unchanged.

-- 1) Approvers chosen while drafting.
--    "บันทึกเป็นฉบับร่าง" threw the chosen approvers away: the chain is only written
--    on submit, and a draft never submits. The user came back to send it and found
--    the list empty. Park the intended chain here — shape:
--      { "pm": {"name": "...", "email": "..."}, "execs": [{"name": "...", "email": "..."}] }
--    It is intent only: nothing approves off this column, the real chain still
--    lives in approval_steps and is written at submit time.
alter table documents add column if not exists draft_approvers jsonb;

-- 2) Read-only share links for สำเนาเรียน (CC) recipients.
--    The CC email pointed at /memos/:id, which requires an account — and accounts
--    are provisioned by an admin only (the client's own rule). A copied-in person
--    outside the company hit the login wall and could never read the document they
--    were copied on. One unguessable token per (document, email) opens THAT
--    document read-only: no login, no register, no actions.
create table if not exists document_share_tokens (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  email text not null,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_viewed_at timestamptz,
  view_count integer not null default 0
);

-- one live link per recipient per document — re-sending reuses/refreshes it
create unique index if not exists document_share_tokens_doc_email_idx
  on document_share_tokens (document_id, lower(email));
create index if not exists document_share_tokens_doc_idx
  on document_share_tokens (document_id);
