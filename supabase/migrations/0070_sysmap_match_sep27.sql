-- แผนผังระบบ — เทียบกับระบบที่ลูกค้าใช้จริง (Index.html v8.86 · 2026-09-27)
--
-- สามอย่างที่ระบบจริงมีแต่ของเรายังไม่มี ทั้งหมดเป็นการ "เพิ่ม" ล้วน ๆ
-- ไม่มีการลบหรือเปลี่ยนความหมายของคอลัมน์เดิม โค้ดรุ่นก่อนหน้าจึงยังทำงานได้
-- ตามปกติทุกอย่าง:
--
--   1. โอกาส AI ผูกกับกล่องงาน — ของเขา AI_OPPS ใช้ node id เป็นคีย์อยู่แล้ว
--      แผงรายละเอียดกล่องงานจึงมีแท็บ "โอกาส AI" ได้ ของเราเก็บคีย์เดียวกันไว้
--      แต่ไม่ได้บอกว่ามันคือ node id จึงผูกกลับไม่ได้
--   2. AI ระดับฟังก์ชัน — FUNCTION_AI (ข้อเสนอต่อรหัสฟังก์ชัน) + AI_REGISTRY_FNS
--      (รหัสที่ทะเบียนติดชิปเครื่องมือ AI ให้)
--   3. ชั้นการไหลของเอกสารหน้างาน — DOC_NODES 7 ใบ อยู่คนละชั้นกับผังกระบวนการ
--      จึงเป็นตารางของตัวเอง ไม่ปนกับ 79 กล่องงาน
--
-- จำนวนข้อมูลเดิมไม่เปลี่ยน: 10 เลน · 79 กล่องงาน · 129 เส้นเชื่อม · 7 แผนก
-- · 10 โมดูล · 158 ฟังก์ชัน · 35 โอกาส AI

-- ── 1. โอกาส AI ↔ กล่องงาน ─────────────────────────────────────────────────
-- ไม่ผูก foreign key ไว้: ข้อเสนอ AI อาจพูดถึงงานที่ยังไม่มีกล่องบนผัง และการ
-- ลบกล่องไม่ควรลบข้อเสนอทิ้งไปด้วย ที่หน้าจอถ้าหา node ไม่เจอก็ไม่แสดงแท็บ
alter table sysmap_ai_opps add column if not exists node_id text;
create index if not exists sysmap_ai_opps_node_idx on sysmap_ai_opps (node_id) where node_id is not null;

-- คีย์ของทั้ง 35 รายการคือ node id ของระบบจริงอยู่แล้ว เติมเฉพาะที่ตรงกันจริง
update sysmap_ai_opps a
   set node_id = a.key
 where a.node_id is null
   and exists (select 1 from sysmap_nodes n where n.id = a.key);

-- ── 2. AI ระดับฟังก์ชัน ────────────────────────────────────────────────────
-- in_registry = อยู่ใน AI_REGISTRY_FNS ของเขา คือแถวที่ทะเบียนติดชิปให้เห็น
-- ว่ามีเครื่องมือ AI รองรับ (บางรหัสติดชิปแต่ยังไม่มีคำอธิบาย ก็เก็บไว้ตามนั้น)
create table if not exists sysmap_function_ai (
  code        text primary key,
  desc_en     text not null default '',
  desc_th     text not null default '',
  tool        text not null default '',
  in_registry boolean not null default false
);

