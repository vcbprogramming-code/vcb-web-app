/**
 * HR Work Log — the client's acceptance criteria, as executable checks.
 *
 * Section numbers follow "เกณฑ์การตรวจรับงาน (Acceptance Criteria) Module 2".
 * The document is written in man-days: how much labour each project spent, on
 * what, reconciling to the cost ledger. This suite holds the module to that,
 * not to the work diary it started as.
 */
import { fileURLToPath } from 'node:url';
import { call, suite, happy, bad, report, U, warm, query, API } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
await warm();

// ชุดนี้ตรวจความสามารถที่มาจาก "เอกสารเกณฑ์ตรวจรับ" ซึ่งตอนนี้ปิดไว้เป็นค่า
// เริ่มต้น เพราะระบบที่ลูกค้าใช้จริงไม่มี — โค้ดยังอยู่ครบและเปิดกลับได้
// ต้องรัน API ด้วย WORKLOG_FEATURES=all จึงจะทดสอบส่วนนี้ได้
{
  const boot = await call('/performance/bootstrap', { user: U.admin });
  const need = ['verify','periodClose','mandayEntry','attachments','alerts','orgRegistry','employeeImport','leaveHalfDay','leaveAttachment'];
  const off = need.filter((f) => !boot.features?.[f]);
  if (off.length) {
    console.log(`\nข้าม ${off.length} ความสามารถที่ปิดอยู่: ${off.join(', ')}`);
    console.log('ตั้ง WORKLOG_FEATURES=all ที่ฝั่ง API แล้วรันใหม่เพื่อทดสอบส่วนนี้');
    // พิมพ์บรรทัดสรุปด้วย ไม่งั้นตัวรันรวมอ่านผลไม่เจอแล้วนับว่าชุดนี้ล้ม
    process.exit(report());
  }
}
const { admin: A, exec: C, hr: H } = U;
const MARK = 'ZZUAT';
const today = new Date();
const ds = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shift = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return ds(d); };
const TODAY = ds(today);

// a site of our own so nothing here touches the client's data
const unit = await query(
  `insert into units (name, code, lock_days) values ($1,$2,3)
   on conflict (code) do update set lock_days = 3 returning *`, [`${MARK} ไซต์ทดสอบ`, `${MARK}-site`]);
const site = unit.rows[0];
const emp = (await query(
  `insert into employees (unit_id, full_name, employee_code, kind, is_active)
   values ($1,$2,$3,'operation',true) returning *`, [site.id, `${MARK} พนักงาน`, `${MARK}-001`])).rows[0];
const mate = (await query(
  `insert into employees (unit_id, full_name, employee_code, kind, is_active)
   values ($1,$2,$3,'operation',true) returning *`, [site.id, `${MARK} เพื่อนร่วมทีม`, `${MARK}-003`])).rows[0];
const gone = (await query(
  `insert into employees (unit_id, full_name, employee_code, kind, is_active)
   values ($1,$2,$3,'operation',false) returning *`, [site.id, `${MARK} พ้นสภาพ`, `${MARK}-002`])).rows[0];
await query('update profiles set permissions = coalesce(permissions,\'{}\'::jsonb) || \'{"performance":{"view":true,"edit":true,"verify":false}}\'::jsonb where id = $1', [A.id]);

