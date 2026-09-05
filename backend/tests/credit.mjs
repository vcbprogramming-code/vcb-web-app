/**
 * วงเงินสินเชื่อ — the module that moves money.
 *
 * Built during Module 3 and switched off ever since, so it has never had a test
 * suite. These are the checks that have to hold before it is turned on for real:
 * the arithmetic (limit − drawn = available), the approval path, and the fact
 * that every change is attributed. A finance screen whose figures nobody can
 * reproduce or trace is worse than no screen.
 */
import { fileURLToPath } from 'node:url';
import { call, suite, happy, bad, report, U, warm, query, tok, API } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
await warm();
const { admin: A, exec: C, hr: H } = U;
const MARK = 'ZZTEST';
const made = { fac: [], led: [], req: [], plan: [] };

const project = (await query("select id, code from projects where code = 'kda' limit 1")).rows[0];

// ── 1. วงเงิน ──────────────────────────────────────────────────────────────
// The module knows five facility types; the upstream reference lists ten. That
// gap is reported, not papered over — these tests use what the module accepts.
const TYPE = 'B/E (AVAL)';
suite('1. วงเงินและยอดคงเหลือ');
let facId = null;
{
  const r = await call('/credit/facilities', { method: 'POST', user: A, body: {
    projectId: project.id, company: `${MARK} บริษัททดสอบ`, bank: 'ธนาคารทดสอบ',
    facilityNo: 6, limit: 1000000, usedBaseline: 0,   // 6 = B/E รับรอง/อาวัลตั๋ว
    interestRate: 1.0, notes: `${MARK}` } });
  happy('เพิ่มวงเงินได้', r.status === 201 || r.status === 200, `${r.status}`);
  facId = r.data?.id; if (facId) made.fac.push(facId);

  const list = await call('/credit/facilities', { user: A });
  const f = (list.data || []).find((x) => x.id === facId);
  happy('เห็นวงเงินในรายการ', Boolean(f), '');
  happy('ยังไม่เบิก คงเหลือเท่าวงเงินเต็ม', Number(f?.available) === 1000000, String(f?.available));

  bad('ประเภทวงเงินที่ระบบไม่รู้จัก → 400',
    (await call('/credit/facilities', { method: 'POST', user: A, body: {
      projectId: project.id, facilityNo: 99, limit: 1 } })).status === 400, '');
  bad('วงเงินติดลบไม่ได้',
    (await call('/credit/facilities', { method: 'POST', user: A, body: {
      projectId: project.id, facilityNo: 6, limit: -5 } })).status === 400, '');
  bad('โครงการที่ไม่มีอยู่จริง → ไม่ผ่าน',
    [400, 404].includes((await call('/credit/facilities', { method: 'POST', user: A, body: {
      projectId: '00000000-0000-0000-0000-000000000000', facilityNo: 6, limit: 1 } })).status), '');
}

