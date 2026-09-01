// The portal's Thai/English dictionary.
//
// Migrated from the flat per-language `I18N` object that used to live in
// data.ts. Every Thai string is carried over byte for byte; what changed is the
// shape — one entry per key holding { th, en } rather than two parallel trees,
// which is what shared/src/i18n.jsx merges over commonDictionary. Thai is the
// default language there, so th is written first in each pair.
//
// Keys are dotted and stable. The per-app entries below (app.<key>.name/desc/
// preview) are the fallback only: the API now returns nameTh/descTh from
// portal.apps, and appName()/appDesc() in lib/appCopy.js prefer those. Copy is
// migrating into the database; these stay so a tile the database does not yet
// describe in Thai still reads correctly.

import { createDictionary } from '@vcb/shared';

export const dictionary = createDictionary({
  /* ------------------------------- chrome -------------------------------- */
  'portal.brandSub': { th: 'พอร์ทัลอินทราเน็ตภายในองค์กร', en: 'Internal Intranet Portal' },
  'portal.staff': { th: 'พนักงาน', en: 'Staff' },
  'portal.adminRole': { th: 'แอดมิน', en: 'Admin' },
  'portal.footerLeft': {
    th: 'VCB Group · สำหรับใช้งานภายในเท่านั้น',
    en: 'VCB Group · Internal Use Only',
  },
  'portal.connecting': { th: 'กำลังเชื่อมต่อ…', en: 'Connecting…' },
  'portal.guest': { th: 'ผู้เยี่ยมชม', en: 'Guest' },

  /* --------------------------------- nav --------------------------------- */
  'nav.menu': { th: 'เมนู', en: 'Menu' },
  'nav.dashboard': { th: 'แดชบอร์ด', en: 'Dashboard' },
  'nav.applications': { th: 'แอปพลิเคชัน', en: 'Applications' },
  'nav.shortcuts': { th: 'ทางลัด', en: 'Shortcuts' },
  'nav.more': { th: 'เพิ่มเติม', en: 'More' },
  'nav.onboarding': { th: 'พอร์ทัลปฐมนิเทศ', en: 'Onboarding Portal' },
  'nav.erp': { th: 'ERP', en: 'ERP' },
  'nav.zoom': { th: 'Zoom', en: 'Zoom' },
  'nav.aiTavern': { th: 'AI Tavern', en: 'AI Tavern' },
  'nav.help': { th: 'ช่วยเหลือ', en: 'Help & Support' },
  'nav.comingSoon': { th: 'เร็ว ๆ นี้', en: 'Coming soon' },
  'nav.openMenu': { th: 'เปิดเมนู', en: 'Open menu' },

  /* ------------------------------ dashboard ------------------------------ */
  'dash.sub': {
    th: 'ศูนย์รวมแอปพลิเคชันภายในของ VCB Group ไว้ในที่เดียว',
    en: 'One place for every internal VCB Group application.',
  },
  'dash.welcomeSub': {
    th: 'ความเคลื่อนไหวของ VCB Connect ในวันนี้',
    en: "Here's what's happening across VCB Connect today.",
  },
  'dash.goodMorning': { th: 'สวัสดีตอนเช้า', en: 'Good morning' },
  'dash.goodAfternoon': { th: 'สวัสดีตอนบ่าย', en: 'Good afternoon' },
  'dash.goodEvening': { th: 'สวัสดีตอนเย็น', en: 'Good evening' },
  'dash.systemOnline': { th: 'ระบบออนไลน์', en: 'System Online' },
  'dash.applications': { th: 'แอปพลิเคชัน', en: 'Applications' },
  'dash.available': { th: 'รายการ', en: 'available' },
  'dash.launch': { th: 'เปิดใช้งาน', en: 'Launch' },

  /* ------------------------------- search -------------------------------- */
  'search.placeholder': { th: 'ค้นหาแอปพลิเคชัน…', en: 'Search applications…' },
  'search.empty': { th: 'ไม่พบแอปพลิเคชันที่ค้นหา', en: 'No applications match your search.' },

  /* -------------------------------- panels ------------------------------- */
  'panel.announcements': { th: 'ประกาศ', en: 'Announcements' },
  'panel.announcementsEmpty': { th: 'ยังไม่มีประกาศในขณะนี้', en: 'No announcements right now.' },
  'panel.calendar': { th: 'ปฏิทินวันหยุด', en: 'Holiday Calendar' },
  'panel.birthdays': { th: 'วันเกิดที่กำลังจะถึง', en: 'Upcoming Birthdays' },
  'panel.birthdaysNote': {
    th: 'ข้อมูลตัวอย่าง — เชื่อมต่อแหล่งข้อมูลจริงเพื่อแทนที่ส่วนนี้',
    en: 'Sample data — connect a real source to replace this.',
  },
  'panel.leave': { th: 'ลาวันนี้', en: 'On Leave Today' },
  'panel.leaveEmpty': { th: 'วันนี้ไม่มีพนักงานลา', en: 'No one is on leave today.' },

  /* ------------------------------- calendar ------------------------------ */
  // Kept as one comma-joined string, as the original cal_dow was, so the two
  // languages stay legible side by side and the split stays in one place.
  'cal.dow': { th: 'อา,จ,อ,พ,พฤ,ศ,ส', en: 'Su,Mo,Tu,We,Th,Fr,Sa' },
  'cal.legendHoliday': { th: 'วันหยุด', en: 'Holiday' },
  'cal.legendWeekend': { th: 'เสาร์-อาทิตย์', en: 'Weekend' },
  'cal.legendToday': { th: 'วันนี้', en: 'Today' },
  'cal.nextHoliday': { th: 'วันหยุดถัดไป: {name} ({date})', en: 'Next holiday: {name} ({date})' },
  'cal.daysAway': { th: 'อีก {n} วัน', en: '{n} days' },
  'cal.today': { th: 'วันนี้', en: 'Today' },
  'cal.prevMonth': { th: 'เดือนก่อนหน้า', en: 'Previous month' },
  'cal.nextMonth': { th: 'เดือนถัดไป', en: 'Next month' },

  /* ------------------------------- tooltips ------------------------------ */
  'tt.erpDesc': {
    th: 'ไปที่ระบบ Mango ERP — สำหรับคำขอซื้อ คำขอเบิกเงินสด และธุรกรรมเชิงตัวเลขอื่น ๆ',
    en: 'Navigate to Mango ERP — for purchase requests, cash requests & other numerical transactions',
  },
  'tt.zoomDesc': { th: 'เข้าร่วมประชุมผ่าน Zoom', en: 'Join a Zoom meeting' },
  'tt.onboardingDesc': {
    th: 'การปฐมนิเทศและต้อนรับพนักงานใหม่',
    en: 'New hire onboarding & orientation',
  },

  /* --------------------------------- help -------------------------------- */
  'help.title': { th: 'แจ้งปัญหา', en: 'Report an issue' },
  'help.sub': {
    th: 'บอกเราว่าเกิดอะไรขึ้น — ข้อความจะถูกส่งตรงถึงทีม VCB Connect',
    en: 'Tell us what happened — this goes straight to the VCB Connect team.',
  },
  'help.areaLabel': {
    th: 'ขณะที่พบปัญหา คุณกำลังทำอะไรอยู่',
    en: 'When you noticed this, what were you trying to do?',
  },
  'help.areaPlaceholder': { th: 'เลือกตัวเลือก', en: 'Choose an option' },
  'help.areaOther': { th: 'อื่น ๆ', en: 'Other / something else' },
  'help.messageLabel': { th: 'อธิบายปัญหาที่พบ', en: 'Describe the issue' },
  'help.messagePlaceholder': {
    th: 'บอกเราว่าเกิดอะไรขึ้นและอะไรที่ใช้งานไม่ได้',
    en: "Tell us what happened and what's not working",
  },
  'help.close': { th: 'ปิด', en: 'Close' },
  'help.send': { th: 'ส่งรายงาน', en: 'Send Report' },
  'help.sent': { th: 'ส่งแล้ว', en: 'Sent.' },
  // The API has no issue-report endpoint yet (see PORT_NOTES.md). Until it
  // does, the form hands the report to the visitor's own mail client and says
  // so plainly, rather than pretending to deliver it.
  'help.unavailable': {
    th: 'ยังส่งจากในระบบไม่ได้ — จะเปิดอีเมลของคุณพร้อมข้อความนี้แทน',
    en: 'Sending from here is not wired up yet — your email app will open with this message instead.',
  },

  /* -------------------------------- admin -------------------------------- */
  'admin.title': { th: 'ประกาศ', en: 'Announcement' },
  'admin.sub': {
    th: 'แสดงที่ด้านบนของพอร์ทัลให้ผู้เข้าชมทุกคนเห็น ปิด "แสดงแบนเนอร์" เพื่อซ่อน',
    en: 'Shown to every visitor at the top of the portal. Turn off "show" to hide it.',
  },
  'admin.fieldTitle': { th: 'หัวข้อ', en: 'Title' },
  'admin.fieldTitlePlaceholder': {
    th: 'เช่น ปิดปรับปรุงระบบวันเสาร์นี้',
    en: 'e.g. Maintenance window this Saturday',
  },
  'admin.fieldBody': { th: 'ข้อความ', en: 'Message' },
  'admin.fieldBodyPlaceholder': {
    th: 'ข้อความสั้น ๆ ระบบจะรักษาการขึ้นบรรทัดใหม่ไว้',
    en: 'Short message. Line breaks are preserved.',
  },
  'admin.showBanner': { th: 'แสดงแบนเนอร์ให้ผู้เข้าชม', en: 'Show banner to visitors' },
  'admin.clear': { th: 'ล้างประกาศ', en: 'Clear' },
  'admin.confirmClear': { th: 'ลบประกาศปัจจุบันหรือไม่', en: 'Remove the current announcement?' },
  'admin.confirmClearNote': {
    th: 'แบนเนอร์จะถูกซ่อนจากทุกคน',
    en: 'This hides the banner for everyone.',
  },
  'admin.confirmClearYes': { th: 'ใช่ ล้างเลย', en: 'Yes, clear' },
  'admin.cleared': { th: 'ล้างแล้ว', en: 'Cleared.' },
  'admin.needTitleOrBody': {
    th: 'กรุณากรอกหัวข้อหรือข้อความอย่างน้อยหนึ่งอย่าง',
    en: 'Add at least a title or a message.',
  },
  'admin.loading': { th: 'กำลังโหลดประกาศปัจจุบัน…', en: 'Loading current announcement…' },
  'admin.notAdmin': {
    th: 'คุณไม่มีสิทธิ์แก้ไขประกาศ',
    en: 'You do not have permission to edit the announcement.',
  },
  'admin.signInFirst': {
    th: 'กรุณาเข้าสู่ระบบด้วยบัญชีแอดมินเพื่อแก้ไขประกาศ',
    en: 'Sign in with an admin account to edit the announcement.',
  },
  'admin.manage': { th: 'จัดการประกาศ', en: 'Manage announcement' },
  'admin.backToPortal': { th: 'กลับสู่พอร์ทัล', en: 'Back to the portal' },

  /* -------------------------------- sign-in ------------------------------ */
  'signin.title': { th: 'เข้าสู่ระบบผู้ดูแล', en: 'Admin sign-in' },
  'signin.sub': {
    th: 'พอร์ทัลเปิดให้ทุกคนเข้าชมได้ การเข้าสู่ระบบจำเป็นเฉพาะเมื่อต้องแก้ไขประกาศ',
    en: 'The portal is open to everyone. Signing in is only needed to edit the announcement.',
  },

  /* ------------------------------- banner -------------------------------- */
  'banner.dismiss': { th: 'ปิดประกาศนี้', en: 'Dismiss announcement' },

  /* ------------------------------- errors -------------------------------- */
  'error.EMPTY_ANNOUNCEMENT': {
    th: 'กรุณากรอกหัวข้อหรือข้อความอย่างน้อยหนึ่งอย่าง',
    en: 'Add at least a title or a message.',
  },
  'apps.loadFailed': {
    th: 'โหลดรายการแอปพลิเคชันไม่สำเร็จ',
    en: 'Could not load the application list.',
  },

  /* -------------------------- per-app fallback copy ---------------------- */
  // Preferred source is the API (nameTh / descTh on portal.apps). These are the
  // fallback, and the only home of the longer `preview` paragraph — the tiles'
  // hover text, which the database has no column for yet.

  'app.ememo.name': { th: 'อีเมโม', en: 'E-Memo' },
  'app.ememo.desc': {
    th: 'ควบคุมเอกสาร การออกบันทึกข้อความ และขั้นตอนการอนุมัติ ระหว่างโครงการและสำนักงานใหญ่',
    en: 'Document control, memo issuance & approval workflow.',
  },
  'app.ememo.preview': {
    th: 'รวมเอกสารและบันทึกข้อความของบริษัทไว้ในที่เดียว พร้อมขั้นตอนการออกและอนุมัติที่เป็นระบบ ทำให้ทุกฉบับมีเวอร์ชันที่ตรวจสอบย้อนกลับได้และค้นหาได้ง่ายในภายหลัง',
    en: 'Centralizes company documents and memos in one place, with a structured issuance and approval workflow so every record is version-controlled, traceable, and easy to find later.',
  },

  'app.minutes.name': { th: 'รายงานการประชุม', en: 'Meeting Minutes' },
  'app.minutes.desc': {
    th: 'บันทึกการประชุม มติที่ประชุม และการติดตามงานที่ได้รับมอบหมาย',
    en: 'Meeting records, decisions & action-item tracking.',
  },
  'app.minutes.preview': {
    th: 'บันทึกรายละเอียดและมติที่ประชุมทันทีที่เกิดขึ้น พร้อมติดตามงานที่ได้รับมอบหมายจนเสร็จสิ้น เพื่อให้ข้อตกลงจากที่ประชุมไม่ถูกลืมหรือตกหล่น',
    en: 'Captures meeting records and decisions as they happen, then tracks the resulting action items to completion so agreements from a meeting are never lost or forgotten.',
  },

  'app.sop.name': { th: 'มาตรฐานการปฏิบัติงาน', en: 'Standard Operating Procedures' },
  'app.sop.desc': {
    th: 'เรียกดู ค้นหา และควบคุมเวอร์ชันเอกสาร SOP ของบริษัท',
    en: 'Browse, search & version-control company SOPs.',
  },
  'app.sop.preview': {
    th: 'เป็นคลังขั้นตอนการปฏิบัติงานมาตรฐานที่ค้นหาได้สำหรับทุกทีม พร้อมควบคุมเวอร์ชัน เพื่อให้พนักงานทำงานตามขั้นตอนที่อนุมัติล่าสุดเสมอ ไม่ใช่ฉบับที่ล้าสมัย',
    en: 'Gives every team a single, searchable library of standard operating procedures, with version control so staff always work from the current approved process, not an outdated copy.',
  },

  'app.sysmap.name': { th: 'แผนผังระบบ', en: 'System Map' },
  'app.sysmap.desc': {
    th: 'แผนผังเชื่อมโยงระบบและแอปพลิเคชันต่าง ๆ ของ VCB Group',
    en: 'Interactive map of VCB Group systems & integrations.',
  },
  'app.sysmap.preview': {
    th: 'แสดงภาพรวมการเชื่อมโยงหน้าที่งานของแต่ละฝ่ายทั่วทั้ง VCB Group ทำให้เห็นความเชื่อมโยงของงานและความรับผิดชอบระหว่างทีมต่าง ๆ ได้ในทันที',
    en: 'Visualizes how the functions of each department across VCB Group connect to one another, making it easy to see how work and responsibilities link across teams at a glance.',
  },

  'app.hr.name': { th: 'บันทึกงานฝ่ายบุคคล', en: 'HR Work Log' },
  'app.hr.desc': {
    th: 'การลงเวลา บันทึกงาน และตารางเวลาทำงานสำหรับทีม HR',
    en: 'Attendance, task logs & timesheet for the HR team.',
  },
  'app.hr.preview': {
    th: 'ให้ทีม HR ลงเวลา บันทึกงานประจำวัน และจัดตารางเวลาทำงานไว้ในระบบเดียว แทนที่ไฟล์ Excel ที่กระจัดกระจาย เพื่อให้มีบันทึกข้อมูลการทำงานของทีมที่ถูกต้องและเป็นระบบ',
    en: 'Lets the HR team log attendance, daily tasks, and timesheets in one system, replacing scattered spreadsheets with a single accurate record for the team’s work.',
  },

  'app.credit.name': { th: 'ระบบจัดการวงเงินสินเชื่อ', en: 'Credit Facility Manager' },
  'app.credit.desc': {
    th: 'วงเงินสินเชื่อ การเบิกถอน คำขอ และการอนุมัติ',
    en: 'Credit limits, drawdowns, requests & approvals.',
  },
  'app.credit.preview': {
    th: 'บริหารจัดการวงเงินสินเชื่อของบริษัทกับธนาคารครบวงจร ตั้งแต่วงเงิน การเบิกถอน คำขอ ไปจนถึงการอนุมัติ ให้ทีมการเงินเห็นสถานะวงเงินสินเชื่อกับแต่ละธนาคารได้ชัดเจนและตรวจสอบย้อนกลับได้',
    en: 'Manages the company’s bank credit facilities end to end — limits, drawdowns, requests, and approvals — giving the finance team a clear, auditable view of the company’s credit position with each bank.',
  },
});

export default dictionary;
