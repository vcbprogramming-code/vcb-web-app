-- #5 (perf as data grows): the register floats "awaiting me" docs to the top and
-- the home count scans pending approval steps by approver email. Index the pending
-- approver lookup so that stays fast when approval_steps grows.
create index if not exists approval_steps_pending_approver_idx
  on approval_steps (lower(approver_email))
  where action = 'pending' and action_token is not null;