// ── 2. การเบิกใช้ ──────────────────────────────────────────────────────────
suite('2. เบิกใช้แล้วยอดคงเหลือต้องลด');
let ledId = null;
{
  const r = await call('/credit/ledger', { method: 'POST', user: A, body: {
    facilityId: facId, amount: 250000, startDate: '2026-09-01', dueDate: '2026-12-30',
    ref: `${MARK}-001`, note: 'ทดสอบเบิก' } });
  happy('บันทึกการเบิกได้', [200, 201].includes(r.status), `${r.status}`);
  ledId = r.data?.id; if (ledId) made.led.push(ledId);

  const f = ((await call('/credit/facilities', { user: A })).data || []).find((x) => x.id === facId);
  happy('คงเหลือลดลงตามที่เบิก', Number(f?.available) === 750000, String(f?.available));
  happy('ยอดใช้ไปตรงกับที่เบิก', Number(f?.used) === 250000, String(f?.used));

  const r2 = await call('/credit/ledger', { method: 'POST', user: A, body: {
    facilityId: facId, amount: 100000, dueDate: '2026-10-15', ref: `${MARK}-002` } });
  if (r2.data?.id) made.led.push(r2.data.id);
  const f2 = ((await call('/credit/facilities', { user: A })).data || []).find((x) => x.id === facId);
  happy('เบิกเพิ่มแล้วคงเหลือลดต่อ', Number(f2?.available) === 650000, String(f2?.available));

  bad('จำนวนเงินเป็นศูนย์หรือติดลบไม่ได้',
    (await call('/credit/ledger', { method: 'POST', user: A, body: { facilityId: facId, amount: 0 } })).status === 400, '');
  bad('วงเงินที่ไม่มีอยู่จริง → 404',
    (await call('/credit/ledger', { method: 'POST', user: A, body: {
      facilityId: '00000000-0000-0000-0000-000000000000', amount: 100 } })).status === 404, '');
  // a negative drawdown used to be accepted, and it pushed available credit past the limit
  bad('แก้ยอดเบิกเป็นติดลบภายหลังไม่ได้',
    (await call(`/credit/ledger/${ledId}`, { method: 'PATCH', user: A, body: { amount: -999 } })).status === 400, '');
  const clean = ((await call('/credit/facilities', { user: A })).data || []).find((x) => x.id === facId);
  happy('คงเหลือไม่มีทางเกินวงเงินที่ตั้งไว้', Number(clean?.available) <= 1000000, String(clean?.available));
  bad('เลขที่รายการที่ไม่ใช่รูปแบบ id → 404 ไม่ใช่ 500',
    (await call('/credit/ledger/not-a-uuid/settle', { method: 'POST', user: A, body: {} })).status === 404, '');
}

// ── 3. ชำระคืน ─────────────────────────────────────────────────────────────
suite('3. ชำระคืนแล้ววงเงินต้องคืนมา');
{
  const s = await call(`/credit/ledger/${ledId}/settle`, { method: 'POST', user: A, body: { settledDate: '2026-11-01' } });
  happy('บันทึกการชำระได้', s.status === 200, `${s.status}`);
  const f = ((await call('/credit/facilities', { user: A })).data || []).find((x) => x.id === facId);
  happy('ชำระแล้ววงเงินคืนกลับมา', Number(f?.available) === 900000, String(f?.available));
  const led = ((await call('/credit/ledger', { user: A })).data || []).find((x) => x.id === ledId);
  happy('สถานะเปลี่ยนเป็นชำระแล้ว', led?.status === 'ชำระแล้ว', led?.status);
  bad('กดชำระซ้ำอีกครั้งไม่ได้',
    (await call(`/credit/ledger/${ledId}/settle`, { method: 'POST', user: A, body: {} })).status === 409, '');
}

