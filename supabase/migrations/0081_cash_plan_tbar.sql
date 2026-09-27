-- ── แผนการเงิน (T-bar) · หักค่างานตามจริง — เก็บ "ส่วน" (period) ให้ครบตามชีตของลูกค้า ──
--
-- ชีต CashPlan ของระบบจริงมี 21 คอลัมน์ ของเรามีแค่ 10 ตารางเดิมจึงเก็บได้แค่
-- ยอดรวมรายเดือน ไม่ได้เก็บว่าเดือนนั้นแบ่งเป็นกี่ส่วน ส่วนไหนเป็นงวดรับค่างาน
-- ส่วนไหนเป็นงวดขอเบิก P/N และแต่ละส่วนหักอะไรไปเท่าไร
--
-- เติมคอลัมน์เท่านั้น ไม่ลบของเดิม: คอลัมน์ income / new_pn / deductions /
-- available เดิมยังอยู่และยังถูกเขียนค่าไว้เป็น "ยอดสรุปของส่วนนั้น" เพื่อให้
-- endpoint เดิม (GET/POST/PATCH /credit/cash-plan) และหน้าผลต่างเดิมอ่านได้ต่อ
--
-- ชื่อคอลัมน์ JSON ต้องเลี่ยงชื่อที่ถูกใช้แล้ว: deductions เดิมเป็น numeric
-- (ยอดหักรวม) และ income_breakdown เดิมเป็น text การเปลี่ยนชนิดคอลัมน์ที่โค้ด
-- เก่าอ่านอยู่จะพังตอนเซิร์ฟเวอร์ยังรันโค้ดเก่าคาบเกี่ยวกับ migration จึงเพิ่ม
-- คอลัมน์ใหม่ deductions_json / income_break / extra_rows แทน

alter table cash_plans
  -- PeriodIdx / PeriodLabel / PeriodDate — เลขส่วน (1..5) · เลขงวดที่ผู้ใช้พิมพ์ · วันที่ส่งงาน
  add column if not exists period_idx      integer not null default 0,
  add column if not exists period_label    text,
  add column if not exists period_date     date,
  -- PeriodType — income = ขอเบิก P/N · deduction = รับเงินค่างาน + หักหนี้ · aval = ขอออก Aval จัดสรร
  add column if not exists period_type     text not null default 'mixed',
  add column if not exists work_ref        text,
  add column if not exists new_pn_note     text,
  -- Deductions(JSON) — [{label, amount}] ห้าแถวตาม T-bar ของธนาคาร
  add column if not exists deductions_json jsonb not null default '[]'::jsonb,
  -- IncomeBreak(JSON) — {kind, work, segment, pnSold, rt, daysNew, daysRT}
  add column if not exists income_break    jsonb not null default '{}'::jsonb,
  -- ExtraRows(JSON) — [{label, amount}] รายรับจากแหล่งอื่นที่กรอกเองได้
  add column if not exists extra_rows      jsonb not null default '[]'::jsonb,
  add column if not exists aval_amount     numeric not null default 0,
  add column if not exists show_all_due    boolean not null default false,
  -- อัตราดอกเบี้ย P/N ต่อปี — ระบบจริงเก็บไว้ที่เครื่องผู้ใช้ (localStorage) ทำให้
  -- ไฟล์ Export ที่เซิร์ฟเวอร์สร้างคำนวณดอกเบี้ยไม่ได้ และคนละเครื่องได้เลขไม่เท่ากัน
  add column if not exists pn_rate         numeric not null default 0.0635;

-- ประเภทส่วนต้องเป็นสี่ค่านี้เท่านั้น — 'mixed' คือแถวเก่าที่ไม่ได้ระบุประเภท
do $$ begin
  alter table cash_plans add constraint cash_plans_period_type_chk
    check (period_type in ('income', 'deduction', 'aval', 'mixed'));
exception when duplicate_object then null; end $$;

-- ห้ามเกิน 5 ส่วนต่อเดือน (ระบบจริงเตือน "ใส่ได้สูงสุด 5 ส่วนต่อเดือน") —
-- ด่านสุดท้ายอยู่ที่ API ตรงนี้กันแค่เลขส่วนที่เป็นไปไม่ได้
do $$ begin
  alter table cash_plans add constraint cash_plans_period_idx_chk
    check (period_idx >= 0 and period_idx <= 99);
exception when duplicate_object then null; end $$;

-- แถวเก่า: เลขส่วนเอามาจากคอลัมน์ period ที่เป็นตัวเลขอยู่แล้ว ที่ไม่ใช่ตัวเลขให้เป็น 1
update cash_plans
   set period_idx = case when period ~ '^\d+$' then least(period::int, 99) else 1 end
 where period_idx = 0;

-- อ่านทีละ (โครงการ · เดือน · ฉบับ) แล้วเรียงตามเลขส่วน — คิวรีหลักของหน้า T-bar
create index if not exists cash_plans_tbar_idx
  on cash_plans (month, kind, project_id, period_idx);
