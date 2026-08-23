-- วงเงินสินเชื่อ — how much the bank has allowed each project, and what has been
-- drawn against it.
--
-- This module touches money, so two things differ from the others: every write
-- is attributed, and nothing is derived where it can be stored. In particular
-- "used" is normally the sum of the transactions against a facility, but the
-- bank's own statement sometimes disagrees with our ledger — so an explicit
-- override can be recorded, and the screen says plainly when one is in force
-- rather than quietly showing a number nobody can reproduce.
--
-- All new (cf_*). No existing table is touched.

create table if not exists cf_facility_types (
  code        text primary key,
  no          int not null default 0,
  name_th     text not null,
  name_en     text not null default '',
  kind        text not null default '',
  is_active   boolean not null default true
);

create table if not exists cf_facilities (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  facility_no  int not null,
  type_code    text references cf_facility_types(code) on delete set null,
  limit_amount numeric(16,2) not null default 0,
  -- null = use the sum of transactions; a number = the bank's figure, kept
  -- because it is what the statement says even when our ledger differs
  used_override numeric(16,2),
  interest     text not null default '',
  notes        text not null default '',
  updated_by   uuid references profiles(id) on delete set null,
  updated_at   timestamptz not null default now(),
  unique (project_id, facility_no)
);
create index if not exists cf_facilities_project_idx on cf_facilities (project_id, facility_no);

-- What has actually been drawn, repaid, or guaranteed against a facility.
-- A negative amount is a repayment — the client's own sheets are kept that way
-- and reversing the convention here would make every figure disagree with theirs.
create table if not exists cf_transactions (
  id           uuid primary key default gen_random_uuid(),
  facility_id  uuid not null references cf_facilities(id) on delete cascade,
  kind         text not null default '',      -- B/E, P/N, T/L …
  ref          text not null default '',
  description  text not null default '',
  beneficiary  text not null default '',
  start_date   date,
  due_date     date,
  amount       numeric(16,2) not null default 0,
  status       text not null default 'active', -- active | settled | cancelled
  settled_date date,
  cost_category text not null default '',
  note         text not null default '',
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint cf_txn_status check (status in ('active','settled','cancelled'))
);
create index if not exists cf_txn_facility_idx on cf_transactions (facility_id, due_date);
create index if not exists cf_txn_due_idx on cf_transactions (due_date) where status = 'active';

-- Asking to use a facility, and the decision on it. Separate from the
-- transaction: a request may be refused, and a refusal is a record too.
create table if not exists cf_requests (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  facility_id  uuid references cf_facilities(id) on delete set null,
  amount       numeric(16,2) not null default 0,
  purpose      text not null default '',
  beneficiary  text not null default '',
  maturity     text not null default '',
  status       text not null default 'new',   -- new | proposed | approved | rejected | cancelled
  note         text not null default '',
  linked_txn   uuid references cf_transactions(id) on delete set null,
  requested_by uuid references profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  decided_by   uuid references profiles(id) on delete set null,
  decided_at   timestamptz,
  decide_note  text not null default '',
  constraint cf_req_status check (status in ('new','proposed','approved','rejected','cancelled'))
);
create index if not exists cf_requests_project_idx on cf_requests (project_id, requested_at desc);
create index if not exists cf_requests_status_idx on cf_requests (status);

-- A ceiling on a category of spending, per project. Advisory: the screen warns
-- when a category is over, it does not block the work.
create table if not exists cf_category_caps (
  project_id    uuid not null references projects(id) on delete cascade,
  cost_category text not null,
  cap_amount    numeric(16,2) not null default 0,
  note          text not null default '',
  updated_by    uuid references profiles(id) on delete set null,
  updated_at    timestamptz not null default now(),
  primary key (project_id, cost_category)
);

-- Every change to a number, with who made it. On a money module "the figure
-- changed and nobody knows when" is not an acceptable answer.
create table if not exists cf_audit (
  id         bigserial primary key,
  entity     text not null,          -- facility | transaction | request | cap
  entity_id  text not null,
  action     text not null,
  detail     jsonb not null default '{}'::jsonb,
  actor_id   uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists cf_audit_entity_idx on cf_audit (entity, entity_id, created_at desc);

-- The ten facility types the client's banks actually use. Reference data, not
-- money — safe to seed.
insert into cf_facility_types (code, no, name_th, name_en, kind) values
  ('LG-CON', 1, 'หนังสือค้ำประกันสัญญา 5%', 'Performance Guarantee (5%)', 'LG'),
  ('LG-ADV', 2, 'หนังสือค้ำประกัน Advance 15%', 'Advance Payment Guarantee (15%)', 'LG'),
  ('LG-RET', 3, 'หนังสือค้ำเงินประกันผลงาน', 'Retention Guarantee', 'LG'),
  ('TL',     4, 'วงเงิน T/L (หักค่างาน)', 'Term / Standby Loan', 'TL'),
  ('LGM',    5, 'L/G วัสดุ/สาธารณูปโภค', 'L/G Materials / Utilities', 'LGM'),
  ('AVAL',   6, 'B/E รับรอง/อาวัลตั๋ว', 'B/E / Aval', 'AVAL'),
  ('PN',     7, 'P/N Against (ขายลดค่างาน)', 'Promissory Note (discounting)', 'PN'),
  ('ML',     8, 'วงเงิน M/L (เงินกู้)', 'M/L Loan', 'ML'),
  ('DLC',    9, 'วงเงิน DLC (เลตเตอร์ออฟเครดิตในประเทศ)', 'Domestic L/C (DLC)', 'DLC'),
  ('PN-POST',10, 'P/N Post (เฉพาะ CVE)', 'P/N Post-financing', 'PNPOST')
on conflict (code) do nothing;
