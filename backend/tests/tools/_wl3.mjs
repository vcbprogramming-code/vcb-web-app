import ExcelJS from 'exceljs';
import { U, call, query, upload } from '../harness.mjs';
const A = U.admin, M = 'ZZIMP';
// ── นำเข้าทะเบียนงาน: ไฟล์ที่มีทั้งแถวดีและแถวเสีย ──
const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('ทะเบียนงาน');
ws.columns = [{ header: 'รหัสงาน', key: 'code' }, { header: 'ชื่องาน', key: 'name' },
  { header: 'หมวดหมู่', key: 'cat' }, { header: 'หมวดต้นทุนที่อนุญาต', key: 'allowed' }];
ws.addRow({ code: 'Y-1', name: `${M} งานทดสอบนำเข้า`, cat: 'Y · ทดสอบ', allowed: '5' });
ws.addRow({ code: 'ผิดรูป', name: 'รหัสไม่ถูกแบบ', cat: '' });
ws.addRow({ code: 'Y-2', name: '', cat: '' });
ws.addRow({ code: 'Y-3', name: 'หมวดต้นทุนไม่มีจริง', allowed: '999' });
const buf = await wb.xlsx.writeBuffer();
const dry = await upload('/performance/import/activities?dryRun=true', A, 'test.xlsx', buf,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
console.log('ตรวจไฟล์ก่อน →', dry.status, JSON.stringify(dry.data).slice(0, 220));
const before = (await query(`select count(*)::int n from work_types where code like 'Y-%'`)).rows[0].n;
console.log('ยังไม่เขียนลงระบบ:', before === 0 ? '✅ ถูกต้อง' : `❌ เขียนไปแล้ว ${before}`);
await query(`delete from work_types where name like '${M}%'`);
process.exit(0);
