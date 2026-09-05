-- ═══════════════════════════════════════════════════════════════════════════
-- ช่องงานหลักอยู่คนละคอลัมน์ตามสายงาน
--
-- เอกสารข้อกำหนดฟังก์ชันของลูกค้า §3.2.2 ระบุว่า slot 1 (งานหลัก) คือ
--   • สายปฏิบัติการ (operation) → คอลัมน์ team
--   • สายสนับสนุน   (support)   → คอลัมน์ detail
-- ส่วน slot 2 (งานเสริม) คือ pm เหมือนกันทั้งสองสาย
--
-- view รอบก่อนอ่านแต่ detail/pm จึงมองไม่เห็นงานของสายปฏิบัติการเลย และจะนับ
-- ชื่อทีมที่ค้างอยู่ในคอลัมน์ team ของสายสนับสนุนเป็นงานถ้าเผลออ่านรวม —
-- ต้อง join employees เพื่อรู้สายงานก่อนเสมอ
-- ═══════════════════════════════════════════════════════════════════════════

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
         nullif(btrim(split_part(x.value, '/', 1)), '') as work_code,
         nullif(btrim(split_part(x.value, '/', 2)), '') as cost_code,
         -- สองงานในวันเดียว = คนละครึ่งวัน รวมยังเป็นหนึ่งวันเสมอ
         (1.0 / greatest(1, (case when coalesce(s.value, '') <> '' then 1 else 0 end)
                          + (case when coalesce(s.pm, '')   <> '' then 1 else 0 end)))::numeric as manday
    from slot1 s
    cross join lateral (values (1, s.value), (2, s.pm)) as x(slot, value)
   where coalesce(x.value, '') <> '';

create or replace view worklog_mandays as
  select distinct employee_id, unit_id, ymd, 1.0::numeric as manday
    from worklog_slots;

comment on view worklog_slots is
  'แรงงาน-วันแยกตามช่องงาน · slot 1 = team (สายปฏิบัติการ) หรือ detail (สายสนับสนุน), slot 2 = pm';
