/**
 * English for the Thai the screens already say.
 *
 * Keyed by the Thai text itself — see lib/i18n.jsx for why. A string missing
 * from here simply stays Thai, which is what every user sees today, so this file
 * can never take the system backwards.
 *
 * Translate what a person READS, not what a database holds: project names,
 * document subjects and people's names stay exactly as they were entered.
 *
 * Grouped the way the screens are, so a gap is easy to spot.
 */
export const EN = {
  // ── ปุ่มและคำที่ใช้ทั่วทั้งระบบ ──────────────────────────────────────────
  'บันทึก': 'Save',
  'บันทึกแล้ว': 'Saved',
  'กำลังบันทึก…': 'Saving…',
  'ยกเลิก': 'Cancel',
  'ปิด': 'Close',
  'แก้ไข': 'Edit',
  'ลบ': 'Delete',
  'กำลังลบ…': 'Deleting…',
  'ลบแล้ว': 'Deleted',
  'เพิ่ม': 'Add',
  'จัดการ': 'Manage',
  'ลองใหม่': 'Try again',
  'กำลังโหลด…': 'Loading…',
  'กำลังส่ง…': 'Sending…',
  'กำลังอัปโหลด…': 'Uploading…',
  'กำลังส่งออก…': 'Exporting…',
  'ส่ง': 'Send',
  'ค้นหา…': 'Search…',
  'ทั้งหมด': 'All',
  'ไม่พบข้อมูล': 'Nothing found',
  'ยังไม่มีข้อมูล': 'No data yet',
  'ดูรายละเอียด': 'View details',
  'ดาวน์โหลด': 'Download',
  'เปิดเต็มจอ': 'Open full screen',
  'แชร์': 'Share',
  'คัดลอกแล้ว': 'Copied',
  'คัดลอกไม่สำเร็จ': 'Copy failed',
  'กำลังคัดลอก…': 'Copying…',
  'เสร็จสิ้น': 'Done',
  'ถัดไป': 'Next',
  'ย้อนกลับ': 'Back',
  'ยืนยัน': 'Confirm',
  'ตกลง': 'OK',
  'เพิ่มรายการ': 'Add row',
  'ล้างทั้งหมด': 'Clear all',

  // ── คำนามที่ใช้ร่วมกัน ─────────────────────────────────────────────────
  'โครงการ': 'Project',
  'ทุกโครงการ': 'All projects',
  'ทุกกลุ่ม': 'All groups',
  'ทุกหมวด': 'All categories',
  'ทุกแผนก': 'All departments',
  'ทุกสถานะ': 'All statuses',
  'แผนก': 'Department',
  'สถานะ': 'Status',
  'ประเภท': 'Type',
  'รหัส': 'Code',
  'ชื่อ-นามสกุล': 'Full name',
  'อีเมล': 'Email',
  'บทบาท': 'Role',
  'ตำแหน่ง': 'Position',
  'หมายเหตุ': 'Note',
  'เหตุผล': 'Reason',
  'วันที่': 'Date',
  'เวลา': 'Time',
  'ครบกำหนด': 'Due',
  'ชุด': 'set',
  'วัน': 'day(s)',
  'ลายเซ็น': 'Signature',
  'ไฟล์แนบ': 'Attachments',
  'ความเห็น': 'Comments',
  'ประวัติ': 'History',
  'ผู้ใช้': 'User',
  'ผู้ดูแลระบบ': 'Administrator',
  'ผู้บริหาร': 'Executive',
  'เจ้าหน้าที่ HR': 'HR officer',

  // ── สถานะที่ใช้ร่วมกัน ─────────────────────────────────────────────────
  'ฉบับร่าง': 'Draft',
  'รออนุมัติ': 'Awaiting approval',
  'อนุมัติแล้ว': 'Approved',
  'ไม่อนุมัติ': 'Not approved',
  'อนุมัติ': 'Approve',
  'ยกเลิกแล้ว': 'Cancelled',
  'ส่งกลับแก้ไข': 'Returned for revision',
  'ใช้งาน': 'Active',
  'ปิดใช้งาน': 'Disable',
  'ยังไม่เผยแพร่': 'Not published',
  'ปักหมุด': 'Pin',
  'เอาหมุดออก': 'Unpin',

  // ── หน้าแรก (Portal) ───────────────────────────────────────────────────
  'ระบบงานภายใน': 'Internal systems',
  'แอปพลิเคชัน': 'Applications',
  'รายการ': 'items',
  'ช่วยเหลือ': 'Help',
  'ช่วยเหลือ / แจ้งปัญหา': 'Help / report a problem',
  'เร็วๆ นี้': 'Coming soon',
  'เปิดใช้งาน': 'Open',
  'ระบบออนไลน์': 'System online',
  'สลับบัญชี': 'Switch account',
  'ออกจากระบบ': 'Sign out',
  'ปฏิทินวันหยุด': 'Holiday calendar',
  'วันหยุด': 'Holiday',
  'เสาร์-อาทิตย์': 'Weekend',
  'วันนี้': 'Today',
  'วันหยุดถัดไป': 'Next holiday',
  'อีก': 'in',
  'ค้นหาแอปพลิเคชัน…': 'Search applications…',
  'สวัสดีตอนเช้า': 'Good morning',
  'สวัสดีตอนบ่าย': 'Good afternoon',
  'สวัสดีตอนเย็น': 'Good evening',
  'กลับสู่หน้า Portal': 'Back to the portal',
  'สำหรับใช้งานภายในเท่านั้น': 'Internal use only',

  // ── ชื่อโมดูลบนหน้าแรก ─────────────────────────────────────────────────
  'บันทึก & อนุมัติ (E-Memo)': 'Memos & Approvals (E-Memo)',
  'บันทึก & อนุมัติ': 'Memos & Approvals',
  'จัดทำหนังสือ ออกเลขอัตโนมัติ และอนุมัติออนไลน์พร้อมลายเซ็น':
    'Draft letters, number them automatically, and approve online with a signature',
  'บันทึกงานฝ่ายบุคคล': 'HR Work Log',
  'บันทึกงานที่พนักงานแต่ละคนทำในแต่ละวัน แยกตามไซต์งาน':
    'What each person worked on each day, by site',
  'วงเงินสินเชื่อโครงการ': 'Project Credit Facilities',
  'ติดตามวงเงิน การเบิกใช้ คำขออนุมัติ และแผนกระแสเงินสด':
    'Track limits, drawdowns, approval requests and the cash plan',
  'รับพนักงานใหม่': 'Onboarding',
  'คลังข้อมูล แผน 30-60-90 วัน และแบบประเมินทดลองงาน':
    'Reference material, the 30-60-90 day plan, and the probation review',
  'ตั้งค่า': 'Settings',
  'ผู้ใช้และสิทธิ์ · โครงการ/หัวจดหมาย · ประเภทเอกสาร · โปรไฟล์และลายเซ็นของฉัน':
    'Users and permissions · Projects/letterhead · Document types · My profile and signature',
  'คู่มือปฏิบัติงาน (SOP)': 'Operating Manual (SOP)',
  'ระเบียบปฏิบัติมาตรฐาน ERP — กรณีศึกษา ผังกระบวนการ และเมนูรายงาน':
    'ERP standard operating procedures — case studies, process flows, and the report menu',
  'รายงานการประชุม': 'Meeting Minutes',
  'บันทึกการประชุมแยกตามโครงการ เก็บทุกเวอร์ชัน ไฟล์แนบ และความเห็นของทีม':
    'Minutes by project, every version kept, with attachments and team comments',
  'แผนผังระบบ (System Map)': 'System Map',
  'แผนผังระบบ': 'System Map',
  'กระบวนการทำงานของกลุ่ม ทะเบียนฟังก์ชันรายแผนก และจุดที่ใช้ AI ช่วยได้':
    'How the group works, the function register by department, and where AI can help',

  // ── เข้าสู่ระบบ ────────────────────────────────────────────────────────
  'ลงชื่อเข้าใช้ด้วย Google': 'Sign in with Google',
  'เข้าสู่ระบบด้วยอีเมล': 'Sign in with email',
  'รหัสผ่าน': 'Password',
  'หรือ': 'or',
  'บัญชีที่ผู้ดูแลระบบสร้างให้ (อีเมล + รหัสผ่าน)': 'An account your administrator created (email + password)',
  'ลืมรหัสผ่าน? ติดต่อผู้ดูแลระบบเพื่อขอรหัสผ่านใหม่':
    'Forgotten your password? Ask your administrator to reset it',

  // ── หน้าที่ไม่พบ / ข้อผิดพลาด ──────────────────────────────────────────
  'ไม่พบหน้านี้ (404)': 'Page not found (404)',
  'ลิงก์อาจไม่ถูกต้องหรือถูกย้ายไปแล้ว': 'The link may be wrong, or the page has moved',
  'กลับหน้าหลัก': 'Back to home',
  'เกิดข้อผิดพลาด': 'Something went wrong',
  'โมดูลนี้ยังไม่เปิดให้ใช้งาน': 'This module is not switched on yet',
  'ไม่มีสิทธิ์เข้าถึงหน้านี้': 'You do not have access to this page',
};
