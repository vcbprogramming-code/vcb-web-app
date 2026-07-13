-- Session revocation on password change. Access tokens are stateless 7-day JWTs,
-- so an admin resetting a user's password does NOT cut off already-issued tokens —
-- a leaked/stolen token keeps working for up to a week. Stamp the last password
-- change so requireAuth can reject any token issued before it (iat < changed_at).
-- NULL means "no baseline" → existing tokens stay valid (backwards compatible).
alter table profiles add column if not exists password_changed_at timestamptz;
