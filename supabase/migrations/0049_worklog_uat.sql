-- HR Work Log — the schema the client's acceptance criteria actually describe.
--
-- The module was built as a daily work diary: one row per person per day saying
-- what they did. The acceptance document describes a labour-cost instrument: how
-- much manpower each project spent, on which activity, reconciling to the cost
-- ledger. Everything here exists to close that gap without disturbing what the
-- diary already records — the existing columns keep their meaning, and the new
-- ones sit beside them.
--
-- Safe to re-run.

-- ── §3 what a day actually costs ──────────────────────────────────────────
-- man_day is the unit the whole document is written in (§3, §7, §8). hours is
-- kept alongside because some sites count in hours; one is derived from the
-- other at the API, never here, so a correction never rewrites history.
alter table work_logs add column if not exists man_day    numeric(4,2);
alter table work_logs add column if not exists hours      numeric(5,2);
-- ปกติ / ล่วงเวลา / Standby / ลา / ขาดงาน — free text with a check so the list
-- can grow without a migration, but a typo cannot enter.
alter table work_logs add column if not exists work_status text;
alter table work_logs drop constraint if exists work_logs_work_status_chk;
alter table work_logs add constraint work_logs_work_status_chk
  check (work_status is null or work_status in ('ปกติ','ล่วงเวลา','Standby','ลา','ขาดงาน'));

-- §3 the moment it was keyed, separate from the day it describes
alter table work_logs add column if not exists entry_at timestamptz not null default now();

-- §9 a delete has to stay auditable, so nothing is really deleted
alter table work_logs add column if not exists deleted_at timestamptz;
alter table work_logs add column if not exists deleted_by uuid references profiles(id);

-- §5 verification, by someone other than the recorder
alter table work_logs add column if not exists verified_by uuid references profiles(id);
alter table work_logs add column if not exists verified_at timestamptz;
create index if not exists work_logs_verified_idx on work_logs (unit_id, ymd) where verified_at is not null;
create index if not exists work_logs_live_idx on work_logs (unit_id, ymd) where deleted_at is null;

-- ── §3 a day split across activities ──────────────────────────────────────
-- The header row keeps the day's shape (team, notes); each line is a slice of
-- that day against one activity. The API holds the sum to 1 man-day — a check
-- constraint cannot see sibling rows.
create table if not exists work_log_lines (
  id            uuid primary key default gen_random_uuid(),
  work_log_id   uuid not null references work_logs(id) on delete cascade,
  work_type_code text,
  work_type_name text,
  cost_code     text,
  man_day       numeric(4,2) not null check (man_day > 0 and man_day <= 1),
  hours         numeric(5,2),
  work_status   text,
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists work_log_lines_log_idx on work_log_lines (work_log_id);

-- ── §2 the team register ──────────────────────────────────────────────────
-- `work_logs.team` was free text, so "ทีม A" and "ทีมA" were different teams and
-- neither could be reported on.
create table if not exists teams (
  id         uuid primary key default gen_random_uuid(),
  unit_id    uuid not null references units(id) on delete cascade,
  code       text,
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, name)
);
create index if not exists teams_unit_idx on teams (unit_id) where is_active;

-- ── §4 closing a month ────────────────────────────────────────────────────
create table if not exists period_closes (
  id         uuid primary key default gen_random_uuid(),
  unit_id    uuid not null references units(id) on delete cascade,
  ym         text not null check (ym ~ '^[0-9]{4}-[0-9]{2}$'),
  closed_by  uuid references profiles(id),
  closed_at  timestamptz not null default now(),
  note       text,
  unique (unit_id, ym)
);

-- ── §9 audit trail for the work log ───────────────────────────────────────
-- The module had none: E-Memo's audit_log covers documents only. Every create,
-- edit, delete, verify and unlock lands here with what changed and why.
create table if not exists work_log_audit (
  id         uuid primary key default gen_random_uuid(),
  work_log_id uuid,
  employee_id uuid,
  unit_id    uuid,
  ymd        date,
  action     text not null,
  before_val jsonb,
  after_val  jsonb,
  reason     text,
  actor_id   uuid references profiles(id),
  actor_label text,
  created_at timestamptz not null default now()
);
create index if not exists work_log_audit_scope_idx on work_log_audit (unit_id, ymd, created_at desc);
create index if not exists work_log_audit_log_idx on work_log_audit (work_log_id, created_at desc);

-- ── §6 leave: half days, evidence, and who may decide ─────────────────────
alter table leave_requests add column if not exists day_part text;
alter table leave_requests drop constraint if exists leave_requests_day_part_chk;
alter table leave_requests add constraint leave_requests_day_part_chk
  check (day_part is null or day_part in ('full','first_half','second_half'));
alter table leave_requests add column if not exists days numeric(4,1);
alter table leave_requests add column if not exists attachment_url  text;
alter table leave_requests add column if not exists attachment_name text;

-- ── §2 the non-productive states the document names ───────────────────────
insert into work_types (code, name, category, mapping, sort_order)
select v.code, v.name, v.category, v.mapping, v.sort_order
from (values
  ('Z-1', 'Standby / รอคำสั่งงาน',        'สถานะไม่ได้ผลิต', 'auto', 900),
  ('Z-2', 'ฝึกอบรม',                      'สถานะไม่ได้ผลิต', 'auto', 901),
  ('Z-3', 'หยุดเนื่องจากสภาพอากาศ',        'สถานะไม่ได้ผลิต', 'auto', 902),
  ('Z-4', 'ซ่อมบำรุง (ไม่ใช่งานผลิต)',     'สถานะไม่ได้ผลิต', 'auto', 903)
) as v(code, name, category, mapping, sort_order)
where not exists (select 1 from work_types w where w.code = v.code);
