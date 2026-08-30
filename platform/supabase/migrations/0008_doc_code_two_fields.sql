-- =============================================================================
-- Migration 0008: split doc-code mapping into TWO distinct values.
--
-- A doc code maps to:
--   department      — SHORT dept token that goes INSIDE the doc number
--                     (e.g. 02B → "วิศวะ" → BT/วิศวะ/02B/069)
--   recipient_title — the full title of the addressee for "เรียน"
--                     (e.g. 02B → "ผู้จัดการฝ่ายวิศวกรรม")
--
-- Earlier (0005) we wrongly put the long recipient title into `department`,
-- which leaked into the doc number. This restores the short tokens and adds
-- recipient_title with the real long titles from the client's dropdown.
-- =============================================================================

alter table doc_code_departments
  add column if not exists recipient_title text;

-- Authoritative values (short dept for the number, long title for เรียน).
delete from doc_code_departments;

insert into doc_code_departments (code, department, recipient_title) values
  ('01',  'บริหาร',  'ฝ่ายบริหาร'),
  ('02A', 'วิศวะ',   'ผู้จัดการฝ่ายวิศวกรรม'),
  ('02B', 'วิศวะ',   'ผู้จัดการอาวุโสฝ่ายวิศวกรรม'),
  ('02C', 'ปฏิบัติการ', 'ผู้จัดการอาวุโสฝ่ายปฏิบัติการ'),
  ('03',  'บริหาร',  'ผู้จัดการทั่วไป'),
  ('05',  'การเงิน', 'ฝ่ายการเงิน'),
  ('06',  'พัสดุ',   'ฝ่ายพัสดุทรัพย์สิน'),
  ('09',  'บัญชี',   'ฝ่ายบัญชี'),
  ('10',  'สำนักงาน', 'ขอหนังสือรับรอง');
