// The HR Work Log's Thai/English dictionary.
//
// Re-keyed from the old `i18n_data.ts`, which keyed every entry on the Thai
// string itself:
//
//   'แดชบอร์ด': { en: 'Dashboard' }        <- the key WAS the Thai copy
//
// That made the Thai text load-bearing: correcting a typo, adding a space or
// changing a word in any Thai label silently orphaned its English translation,
// and the UI fell back to showing Thai to an English reader with no error
// anywhere. Keys here are dotted and stable, so Thai copy can be edited freely.
//
// Every Thai string was carried across MECHANICALLY, byte for byte, from
// i18n_data.ts — nothing was retranslated or paraphrased. Thai is written
// first in each pair because Thai is the default language (shared/src/i18n.jsx).
//
// Merged over commonDictionary by <I18nProvider>, so common.save / error.* and
// the rest are available without repeating them here. Where this module words
// something its own way, it is under `hr.*` rather than overriding `common.*`.

import { createDictionary } from '@vcb/shared';

export const dictionary = createDictionary({
  /* ------------------------ nav / chrome ------------------------ */
  'nav.dashboard': { th: 'แดชบอร์ด', en: 'Dashboard' },
  'nav.entry': { th: 'บันทึกงาน', en: 'Entry' },
  'nav.index': { th: 'ดัชนีงาน', en: 'Work Index' },
  'nav.requests': { th: 'คำขอ', en: 'Requests' },

  /* ---------------------- leave requests ---------------------- */
  'req.sub': { th: 'ขอลาและติดตามสถานะคำขอของคุณ', en: 'Request leave and track the status of your requests' },
  'req.new': { th: 'ขอลาใหม่', en: 'New Leave Request' },
  'req.empName': { th: 'ชื่อพนักงาน', en: 'Employee Name' },
  'req.selectSite': { th: '— เลือกหน่วยงาน —', en: '— Select site —' },
  'req.selectSiteFirst': { th: '— เลือกหน่วยงานก่อน —', en: '— Select a site first —' },
  'req.selectName': { th: '— เลือกชื่อ —', en: '— Select name —' },
  'req.fromDate': { th: 'วันที่เริ่มลา', en: 'Start Date' },
  'req.toDate': { th: 'วันที่สิ้นสุด', en: 'End Date' },
  'req.reason': { th: 'เหตุผล', en: 'Reason' },
  'req.reasonOptional': { th: 'เหตุผล (ถ้ามี)', en: 'Reason (optional)' },
  'req.reasonPlaceholder': { th: 'เช่น ลาป่วย ลากิจ ลาพักผ่อน', en: 'e.g. sick leave, personal leave, vacation' },
  'req.submit': { th: 'ส่งคำขอลา', en: 'Submit Request' },
  'req.mine': { th: 'คำขอของฉัน', en: 'My Requests' },
  'req.pickToSeeMine': { th: 'เลือกหน่วยงานและชื่อทางด้านซ้ายเพื่อดูคำขอของคุณ', en: 'Select a site and name on the left to see your requests' },
  'req.pendingAllSites': { th: 'รออนุมัติ (ทุกหน่วยงานในสิทธิ์ของคุณ)', en: 'Pending Approval (all sites in your access)' },
  'req.needEmployee': { th: 'กรุณาเลือกชื่อพนักงาน', en: 'Please select an employee name' },
  'req.needRange': { th: 'กรุณาระบุช่วงวันที่', en: 'Please specify a date range' },
  'req.badRange': { th: 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม', en: 'End date must not be before the start date' },
  'req.submitting': { th: 'กำลังส่ง…', en: 'Submitting…' },
  'req.submitted': { th: 'ส่งคำขอลาแล้ว รอการอนุมัติ', en: 'Leave request submitted — awaiting approval' },
  'req.submitFailed': { th: 'ส่งคำขอไม่สำเร็จ', en: 'Failed to submit request' },
  'req.submitFailedWith': { th: 'ส่งคำขอไม่สำเร็จ: ', en: 'Failed to submit request: ' },
  'req.print': { th: 'พิมพ์', en: 'Print' },
  'req.approve': { th: 'อนุมัติ', en: 'Approve' },
  'req.approved': { th: 'อนุมัติแล้ว', en: 'Approved' },
  'req.reject': { th: 'ไม่อนุมัติ', en: 'Reject' },
  'req.rejected': { th: 'ไม่อนุมัติแล้ว', en: 'Rejected' },
  'req.pending': { th: 'รอดำเนินการ', en: 'Pending' },
  'req.confirmApprove': { th: 'อนุมัติคำขอลานี้และบันทึกลงตารางงานหรือไม่?', en: 'Approve this leave request and record it on the schedule?' },
  'req.confirmReject': { th: 'ไม่อนุมัติคำขอลานี้หรือไม่?', en: 'Reject this leave request?' },
  'req.decideFailed': { th: 'ดำเนินการไม่สำเร็จ', en: 'Action failed' },
  'req.history': { th: 'ประวัติการพิจารณา', en: 'Decision History' },
  'req.noHistory': { th: 'ยังไม่มีประวัติการพิจารณา', en: 'No decisions recorded yet' },
  'req.all': { th: 'ทั้งหมด', en: 'All' },
  'req.working': { th: 'กำลังดำเนินการ…', en: 'Working…' },
  'req.pendingTab': { th: 'รออนุมัติ', en: 'Pending Approval' },
  'req.yourSites': { th: 'ทุกหน่วยงานในสิทธิ์ของคุณ', en: 'All sites in your access' },
  'req.showing': { th: 'แสดง', en: 'showing' },
  'req.cancel': { th: 'ยกเลิกคำขอ', en: 'Cancel request' },
  'req.confirmCancel': { th: 'ยกเลิกคำขอลานี้หรือไม่? การกระทำนี้ย้อนกลับไม่ได้', en: 'Cancel this leave request? This cannot be undone.' },
  'req.cancelled': { th: 'ยกเลิกคำขอแล้ว', en: 'Request cancelled' },
  'req.cancelFailed': { th: 'ยกเลิกไม่สำเร็จ', en: 'Could not cancel the request' },
  'req.alreadyDecided': { th: 'คำขอนี้ถูกพิจารณาแล้ว ยกเลิกไม่ได้', en: 'This request has already been decided and cannot be cancelled' },
  'req.noneMine': { th: 'ยังไม่มีคำขอลา', en: 'No leave requests yet' },
  'req.nonePending': { th: 'ไม่มีคำขอลาที่รอดำเนินการ', en: 'No pending leave requests' },
  'req.popupBlocked': { th: 'เบราว์เซอร์บล็อกหน้าต่างป็อปอัป', en: 'Your browser blocked the pop-up window' },

  /* ------------------ printed leave slip ------------------ */
  'slip.title': { th: 'ใบขอลา', en: 'Leave Request Form' },

  /* ---------------------- leave requests ---------------------- */
  'req.leaveType': { th: 'ประเภทการลา', en: 'Leave Type' },

  /* ------------------------- leave types ------------------------- */
  'leave.sick': { th: 'ลาป่วย', en: 'Sick Leave' },
  'leave.personal': { th: 'ลากิจ', en: 'Personal Leave' },
  'leave.vacation': { th: 'ลาพักผ่อน', en: 'Annual Leave' },
  'leave.maternity': { th: 'ลาคลอด', en: 'Maternity Leave' },
  'leave.ordination': { th: 'ลาบวช', en: 'Ordination Leave' },

  /* ---------------------- leave requests ---------------------- */
  'req.unspecified': { th: 'ไม่ระบุ', en: 'Unspecified' },

  /* ------------------------- leave types ------------------------- */
  'leave.leave': { th: 'ลา', en: 'Leave' },
  'leave.fromApproved': { th: 'บันทึกอัตโนมัติจากคำขอลาที่อนุมัติแล้ว', en: 'Filled automatically from an approved leave request' },

  /* ------------------ printed leave slip ------------------ */
  'slip.no': { th: 'เลขที่', en: 'No.' },
  'slip.company': { th: 'บริษัท', en: 'Company' },
  'slip.requester': { th: 'ข้อมูลผู้ขอลา', en: 'Requester Details' },
  'slip.details': { th: 'รายละเอียดการลา', en: 'Leave Details' },
  'slip.empId': { th: 'รหัสพนักงาน', en: 'Employee ID' },
  'slip.position': { th: 'ตำแหน่ง', en: 'Position' },
  'slip.contact': { th: 'เบอร์ติดต่อระหว่างลา', en: 'Contact During Leave' },
  'slip.covering': { th: 'ผู้ปฏิบัติงานแทน', en: 'Covering Duties' },

  /* ------------------------ app identity ------------------------ */
  'app.title': { th: 'บันทึกการทำงานรายวัน', en: 'HR Daily Work Log' },
  'app.printedFrom': { th: 'เอกสารนี้พิมพ์จากระบบบันทึกการทำงานรายวัน', en: 'Printed from the HR Daily Work Log system' },

  /* ---------------------- leave requests ---------------------- */
  'req.period': { th: 'ช่วงวันที่ลา', en: 'Leave Period' },
  'req.requestedAt': { th: 'วันที่ยื่นคำขอ', en: 'Date Requested' },
  'req.status': { th: 'สถานะ', en: 'Status' },
  'req.decidedBy': { th: 'ผู้อนุมัติ', en: 'Approved By' },

  /* ------------------ printed leave slip ------------------ */
  'slip.empSign': { th: 'ลายเซ็นพนักงาน', en: 'Employee Signature' },
  'slip.approverSign': { th: 'ลายเซ็นผู้อนุมัติ', en: 'Approver Signature' },

  /* ---------------------------- settings ---------------------------- */
  'set.permissions': { th: 'กำหนดสิทธิ์', en: 'Permissions' },

  /* --------------------------- dashboard --------------------------- */
  'dash.progress': { th: 'ความคืบหน้า', en: 'Progress' },
  'dash.topActLegacy': { th: 'งานหลัก', en: 'Top Activities' },

  /* ---------------------- work-log entry ---------------------- */
  'entry.weekly': { th: 'รายอาทิตย์', en: 'Weekly' },
  'entry.overview': { th: 'ภาพรวม', en: 'Overview' },
  'entry.site': { th: 'หน่วยงาน', en: 'Site' },
  'entry.month': { th: 'เดือน', en: 'Month' },
  'entry.view': { th: 'มุมมอง', en: 'View' },
  'entry.week': { th: 'สัปดาห์', en: 'Week' },
  'entry.employees': { th: 'พนักงาน', en: 'Employees' },
  'entry.support': { th: 'สนับสนุน', en: 'Support' },
  'entry.operation': { th: 'ปฏิบัติการ', en: 'Operation' },

  /* --------------------------- dashboard --------------------------- */
  'dash.openLog': { th: 'เปิดบันทึก →', en: 'Open log →' },
  'dash.started': { th: 'เริ่มบันทึกแล้ว', en: 'Started recording' },
  'dash.fillRate': { th: 'เติมข้อมูล', en: 'Fill rate' },
  'dash.cells': { th: 'ช่อง', en: 'cells' },

  /* ---------------------- work-log entry ---------------------- */
  'entry.viewOnly': { th: 'มุมมองอย่างเดียว — ติดต่อแอดมินเพื่อขอสิทธิ์บันทึก', en: 'View only — contact admin for edit access' },

  /* -------------------------------- misc -------------------------------- */
  'common.others': { th: 'อื่นๆ', en: 'Others' },

  /* --------------------------- dashboard --------------------------- */
  'dash.noEntriesThisMonth': { th: 'ยังไม่มีบันทึกในเดือนนี้', en: 'No entries this month' },
  'dash.noSites': { th: 'ยังไม่มีหน่วยงานในสิทธิ์ของคุณ', en: 'No sites in your access' },
  'dash.askForAccess': { th: 'ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์ดูหน่วยงาน', en: 'Contact admin for site access' },

  /* ---------------------- work-log entry ---------------------- */
  'entry.ready': { th: 'พร้อมแก้ไข', en: 'Ready' },
  'entry.unsaved': { th: 'แก้ไขที่ยังไม่บันทึก', en: 'Unsaved changes' },
  'entry.saving': { th: 'กำลังบันทึก…', en: 'Saving…' },
  'entry.savingAlt': { th: 'กำลังบันทึก...', en: 'Saving…' },
  'entry.saved': { th: 'บันทึกแล้ว', en: 'Saved' },
  'entry.saveFailed': { th: 'บันทึกไม่สำเร็จ', en: 'Save failed' },
  'entry.loading': { th: 'กำลังโหลด…', en: 'Loading…' },
  'entry.preparingFile': { th: 'กำลังเตรียมไฟล์…', en: 'Preparing file…' },

  /* -- words this module words its own way -- */
  'hr.save': { th: 'บันทึก', en: 'Save' },
  'hr.add': { th: 'เพิ่ม', en: 'Add' },
  'hr.delete': { th: 'ลบ', en: 'Delete' },
  'hr.edit': { th: 'แก้ไข', en: 'Edit' },
  'hr.cancel': { th: 'ยกเลิก', en: 'Cancel' },
  'hr.ok': { th: 'ตกลง', en: 'OK' },
  'hr.confirm': { th: 'ยืนยัน', en: 'Confirm' },
  'hr.email': { th: 'อีเมล', en: 'Email' },
  'hr.role': { th: 'บทบาท', en: 'Role' },

  /* -------------------------- work index -------------------------- */
  'idx.titleFull': { th: 'ดัชนีงาน (Master Work Index)', en: 'Work Index (Master)' },
  'idx.jobCode': { th: 'รหัสงาน', en: 'Job Code' },
  'idx.name': { th: 'ชื่อ', en: 'Name' },
  'idx.desc': { th: 'คำอธิบาย', en: 'Description' },
  'idx.category': { th: 'หมวดหมู่', en: 'Category' },
  'idx.usedAtSites': { th: 'ใช้ที่หน่วยงาน', en: 'Used at sites' },
  'idx.addEntry': { th: '+ เพิ่มรายการ', en: '+ Add entry' },

  /* ---------------------- work-log entry ---------------------- */
  'entry.addEmployee': { th: '+ เพิ่มพนักงาน', en: '+ Add employee' },

  /* ---------------------------- settings ---------------------------- */
  'set.usersAndRoles': { th: 'ผู้ใช้และสิทธิ์', en: 'Users & Permissions' },

  /* ------------------------ nav / chrome ------------------------ */
  'nav.settings': { th: 'ตั้งค่า', en: 'Settings' },
  'nav.backToPortal': { th: 'กลับไปหน้าหลัก VCB Connect', en: 'Back to VCB Connect home' },

  /* ---------------------------- settings ---------------------------- */
  'set.theme': { th: 'ธีม', en: 'Theme' },
  'set.light': { th: 'สว่าง', en: 'Light' },
  'set.dark': { th: 'มืด', en: 'Dark' },
  'set.auto': { th: 'อัตโนมัติ (ตามระบบ)', en: 'Auto (system)' },
  'set.language': { th: 'ภาษา', en: 'Language' },
  'set.thai': { th: 'ไทย', en: 'Thai' },
  'set.english': { th: 'อังกฤษ', en: 'English' },
  'set.yearFormat': { th: 'รูปแบบปี', en: 'Year format' },
  'set.be': { th: 'พุทธศักราช (2569)', en: 'Buddhist Era (2569)' },
  'set.ce': { th: 'คริสต์ศักราช (2026)', en: 'Gregorian (2026)' },
  'set.dashDefault': { th: 'มุมมองเริ่มต้นของแดชบอร์ด', en: 'Default dashboard view' },
  'set.cellDisplay': { th: 'การแสดงในตารางสัปดาห์', en: 'Weekly grid display' },

  /* ---------------------- work-log entry ---------------------- */
  'entry.highlightCode': { th: 'ไฮไลต์รหัส', en: 'Highlight code' },
  'entry.pickHighlight': { th: '+ เลือกรหัสเพื่อเน้น…', en: '+ Pick a code to highlight…' },
  'entry.cellsUnit': { th: 'เซลล์', en: 'cells' },

  /* ------------------ roster / transfers ------------------ */
  'roster.people': { th: 'คน', en: 'people' },
  'roster.remove': { th: 'เอาออก', en: 'Remove' },
  'roster.transferSite': { th: 'ย้ายหน่วยงาน', en: 'Transfer site' },
  'roster.transferEmployee': { th: 'ย้ายพนักงาน', en: 'Transfer employee' },
  'roster.removeEmployee': { th: 'ลบพนักงาน', en: 'Remove employee' },
  'roster.movedInFrom': { th: 'ย้ายเข้าจาก', en: 'Moved in from' },
  'roster.movedOutTo': { th: 'ย้ายออกไป', en: 'Moved out to' },
  'roster.movedIn': { th: 'ย้ายเข้า', en: 'Moved in' },
  'roster.notAtSite': { th: 'ไม่ได้สังกัดหน่วยงานนี้', en: 'Not at this site on this day' },
  'roster.noDestination': { th: 'ไม่มีหน่วยงานปลายทาง', en: 'No destination site' },
  'roster.moveTo': { th: 'ย้ายไปหน่วยงาน', en: 'Move to site' },
  'roster.effectiveFrom': { th: 'มีผลตั้งแต่วันที่', en: 'Effective from' },
  'roster.moveExplain': { th: 'พนักงานจะอยู่หน่วยงานเดิมก่อนวันที่นี้ และอยู่หน่วยงานใหม่ตั้งแต่วันนี้เป็นต้นไป — อยู่ได้ทีละหน่วยงานต่อวันเท่านั้น', en: 'They stay at the old site before this date and the new site from this date on — only one site per day.' },
  'roster.move': { th: 'ย้าย', en: 'Move' },
  'roster.fillAll': { th: 'กรอกข้อมูลให้ครบ', en: 'Fill in all fields' },
  'roster.moving': { th: 'กำลังย้าย…', en: 'Moving…' },
  'roster.moved': { th: 'ย้ายหน่วยงานแล้ว', en: 'Transferred' },
  'roster.moveFailed': { th: 'ย้ายไม่สำเร็จ', en: 'Transfer failed' },
  'roster.removeExplain': { th: 'ประวัติการบันทึกจะยังอยู่ แต่จะไม่แสดงในรายชื่ออีก', en: 'Their logged history is kept, but they will no longer appear in the list.' },
  'roster.removed': { th: 'ลบพนักงานแล้ว', en: 'Employee removed' },
  'roster.sameSite': { th: 'เป็นหน่วยงานเดิมอยู่แล้ว', en: 'Already at that site' },
  'roster.dateBeforePrev': { th: 'วันที่ต้องไม่ก่อนการย้ายครั้งก่อน', en: 'Date cannot be before the previous transfer' },
  'roster.currentlyAt': { th: 'ปัจจุบัน', en: 'Currently at' },
  'roster.undoHint': { th: 'ย้ายผิด? เลือกหน่วยงานเดิมแล้วใช้วันที่เดียวกัน เพื่อย้ายกลับ/ยกเลิกการย้าย', en: 'Wrong move? Pick the old site with the SAME date to move back / undo it.' },
  'roster.destNotFound': { th: 'ไม่พบหน่วยงานปลายทาง', en: 'Destination site not found' },
  'roster.empNotFound': { th: 'ไม่พบพนักงาน', en: 'Employee not found' },
  'roster.incomplete': { th: 'ข้อมูลไม่ครบ', en: 'Incomplete data' },

  /* ------------------------ edit history ------------------------ */
  'audit.lastBackdated': { th: 'แก้ไขย้อนหลังล่าสุด', en: 'Last back-dated edit' },
  'audit.backdated': { th: 'แก้ไขย้อนหลัง', en: 'edited' },
  'audit.backdateAdmin': { th: 'แก้ไขย้อนหลัง (admin)', en: 'Back-date edit (admin)' },
  'audit.backdateOn': { th: 'แก้ไขย้อนหลังเปิดอยู่', en: 'Back-date edit ON' },
  'audit.adminsOnly': { th: 'ผู้ดูแลระบบเท่านั้น', en: 'Admins only' },
  'audit.by': { th: 'โดย', en: 'by' },

  /* --------------------------- dashboard --------------------------- */
  'dash.topAct': { th: 'กิจกรรมหลัก', en: 'Top Activities' },
  'dash.topCost': { th: 'หมวดงานหลัก', en: 'Top Categories' },
  'dash.mandays': { th: 'วันทำงาน', en: 'mandays' },
  'dash.showAll': { th: 'ดูทั้งหมด', en: 'Show all' },
  'dash.collapse': { th: 'ย่อ', en: 'Collapse' },

  /* ---------------------------- settings ---------------------------- */
  'set.cellDisplayHint': { th: 'แสดงกิจกรรมเป็นรหัส (A-1) หรือชื่อเต็ม — หมวดงานยังคงเป็นตัวเลขเสมอ', en: 'Show the activity as a code (A-1) or its full name — Work Category stays a number' },
  'set.cellCode': { th: 'รหัส (A-1 / 5)', en: 'Code (A-1 / 5)' },
  'set.cellName': { th: 'ชื่อกิจกรรม (เต็ม) / 5', en: 'Activity name (full) / 5' },
  'set.lockWindow': { th: 'ระยะเวลาแก้ย้อนหลัง', en: 'Edit-back window' },
  'set.daysUnit': { th: 'วัน', en: 'days' },
  'set.about': { th: 'เกี่ยวกับระบบ', en: 'About' },
  'set.version': { th: 'เวอร์ชัน', en: 'Version' },
  'set.sitesManaged': { th: 'หน่วยงานที่ดูแล', en: 'Sites managed' },

  /* ---------------------- work-log entry ---------------------- */
  'entry.chooseSiteDots': { th: 'เลือกหน่วยงาน...', en: 'Choose site...' },
  'entry.chooseSite': { th: 'เลือกหน่วยงาน', en: 'Choose site' },

  /* --------------------------- dashboard --------------------------- */
  'dash.sub': { th: 'ภาพรวมการบันทึกการทำงานรายหน่วยงาน', en: 'Daily work-log overview by site' },

  /* ---------------------------- settings ---------------------------- */
  'set.storedPerDevice': { th: 'การตั้งค่าจะถูกเก็บไว้ในเครื่อง (แต่ละเครื่องอาจไม่เหมือนกัน)', en: 'Preferences are saved per device (each device can differ)' },
  'set.themeHint': { th: 'โหมดสว่าง โหมดมืด หรือทำตามระบบของเครื่อง', en: 'Light, dark, or follow the system theme' },
  'set.languageHint': { th: 'สลับภาษาที่แสดงในเมนูและฉลาก (ข้อมูลจริงคงเดิม)', en: 'Switch the language for menus & labels (data is unchanged)' },
  'set.yearHint': { th: 'แสดงปีในเครื่องมือเลือกเดือนเป็น พ.ศ. หรือ ค.ศ.', en: 'Show year in the month picker as Buddhist or Gregorian Era' },
  'set.dashDefaultHint': { th: 'เลือกว่าจะเปิดแดชบอร์ดด้วยมุมมองไหนเป็นค่าเริ่มต้น', en: 'Choose which view the dashboard opens with by default' },
  'set.lockDaysHint': { th: 'Manager แก้ไขเซลล์ย้อนหลังได้กี่วัน · admin แก้ได้ตลอด · บังคับใช้ทั้งระบบ', en: 'How many days back managers can edit · admin always can · applies system-wide' },
  'set.addUserHint': { th: 'เพิ่มอีเมลเจ้าหน้าที่ที่จะบันทึกข้อมูล แล้วกำหนดบทบาท/หน่วยงาน', en: 'Add the email of an HR user, then assign role/site' },

  /* -- words this module words its own way -- */
  'hr.failed': { th: 'ไม่สำเร็จ', en: 'Failed' },

  /* --------------------------- dashboard --------------------------- */
  'dash.entriesIn': { th: 'รายการใน', en: 'entries in' },
  'dash.records': { th: 'รายการ', en: 'records' },
  'dash.startedIn': { th: 'พนักงานที่บันทึกอย่างน้อย 1 วันใน', en: 'Employees with at least 1 day recorded in ' },
  'dash.totalEmployees': { th: 'พนักงานทั้งหมดในหน่วยงาน', en: 'Total employees at this site' },

  /* ----------------------- company names ----------------------- */
  'company.vichitbhan': { th: 'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด', en: 'Vichitbhan Construction Co.,Ltd.' },
  'company.chavana': { th: 'บริษัท ชวนา เอ็นจิเนียริ่ง จำกัด', en: 'Chavana Engineering Co.,Ltd.' },

  /* --------------------------- dashboard --------------------------- */
  'dash.tapEmployee': { th: 'แตะชื่อพนักงานเพื่อดู/บันทึกของเดือน', en: 'Tap an employee to view/record their entries for' },

  /* ---------------------------- settings ---------------------------- */
  'set.revokeFor': { th: 'ลบสิทธิ์ของ', en: 'Revoke access for' },
  'set.deleting': { th: 'กำลังลบ…', en: 'Deleting…' },
  'set.deleted': { th: 'ลบแล้ว', en: 'Deleted' },
  'set.deleteFailed': { th: 'ลบไม่สำเร็จ', en: 'Delete failed' },
  'set.enterEmail': { th: 'กรอกอีเมล', en: 'Enter an email' },
  'set.userSaved': { th: 'บันทึกผู้ใช้แล้ว', en: 'User saved' },

  /* -------------------------- work index -------------------------- */
  'idx.teamsSub': { th: 'รายการมาตรฐานของทีมงาน/ประเภทงานที่ใช้ทุกหน่วยงาน · ใช้เป็นตัวเลือกในการบันทึกงานปฏิบัติการ', en: 'Standard list of teams / work types shared across all sites — used as picker options when recording operation logs' },
  'idx.exportHint': { th: 'ส่งออกดัชนีงานทั้งหมดเป็นไฟล์ Excel (.xlsx) โดยคงรูปแบบเดิมไว้', en: 'Export the full Work Index as Excel (.xlsx) with formatting preserved' },

  /* ---------------------------- settings ---------------------------- */
  'set.allSitesAdmin': { th: '(ทุกหน่วยงาน — admin)', en: '(All sites — admin)' },
  'set.roleHint': { th: 'admin เข้าถึงทุกหน่วยงานโดยอัตโนมัติ · manager คลิกดรอปดาวน์เพื่อเลือกหลายหน่วยงาน', en: 'admin = all sites automatically · manager = click dropdown to pick multiple sites' },

  /* --------------------------- dashboard --------------------------- */
  'dash.allHiddenLong': { th: 'หน่วยงานทั้งหมดถูกซ่อนอยู่ — เปิดได้ที่ ⚙ ตั้งค่า', en: 'All sites are hidden — re-enable in ⚙ Settings' },

  /* -------------------------- work index -------------------------- */
  'idx.activities': { th: 'กิจกรรม', en: 'Activities' },

  /* --------------------------- dashboard --------------------------- */
  'dash.mandayReport': { th: 'รายงานวันทำงาน', en: 'Manday report' },
  'dash.report': { th: 'รายงาน', en: 'Report' },
  'dash.exporting': { th: 'กำลังส่งออก…', en: 'Exporting…' },
  'dash.mandayReportHint': { th: 'ส่งออกสรุปวันทำงานรายหมวดงาน/กิจกรรม สำหรับเดือนนี้ (Excel)', en: 'Export this month manday summary by Work Category / Activity (Excel)' },

  /* -------------------------- work index -------------------------- */
  'idx.costs': { th: 'หมวดงาน', en: 'Work Categories' },

  /* --------------------------- dashboard --------------------------- */
  'dash.allHidden': { th: 'หน่วยงานทั้งหมดถูกซ่อนอยู่', en: 'All sites are hidden' },
  'dash.allHiddenHelp': { th: 'เปิดหน่วยงานที่ต้องการได้ที่ ⚙ ตั้งค่า › หน่วยงานที่แสดง', en: 'Re-enable sites in ⚙ Settings › Visible sites' },
  'dash.completeness': { th: 'ความสมบูรณ์ของการบันทึก (เฉพาะวันทำงานที่ผ่านมา) ใน', en: 'Recording completeness (workdays passed only) in ' },
  'dash.complete': { th: 'บันทึกครบ', en: 'Complete' },
  'dash.atLeastOneDay': { th: 'พนักงานที่ลงอย่างน้อย 1 วัน', en: 'Employees with at least 1 day logged' },

  /* -------------------------- work index -------------------------- */
  'idx.sub': { th: 'รายการมาตรฐานที่ใช้บันทึกงาน — แต่ละเซลล์เลือก 2 ชั้น: กิจกรรม แล้วตามด้วย หมวดงาน', en: 'Standard list for logging work — each cell picks 2 layers: Activity, then Work Category' },
  'idx.activityTab': { th: 'กิจกรรม (Activity)', en: 'Activity' },
  'idx.costTab': { th: 'หมวดงาน (Work Category)', en: 'Work Category' },
  'idx.importItems': { th: 'นำเข้ารายการดัชนีงาน', en: 'Import index items' },
  'idx.importCosts': { th: 'นำเข้าหมวดงาน', en: 'Import Work Categories' },
  'idx.howToImport': { th: 'วิธีนำเข้า', en: 'How to import' },
  'idx.importStep1': { th: 'กดปุ่ม “ดาวน์โหลดเทมเพลต” เพื่อรับไฟล์ Excel ที่มีหัวคอลัมน์ถูกต้อง', en: 'Click "Download template" to get an Excel file with the correct column headers.' },
  'idx.importStep2': { th: 'กรอกข้อมูลในไฟล์ตามคอลัมน์ที่กำหนด (มีตัวอย่างให้ในแถวที่ 2)', en: 'Fill in the file following the given columns (row 2 shows an example).' },
  'idx.importStep3': { th: 'เลือกทุกแถวที่กรอกแล้วใน Excel → คัดลอก (Ctrl+C) → วางในช่องด้านล่าง (Ctrl+V)', en: 'Select your filled rows in Excel → copy (Ctrl+C) → paste in the box below (Ctrl+V).' },
  'idx.columnOrder': { th: 'ลำดับคอลัมน์:', en: 'Column order:' },
  'idx.downloadTemplate': { th: 'ดาวน์โหลดเทมเพลต Excel', en: 'Download Excel template' },
  'idx.exportExcel': { th: 'ส่งออก Excel', en: 'Export Excel' },
  'idx.downloadBlank': { th: 'ดาวน์โหลดเทมเพลตเปล่า', en: 'Download blank template' },
  'idx.chooseFilled': { th: 'เลือกไฟล์ที่กรอกแล้ว', en: 'Choose filled file' },
  'idx.downloadBlankBelow': { th: 'ดาวน์โหลดเทมเพลตเปล่าด้านล่าง', en: 'Download the blank template below' },
  'idx.fillTemplate': { th: 'กรอกข้อมูลลงในไฟล์ Excel ตามคอลัมน์ที่กำหนด (เขียนทับแถวตัวอย่างได้)', en: 'Fill in the Excel file following the columns (overwrite the example row)' },
  'idx.chooseFilledHint': { th: 'กด “เลือกไฟล์ที่กรอกแล้ว” แล้วเลือกไฟล์ที่บันทึกไว้ — ระบบจะนำเข้าให้ทันที', en: 'Click “Choose filled file” and pick your saved file — it imports immediately' },
  'idx.readFailed': { th: 'อ่านไฟล์ไม่สำเร็จ', en: 'Could not read the file' },

  /* -- words this module words its own way -- */
  'hr.close': { th: 'ปิด', en: 'Close' },

  /* -------------------------- work index -------------------------- */
  'idx.deleteItem': { th: 'ลบรายการ', en: 'Delete item' },
  'idx.fromIndex': { th: 'ออกจากดัชนี?', en: 'from the index?' },

  /* ---------------------------- settings ---------------------------- */
  'set.removeUserAccess': { th: 'ลบสิทธิ์ผู้ใช้', en: 'Remove user access' },

  /* -------------------------- work index -------------------------- */
  'idx.pasteCosts': { th: 'วางข้อมูลจาก Excel — หนึ่งบรรทัดต่อหนึ่งหมวดงาน · คอลัมน์: รหัส, ชื่อ (ไทย), ชื่อ (อังกฤษ) (คั่นด้วย Tab หรือ ,) · แถวหัวตารางใส่หรือไม่ก็ได้', en: 'Paste from Excel — one row per Work Category · columns: code, name (Thai), name (English) (Tab or comma separated) · header row optional' },
  'idx.pasteItems': { th: 'วางข้อมูลจาก Excel — หนึ่งบรรทัดต่อหนึ่งงาน · คอลัมน์: ชื่อ, คำอธิบาย, หมวดหมู่, รหัส (คั่นด้วย Tab หรือ ,) · แถวหัวตารางใส่หรือไม่ก็ได้', en: 'Paste from Excel — one row per item · columns: name, description, category, code (Tab or comma separated) · header row optional' },
  'idx.import': { th: 'นำเข้า', en: 'Import' },
  'idx.nothingToImport': { th: 'ยังไม่มีข้อมูลที่จะนำเข้า', en: 'Nothing to import' },
  'idx.importing': { th: 'กำลังนำเข้า…', en: 'Importing…' },
  'idx.imported': { th: 'นำเข้าแล้ว', en: 'Imported' },
  'idx.updated': { th: 'อัปเดต', en: 'Updated' },
  'idx.skipped': { th: 'ข้าม', en: 'Skipped' },
  'idx.importFailed': { th: 'นำเข้าไม่สำเร็จ', en: 'Import failed' },
  'idx.costLayer2': { th: 'หมวดงาน (ชั้นที่ 2)', en: 'Work Category (layer 2)' },
  'idx.addCost': { th: '+ เพิ่มหมวดงาน', en: '+ Add Work Category' },
  'idx.code': { th: 'รหัส', en: 'Code' },
  'idx.costNameTh': { th: 'หมวดงาน (ไทย)', en: 'Name (Thai)' },
  'idx.empty': { th: 'ยังไม่มีรายการ', en: 'No items yet' },
  'idx.addCostTitle': { th: 'เพิ่มหมวดงาน', en: 'Add Work Category' },
  'idx.editCost': { th: 'แก้ไขหมวดงาน', en: 'Edit Work Category' },
  'idx.autoNumber': { th: 'เว้นว่างเพื่อสร้างเลขถัดไปอัตโนมัติ', en: 'Leave blank to auto-number' },
  'idx.enterName': { th: 'กรอกชื่อ', en: 'Enter a name' },
  'idx.sortHint': { th: 'คลิกหัวคอลัมน์เพื่อจัดเรียง', en: 'Click a column header to sort' },
  'idx.addActivity': { th: '+ เพิ่มกิจกรรม', en: '+ Add Activity' },
  'idx.pickOrTypeCategory': { th: 'เลือกหรือพิมพ์หมวดหมู่ใหม่', en: 'Select or type a new category' },

  /* -------------------------------- help -------------------------------- */
  'help.step1': { th: 'เลือกหน่วยงานและสัปดาห์', en: 'Choose site and week' },
  'help.step1Body': { th: 'แถบด้านบน: เลือกหน่วยงาน เดือน และสัปดาห์ที่ต้องการบันทึก', en: 'Top bar: choose the site, month, and week to log' },
  'help.step2': { th: 'คลิกช่องว่างของพนักงาน', en: 'Click an empty cell for the employee' },
  'help.step2Body': { th: 'คลิกช่องที่ขึ้น “+ เลือกงาน” แล้วเลือกกิจกรรม — ถ้าระบบถามหมวดงาน ให้เลือกต่ออีกหนึ่งครั้ง', en: 'Click a cell showing “+ Select work”, choose the Activity — if it asks for a Work Category, pick one more' },
  'help.step3': { th: 'ไม่ต้องกดบันทึก', en: 'No need to save' },
  'help.step3Body': { th: 'ระบบบันทึกให้อัตโนมัติ — ช่องจะแสดงรหัสงานเมื่อบันทึกเสร็จ', en: 'It saves automatically — the cell shows the code once saved' },
  'help.step4': { th: 'ทำ 2 งานในวันเดียว', en: 'Two tasks in one day' },
  'help.step4Body': { th: 'หลังกรอกงานแรกแล้ว ปุ่ม “+ งานที่ 2” จะปรากฏใต้ช่อง · ระบบถ่วงน้ำหนักให้อัตโนมัติงานละ 50% (0.5 วันทำงาน) รวมเป็น 1 วันทำงานต่อคนต่อวันเสมอ — บนแดชบอร์ดจึงแบ่งครึ่ง-ครึ่ง ไม่ใช่ 1 วันทำงานต่องาน เพื่อไม่ให้วันทำงานรวมเกินจำนวนพนักงาน', en: 'After the first task, a “+ Task 2” button appears below · the system auto-weights each task at 50% (0.5 man-day), always totaling 1 man-day per person per day — so the dashboard splits it half-and-half, not 1 man-day per task, keeping total man-days within headcount' },
  'help.step5': { th: 'แก้ไข & ดูภาพรวม', en: 'Edit & Overview' },
  'help.step5Body': { th: 'แก้ย้อนหลังได้ตามกำหนด และกรอกล่วงหน้าได้ถึงพรุ่งนี้ · แท็บ “ภาพรวม” = แผนที่สี: เขียว = ครบ, เหลือง = ยังแก้ได้, แดง = ขาด', en: 'Edit back within the limit, and log up to tomorrow · the “Overview” tab is a colour map: green = complete, yellow = still editable, red = missing' },
  'help.title': { th: 'วิธีใช้งานหน้าบันทึกงาน', en: 'How to use the work-log page' },
  'help.readFirst': { th: 'วิธีใช้งานหน้านี้ (อ่านก่อนเริ่ม)', en: 'How to use this page (read first)' },

  /* ---------------------------- settings ---------------------------- */
  'set.visibleSites': { th: 'หน่วยงานที่แสดง', en: 'Visible sites' },
  'set.visibleSitesHint': { th: 'ปิดหน่วยงานที่จบแล้วเพื่อซ่อนจากแดชบอร์ดและรายการเลือก (เฉพาะเครื่องนี้)', en: 'Turn off finished sites to hide them from the dashboard and pickers (this device only)' },
  'set.projects': { th: 'โครงการ / หน่วยงาน', en: 'Projects / Sites' },
  'set.projectsHint': { th: 'เพิ่มโครงการใหม่ หรือปิดโครงการที่จบแล้ว · โครงการที่ปิดจะไม่ให้บันทึกงานใหม่ แต่ประวัติเดิมยังอยู่ในแดชบอร์ด', en: 'Add a new project, or close a finished one · closed projects accept no new entries but keep their history on the dashboard' },
  'set.newProjectName': { th: 'ชื่อโครงการใหม่', en: 'New project name' },
  'set.newProjectCompany': { th: 'บริษัท (ถ้ามี)', en: 'Company (optional)' },
  'set.addProject': { th: 'เพิ่มโครงการ', en: 'Add project' },
  'set.addingProject': { th: 'กำลังเพิ่ม…', en: 'Adding…' },
  'set.projectAdded': { th: 'เพิ่มโครงการแล้ว', en: 'Project added' },
  'set.addProjectFailed': { th: 'เพิ่มโครงการไม่สำเร็จ', en: 'Could not add the project' },
  'set.projectDuplicate': { th: 'มีโครงการชื่อนี้อยู่แล้ว', en: 'A project with this name already exists' },
  'set.projectNameRequired': { th: 'กรุณาระบุชื่อโครงการ', en: 'Please enter a project name' },
  'set.projectListFailed': { th: 'โหลดรายการโครงการไม่สำเร็จ', en: 'Could not load the project list' },
  'set.closeProject': { th: 'ปิดโครงการ', en: 'Close project' },
  'set.confirmCloseProject': { th: 'ปิดโครงการนี้หรือไม่?', en: 'Close this project?' },
  'set.stillAssigned': { th: 'คนยังอยู่ในโครงการนี้', en: 'people are still assigned to it' },
  'set.closeProjectExplain': { th: 'จะไม่สามารถบันทึกงานใหม่ได้ แต่ประวัติเดิมยังอยู่', en: 'No new entries can be logged, but existing history is kept.' },
  'set.projectClosed': { th: 'ปิดโครงการแล้ว', en: 'Project closed' },
  'set.projectReopened': { th: 'เปิดโครงการแล้ว', en: 'Project reopened' },
  'set.noSites': { th: 'ไม่มีหน่วยงาน', en: 'No sites' },

  /* ------------------------ edit history ------------------------ */
  'audit.title': { th: 'ประวัติการแก้ไข', en: 'Edit history' },
  'audit.sub': { th: 'ดูบันทึกว่าใครแก้ไขอะไร เมื่อไร พร้อมค้นหาและกรอง', en: 'See who changed what and when, with search and filters' },
  'audit.open': { th: 'เปิดประวัติการแก้ไข', en: 'Open edit history' },

  /* ---------------------- work-log entry ---------------------- */
  'entry.note': { th: 'หมายเหตุ', en: 'Note' },
  'entry.task1': { th: 'งานที่ 1', en: 'Task 1' },
  'entry.task2': { th: 'งานที่ 2', en: 'Task 2' },
  'entry.work': { th: 'งาน', en: 'Work' },

  /* ------------------------ edit history ------------------------ */
  'audit.allSites': { th: 'ทุกหน่วยงาน', en: 'All sites' },
  'audit.searchPlaceholder': { th: 'ค้นหา อีเมล / ชื่อ / ค่า', en: 'Search email / name / value' },
  'audit.allFields': { th: 'ทุกช่อง', en: 'All fields' },
  'audit.noResults': { th: 'ไม่พบรายการ', en: 'No results' },
  'audit.time': { th: 'เวลา', en: 'Time' },
  'audit.editedBy': { th: 'ผู้แก้ไข', en: 'Edited by' },
  'audit.date': { th: 'วันที่', en: 'Date' },
  'audit.oldVal': { th: 'เดิม', en: 'Old' },
  'audit.newVal': { th: 'ใหม่', en: 'New' },
  'audit.loadFailed': { th: 'โหลดไม่สำเร็จ', en: 'Load failed' },
  'audit.empty': { th: 'ยังไม่มีประวัติการแก้ไข', en: 'No edit history yet' },

  /* ---------------------- work-log entry ---------------------- */
  'entry.rest': { th: 'พัก', en: 'Rest' },
  'entry.legendA': { th: 'เหลือง = ยังแก้ไขได้ (ย้อนหลัง', en: 'Yellow = still editable (back' },
  'entry.legendB': { th: 'วัน ถึงพรุ่งนี้) · เขียว = บันทึกครบ 100% (ล็อกแล้ว) · แดง = ขาด/ไม่ครบ · เทา = ยังไม่ถึงกำหนด · พัก = วันหยุด', en: 'days, through tomorrow) · Green = fully logged (locked) · Red = missing/incomplete · Grey = not due yet · Rest = day off' },
  'entry.coverageHint': { th: 'คลิกเซลล์เพื่อกระโดดไปแก้พนักงาน/วันนั้นในมุมมองสัปดาห์ · 🔦 เลือกรหัสด้านบนเพื่อเน้นทุกเซลล์ของงานนั้น', en: 'Click a cell to jump to that employee/day in the weekly view · 🔦 pick a code above to highlight every cell of that work' },
  'entry.highlightLabel': { th: '🔦 ไฮไลต์รหัส', en: '🔦 Highlight code' },
  'entry.highlightPick': { th: '+ เลือกรหัสเพื่อเน้น…', en: '+ Pick a code to highlight…' },
  'entry.highlightRemove': { th: 'เอาออก', en: 'Remove' },
  'entry.away': { th: 'ไม่ได้สังกัดหน่วยงานนี้', en: 'Not on this site' },
  'entry.addSecond': { th: '+ งานที่ 2', en: '+ Task 2' },
  'entry.dayOff': { th: 'วันหยุด', en: 'Day off' },
  'entry.weeklyHint': { th: 'คลิกที่ช่องเพื่อเลือกกิจกรรม → หมวดงาน', en: 'Click a cell to choose Activity → Work Category' },
  'entry.lockedBeyond': { th: 'เซลล์ที่เกิน', en: 'Cells older than' },
  'entry.lockedAuto': { th: 'วันจะล็อกอัตโนมัติ', en: 'days lock automatically' },
  'entry.cleared': { th: 'ล้างเซลล์', en: 'Cell cleared' },
  'entry.noEmployees': { th: 'ยังไม่มีพนักงานในหน่วยงานนี้', en: 'No employees at this site yet' },
  'entry.prevWeek': { th: 'สัปดาห์ก่อน', en: 'Previous week' },
  'entry.nextWeek': { th: 'สัปดาห์ถัดไป', en: 'Next week' },

  /* --------------------- activity picker --------------------- */
  'pick.step1': { th: 'เลือกกิจกรรม (Activity)', en: 'Choose an Activity' },
  'pick.step2': { th: 'เลือกหมวดงาน', en: 'Choose a Work Category' },
  'pick.search': { th: 'ค้นหา…', en: 'Search…' },
  'pick.clear': { th: 'ล้าง', en: 'Clear' },
  'pick.fixedCostHint': { th: 'กำหนดต้นทุนอัตโนมัติ · เลือกขั้นตอนเดียว', en: 'Cost assigned automatically · one step only' },
  'pick.twoStepHint': { th: 'เลือกหมวดต้นทุนต่อ · 2 ขั้นตอน', en: 'Pick a Work Category next · 2 steps' },

  /* ---------------------------- settings ---------------------------- */
  'set.sub': { th: 'ปรับแต่งการแสดงผลและการทำงานของระบบ', en: 'Adjust how the system looks and behaves' },
  'set.display': { th: 'การแสดงผล', en: 'Display' },
  'set.autoShort': { th: 'อัตโนมัติ', en: 'Auto' },
  'set.cellDisplayDesc': { th: 'แสดงเซลล์เป็นรหัส หรือชื่อกิจกรรมเต็ม', en: 'Show cells as a code, or the full activity name' },
  'set.cellFullName': { th: 'ชื่อเต็ม', en: 'Full name' },
  'set.visibleSitesDesc': { th: 'ซ่อนหน่วยงานที่ทำเสร็จแล้วออกจากแดชบอร์ด (เฉพาะอุปกรณ์นี้)', en: 'Hide finished sites from the dashboard (this device only)' },
  'set.hide': { th: 'ซ่อน', en: 'Hide' },
  'set.system': { th: 'ระบบ', en: 'System' },
  'set.lockDaysDesc': { th: 'จำนวนวันที่ยังแก้เซลล์ย้อนหลังได้ (0–30)', en: 'How many days back a cell can still be edited (0–30)' },
  'set.manual': { th: 'คู่มือการใช้งาน', en: 'User guide' },
  'set.openManual': { th: 'เปิดคู่มือ', en: 'Open guide' },
  'set.user': { th: 'ผู้ใช้งาน', en: 'User' },
  'set.rights': { th: 'สิทธิ์', en: 'Access' },

  /* -------------------------- work index -------------------------- */
  'idx.categoryCol': { th: 'หมวดหมู่ (Category)', en: 'Category' },
  'idx.mappingCol': { th: 'การจับคู่', en: 'Mapping' },
  /* ---------- errors this module explains in its own words ---------- */
  // OUTSIDE_EDIT_WINDOW is the database's enforce_entry_window trigger refusing
  // a write, surfaced by the API as 403. It is a rule working correctly, so the
  // message names the window instead of apologising for a fault.
  'err.outsideEditWindow': { th: 'วันที่นี้เลยกำหนดแก้ไขแล้ว — แก้ย้อนหลังได้ {lockDays} วัน และล่วงหน้าได้ถึงพรุ่งนี้เท่านั้น', en: 'This day is outside the edit window — you may edit {lockDays} days back, and no further ahead than tomorrow.' },
  'err.alreadyDecided': { th: 'คำขอนี้ถูกพิจารณาไปแล้ว', en: 'This request has already been decided' },
  'err.duplicateSite': { th: 'มีโครงการรหัสนี้อยู่แล้ว', en: 'A project with this key already exists' },
  'err.loadFailed': { th: 'โหลดข้อมูลไม่สำเร็จ', en: 'Could not load the data' },
  /* ---------- added by the React port ---------- */
  // Printed beside the manday figure. A day with งานหลัก and งานเสริม both
  // filled is ONE manday, and saying so where the number is read is the
  // cheapest place to stop somebody 'correcting' it upward.
  'dash.mandayRule': { th: '1 วันต่อคน แม้ลงทั้งงานหลักและงานเสริม', en: 'One manday per person per day, even with both tasks logged' },
});
