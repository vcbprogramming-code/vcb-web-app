-- Two Thai app names in portal.apps were wrong in ways that matter to a reader.
--
-- SOP said "ระเบียบปฏิบัติมาตรฐาน ERP". The SOPs are not exclusive to the ERP —
-- naming one system in the label makes the other procedures look out of scope.
--
-- E-Memo said "ระบบบันทึกข้อความอิเล็กทรอนิกส์", which is the literal expansion of
-- "electronic memo system". It is long enough to be truncated in the portal
-- sidebar, where it rendered as "ระบบบันทึกข้อความอิเล็กทรอ…" and told a reader
-- nothing the short form does not.
--
-- Idempotent: matches on key, and re-running sets the same values.

update portal.apps
   set name_th = 'ระเบียบปฏิบัติงานมาตรฐาน'
 where key = 'sop';

update portal.apps
   set name_th = 'ระบบอีเมโม'
 where key = 'ememo';
