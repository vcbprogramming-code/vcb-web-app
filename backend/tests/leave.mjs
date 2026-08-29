/**
 * ระบบลางาน — the request, the decision, and who is allowed to make it.
 *
 * The rules that matter here are about authority and about not letting the work
 * log drift from the record: only the assigned supervisor decides, a decision
 * cannot be taken twice, and approving is what writes the days into the log —
 * so reversing or cancelling has to take exactly those days back.
 */
import { fileURLToPath } from 'node:url';
import { call, suite, happy, bad, report, U, warm, query, tok, API } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
await warm();
const { admin: A, hr: H, exec: C } = U;
const MARK = 'ZZTEST';
const mine = { emps: [], reqs: [] };

// a unit to hang the test employees off
const unit = (await query('select id, code from units where code is not null order by code limit 1')).rows[0];
async function makeEmployee(name) {
  const r = await query(
    `insert into employees (full_name, employee_code, unit_id, is_active, kind)
     values ($1,$2,$3,true,'operation') returning id`,
    [`${MARK} ${name}`, `ZZ${Date.now().toString(36).slice(-5)}${mine.emps.length}`, unit.id]
  );
  mine.emps.push(r.rows[0].id);
  return r.rows[0].id;
}
const ask = (user, employeeId, from, to, extra = {}) =>
  call('/performance/leave', { method: 'POST', user, body: { employeeId, from, to, leaveType: 'sick', reason: `${MARK}`, ...extra } });

suite('0. ขอบเขตไซต์งาน');
{
  const emp0 = await makeEmployee('นอกขอบเขต');
  // The HR test account is posted to no unit, so its scope is empty — it sees no
  // site at all, which is what the rest of the module already does to it.
  bad('ยื่นลาให้พนักงานไซต์ที่ตัวเองมองไม่เห็นไม่ได้',
    (await ask(H, emp0, '2027-01-05', '2027-01-06')).status === 403, '');
  happy('บัญชีที่ไม่ถูกจำกัดไซต์ ยื่นได้ตามปกติ',
    (await ask(A, emp0, '2027-01-05', '2027-01-06')).status === 201, '');
}

// ── 1. ยื่นคำขอ ────────────────────────────────────────────────────────────
suite('1. ยื่นคำขอลา');
let reqId = null;
{
  const t = await call('/performance/leave/types', { user: A });
  happy('มีประเภทการลาครบ 6 แบบ', (t.types || []).length === 6, (t.types || []).map((x) => x.th).join(' '));

  const emp = await makeEmployee('พนักงานลา');
  const r = await ask(A, emp, '2026-09-01', '2026-09-03');
  happy('ยื่นคำขอลาได้', r.status === 201, `${r.status}`);
  reqId = r.row?.id; if (reqId) mine.reqs.push(reqId);
  happy('นับจำนวนวันให้ถูกต้อง', r.row?.days === 3, String(r.row?.days));
  happy('บอกชื่อประเภทการลาเป็นภาษาไทย', r.row?.leave_type_th === 'ลาป่วย', r.row?.leave_type_th);
  happy('คำขอใหม่อยู่ในสถานะรออนุมัติ', r.row?.status === 'pending', r.row?.status);

  bad('วันสิ้นสุดก่อนวันเริ่ม → 400',
    (await ask(A, emp, '2026-09-10', '2026-09-05')).status === 400, '');
  bad('พนักงานที่ไม่มีอยู่จริง → 404',
    (await ask(A, '00000000-0000-0000-0000-000000000000', '2026-09-01', '2026-09-02')).status === 404, '');
  bad('ประเภทการลาที่ไม่รู้จัก → 400',
    (await ask(A, emp, '2026-10-01', '2026-10-02', { leaveType: 'ลาไปเที่ยว' })).status === 400, '');
  bad('ช่วงวันที่ทับกับคำขอเดิม → 409',
    (await ask(A, emp, '2026-09-02', '2026-09-05')).status === 409, '');
  happy('ช่วงวันที่ไม่ทับกัน ยื่นได้ตามปกติ', (await ask(A, emp, '2026-09-20', '2026-09-21')).status === 201, '');

  const list = await call('/performance/leave/mine', { user: A });
  happy('เห็นคำขอของตัวเองในรายการ', (list.rows || []).some((x) => x.id === reqId), '');
}