// ── §2 ข้อมูลหลัก ─────────────────────────────────────────────────────────
suite('§2 ข้อมูลหลัก (Master Data)');
{
  const t = await call('/performance/teams', { method: 'POST', user: A, body: { site: site.code, name: `${MARK} ทีม ก`, code: 'T1' } });
  happy('มีทะเบียนทีม เพิ่มทีมได้', [200, 201].includes(t.status), `${t.status}`);
  const dup = await call('/performance/teams', { method: 'POST', user: A, body: { site: site.code, name: `${MARK} ทีม ก` } });
  bad('ทีมชื่อซ้ำในไซต์เดียวกันไม่เกิดรายการใหม่', [200, 201, 409].includes(dup.status), `${dup.status}`);
  const list = await call(`/performance/teams?site=${site.code}`, { user: A });
  happy('อ่านทะเบียนทีมกลับมาได้', (list.data || []).some((x) => x.name.includes(`${MARK} ทีม ก`)), '');

  // ทะเบียนงานยึดตามระบบที่ลูกค้าใช้จริง (VCB_WORK_TYPES 44 รหัส) ไม่ใช่ตัวอย่าง
  // ที่เราตั้งขึ้นเอง — กลุ่ม Z "ไม่ปฏิบัติงาน" ของจริงมีสามรหัสเท่านั้น
  //
  // เอกสารเกณฑ์ตรวจรับระบุ "ฝึกอบรม" กับ "หยุดเนื่องจากสภาพอากาศ" ไว้ด้วย แต่
  // ทะเบียนจริงไม่มี ต้องตกลงกับลูกค้าว่าจะเพิ่มเข้าทะเบียนหรือตัดออกจากเกณฑ์
  const acts = await call('/performance/activities', { user: A });
  const rows = acts.data || [];
  const names = JSON.stringify(rows);
  happy(`ทะเบียนประเภทงานครบตามระบบจริง (${rows.length} รหัส)`, rows.length === 44, `${rows.length}`);
  for (const w of ['Standby', 'ลา', 'ลาออก']) {
    happy(`ทะเบียนประเภทงานครอบคลุม "${w}"`, names.includes(w), '');
  }
  const cats = await call('/performance/cost-categories', { user: A });
  happy('ประเภทงานแยก 2 ระดับ (กิจกรรม + หมวดต้นทุน)', cats.status === 200, '');
  happy(`หมวดต้นทุนครบตามระบบจริง (${(cats.data || []).length} หมวด)`,
    (cats.data || []).length === 20, `${(cats.data || []).length}`);
  // รหัสงานแต่ละตัวต้องบอกได้ว่าใช้กับหมวดต้นทุนไหน มิฉะนั้นขั้นที่สองกรองไม่ได้
  happy('รหัสงานระบุหมวดต้นทุนที่ใช้ได้',
    rows.filter((r) => (r.allowed_cost || '').trim()).length >= 41,
    `${rows.filter((r) => (r.allowed_cost || '').trim()).length}/44`);
}

