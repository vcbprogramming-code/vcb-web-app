-- =============================================================================
-- Migration 0012: Module 3 — Credit Facility Management
-- Status columns use Thai text values (business rules depend on the exact text):
--   อนุมัติแล้ว counts toward Used; ชำระแล้ว releases; คำขอใหม่/เสนออนุมัติ ignored; void ignored.
-- =============================================================================

-- facilities — วงเงินสินเชื่อ (multiple per project)
create table if not exists facilities (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  company       text,
  bank          text,
  facility_no   text,
  type          text not null,                 -- 'L/G (BG)','LGM (L/G)','T/L','B/E (AVAL)','P/N'
  "limit"       numeric not null default 0,
  used_baseline numeric not null default 0,
  interest_rate numeric,
  fee_rate      numeric,
  approved_date date,
  due_date      date,
  notes         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists facilities_project_idx on facilities(project_id);
create index if not exists facilities_type_idx on facilities(type);

-- credit_requests — created BEFORE credit_ledger so ledger can FK to it
create table if not exists credit_requests (
  id            uuid primary key default gen_random_uuid(),
  facility_id   uuid not null references facilities(id) on delete cascade,
  project_id    uuid not null references projects(id) on delete cascade,
  amount        numeric not null,
  start_date    date,
  due_date      date,
  ref           text,
  note          text,
  status        text not null default 'อยู่ระหว่างเสนออนุมัติ', -- อยู่ระหว่างเสนออนุมัติ|อนุมัติ|ไม่อนุมัติ
  decided_by    uuid references profiles(id) on delete set null,
  decided_at    timestamptz,
  decision_note text,
  ledger_id     uuid,                          -- set when approved (FK added after ledger exists)
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists credit_requests_facility_idx on credit_requests(facility_id);
create index if not exists credit_requests_status_idx on credit_requests(status);

-- credit_ledger — drawdown / settle entries
create table if not exists credit_ledger (
  id            uuid primary key default gen_random_uuid(),
  facility_id   uuid not null references facilities(id) on delete cascade,
  project_id    uuid not null references projects(id) on delete cascade,
  amount        numeric not null,
  status        text not null default 'อนุมัติแล้ว', -- คำขอใหม่|อยู่ระหว่างเสนออนุมัติ|อนุมัติแล้ว|ชำระแล้ว|void
  start_date    date,
  due_date      date,
  settled_date  date,
  ref           text,
  source        text,
  doc_from      text,
  doc_to        text,
  interest_rate numeric,
  note          text,
  request_id    uuid references credit_requests(id) on delete set null,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists credit_ledger_facility_idx on credit_ledger(facility_id);
create index if not exists credit_ledger_project_idx on credit_ledger(project_id);
create index if not exists credit_ledger_status_idx on credit_ledger(status);
create index if not exists credit_ledger_due_idx on credit_ledger(due_date);

alter table credit_requests
  add constraint credit_requests_ledger_fk
  foreign key (ledger_id) references credit_ledger(id) on delete set null;

-- cash_plans — monthly cash plan rows
create table if not exists cash_plans (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id) on delete cascade,
  month            text not null,              -- 'YYYY-MM'
  period           text not null default '1',
  income           numeric not null default 0,
  new_pn           numeric not null default 0,
  deductions       numeric not null default 0,
  income_breakdown text,
  available        numeric not null default 0,
  note             text,
  created_by       uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists cash_plans_pmp_idx on cash_plans(project_id, month, period);

-- cash_plan_paid — which ledger items a cash-plan row pays off (paidIds[])
create table if not exists cash_plan_paid (
  cash_plan_id uuid not null references cash_plans(id) on delete cascade,
  ledger_id    uuid not null references credit_ledger(id) on delete cascade,
  primary key (cash_plan_id, ledger_id)
);

-- credit_audit — detailed audit trail (changes as jsonb diff)
create table if not exists credit_audit (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles(id) on delete set null,
  actor_label text,
  action      text not null,
  target      text not null,                   -- facility|ledger|request|cashplan|limit
  target_id   text,
  changes     jsonb,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists credit_audit_target_idx on credit_audit(target, target_id, created_at desc);

create trigger trg_facilities_updated_at before update on facilities
  for each row execute function set_updated_at();
create trigger trg_credit_requests_updated_at before update on credit_requests
  for each row execute function set_updated_at();
create trigger trg_credit_ledger_updated_at before update on credit_ledger
  for each row execute function set_updated_at();
create trigger trg_cash_plans_updated_at before update on cash_plans
  for each row execute function set_updated_at();