insert into sysmap_function_ai (code, desc_en, desc_th, tool, in_registry) values
  ('ACC-01', 'Three-way match invoice to PO receipt/billing; flag duplicates, over-billing, out-of-policy.', 'จับคู่สามทางใบแจ้งหนี้กับรับของ/วางบิล; แจ้งรายการซ้ำ วางบิลเกิน ผิดนโยบาย', 'Cowork + n8n', true),
  ('ACC-02', '', '', '', true),
  ('ACC-03', 'OCR bank transfer slips (requires legible scans), match to expected receipts and draft the posting batch.', 'OCR ใบโอนเงิน (ต้องอ่านได้ชัดเจน) จับคู่กับยอดที่คาดไว้และร่างชุดบันทึกบัญชี', 'Cowork + n8n', false),
  ('ACC-04', 'Draft the client tax invoice from the certified claim, ready for AR posting.', 'ร่างใบกำกับภาษีลูกค้าจากงวดที่รับรอง พร้อมบันทึก AR', 'Claude Cowork', true),
  ('ACC-05', 'Generate the trading / inter-company tax invoice from the IC issue and post to AR.', 'ออกใบกำกับภาษีขายระหว่างกัน/Trading จากการเบิก IC และลง AR', 'Cowork + n8n', false),
  ('ACC-06', 'Match incoming DOH/client payments to open AR and record the receipt.', 'จับคู่เงินรับจากกรมทางหลวง/ลูกค้ากับ AR ที่ค้างและบันทึกใบเสร็จ', 'Cowork + n8n', false),
  ('ACC-07', 'Prioritise overdue receivables, draft reminders and track promised-to-pay dates.', 'จัดลำดับลูกหนี้เกินกำหนด ร่างหนังสือทวงถาม และติดตามวันนัดชำระ', 'Cowork + n8n', true),
  ('ACC-08', 'OCR site receipts into the clear-advance batch (requires legible scans); flag duplicates and out-of-policy items.', 'OCR ใบเสร็จสนาม (ต้องอ่านได้ชัดเจน) เพื่อล้างเงินสดย่อย ชี้รายการซ้ำและผิดนโยบาย', 'Cowork + n8n', true),
  ('ACC-09', 'Compile the advance-payment register by category (Project/JV/Unit/Other), age uncleared advances and flag overdue clears for follow-up.', 'จัดทำทะเบียนเงินทดรองจ่ายแยกประเภท (โครงการ/ร่วมค้า/หน่วยงาน/อื่นๆ) วิเคราะห์อายุเงินทดรองที่ค้าง และแจ้งเตือนรายการเกินกำหนดให้ตามเคลียร์', 'Cowork + n8n', false),
  ('ACC-10', 'Compile the monthly site cost summary (labour, materials, equipment).', 'รวบรวมสรุปต้นทุนหน้างานรายเดือน (แรงงาน วัสดุ เครื่องจักร)', 'Cowork + n8n', true),
  ('ACC-11', 'Draft variance commentary and flag unusual or duplicate journals for accountant review.', 'ร่างคำอธิบายผลต่างและชี้รายการผิดปกติหรือซ้ำซ้อนเพื่อให้นักบัญชีตรวจสอบ', 'Claude Cowork', true),
  ('ACC-12', 'Turn the finance dashboards into a written weekly management insight brief.', 'แปลงแดชบอร์ดการเงินเป็นสรุปข้อมูลเชิงลึกรายสัปดาห์สำหรับผู้บริหาร', 'Cowork + n8n', true),
  ('ACC-13', 'Allocate costs per project/entity and assemble the management cost report.', 'ปันส่วนต้นทุนต่อโครงการ/นิติบุคคลและจัดทำรายงานต้นทุนสำหรับผู้บริหาร', 'Claude Cowork', true),
  ('ACC-14', 'Reconcile the physical stock count against the ERP and surface only exceptions.', 'กระทบยอดการนับสต๊อกจริงกับ ERP และแสดงเฉพาะรายการที่ไม่ตรง', 'Cowork + n8n', true),
  ('ACC-15', 'Reconcile asset additions/disposals and check depreciation schedules.', 'กระทบยอดการเพิ่ม/จำหน่ายทรัพย์สินและตรวจตารางค่าเสื่อม', 'Cowork + n8n', true),
  ('ACC-17', 'Extract VAT data from GL and prepare the PP.30 return for submission.', 'ดึงข้อมูล VAT จาก GL และจัดทำแบบ ภ.พ.30 เพื่อยื่น', 'Cowork + n8n', true),
  ('ACC-18', 'Extract WHT from GL/OF, generate certificates and prepare PND.1/3/53.', 'ดึง WHT จาก GL/OF ออกหนังสือรับรองและจัดทำ ภ.ง.ด.1/3/53', 'Cowork + n8n', true),
  ('ACC-19', 'Prepare the GL input data schedule and flag likely book-tax add-back items for the accountant to review and file.', 'จัดทำตารางข้อมูล GL และชี้รายการปรับปรุงภาษีที่น่าจะเกิดขึ้นเพื่อให้นักบัญชีตรวจสอบและยื่น', 'Claude Cowork', true),
  ('ACC-20', 'Assemble the audit PBC schedules from GL and track open auditor queries.', 'จัดทำตารางเอกสารสำหรับผู้สอบจาก GL และติดตามข้อซักถามที่ค้าง', 'Cowork + n8n', true),
  ('ASSET-FA-01', 'Capture new asset details (cost, life, location, custodian) into the register from purchase docs.', 'บันทึกรายละเอียดทรัพย์สินใหม่ (ต้นทุน อายุ ที่ตั้ง ผู้ดูแล) เข้าทะเบียนจากเอกสารซื้อ', 'Cowork + n8n', false),
  ('ASSET-FA-02', 'Reconcile GPS utilisation per vehicle and compile the fleet usage report.', 'กระทบยอดการใช้งานตาม GPS ต่อคันและจัดทำรายงานการใช้ยานพาหนะ', 'Cowork + n8n', false),
  ('ASSET-FA-03', 'Monitor GPS location/usage across the fleet and flag unauthorised use, idling or anomalies.', 'ติดตามตำแหน่ง/การใช้งาน GPS ทั้งฟลีต และแจ้งการใช้ไม่ได้รับอนุญาต จอดนิ่ง หรือผิดปกติ', 'Cowork + n8n', false),
  ('ASSET-FA-04', 'Schedule preventive services and log corrective repairs per asset; route repair funding via PR → PO, or an OF advance / petty cash when cash is urgent or the scope grows mid-repair.', 'จัดตารางบำรุงรักษาเชิงป้องกันและบันทึกการซ่อมแก้ไขต่อทรัพย์สิน; จัดหาเงินซ่อมผ่าน PR → PO หรือเบิก OF ทดรอง/เงินสดย่อยเมื่อต้องใช้เงินด่วนหรือขอบเขตบานปลายระหว่างซ่อม', 'Cowork + n8n', false),
  ('ASSET-FA-07', 'Track vehicle insurance expiries and prepare the renewal/payment.', 'ติดตามวันหมดประกันรถและจัดทำการต่ออายุ/จ่าย', 'Cowork + n8n', false),
  ('ASSET-FA-08', 'Track road-tax due dates and prepare the payment.', 'ติดตามวันครบภาษีรถและจัดทำการจ่าย', 'Cowork + n8n', false),
  ('ASSET-FA-09', 'Flag underutilised vehicles from GPS/usage and recommend disposal.', 'แจ้งยานพาหนะที่ใช้น้อยจาก GPS/การใช้งานและแนะนำการจำหน่าย', 'Claude Cowork', false),
  ('ASSET-FA-10', 'Generate the gate pass and transfer request and track the asset to its new site.', 'ออกใบผ่านประตูและคำขอโอน และติดตามสินทรัพย์จนถึงไซต์ใหม่', 'Claude Cowork', false),
  ('ASSET-FA-12', 'Prepare the pre-qualification document pack for the Comptroller (CGD); track renewals.', 'จัดชุดเอกสารคุณสมบัติสำหรับกรมบัญชีกลาง (CGD); ติดตามการต่ออายุ', 'Cowork + n8n', false),
  ('ASSET-FA-13', 'Compile the monthly fuel, maintenance and utilisation asset reports.', 'รวบรวมรายงานทรัพย์สินรายเดือน: ค่าน้ำมัน ค่าบำรุงรักษา และการใช้งาน', 'Cowork + n8n', false),
  ('ASSET-IC-02', 'OCR the delivery note at receipt and match to the PO line/quantity.', 'OCR ใบส่งของขณะรับและจับคู่กับรายการ/จำนวน PO', 'Cowork + n8n', false),
  ('ASSET-IC-03', 'Record approved finished segments into IC as finished goods (rejects → write-off).', 'บันทึกชิ้นงานสำเร็จที่อนุมัติเข้า IC เป็นสินค้าสำเร็จรูป (ของเสีย → ตัดจ่าย)', 'Claude Cowork', false),
  ('ASSET-IC-04', 'Reconcile fuel issued vs machine-hours and flag abnormal consumption / possible theft.', 'กระทบยอดน้ำมันที่เบิกเทียบชั่วโมงเครื่องจักรและแจ้งการใช้ผิดปกติ/อาจรั่วไหล', 'Cowork + n8n', false),
  ('ASSET-IC-06', 'Compile the surplus/scrap list, value it and prepare the auction documents.', 'รวบรวมรายการวัสดุเหลือ/เศษซาก ตีมูลค่า และจัดเอกสารประมูล', 'Claude Cowork', false),
  ('ASSET-IC-07', 'Track CAR / liability cover per project; remind on renewals and assemble claim docs.', 'ติดตามประกัน CAR/ความรับผิดต่อโครงการ; เตือนต่ออายุและจัดเอกสารเคลม', 'Cowork + n8n', false),
  ('ASSET-IC-08', 'Reconcile physical counts to the ERP IC/FA registers and flag discrepancies.', 'กระทบยอดการนับจริงกับทะเบียน IC/FA ใน ERP และแจ้งผลต่าง', 'Cowork + n8n', false),
  ('ENG-06', 'Parse the BOQ workbook into the structured project & cost-code setup for Mango import.', 'แปลงไฟล์ BOQ เป็นโครงสร้างโครงการและรหัสต้นทุนสำหรับนำเข้า Mango', 'Claude Code + Cowork', false),
  ('ENG-07', 'Draft the master schedule/S-curve and map it to the Mango import format (work systems, cost codes, งวด, budget) ready to load — removing manual re-keying.', 'ร่าง Master Plan/S-curve และจับคู่เป็นรูปแบบนำเข้า Mango (work system รหัสต้นทุน งวด งบประมาณ) พร้อมโหลด — ลดการคีย์ซ้ำ', 'Claude Code + Cowork', true),
  ('ENG-09', '', '', '', true),
  ('ENG-11', 'Track shop-drawing/submittal status and DOH approval turnaround; flag overdue items.', 'ติดตามสถานะแบบ/เอกสารส่งและการอนุมัติของกรมทางหลวง แจ้งรายการเกินกำหนด', 'Cowork + n8n', true),
  ('ENG-12', 'Maintain the drawing register and flag superseded revisions on site.', 'ดูแลทะเบียนแบบและแจ้งฉบับที่ถูกแทนที่ที่หน้างาน', 'Cowork + n8n', true),
  ('ENG-13', 'Log RFIs, route to the right discipline and track response/closeout time.', 'บันทึก RFI ส่งต่อให้ผู้รับผิดชอบ และติดตามเวลาตอบ/ปิดงาน', 'Cowork + n8n', true),
  ('ENG-14', 'Draft the VO from the change items and reconcile it back to the BOQ for re-approval.', 'ร่าง VO จากรายการเปลี่ยนแปลงและกระทบกับ BOQ เพื่ออนุมัติใหม่', 'Claude Cowork', false),
  ('ENG-15', '', '', '', true),
  ('ENG-17', 'Verify the subcontractor claim vs WO, progress and issued-materials contra before AP.', 'ตรวจสอบการวางบิลผู้รับเหมาช่วงเทียบ WO ความคืบหน้า และวัสดุที่เบิก (contra) ก่อนตั้งหนี้', 'Claude Cowork', true),
  ('ENG-18', 'Capture engineering-overhead invoices and draft the OF payment entry.', 'ดึงใบแจ้งหนี้ค่าใช้จ่ายวิศวกรรมและร่างรายการจ่ายผ่าน OF', 'Claude Cowork', false),
  ('ENG-19', 'Reconcile the final account vs contract + variations and assemble the closeout pack.', 'กระทบยอดบัญชีสุดท้ายเทียบสัญญา+งานเพิ่ม และจัดชุดปิดโครงการ', 'Cowork + n8n', true),
  ('FIN-01', 'Build the per-project cash flow from the Master Plan and assemble the bank credit-facility submission pack.', 'จัดทำกระแสเงินสดรายโครงการจาก Master Plan และจัดชุดเอกสารยื่นขอวงเงินสินเชื่อต่อธนาคาร', 'Cowork + n8n', true),
  ('FIN-02', 'Maintain the monthly cash-expense T-bar across VCB, CVE and the VN JV.', 'ดูแล T-bar ค่าใช้จ่ายเงินสดรายเดือนของ VCB, CVE และ VN JV', 'Cowork + n8n', true),
  ('FIN-03', 'Project credit-facility drawdown and headroom across all bank lines over the plan horizon; output as a decision brief for director review.', 'คาดการณ์การเบิกวงเงินและส่วนเหลือทุกธนาคารตลอดแผน พร้อมสรุปเพื่อให้กรรมการพิจารณา', 'Claude Cowork', true),
  ('FIN-04', 'Prepare a recommendation brief on which bank facility (P/N, AVAL, ML) to draw per payment, ranked by headroom, cost and tenor — for director sign-off.', 'จัดทำสรุปคำแนะนำวงเงินที่ควรเบิก (PN/AVAL/ML) เรียงตามส่วนเหลือ ต้นทุน และอายุ เพื่อกรรมการอนุมัติ', 'Claude Cowork', true),
  ('FIN-05', 'Prepare P/N drawdowns per installment and compare available discount rates.', 'จัดเตรียมการเบิก P/N ต่องวดและเทียบอัตราส่วนลดที่มี', 'Claude Cowork', true),
  ('FIN-06', 'Draft the AVAL/B/E bank form per payee — fill beneficiary, amount and maturity days, flag for CEO signature.', 'ร่างแบบฟอร์มธนาคาร AVAL/B/E ต่อผู้รับเงิน — กรอกผู้รับ จำนวน วันครบกำหนด แจ้งให้ CEO ลงนาม', 'Cowork', false),
  ('FIN-07', 'Track BG contracts (retention/advance), expiries and release; remind ahead of deadlines.', 'ติดตามสัญญา BG (เงินประกัน/ล่วงหน้า) วันหมดอายุและการคืน; เตือนก่อนกำหนด', 'Cowork + n8n', true),
  ('FIN-08', 'Track LC / L/G credit lines and documentation; remind on expiries.', 'ติดตามวงเงิน LC/L/G และเอกสาร; เตือนวันหมดอายุ', 'Cowork + n8n', true),
  ('FIN-09', 'Monitor ML drawdown / repayment schedule and accrue interest.', 'ติดตามการเบิก/ชำระคืน ML และตั้งดอกเบี้ยค้าง', 'Cowork + n8n', true),
  ('FIN-11', 'Assemble the director payment pack (payee, amount, due, funding source) + approval brief.', 'จัดชุดจ่ายให้กรรมการ (ผู้รับเงิน จำนวน ครบกำหนด แหล่งเงิน) พร้อมสรุปอนุมัติ', 'Claude Cowork', true),
  ('FIN-12', '', '', '', true),
  ('FIN-13', 'Track PDC due dates and remind before each cheque clears.', 'ติดตามวันครบกำหนดเช็ค PDC และเตือนก่อนเช็คขึ้นเงิน', 'Cowork + n8n', false),
  ('FIN-14', 'Prepare the iCash bulk payment batch and match it back to ERP entries.', 'จัดชุดจ่าย Bulk ผ่าน iCash และจับคู่กลับรายการใน ERP', 'Cowork + n8n', false),
  ('FIN-15', 'Monitor retention-release conditions, payment terms and interest dates from DOH contracts.', 'ติดตามเงื่อนไขคืนเงินประกัน เงื่อนไขชำระ และวันดอกเบี้ยจากสัญญากรมทางหลวง', 'Cowork + n8n', true),
  ('FIN-16', '', '', '', true),
  ('FIN-17', '', '', '', true),
  ('FIN-18', 'Net and reconcile inter-company/JV balances; flag transfers not yet posted to GL.', 'หักกลบและกระทบยอดยอดระหว่างบริษัท/JV; แจ้งรายการที่ยังไม่ลง GL', 'Cowork + n8n', true),
  ('FIN-19', 'Auto-capture bank fee/interest debits from statements and draft the OF payment entry.', 'ดึงรายการค่าธรรมเนียม/ดอกเบี้ยจาก statement อัตโนมัติและร่างรายการจ่ายผ่าน OF', 'Cowork + n8n', false),
  ('FIN-20', 'Match the ERP ledger to bank statements; auto-clear and surface only exceptions.', 'จับคู่บัญชี ERP กับ Statement ธนาคาร; เคลียร์อัตโนมัติและแสดงเฉพาะรายการที่ไม่ตรง', 'Cowork + n8n', true),
  ('FIN-21', 'Compare discount rates from bank rate inputs in the system; draft the use-of-proceeds memo for CEO sign-off and log utilisation.', 'เปรียบอัตราส่วนลดจากข้อมูลอัตราที่บันทึกไว้ในระบบ ร่างบันทึกวัตถุประสงค์การใช้เงินเพื่อ CEO และบันทึกการใช้วงเงิน', 'Cowork + n8n', false),
  ('FIN-22', 'Auto-select P/N type from certified OF claim, pre-fill bank form (amount, maturity, beneficiary) and flag for CEO signature.', 'เลือกประเภท P/N จากใบเบิกผลงานอัตโนมัติ กรอกแบบฟอร์มธนาคารล่วงหน้า และแจ้งเตือน CEO ลงนาม', 'Cowork', false),
  ('FIN-23', 'Pre-fill the AR Receive Without Invoice form from incoming-transfer notifications (bank credit advice / AVAL sale confirmation / inter-JV request) for one-click RL booking.', 'กรอกแบบฟอร์มรับเงิน AR อัตโนมัติจากการแจ้งยอดธนาคาร/ยืนยันขาย AVAL/คำขอ Inter-JV เพื่อบันทึก RL ได้ทันที', 'Cowork', false),
  ('HR-01', 'Compile headcount plans vs approved budget per project/department.', 'รวบรวมแผนกำลังคนเทียบงบที่อนุมัติต่อโครงการ/แผนก', 'Claude Cowork', false),
  ('HR-02', 'Extract candidate details and check against role criteria; generate the onboarding checklist and first-week plan for approved hires.', 'ดึงข้อมูลผู้สมัครและตรวจสอบกับเกณฑ์ตำแหน่ง จัดทำ checklist เริ่มงานสำหรับผู้ผ่านการคัดเลือก', 'Claude Cowork', false),
  ('HR-03', 'Draft and maintain employment contracts; flag renewals and type changes.', 'ร่างและดูแลสัญญาจ้าง; แจ้งการต่ออายุและการเปลี่ยนประเภท', 'Cowork + n8n', false),
  ('HR-04', 'Prepare payroll from captured attendance/OT, generate payslips, reconcile to AP & SSO/WHT.', 'จัดทำเงินเดือนจากการลงเวลา/OT ออกสลิป และกระทบยอดกับ AP และ SSO/WHT', 'Cowork + n8n', true),
  ('HR-05', 'Collect Doc 08 OT and batch-process for month-end payroll.', 'รวบรวม OT (Doc 08) และจัดชุดประมวลผลเงินเดือนสิ้นเดือน', 'Claude Cowork', true),
  ('HR-06', 'Maintain attendance and leave balances from site sheets.', 'ดูแลข้อมูลการลงเวลาและวันลาจากใบหน้างาน', 'Cowork + n8n', true),
  ('HR-07', 'Generate review templates and summarise KPI/feedback for calibration.', 'สร้างแม่แบบประเมินและสรุป KPI/ข้อเสนอแนะสำหรับการ calibrate', 'Claude Cowork', false),
  ('HR-10', 'Track consent and data-access requests and maintain the PDPA register.', 'ติดตามคำยินยอมและคำขอเข้าถึงข้อมูลและดูแลทะเบียน PDPA', 'Cowork + n8n', false),
  ('HR-12', 'Maintain the org chart and reporting structure from HR data.', 'ดูแลผังองค์กรและโครงสร้างการรายงานจากข้อมูล HR', 'Cowork + n8n', false),
  ('HR-13', 'Compile the monthly SSO contribution from payroll, draft สปส.1-10, and track new-hire/leaver registration deadlines.', 'รวมเงินสมทบประกันสังคมรายเดือนจากเงินเดือน ร่าง สปส.1-10 และติดตามกำหนดขึ้นทะเบียนเข้า/ออก', 'Cowork + n8n', true),
  ('HR-14', 'Track work-permit / visa / 90-day-report expiries per worker and auto-remind before each deadline.', 'ติดตามวันหมดใบอนุญาต/วีซ่า/รายงาน 90 วันรายคน และเตือนอัตโนมัติก่อนกำหนด', 'Cowork + n8n', false),
  ('HR-15', 'Reconcile provident-fund contributions between payroll and the fund manager; flag mismatches.', 'กระทบยอดเงินสมทบกองทุนสำรองเลี้ยงชีพระหว่างเงินเดือนและ บลจ. แจ้งรายการไม่ตรงกัน', 'Cowork + n8n', false),
  ('HR-16', 'Parse attendance & OT sheets into man-days per team/work-type for payroll.', 'แปลงใบลงเวลา/OT เป็นวันทำงานต่อทีม/ประเภทงานสำหรับเงินเดือน', 'Claude Cowork', true),
  ('HR-17', 'Capture daily OT and submit Doc 08 to HQ HR for month-end processing.', 'บันทึก OT รายวันและส่ง Doc 08 ให้ HR สำนักงานใหญ่ประมวลผลสิ้นเดือน', 'Claude Cowork', false),
  ('PM-02', 'Track lease terms, payment dates and camp upkeep; remind on renewal and reinstatement.', 'ติดตามเงื่อนไขและกำหนดจ่ายค่าเช่า และการดูแลแคมป์ เตือนต่ออายุและการส่งคืนพื้นที่', 'Claude Cowork', false),
  ('PM-03', 'Turn survey / setting-out measurements into quantity take-offs for billing.', 'แปลงผลสำรวจ/วางผังเป็นปริมาณงานสำหรับการวางบิล', 'Claude Cowork', true),
  ('PM-04', 'Pre-check every site form for completeness, auto-classify by target HQ department, and track approval status from site PM through to the MD.', 'ตรวจความครบถ้วนของแบบฟอร์มจากไซต์ทุกฉบับ จัดประเภทตามแผนก HQ ปลายทางอัตโนมัติ และติดตามสถานะอนุมัติตั้งแต่ PM ไซต์จนถึงกรรมการผู้จัดการ', 'Claude Cowork', false),
  ('PM-05', '', '', '', true),
  ('PM-06', 'Track each utility/ROW clearance with owner, status and date; flag items blocking work fronts.', 'ติดตามการเคลียร์สาธารณูปโภค/ROW แต่ละรายการพร้อมเจ้าของ สถานะ และวันที่ แจ้งรายการที่ขวางหน้างาน', 'Cowork + n8n', false),
  ('PM-08', 'Log public complaints and EIA obligations with due dates; draft responses and the compliance report.', 'บันทึกข้อร้องเรียนและภาระผูกพัน EIA พร้อมกำหนด ร่างคำตอบและรายงานการปฏิบัติตาม', 'Claude Cowork', false),
  ('PM-09', 'Log daily safety inspections and incidents into the safety report.', 'บันทึกการตรวจความปลอดภัยรายวันและอุบัติการณ์เป็นรายงานความปลอดภัย', 'Claude Cowork', true),
  ('PM-12', 'Log lab results, flag out-of-spec tests, and assemble the DOH material-approval submission pack for engineer review before submission.', 'บันทึกผลทดสอบ ชี้รายการที่ไม่ผ่านเกณฑ์ และรวบรวมชุดขออนุมัติวัสดุ กรมทางหลวง เพื่อวิศวกรตรวจก่อนส่ง', 'Cowork + n8n', false),
  ('PM-13', '', '', '', true),
  ('PM-14', 'Verify subcontractor quantities vs WO / measurement before PM approval.', 'ตรวจปริมาณงานผู้รับเหมาช่วงเทียบ WO/การวัดก่อน PM อนุมัติ', 'Claude Cowork', true),
  ('PM-15', 'Draft the subcontractor advance / retention release request with supporting figures for head-office submission.', 'จัดทำคำขอเบิกเงินล่วงหน้า/คืนเงินประกันผู้รับเหมาช่วงพร้อมตัวเลขประกอบเพื่อส่งสำนักงานใหญ่', 'Claude Cowork', false),
  ('PM-16', 'Compile the daily work log (weather, manpower, equipment, progress) into the report.', 'รวบรวมบันทึกงานประจำวัน (สภาพอากาศ กำลังคน เครื่องจักร ความคืบหน้า) เป็นรายงาน', 'Claude Cowork', false),
  ('PM-17', 'Summarise PM module dashboard data into a concise progress report for head office each งวด period.', 'สรุปข้อมูลแดชบอร์ดโมดูล PM เป็นรายงานความก้าวหน้าสั้นๆ ส่งสำนักงานใหญ่แต่ละงวด', 'Claude Cowork', true),
  ('PM-18', 'Assemble the certified งวด measurement package for hand-off to head office for DOH submission and AR processing.', 'จัดชุดเอกสารวัดปริมาณที่รับรองแล้วเพื่อส่งต่อสำนักงานใหญ่สำหรับยื่นกรมทางหลวงและออกใบแจ้งหนี้', 'Claude Cowork', true),
  ('PM-19', 'Track DOH K-factor, retention % and installment conditions; flag changes affecting the claim.', 'ติดตามค่า K กรมทางหลวง % เงินประกัน และเงื่อนไขงวด; แจ้งการเปลี่ยนที่กระทบการเบิก', 'Cowork + n8n', true),
  ('PM-20', 'Brief the PM before each DOH meeting from current project status; draft minutes and action items afterward.', 'สรุปข้อมูลให้ PM ก่อนประชุมกรมทางหลวงจากสถานะโครงการปัจจุบัน และร่างรายงานการประชุม+รายการติดตามหลังประชุม', 'Claude Cowork', false),
  ('PM-21', 'Maintain the defect / punch-list log and track resolution to closeout.', 'ดูแลบันทึกข้อบกพร่อง/Punch-list และติดตามการแก้ไขจนปิดงาน', 'Cowork + n8n', true),
  ('PM-22', 'Assemble the final 100% completion measurement and handover documentation.', 'จัดทำการวัดงานเสร็จ 100% และเอกสารส่งมอบงาน', 'Claude Cowork', false),
  ('PM-23', 'Track DOH defect notices through the liability period with due-date reminders.', 'ติดตามใบแจ้งข้อบกพร่องกรมทางหลวงตลอดระยะประกันพร้อมเตือนกำหนด', 'Cowork + n8n', true),
  ('PO-01', 'Validate the approved PR against budget and cost code before it proceeds.', 'ตรวจ PR ที่อนุมัติเทียบงบและรหัสต้นทุนก่อนดำเนินการต่อ', 'Claude Cowork', false),
  ('PO-02', 'Auto-draft the PR from the plan shortfall and budget-check before site review.', 'ร่าง PR จากส่วนขาดของแผนและตรวจงบก่อนหน้างานตรวจ', 'Claude Cowork', true),
  ('PO-03', 'Shortlist qualified vendors from the approved vendor list; assemble the quotation request package and comparison set.', 'คัดรายชื่อผู้ขายที่ผ่านการรับรองและรวบรวมชุดเปรียบเทียบใบเสนอราคา', 'Claude Cowork', true),
  ('PO-04', 'Normalise vendor quotes into a comparison vs the BOQ rate and recommend.', 'จัดราคาผู้ขายเป็นตารางเทียบกับราคา BOQ และแนะนำ', 'Claude Cowork', true),
  ('PO-05', 'Assemble the approval pack and draft the vendor contract/LOI from the selected quote.', 'จัดชุดเอกสารอนุมัติและร่างสัญญาผู้ขาย/LOI จากใบเสนอราคาที่เลือก', 'Claude Cowork', true),
  ('PO-06', 'Draft the subcontract from the scope and selected subcontractor; flag stamp-duty due.', 'ร่างสัญญาจ้างจากขอบเขตและผู้รับเหมาที่เลือก แจ้งอากรแสตมป์ที่ต้องชำระ', 'Claude Cowork', true),
  ('PO-08', 'Track expected delivery dates and auto-chase vendors on slippage.', 'ติดตามวันส่งมอบที่คาดและเร่งรัดผู้ขายอัตโนมัติเมื่อล่าช้า', 'Cowork + n8n', false),
  ('PO-09', 'Track import shipments and customs/duty status; reconcile landed cost with the LC.', 'ติดตามการนำเข้าและสถานะศุลกากร/อากร กระทบต้นทุนนำเข้ากับ LC', 'Cowork + n8n', false),
  ('PO-10', '', '', '', true),
  ('PO-11', 'Align material ordering to the Master Plan lead times; flag at-risk deliveries.', 'จัดการสั่งวัสดุให้สอดคล้องเวลานำของ Master Plan; แจ้งการส่งมอบที่เสี่ยง', 'Claude Cowork', false),
  ('PO-12', 'Identify volume-discount / bulk-buy opportunities from upcoming demand.', 'ระบุโอกาสซื้อจำนวนมาก/ส่วนลดปริมาณจากความต้องการที่จะถึง', 'Claude Cowork', false),
  ('PO-15', 'Maintain the approved vendor/subcontractor list with capability, financial and safety scoring.', 'ดูแลบัญชีผู้ขาย/ผู้รับเหมาช่วงที่อนุมัติพร้อมให้คะแนนความสามารถ การเงิน ความปลอดภัย', 'Cowork + n8n', true),
  ('PO-16', 'Classify and maintain the supplier database by tier from spend and performance.', 'จัดและดูแลฐานข้อมูลผู้ขายตามชั้นจากยอดซื้อและผลงาน', 'Cowork + n8n', false),
  ('PO-17', 'Update the weekly material price database from supplier price-change letters.', 'อัปเดตฐานราคาวัสดุรายสัปดาห์จากจดหมายแจ้งปรับราคาผู้ขาย', 'Cowork + n8n', false),
  ('PO-18', 'Monitor supplier award concentration and flag single-supplier dependence (requires consistent supplier naming in ERP).', 'ติดตามการกระจุกตัวของผู้ขายและชี้การพึ่งพาผู้ขายรายเดียว (ต้องมีชื่อผู้ขายสม่ำเสมอใน ERP)', 'Cowork + n8n', false),
  ('PO-19', 'Maintain the supplier blacklist and enforce it across sourcing.', 'ดูแลบัญชีดำผู้ขายและบังคับใช้ในการจัดหา', 'Cowork + n8n', false)
