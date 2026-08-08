-- Brute-force protection that actually holds.
--
-- The existing limiter counts failures in memory, keyed by client IP. Behind the
-- hosting proxy that IP is not stable, so the count scatters across buckets: in
-- testing the same burst of wrong passwords was blocked at attempt 17, at 22, at
-- 27, and once not at all within 30. A process restart also clears it.
--
-- Counting per ACCOUNT in the database fixes both: it survives restarts, it does
-- not care which IP the guesses come from, and it protects the thing that
-- actually matters — the account. The IP limiter stays as a first layer (it is
-- the only thing that can slow guesses at addresses that don't exist).
alter table profiles add column if not exists failed_login_count integer not null default 0;
alter table profiles add column if not exists login_locked_until timestamptz;
