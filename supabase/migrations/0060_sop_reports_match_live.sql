-- ═══════════════════════════════════════════════════════════════════════════
-- เมนูเรียกรายงานให้ครบ 23 รายการเท่าระบบจริง
--
-- ระบบที่ลูกค้าใช้อยู่มี 23 รายการ เรานำเข้ามาได้ 21 — ขาดสองรายการพอดี และ
-- เลขลำดับก็ต้องตรงกัน เพราะพนักงานอ้างถึงกันด้วยเลขนี้เวลาสอนงาน
--   #13 IC -> Report -> 2.2  (Stock Card Report)
--   #23 OF -> Report -> 5.1  (Tracking Billing Subcontractor)
-- แถวเดิมตั้งแต่ 13 เป็นต้นไปจึงต้องเลื่อนลงหนึ่งช่องก่อน
-- ═══════════════════════════════════════════════════════════════════════════

-- เลื่อนจากท้ายมาหน้า กันเลขชนกันระหว่างทาง
update sop_reports set case_no = case_no + 1, sort_order = sort_order + 1
 where case_no >= 13;

insert into sop_reports (case_no, scenario_text, report_path, sort_order)
select 13, 'ตรวจสอบรายการเข้า-ออกและจ่ายสินค้าจากคลังทั้งหมด', 'IC -> Report -> 2.2 (Stock Card Report)', 13
 where not exists (select 1 from sop_reports where report_path like 'IC -> Report -> 2.2%');

insert into sop_reports (case_no, scenario_text, report_path, sort_order)
select 23, 'ตรวจสอบสถานะการวางบิลผู้รับเหมา', 'OF -> Report -> 5.1 (Tracking Billing Subcontractor)', 23
 where not exists (select 1 from sop_reports where report_path like 'OF -> Report -> 5.1%');

select setval(pg_get_serial_sequence('sop_reports', 'id'),
              greatest(coalesce((select max(id) from sop_reports), 0), 1));
