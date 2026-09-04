// The credit module's dictionary, merged over commonDictionary by I18nProvider.
//
// ---------------------------------------------------------------------------
// Where these strings come from, and why they are not retranslated.
// ---------------------------------------------------------------------------
// The Apps Script app had no keys. It rendered Thai directly into the DOM and
// then, when the user picked English, walked the tree with a MutationObserver
// swapping Thai text nodes for English via a longest-match-first lookup table
// (I18N_DICT / I18N_EXTRA in src/app/legacy.js). That worked, but it meant the
// Thai string WAS the key: any edit to the copy silently broke the English.
//
// Here each pair gets a stable dot key, and the `th` side is the exact Thai
// that app already shipped — carried across character for character, including
// its spacing, its ellipses (…) and its em dashes (—). The `en` side is the
// English that same table already supplied. Neither side is improved,
// re-worded, or re-translated: this is a port, and the Thai copy is the copy
// the finance team reads today.
//
// Thai is the default language (shared/src/i18n.jsx).
//
// Status values are deliberately absent from the value side of the write path:
// 'คำขอใหม่' and the rest are stored in the database and validated by Zod in
// api/src/routes/credit.js, so lib/domain.js holds them as data. The
// status.* keys below are only the labels rendered for those values.

import { createDictionary } from '@vcb/shared';

