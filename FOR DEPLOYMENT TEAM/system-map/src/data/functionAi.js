
/** Verbatim transcription of FUNCTION_AI from the canonical Index.html (v8.86). */
export const FUNCTION_AI = {
  "ENG-06": {
    "en": "Parse the BOQ workbook into the structured project & cost-code setup for Mango import.",
    "th": "แปลงไฟล์ BOQ เป็นโครงสร้างโครงการและรหัสต้นทุนสำหรับนำเข้า Mango",
    "tool": "Claude Code + Cowork"
  },
  "ENG-07": {
    "en": "Draft the master schedule/S-curve and map it to the Mango import format (work systems, cost codes, งวด, budget) ready to load — removing manual re-keying.",
    "th": "ร่าง Master Plan/S-curve และจับคู่เป็นรูปแบบนำเข้า Mango (work system รหัสต้นทุน งวด งบประมาณ) พร้อมโหลด — ลดการคีย์ซ้ำ",
    "tool": "Claude Code + Cowork"
  },
  "ENG-17": {
    "en": "Verify the subcontractor claim vs WO, progress and issued-materials contra before AP.",
    "th": "ตรวจสอบการวางบิลผู้รับเหมาช่วงเทียบ WO ความคืบหน้า และวัสดุที่เบิก (contra) ก่อนตั้งหนี้",
    "tool": "Claude Cowork"
  },
  "ENG-19": {
    "en": "Reconcile the final account vs contract + variations and assemble the closeout pack.",
    "th": "กระทบยอดบัญชีสุดท้ายเทียบสัญญา+งานเพิ่ม และจัดชุดปิดโครงการ",
    "tool": "Cowork + n8n"
  },
  "ENG-12": {
    "en": "Maintain the drawing register and flag superseded revisions on site.",
    "th": "ดูแลทะเบียนแบบและแจ้งฉบับที่ถูกแทนที่ที่หน้างาน",
    "tool": "Cowork + n8n"
  },
  "ENG-13": {
    "en": "Log RFIs, route to the right discipline and track response/closeout time.",
    "th": "บันทึก RFI ส่งต่อให้ผู้รับผิดชอบ และติดตามเวลาตอบ/ปิดงาน",
    "tool": "Cowork + n8n"
  },
  "ENG-11": {
    "en": "Track shop-drawing/submittal status and DOH approval turnaround; flag overdue items.",
    "th": "ติดตามสถานะแบบ/เอกสารส่งและการอนุมัติของกรมทางหลวง แจ้งรายการเกินกำหนด",
    "tool": "Cowork + n8n"
  },
  "PO-09": {
    "en": "Track import shipments and customs/duty status; reconcile landed cost with the LC.",
    "th": "ติดตามการนำเข้าและสถานะศุลกากร/อากร กระทบต้นทุนนำเข้ากับ LC",
    "tool": "Cowork + n8n"
  },
  "ENG-14": {
    "en": "Draft the VO from the change items and reconcile it back to the BOQ for re-approval.",
    "th": "ร่าง VO จากรายการเปลี่ยนแปลงและกระทบกับ BOQ เพื่ออนุมัติใหม่",
    "tool": "Claude Cowork"
  },
  "ACC-20": {
    "en": "Assemble the audit PBC schedules from GL and track open auditor queries.",
    "th": "จัดทำตารางเอกสารสำหรับผู้สอบจาก GL และติดตามข้อซักถามที่ค้าง",
    "tool": "Cowork + n8n"
  },
  "ACC-05": {
    "en": "Generate the trading / inter-company tax invoice from the IC issue and post to AR.",
    "th": "ออกใบกำกับภาษีขายระหว่างกัน/Trading จากการเบิก IC และลง AR",
    "tool": "Cowork + n8n"
  },
  "FIN-13": {
    "en": "Track PDC due dates and remind before each cheque clears.",
    "th": "ติดตามวันครบกำหนดเช็ค PDC และเตือนก่อนเช็คขึ้นเงิน",
    "tool": "Cowork + n8n"
  },
  "ENG-18": {
    "en": "Capture engineering-overhead invoices and draft the OF payment entry.",
    "th": "ดึงใบแจ้งหนี้ค่าใช้จ่ายวิศวกรรมและร่างรายการจ่ายผ่าน OF",
    "tool": "Claude Cowork"
  },
  "PO-05": {
    "en": "Assemble the approval pack and draft the vendor contract/LOI from the selected quote.",
    "th": "จัดชุดเอกสารอนุมัติและร่างสัญญาผู้ขาย/LOI จากใบเสนอราคาที่เลือก",
    "tool": "Claude Cowork"
  },
  "PO-06": {
    "en": "Draft the subcontract from the scope and selected subcontractor; flag stamp-duty due.",
    "th": "ร่างสัญญาจ้างจากขอบเขตและผู้รับเหมาที่เลือก แจ้งอากรแสตมป์ที่ต้องชำระ",
    "tool": "Claude Cowork"
  },
  "PO-08": {
    "en": "Track expected delivery dates and auto-chase vendors on slippage.",
    "th": "ติดตามวันส่งมอบที่คาดและเร่งรัดผู้ขายอัตโนมัติเมื่อล่าช้า",
    "tool": "Cowork + n8n"
  },
  "ACC-07": {
    "en": "Prioritise overdue receivables, draft reminders and track promised-to-pay dates.",
    "th": "จัดลำดับลูกหนี้เกินกำหนด ร่างหนังสือทวงถาม และติดตามวันนัดชำระ",
    "tool": "Cowork + n8n"
  },
  "ASSET-IC-08": {
    "en": "Reconcile physical counts to the ERP IC/FA registers and flag discrepancies.",
    "th": "กระทบยอดการนับจริงกับทะเบียน IC/FA ใน ERP และแจ้งผลต่าง",
    "tool": "Cowork + n8n"
  },
  "ASSET-FA-10": {
    "en": "Generate the gate pass and transfer request and track the asset to its new site.",
    "th": "ออกใบผ่านประตูและคำขอโอน และติดตามสินทรัพย์จนถึงไซต์ใหม่",
    "tool": "Claude Cowork"
  },
  "PM-12": {
    "en": "Log lab results, flag out-of-spec tests, and assemble the DOH material-approval submission pack for engineer review before submission.",
    "th": "บันทึกผลทดสอบ ชี้รายการที่ไม่ผ่านเกณฑ์ และรวบรวมชุดขออนุมัติวัสดุ กรมทางหลวง เพื่อวิศวกรตรวจก่อนส่ง",
    "tool": "Cowork + n8n"
  },
  "PM-17": {
    "en": "Summarise PM module dashboard data into a concise progress report for head office each งวด period.",
    "th": "สรุปข้อมูลแดชบอร์ดโมดูล PM เป็นรายงานความก้าวหน้าสั้นๆ ส่งสำนักงานใหญ่แต่ละงวด",
    "tool": "Claude Cowork"
  },
  "PM-15": {
    "en": "Draft the subcontractor advance / retention release request with supporting figures for head-office submission.",
    "th": "จัดทำคำขอเบิกเงินล่วงหน้า/คืนเงินประกันผู้รับเหมาช่วงพร้อมตัวเลขประกอบเพื่อส่งสำนักงานใหญ่",
    "tool": "Claude Cowork"
  },
  "PM-04": {
    "en": "Pre-check every site form for completeness, auto-classify by target HQ department, and track approval status from site PM through to the MD.",
    "th": "ตรวจความครบถ้วนของแบบฟอร์มจากไซต์ทุกฉบับ จัดประเภทตามแผนก HQ ปลายทางอัตโนมัติ และติดตามสถานะอนุมัติตั้งแต่ PM ไซต์จนถึงกรรมการผู้จัดการ",
    "tool": "Claude Cowork"
  },
  "PM-18": {
    "en": "Assemble the certified งวด measurement package for hand-off to head office for DOH submission and AR processing.",
    "th": "จัดชุดเอกสารวัดปริมาณที่รับรองแล้วเพื่อส่งต่อสำนักงานใหญ่สำหรับยื่นกรมทางหลวงและออกใบแจ้งหนี้",
    "tool": "Claude Cowork"
  },
  "PM-19": {
    "en": "Track DOH K-factor, retention % and installment conditions; flag changes affecting the claim.",
    "th": "ติดตามค่า K กรมทางหลวง % เงินประกัน และเงื่อนไขงวด; แจ้งการเปลี่ยนที่กระทบการเบิก",
    "tool": "Cowork + n8n"
  },
  "PM-21": {
    "en": "Maintain the defect / punch-list log and track resolution to closeout.",
    "th": "ดูแลบันทึกข้อบกพร่อง/Punch-list และติดตามการแก้ไขจนปิดงาน",
    "tool": "Cowork + n8n"
  },
  "PM-16": {
    "en": "Compile the daily work log (weather, manpower, equipment, progress) into the report.",
    "th": "รวบรวมบันทึกงานประจำวัน (สภาพอากาศ กำลังคน เครื่องจักร ความคืบหน้า) เป็นรายงาน",
    "tool": "Claude Cowork"
  },
  "PM-22": {
    "en": "Assemble the final 100% completion measurement and handover documentation.",
    "th": "จัดทำการวัดงานเสร็จ 100% และเอกสารส่งมอบงาน",
    "tool": "Claude Cowork"
  },
  "PM-23": {
    "en": "Track DOH defect notices through the liability period with due-date reminders.",
    "th": "ติดตามใบแจ้งข้อบกพร่องกรมทางหลวงตลอดระยะประกันพร้อมเตือนกำหนด",
    "tool": "Cowork + n8n"
  },
  "PM-02": {
    "en": "Track lease terms, payment dates and camp upkeep; remind on renewal and reinstatement.",
    "th": "ติดตามเงื่อนไขและกำหนดจ่ายค่าเช่า และการดูแลแคมป์ เตือนต่ออายุและการส่งคืนพื้นที่",
    "tool": "Claude Cowork"
  },
  "PM-20": {
    "en": "Brief the PM before each DOH meeting from current project status; draft minutes and action items afterward.",
    "th": "สรุปข้อมูลให้ PM ก่อนประชุมกรมทางหลวงจากสถานะโครงการปัจจุบัน และร่างรายงานการประชุม+รายการติดตามหลังประชุม",
    "tool": "Claude Cowork"
  },
  "PM-06": {
    "en": "Track each utility/ROW clearance with owner, status and date; flag items blocking work fronts.",
    "th": "ติดตามการเคลียร์สาธารณูปโภค/ROW แต่ละรายการพร้อมเจ้าของ สถานะ และวันที่ แจ้งรายการที่ขวางหน้างาน",
    "tool": "Cowork + n8n"
  },
  "PM-08": {
    "en": "Log public complaints and EIA obligations with due dates; draft responses and the compliance report.",
    "th": "บันทึกข้อร้องเรียนและภาระผูกพัน EIA พร้อมกำหนด ร่างคำตอบและรายงานการปฏิบัติตาม",
    "tool": "Claude Cowork"
  },
  "FIN-01": {
    "en": "Build the per-project cash flow from the Master Plan and assemble the bank credit-facility submission pack.",
    "th": "จัดทำกระแสเงินสดรายโครงการจาก Master Plan และจัดชุดเอกสารยื่นขอวงเงินสินเชื่อต่อธนาคาร",
    "tool": "Cowork + n8n"
  },
  "FIN-02": {
    "en": "Maintain the monthly cash-expense T-bar across VCB, CVE and the VN JV.",
    "th": "ดูแล T-bar ค่าใช้จ่ายเงินสดรายเดือนของ VCB, CVE และ VN JV",
    "tool": "Cowork + n8n"
  },
  "FIN-03": {
    "en": "Project credit-facility drawdown and headroom across all bank lines over the plan horizon; output as a decision brief for director review.",
    "th": "คาดการณ์การเบิกวงเงินและส่วนเหลือทุกธนาคารตลอดแผน พร้อมสรุปเพื่อให้กรรมการพิจารณา",
    "tool": "Claude Cowork"
  },
  "FIN-04": {
    "en": "Prepare a recommendation brief on which bank facility (P/N, AVAL, ML) to draw per payment, ranked by headroom, cost and tenor — for director sign-off.",
    "th": "จัดทำสรุปคำแนะนำวงเงินที่ควรเบิก (PN/AVAL/ML) เรียงตามส่วนเหลือ ต้นทุน และอายุ เพื่อกรรมการอนุมัติ",
    "tool": "Claude Cowork"
  },
  "FIN-05": {
    "en": "Prepare P/N drawdowns per installment and compare available discount rates.",
    "th": "จัดเตรียมการเบิก P/N ต่องวดและเทียบอัตราส่วนลดที่มี",
    "tool": "Claude Cowork"
  },
  "FIN-06": {
    "en": "Draft the AVAL/B/E bank form per payee — fill beneficiary, amount and maturity days, flag for CEO signature.",
    "th": "ร่างแบบฟอร์มธนาคาร AVAL/B/E ต่อผู้รับเงิน — กรอกผู้รับ จำนวน วันครบกำหนด แจ้งให้ CEO ลงนาม",
    "tool": "Cowork"
  },
  "FIN-23": {
    "en": "Pre-fill the AR Receive Without Invoice form from incoming-transfer notifications (bank credit advice / AVAL sale confirmation / inter-JV request) for one-click RL booking.",
    "th": "กรอกแบบฟอร์มรับเงิน AR อัตโนมัติจากการแจ้งยอดธนาคาร/ยืนยันขาย AVAL/คำขอ Inter-JV เพื่อบันทึก RL ได้ทันที",
    "tool": "Cowork"
  },
  "FIN-22": {
    "en": "Auto-select P/N type from certified OF claim, pre-fill bank form (amount, maturity, beneficiary) and flag for CEO signature.",
    "th": "เลือกประเภท P/N จากใบเบิกผลงานอัตโนมัติ กรอกแบบฟอร์มธนาคารล่วงหน้า และแจ้งเตือน CEO ลงนาม",
    "tool": "Cowork"
  },
  "FIN-21": {
    "en": "Compare discount rates from bank rate inputs in the system; draft the use-of-proceeds memo for CEO sign-off and log utilisation.",
    "th": "เปรียบอัตราส่วนลดจากข้อมูลอัตราที่บันทึกไว้ในระบบ ร่างบันทึกวัตถุประสงค์การใช้เงินเพื่อ CEO และบันทึกการใช้วงเงิน",
    "tool": "Cowork + n8n"
  },
  "FIN-07": {
    "en": "Track BG contracts (retention/advance), expiries and release; remind ahead of deadlines.",
    "th": "ติดตามสัญญา BG (เงินประกัน/ล่วงหน้า) วันหมดอายุและการคืน; เตือนก่อนกำหนด",
    "tool": "Cowork + n8n"
  },
  "FIN-08": {
    "en": "Track LC / L/G credit lines and documentation; remind on expiries.",
    "th": "ติดตามวงเงิน LC/L/G และเอกสาร; เตือนวันหมดอายุ",
    "tool": "Cowork + n8n"
  },
  "FIN-09": {
    "en": "Monitor ML drawdown / repayment schedule and accrue interest.",
    "th": "ติดตามการเบิก/ชำระคืน ML และตั้งดอกเบี้ยค้าง",
    "tool": "Cowork + n8n"
  },
  "FIN-11": {
    "en": "Assemble the director payment pack (payee, amount, due, funding source) + approval brief.",
    "th": "จัดชุดจ่ายให้กรรมการ (ผู้รับเงิน จำนวน ครบกำหนด แหล่งเงิน) พร้อมสรุปอนุมัติ",
    "tool": "Claude Cowork"
  },
  "ACC-06": {
    "en": "Match incoming DOH/client payments to open AR and record the receipt.",
    "th": "จับคู่เงินรับจากกรมทางหลวง/ลูกค้ากับ AR ที่ค้างและบันทึกใบเสร็จ",
    "tool": "Cowork + n8n"
  },
  "FIN-14": {
    "en": "Prepare the iCash bulk payment batch and match it back to ERP entries.",
    "th": "จัดชุดจ่าย Bulk ผ่าน iCash และจับคู่กลับรายการใน ERP",
    "tool": "Cowork + n8n"
  },
  "FIN-15": {
    "en": "Monitor retention-release conditions, payment terms and interest dates from DOH contracts.",
    "th": "ติดตามเงื่อนไขคืนเงินประกัน เงื่อนไขชำระ และวันดอกเบี้ยจากสัญญากรมทางหลวง",
    "tool": "Cowork + n8n"
  },
  "FIN-18": {
    "en": "Net and reconcile inter-company/JV balances; flag transfers not yet posted to GL.",
    "th": "หักกลบและกระทบยอดยอดระหว่างบริษัท/JV; แจ้งรายการที่ยังไม่ลง GL",
    "tool": "Cowork + n8n"
  },
  "FIN-19": {
    "en": "Auto-capture bank fee/interest debits from statements and draft the OF payment entry.",
    "th": "ดึงรายการค่าธรรมเนียม/ดอกเบี้ยจาก statement อัตโนมัติและร่างรายการจ่ายผ่าน OF",
    "tool": "Cowork + n8n"
  },
  "ACC-01": {
    "en": "Three-way match invoice to PO receipt/billing; flag duplicates, over-billing, out-of-policy.",
    "th": "จับคู่สามทางใบแจ้งหนี้กับรับของ/วางบิล; แจ้งรายการซ้ำ วางบิลเกิน ผิดนโยบาย",
    "tool": "Cowork + n8n"
  },
  "ACC-04": {
    "en": "Draft the client tax invoice from the certified claim, ready for AR posting.",
    "th": "ร่างใบกำกับภาษีลูกค้าจากงวดที่รับรอง พร้อมบันทึก AR",
    "tool": "Claude Cowork"
  },
  "ACC-11": {
    "en": "Draft variance commentary and flag unusual or duplicate journals for accountant review.",
    "th": "ร่างคำอธิบายผลต่างและชี้รายการผิดปกติหรือซ้ำซ้อนเพื่อให้นักบัญชีตรวจสอบ",
    "tool": "Claude Cowork"
  },
  "ACC-19": {
    "en": "Prepare the GL input data schedule and flag likely book-tax add-back items for the accountant to review and file.",
    "th": "จัดทำตารางข้อมูล GL และชี้รายการปรับปรุงภาษีที่น่าจะเกิดขึ้นเพื่อให้นักบัญชีตรวจสอบและยื่น",
    "tool": "Claude Cowork"
  },
  "FIN-20": {
    "en": "Match the ERP ledger to bank statements; auto-clear and surface only exceptions.",
    "th": "จับคู่บัญชี ERP กับ Statement ธนาคาร; เคลียร์อัตโนมัติและแสดงเฉพาะรายการที่ไม่ตรง",
    "tool": "Cowork + n8n"
  },
  "ACC-17": {
    "en": "Extract VAT data from GL and prepare the PP.30 return for submission.",
    "th": "ดึงข้อมูล VAT จาก GL และจัดทำแบบ ภ.พ.30 เพื่อยื่น",
    "tool": "Cowork + n8n"
  },
  "ACC-18": {
    "en": "Extract WHT from GL/OF, generate certificates and prepare PND.1/3/53.",
    "th": "ดึง WHT จาก GL/OF ออกหนังสือรับรองและจัดทำ ภ.ง.ด.1/3/53",
    "tool": "Cowork + n8n"
  },
  "ACC-09": {
    "en": "Compile the advance-payment register by category (Project/JV/Unit/Other), age uncleared advances and flag overdue clears for follow-up.",
    "th": "จัดทำทะเบียนเงินทดรองจ่ายแยกประเภท (โครงการ/ร่วมค้า/หน่วยงาน/อื่นๆ) วิเคราะห์อายุเงินทดรองที่ค้าง และแจ้งเตือนรายการเกินกำหนดให้ตามเคลียร์",
    "tool": "Cowork + n8n"
  },
  "ACC-12": {
    "en": "Turn the finance dashboards into a written weekly management insight brief.",
    "th": "แปลงแดชบอร์ดการเงินเป็นสรุปข้อมูลเชิงลึกรายสัปดาห์สำหรับผู้บริหาร",
    "tool": "Cowork + n8n"
  },
  "ACC-13": {
    "en": "Allocate costs per project/entity and assemble the management cost report.",
    "th": "ปันส่วนต้นทุนต่อโครงการ/นิติบุคคลและจัดทำรายงานต้นทุนสำหรับผู้บริหาร",
    "tool": "Claude Cowork"
  },
  "ACC-14": {
    "en": "Reconcile the physical stock count against the ERP and surface only exceptions.",
    "th": "กระทบยอดการนับสต๊อกจริงกับ ERP และแสดงเฉพาะรายการที่ไม่ตรง",
    "tool": "Cowork + n8n"
  },
  "ACC-15": {
    "en": "Reconcile asset additions/disposals and check depreciation schedules.",
    "th": "กระทบยอดการเพิ่ม/จำหน่ายทรัพย์สินและตรวจตารางค่าเสื่อม",
    "tool": "Cowork + n8n"
  },
  "ACC-03": {
    "en": "OCR bank transfer slips (requires legible scans), match to expected receipts and draft the posting batch.",
    "th": "OCR ใบโอนเงิน (ต้องอ่านได้ชัดเจน) จับคู่กับยอดที่คาดไว้และร่างชุดบันทึกบัญชี",
    "tool": "Cowork + n8n"
  },
  "PO-01": {
    "en": "Validate the approved PR against budget and cost code before it proceeds.",
    "th": "ตรวจ PR ที่อนุมัติเทียบงบและรหัสต้นทุนก่อนดำเนินการต่อ",
    "tool": "Claude Cowork"
  },
  "PO-03": {
    "en": "Shortlist qualified vendors from the approved vendor list; assemble the quotation request package and comparison set.",
    "th": "คัดรายชื่อผู้ขายที่ผ่านการรับรองและรวบรวมชุดเปรียบเทียบใบเสนอราคา",
    "tool": "Claude Cowork"
  },
  "PO-04": {
    "en": "Normalise vendor quotes into a comparison vs the BOQ rate and recommend.",
    "th": "จัดราคาผู้ขายเป็นตารางเทียบกับราคา BOQ และแนะนำ",
    "tool": "Claude Cowork"
  },
  "PO-17": {
    "en": "Update the weekly material price database from supplier price-change letters.",
    "th": "อัปเดตฐานราคาวัสดุรายสัปดาห์จากจดหมายแจ้งปรับราคาผู้ขาย",
    "tool": "Cowork + n8n"
  },
  "PO-18": {
    "en": "Monitor supplier award concentration and flag single-supplier dependence (requires consistent supplier naming in ERP).",
    "th": "ติดตามการกระจุกตัวของผู้ขายและชี้การพึ่งพาผู้ขายรายเดียว (ต้องมีชื่อผู้ขายสม่ำเสมอใน ERP)",
    "tool": "Cowork + n8n"
  },
  "PO-16": {
    "en": "Classify and maintain the supplier database by tier from spend and performance.",
    "th": "จัดและดูแลฐานข้อมูลผู้ขายตามชั้นจากยอดซื้อและผลงาน",
    "tool": "Cowork + n8n"
  },
  "PO-11": {
    "en": "Align material ordering to the Master Plan lead times; flag at-risk deliveries.",
    "th": "จัดการสั่งวัสดุให้สอดคล้องเวลานำของ Master Plan; แจ้งการส่งมอบที่เสี่ยง",
    "tool": "Claude Cowork"
  },
  "PO-12": {
    "en": "Identify volume-discount / bulk-buy opportunities from upcoming demand.",
    "th": "ระบุโอกาสซื้อจำนวนมาก/ส่วนลดปริมาณจากความต้องการที่จะถึง",
    "tool": "Claude Cowork"
  },
  "PO-19": {
    "en": "Maintain the supplier blacklist and enforce it across sourcing.",
    "th": "ดูแลบัญชีดำผู้ขายและบังคับใช้ในการจัดหา",
    "tool": "Cowork + n8n"
  },
  "PO-15": {
    "en": "Maintain the approved vendor/subcontractor list with capability, financial and safety scoring.",
    "th": "ดูแลบัญชีผู้ขาย/ผู้รับเหมาช่วงที่อนุมัติพร้อมให้คะแนนความสามารถ การเงิน ความปลอดภัย",
    "tool": "Cowork + n8n"
  },
  "ASSET-FA-02": {
    "en": "Reconcile GPS utilisation per vehicle and compile the fleet usage report.",
    "th": "กระทบยอดการใช้งานตาม GPS ต่อคันและจัดทำรายงานการใช้ยานพาหนะ",
    "tool": "Cowork + n8n"
  },
  "ASSET-IC-04": {
    "en": "Reconcile fuel issued vs machine-hours and flag abnormal consumption / possible theft.",
    "th": "กระทบยอดน้ำมันที่เบิกเทียบชั่วโมงเครื่องจักรและแจ้งการใช้ผิดปกติ/อาจรั่วไหล",
    "tool": "Cowork + n8n"
  },
  "ASSET-FA-01": {
    "en": "Capture new asset details (cost, life, location, custodian) into the register from purchase docs.",
    "th": "บันทึกรายละเอียดทรัพย์สินใหม่ (ต้นทุน อายุ ที่ตั้ง ผู้ดูแล) เข้าทะเบียนจากเอกสารซื้อ",
    "tool": "Cowork + n8n"
  },
  "ASSET-FA-04": {
    "en": "Schedule preventive services and log corrective repairs per asset; route repair funding via PR → PO, or an OF advance / petty cash when cash is urgent or the scope grows mid-repair.",
    "th": "จัดตารางบำรุงรักษาเชิงป้องกันและบันทึกการซ่อมแก้ไขต่อทรัพย์สิน; จัดหาเงินซ่อมผ่าน PR → PO หรือเบิก OF ทดรอง/เงินสดย่อยเมื่อต้องใช้เงินด่วนหรือขอบเขตบานปลายระหว่างซ่อม",
    "tool": "Cowork + n8n"
  },
  "ASSET-FA-07": {
    "en": "Track vehicle insurance expiries and prepare the renewal/payment.",
    "th": "ติดตามวันหมดประกันรถและจัดทำการต่ออายุ/จ่าย",
    "tool": "Cowork + n8n"
  },
  "ASSET-FA-08": {
    "en": "Track road-tax due dates and prepare the payment.",
    "th": "ติดตามวันครบภาษีรถและจัดทำการจ่าย",
    "tool": "Cowork + n8n"
  },
  "ASSET-FA-09": {
    "en": "Flag underutilised vehicles from GPS/usage and recommend disposal.",
    "th": "แจ้งยานพาหนะที่ใช้น้อยจาก GPS/การใช้งานและแนะนำการจำหน่าย",
    "tool": "Claude Cowork"
  },
  "ASSET-FA-03": {
    "en": "Monitor GPS location/usage across the fleet and flag unauthorised use, idling or anomalies.",
    "th": "ติดตามตำแหน่ง/การใช้งาน GPS ทั้งฟลีต และแจ้งการใช้ไม่ได้รับอนุญาต จอดนิ่ง หรือผิดปกติ",
    "tool": "Cowork + n8n"
  },
  "ASSET-FA-12": {
    "en": "Prepare the pre-qualification document pack for the Comptroller (CGD); track renewals.",
    "th": "จัดชุดเอกสารคุณสมบัติสำหรับกรมบัญชีกลาง (CGD); ติดตามการต่ออายุ",
    "tool": "Cowork + n8n"
  },
  "ASSET-FA-13": {
    "en": "Compile the monthly fuel, maintenance and utilisation asset reports.",
    "th": "รวบรวมรายงานทรัพย์สินรายเดือน: ค่าน้ำมัน ค่าบำรุงรักษา และการใช้งาน",
    "tool": "Cowork + n8n"
  },
  "ASSET-IC-07": {
    "en": "Track CAR / liability cover per project; remind on renewals and assemble claim docs.",
    "th": "ติดตามประกัน CAR/ความรับผิดต่อโครงการ; เตือนต่ออายุและจัดเอกสารเคลม",
    "tool": "Cowork + n8n"
  },
  "ASSET-IC-06": {
    "en": "Compile the surplus/scrap list, value it and prepare the auction documents.",
    "th": "รวบรวมรายการวัสดุเหลือ/เศษซาก ตีมูลค่า และจัดเอกสารประมูล",
    "tool": "Claude Cowork"
  },
  "HR-01": {
    "en": "Compile headcount plans vs approved budget per project/department.",
    "th": "รวบรวมแผนกำลังคนเทียบงบที่อนุมัติต่อโครงการ/แผนก",
    "tool": "Claude Cowork"
  },
  "HR-02": {
    "en": "Extract candidate details and check against role criteria; generate the onboarding checklist and first-week plan for approved hires.",
    "th": "ดึงข้อมูลผู้สมัครและตรวจสอบกับเกณฑ์ตำแหน่ง จัดทำ checklist เริ่มงานสำหรับผู้ผ่านการคัดเลือก",
    "tool": "Claude Cowork"
  },
  "HR-03": {
    "en": "Draft and maintain employment contracts; flag renewals and type changes.",
    "th": "ร่างและดูแลสัญญาจ้าง; แจ้งการต่ออายุและการเปลี่ยนประเภท",
    "tool": "Cowork + n8n"
  },
  "HR-04": {
    "en": "Prepare payroll from captured attendance/OT, generate payslips, reconcile to AP & SSO/WHT.",
    "th": "จัดทำเงินเดือนจากการลงเวลา/OT ออกสลิป และกระทบยอดกับ AP และ SSO/WHT",
    "tool": "Cowork + n8n"
  },
  "HR-05": {
    "en": "Collect Doc 08 OT and batch-process for month-end payroll.",
    "th": "รวบรวม OT (Doc 08) และจัดชุดประมวลผลเงินเดือนสิ้นเดือน",
    "tool": "Claude Cowork"
  },
  "HR-06": {
    "en": "Maintain attendance and leave balances from site sheets.",
    "th": "ดูแลข้อมูลการลงเวลาและวันลาจากใบหน้างาน",
    "tool": "Cowork + n8n"
  },
  "HR-07": {
    "en": "Generate review templates and summarise KPI/feedback for calibration.",
    "th": "สร้างแม่แบบประเมินและสรุป KPI/ข้อเสนอแนะสำหรับการ calibrate",
    "tool": "Claude Cowork"
  },
  "HR-10": {
    "en": "Track consent and data-access requests and maintain the PDPA register.",
    "th": "ติดตามคำยินยอมและคำขอเข้าถึงข้อมูลและดูแลทะเบียน PDPA",
    "tool": "Cowork + n8n"
  },
  "HR-12": {
    "en": "Maintain the org chart and reporting structure from HR data.",
    "th": "ดูแลผังองค์กรและโครงสร้างการรายงานจากข้อมูล HR",
    "tool": "Cowork + n8n"
  },
  "HR-13": {
    "en": "Compile the monthly SSO contribution from payroll, draft สปส.1-10, and track new-hire/leaver registration deadlines.",
    "th": "รวมเงินสมทบประกันสังคมรายเดือนจากเงินเดือน ร่าง สปส.1-10 และติดตามกำหนดขึ้นทะเบียนเข้า/ออก",
    "tool": "Cowork + n8n"
  },
  "HR-14": {
    "en": "Track work-permit / visa / 90-day-report expiries per worker and auto-remind before each deadline.",
    "th": "ติดตามวันหมดใบอนุญาต/วีซ่า/รายงาน 90 วันรายคน และเตือนอัตโนมัติก่อนกำหนด",
    "tool": "Cowork + n8n"
  },
  "HR-15": {
    "en": "Reconcile provident-fund contributions between payroll and the fund manager; flag mismatches.",
    "th": "กระทบยอดเงินสมทบกองทุนสำรองเลี้ยงชีพระหว่างเงินเดือนและ บลจ. แจ้งรายการไม่ตรงกัน",
    "tool": "Cowork + n8n"
  },
  "HR-16": {
    "en": "Parse attendance & OT sheets into man-days per team/work-type for payroll.",
    "th": "แปลงใบลงเวลา/OT เป็นวันทำงานต่อทีม/ประเภทงานสำหรับเงินเดือน",
    "tool": "Claude Cowork"
  },
  "HR-17": {
    "en": "Capture daily OT and submit Doc 08 to HQ HR for month-end processing.",
    "th": "บันทึก OT รายวันและส่ง Doc 08 ให้ HR สำนักงานใหญ่ประมวลผลสิ้นเดือน",
    "tool": "Claude Cowork"
  },
  "ACC-08": {
    "en": "OCR site receipts into the clear-advance batch (requires legible scans); flag duplicates and out-of-policy items.",
    "th": "OCR ใบเสร็จสนาม (ต้องอ่านได้ชัดเจน) เพื่อล้างเงินสดย่อย ชี้รายการซ้ำและผิดนโยบาย",
    "tool": "Cowork + n8n"
  },
  "ACC-10": {
    "en": "Compile the monthly site cost summary (labour, materials, equipment).",
    "th": "รวบรวมสรุปต้นทุนหน้างานรายเดือน (แรงงาน วัสดุ เครื่องจักร)",
    "tool": "Cowork + n8n"
  },
  "PO-02": {
    "en": "Auto-draft the PR from the plan shortfall and budget-check before site review.",
    "th": "ร่าง PR จากส่วนขาดของแผนและตรวจงบก่อนหน้างานตรวจ",
    "tool": "Claude Cowork"
  },
  "ASSET-IC-02": {
    "en": "OCR the delivery note at receipt and match to the PO line/quantity.",
    "th": "OCR ใบส่งของขณะรับและจับคู่กับรายการ/จำนวน PO",
    "tool": "Cowork + n8n"
  },
  "PM-03": {
    "en": "Turn survey / setting-out measurements into quantity take-offs for billing.",
    "th": "แปลงผลสำรวจ/วางผังเป็นปริมาณงานสำหรับการวางบิล",
    "tool": "Claude Cowork"
  },
  "PM-09": {
    "en": "Log daily safety inspections and incidents into the safety report.",
    "th": "บันทึกการตรวจความปลอดภัยรายวันและอุบัติการณ์เป็นรายงานความปลอดภัย",
    "tool": "Claude Cowork"
  },
  "ASSET-IC-03": {
    "en": "Record approved finished segments into IC as finished goods (rejects → write-off).",
    "th": "บันทึกชิ้นงานสำเร็จที่อนุมัติเข้า IC เป็นสินค้าสำเร็จรูป (ของเสีย → ตัดจ่าย)",
    "tool": "Claude Cowork"
  },
  "PM-14": {
    "en": "Verify subcontractor quantities vs WO / measurement before PM approval.",
    "th": "ตรวจปริมาณงานผู้รับเหมาช่วงเทียบ WO/การวัดก่อน PM อนุมัติ",
    "tool": "Claude Cowork"
  }
};