// ── 2. ใครอนุมัติของใคร ────────────────────────────────────────────────────
suite('2. หัวหน้าเห็นเฉพาะลูกน้องของตัวเอง');
{
  const mineEmp = await makeEmployee('ลูกน้องของผู้บริหาร');
  const other = await makeEmployee('พนักงานคนอื่น');
  const r1 = await ask(A, mineEmp, '2026-09-01', '2026-09-02'); mine.reqs.push(r1.row.id);
  const r2 = await ask(A, other, '2026-09-01', '2026-09-02'); mine.reqs.push(r2.row.id);

  // before assignment the supervisor has nobody
  const before = await call('/performance/leave/pending', { user: C });
  bad('ยังไม่ได้ผูกลูกน้อง คิวจึงว่าง', (before.rows || []).length === 0, `${(before.rows || []).length}`);
  bad('และระบบบอกว่ายังอนุมัติอะไรไม่ได้', before.canDecide === false, String(before.canDecide));

  const put = await call(`/performance/leave/approvers/${C.id}`, { method: 'PUT', user: A, body: { employeeIds: [mineEmp] } });
  happy('ผูกลูกน้องให้หัวหน้าได้', put.status === 200 && put.count === 1, `${put.status}`);

  const after = await call('/performance/leave/pending', { user: C });
  happy('หัวหน้าเห็นคำขอของลูกน้องตัวเอง', (after.rows || []).some((x) => x.id === r1.row.id), '');
  bad('แต่ไม่เห็นคำขอของพนักงานที่ไม่ใช่ลูกน้อง', !(after.rows || []).some((x) => x.id === r2.row.id), '');

  bad('อนุมัติคนที่ไม่ใช่ลูกน้องไม่ได้',
    (await call(`/performance/leave/${r2.row.id}/decide`, { method: 'POST', user: C, body: { approve: true } })).status === 403, '');

  const pa = await call('/performance/leave/pending', { user: A });
  happy('ผู้ดูแลเห็นทุกคำขอ รวมถึงพนักงานที่ยังไม่มีหัวหน้า',
    (pa.rows || []).some((x) => x.id === r2.row.id), '');

  // A filed it and A is an admin, so the self-decision guard is checked on a
  // supervisor instead: C now owns mineEmp but did not file the request.
  happy('หัวหน้าที่ไม่ได้เป็นผู้ยื่น ตัดสินได้',
    [200].includes((await call(`/performance/leave/${r1.row.id}/decide`, { method: 'POST', user: C, body: { approve: false } })).status), '');

  // clear the assignment again so later runs start clean
  await call(`/performance/leave/approvers/${C.id}`, { method: 'PUT', user: A, body: { employeeIds: [] } });
}

