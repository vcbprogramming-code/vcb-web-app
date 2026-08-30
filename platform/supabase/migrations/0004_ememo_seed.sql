-- =============================================================================
-- Migration 0004: E-Memo seed data
-- Projects (the register chips), doc-code→department mapping, document types.
-- Idempotent: safe to re-run. Edit values to match the real org later.
-- =============================================================================

-- Projects seen in the client's register screenshot. doc_prefix is the token
-- used at the start of the document number (e.g. 'BT/วิศวะ/02B/069').
insert into projects (code, name, doc_prefix, color, sort_order) values
  ('CVE',  'CVE',                     'CVE', '#16a34a', 1),
  ('BV',   'BV',                      'Bv',  '#db2777', 2),
  ('PN4',  'PN4',                     'PN',  '#9333ea', 3),
  ('V&K',  'V&K',                     'VK',  '#0891b2', 4),
  ('EP',   'EP',                      'EP',  '#65a30d', 5),
  ('VK2',  'VK2',                     'BP',  '#7c3aed', 6),
  ('BT1',  'BT1',                     'BT',  '#2563eb', 7),
  ('LPB',  'LPB (Luang Prabang)',     'VC',  '#ea580c', 8)
on conflict (lower(code)) do nothing;

-- Doc-code → department mapping — PLACEHOLDER values.
-- These are superseded by migration 0005, which loads the client's real
-- production mapping. Kept as-is (do not edit applied migrations).
insert into doc_code_departments (code, department) values
  ('01',  'บริหาร'),
  ('02A', 'วิศวะ'),
  ('02B', 'วิศวะ'),
  ('02C', 'วิศวะ'),
  ('03',  'วิศวะ'),
  ('06',  'ทรัพย์สิน-พัสดุ'),
  ('08',  'บุคคล'),
  ('09',  'บัญชี'),
  ('10',  'สำนักงาน')
on conflict (code) do nothing;

-- A few common document types (the "All document types" filter).
insert into document_types (name, sort_order) values
  ('ขออนุมัติซื้อ',        1),
  ('ขออนุมัติว่าจ้าง',      2),
  ('ขออนุมัติเช่า',        3),
  ('ขออนุมัติซ่อมบำรุง',    4),
  ('ขออนุมัติปรับราคา',     5),
  ('ขอหนังสือรับรอง',      6),
  ('อื่นๆ',               99)
on conflict (name) do nothing;
