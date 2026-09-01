/**
 * SOP module dictionary.
 *
 * ---------------------------------------------------------------------------
 * THE THAI HERE IS AUTHORITATIVE BUSINESS COPY. DO NOT RETRANSLATE IT.
 * ---------------------------------------------------------------------------
 * Every `th` value below is carried over VERBATIM from the I18N map in the old
 * data/config.ts, which itself came verbatim from the canonical Apps Script
 * index.html. This is the wording the MANGO ERP standard operating procedures
 * are written in and the wording staff are trained on. Reword an English string
 * if it reads badly; never "improve" the Thai.
 *
 * Shape: flat dot keys, `{ th, en }` per key, merged over commonDictionary by
 * <I18nProvider dictionary={sopDict}>. The old config.ts had two parallel
 * objects (I18N.th / I18N.en) keyed by camelCase names; pairing the two
 * languages per key makes a missing translation visible at a glance.
 *
 * Interpolation: the old dictionary held FUNCTIONS for the four counted strings
 * (showingFmt(n, t) and friends). The shared translate() interpolates {name}
 * placeholders instead, so those became `{n}` / `{t}`, preserving the Thai word
 * order exactly — t('list.showing', { n, t }).
 */

import { createDictionary } from '@vcb/shared';

export const sopDict = createDictionary({
  /* ------------------------------- chrome -------------------------------- */
  'app.brand': { th: 'VCB Group', en: 'VCB Group' },
  'app.subtitle': {
    th: 'Mango ERP Standard Operating Procedure',
    en: 'Mango ERP Standard Operating Procedure',
  },
  'app.subtitleTH': {
    th: 'กลุ่มวิจิตรภัณฑ์ก่อสร้าง · มาตรฐานการใช้งานระบบ',
    en: 'กลุ่มวิจิตรภัณฑ์ก่อสร้าง · มาตรฐานการใช้งานระบบ',
  },
  'app.backToPortal': {
    th: 'กลับไปหน้าหลัก VCB Connect',
    en: 'Back to VCB Connect home',
  },

  /* -------------------------------- labels ------------------------------- */
  'label.module': { th: 'หมวด (Module)', en: 'Modules' },
  'label.reference': { th: 'อ้างอิง (Reference)', en: 'Reference' },
  'label.all': { th: 'ทั้งหมด', en: 'All' },
  'label.allDesc': { th: 'ทุกกรณีเฉพาะ', en: 'All scenarios' },

  /* ------------------------------- reports ------------------------------- */
  'reports.title': { th: 'วิธีเรียก Report', en: 'Reports' },
  'reports.desc': { th: 'เมนูเรียกรายงานสำคัญ', en: 'Common report menu paths' },
  'reports.header': { th: 'วิธีเรียก Report', en: 'Reports' },
  'reports.sub': {
    th: 'เมนูเรียกรายงานสำคัญทั้งหมด · {n} จาก {t} รายการ',
    en: 'Common report menu paths · {n} of {t} items',
  },
  'reports.col1': { th: '#', en: '#' },
  'reports.col2': { th: 'ต้องการตรวจสอบอะไร', en: 'What to check' },
  'reports.col3': { th: 'เมนูที่ใช้ · Menu Path', en: 'Menu Path' },
  'reports.none': { th: 'ไม่พบรายงานที่ค้นหา', en: 'No matching reports' },
  'reports.new': { th: 'เพิ่มรายงานใหม่', en: 'New report' },
  'reports.newTitle': { th: 'เพิ่มรายการ Report ใหม่', en: 'Add new report row' },
  'reports.required': {
    th: 'กรุณากรอกข้อมูลให้ครบ / Please fill in all fields',
    en: 'Please fill in all fields',
  },
  'reports.caseNo': { th: 'เลขกรณี · Case #', en: 'Case #' },
  'reports.caseNoPh': { th: 'เช่น 32', en: 'e.g. 32' },
  'reports.pathPh': {
    th: 'เช่น AP -> Report -> 5.1.2 (Cheque Register Report)',
    en: 'e.g. AP -> Report -> 5.1.2 (Cheque Register Report)',
  },
  'reports.delete': { th: 'ลบรายงานนี้', en: 'Delete this report' },
  'reports.notebookLM': { th: 'เปิด NotebookLM', en: 'Open NotebookLM' },
  'reports.suffix': { th: ' รายงาน', en: ' reports' },

  /* -------------------------------- search ------------------------------- */
  'search.placeholder': {
    th: 'ค้นหา… น้ำมัน, Advance, PO, เช็ค, โอนเงิน',
    en: 'Search… oil, Advance, PO, cheque, transfer',
  },

  /* --------------------------------- list -------------------------------- */
  'list.showing': { th: 'แสดง {n} จาก {t} กรณี', en: 'Showing {n} of {t} cases' },
  'list.noResults': { th: 'ไม่พบรายการที่ค้นหา', en: 'No matching results' },
  'list.noScenarios': {
    th: 'ยังไม่มีกรณีเฉพาะในหมวดนี้ · No scenarios in this module yet',
    en: 'No scenarios in this module yet',
  },
  'list.newCase': { th: 'เพิ่มกรณีใหม่', en: 'New case' },
  'list.casesSuffix': { th: ' กรณีเฉพาะ', en: ' cases' },

  /* -------------------------------- detail ------------------------------- */
  'detail.problem': { th: 'ปัญหา / สถานการณ์ · Problem', en: 'Problem / Situation' },
  'detail.solution': { th: 'แนวทางปฏิบัติ · Solution (SOP)', en: 'Solution (SOP)' },
  'detail.note': { th: 'หมายเหตุ:', en: 'Note:' },
  'detail.edit': { th: 'แก้ไข · Edit', en: 'Edit' },
  'detail.share': { th: 'แชร์', en: 'Share' },
  'detail.shareCopied': { th: 'คัดลอกลิงก์แล้ว', en: 'Link copied' },
  'detail.delete': { th: 'ลบ · Delete', en: 'Delete' },
  'detail.dateAdded': { th: 'วันที่เพิ่ม:', en: 'Added:' },
  'detail.attachments': { th: 'เอกสารที่เกี่ยวข้อง', en: 'Related Files' },
  'detail.attachmentsNone': { th: 'ไม่มีเอกสารแนบ', en: 'No files attached' },
  'detail.attachmentsFile': { th: 'เอกสารแนบ', en: 'Document' },
  'detail.backList': { th: 'รายการ · List', en: 'List' },
  'detail.backModules': { th: 'หมวด · Modules', en: 'Modules' },

  /* ------------------------------- welcome ------------------------------- */
  'welcome.purposeHdr': {
    th: 'วัตถุประสงค์และขอบเขต · Purpose & Scope',
    en: 'Purpose & Scope',
  },
  'welcome.notesHdr': { th: 'หมายเหตุ · Notes', en: 'Notes' },
  'welcome.version': { th: 'เวอร์ชัน: ', en: 'Version: ' },
  'welcome.effective': { th: 'มีผล: ', en: 'Effective: ' },
  'welcome.heading': {
    th: 'คู่มือปฏิบัติงานระบบ VCB-MANGO ERP',
    en: 'VCB-MANGO ERP — Operating Procedures',
  },
  'welcome.lead': {
    th: 'รวมขั้นตอนการปฏิบัติงานมาตรฐาน (SOP) สำหรับการใช้งานระบบ ERP ของบริษัท ใช้เป็นแนวทางอ้างอิงในการทำงานแต่ละขั้นตอน',
    en: 'Standard operating procedures (SOP) for using the company’s ERP system — your step-by-step reference for getting each task done correctly.',
  },
  'welcome.ht1Title': { th: 'เลือกหมวด (ซ้าย)', en: 'Pick a module (left)' },
  'welcome.ht1Desc': {
    th: 'คลิกหมวดในแถบซ้าย เช่น PO, IC, AP หรือ "ทั้งหมด" เพื่อดูรายการกรณีในหมวดนั้น',
    en: 'Tap a module like PO, IC, AP or "All" to see scenarios in that module.',
  },
  'welcome.ht2Title': { th: 'เลือกกรณี (กลาง)', en: 'Pick a case (middle)' },
  'welcome.ht2Desc': {
    th: 'คลิกการ์ดของกรณีเฉพาะตรงกลาง เพื่อเปิดดูปัญหาและแนวทางปฏิบัติฉบับเต็ม',
    en: 'Tap a case card to open the full problem and the step-by-step procedure.',
  },
  'welcome.ht3Title': { th: 'อ่านรายละเอียด (ขวา)', en: 'Read the details (right)' },
  'welcome.ht3Desc': {
    th: 'ปัญหา/สถานการณ์ และขั้นตอนปฏิบัติทั้งหมดจะแสดงในแถบนี้ พร้อมอ้างอิงคู่มือ',
    en: 'The problem statement and procedure steps appear here with a manual reference.',
  },

  /* --------------------------------- flows ------------------------------- */
  'flows.title': { th: 'ผังกระบวนการ', en: 'Process Flows' },
  'flows.desc': { th: 'Process Flow ทุกขั้นตอน', en: 'All workflow diagrams' },
  'flows.allDesc': { th: 'ผังทั้งหมด', en: 'All flows' },
  'flows.header': { th: 'ผังกระบวนการ · Process Flows', en: 'Process Flows' },
  'flows.showing': { th: 'แสดง {n} จาก {t} ผัง', en: 'Showing {n} of {t} flows' },
  'flows.stepsLbl': { th: 'รายละเอียดขั้นตอน · Process', en: 'Process detail' },
  'flows.introTitle': {
    th: 'ผังกระบวนการทำงาน · Process Flows',
    en: 'Process Flows',
  },
  'flows.introLead': {
    th: 'แผนผังขั้นตอนการทำงานในระบบ ERP แยกตามโมดูล เลือกผังจากรายการเพื่อดูลำดับขั้นตอนและผู้รับผิดชอบในแต่ละขั้น',
    en: 'Step-by-step ERP workflow diagrams grouped by module. Pick a flow to see the sequence and who is responsible at each step.',
  },
  'flows.legNormal': { th: 'ขั้นตอนปกติ', en: 'Step' },
  'flows.legApprove': { th: 'ส่งอนุมัติ', en: 'Submit' },
  'flows.legYes': { th: 'อนุมัติ (Yes)', en: 'Approved (Yes)' },
  'flows.legReject': { th: 'ตีกลับ (Reject)', en: 'Reject' },

  /* ----------------------------- case studies ---------------------------- */
  'cases.title': { th: 'กรณีเฉพาะ', en: 'Case Studies' },
  'cases.desc': { th: 'Case Studies · ตามหมวด', en: 'By module · กรณีเฉพาะ' },

  /* ------------------------------- settings ------------------------------ */
  'settings.title': { th: 'การตั้งค่า · Settings', en: 'Settings · การตั้งค่า' },
  'settings.signedIn': { th: 'เข้าใช้งานในชื่อ · SIGNED IN AS', en: 'SIGNED IN AS' },
  'settings.display': { th: 'การแสดงผล · DISPLAY', en: 'DISPLAY · การแสดงผล' },
  'settings.theme': { th: 'โหมดสี · Theme', en: 'Theme · โหมดสี' },
  'settings.themeLight': { th: 'สว่าง · Light', en: 'Light · สว่าง' },
  'settings.themeDark': { th: 'มืด · Dark', en: 'Dark · มืด' },
  'settings.themeAuto': { th: 'ตามระบบ · Auto', en: 'Auto · ตามระบบ' },
  'settings.lang': { th: 'ภาษา · Language', en: 'Language · ภาษา' },
  'settings.signOut': { th: 'ออกจากระบบ · Sign out', en: 'Sign out' },
  'settings.defaultView': { th: 'หน้าเริ่มต้น · Default view', en: 'Default view · หน้าเริ่มต้น' },
  'settings.defaultViewHint': {
    th: 'เลือกหมวดที่จะเปิดโดยอัตโนมัติเมื่อเข้าใช้งานครั้งถัดไป',
    en: 'The module shown automatically next time you open the app.',
  },
  'settings.about': { th: 'เกี่ยวกับ · ABOUT', en: 'About · เกี่ยวกับ' },
  'settings.contact': { th: 'ติดต่อ / สอบถาม · CONTACT', en: 'Contact · ติดต่อ' },
  'settings.developer': { th: 'ผู้พัฒนา · Developer', en: 'Developer · ผู้พัฒนา' },
  'settings.contactDev': {
    th: 'ติดต่อ / สอบถาม · Contact developer',
    en: 'Contact developer · ติดต่อผู้พัฒนา',
  },
  'settings.versionTag': { th: 'เวอร์ชัน · Version', en: 'Version · เวอร์ชัน' },
  'settings.updates': { th: 'อัปเดตล่าสุด · Updates', en: 'Updates · อัปเดตล่าสุด' },
  'settings.copyEmail': {
    th: 'คลิกเพื่อคัดลอกอีเมล · Click to copy',
    en: 'Click to copy the email address',
  },
  'settings.versions': { th: 'ประวัติเวอร์ชัน · Version history', en: 'Version history · ประวัติเวอร์ชัน' },

  /* -------------------------------- editor ------------------------------- */
  // The old EditModal hardcoded its Thai labels rather than going through the
  // dictionary. They are keyed here so the editor is bilingual like the rest.
  'edit.newTitle': { th: 'เพิ่มกรณีเฉพาะใหม่ · New case', en: 'New case · เพิ่มกรณีเฉพาะใหม่' },
  'edit.editTitle': { th: 'แก้ไขกรณีที่ {no} · {title}', en: 'Editing case {no} · {title}' },
  'edit.module': { th: 'หมวด (Module)', en: 'Module' },
  'edit.extraModules': { th: 'หมวดเพิ่มเติม', en: 'Additional modules' },
  'edit.extraModulesHint': {
    th: 'กรณีนี้เกี่ยวข้องกับหลายหมวด · เลือกหมวดอื่นที่ต้องการให้แสดงกรณีนี้ด้วย (ไม่บังคับ)',
    en: 'This case spans several modules — tick any other module it should also appear under (optional).',
  },
  'edit.swap': { th: 'สลับตำแหน่ง', en: 'Swap position' },
  'edit.swapPick': { th: 'เลือกกรณี', en: 'Select a case' },
  'edit.swapBtn': { th: '↔ สลับ', en: '↔ Swap' },
  'edit.swapping': { th: 'กำลังสลับ…', en: 'Swapping…' },
  'edit.swapHint': {
    th: 'สลับเนื้อหาทั้งหมดกับกรณีที่เลือก · กรณีอื่นๆ ไม่ถูกเลื่อนตำแหน่ง',
    en: 'Trades all content with the chosen case — no other case moves.',
  },
  'edit.swapRequired': {
    th: 'กรุณาเลือกกรณีที่ต้องการสลับตำแหน่งจากรายการ / Choose a case from the list to swap with',
    en: 'Choose a case from the list to swap with',
  },
  'edit.titleTH': { th: 'ชื่อ (ไทย)', en: 'Title (Thai)' },
  'edit.titleEN': { th: 'ชื่อ (Eng)', en: 'Title (English)' },
  'edit.ref': { th: 'อ้างอิง', en: 'Reference' },
  'edit.refPh': { th: 'ERP Manual 14.3.68 – บทที่ X', en: 'ERP Manual 14.3.68 – chapter X' },
  'edit.attachments': { th: 'ไฟล์แนบ', en: 'Attachments' },
  'edit.attachmentsAdd': { th: '+ เพิ่มไฟล์แนบ', en: '+ Add attachment' },
  'edit.attachmentsHint': {
    th: 'วางลิงก์ Drive แล้วชื่อไฟล์จะเติมให้อัตโนมัติ · แก้ไขได้ · เว้นว่างจะแสดงเป็น “เอกสารแนบ”',
    en: 'Paste a Drive link and the filename fills in automatically — editable; left blank it shows as “Document”.',
  },
  'edit.attachmentNamePh': {
    th: 'ชื่อไฟล์ (เช่น SOP-09 · IC Balance Adjustment)',
    en: 'File name (e.g. SOP-09 · IC Balance Adjustment)',
  },
  'edit.attachmentLooking': { th: 'กำลังอ่านชื่อไฟล์…', en: 'Reading the file name…' },
  'edit.attachmentDelete': { th: 'ลบไฟล์แนบนี้', en: 'Remove this attachment' },
  'edit.when': { th: 'ปัญหา', en: 'Problem' },
  'edit.steps': { th: 'ขั้นตอน', en: 'Steps' },
  'edit.stepsHint': {
    th: 'ขึ้นต้นด้วยตัวเลข (เช่น 1.)  ขึ้นต้นด้วย > เพื่อให้เป็นหัวข้อย่อย · >> เพื่อให้เป็นหัวข้อย่อยชั้นที่ 3',
    en: 'Start a line with a number (e.g. 1.) for a step; with > for a sub-bullet, >> for a third-level one.',
  },
  'edit.noteField': { th: 'หมายเหตุ', en: 'Note' },
  'edit.notePh': { th: '(ไม่บังคับ)', en: '(optional)' },
  'edit.noteHint': {
    th: 'แสดงเป็นกล่องแดงเตือนใต้ขั้นตอน · เว้นว่างถ้าไม่ต้องการ',
    en: 'Shown as a red warning box under the steps — leave blank for none.',
  },
  'edit.titleRequired': {
    th: 'กรุณากรอกชื่อ (ไทย) / Title (Thai) is required',
    en: 'Title (Thai) is required',
  },
  'edit.deleteConfirmTitle': { th: 'ยืนยันการลบ', en: 'Delete this case?' },
  'edit.deleteConfirm': {
    th: 'ลบกรณี {no} — "{title}" ใช่หรือไม่? กรณีอื่นในหมวดเดียวกันที่อยู่หลังจากนี้จะเลื่อนหมายเลขขึ้นทั้งหมด',
    en: 'Delete case {no} — "{title}"? Every later case in the same module renumbers up by one.',
  },
  'edit.deleteUndo': {
    th: 'กู้คืนได้จากประวัติเวอร์ชัน (เมนูตั้งค่า) เท่านั้น',
    en: 'Recoverable only from the version history (Settings).',
  },
  'edit.deleteYes': { th: 'ยืนยันลบ', en: 'Confirm delete' },
  'edit.deleting': { th: 'กำลังลบ…', en: 'Deleting…' },

  /* ------------------------------- versions ------------------------------ */
  'versions.title': { th: 'ประวัติเวอร์ชัน', en: 'Version history' },
  'versions.lead': {
    th: 'ระบบบันทึกเวอร์ชันก่อนการแก้ไขทุกครั้งโดยอัตโนมัติ · การกู้คืนเวอร์ชันเก่าจะถูกบันทึกเป็นเวอร์ชันใหม่ด้วย จึงย้อนกลับได้เสมอ',
    en: 'A version is snapshotted automatically before every edit. Restoring an old version is itself recorded, so a restore can always be undone.',
  },
  'versions.takenAt': { th: 'เวลา', en: 'Taken at' },
  'versions.takenBy': { th: 'โดย', en: 'By' },
  'versions.note': { th: 'บันทึก', en: 'Note' },
  'versions.restore': { th: 'กู้คืนเวอร์ชันนี้', en: 'Restore this version' },
  'versions.restoring': { th: 'กำลังกู้คืน…', en: 'Restoring…' },
  'versions.restored': { th: 'กู้คืนเรียบร้อยแล้ว', en: 'Restored' },
  'versions.confirm': {
    th: 'กู้คืนเวอร์ชันนี้ทับเอกสารปัจจุบันใช่หรือไม่? เอกสารปัจจุบันจะถูกบันทึกเป็นเวอร์ชันก่อนหน้าโดยอัตโนมัติ',
    en: 'Restore this version over the current document? The current document is snapshotted first.',
  },
  'versions.empty': { th: 'ยังไม่มีประวัติเวอร์ชัน', en: 'No versions yet' },
  'versions.editorOnly': {
    th: 'ประวัติเวอร์ชันเปิดให้เฉพาะผู้มีสิทธิ์แก้ไข',
    en: 'Version history is available to editors only',
  },

  /* --------------------------- not-seeded state -------------------------- */
  // GET /api/sop/ answers 404 NOT_SEEDED until the document row exists. That is
  // a normal pre-launch state, not a failure, so it gets its own screen.
  'seed.title': { th: 'ยังไม่มีข้อมูล SOP ในระบบ', en: 'The SOP has not been loaded yet' },
  'seed.lead': {
    th: 'เอกสาร SOP ยังไม่ถูกนำเข้าฐานข้อมูล เมื่อผู้ดูแลระบบนำเข้าข้อมูลแล้ว หน้านี้จะแสดงกรณีเฉพาะและผังกระบวนการทั้งหมดโดยอัตโนมัติ',
    en: 'The SOP document has not been imported into the database yet. Once an administrator loads it, every case study and process flow appears here automatically.',
  },
  'seed.flowsStillWork': {
    th: 'ผังกระบวนการยังเปิดดูได้ตามปกติ เพราะเก็บอยู่ในตัวแอป ไม่ได้อยู่ในฐานข้อมูล',
    en: 'Process flows still work — they ship with the app rather than living in the database.',
  },
  'seed.viewFlows': { th: 'ดูผังกระบวนการ', en: 'View process flows' },

  /* --------------------------------- errors ------------------------------ */
  'error.title': { th: 'โหลดข้อมูลไม่สำเร็จ', en: 'Could not load the SOP' },
  'error.saveFailed': { th: 'บันทึกไม่สำเร็จ', en: 'Save failed' },
  'error.swapFailed': { th: 'สลับตำแหน่งไม่สำเร็จ', en: 'Swap failed' },
  'error.deleteFailed': { th: 'ลบไม่สำเร็จ', en: 'Delete failed' },
  'error.restoreFailed': { th: 'กู้คืนไม่สำเร็จ', en: 'Restore failed' },
  // The API's mutations run read-modify-write under `select … for update`, so a
  // concurrent editor can legitimately win. Say so plainly instead of showing a
  // generic failure the person cannot act on.
  'error.CONFLICT': {
    th: 'มีผู้อื่นแก้ไขเอกสารนี้ระหว่างที่คุณกำลังบันทึก ระบบจึงไม่บันทึกทับให้ · กรุณากดรีเฟรชเพื่อดูข้อมูลล่าสุด แล้วแก้ไขอีกครั้ง',
    en: 'Someone else edited this document while you were saving, so your write was not applied. Refresh to see the current version, then make your change again.',
  },
  'error.NOT_SEEDED': {
    th: 'ยังไม่มีเอกสาร SOP ในฐานข้อมูล จึงยังแก้ไขไม่ได้',
    en: 'The SOP document has not been seeded yet, so it cannot be edited.',
  },
  'error.SWAP_TARGET_NOT_FOUND': {
    th: 'ไม่พบกรณีปลายทางที่เลือก · อาจถูกลบหรือย้ายหมวดไปแล้ว กรุณารีเฟรชแล้วลองใหม่',
    en: 'The case you chose to swap with no longer exists — refresh and try again.',
  },
  'error.SWAP_SELF': {
    th: 'สลับกรณีกับตัวเองไม่ได้',
    en: 'A case cannot be swapped with itself.',
  },
  'error.BAD_SCENARIO_NO': { th: 'หมายเลขกรณีไม่ถูกต้อง', en: 'Invalid case number' },
  'error.BAD_CASE_NO': { th: 'เลขรายงานไม่ถูกต้อง', en: 'Invalid report number' },
  'error.BAD_VERSION_ID': { th: 'รหัสเวอร์ชันไม่ถูกต้อง', en: 'Invalid version id' },
  'error.notEditor': {
    th: 'คุณไม่มีสิทธิ์แก้ไข SOP · อ่านได้อย่างเดียว',
    en: 'You do not have edit rights on the SOP — read-only.',
  },

  /* ------------------------------- sign-in ------------------------------- */
  // Reading is anonymous; signing in only matters for editing.
  'auth.readOnlyNote': {
    th: 'เปิดอ่าน SOP ได้โดยไม่ต้องเข้าสู่ระบบ · เข้าสู่ระบบเมื่อต้องการแก้ไขเท่านั้น',
    en: 'The SOP is readable without signing in — sign in only to edit.',
  },
  'auth.signInToEdit': { th: 'เข้าสู่ระบบเพื่อแก้ไข', en: 'Sign in to edit' },
  'auth.anonymous': { th: '(ยังไม่ได้เข้าสู่ระบบ)', en: '(not signed in)' },
  'auth.editorBadge': { th: 'ผู้แก้ไข', en: 'Editor' },
});

export default sopDict;