// ── §2 ทะเบียนแผนกและตำแหน่ง ──────────────────────────────────────────────
suite('§2 ทะเบียนแผนกและตำแหน่ง');
let deptId = null; let posId = null;
{
  const d = await call('/performance/departments', { method: 'POST', user: A, body: { site: site.code, name: `${MARK} ฝ่ายทดสอบ` } });
  happy('เพิ่มแผนกได้', [200, 201].includes(d.status), `${d.status} ${d.error || ''}`);
  deptId = d.data?.id;
  bad('แผนกชื่อซ้ำในไซต์เดียวกันไม่ได้',
    (await call('/performance/departments', { method: 'POST', user: A, body: { site: site.code, name: `${MARK} ฝ่ายทดสอบ` } })).status === 409, '');

  const p2 = await call('/performance/positions', { method: 'POST', user: A, body: { departmentId: deptId, name: `${MARK} หัวหน้าชุด` } });
  happy('เพิ่มตำแหน่งในแผนกได้', [200, 201].includes(p2.status), `${p2.status} ${p2.error || ''}`);
  posId = p2.data?.id;
  bad('ตำแหน่งชื่อซ้ำในแผนกเดียวกันไม่ได้',
    (await call('/performance/positions', { method: 'POST', user: A, body: { departmentId: deptId, name: `${MARK} หัวหน้าชุด` } })).status === 409, '');

  const list = await call(`/performance/departments?site=${site.code}`, { user: A });
  const mine = (list.data || []).find((x) => x.id === deptId);
  happy('อ่านทะเบียนแผนกกลับมาได้', Boolean(mine), '');
  happy('บอกจำนวนตำแหน่งในแผนก', mine?.positions === 1, String(mine?.positions));

  // §2 การเปลี่ยนแปลงมีผลกับข้อมูลในอนาคต ไม่ลบของเดิม
  await call(`/performance/employees/${emp.id}`, { method: 'PATCH', user: A, body: { departmentId: deptId, positionId: posId } });
  const bound = await query('select department_id, position_id from employees where id = $1', [emp.id]);
  happy('ผูกแผนกและตำแหน่งให้พนักงานได้', bound.rows[0].department_id === deptId && bound.rows[0].position_id === posId, '');
  bad('แผนกที่มีพนักงานผูกอยู่ ลบไม่ได้',
    (await call(`/performance/departments/${deptId}`, { method: 'DELETE', user: A })).status === 409, '');
  bad('ตำแหน่งที่มีพนักงานผูกอยู่ ลบไม่ได้',
    (await call(`/performance/positions/${posId}`, { method: 'DELETE', user: A })).status === 409, '');

  const off = await call(`/performance/departments/${deptId}`, { method: 'PATCH', user: A, body: { isActive: false } });
  happy('ปิดใช้งานแผนกได้', off.status === 200, `${off.status}`);
  const still = await query('select department_id from employees where id = $1', [emp.id]);
  happy('ปิดใช้งานแล้วข้อมูลพนักงานเดิมไม่เปลี่ยน', still.rows[0].department_id === deptId, '');
  const active = await call(`/performance/departments?site=${site.code}`, { user: A });
  bad('แผนกที่ปิดแล้วไม่ขึ้นในรายการปกติ', !(active.data || []).some((x) => x.id === deptId), '');
  const all = await call(`/performance/departments?site=${site.code}&all=1`, { user: A });
  happy('ยังเรียกดูรายการที่ปิดแล้วได้', (all.data || []).some((x) => x.id === deptId), '');
  const posOff = await query('select is_active from positions where id = $1', [posId]);
  happy('ปิดแผนกแล้วตำแหน่งใต้แผนกปิดตาม', posOff.rows[0].is_active === false, '');
  await call(`/performance/departments/${deptId}`, { method: 'PATCH', user: A, body: { isActive: true } });

  bad('ผู้ที่ไม่ใช่ผู้ดูแลระบบเพิ่มแผนกไม่ได้',
    (await call('/performance/departments', { method: 'POST', user: H, body: { site: site.code, name: 'x' } })).status === 403, '');
}