// ── 4. คำขอใช้วงเงินและการอนุมัติ ──────────────────────────────────────────
suite('4. คำขอใช้วงเงินและการอนุมัติ');
{
  const r = await call('/credit/requests', { method: 'POST', user: A, body: {
    facilityId: facId, amount: 300000, startDate: '2026-10-01', dueDate: '2027-01-30',
    ref: `${MARK}-REQ`, note: 'ขอใช้วงเงินทดสอบ' } });
  happy('ยื่นคำขอได้', [200, 201].includes(r.status), `${r.status}`);
  const reqId = r.data?.id; if (reqId) made.req.push(reqId);

  bad('จำนวนเงินติดลบไม่ได้',
    (await call('/credit/requests', { method: 'POST', user: A, body: { facilityId: facId, amount: -1 } })).status === 400, '');
  bad('คำสั่งตัดสินที่ไม่รู้จัก → 400',
    (await call(`/credit/requests/${reqId}/decide`, { method: 'POST', user: A, body: { decision: 'เอาไว้ก่อน' } })).status === 400, '');

  const before = ((await call('/credit/facilities', { user: A })).data || []).find((x) => x.id === facId);
  const d = await call(`/credit/requests/${reqId}/decide`, { method: 'POST', user: A,
    body: { decision: 'อนุมัติ', note: 'อนุมัติตามที่ขอ' } });
  happy('อนุมัติคำขอได้', d.status === 200, `${d.status}`);
  happy('อนุมัติแล้วสร้างรายการเบิกให้อัตโนมัติ', Boolean(d.data?.ledger?.id), '');
  if (d.data?.ledger?.id) made.led.push(d.data.ledger.id);

  const after = ((await call('/credit/facilities', { user: A })).data || []).find((x) => x.id === facId);
  happy('คงเหลือลดลงตามจำนวนที่อนุมัติ',
    Number(before.available) - Number(after.available) === 300000,
    `${before.available} → ${after.available}`);

  bad('ตัดสินซ้ำอีกครั้งไม่ได้',
    (await call(`/credit/requests/${reqId}/decide`, { method: 'POST', user: A, body: { decision: 'ไม่อนุมัติ' } })).status === 409, '');

  // a refusal must not touch the ledger
  const r2 = await call('/credit/requests', { method: 'POST', user: A, body: { facilityId: facId, amount: 50000, ref: `${MARK}-REQ2` } });
  made.req.push(r2.data.id);
  const b2 = ((await call('/credit/facilities', { user: A })).data || []).find((x) => x.id === facId);
  await call(`/credit/requests/${r2.data.id}/decide`, { method: 'POST', user: A, body: { decision: 'ไม่อนุมัติ', note: 'งบไม่พอ' } });
  const a2 = ((await call('/credit/facilities', { user: A })).data || []).find((x) => x.id === facId);
  bad('ไม่อนุมัติแล้ววงเงินไม่ถูกตัด', Number(b2.available) === Number(a2.available), `${b2.available} / ${a2.available}`);
}

// ── 5. เกินกำหนดและภาพรวม ──────────────────────────────────────────────────
suite('5. รายการเกินกำหนดและภาพรวม');
{
  const past = await call('/credit/ledger', { method: 'POST', user: A, body: {
    facilityId: facId, amount: 10000, dueDate: '2020-01-01', ref: `${MARK}-OVERDUE` } });
  made.led.push(past.data.id);
  const od = await call('/credit/overdue', { user: A });
  happy('รายการที่เลยกำหนดขึ้นในรายการเกินกำหนด',
    (od.data || []).some((x) => x.id === past.data.id), `${(od.data || []).length} รายการ`);

  const ov = await call('/credit/overview', { user: A });
  happy('ภาพรวมคำนวณได้', ov.status === 200 && ov.data, '');

  const cp = await call('/credit/cash-plan', { method: 'POST', user: A, body: {
    projectId: project.id, month: '2026-09', income: 500000, note: MARK } });
  happy('บันทึกแผนเงินสดได้', [200, 201].includes(cp.status), `${cp.status}`);
  if (cp.data?.id) made.plan.push(cp.data.id);
  bad('รายรับติดลบไม่ได้',
    (await call('/credit/cash-plan', { method: 'POST', user: A, body: {
      projectId: project.id, month: '2026-09', income: -1 } })).status === 400, '');
  bad('เดือนที่ผิดรูปแบบไม่ได้',
    (await call('/credit/cash-plan', { method: 'POST', user: A, body: {
      projectId: project.id, month: 'กันยายน', income: 1 } })).status === 400, '');
}

