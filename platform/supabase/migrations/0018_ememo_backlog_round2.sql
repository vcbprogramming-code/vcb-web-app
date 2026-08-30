-- =============================================================================
-- Migration 0018: E-Memo backlog round 2 (2026-06-28 client requests)
--
-- Item 5 — ผู้เตรียม ≠ ผู้เซ็น: the person who prepares the memo may differ from
--   the person who signs it. We keep created_by as the *preparer* (shown on a
--   line at the bottom of the letter) and add explicit signer_name / signer_title
--   for the signature block (falls back to the letterhead's default signatory).
--
-- Item 1 — passwordless login: the client wants email-only login (keep the same
--   flow, just drop the password). password_hash becomes optional; a login only
--   needs an active profile row. (No schema change strictly required since the
--   column is already nullable, but we document the intent here.)
--
-- Item 3 — action-level permissions: a per-profile JSON permission map so admins
--   can grant/deny individual actions (create/approve/edit/view) per module.
--   NULL / absent key = fall back to the role's defaults (backwards compatible).
-- =============================================================================

-- Item 5 — distinct signer on the document -----------------------------------
alter table documents add column if not exists signer_name  text;
alter table documents add column if not exists signer_title text;

-- Item 3 — action-level permission overrides ---------------------------------
-- shape: { "ememo": { "create": true, "approve": false }, "credit": {...}, ... }
alter table profiles add column if not exists permissions jsonb not null default '{}'::jsonb;
