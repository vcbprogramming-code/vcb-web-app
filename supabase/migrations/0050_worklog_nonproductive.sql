-- §2 asks the work-type register to cover the states where nobody produced:
-- Standby, training, weather, maintenance. 0049 added them keyed by code, but
-- Z-1 and Z-2 were already taken by วันหยุด and ลา, so two of the four were
-- silently skipped. Match on the name instead — that is what the criterion is
-- about — and let the code fall where it may.
insert into work_types (code, name, category, mapping, sort_order)
select v.code, v.name, v.category, v.mapping, v.sort_order
from (values
  ('Z-5', 'Standby / รอคำสั่งงาน', 'สถานะไม่ได้ผลิต', 'auto', 904),
  ('Z-6', 'ฝึกอบรม',               'สถานะไม่ได้ผลิต', 'auto', 905)
) as v(code, name, category, mapping, sort_order)
where not exists (select 1 from work_types w where w.name = v.name)
  and not exists (select 1 from work_types w where w.code = v.code);
