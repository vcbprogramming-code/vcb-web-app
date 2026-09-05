/**
 * ส่วนเพิ่มของโมดูลบันทึกงานฝ่ายบุคคลที่ระบบจริงของลูกค้าไม่มี
 *
 * ระบบที่พนักงานใช้อยู่ทุกวัน (Google Apps Script) มีห้าหน้าจอและไม่มีการยืนยัน
 * ข้อมูล ไม่มีการปิดงวด ไม่มีไฟล์แนบรายวัน — สิ่งเหล่านี้มาจากเอกสารเกณฑ์
 * ตรวจรับ ซึ่งเป็นคนละต้นทางกัน เมื่อลูกค้าเปิดดูจึงไม่ใช่สิ่งที่เขาคุ้น
 *
 * เราไม่ลบทิ้ง เพราะโค้ดทำงานได้และผ่านการทดสอบแล้ว — ปิดไว้เป็นค่าเริ่มต้น
 * แล้วเปิดกลับได้ทีละอย่างเมื่อตกลงกับลูกค้า ปิดทั้งที่ API และที่หน้าจอ
 * เพื่อไม่ให้เหลือช่องทางเรียกตรงเข้ามาได้
 *
 *   WORKLOG_FEATURES=verify,periodClose   เปิดเฉพาะที่ระบุ
 *   WORKLOG_FEATURES=all                  เปิดทั้งหมด (เหมือนก่อนปรับ)
 */
export const WORKLOG_FEATURES = [
  'verify',           // ยืนยันข้อมูล / ยกเลิกการยืนยัน
  'periodClose',      // ปิดงวด / เปิดงวดคืน
  'mandayEntry',      // หน้าจอกรอกแรงงาน-วันเป็นตัวเลข
  'attachments',      // แนบไฟล์ในตารางรายวัน
  'alerts',           // รายการที่ต้องดำเนินการ
  'manpower',         // รายงานกำลังคน
  'orgRegistry',      // ทะเบียนแผนก/ตำแหน่ง
  'employeeImport',   // นำเข้าพนักงานจาก Excel
  'leaveHalfDay',     // ลาครึ่งวัน (0.5 วัน)
  'leaveAttachment',  // แนบใบรับรองแพทย์กับใบลา
];

const raw = (process.env.WORKLOG_FEATURES ?? '').trim();
const on = raw === 'all'
  ? new Set(WORKLOG_FEATURES)
  : new Set(raw.split(',').map((s) => s.trim()).filter((s) => WORKLOG_FEATURES.includes(s)));

/** เปิดใช้ส่วนเสริมนี้อยู่หรือไม่ */
export const featureOn = (name) => on.has(name);

/** สถานะทุกตัว ส่งให้หน้าจอผ่าน /bootstrap เพื่อไม่ให้วาดปุ่มที่กดแล้วโดนปฏิเสธ */
export const featureMap = () =>
  Object.fromEntries(WORKLOG_FEATURES.map((f) => [f, on.has(f)]));
