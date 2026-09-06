/**
 * ลิงก์เพี้ยนและรหัสผิดรูป — ต้องได้คำตอบที่อ่านรู้เรื่อง ไม่ใช่ระบบพัง
 *
 * คนเปิดลิงก์เก่าที่รหัสตกหล่น หรือแก้ URL เองอยู่เสมอ เดิมเส้นทาง 11 เส้น
 * ตอบ 500 พร้อมข้อความดิบจากฐานข้อมูล ("invalid input syntax for type uuid")
 * ซึ่งทั้งทำให้ดูเหมือนระบบล่ม และเปิดเผยโครงสร้างข้างในให้คนนอกเห็น
 *
 * ไม่แตะ E-memo — โมดูลนั้นมีชุดของตัวเองอยู่แล้ว
 */
import { call, suite, happy, bad, report, U, warm } from './harness.mjs';

await warm();
const A = U.admin;

const JUNK = [
  ['GET', '/sop/scenarios/abc'], ['PATCH', '/sop/scenarios/abc'], ['DELETE', '/sop/scenarios/abc'],
  ['POST', '/sop/scenarios/abc/move'], ['PATCH', '/sop/reports/abc'], ['DELETE', '/sop/reports/abc'],
  ['GET', '/sop/versions/abc'], ['POST', '/sop/versions/abc/restore'],
  ['GET', '/meetings/abc'], ['GET', '/meetings/abc/versions/xyz'], ['PATCH', '/meetings/abc'],
  ['DELETE', '/meetings/abc'], ['GET', '/meetings/abc/attachments/def'], ['PATCH', '/meetings/groups/abc'],
  ['PATCH', '/credit/facilities/abc'], ['PUT', '/credit/facilities/abc/limit'], ['PATCH', '/credit/ledger/abc'],
  ['DELETE', '/credit/ledger/abc'], ['POST', '/credit/requests/abc/decide'], ['DELETE', '/credit/cash-plan/abc'],
  ['GET', '/credit/facilities?projectId=abc'], ['GET', '/credit/ledger?projectId=abc'],
  ['GET', '/credit/cash-plan?projectId=abc'], ['GET', '/credit/audit?facilityId=abc'],
  ['PUT', '/onboarding-program/progress/abc'], ['POST', '/onboarding-program/documents/abc'],
  ['DELETE', '/onboarding-program/documents/abc'], ['PATCH', '/onboarding-program/items/abc'],
  ['GET', '/onboarding/journeys/abc'], ['DELETE', '/onboarding/resources/abc'],
  ['PATCH', '/onboarding/templates/abc'], ['GET', '/onboarding/resources/abc/download'],
  ['PATCH', '/performance/employees/abc'], ['POST', '/performance/employees/abc/away'],
  ['GET', '/performance/leave/abc/attachment'], ['POST', '/performance/leave/abc/decide'],
  ['GET', '/performance/leave/abc/slip'], ['PATCH', '/performance/teams/abc'],
  ['GET', '/performance/attachments/abc/file'], ['DELETE', '/performance/attachments/abc'],
  ['PATCH', '/performance/departments/abc'],
  ['PATCH', '/sysmap/lanes/abc'], ['DELETE', '/sysmap/nodes/abc'], ['DELETE', '/sysmap/conns/abc'],
  ['GET', '/meetings?groupId=abc'], ['GET', '/sop/scenarios?module=<script>'],
  ['GET', '/performance/report?month=ไม่ใช่เดือน'], ['GET', '/performance/entries?date=9999-99-99'],
];

suite('1. รหัสผิดรูปในลิงก์ต้องไม่ทำให้ระบบพัง');
{
  const broke = [];
  const leaked = [];
  for (const [method, path] of JUNK) {
    const r = await call(path, { method, user: A, body: ['POST', 'PATCH', 'PUT'].includes(method) ? {} : undefined });
    if (r.status >= 500) broke.push(`${method} ${path} → ${r.status}`);
    const msg = String(r.data?.error || r.error || '');
    if (/invalid input syntax|syntax error at or near|relation ".*" does not exist|column .* does not exist/i.test(msg)) {
      leaked.push(`${method} ${path} → ${msg.slice(0, 60)}`);
    }
  }
  bad(`ไม่มีเส้นทางไหนคืน 500 (ลอง ${JUNK.length} เส้นทาง)`, broke.length === 0, broke.slice(0, 5).join(' · '));
  bad('ไม่มีข้อความจากฐานข้อมูลหลุดไปถึงผู้ใช้', leaked.length === 0, leaked.slice(0, 3).join(' · '));
}

suite('2. รหัสที่ถูกรูปแต่ไม่มีจริง ต้องบอกว่าไม่พบ');
{
  const NOWHERE = '00000000-0000-0000-0000-000000000000';
  const cases = [
    ['GET', `/meetings/${NOWHERE}`], ['GET', '/sop/versions/999999999'],
    ['GET', `/onboarding/journeys/${NOWHERE}`], ['PATCH', `/credit/facilities/${NOWHERE}`],
    ['GET', `/performance/leave/${NOWHERE}/slip`],
  ];
  for (const [method, path] of cases) {
    const r = await call(path, { method, user: A, body: method === 'PATCH' ? { limit: 1 } : undefined });
    happy(`${method} ${path.replace(NOWHERE, '(รหัสที่ไม่มีจริง)')} ตอบ 404`, r.status === 404, `${r.status}`);
  }
}

suite('3. คนที่ไม่มีสิทธิ์เขียน เขียนไม่ได้');
{
  const H = U.hr;
  const writes = [
    ['POST', '/sop/scenarios', {}], ['PATCH', '/sysmap/lanes/lane-a', {}],
    ['POST', '/meetings/groups', {}],
  ];
  for (const [method, path, body] of writes) {
    const r = await call(path, { method, user: H, body });
    bad(`${method} ${path} ถูกปฏิเสธ`, r.status === 403 || r.status === 404 || r.status === 400, `${r.status}`);
  }
}

suite('4. ไม่มีบัญชีก็เข้าไม่ได้');
{
  for (const path of ['/sop/bootstrap', '/meetings/bootstrap', '/credit/overview', '/sysmap/bootstrap']) {
    const r = await call(path, { auth: false });
    bad(`${path} ต้องลงชื่อเข้าใช้ก่อน`, r.status === 401, `${r.status}`);
  }
}

process.exit(report() ? 1 : 0);
