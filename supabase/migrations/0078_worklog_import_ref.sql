-- ═══════════════════════════════════════════════════════════════════════════
-- บันทึกงานฝ่ายบุคคล — กุญแจอ้างกลับไปยังแถวต้นทางของระบบที่ลูกค้าใช้จริง
--
-- การนำเข้าทะเบียนพนักงานจริง (scripts/import-live-worklog.mjs) ต้องรันซ้ำได้
-- โดยไม่เกิดแถวซ้ำ บันทึกงานมีกุญแจธรรมชาติอยู่แล้ว (พนักงาน × วันที่ — ดัชนี
-- unique บน work_logs) แต่ "พนักงาน" ของเขาไม่มี:
--
--   • รหัสพนักงานของเขาซ้ำกันจริง 35 รหัส (70 แถว) — คนเดียวกันถูกลงทะเบียน
--     สองไซต์ และมีกรณีที่รหัสเดียวกันเป็นคนละคนด้วย ของเราบังคับ employee_code
--     ไม่ซ้ำ (employees_employee_code_key) จึงใช้รหัสพนักงานเป็นกุญแจไม่ได้
--   • ชื่อซ้ำกันได้ และสะกดต่างกันระหว่างไซต์ ("นายวิเชษ ทัดศรี" / "นาย วิเชษ ทัดศรี")
--
-- กุญแจเดียวที่ระบบของเขารับประกันว่าไม่ซ้ำคือ (ไซต์, eid) — eid คือเลขแถวใน
-- ทะเบียนของเขา คงที่ตลอดอายุของแถว จึงเก็บคู่นั้นไว้ตรง ๆ
--
-- ทั้งสามคอลัมน์เป็น null ได้ ไม่มีค่าตั้งต้น และไม่มีโค้ดเดิมบรรทัดใดอ่านหรือ
-- เขียนมันเลย พนักงานที่คนกรอกผ่านหน้าจอจึงเป็น null เหมือนเดิมทุกแถว
-- (เซิร์ฟเวอร์ dev รัน migration กับฐานข้อมูลจริง — ห้ามมี ALTER ที่โค้ดรุ่นก่อน
--  รับไม่ได้)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── พนักงาน: กุญแจต้นทาง (ไซต์, eid) ───────────────────────────────────────
alter table employees add column if not exists live_site_key text;
alter table employees add column if not exists live_eid      int;

-- รหัสพนักงานจริงของเขา เก็บครบทุกแถวโดยไม่ถูกเติมตัวแยก
--
-- employee_code ต้องไม่ซ้ำ ดังนั้นแถวที่สองของรหัสที่ซ้ำกันจะถูกเก็บเป็น
-- "<รหัส>#<eid>" (เช่น 3601824#291) เพื่อไม่ให้ต้องทิ้งคนออกจากทะเบียน
-- คอลัมน์นี้คือรหัสจริงล้วน ๆ ไม่มีตัวแยก — รายงานที่ต้องรวมยอดตามรหัสพนักงาน
-- ของเขาจึงอ่านคอลัมน์นี้ ไม่ใช่ employee_code
alter table employees add column if not exists live_emp_code text;

-- การนำเข้าอ่านคู่นี้ทีละแถวเพื่อตัดสินว่าจะ insert หรือ update และดัชนี unique
-- กันการนำเข้าซ้ำซ้อนไว้ที่ชั้นฐานข้อมูล (บางส่วน — แถวที่ไม่ได้มาจากการนำเข้า
-- เป็น null ทั้งคู่ จึงไม่ถูกดัชนีนี้แตะเลย)
create unique index if not exists employees_live_ref_uniq
  on employees (live_site_key, live_eid)
  where live_site_key is not null and live_eid is not null;
create index if not exists employees_live_emp_code_idx
  on employees (live_emp_code) where live_emp_code is not null;

comment on column employees.live_site_key is
  'คีย์ไซต์ในระบบเดิมของลูกค้า (bangtoei, phutthamonthon, …) · null = พนักงานที่สร้างในระบบเรา';
comment on column employees.live_eid is
  'eid ของแถวพนักงานในระบบเดิม · คู่กับ live_site_key เป็นกุญแจกันข้อมูลซ้ำใน scripts/import-live-worklog.mjs';
comment on column employees.live_emp_code is
  'รหัสพนักงานจริงจากทะเบียนของลูกค้า (ซ้ำกันได้) · employee_code อาจถูกเติม "#<eid>" เมื่อรหัสซ้ำ';

-- ── คำขอลา: id ของแถวต้นทาง ────────────────────────────────────────────────
-- คำขอลาไม่มีกุญแจธรรมชาติเลย: คนเดียวกันยื่นช่วงวันเดียวกันได้หลายใบ และใน
-- ข้อมูลจริงก็มีอยู่ (eid 27 ยื่น 17–18 ส.ค. สองใบ ผลต่างกัน) จึงต้องเก็บ id
-- ของแถวต้นทางไว้ ("5", "LV20260819180459-883", "1.78714E+15" — รูปแบบไม่แน่นอน
-- เพราะต้นทางเป็นสเปรดชีต จึงเก็บเป็นข้อความตามที่เขาส่งมา ไม่แปลงเป็นเลข)
alter table leave_requests add column if not exists source_id text;
create index if not exists leave_requests_source_id_idx
  on leave_requests (source_id) where source_id is not null;

comment on column leave_requests.source_id is
  'id ของคำขอลาในระบบเดิมของลูกค้า · null = คำขอที่ยื่นในระบบเรา · กุญแจกันข้อมูลซ้ำใน scripts/import-live-worklog.mjs';