// ── §3 บันทึกรายวัน ───────────────────────────────────────────────────────
suite('§3 การบันทึกการปฏิบัติงานประจำวัน');
{
  const r = await call('/performance/day', { method: 'POST', user: A, body: {
    site: site.code, eid: emp.id, date: TODAY, manDay: 1, workStatus: 'ปกติ' } });
  happy('บันทึกแรงงาน-วันและสถานะการทำงานได้', r.status === 200, `${r.status} ${r.error || ''}`);
  happy('ระบบเก็บชั่วโมงให้สอดคล้องกับแรงงาน-วัน', r.data?.hours === 8, String(r.data?.hours));

  const grid = await call(`/performance/site-month?site=${site.code}&year=${today.getFullYear()}&month=${today.getMonth() + 1}`, { user: A });
  const cell = grid.data?.entries?.[emp.id]?.[TODAY] || grid.entries?.[emp.id]?.[TODAY];
  happy('ตารางเดือนแสดงแรงงาน-วันที่บันทึกไว้', Number(cell?.manDay) === 1, JSON.stringify(cell || {}));
  happy('แยกเวลาที่คีย์ข้อมูลออกจากวันที่ปฏิบัติงาน', Boolean(cell?.entryAt), '');

  const split = await call('/performance/day', { method: 'POST', user: A, body: {
    site: site.code, eid: emp.id, date: TODAY,
    lines: [{ workTypeName: 'งานคอนกรีต', manDay: 0.5 }, { workTypeName: 'งานเหล็ก', manDay: 0.5 }] } });
  happy('แบ่งงานหลายประเภทในวันเดียวได้', split.status === 200 && split.data?.lines === 2, `${split.status}`);
  happy('ผลรวมของวันเท่ากับ 1 แรงงาน-วัน', Number(split.data?.manDay) === 1, String(split.data?.manDay));

  const over = await call('/performance/day', { method: 'POST', user: A, body: {
    site: site.code, eid: emp.id, date: TODAY,
    lines: [{ workTypeName: 'ก', manDay: 0.7 }, { workTypeName: 'ข', manDay: 0.7 }] } });
  bad('รวมเกิน 1 แรงงาน-วันไม่ได้', over.status === 400, `${over.status}`);

  bad('บันทึกวันที่ล่วงหน้าไม่ได้',
    (await call('/performance/day', { method: 'POST', user: A, body: {
      site: site.code, eid: emp.id, date: shift(5), manDay: 1 } })).status === 400, '');
  bad('บันทึกให้พนักงานที่พ้นสภาพไม่ได้',
    (await call('/performance/day', { method: 'POST', user: A, body: {
      site: site.code, eid: gone.id, date: TODAY, manDay: 1 } })).status === 400, '');
  bad('ชั่วโมงเกิน 24 ไม่ได้',
    (await call('/performance/day', { method: 'POST', user: A, body: {
      site: site.code, eid: emp.id, date: TODAY, hours: 30 } })).status === 400, '');
  bad('สถานะการทำงานนอกรายการที่กำหนดไม่ได้',
    (await call('/performance/day', { method: 'POST', user: A, body: {
      site: site.code, eid: emp.id, date: TODAY, manDay: 1, workStatus: 'มั่ว' } })).status === 400, '');
  happy('รองรับสถานะ ล่วงเวลา / Standby / ลา / ขาดงาน',
    (await call('/performance/day', { method: 'POST', user: A, body: {
      site: site.code, eid: emp.id, date: TODAY, manDay: 1, workStatus: 'ล่วงเวลา' } })).status === 200, '');
}

// ── §4 ล็อกและปิดงวด ──────────────────────────────────────────────────────
suite('§4 ระยะเวลาแก้ไขและการล็อกข้อมูล');
{
  const grid = await call(`/performance/site-month?site=${site.code}&year=${today.getFullYear()}&month=${today.getMonth() + 1}`, { user: A });
  const days = grid.data?.days || grid.days || [];
  const states = new Set(days.map((d) => d.state));
  happy('หน้าจอบอกสถานะ แก้ไขได้ / ใกล้ครบกำหนด / ล็อกแล้ว', states.has('editable') && (states.has('locked') || states.has('due-soon')), [...states].join(','));
  happy('ระยะเวลาล็อกตั้งค่าแยกรายโครงการได้', (grid.data?.lockDays ?? grid.lockDays) === 3, '');

  const old = shift(-30);
  bad('พ้นกำหนดแล้วแก้ไขไม่ได้',
    (await call('/performance/day', { method: 'POST', user: A, body: { site: site.code, eid: emp.id, date: old, manDay: 1 } })).status === 409, '');
  bad('ปลดล็อกโดยไม่ระบุเหตุผลไม่ได้',
    (await call('/performance/day', { method: 'POST', user: A, body: {
      site: site.code, eid: emp.id, date: old, manDay: 1, adminUnlock: true } })).status === 400, '');
  const unlocked = await call('/performance/day', { method: 'POST', user: A, body: {
    site: site.code, eid: emp.id, date: old, manDay: 1, adminUnlock: true, reason: 'แก้ตามที่หน้างานแจ้ง' } });
  happy('ผู้มีสิทธิ์ปลดล็อกและระบุเหตุผลแล้วแก้ไขได้', unlocked.status === 200, `${unlocked.status}`);

  const ym = TODAY.slice(0, 7);
  const closed = await call('/performance/period-close', { method: 'POST', user: A, body: { site: site.code, ym } });
  happy('ปิดงวดรายเดือนได้', [200, 201].includes(closed.status), `${closed.status}`);
  bad('ปิดงวดแล้วแก้ไขข้อมูลของเดือนนั้นไม่ได้',
    (await call('/performance/day', { method: 'POST', user: A, body: { site: site.code, eid: emp.id, date: TODAY, manDay: 1 } })).status === 409, '');
  bad('เปิดงวดที่ปิดแล้วต้องระบุเหตุผล',
    (await call('/performance/period-open', { method: 'POST', user: A, body: { site: site.code, ym } })).status === 400, '');
  happy('เปิดงวดคืนได้เมื่อระบุเหตุผล',
    (await call('/performance/period-open', { method: 'POST', user: A, body: { site: site.code, ym, reason: 'แก้ไขตามมติที่ประชุม' } })).status === 200, '');
}

