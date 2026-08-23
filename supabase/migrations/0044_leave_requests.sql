-- ระบบลางาน — the request, who decides it, and who is allowed to decide.
--
-- The work log records what people DID. Until now the only mark for a day off
-- was employee_away: a fact with no story behind it — no type, no reason, and
-- nobody who approved it. This adds the request that produces that fact.
--
-- Everything here is additive. employee_away keeps working exactly as it does
-- today (an admin can still mark a day directly); an approved request simply
-- writes into it, so every screen that already reads it shows leave with no
-- change at all.

create table if not exists leave_requests (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references employees(id) on delete cascade,
  -- the site the person was posted to when they asked. Kept on the row rather
  -- than read back through the employee: people move sites, and last year's
  -- request belongs to where they were then.
  unit_id      uuid references units(id) on delete set null,
  leave_type   text not null default 'other',
    -- sick | personal | vacation | maternity | ordination | other
  from_date    date not null,
  to_date      date not null,
  reason       text not null default '',
  status       text not null default 'pending',
    -- pending | approved | rejected | cancelled
  requested_by uuid references profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  decided_by   uuid references profiles(id) on delete set null,
  decided_at   timestamptz,
  decide_note  text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint leave_requests_range check (to_date >= from_date),
  constraint leave_requests_status check (status in ('pending','approved','rejected','cancelled')),
  constraint leave_requests_type check (leave_type in ('sick','personal','vacation','maternity','ordination','other'))
);
create index if not exists leave_requests_emp_idx    on leave_requests (employee_id, from_date);
create index if not exists leave_requests_status_idx on leave_requests (status, requested_at desc);
create index if not exists leave_requests_unit_idx   on leave_requests (unit_id);

-- ใครอนุมัติของใคร — a supervisor and the people who report to them.
--
-- The client's own framing: "หัวหน้ามีลูกน้องเป็นใครบ้าง". A person may have more
-- than one approver on purpose, so a supervisor's own leave does not leave their
-- team's requests with nobody to look at them. An employee with no row here
-- falls through to the admins, so a request is never invisible.
create table if not exists leave_approvers (
  approver_id uuid not null references profiles(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (approver_id, employee_id)
);
create index if not exists leave_approvers_emp_idx on leave_approvers (employee_id);

-- Which request put a day into employee_away, so cancelling or reversing a
-- decision takes back exactly the days it added and leaves days an admin marked
-- by hand untouched.
alter table employee_away
  add column if not exists leave_request_id uuid references leave_requests(id) on delete cascade;
create index if not exists employee_away_leave_idx on employee_away (leave_request_id);