// ── 6. สิทธิ์ ──────────────────────────────────────────────────────────────
suite('6. สิทธิ์ — ข้อมูลการเงินต้องจำกัด');
{
  // The seeded hr1 account carries a stale credit override from before the
  // module was gated on permissions, so the test sets the permission it is
  // checking rather than inheriting whatever that account happens to hold.
  const hrPerms = (await query('select permissions from profiles where id = $1', [H.id])).rows[0].permissions;
  const withoutCredit = { ...(hrPerms || {}) };
  delete withoutCredit.credit;
  await query('update profiles set permissions = $2 where id = $1', [H.id, JSON.stringify(withoutCredit)]);

  bad('คนที่ไม่มีสิทธิ์เปิดดูไม่ได้', (await call('/credit/facilities', { user: H })).status === 403, '');
  bad('คนที่ไม่มีสิทธิ์เพิ่มวงเงินไม่ได้',
    (await call('/credit/facilities', { method: 'POST', user: H, body: { projectId: project.id, facilityNo: 6, limit: 1 } })).status === 403, '');

  // ดูได้อย่างเดียวต้องไม่กลายเป็นแก้ได้
  await query(`update profiles set permissions = $2 where id = $1`,
    [H.id, JSON.stringify({ ...withoutCredit, credit: { view: true, edit: false } })]);
  happy('เปิดสิทธิ์ "ดูข้อมูล" ให้รายบุคคลแล้วเปิดดูได้จริง', (await call('/credit/facilities', { user: H })).status === 200, '');
  bad('แต่ยังเพิ่มวงเงินไม่ได้',
    (await call('/credit/facilities', { method: 'POST', user: H, body: { projectId: project.id, facilityNo: 7, limit: 1 } })).status === 403, '');
  await query('update profiles set permissions = $2 where id = $1', [H.id, hrPerms]);

  happy('ผู้บริหารเปิดดูได้', (await call('/credit/facilities', { user: C })).status === 200, '');
  bad('ไม่ล็อกอินเปิดไม่ได้', (await call('/credit/facilities', { user: null })).status === 401, '');
}

// ── 7. ร่องรอยการแก้ไข ─────────────────────────────────────────────────────
suite('7. ทุกการเปลี่ยนแปลงต้องรู้ว่าใครทำ');
{
  const a = await call('/credit/audit', { user: A });
  happy('ประวัติมีรายการที่เพิ่งทำไป', (a.data || []).length > 5, `${(a.data || []).length} รายการ`);
  const mine = (a.data || []).filter((x) => x.actor_label || x.actor_id);
  happy('ทุกรายการบอกว่าใครเป็นคนทำ', mine.length === (a.data || []).length, `${mine.length}/${(a.data || []).length}`);
}

// ── 8. ส่งออก Excel ────────────────────────────────────────────────────────
suite('8. ส่งออก Excel');
{
  const res = await fetch(`${API}/credit/export`, { headers: { Authorization: `Bearer ${tok(A)}` } });
  const buf = Buffer.from(await res.arrayBuffer());
  happy('ดาวน์โหลดไฟล์ได้', res.status === 200, `${res.status}`);
  happy('เป็นไฟล์ Excel จริง', buf.subarray(0, 2).toString() === 'PK', buf.subarray(0, 4).toString('hex'));
  happy('มีเนื้อหา ไม่ใช่ไฟล์เปล่า', buf.length > 3000, `${Math.round(buf.length / 1024)} KB`);
}

// ── เก็บกวาด ───────────────────────────────────────────────────────────────
await query('delete from credit_requests where ref like $1 or note like $1', [`%${MARK}%`]);
await query('delete from credit_ledger where ref like $1 or note like $1', [`%${MARK}%`]);
await query('delete from credit_ledger where facility_id = any($1)', [made.fac]);
await query('delete from credit_requests where facility_id = any($1)', [made.fac]);
await query('delete from facilities where company like $1 or notes like $1', [`%${MARK}%`]);
// the permission checks post a facility they expect to be refused; when one of
// them is wrong the row lands anyway, so it is swept by its marker too
await query(`delete from credit_ledger where facility_id in (select id from facilities where notes like '${MARK}%')`);
await query(`delete from facilities where notes like '${MARK}%'`);
await query('delete from cash_plans where note like $1', [`%${MARK}%`]);
await query('delete from cash_plans where id = any($1)', [made.plan]);
// count the cash plans too — they were the one table the sweep used to miss
const left = await query(
  `select (select count(*) from facilities where notes like $1)::int f,
          (select count(*) from credit_ledger where ref like $1)::int l,
          (select count(*) from cash_plans where note like $1)::int c`, [`%${MARK}%`]);
suite('9. ไม่ทิ้งข้อมูลทดสอบไว้');
happy('ลบข้อมูลทดสอบหมดแล้ว',
  left.rows[0].f === 0 && left.rows[0].l === 0 && left.rows[0].c === 0, JSON.stringify(left.rows[0]));

process.exit(report(`${ROOT}/credit.json`) ? 1 : 0);
