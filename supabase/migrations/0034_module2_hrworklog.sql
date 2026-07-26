-- =============================================================================
-- Migration 0034: Module 2 rework — daily work-ACTIVITY log (hr-worklog)
--   Reworks the OT-based Module 2 into the activity-log model:
--     • work_types (activities) gain `mapping` (one-to-one|one-to-many) + `fixed_cost`
--     • new `cost_categories` (ERP cost codes — picker step 2)
--     • work_logs gain `pm` (2nd-task slot); a cell is team(op) / detail(support) / pm
--     • new `employee_away` (leave / not-on-site days)
--   Additive only — OT columns on work_logs are left in place (unused), nothing
--   from other modules is touched. Feature stays flag-OFF in nav.js.
-- =============================================================================

-- ── activities catalog (extends work_types) ────────────────────────────────
alter table work_types add column if not exists mapping text not null default 'one-to-many';
alter table work_types add column if not exists fixed_cost text;

-- ── ERP cost categories (picker step 2) ────────────────────────────────────
create table if not exists cost_categories (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  name        text not null,
  name_en     text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists cost_categories_code_key on cost_categories(code);
create trigger trg_cost_categories_updated_at before update on cost_categories
  for each row execute function set_updated_at();

-- ── work_logs: 2nd-task slot ───────────────────────────────────────────────
--   team   = operation cell composite "A-1 / 5" (activityCode / costCode)
--   detail = support cell free text
--   pm     = optional 2nd task (same composite format)
alter table work_logs add column if not exists pm text;

-- ── employee away days (ลา / ไม่อยู่หน้างาน) ─────────────────────────────────
create table if not exists employee_away (
  employee_id uuid not null references employees(id) on delete cascade,
  ymd         date not null,
  primary key (employee_id, ymd)
);

-- NOTE: project sites use the existing `units` rows (the client's real projects —
-- BTBP, BWA, PTM, S5, SPB, …); this migration deliberately does NOT seed sample
-- sites, to avoid duplicating them.

-- ── seed: 12 cost categories ───────────────────────────────────────────────
insert into cost_categories (code, name, name_en, sort_order) values
  ('1',  'ค่าบริหารโครงการ',      'Project Administration', 1),
  ('4',  'ความปลอดภัย',           'Safety & Security',      2),
  ('5',  'งานสำนักงานทั่วไป',      'General Office Work',     3),
  ('6',  'งานสำรวจ',              'Survey Works',           4),
  ('7',  'งานดิน / ปรับพื้นที่',   'Earthworks',             5),
  ('8',  'เครื่องจักรหนัก',        'Heavy Equipment',        6),
  ('9',  'งานขนส่ง',              'Transportation',         7),
  ('10', 'งานคอนกรีต',           'Concrete Works',         8),
  ('11', 'งานผิวทาง',            'Pavement Works',         9),
  ('12', 'งานระบบระบายน้ำ',       'Drainage Works',        10),
  ('15', 'งานซ่อมบำรุง',          'Maintenance',           11),
  ('20', 'ไม่ปฏิบัติงาน / ลา',     'Non-working / Leave',   12)
on conflict (code) do nothing;

-- ── seed: 18 activities (into work_types) ──────────────────────────────────
insert into work_types (code, name, category, mapping, fixed_cost, sort_order) values
  ('A-1', 'งานบุคคล - ธุรการ - บัญชี',        'A · งานสำนักงาน',   'one-to-many', null,  1),
  ('A-2', 'งานพัสดุ / คลังสินค้า',            'A · งานสำนักงาน',   'one-to-many', null,  2),
  ('A-3', 'งานการเงิน / จัดซื้อ',             'A · งานสำนักงาน',   'one-to-one',  '1',   3),
  ('B-1', 'ควบคุมงานหน้างาน (โฟร์แมน)',       'B · งานควบคุม',     'one-to-many', null,  4),
  ('B-2', 'งานสำรวจ / วางแนว',               'B · งานควบคุม',     'one-to-many', null,  5),
  ('B-3', 'งาน Safety / ความปลอดภัย',        'B · งานควบคุม',     'one-to-one',  '4',   6),
  ('C-1', 'งานปรับพื้นที่ / ดินถม',           'C · งานก่อสร้าง',   'one-to-many', null,  7),
  ('C-2', 'งานคอนกรีต / โครงสร้าง',          'C · งานก่อสร้าง',   'one-to-many', null,  8),
  ('C-3', 'งานผิวทาง / แอสฟัลต์',            'C · งานก่อสร้าง',   'one-to-many', null,  9),
  ('C-4', 'งานระบบระบายน้ำ',                'C · งานก่อสร้าง',   'one-to-many', null, 10),
  ('D-1', 'รถเกรดเดอร์',                     'D · เครื่องจักร',    'one-to-one',  '8',  11),
  ('D-2', 'รถขุด / แบ็คโฮ',                  'D · เครื่องจักร',    'one-to-one',  '8',  12),
  ('D-3', 'รถบดสั่นสะเทือน',                 'D · เครื่องจักร',    'one-to-one',  '8',  13),
  ('D-4', 'รถบรรทุก 10 ล้อ',                'D · เครื่องจักร',    'one-to-one',  '9',  14),
  ('E-1', 'ซ่อมบำรุงเครื่องจักรหนัก',         'E · ซ่อมบำรุง',     'one-to-many', null, 15),
  ('E-2', 'ซ่อมบำรุงเครื่องจักรเบา',          'E · ซ่อมบำรุง',     'one-to-many', null, 16),
  ('Z-1', 'วันหยุด / หยุดงาน',               'Z · ไม่ปฏิบัติงาน',  'one-to-one',  '20', 17),
  ('Z-2', 'ลา (ลาป่วย / ลากิจ)',            'Z · ไม่ปฏิบัติงาน',  'one-to-one',  '20', 18)
on conflict (code) where code is not null do nothing;