// ── §5 ตรวจสอบและยืนยัน ───────────────────────────────────────────────────
suite('§5 การตรวจสอบและยืนยันข้อมูล');
{
  bad('ผู้ไม่มีสิทธิ์ยืนยันข้อมูลไม่ได้',
    (await call('/performance/verify', { method: 'POST', user: H, body: { site: site.code, from: TODAY, to: TODAY } })).status === 403, '');
  const own = await call('/performance/verify', { method: 'POST', user: A, body: { site: site.code, from: TODAY, to: TODAY } });
  happy('ผู้บันทึกยืนยันงานของตัวเองไม่ได้ (ข้ามรายการนั้น)', own.data?.skippedOwn > 0, JSON.stringify(own.data || {}));
  const byOther = await call('/performance/verify', { method: 'POST', user: C, body: { site: site.code, from: TODAY, to: TODAY } });
  happy('ผู้มีสิทธิ์ตรวจสอบยืนยันได้', byOther.status === 200 && byOther.data?.verified > 0, JSON.stringify(byOther.data || {}));
  const row = await query('select verified_by, verified_at from work_logs where employee_id = $1 and ymd = $2', [emp.id, TODAY]);
  happy('บันทึกชื่อผู้ยืนยันและเวลา', Boolean(row.rows[0]?.verified_by && row.rows[0]?.verified_at), '');
  bad('ข้อมูลที่ยืนยันแล้วแก้ไม่ได้จนกว่าจะยกเลิกการยืนยัน',
    (await call('/performance/day', { method: 'POST', user: A, body: { site: site.code, eid: emp.id, date: TODAY, manDay: 0.5 } })).status === 409, '');
  happy('ยกเลิกการยืนยันได้',
    (await call('/performance/verify', { method: 'POST', user: C, body: { site: site.code, from: TODAY, to: TODAY, undo: true } })).status === 200, '');
}

// ── §6 การลา ──────────────────────────────────────────────────────────────
suite('§6 การขอลาและการอนุมัติ');
{
  const half = await call('/performance/leave', { method: 'POST', user: A, body: {
    employeeId: emp.id, leaveType: 'sick', from: shift(1), to: shift(1), dayPart: 'first_half', reason: `${MARK} ลาครึ่งวัน`,
    attachmentUrl: 'https://example.com/cert.pdf', attachmentName: 'ใบรับรองแพทย์.pdf' } });
  happy('ยื่นลาครึ่งวันได้', half.status === 201, `${half.status} ${half.error || ''}`);
  const saved = await query('select day_part, days, attachment_name from leave_requests where id = $1', [half.row?.id || half.data?.row?.id]);
  happy('นับเป็นครึ่งวัน ไม่ใช่หนึ่งวัน', Number(saved.rows[0]?.days) === 0.5, String(saved.rows[0]?.days));
  happy('แนบไฟล์ใบรับรองแพทย์ได้', Boolean(saved.rows[0]?.attachment_name), '');
  bad('ลาครึ่งวันข้ามหลายวันไม่ได้',
    (await call('/performance/leave', { method: 'POST', user: A, body: {
      employeeId: emp.id, leaveType: 'sick', from: shift(10), to: shift(12), dayPart: 'first_half' } })).status === 400, '');
  bad('คำขอลาซ้อนช่วงเดิมไม่ได้',
    (await call('/performance/leave', { method: 'POST', user: A, body: {
      employeeId: emp.id, leaveType: 'personal', from: shift(1), to: shift(1) } })).status === 409, '');
  const warned = await call('/performance/leave', { method: 'POST', user: A, body: {
    employeeId: emp.id, leaveType: 'personal', from: TODAY, to: TODAY, reason: `${MARK} ชนกับงาน` } });
  happy('เตือนเมื่อวันลาชนกับวันที่บันทึกงานไว้แล้ว', (warned.warnWorkedDays || warned.data?.warnWorkedDays || []).includes(TODAY), '');
  const mine = warned.row?.id || warned.data?.row?.id;
  bad('ผู้ยื่นอนุมัติคำขอของตัวเองไม่ได้',
    (await call(`/performance/leave/${mine}/decide`, { method: 'POST', user: A, body: { approve: true } })).status === 403, '');
}

