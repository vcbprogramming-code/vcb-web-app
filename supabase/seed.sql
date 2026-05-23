-- =============================================================================
-- Seed data — sample 5 business units (หน่วยงาน) and a few departments.
-- Edit the names to match the real org chart from the client.
-- Safe to re-run: uses ON CONFLICT on the unique code.
-- =============================================================================

insert into units (name, code) values
  ('หน่วยงานที่ 1', 'U1'),
  ('หน่วยงานที่ 2', 'U2'),
  ('หน่วยงานที่ 3', 'U3'),
  ('หน่วยงานที่ 4', 'U4'),
  ('หน่วยงานที่ 5', 'U5')
on conflict (code) do nothing;

-- Example departments under unit U1
insert into departments (unit_id, name)
select u.id, d.name
from units u
cross join (values ('ฝ่ายบุคคล'), ('ฝ่ายบัญชี'), ('ฝ่ายจัดซื้อ')) as d(name)
where u.code = 'U1'
on conflict (unit_id, name) do nothing;
