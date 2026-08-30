-- =============================================================================
-- Migration 0022: "ขอความเห็น" (consult) on a document.
--
-- An approver who is deciding can ask another in-system user for an opinion
-- WITHOUT delegating the approval — the approval status is unchanged; it's just
-- a request for input, recorded in the conversation thread.
--
-- document_messages.kind:
--   'message' (default) — a normal thread message / reply
--   'consult'           — "ขอความเห็นจาก <someone>" note (consult_email = who was asked)
-- =============================================================================

alter table document_messages
  add column if not exists kind text not null default 'message';

alter table document_messages
  add column if not exists consult_email text;   -- who was asked (for 'consult' rows)