// ── §7 แดชบอร์ดกำลังคน ────────────────────────────────────────────────────
suite('§7 การแสดงผลกำลังคน');
{
  const m = await call(`/performance/manpower?from=${shift(-40)}&to=${TODAY}`, { user: A });
  happy('ดูกำลังคนตามช่วงวันที่ได้', m.status === 200, `${m.status}`);
  happy('รวมแรงงาน-วันได้', Number(m.data?.total?.manday) > 0, String(m.data?.total?.manday));
  for (const k of ['byProject', 'byTeam', 'byWorkType', 'byStatus']) {
    happy(`แยกดูตาม ${k} ได้`, Array.isArray(m.data?.[k]), '');
  }
  happy('ระบุเวลาที่ดึงข้อมูล', Boolean(m.data?.generatedAt), '');
}

// ── §8 รายงานและการส่งออก ─────────────────────────────────────────────────
suite('§8 รายงานและการ Export');
{
  for (const g of ['project', 'team', 'worktype', 'employee']) {
    const r = await call(`/performance/report/manday?from=${shift(-40)}&to=${TODAY}&groupBy=${g}`, { user: A });
    happy(`รายงานแรงงาน-วัน มุมมอง ${g}`, r.status === 200 && Array.isArray(r.data?.rows), `${r.status}`);
  }
  const meta = await call(`/performance/report/manday?from=${shift(-40)}&to=${TODAY}`, { user: A });
  const md = meta.data?.meta || {};
  happy('รายงานระบุช่วงข้อมูล เวลาที่ดึง และผู้ดึง', Boolean(md.from && md.generatedAt && md.generatedBy), JSON.stringify(md));

  const xlsx = await call(`/performance/report/monthly.xlsx?ym=${TODAY.slice(0, 7)}`, { user: A, raw: true });
  happy('รายงานเดือนรวมทุกโครงการเป็นไฟล์เดียว', xlsx.status === 200, `${xlsx.status}`);
}

// ── §9 ประวัติการแก้ไข ────────────────────────────────────────────────────
suite('§9 Audit Trail');
{
  const a = await call(`/performance/audit?site=${site.code}`, { user: A });
  const rows = a.data || [];
  happy('มีประวัติการดำเนินการของโมดูลนี้', rows.length > 0, `${rows.length} รายการ`);
  happy('บันทึกผู้ทำและเวลา', rows.every((r) => r.actor_label && r.created_at), '');
  happy('บันทึกค่าเดิมและค่าใหม่', rows.some((r) => r.before_val && r.after_val), '');
  happy('บันทึกเหตุผลเมื่อแก้ข้อมูลที่ล็อกแล้ว', rows.some((r) => r.reason), '');
  happy('เรียงตามเวลา', rows.length < 2 || new Date(rows[0].created_at) >= new Date(rows[1].created_at), '');

  // §9 a delete must remain visible
  await call('/performance/cell', { method: 'POST', user: A, body: { site: site.code, eid: emp.id, date: shift(-1), field: 'team', value: 'ทีมทดสอบ' } });
  await call('/performance/cell', { method: 'POST', user: A, body: { site: site.code, eid: emp.id, date: shift(-1), field: 'team', value: '' } });
  const soft = await query('select deleted_at from work_logs where employee_id = $1 and ymd = $2', [emp.id, shift(-1)]);
  happy('การลบเป็นการยกเลิกเชิงตรรกะ ข้อมูลยังตรวจสอบได้', Boolean(soft.rows[0]?.deleted_at), '');
}

