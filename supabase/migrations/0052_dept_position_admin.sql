-- §2 asks for the employee register to carry a department and a position, and
-- for master data to be added, edited and *retired* — "การเปลี่ยนแปลงต้องมีผล
-- กับข้อมูลในอนาคตเท่านั้น ต้องไม่เปลี่ยนแปลงข้อมูลที่บันทึกย้อนหลังไปแล้ว".
--
-- Retiring is why these columns exist. A department that closes must stop being
-- offered on new records without touching the people already filed under it, so
-- nothing is ever deleted once it has been used — it is switched off.
alter table departments add column if not exists is_active boolean not null default true;
alter table positions   add column if not exists is_active boolean not null default true;

-- A department belongs to one site, and its name is unique within that site;
-- a position belongs to one department. Both were free of any constraint, so
-- "ฝ่ายบุคคล" could exist three times over on the same site and reports would
-- split across the copies.
create unique index if not exists departments_unit_name_uniq on departments (unit_id, name);
create unique index if not exists positions_dept_name_uniq on positions (department_id, name);
create index if not exists departments_active_idx on departments (unit_id) where is_active;
create index if not exists positions_active_idx on positions (department_id) where is_active;