on conflict (code) do update set
  desc_en = excluded.desc_en, desc_th = excluded.desc_th,
  tool = excluded.tool, in_registry = excluded.in_registry;

-- ── 3. ชั้นการไหลของเอกสารหน้างาน (Document Control) ───────────────────────
-- erp_style: direct | deferred | conditional | manual — บอกว่าเอกสารใบนี้ถูก
-- บันทึกเข้า ERP ทันที ทำภายหลัง มีเงื่อนไข หรือคงเป็นแบบฟอร์มมือไว้
create table if not exists sysmap_doc_nodes (
  id           text primary key,
  code         text not null default '',
  dept         text not null default '',
  label_en     text not null,
  label_th     text not null default '',
  sub_en       text not null default '',
  sub_th       text not null default '',
  desc_en      text not null default '',
  desc_th      text not null default '',
  erp_style    text not null default 'manual',
  erp_label_en text not null default '',
  erp_label_th text not null default '',
  items_en     jsonb not null default '[]'::jsonb,
  items_th     jsonb not null default '[]'::jsonb,
  sort_order   int  not null default 0
);

insert into sysmap_doc_nodes
  (id, code, dept, label_en, label_th, sub_en, sub_th, desc_en, desc_th,
   erp_style, erp_label_en, erp_label_th, items_en, items_th, sort_order) values
  ('doc-02a', '02A', 'eng', 'Engineering
Plan Approval', 'อนุมัติแผน
งานวิศวกรรม', 'Site PM → HQ Engineering', 'PM → วิศวกรรม HQ', 'Engineering-work approvals to HQ Engineering — project name, construction (master) plan, personnel plan, machinery plan, and the revenue–expense estimate. Manual form (kept as-is).', '', 'manual', 'kept as manual form', '', '["Approve project name","Construction / master plan","Personnel plan; machinery plan","Revenue–expense estimate"]'::jsonb, '[]'::jsonb, 0),
  ('doc-02b', '02B', 'eng', 'Purchase &
Subcontract Approval', 'ขออนุมัติ
จัดซื้อ/จ้างเหมา', 'Site PM → HQ Engineering', 'PM → วิศวกรรม HQ', 'Approval required when a subcontract or material/equipment purchase has a unit price ABOVE the Master Plan, plus other construction works and price/quantity adjustments. Items at or below the Master Plan no longer need this memo — the PR is raised directly in Mango. Manual form; once approved it becomes a PR (→ PO/WO).', '', 'manual', '→ PR (attach compare price)', '', '["Hire subcontractor — unit price ABOVE Master Plan","Buy chargeable materials/equipment — ABOVE Master Plan","Other construction works","Price / quantity adjustment → then raise PR (attach compare-price)"]'::jsonb, '[]'::jsonb, 1),
  ('doc-02c', '02C', 'eng', 'Engineering
Misc Approval', 'อนุมัติวิศวกรรม
อื่น ๆ', 'Site PM → HQ Engineering', 'PM → วิศวกรรม HQ', 'Assorted engineering approvals that remain manual — change of subcontractor name / machinery rental, problem & obstacle reports, hiring an engineer, and engineer meal-welfare. (Work-certification payment, subcontractor advance and retention refund have moved to ERP — OF / Billing — and the machine-usage report is discontinued.)', '', 'manual', 'kept as manual form', '', '["Change subcontractor name / machinery rental","Problem & obstacle reports","Hire engineer","Engineer meal-welfare allowance"]'::jsonb, '[]'::jsonb, 2),
  ('doc-03', '03', 'eng', 'Subcontractor
Progress Billing', 'เบิก
ค่างานงวด', 'Site PM → HQ Engineering', 'หน่วยงาน → วิศวกรรม HQ (→ OF → AP)', 'Subcontractor / machinery-rental / supplier progress-billing package, in the format set by HQ Engineering. Manual package; the รับวางบิล is then recorded in OF and pulled to AP (APS) for payment.', '', 'manual', '→ OF (รับวางบิล) → AP (APS)', '', '["Subcontractor / rental / supplier billing, per HQ Engineering format","Work Order reference; installment & % complete","Verified measurements and site photos","→ recorded in OF (รับวางบิล) → AP (APS)"]'::jsonb, '[]'::jsonb, 3),
  ('doc-08', '08', 'hr', 'HR / Personnel
Request', 'บุคคล/
ธุรการ', 'Site PM → HQ Office (HR)', 'PM → สำนักงาน HQ (บุคคล)', 'Personnel & office-correspondence requests to HQ Office (HR & สารบรรณ): hiring (excluding engineers) / termination / dismissal, OT-work and accident reports, and visa / work-permit expense requests. Manual form.', '', 'manual', 'kept as manual form', '', '["Hire (non-engineer) / terminate / dismiss staff","OT-work report; accident report","Visa / work-permit expense request","PM signature → HQ Office (HR)"]'::jsonb, '[]'::jsonb, 4),
  ('doc-09', '09', 'acc', 'Petty Cash / Advance
Clearing Evidence', 'เคลียร์เงินสดย่อย/
เงินทดรองจ่าย', 'Site PM → HQ Accounting', 'PM → บัญชี HQ', 'Evidence pack the site submits to HQ Accounting to clear a petty-cash / advance drawdown (Petty Cash, Advance, Clear Advance or Other in OF) — the receipts and supporting documents that substantiate the disbursement. Manual form.', '', 'manual', 'clears OF petty cash / advance', '', '["Receipts / supporting documents for the disbursement","References the OF petty cash / advance document","PM signature","Submitted by site to HQ Accounting to clear the drawdown"]'::jsonb, '[]'::jsonb, 5),
  ('doc-10', '10', 'hr', 'Authorization /
Certification Letter', 'หนังสือมอบอำนาจ/
หนังสือรับรอง', 'Site PM → HQ Office (via Engineering)', 'PM → สำนักงาน HQ (ผ่านวิศวกร)', 'Request for an official letter issued by HQ Office — power of attorney (หนังสือมอบอำนาจ) and certification letters (หนังสือรับรอง), plus bank-guarantee requests for retention release (moved here from form 05). Routed through Engineering. Manual form.', '', 'manual', 'kept as manual form', '', '["Type: power of attorney / certification (หนังสือรับรอง) / bank guarantee","Purpose and recipient","Routed through Engineering","HQ Office issues the letter"]'::jsonb, '[]'::jsonb, 6)
on conflict (id) do update set
  code = excluded.code, dept = excluded.dept,
  label_en = excluded.label_en, label_th = excluded.label_th,
  sub_en = excluded.sub_en, sub_th = excluded.sub_th,
  desc_en = excluded.desc_en, desc_th = excluded.desc_th,
  erp_style = excluded.erp_style,
  erp_label_en = excluded.erp_label_en, erp_label_th = excluded.erp_label_th,
  items_en = excluded.items_en, items_th = excluded.items_th,
  sort_order = excluded.sort_order;
