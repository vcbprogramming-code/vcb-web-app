-- 003 — credit: facilities, transactions, requests, limits, caps, cash plan.
--
-- ACCESS CONTROL LIVES IN THE API: api/src/routes/credit.js mounts requireAuth
-- for the whole module (this is company financial data — never anonymous) and
-- puts requireRole('credit','manager') on every write.
--
-- No RLS here. See 001_schemas.sql: the API connects as one database user, so
-- is_manager() reading auth.jwt() would evaluate identically for every caller.
-- The managers list below is still the source of truth for who is a manager —
-- resolveRoles() in api/src/auth.js reads it at sign-in — it just is not a
-- policy any more. Do not add policies back.

-- ---------------------------------------------------------------- identity --

-- Replaces the hardcoded MANAGERS array in the Apps Script Code.js.
create table if not exists credit.managers (
  email      text primary key,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------- reference tables --
--
-- These two existed only as hardcoded arrays in the React mock (SEED_PROJECTS /
-- SEED_FAC_TYPES in credit-facility/src/mock/seed.ts, itself copied from the
-- Apps Script Seed.js). Everything else in this module already keyed off them —
-- `facilities.project` is a project code, `facilities.facility_no` is a facility
-- type number — so they were foreign keys pointing at nothing. Making them real
-- tables means a project rename or a new facility type is a row, not a redeploy
-- of both the front end and the mock.

create table if not exists credit.projects (
  code       text primary key,          -- CVE / LPB / PN4 / … ; what every other
                                        -- table stores in its `project` column
  name_th    text not null,             -- seed: `th` — the label the UI shows
  company    text not null,             -- the legal entity that signs; several
                                        -- projects share one, and two projects of
                                        -- the same company differ only by suffix
  sort_order int,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- The ten facility types, keyed by the number that `facilities.facility_no` and
-- every transaction carry.
--
-- `kind` is the family; `doc_kind` is the short label printed on the document
-- pill in the UI. They are NOT the same string and the mapping is not derivable:
-- kindShort() in credit-facility/src/app/legacy.js maps LG→BG, LGM→L/G, TL→T/L,
-- AVAL→B/E, PN→P/N, and passes ML / DLC / PNPOST through unchanged (PNPOST
-- displaying as 'PN-post'). Storing both columns keeps that table in one place
-- instead of re-deriving it in the API, the client and any report.
create table if not exists credit.facility_types (
  no         int  primary key,          -- 1..10; `facilities.facility_no`
  code       text not null unique,      -- LG-CON / TL / AVAL / …
  name_th    text not null,             -- seed: `th`
  name_en    text not null,             -- seed: `en`
  kind       text not null,             -- LG / TL / LGM / AVAL / PN / ML / DLC / PNPOST
  doc_kind   text not null,             -- BG / T/L / L/G / B/E / P/N / M/L / DLC / PN-post
  created_at timestamptz not null default now()
);

create index if not exists facility_types_kind_idx on credit.facility_types(kind);

-- ------------------------------------------------------------------ tables --

-- Sheet tab: Facilities — Project | FacilityNo | Type | Limit | Used | … .
-- `used` is deliberately NOT a column: the live app derives it from unpaid
-- transactions unless credit.limits.used_override pins it. Storing it too would
-- give two answers that drift. See the facility_used view below.
create table if not exists credit.facilities (
  project     text not null,
  facility_no text not null,
  type        text,
  limit_amt   numeric(18,2),            -- sheet: Limit ("limit" is reserved)
  interest    text,                     -- free text: "MLR ต่อปี", "1.25 % ต่อปี…"
  notes       text,
  updated_at  timestamptz not null default now(),
  primary key (project, facility_no)
);

create table if not exists credit.transactions (
  id            text primary key,       -- the sheet's own id, preserved on import
  txn_date      date,                   -- sheet: Date
  project       text not null,
  facility_no   text,
  kind          text,
  ref           text,
  description   text,
  start_date    date,
  due_date      date,
  amount        numeric(18,2),
  status        text,
  created_by    text,                   -- sheet: By
  paid_date     date,
  note          text,
  source        text,
  doc_from      text,
  doc_to        text,
  cost_category text,
  purpose       text,
  beneficiary   text,
  ref_doc_from  text,
  ref_doc_to    text,
  updated_at    timestamptz not null default now(),
  foreign key (project, facility_no) references credit.facilities(project, facility_no)
);

create index if not exists transactions_project_idx  on credit.transactions(project);
create index if not exists transactions_facility_idx on credit.transactions(project, facility_no);
create index if not exists transactions_due_idx      on credit.transactions(due_date);
create index if not exists transactions_updated_idx  on credit.transactions(updated_at desc);

create table if not exists credit.requests (
  id           text primary key,
  req_date     date,                    -- sheet: Date
  project      text not null,
  company      text,
  facility_no  text,
  amount       numeric(18,2),
  purpose      text,
  beneficiary  text,
  status       text,
  requester    text,
  decided_by   text,
  decided_at   timestamptz,
  note         text,
  maturity     date,
  -- Set when an approval mints the drawdown transaction, inside the same
  -- transaction as the decision — a request can never be approved with no
  -- matching drawdown.
  linked_txn   text references credit.transactions(id),
  source       text,
  doc_from     text,
  doc_to       text,
  updated_at   timestamptz not null default now()
);

create index if not exists requests_project_idx on credit.requests(project);
create index if not exists requests_status_idx  on credit.requests(status);
create index if not exists requests_updated_idx on credit.requests(updated_at desc);

-- Sheet tab: Limits. used_override NULL means "derive from transactions", which
-- is the normal case; a number pins it.
create table if not exists credit.limits (
  project       text not null,
  facility_no   text not null,
  limit_amt     numeric(18,2),
  used_override numeric(18,2),
  updated_at    timestamptz not null default now(),
  primary key (project, facility_no)
);

create table if not exists credit.category_caps (
  project       text not null,
  cost_category text not null,
  cap           numeric(18,2),
  note          text,
  updated_at    timestamptz not null default now(),
  primary key (project, cost_category)
);

-- User-editable master list; the API replaces it wholesale because the client
-- edits it as one ordered array.
create table if not exists credit.cost_categories (
  name       text primary key,
  sort_order int,                       -- sheet: Order
  updated_at timestamptz not null default now()
);

-- Sheet tab: CashPlan — one row per (project, month, period, variant).
-- The jsonb columns stay jsonb rather than being normalised because the client
-- reads and writes each as one whole value; splitting them into child tables
-- would buy nothing until something queries inside them.
create table if not exists credit.cash_plan (
  id            text primary key,
  project       text not null,
  month         text not null,
  period_idx    int  not null,
  period_label  text,
  period_date   date,
  period_type   text,
  income        numeric(18,2),
  work_ref      text,
  paid_ids      jsonb not null default '[]'::jsonb,
  new_pn_amount numeric(18,2),
  new_pn_note   text,
  note          text,
  deductions    jsonb not null default '[]'::jsonb,
  income_break  jsonb not null default '[]'::jsonb,
  aval_amount   numeric(18,2),
  show_all_due  boolean not null default false,
  -- 'plan' = forecast, 'actual' = the recorded real T-bar. A blank in the sheet
  -- meant 'plan', so that is the default.
  variant       text not null default 'plan' check (variant in ('plan','actual')),
  extra_rows    jsonb not null default '[]'::jsonb,
  updated_at    timestamptz not null default now(),
  -- The API upserts on THIS key, not on id: the client may save a period it
  -- created offline under a fresh id, and without this the insert would 409.
  unique (project, month, period_idx, variant)
);

create index if not exists cash_plan_project_month_idx on credit.cash_plan(project, month);

-- Append-only. Written inside the caller's transaction so an audit row for a
-- write that then rolled back cannot exist.
create table if not exists credit.audit (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),   -- sheet: Timestamp
  actor     text,                                 -- sheet: User
  action    text,
  target    text,
  target_id text,
  changes   jsonb,
  note      text
);

create index if not exists credit_audit_at_idx on credit.audit(at desc);

-- ------------------------------------------------------------------ views ---

-- `Used` was never really a stored column: the app derives it from unpaid
-- transactions unless pinned. Keeping the rule in SQL means the client cannot
-- drift from it.
create or replace view credit.facility_used as
  select
    f.project,
    f.facility_no,
    f.limit_amt,
    coalesce(
      l.used_override,
      (select coalesce(sum(t.amount), 0)
         from credit.transactions t
        where t.project = f.project
          and t.facility_no = f.facility_no
          and coalesce(t.status, '') <> 'Paid')
    ) as used
  from credit.facilities f
  left join credit.limits l
    on l.project = f.project and l.facility_no = f.facility_no;

-- ------------------------------------------------------------------ seeding --

-- The eight projects, verbatim from SEED_PROJECTS.
insert into credit.projects (code, name_th, company, sort_order) values
  ('CVE', 'ชวนา เอ็นจิเนียร์ริ่ง',                    'บริษัท ชวนา เอ็นจิเนียร์ริ่ง จำกัด',                1),
  ('LPB', 'หลวงพระบาง',                              'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด',                  2),
  ('PN4', 'พุทธมณฑล 4 (กิจการร่วมค้า วี แอนด์ เค)',    'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด',                  3),
  ('BT1', 'บางเตย ตอน 1',                            'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด (บางเตย ตอน 1)',   4),
  ('VK2', 'บางเตย ตอน 2 (กิจการร่วมค้า วีเค)',         'กิจการร่วมค้า วีเค',                               5),
  ('BV',  'บางวัว ตอน 6',                            'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด (บางวัว ตอน 6)',   6),
  ('V&K', 'พุทธมณฑล ตอน 3',                          'กิจการร่วมค้า วี แอนด์ เค',                        7),
  ('HO',  'ส่วนกลาง',                                'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด',                  8)
on conflict (code) do update set
  name_th    = excluded.name_th,
  company    = excluded.company,
  sort_order = excluded.sort_order;

-- The ten facility types, verbatim from SEED_FAC_TYPES, with doc_kind resolved
-- through kindShort() as documented above.
insert into credit.facility_types (no, code, name_th, name_en, kind, doc_kind) values
  ( 1, 'LG-CON',  'หนังสือค้ำประกันสัญญา 5%',                    'Performance Guarantee (5%)',      'LG',     'BG'),
  ( 2, 'LG-ADV',  'หนังสือค้ำประกัน Advance 15%',                'Advance Payment Guarantee (15%)', 'LG',     'BG'),
  ( 3, 'LG-RET',  'หนังสือค้ำเงินประกันผลงาน',                    'Retention Guarantee',             'LG',     'BG'),
  ( 4, 'TL',      'วงเงิน T/L (หักค่างาน)',                       'Term / Standby Loan',             'TL',     'T/L'),
  ( 5, 'LGM',     'L/G วัสดุ/สาธารณูปโภค',                        'L/G Materials / Utilities',       'LGM',    'L/G'),
  ( 6, 'AVAL',    'B/E รับรอง/อาวัลตั๋ว',                         'B/E / Aval',                      'AVAL',   'B/E'),
  ( 7, 'PN',      'P/N Against (ขายลดค่างาน)',                    'Promissory Note (discounting)',   'PN',     'P/N'),
  ( 8, 'ML',      'วงเงิน M/L (เงินกู้)',                          'M/L Loan',                        'ML',     'M/L'),
  ( 9, 'DLC',     'วงเงิน DLC (เลตเตอร์ออฟเครดิตในประเทศ)',        'Domestic L/C (DLC)',              'DLC',    'DLC'),
  (10, 'PN-POST', 'P/N Post (เฉพาะ CVE)',                        'P/N Post-financing',              'PNPOST', 'PN-post')
on conflict (no) do update set
  code     = excluded.code,
  name_th  = excluded.name_th,
  name_en  = excluded.name_en,
  kind     = excluded.kind,
  doc_kind = excluded.doc_kind;