export const dictionary = createDictionary({
  /* ---------------------------------- app --------------------------------- */
  'app.title': { th: 'ระบบวงเงินสินเชื่อ', en: 'Credit Facility Manager' },
  'app.subtitle': {
    th: 'ติดตามวงเงินสินเชื่อทุกโครงการ',
    en: 'Track credit facilities across all projects',
  },
  'app.backToPortal': { th: 'กลับไปหน้าหลัก VCB Connect', en: 'Back to VCB Connect home' },
  'app.manager': { th: 'ผู้บริหาร', en: 'Manager' },
  'app.noUser': { th: 'ยังไม่ระบุผู้ใช้', en: 'No user identified' },
  'app.guest': { th: 'ผู้เยี่ยมชม', en: 'Guest' },
  'app.loadingData': { th: 'กำลังโหลดข้อมูล…', en: 'Loading data…' },
  'app.loadFailed': { th: 'โหลดไม่สำเร็จ:', en: 'Load failed:' },
  'app.loadDataFailed': { th: 'โหลดข้อมูลไม่สำเร็จ:', en: 'Failed to load data:' },

  /* --------------------------------- tabs --------------------------------- */
  'tab.facilities': { th: 'วงเงินสินเชื่อ', en: 'Credit Facilities' },
  'tab.facilitiesHint': { th: '(Facilities)', en: '' },
  'tab.ledger': { th: 'รายการสินเชื่อ', en: 'Credit Ledger' },
  'tab.ledgerHint': { th: '(Credit Ledger)', en: '' },
  'tab.cost': { th: 'สรุปค่าใช้จ่าย', en: 'Cost summary' },
  'tab.plan': { th: 'แผนการเงิน', en: 'Cash Plan' },
  'tab.planHint': { th: '(T-bar)', en: '(T-bar)' },
  'tab.planDevNote': {
    th: 'อยู่ระหว่างการพัฒนา',
    en: 'Under development',
  },
  'tab.actual': { th: 'หักค่างานตามจริง', en: 'Actual deductions' },
  'tab.variance': { th: 'ผลต่าง', en: 'Variance' },
  'tab.varianceHint': { th: '(Variance)', en: '' },

  /* -------------------------------- filters ------------------------------- */
  'filter.company': { th: 'บริษัท', en: 'Company' },
  'filter.allCompanies': { th: 'ทุกบริษัท', en: 'All companies' },
  'filter.facilityType': { th: 'ประเภทวงเงิน', en: 'Facility type' },
  'filter.allTypes': { th: 'ทุกประเภท', en: 'All types' },
  'filter.project': { th: 'โครงการ', en: 'Project' },
  'filter.allProjects': { th: 'ทุกโครงการ', en: 'All projects' },
  'filter.period': { th: 'ระยะเวลา', en: 'Time period' },
  'filter.allPeriods': { th: 'ทุกระยะเวลา', en: 'All periods' },
  'filter.due7': { th: 'ครบใน 7 วัน', en: 'Due within 7 days' },
  'filter.thisMonth': { th: 'เดือนนี้', en: 'This month' },
  'filter.nextMonth': { th: 'เดือนหน้า', en: 'Next month' },
  'filter.overdue': { th: 'เกินกำหนด', en: 'Overdue' },
  'filter.status': { th: 'สถานะ', en: 'Status' },
  'filter.allStatuses': { th: 'ทุกสถานะ', en: 'All statuses' },
  'filter.search': { th: 'ค้นหา…', en: 'Search…' },
  'filter.searchTitle': {
    th: 'ค้นหา รหัส / รายละเอียด / ผู้รับเงิน',
    en: 'Search by code / details / payee',
  },

  /* -------------------------------- statuses ------------------------------ */
  'status.new': { th: 'คำขอใหม่', en: 'New' },
  'status.pending': { th: 'อยู่ระหว่างเสนออนุมัติ', en: 'Pending approval' },
  'status.approved': { th: 'อนุมัติแล้ว', en: 'Approved' },
  'status.settled': { th: 'ชำระแล้ว', en: 'Settled' },
  'status.void': { th: 'ยกเลิก', en: 'Cancelled' },
  'status.newOpt': { th: '🔵 คำขอใหม่', en: '🔵 New' },
  'status.pendingOpt': { th: '🟡 อยู่ระหว่างเสนออนุมัติ', en: '🟡 Pending approval' },
  'status.approvedOpt': { th: '🟢 อนุมัติแล้ว', en: '🟢 Approved' },
  'status.settledOpt': { th: '✅ ชำระแล้ว (ปิดรายการ)', en: '✅ Settled (closed)' },

  /* -------------------------------- actions ------------------------------- */
  'action.addRequest': { th: '＋ เพิ่มคำขอสินเชื่อ', en: '＋ Add credit request' },
  'action.addTxn': { th: '＋ บันทึกการใช้วงเงิน', en: '＋ Record facility usage' },
  'action.exportExcel': { th: '📥 Export Excel', en: '📥 Export Excel' },
  'action.export': { th: '📥 ส่งออก', en: '📥 Export' },
  'action.save': { th: '💾 บันทึก', en: '💾 Save' },
  'action.delete': { th: '🗑 ลบ', en: '🗑 Delete' },
  'action.edit': { th: '✏️ แก้ไข', en: '✏️ Edit' },
  'action.view': { th: 'ดู', en: 'View' },
  'action.settle': { th: 'ชำระ', en: 'Settle' },
  'action.adjust': { th: 'ปรับ', en: 'Adjust' },
  'action.moveUp': { th: 'ย้ายขึ้น', en: 'Move up' },
  'action.moveDown': { th: 'ย้ายลง', en: 'Move down' },

  /* -------------------------------- request ------------------------------- */
  'req.add': { th: 'เพิ่มคำขอสินเชื่อ', en: 'Add credit request' },
  'req.edit': { th: 'แก้ไขคำขอ', en: 'Edit request' },
  'req.creditType': { th: 'ประเภทสินเชื่อ', en: 'Credit type' },
  'req.amountTHB': { th: 'จำนวนเงิน (บาท)', en: 'Amount (THB)' },
  'req.selectCompany': { th: '— เลือกบริษัท —', en: '— Select company —' },
  'req.selectProject': { th: '— เลือกโครงการ —', en: '— Select project —' },
  'req.selectType': { th: '— เลือกประเภท —', en: '— Select type —' },
  'req.startDate': { th: 'วันที่เริ่ม', en: 'Start date' },
  'req.days': { th: 'จำนวนวัน', en: 'Days' },
  'req.daysPlaceholder': { th: 'เช่น 120', en: 'e.g. 120' },
  'req.dueDate': { th: 'วันครบกำหนด', en: 'Due date' },
  'req.beneficiary': { th: 'ผู้รับผลประโยชน์', en: 'Beneficiary' },
  'req.beneficiaryPlaceholder': {
    th: 'เช่น บริษัท สิริวัฒน์ ค้าเหล็ก จำกัด',
    en: 'e.g. Siriwat Steel Trading Co., Ltd.',
  },
  'req.refDocNo': { th: 'เลขที่เอกสารอ้างอิง', en: 'Reference doc no.' },
  'req.refDocNoPlaceholder': {
    th: 'เช่น PO:20260000170 / BT-001/69',
    en: 'e.g. PO:20260000170 / BT-001/69',
  },
  'req.refDocRange': { th: 'วันที่เอกสารอ้างอิง (ช่วง)', en: 'Reference doc date (range)' },
  'req.dmyTo': { th: 'dd/mm/yyyy — ถึง', en: 'dd/mm/yyyy — to' },
  'req.attachStatus': { th: 'เอกสารแนบ & สถานะ', en: 'Attachment & status' },
  'req.attachment': { th: 'เอกสารแนบ (อีเมล / แหล่งที่มา)', en: 'Attachment (email / source)' },
  'req.attachmentPlaceholder': {
    th: 'เช่น อีเมล จาก คุณ… / แหล่งที่มา',
    en: 'e.g. email from… / source',
  },
  'req.costCategory': { th: 'หมวดค่าใช้จ่าย', en: 'Cost category' },
  'req.costCategoryPlaceholder': {
    th: 'เช่น ทราย / ค่าแรง / คอนกรีต',
    en: 'e.g. sand / labor / concrete',
  },
  'req.attachRange': { th: 'วันที่เอกสารแนบ (ช่วง)', en: 'Attachment date (range)' },
  'req.note': { th: 'หมายเหตุ', en: 'Note' },
  'req.notePlaceholder': { th: 'รายละเอียดเพิ่มเติม…', en: 'Additional details…' },
  'req.noMatchUseTyped': {
    th: '— ไม่มีรายการที่ตรง — ใช้คำที่พิมพ์เอง',
    en: '— No matches — use the typed text',
  },
  'req.fillRequired': {
    th: 'กรอกข้อมูลที่จำเป็น (*) ให้ครบ',
    en: 'Please fill in all required (*) fields',
  },
  'req.attachDateFormat': {
    th: 'วันที่เอกสารแนบต้องเป็นรูปแบบ dd/mm/yyyy',
    en: 'Attachment date must be in dd/mm/yyyy format',
  },
  'req.refDateFormat': {
    th: 'วันที่เอกสารอ้างอิงต้องเป็นรูปแบบ dd/mm/yyyy',
    en: 'Reference doc date must be in dd/mm/yyyy format',
  },
  'req.updated': { th: 'แก้ไขคำขอแล้ว', en: 'Request updated' },
  'req.saved': { th: 'บันทึกคำขอแล้ว', en: 'Request saved' },
  'req.none': { th: 'ยังไม่มีคำขอสินเชื่อ', en: 'No credit requests yet' },
  'req.linkedTxn': { th: '↳ บันทึกใช้วงเงินแล้ว', en: '↳ Facility usage recorded' },
  'req.date': { th: 'วันที่ขอ', en: 'Request date' },
  'req.noAvailData': {
    th: 'ไม่มีข้อมูลวงเงินคงเหลือสำหรับโครงการ/ประเภทนี้',
    en: 'No remaining-facility data for this project/type',
  },
  'req.overLimit': { th: 'เกินวงเงินคงเหลือ', en: 'Exceeds remaining facility' },
  'req.afterThis': { th: 'หลังคำขอนี้เหลือ', en: 'after this request' },

  /* ------------------------------ transaction ----------------------------- */
  'txn.record': { th: 'บันทึกการใช้วงเงิน', en: 'Record facility usage' },
  'txn.amountNegHint': {
    th: 'จำนวนเงิน (บาท) — ใส่ค่าลบเมื่อปลด/คืนวงเงิน',
    en: 'Amount (THB) — enter a negative value to release/return the facility',
  },
  'txn.refNo': { th: 'เลขที่อ้างอิง', en: 'Reference no.' },
  'txn.refNoPlaceholder': { th: 'เช่น BT-001/69', en: 'e.g. BT-001/69' },
  'txn.detailsParty': { th: 'รายละเอียด / คู่ค้า', en: 'Details / counterparty' },
  'txn.details': { th: 'รายละเอียดรายการสินเชื่อ', en: 'Credit item details' },
  'txn.saved': { th: 'บันทึกรายการแล้ว', en: 'Transaction saved' },
  'txn.none': { th: 'ไม่มีรายการเคลื่อนไหว', en: 'No transactions' },
  'txn.settledOn': { th: 'ชำระเมื่อ', en: 'Settled on' },
  'txn.deleted': { th: 'ลบรายการแล้ว', en: 'Item deleted' },
  'txn.closed': { th: 'ปิดรายการแล้ว', en: 'Item closed' },
  'txn.confirmApprove': {
    th: 'ยืนยันอนุมัติรายการนี้? วงเงินจะถูกนับเป็นใช้ไปและดอกเบี้ยจะเริ่มเดิน',
    en: 'Confirm approval of this item? The amount will count as used and interest will start accruing',
  },
  'txn.confirmDelete': {
    th: 'ลบรายการนี้? วงเงินที่ใช้ไปจะถูกปล่อยคืน',
    en: 'Delete this item? The used amount will be released',
  },
  'txn.confirmSettle': {
    th: 'ยืนยันชำระ/ปิดรายการนี้? วงเงินจะถูกปล่อยคืนและดอกเบี้ยจะหยุดเดิน',
    en: 'Confirm settling/closing this item? The facility will be released and interest will stop accruing',
  },

  /* ------------------------------- facilities ----------------------------- */
  'fac.none': { th: 'ไม่มีข้อมูลวงเงินตามเงื่อนไข', en: 'No facilities match the filters' },
  'fac.type': { th: 'ประเภท', en: 'Type' },
  'fac.used': { th: 'ใช้ไป', en: 'Used' },
  'fac.remaining': { th: 'คงเหลือ', en: 'Remaining' },
  'fac.utilization': { th: 'การใช้', en: 'Utilization' },
  'fac.overrideNote': {
    th: 'ตั้งเอง (override) — ไม่ได้คำนวณจากรายการ',
    en: 'Manual override — not calculated from items',
  },
  'fac.adjust': { th: 'ปรับวงเงิน / ใช้ไป', en: 'Adjust limit / used' },
  'fac.limitTHB': { th: 'วงเงิน (บาท)', en: 'Limit (THB)' },
  'fac.usedTHB': { th: 'ใช้ไป (บาท)', en: 'Used (THB)' },
  'fac.usedBlankHint': {
    th: '— เว้นว่างเพื่อใช้ค่าที่คำนวณอัตโนมัติจากรายการ',
    en: '— leave blank to use the value auto-calculated from the items',
  },
  'fac.badLimit': { th: 'กรอกวงเงินให้ถูกต้อง', en: 'Enter a valid limit' },
  'fac.badUsed': { th: 'กรอกยอดใช้ไปให้ถูกต้อง', en: 'Enter a valid used amount' },
  'fac.adjusted': { th: 'ปรับเรียบร้อย', en: 'Adjusted successfully' },
  'fac.usedPct': { th: 'ใช้ไปแล้ว', en: 'Used' },
  'fac.available': { th: 'คงเหลือใช้ได้', en: 'Available' },

  /* ------------------------------- dashboard ------------------------------ */
  'dash.title': { th: 'แดชบอร์ด', en: 'Dashboard' },
  'dash.creditLines': { th: 'วงเงินสินเชื่อ / Credit lines', en: 'Credit lines' },
  'dash.longTerm': {
    th: 'วงเงินสินเชื่อ (วงเงินกู้ระยะยาว)',
    en: 'Credit lines (Long-term loans)',
  },
  'dash.revolving': { th: 'วงเงินสินเชื่อ (วงเงินหมุนเวียน)', en: 'Credit lines (Revolving)' },
  'dash.noData': { th: '— ไม่มีข้อมูล', en: '— No data' },
  'dash.reqStatus': { th: 'สถานะคำขอ', en: 'Request status' },
  'dash.statusAndDue': { th: 'สถานะ & ครบกำหนด', en: 'Status & due dates' },
  'dash.dueThisMonth': { th: 'ครบกำหนด — เดือนนี้', en: 'Due — this month' },
  'dash.dueNextMonth': { th: 'ครบกำหนด — เดือนหน้า', en: 'Due — next month' },
  'dash.newProposedApproved': { th: 'ใหม่ / เสนอ / อนุมัติ', en: 'New / Proposed / Approved' },
  'dash.viewList': { th: 'ดูรายการ →', en: 'View list →' },
  'dash.new': { th: 'ใหม่', en: 'New' },
  'dash.proposed': { th: 'เสนอ', en: 'Proposed' },
  'dash.approved': { th: 'อนุมัติ', en: 'Approved' },
  'dash.viewDue7': { th: 'ดูรายการครบกำหนดใน 7 วัน', en: 'View items due within 7 days' },
  'dash.viewDueThis': { th: 'ดูรายการครบกำหนดเดือนนี้', en: 'View items due this month' },
  'dash.viewDueNext': { th: 'ดูรายการครบกำหนดเดือนหน้า', en: 'View items due next month' },
  'dash.viewAll': { th: 'ดูรายการสินเชื่อทั้งหมด', en: 'View all credit items' },
  'dash.viewBE': {
    th: 'ดูรายละเอียดวงเงิน B/E (รวม L/G วัสดุ/สาธารณูปโภค)',
    en: 'View B/E facility details (incl. L/G materials/utilities)',
  },
  'dash.bgContract': { th: 'ค้ำสัญญา 5%', en: 'Contract guarantee 5%' },
  'dash.bgAdvance': { th: 'ค้ำ Advance 15%', en: 'Advance guarantee 15%' },
  'dash.bgRetention': { th: 'ค้ำประกันผลงาน', en: 'Performance guarantee' },
  'dash.overdueOutstanding': { th: 'เกินกำหนดค้าง', en: 'overdue outstanding' },
  'dash.totalOutstanding': { th: 'รวมยอดค้างชำระ', en: 'Total outstanding' },
  'dash.lgMaterials': { th: 'L/G วัสดุ', en: 'L/G materials' },

  /* --------------------------------- table -------------------------------- */
  'col.date': { th: 'วันที่', en: 'Date' },
  'col.docNo': { th: 'เลขที่เอกสาร', en: 'Document no.' },
  'col.detailsBeneficiary': {
    th: 'รายละเอียด / ผู้รับผลประโยชน์',
    en: 'Details / beneficiary',
  },
  'col.details': { th: 'รายละเอียด', en: 'Details' },
  'col.amount': { th: 'จำนวนเงิน', en: 'Amount' },
  'col.amountTHB': { th: 'จำนวน (บาท)', en: 'Amount (THB)' },
  'col.due': { th: 'ครบกำหนด', en: 'Due' },
  'col.start': { th: 'เริ่ม', en: 'Start' },
  'col.dueShort': { th: 'ครบ', en: 'Due' },
  'col.attachment': { th: 'เอกสารแนบ', en: 'Attachment' },
  'col.project': { th: 'โครงการ', en: 'Project' },
  'col.count': { th: '# รายการ', en: '# items' },
  'col.budget': { th: 'งบประมาณ', en: 'Budget' },
  'col.pctUsed': { th: '% ใช้', en: '% used' },

  /* ----------------------------- cost summary ----------------------------- */
  'cost.summary': { th: 'สรุปหมวดค่าใช้จ่าย', en: 'Cost-category summary' },
  'cost.none': { th: 'ยังไม่มีข้อมูลค่าใช้จ่าย', en: 'No expense data yet' },
  'cost.noCategory': { th: '(ไม่ระบุหมวด)', en: '(No category)' },
  'cost.withinBudget': { th: '✓ ในงบ', en: '✓ Within budget' },
  'cost.notSet': { th: '— ไม่ได้ตั้ง', en: '— Not set' },
  'cost.noBudgetYet': {
    th: '— ยังไม่มีงบที่ตั้งไว้ในโครงการนี้ —',
    en: '— No budget set for this project yet —',
  },
  'cost.setBudget': { th: 'ตั้ง/แก้ไขงบประมาณ', en: 'Set / edit budget' },
  'cost.setBudgetTitle': { th: 'ตั้งงบหมวดค่าใช้จ่าย', en: 'Set cost-category budget' },
  'cost.budgetTHB': { th: 'งบประมาณ (บาท)', en: 'Budget (THB)' },
  'cost.budgetBlankHint': { th: '— เว้นว่างเพื่อยกเลิกงบ', en: '— leave blank to remove the budget' },
  'cost.noteSource': { th: 'หมายเหตุ (ที่มา / cashflow)', en: 'Note (source / cashflow)' },
  'cost.optional': { th: '— ไม่บังคับ', en: '— optional' },
  'cost.notePlaceholder': {
    th: 'เช่น cashflow ที่ส่งธนาคารตอนขอวงเงิน',
    en: 'e.g. cashflow submitted to the bank when applying for the facility',
  },
  'cost.badBudget': { th: 'กรอกงบให้ถูกต้อง', en: 'Enter a valid budget' },
  'cost.budgetSet': { th: 'ตั้งงบแล้ว', en: 'Budget set' },
  'cost.budgetRemoved': { th: 'ยกเลิกงบแล้ว', en: 'Budget removed' },
  'cost.overBudget': { th: 'เกินงบ', en: 'over budget' },
  'cost.nearBudget': { th: 'ใกล้เต็มงบ', en: 'near budget limit' },
  'cost.noBudgetSet': { th: 'ยังไม่ตั้งงบ', en: 'no budget set' },
  'cost.uncategorizedHint': {
    th: 'รายการกลุ่มนี้ยังไม่ได้ระบุหมวด — แก้คำขอให้กรอกหมวดก่อน แล้วค่อยตั้งงบ',
    en: 'This group has no category — edit the requests to add a category first, then set a budget',
  },

  /* ------------------------------- cash plan ------------------------------ */
  'plan.title': { th: 'แผนการเงิน', en: 'Cash plan' },
  'plan.loading': { th: 'กำลังโหลด', en: 'Loading' },
  'plan.addSection': { th: '＋ เพิ่มส่วน', en: '＋ Add section' },
  'plan.copyPrev': { th: 'คัดลอกจากเดือนก่อน', en: 'Copy from previous month' },
  'plan.noDueThisMonth': {
    th: 'ไม่มีรายการครบกำหนดในเดือนนี้',
    en: 'No items due this month',
  },
  'plan.dontPay': { th: 'ไม่ชำระงวดนี้', en: "Don't pay this period" },
  'plan.removeFromSection': { th: 'ตัดออกจากส่วนนี้', en: 'Remove from this section' },
  'plan.deleteSection': { th: 'ลบส่วนนี้', en: 'Delete this section' },
  'plan.deleteSectionQ': { th: 'ลบส่วนนี้?', en: 'Delete this section?' },
  'plan.pnAmount': { th: 'ยอด P/N', en: 'P/N amount' },
  'plan.days': { th: 'วัน', en: 'Days' },
  'plan.interest': { th: 'ดอกเบี้ย', en: 'Interest' },
  'plan.totalInterest': { th: 'รวมดอกเบี้ย', en: 'Total interest' },
  'plan.no': { th: 'เลขที่', en: 'No.' },
  'plan.amount': { th: 'จำนวน', en: 'Amount' },
  'plan.total': { th: 'รวม', en: 'Total' },
  'plan.netWorkPayment': { th: 'รับเงินค่างานสุทธิ', en: 'Net work payment received' },
  'plan.workValue': { th: 'ค่างาน', en: 'Work value' },
  'plan.start': { th: 'เริ่มต้น', en: 'Start' },
  'plan.totalIn': { th: 'รวมรับ', en: 'Total in' },
  'plan.totalOut': { th: 'รวมจ่าย', en: 'Total out' },
  'plan.drawPN': { th: 'ขอเบิก P/N', en: 'Draw P/N' },
  'plan.receiveDeduct': {
    th: 'รับเงินค่างาน + หักหนี้',
    en: 'Receive work payment + deduct debt',
  },
  'plan.issueAval': { th: 'ขอออก Aval จัดสรร', en: 'Issue allocated Aval' },
  'plan.mixedPeriod': { th: 'งวดผสม', en: 'Mixed period' },
  'plan.submitDate': { th: 'วันที่ส่งงาน', en: 'Work-submission date' },
  'plan.selectProjectToLoad': {
    th: '— เลือกโครงการเพื่อโหลดรายการ —',
    en: '— Select a project to load items —',
  },
  'plan.allProjectsPlanned': {
    th: 'ทุกโครงการมีแผนในเดือนนี้แล้ว',
    en: 'All projects already have a plan this month',
  },
  'plan.allPlanned': { th: 'ทุกโครงการมีแผนแล้ว', en: 'All projects already have a plan' },
  'plan.pickProjectHint': {
    th: 'เลือกโครงการเพื่อสร้างแผน 3 ส่วน พร้อม B/E + P/N ที่ครบกำหนดเดือนนี้',
    en: 'Select a project to create a 3-section plan with B/E + P/N items due this month',
  },
  'plan.deductTL': { th: 'หัก TL', en: 'Deduct TL' },
  'plan.deductML': { th: 'หัก ML', en: 'Deduct ML' },
  'plan.deductPN': { th: 'หัก PN', en: 'Deduct PN' },
  'plan.deductPNNew': { th: 'หัก PN ขอเบิกใหม่', en: 'Deduct PN (new draw)' },
  'plan.deductSegment': { th: 'หัก Segment CVE', en: 'Deduct Segment CVE' },
  'plan.autoPnNote': {
    th: '(auto จาก P/N แถว "ค่างานรับสุทธิ" เท่านั้น)',
    en: '(auto from the P/N "net work payment" row only)',
  },
  'plan.pickItems': { th: 'เลือกรายการที่จะเพิ่มเข้าส่วนนี้', en: 'Select items to add to this section' },
  'plan.noUnallocated': {
    th: 'ไม่มีรายการที่ยังไม่ถูกจัดเข้าส่วนใด',
    en: 'No unallocated items remaining',
  },
  'plan.noDestination': { th: 'ไม่พบส่วนปลายทาง', en: 'Destination section not found' },
  'plan.advance': {
    th: 'ล่วงหน้า (ยังไม่ครบ — ชำระก่อน)',
    en: 'Advance (not yet due — pay early)',
  },
  'plan.pickProjectToAdd': {
    th: 'เลือกโครงการที่จะเพิ่มเข้าแผน',
    en: 'Select a project to add to the plan',
  },
  'plan.max5': { th: 'ใส่ได้สูงสุด 5 ส่วนต่อเดือน', en: 'Maximum of 5 sections per month' },
  'plan.adding': { th: 'กำลังเพิ่มส่วน…', en: 'Adding section…' },
  'plan.added': { th: 'เพิ่มส่วนแล้ว', en: 'Section added' },
  'plan.drawPNDesc': {
    th: 'เบิก P/N เข้าโครงการ จากค่างาน/เงินประกัน/ผลงานแล้วเสร็จ',
    en: 'Draw P/N into the project from work payment / retention / completed work',
  },
  'plan.receiveDesc': {
    th: 'รับชำระค่างาน หักด้วย TL / ML / PN / Segment',
    en: 'Receive work payment, deduct TL / ML / PN / Segment',
  },
  'plan.avalDesc': {
    th: 'ออก Aval (B/E) จ่ายผู้ขาย/วัสดุ',
    en: 'Issue Aval (B/E) to pay vendors/materials',
  },
  'plan.addProject': { th: '＋ เพิ่มโครงการ —', en: '＋ Add project —' },
  'plan.noSections': { th: 'ยังไม่มีส่วน — กด', en: 'No sections yet — press' },
  'plan.toStart': { th: 'เพื่อเริ่ม', en: 'to start' },
  'plan.noItemsInSection': { th: 'ไม่มีรายการในส่วนนี้', en: 'No items in this section' },
  'plan.noPrevPlan': { th: 'ไม่พบแผนเดือนก่อนของ', en: 'No previous-month plan found for' },
  'plan.pickPeriodType': { th: 'เลือกประเภทงวดสำหรับ', en: 'Select period type for' },
  'plan.period': { th: 'งวดที่', en: 'Period' },
  'plan.moveToSection': { th: 'ย้ายไปส่วน', en: 'Move to section' },
  'plan.retention': { th: 'เงินประกันผลงาน', en: 'Performance retention' },
  'plan.completedAsOf': { th: 'ผลงานแล้วเสร็จ ณ', en: 'Completed work as of' },
  'plan.loadFailed': { th: 'โหลดแผนไม่สำเร็จ:', en: 'Failed to load plan:' },
  'plan.exportTbar': { th: 'ส่งออก T-bar', en: 'Export T-bar' },
  'plan.addExtraIncome': { th: '+ เพิ่มรายรับจากแหล่งอื่น', en: '+ Add other income' },

  /* -------------------------------- variance ------------------------------ */
  'var.title': { th: 'ผลต่าง (แผน vs จริง)', en: 'Variance (Plan vs Actual)' },
  'var.received': { th: 'รับเงิน (Received)', en: 'Received' },
  'var.deducted': { th: 'หักจ่าย (Deducted)', en: 'Deducted' },
  'var.net': { th: 'คงเหลือสุทธิ (Net)', en: 'Net' },
  'var.plan': { th: 'แผน', en: 'Plan' },
  'var.actual': { th: 'จริง', en: 'Actual' },
  'var.none': {
    th: 'ยังไม่มีข้อมูลแผน/จริงในเดือนนี้',
    en: 'No plan/actual data for this month',
  },

  /* -------------------------------- settings ------------------------------ */
  'set.title': { th: 'ตั้งค่าขั้นสูง', en: 'Advanced Settings' },
  'set.open': { th: 'ตั้งค่าขั้นสูง', en: 'Advanced Settings' },
  'set.display': { th: 'การแสดงผล / Display', en: 'Display' },
  'set.theme': { th: 'โหมดสี / Theme', en: 'Theme' },
  'set.light': { th: '☀ สว่าง', en: '☀ Light' },
  'set.dark': { th: '🌙 มืด', en: '🌙 Dark' },
  'set.language': { th: 'ภาษา / Language', en: 'Language' },
  'set.thai': { th: 'ไทย', en: 'Thai' },
  'set.dashboard': { th: 'แดชบอร์ด / Dashboard', en: 'Dashboard' },
  'set.panelHint': {
    th: 'เลือกพาเนลที่ต้องการแสดงบนแดชบอร์ด · Choose which panels to show',
    en: 'Choose which panels to show on the dashboard',
  },
  'set.nonProject': { th: 'ส่วนกลาง', en: 'Non-project' },
  'set.inclDLC': { th: '(รวม DLC)', en: '(incl. DLC)' },
  'set.dueDates': { th: 'ครบกำหนด / Due dates', en: 'Due dates' },
  'set.status': { th: 'สถานะ / Status', en: 'Status' },
  'set.within1Week': { th: 'ภายใน 1 สัปดาห์', en: 'Within 1 week' },
  'set.proposed': { th: 'เสนออนุมัติ', en: 'Proposed' },
  'set.costCategories': { th: 'หมวดค่าใช้จ่าย / Cost categories', en: 'Cost categories' },
  'set.catOrderHint': {
    th: 'ลำดับในรายการ = ลำดับที่แสดงในเมนู · กด ▲▼ เพื่อย้าย · กด × เพื่อลบ',
    en: 'List order = display order in the menu · Use ▲▼ to reorder · Use × to delete',
  },
  'set.newCatPlaceholder': { th: 'พิมพ์ชื่อหมวดใหม่…', en: 'Type a new category name…' },
  'set.addCat': { th: '＋ เพิ่มหมวด', en: '＋ Add category' },
  'set.noCats': {
    th: 'ยังไม่มีหมวด — เพิ่มหมวดแรกได้เลย',
    en: 'No categories yet — add your first one',
  },
  'set.saved': { th: 'บันทึกการตั้งค่าแล้ว', en: 'Settings saved' },

  /* --------------------------------- misc --------------------------------- */
  'misc.confirm': { th: 'ยืนยัน', en: 'Confirm' },
  'misc.saving': { th: '⟳ กำลังบันทึก…', en: '⟳ Saving…' },
  'misc.saveFailed': { th: 'บันทึกไม่สำเร็จ', en: 'Save failed' },
  'misc.failed': { th: 'ไม่สำเร็จ', en: 'Failed' },
  'misc.exportConfirm': {
    th: 'ส่งออกไฟล์ Excel ตามตัวกรองปัจจุบัน?',
    en: 'Export an Excel file using the current filters?',
  },
  'misc.generating': { th: 'กำลังสร้างไฟล์…', en: 'Generating file…' },
  'misc.exported': { th: 'ดาวน์โหลดไฟล์ Excel แล้ว', en: 'Excel file downloaded' },
  'misc.rateUnavailable': { th: 'ระบุอัตราไม่ได้', en: 'Rate unavailable' },
  'misc.rateNotNumeric': {
    th: 'อัตราดอกเบี้ยของวงเงินนี้ไม่ได้ระบุเป็นตัวเลข (เช่น MLR)',
    en: "This facility's interest rate is not given as a number (e.g. MLR)",
  },
  'misc.items': { th: 'รายการ', en: 'items' },
  'misc.baht': { th: 'บาท', en: 'THB' },
  'misc.days': { th: 'วัน', en: 'days' },
  'misc.to': { th: 'ถึง', en: 'to' },
  'misc.estimate': { th: '(ประมาณ)', en: '(est.)' },
  'misc.managerOnly': {
    th: 'เฉพาะผู้บริหารเท่านั้นที่อนุมัติได้',
    en: 'Only managers can approve',
  },
  'misc.alreadyDecided': { th: 'รายการนี้ถูกตัดสินแล้ว', en: 'This item has already been decided' },
  'misc.notFound': { th: 'ไม่พบรายการ', en: 'Item not found' },
  'misc.alreadySettled': { th: 'รายการนี้ชำระแล้ว', en: 'This item is already settled' },
  'misc.nothingOwing': { th: 'ไม่มียอดค้างชำระ', en: 'Nothing is owing' },

  /* ------------------ API error codes this module can surface -------------- */
  'error.ALREADY_DECIDED': { th: 'รายการนี้ถูกตัดสินแล้ว', en: 'This item has already been decided' },
  'error.ALREADY_SETTLED': { th: 'รายการนี้ชำระแล้ว', en: 'This item is already settled' },
  'error.NOTHING_OWING': { th: 'ไม่มียอดค้างชำระ', en: 'Nothing is owing' },
});

export default dictionary;
