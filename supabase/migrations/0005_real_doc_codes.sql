-- =============================================================================
-- Migration 0005: Replace doc-code → department mapping with the client's
-- real production values (from the live filter dropdown they actually use).
--
-- Codes 04, 07, 08 are intentionally absent (not used by the client).
-- 02B/02C/03 have distinct titles — NOT all "ผู้จัดการฝ่ายวิศวกรรม".
-- Idempotent: clears the table then inserts the authoritative set.
-- =============================================================================

delete from doc_code_departments;

insert into doc_code_departments (code, department) values
  ('01',  'ฝ่ายบริหาร'),
  ('02A', 'ผู้จัดการฝ่ายวิศวกรรม'),
  ('02B', 'ผู้จัดการอาวุโสฝ่ายวิศวกรรม'),
  ('02C', 'ผู้จัดการอาวุโสฝ่ายปฏิบัติการ'),
  ('03',  'ผู้จัดการทั่วไป'),
  ('05',  'ฝ่ายการเงิน'),
  ('06',  'ฝ่ายพัสดุทรัพย์สิน'),
  ('09',  'ฝ่ายบัญชี'),
  ('10',  'ขอหนังสือรับรอง');
