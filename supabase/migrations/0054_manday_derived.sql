-- ═══════════════════════════════════════════════════════════════════════════
-- แรงงาน-วัน เป็นค่าที่คำนวณ ไม่ใช่ค่าที่คนกรอก
--
-- ระบบจริงของลูกค้าไม่เคยมีช่องให้กรอกตัวเลขแรงงาน-วัน — หนึ่งวันที่มีงานลง
-- อย่างน้อยหนึ่งช่องคือ 1 แรงงาน-วันเสมอ และถ้าวันนั้นลงสองงาน จะแบ่งเป็น
-- 0.5/0.5 ต่อรหัส เพื่อกระจายค่าแรงลงหมวดต้นทุน ไม่ใช่เพื่อให้ยอดรวมเกิน 1
--
-- ที่มา: hr.mandays ในสคีมาของลูกค้า และคอมเมนต์ใน Code.gs
--   "so each day stays 1 manday (split 0.5/0.5 only when two tasks are logged)"
-- ═══════════════════════════════════════════════════════════════════════════

-- หนึ่งแถวต่อ คน × วัน ที่มีงานลง = 1 แรงงาน-วัน
create or replace view worklog_mandays as
  select employee_id, unit_id, ymd, 1.0::numeric as manday
    from work_logs
   where deleted_at is null
     and (coalesce(detail, '') <> '' or coalesce(pm, '') <> '');

-- หนึ่งแถวต่อ คน × วัน × ช่องงาน พร้อมสัดส่วนของวันนั้น สำหรับกระจายลงหมวดต้นทุน
-- value เก็บเป็น "รหัสงาน / รหัสหมวดต้นทุน" จึงแยกด้วย split_part เหมือนต้นฉบับ
create or replace view worklog_slots as
  select w.employee_id, w.unit_id, w.ymd, s.slot, s.value,
         nullif(btrim(split_part(s.value, '/', 1)), '') as work_code,
         nullif(btrim(split_part(s.value, '/', 2)), '') as cost_code,
         -- สองงานในวันเดียว = คนละครึ่งวัน รวมยังเป็นหนึ่งวันเสมอ
         (1.0 / greatest(1, (case when coalesce(w.detail,'') <> '' then 1 else 0 end)
                          + (case when coalesce(w.pm,'')     <> '' then 1 else 0 end)))::numeric as manday
    from work_logs w
    cross join lateral (values (1, w.detail), (2, w.pm)) as s(slot, value)
   where w.deleted_at is null and coalesce(s.value, '') <> '';

comment on view worklog_mandays is 'แรงงาน-วันรวม: หนึ่งวันที่มีงานลง = 1 เสมอ';
comment on view worklog_slots  is 'แรงงาน-วันแยกตามช่องงาน สำหรับสรุปตามรหัสงาน/หมวดต้นทุน (สองงาน = 0.5/0.5)';
