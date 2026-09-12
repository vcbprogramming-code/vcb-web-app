-- ═══════════════════════════════════════════════════════════════════════════
-- วงเงินสินเชื่อ — เติมสิ่งที่ระบบจริงของลูกค้ามีแต่เรายังไม่มี
--
-- อ่านจากระบบที่เขารันอยู่ (ORIGINAL CODE/credit-facility/Code.js) รายการหนึ่ง
-- ในตาราง Transactions ของเขาเก็บ purpose / beneficiary / costCategory /
-- refDocFrom-To / source / docFrom-To ครบ ส่วนงบประมาณอยู่ในตาราง CategoryCaps
-- แยกตาม (โครงการ × หมวดค่าใช้จ่าย) และหน้าจอเตือนเมื่อใช้เกินงบ
-- ═══════════════════════════════════════════════════════════════════════════

-- ── รายการใช้วงเงิน: ฟิลด์ที่ฟอร์มของเขามีครบ ──────────────────────────────
alter table credit_ledger
  add column if not exists beneficiary    text,        -- ผู้รับผลประโยชน์
  add column if not exists counterparty   text,        -- รายละเอียด / คู่ค้า
  add column if not exists purpose        text,
  add column if not exists cost_category  text,        -- ป้อนให้หน้าสรุปค่าใช้จ่าย
  add column if not exists ref_doc_from   date,        -- ช่วงวันของเอกสารอ้างอิง
  add column if not exists ref_doc_to     date,
  add column if not exists term_days      integer;     -- จำนวนวัน → คำนวณวันครบกำหนด

alter table credit_requests
  add column if not exists beneficiary    text,
  add column if not exists counterparty   text,
  add column if not exists purpose        text,
  add column if not exists cost_category  text,
  add column if not exists ref_doc_no     text,
  add column if not exists ref_doc_from   date,
  add column if not exists ref_doc_to     date,
  add column if not exists attach_source  text,        -- เอกสารแนบ (อีเมล/แหล่งที่มา)
  add column if not exists attach_from    date,
  add column if not exists attach_to      date,
  add column if not exists term_days      integer;

-- ── หมวดค่าใช้จ่ายของฝั่งสินเชื่อ ─────────────────────────────────────────
-- คนละชุดกับหมวดต้นทุนของบันทึกงาน — ชุดนี้ใช้จัดกลุ่มว่าเงินที่เบิกไปซื้ออะไร
create table if not exists credit_cost_categories (
  name       text primary key,
  sort_order integer not null default 0,
  is_active  boolean not null default true
);
insert into credit_cost_categories (name, sort_order) values
  ('ค่าแรง', 1), ('เหล็ก', 2), ('ทราย', 3), ('น้ำมัน', 4), ('วัสดุสิ้นเปลือง', 5)
on conflict (name) do nothing;

-- ── งบประมาณต่อ (โครงการ × หมวดค่าใช้จ่าย) ────────────────────────────────
create table if not exists credit_category_caps (
  project_id    uuid not null references projects(id) on delete cascade,
  cost_category text not null,
  cap           numeric(14,2) not null default 0,
  note          text,
  updated_by    uuid references profiles(id),
  updated_at    timestamptz not null default now(),
  primary key (project_id, cost_category)
);

-- ── แผนการเงิน: แยกฉบับ "แผน" กับ "จริง" ในตารางเดียว ─────────────────────
-- หน้าผลต่างคือการเอาสองฉบับนี้มาลบกันรายเดือน
alter table cash_plans
  add column if not exists kind text not null default 'plan';
do $$ begin
  alter table cash_plans add constraint cash_plans_kind_chk check (kind in ('plan', 'actual'));
exception when duplicate_object then null; end $$;

-- คีย์เดิมกันซ้ำรายเดือน/ช่วง ต้องแยกตามชนิดด้วย ไม่งั้นฉบับจริงทับฉบับแผน
drop index if exists cash_plans_uniq;
create unique index if not exists cash_plans_uniq
  on cash_plans (project_id, month, period, kind);

-- ── รหัสกิจกรรมที่ระบบจริงไม่มี ───────────────────────────────────────────
-- Z-4..Z-6 เราสร้างเองเมื่อ 28 ส.ค. ระบบเขามีแค่ Z-1..Z-3 และไม่เคยมีใครใช้
-- รหัสพวกนี้เลย — ปิดไว้ ไม่ลบ เผื่อมีรายการเก่าอ้างถึง
update work_types set is_active = false where code in ('Z-4', 'Z-5', 'Z-6');
