-- sop_reports.case_no is NOT a foreign key to sop_scenarios.
--
-- The client's export declares `case_no integer NOT NULL REFERENCES scenarios(no)`
-- and 0037 copied that, but their own authoring UI treats the field as a plain
-- running number the editor types in (it defaults to "last + 1"). The imported
-- values happen to be 1..21, which satisfied the constraint by coincidence — the
-- linked "cases" are unrelated to the reports (report #1 is an AP cheque report;
-- case 1 is a PO purchasing case). Presenting it as a link would show users a
-- wrong reference, and the constraint would reject a legitimate next number as
-- soon as the register grew past the case count.
alter table sop_reports drop constraint if exists sop_reports_case_no_fkey;

comment on column sop_reports.case_no is
  'ลำดับที่ในทะเบียนเมนูรายงาน (running number ที่ผู้ดูแลกรอกเอง) — ไม่ได้อ้างอิงกรณีศึกษา';