// ── 3. อนุมัติแล้ววันลาเข้าตารางงาน ────────────────────────────────────────
suite('3. อนุมัติแล้ววันลาไปขึ้นในตารางงาน');
{
  const emp = await makeEmployee('อนุมัติแล้ว');
  // เกณฑ์ตรวจรับ §6: ผู้ยื่นคำขอกับผู้อนุมัติต้องเป็นคนละคน — ผู้ดูแลยื่นแทน
  // พนักงาน แล้วหัวหน้าที่ถูกผูกไว้เป็นผู้อนุมัติ
  const r = await ask(A, emp, '2026-11-03', '2026-11-05'); mine.reqs.push(r.row.id);
  await query('insert into leave_approvers (approver_id, employee_id) values ($1,$2) on conflict do nothing', [C.id, emp]);
  bad('ผู้ยื่นอนุมัติคำขอที่ตัวเองยื่นไม่ได้',
    (await call(`/performance/leave/${r.row.id}/decide`, { method: 'POST', user: A, body: { approve: true } })).status === 403, '');
  const dec = await call(`/performance/leave/${r.row.id}/decide`, { method: 'POST', user: C, body: { approve: true, note: 'อนุมัติตามที่ขอ' } });
  happy('ผู้อนุมัติคนละคนกับผู้ยื่นอนุมัติได้', dec.status === 200 && dec.row.status === 'approved', dec.row?.status || dec.error);
  happy('บันทึกว่าใครเป็นผู้ตัดสิน', Boolean(dec.row?.decided_by_name), dec.row?.decided_by_name);

  const away = await query('select ymd from employee_away where leave_request_id = $1 order by ymd', [r.row.id]);
  happy('เขียนวันลาลงตารางงานครบทุกวัน', away.rows.length === 3, `${away.rows.length} วัน`);
  // The driver builds a Date from a date column in the CLIENT's timezone, so
  // toISOString() shifts it a day back east of UTC. Format from the local parts,
  // the same way the app's own dateStr() does.
  const ymd = (d) => { const x = new Date(d); const p2 = (n) => String(n).padStart(2, '0');
    return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`; };
  happy('วันแรกตรงกับวันที่ขอ', ymd(away.rows[0]?.ymd) === '2026-11-03', ymd(away.rows[0]?.ymd));
  happy('วันสุดท้ายตรงกับวันที่ขอ', ymd(away.rows[2]?.ymd) === '2026-11-05', ymd(away.rows[2]?.ymd));

  // and the grid must be able to say WHY the day is blank
  const site = (await query('select code from units where id = (select unit_id from employees where id = $1)', [emp])).rows[0];
  const sm = await call(`/performance/site-month?site=${site.code}&year=2026&month=11`, { user: A });
  const me = (sm.employees || sm.roster || []).find((x) => x.eid === emp);
  happy('ตารางงานบอกประเภทการลาของวันนั้น',
    me && me.leave && me.leave['2026-11-03'] === 'ลาป่วย', JSON.stringify(me?.leave || {}));
  happy('และยังนับเป็นวันไม่มาทำงานเหมือนเดิม',
    me && (me.away || []).includes('2026-11-03'), JSON.stringify(me?.away || []));

  bad('ตัดสินซ้ำอีกครั้งไม่ได้',
    (await call(`/performance/leave/${r.row.id}/decide`, { method: 'POST', user: A, body: { approve: false } })).status === 409, '');
  bad('คำขอที่อนุมัติแล้วยกเลิกไม่ได้',
    (await call(`/performance/leave/${r.row.id}/cancel`, { method: 'POST', user: A })).status === 409, '');

  const hist = await call('/performance/leave/decided', { user: A });
  happy('เข้าประวัติการพิจารณาแล้ว', (hist.rows || []).some((x) => x.id === r.row.id), '');
  const pend = await call('/performance/leave/pending', { user: A });
  bad('และออกจากคิวรออนุมัติแล้ว', !(pend.rows || []).some((x) => x.id === r.row.id), '');

  // a refusal must leave the work log alone
  const emp2 = await makeEmployee('ไม่อนุมัติ');
  const r2 = await ask(A, emp2, '2026-11-10', '2026-11-12'); mine.reqs.push(r2.row.id);
  await call(`/performance/leave/${r2.row.id}/decide`, { method: 'POST', user: A, body: { approve: false, note: 'งานเร่ง' } });
  const away2 = await query('select 1 from employee_away where leave_request_id = $1', [r2.row.id]);
  bad('ไม่อนุมัติแล้วไม่เขียนวันลาลงตารางงาน', away2.rows.length === 0, `${away2.rows.length}`);
}

// ── 4. ยกเลิกคำขอ ──────────────────────────────────────────────────────────
suite('4. ยกเลิกคำขอที่ยังไม่ถูกตัดสิน');
{
  const emp = await makeEmployee('ยกเลิก');
  const r = await ask(A, emp, '2026-12-01', '2026-12-02'); mine.reqs.push(r.row.id);
  bad('คนอื่นยกเลิกคำขอของเราไม่ได้',
    (await call(`/performance/leave/${r.row.id}/cancel`, { method: 'POST', user: C })).status === 403, '');
  happy('ผู้ยื่นยกเลิกเองได้',
    (await call(`/performance/leave/${r.row.id}/cancel`, { method: 'POST', user: A })).status === 200, '');
  const row = await queryStatus(r.row.id);
  happy('สถานะเปลี่ยนเป็นยกเลิก', row === 'cancelled', row);
  happy('ยกเลิกแล้วยื่นช่วงวันเดิมใหม่ได้', (await ask(A, emp, '2026-12-01', '2026-12-02')).status === 201, '');
}
async function queryStatus(id) {
  return (await query('select status from leave_requests where id = $1', [id])).rows[0]?.status;
}

// ── 4b. ใบลา ───────────────────────────────────────────────────────────────
suite('4b. ใบลาสำหรับพิมพ์');
{
  const emp = await makeEmployee('ใบลา');
  const r = await ask(A, emp, '2027-05-04', '2027-05-08', { leaveType: 'vacation', reason: 'พาครอบครัวไปต่างจังหวัด' });
  mine.reqs.push(r.row.id);
  await call(`/performance/leave/${r.row.id}/decide`, { method: 'POST', user: A, body: { approve: true, note: 'อนุมัติตามที่ขอ' } });

  const res = await fetch(`${API}/performance/leave/${r.row.id}/slip`, { headers: { Authorization: `Bearer ${tok(A)}` } });
  const buf = Buffer.from(await res.arrayBuffer());
  happy('เปิดใบลาได้', res.status === 200, `${res.status}`);
  happy('เป็นไฟล์ PDF จริง', buf.subarray(0, 5).toString() === '%PDF-', buf.subarray(0, 8).toString());
  happy('เปิดอ่านในแท็บได้เลย ไม่บังคับดาวน์โหลด',
    (res.headers.get('content-disposition') || '').startsWith('inline'), res.headers.get('content-disposition'));
  happy('มีเนื้อหาจริง ไม่ใช่ไฟล์เปล่า', buf.length > 20000, `${Math.round(buf.length / 1024)} KB`);

  bad('คนที่ไม่เกี่ยวข้องเปิดใบลาไม่ได้',
    (await fetch(`${API}/performance/leave/${r.row.id}/slip`, { headers: { Authorization: `Bearer ${tok(C)}` } })).status === 403, '');
  bad('คำขอที่ไม่มีอยู่จริง → 404',
    (await fetch(`${API}/performance/leave/00000000-0000-0000-0000-000000000000/slip`, { headers: { Authorization: `Bearer ${tok(A)}` } })).status === 404, '');
}

// ── 5. หน้าตั้งค่าผู้อนุมัติ ───────────────────────────────────────────────
suite('5. หน้าตั้งค่าหัวหน้า-ลูกน้อง');
{
  const a = await call('/performance/leave/approvers', { user: A });
  happy('ผู้ดูแลเปิดหน้าตั้งค่าได้', a.status === 200, `${a.status}`);
  happy('มีรายชื่อผู้ใช้ให้เลือกเป็นหัวหน้า', (a.people || []).length > 0, `${(a.people || []).length}`);
  happy('บอกว่าพนักงานคนไหนยังไม่มีหัวหน้า', Array.isArray(a.unassigned), '');
  bad('ฝ่ายบุคคลเปิดหน้าตั้งค่าไม่ได้',
    (await call('/performance/leave/approvers', { user: H })).status === 403, '');
  bad('ผูกลูกน้องให้ผู้ใช้ที่ไม่มีอยู่จริงไม่ได้',
    (await call('/performance/leave/approvers/00000000-0000-0000-0000-000000000000', { method: 'PUT', user: A, body: { employeeIds: [] } })).status === 404, '');
}

// ── เก็บกวาด ───────────────────────────────────────────────────────────────
await query(`delete from leave_requests where employee_id in
  (select id from employees where full_name like $1)`, [`%${MARK}%`]);
await query('delete from employees where full_name like $1', [`%${MARK}%`]);
const left = await query(
  `select (select count(*) from employees where full_name like $1)::int e,
          (select count(*) from leave_requests where reason like $1)::int r`, [`%${MARK}%`]);
await query('delete from leave_approvers where approver_id = $1 and employee_id = any($2)', [C.id, mine.emps]);

suite('6. ไม่ทิ้งข้อมูลทดสอบไว้');
happy('ลบพนักงานและคำขอทดสอบหมดแล้ว',
  left.rows[0].e === 0 && left.rows[0].r === 0, JSON.stringify(left.rows[0]));

process.exit(report(`${ROOT}/leave.json`) ? 1 : 0);
