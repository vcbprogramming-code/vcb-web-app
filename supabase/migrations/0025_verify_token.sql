-- =============================================================================
-- Migration 0025: public verify token per document (client request #6).
--
-- Each document gets a stable, unguessable token. A public page /verify/<token>
-- (no login) shows the document's status, approval steps and audit trail so a
-- printed/exported copy can be proven authentic. A QR code encoding that URL is
-- stamped into the generated PDF. gen_random_uuid() gives us the token value.
-- =============================================================================

alter table documents
  add column if not exists verify_token uuid not null default gen_random_uuid();

-- backfill any pre-existing rows that somehow lack one (defensive)
update documents set verify_token = gen_random_uuid() where verify_token is null;

create unique index if not exists uq_documents_verify_token
  on documents(verify_token);
