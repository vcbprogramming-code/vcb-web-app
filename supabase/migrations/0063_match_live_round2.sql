-- ═══════════════════════════════════════════════════════════════════════════
-- ตรงกับระบบจริงของลูกค้า รอบที่สอง — จากการป้อนข้อมูลชุดเดียวกันเข้าทั้งสองระบบ
--
-- ทุกข้อในไฟล์นี้เป็นการเพิ่ม ไม่มีการลบคอลัมน์หรือข้อมูลที่ใช้งานอยู่
-- ═══════════════════════════════════════════════════════════════════════════

-- ── บันทึกงาน: ย้ายพนักงานแบบมีวันที่มีผล ─────────────────────────────────
-- ระบบจริง (api_migrateEmployee) เก็บการย้ายเป็นประวัติ: ก่อนวันที่ย้ายคนนั้น
-- ยังเป็นของไซต์เดิม หลังจากนั้นเป็นของไซต์ใหม่ หนึ่งวันอยู่ได้ไซต์เดียวเสมอ
-- ของเราเดิมแค่เปลี่ยน unit_id ทำให้แถวของคนนั้นหายจากตารางของไซต์เดิม
-- ทุกเดือนย้อนหลัง ทั้งที่บันทึกงานเก่ายังอยู่
create table if not exists employee_moves (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references employees(id) on delete cascade,
  from_unit_id   uuid not null references units(id),
  to_unit_id     uuid not null references units(id),
  effective_date date not null,
  note           text,
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now()
);
create index if not exists employee_moves_emp_idx on employee_moves (employee_id, effective_date);
create index if not exists employee_moves_units_idx on employee_moves (from_unit_id, to_unit_id);

-- ── บันทึกงาน: เปิด/ปิดโครงการ ─────────────────────────────────────────────
-- ระบบจริงมี "จัดการโครงการ" (api_addSite / api_setSiteActive) ปิดแล้วไม่รับ
-- บันทึกใหม่ แต่ประวัติยังอยู่และยังขึ้นในภาพรวม
alter table units add column if not exists is_active boolean not null default true;

-- สองไซต์ที่ระบบจริงมีแต่ของเรายังไม่มี
insert into units (name, code, company, lock_days)
select 'พขร.ปูน', 'DRV', 'วิจิตรภัณฑ์ก่อสร้าง จำกัด', 3
 where not exists (select 1 from units where name = 'พขร.ปูน' or code = 'DRV');
insert into units (name, code, company, lock_days)
select 'สำนักงานใหญ่', 'HQ', 'วิจิตรภัณฑ์ก่อสร้าง จำกัด', 3
 where not exists (select 1 from units where name = 'สำนักงานใหญ่' or code = 'HQ');

-- หน่วยงานตัวอย่าง U1–U5 จากชุดข้อมูลตั้งต้น ไม่มีในระบบจริงและไม่มีใครใช้
-- ปิดไว้เฉพาะตัวที่ไม่มีพนักงาน ไม่มีบันทึกงาน และไม่มีผู้ใช้ผูกอยู่เลย
update units u set is_active = false
 where u.code in ('U1','U2','U3','U4','U5')
   and not exists (select 1 from employees e where e.unit_id = u.id)
   and not exists (select 1 from work_logs w where w.unit_id = u.id)
   and not exists (select 1 from profiles p where p.unit_id = u.id)
   and not exists (select 1 from profile_units pu where pu.unit_id = u.id);

-- ── บันทึกงาน: รหัสงานไม่สนตัวพิมพ์ ───────────────────────────────────────
-- ระบบจริงจับคู่รหัสงานแบบไม่สนตัวพิมพ์ ("a-1 / 5" คือ A-1) ของเราเดิมเทียบ
-- ตรงตัว วันที่พิมพ์ตัวเล็กจึงหลุดจากรายงานแรงงาน-วันไปเป็น "ไม่ระบุงาน"
create or replace view worklog_slots as
  with slot1 as (
    select w.id, w.employee_id, w.unit_id, w.ymd,
           case when e.kind = 'operation' then w.team else w.detail end as value,
           w.pm
      from work_logs w
      join employees e on e.id = w.employee_id
     where w.deleted_at is null
  )
  select s.employee_id, s.unit_id, s.ymd, x.slot, x.value,
         nullif(upper(btrim(split_part(x.value, '/', 1))), '') as work_code,
         nullif(btrim(split_part(x.value, '/', 2)), '') as cost_code,
         (1.0 / greatest(1, (case when coalesce(btrim(s.value), '') <> '' then 1 else 0 end)
                          + (case when coalesce(btrim(s.pm), '')   <> '' then 1 else 0 end)))::numeric as manday
    from slot1 s
    cross join lateral (values (1, s.value), (2, s.pm)) as x(slot, value)
   where coalesce(btrim(x.value), '') <> '';

-- ── วงเงิน: ตั้งยอดใช้ไปเอง ─────────────────────────────────────────────────
-- ระบบจริง (setUsedOverride) ให้ปักยอดใช้ไปเป็นตัวเลขที่ธนาคารแจ้ง เมื่อยอดที่
-- คำนวณจากรายการไม่ตรงความจริง (รายการนอกระบบ ปรับยอดสิ้นปี ธนาคารแก้ไข)
-- ว่าง = คำนวณอัตโนมัติเหมือนเดิม
alter table facilities add column if not exists used_override numeric(16,2);

-- ── วงเงิน: หมวดค่าใช้จ่ายชุดเดียวกับระบบจริง ─────────────────────────────
-- รอบก่อนเราตั้งห้าหมวดขึ้นเองจากป้ายบนหน้าจอ ระบบจริงมีสิบแปดหมวด
update credit_cost_categories set is_active = false
 where name not in ('ทรายถม','หิน','ปูน/คอนกรีต/ทรายหยาบ','เหล็ก','ค่าแรงผรม.รายย่อย',
                    'ค่าแรง-ถมทราย','ค่าแรง-VACUUM','ค่าแรง-ปูยาง','ค่าแรง-RAMP','ค่าแรง-ดึงลวด',
                    'ค่าแรง-สะพาน','ค่าแรง-เสาเข็ม','ค่าแรง-ไฟฟ้าแสงสว่าง','ค่าขนส่ง','น้ำมัน',
                    'ค่าเครื่องจักร','วัสดุสิ้นเปลือง','อื่นๆ');
insert into credit_cost_categories (name, sort_order, is_active)
select v.name, v.ord, true
  from (values ('ทรายถม',1),('หิน',2),('ปูน/คอนกรีต/ทรายหยาบ',3),('เหล็ก',4),('ค่าแรงผรม.รายย่อย',5),
               ('ค่าแรง-ถมทราย',6),('ค่าแรง-VACUUM',7),('ค่าแรง-ปูยาง',8),('ค่าแรง-RAMP',9),('ค่าแรง-ดึงลวด',10),
               ('ค่าแรง-สะพาน',11),('ค่าแรง-เสาเข็ม',12),('ค่าแรง-ไฟฟ้าแสงสว่าง',13),('ค่าขนส่ง',14),('น้ำมัน',15),
               ('ค่าเครื่องจักร',16),('วัสดุสิ้นเปลือง',17),('อื่นๆ',18)) as v(name, ord)
on conflict (name) do update set sort_order = excluded.sort_order, is_active = true;
