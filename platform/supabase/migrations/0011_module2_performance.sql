-- =============================================================================
-- Migration 0011: Module 2 — Performance / OT daily work log
-- =============================================================================

-- work_types — master index for the operation daily-log picker (grouped)
create table if not exists work_types (
  id          uuid primary key default gen_random_uuid(),
  code        text,
  name        text not null,
  description text,
  category    text not null default 'ทั่วไป',
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists work_types_code_key on work_types(code) where code is not null;
create index if not exists work_types_category_idx on work_types(category);

-- work_logs — one row per (employee, day). ymd stored as a date.
--   operation: team + work_type + ot_hours/rate/amount + reason
--   support:   detail (diary) + note
--   status:    '' worked | 'leave' ลา | 'off' พัก/หยุด
create type worklog_kind   as enum ('operation', 'support');
create type worklog_status as enum ('', 'leave', 'off');

create table if not exists work_logs (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references employees(id) on delete cascade,
  unit_id         uuid not null references units(id) on delete cascade,
  ymd             date not null,
  kind            worklog_kind not null,

  team            text,
  work_type_id    uuid references work_types(id) on delete set null,
  work_type_name  text,
  ot_hours        numeric,
  ot_rate         numeric,
  ot_amount       numeric,
  reason          text,

  detail          text,
  note            text,
  status          worklog_status not null default '',

  updated_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (employee_id, ymd)
);
create index if not exists work_logs_unit_ymd_idx on work_logs(unit_id, ymd);

create trigger trg_work_types_updated_at before update on work_types
  for each row execute function set_updated_at();
create trigger trg_work_logs_updated_at before update on work_logs
  for each row execute function set_updated_at();