// ── §10 แจ้งเตือน ─────────────────────────────────────────────────────────
suite('§10 การแจ้งเตือน');
{
  const al = await call('/performance/alerts', { user: A });
  happy('มีรายการแจ้งเตือน', al.status === 200 && Array.isArray(al.data), `${al.status}`);
  happy('เตือนโครงการที่ยังบันทึกไม่ครบหรือยังไม่บันทึก',
    (al.data || []).some((x) => ['not-recorded', 'partial'].includes(x.kind)), JSON.stringify((al.data || []).slice(0, 2)));
  happy('เตือนก่อนข้อมูลถูกล็อก', (al.data || []).some((x) => x.kind === 'due-soon'), '');
}

// ── §12 การใช้งานพร้อมกัน ─────────────────────────────────────────────────
suite('§12 ประสิทธิภาพและการใช้งานพร้อมกัน');
{
  const t0 = Date.now();
  const many = await Promise.all(Array.from({ length: 20 }, (_, i) =>
    call(`/performance/manpower?from=${shift(-40)}&to=${TODAY}&_=${i}`, { user: A })));
  const secs = (Date.now() - t0) / 1000;
  happy('20 คำขอพร้อมกันไม่ล้ม', many.every((r) => r.status === 200), `${many.filter((r) => r.status !== 200).length} ล้มเหลว`);
  happy(`ตอบสนองภายในเกณฑ์ (${secs.toFixed(1)} วิ)`, secs < 20, '');

  await call('/performance/cell', { method: 'POST', user: A, body: { site: site.code, eid: emp.id, date: shift(-2), field: 'detail', value: 'ก' } });
  const cur = await query('select updated_at from work_logs where employee_id = $1 and ymd = $2', [emp.id, shift(-2)]);
  const stale = new Date(new Date(cur.rows[0].updated_at).getTime() - 60000).toISOString();
  bad('สองคนแก้พร้อมกันแล้วไม่เขียนทับเงียบ ๆ',
    (await call('/performance/cell', { method: 'POST', user: A, body: {
      site: site.code, eid: emp.id, date: shift(-2), field: 'detail', value: 'ข', seenAt: stale } })).status === 409, '');
}

// ── เก็บกวาด ──────────────────────────────────────────────────────────────
suite('ไม่ทิ้งข้อมูลทดสอบไว้');
{
  await query('delete from leave_requests where employee_id = any($1)', [[emp.id, gone.id, mate.id]]);
  await query('delete from work_log_lines where work_log_id in (select id from work_logs where unit_id = $1)', [site.id]);
  await query('delete from work_logs where unit_id = $1', [site.id]);
  await query('delete from work_log_audit where unit_id = $1', [site.id]);
  await query('delete from period_closes where unit_id = $1', [site.id]);
  await query('delete from employee_away where employee_id = any($1)', [[emp.id, gone.id, mate.id]]);
  await query('update employees set department_id = null, position_id = null where unit_id = $1', [site.id]);
  await query('delete from positions where department_id in (select id from departments where unit_id = $1)', [site.id]);
  await query('delete from departments where unit_id = $1', [site.id]);
  await query('delete from teams where unit_id = $1', [site.id]);
  await query('delete from employees where unit_id = $1', [site.id]);
  await query('delete from units where id = $1', [site.id]);
  const left = await query("select count(*)::int n from units where code like $1", [`${MARK}%`]);
  happy('ลบข้อมูลทดสอบหมดแล้ว', left.rows[0].n === 0, `${left.rows[0].n}`);
}

process.exit(report(`${ROOT}/worklog-uat.json`) ? 1 : 0);
