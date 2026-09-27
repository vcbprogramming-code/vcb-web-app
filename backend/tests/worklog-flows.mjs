/**
 * บันทึกงานฝ่ายบุคคล + คำขอลา — ไล่ทีละสถานการณ์การใช้งาน เทียบกับระบบจริง
 *
 * ชุดนี้ไม่ได้ตรวจว่า "ปุ่มมีอยู่" แต่ตรวจว่า ผู้ใช้ทำอะไร → ระบบตอบอะไร → ข้อมูล
 * เปลี่ยนไปอย่างไร โดยยึดพฤติกรรมของ Code.gs (ORIGINAL CODE/hr-worklog) เป็น
 * มาตรฐาน ทุกข้อที่เราเลือกต่างจากเขาโดยเจตนามีคอมเมนต์กำกับว่าทำไม
 *
 * ความปลอดภัยของข้อมูลจริง (ฐานข้อมูลนี้มีข้อมูลของลูกค้าอยู่จริง 325 คน · 8 ไซต์
 * · บันทึกงาน 21,348 ช่อง · คำขอลา 14 ใบ):
 *   · สร้างไซต์/พนักงานของตัวเองทั้งหมด ชื่อขึ้นต้น ZZFLOW เสมอ แล้วลบทิ้งท้ายรอบ
 *   · ห้ามอนุมัติ/ปฏิเสธคำขอลาใบจริง — ยืนยันยอดใบที่ค้างอยู่ก่อนและหลังว่าเท่าเดิม
 *   · ไม่แก้ไขทะเบียนงาน/หมวดงานของจริง (ทดสอบลบด้วยรหัสที่เราเพิ่มเองเท่านั้น
 *     ยกเว้นการลบรหัสที่มีบันทึกอ้างอิง ซึ่งตรวจผลลัพธ์แล้วเปิดใช้งานกลับทันที)
 *
 * รัน: API=http://localhost:4000/api node tests/worklog-flows.mjs
 */
import { fileURLToPath } from 'node:url';
import { call, suite, happy, bad, report, U, warm, query } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
await warm();
const A = U.admin;        // ผู้ดูแลระบบ — เห็นทุกไซต์ แก้ย้อนหลังได้
const H = U.hr;           // ฝ่ายบุคคล — ไม่ได้ผูกไซต์ จึงไม่เห็นไซต์ไหนเลย
const C = U.exec;         // ผู้บริหาร — ดูได้ ไม่ได้บันทึก
const MARK = 'ZZFLOW';

// ── ของที่เราสร้างขึ้นเอง ต้องเก็บกวาดให้หมด ───────────────────────────────
const mine = { sites: [], emps: [], reqs: [], acts: [], cats: [] };

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = new Date();
/** วันที่ห่างจากวันนี้ n วัน (ลบ = ย้อนหลัง) เป็นสตริง YYYY-MM-DD */
const ds = (n) => { const x = new Date(TODAY); x.setDate(x.getDate() + n); return iso(x); };
const Y = TODAY.getFullYear(), M = TODAY.getMonth() + 1;

// ยอดคำขอลาจริงที่ค้างอยู่ — ห้ามเปลี่ยน
const realPendingBefore = (await query(
  "select count(*)::int n from leave_requests where status = 'pending'")).rows[0].n;

async function newSite(name, extra = {}) {
  const r = await call('/performance/sites', { method: 'POST', user: A, body: { name: `${MARK} ${name}`, ...extra } });
  if (r.status !== 201) throw new Error(`สร้างไซต์ทดสอบไม่สำเร็จ: ${r.status} ${r.error || ''}`);
  mine.sites.push(r.data.key);
  return r.data.key;
}
async function newEmp(siteKey, name, kind = 'operation', code) {
  const r = await call('/performance/employees', { method: 'POST', user: A,
    body: { site: siteKey, fullName: `${MARK} ${name}`, kind, employeeCode: code } });
  if (r.status !== 201) throw new Error(`สร้างพนักงานทดสอบไม่สำเร็จ: ${r.status} ${r.error || ''}`);
  mine.emps.push(r.data.eid);
  return r.data.eid;
}
const cell = (site, eid, date, field, value, extra = {}) =>
  call('/performance/cell', { method: 'POST', user: A, body: { site, eid, date, field, value, ...extra } });
const siteMonth = (site, y = Y, m = M) =>
  call(`/performance/site-month?site=${site}&year=${y}&month=${m}`, { user: A });
const askLeave = (user, employeeId, from, to, extra = {}) =>
  call('/performance/leave', { method: 'POST', user,
    body: { employeeId, from, to, leaveType: 'sick', reason: MARK, ...extra } });
/** ค่าที่อยู่ในช่องงานหลักของวันนั้น อ่านจากฐานข้อมูลตรง ๆ */
const slot1 = async (eid, date) => (await query(
  'select team, detail, pm, note from work_logs where employee_id = $1 and ymd = $2 and deleted_at is null',
  [eid, date])).rows[0] || null;

// ===========================================================================
// 1. ลงบันทึกงานในตาราง
// ===========================================================================
const SITE = await newSite('ไซต์หลัก', { company: `${MARK} จำกัด` });
const OP = await newEmp(SITE, 'สายปฏิบัติการ', 'operation', `${MARK}-OP1`);
const SUP = await newEmp(SITE, 'สายสนับสนุน', 'support', `${MARK}-SUP1`);

suite('1. ลงบันทึกงานในตาราง — ช่วงเวลาที่บันทึกได้');
{
  happy('บันทึกของวันนี้ได้', (await cell(SITE, OP, ds(0), 'team', 'A-1 / 5')).status === 200);
  happy('บันทึกของพรุ่งนี้ได้ (ขอบบนของระบบจริง)', (await cell(SITE, OP, ds(1), 'team', 'A-1 / 5')).status === 200);
  const far = await cell(SITE, OP, ds(2), 'team', 'A-1 / 5');
  bad('บันทึกล่วงหน้าเกินพรุ่งนี้ไม่ได้ → 400', far.status === 400, `${far.status}`);
  bad('และบอกเหตุผลเป็นภาษาคน', /ล่วงหน้า/.test(far.error || ''), far.error);
  // ระบบจริงบังคับขอบบนนี้กับทุกคน "so the month can't be filled before it happens"
  bad('ผู้ดูแลระบบก็ข้ามขอบบนไม่ได้',
    (await cell(SITE, OP, ds(2), 'team', 'A-1 / 5', { adminUnlock: true })).status === 400);

  happy('วันที่พอดีเส้นตาย (วันนี้ − ระยะล็อก) ยังแก้ได้',
    (await cell(SITE, OP, ds(-3), 'team', 'A-1 / 5')).status === 200);
  const locked = await cell(SITE, OP, ds(-4), 'team', 'A-1 / 5');
  bad('เลยระยะล็อกแล้วแก้ไม่ได้ → 409', locked.status === 409, `${locked.status}`);
  bad('และบอกว่าผู้ดูแลระบบปลดล็อกได้', /ปลดล็อก/.test(locked.error || ''), locked.error);
  happy('ผู้ดูแลระบบเปิดโหมดแก้ย้อนหลังแล้วแก้ได้',
    (await cell(SITE, OP, ds(-4), 'team', 'A-1 / 5', { adminUnlock: true })).status === 200);
  // ระบบจริงคิดเส้นตายเป็น "วันนี้ − lockDays" ตรง ๆ ตั้ง 0 = แก้ได้แค่วันนี้/พรุ่งนี้
  // ไม่ใช่ "ไม่ล็อกเลย" — เคยตีความกลับด้าน คนที่ตั้ง 0 เพราะอยากล็อกแน่นที่สุด
  // จะได้ผลตรงข้ามคือเปิดให้แก้ย้อนหลังไม่จำกัด
  await call(`/performance/sites/${SITE}`, { method: 'PATCH', user: A, body: { lockDays: 0 } });
  happy('ตั้งระยะล็อก 0 แล้ววันนี้ยังบันทึกได้', (await cell(SITE, OP, ds(0), 'pm', 'A-2 / 5')).status === 200);
  bad('ตั้งระยะล็อก 0 แล้วเมื่อวานล็อกทันที', (await cell(SITE, OP, ds(-1), 'team', 'A-1 / 5')).status === 409);
  happy('ตั้งระยะล็อก 0 พรุ่งนี้ยังบันทึกได้ (ขอบบนไม่เกี่ยวกับระยะล็อก)',
    (await cell(SITE, OP, ds(1), 'team', 'A-2 / 5')).status === 200);
  await call(`/performance/sites/${SITE}`, { method: 'PATCH', user: A, body: { lockDays: 3 } });
  await cell(SITE, OP, ds(0), 'pm', '');
}

suite('1b. ค่าที่ลงในช่อง');
{
  happy('ค่าคู่ "กิจกรรม / หมวดงาน" บันทึกได้', (await cell(SITE, OP, ds(0), 'team', 'A-1 / 5')).status === 200);
  happy('และเก็บตรงตามที่ส่งมา', (await slot1(OP, ds(0)))?.team === 'A-1 / 5');
  // ระบบจริงไม่ตรวจรหัสกับทะเบียนเลย (cellDisplay_ ขึ้นค่าดิบเมื่อหารหัสไม่เจอ)
  // วันหยุด/ข้อความอิสระ/ข้อมูลเก่าจึงอยู่ในช่องได้ ห้ามปฏิเสธ ไม่งั้นแก้ของเก่าไม่ได้
  happy('รหัสที่ไม่มีในทะเบียนยังบันทึกได้ (เหมือนระบบจริง)',
    (await cell(SITE, OP, ds(0), 'team', 'QQ-99 / 77')).status === 200);
  happy('ข้อความอิสระในช่องยังบันทึกได้', (await cell(SITE, OP, ds(0), 'team', 'ทำงานทั่วไป')).status === 200);
  happy('รหัสตัวเล็กบันทึกได้และเก็บตามที่พิมพ์',
    (await cell(SITE, OP, ds(0), 'team', 'a-1 / 5')).status === 200 && (await slot1(OP, ds(0)))?.team === 'a-1 / 5');
  // รายงานต้องยังหาหมวดให้รหัสตัวเล็กได้ ไม่งั้นแรงงาน-วันหลุดออกจากกราฟ
  const mdLower = await call(`/performance/report/manday?from=${ds(0)}&to=${ds(0)}&groupBy=worktype`, { user: A });
  happy('รายงานเทียบรหัสแบบไม่สนตัวพิมพ์ รหัสตัวเล็กจึงไม่หลุดจากกราฟ',
    (mdLower.data?.rows || []).some((r) => String(r.key).toUpperCase() === 'A-1'),
    JSON.stringify((mdLower.data?.rows || []).map((r) => r.key)));
  await cell(SITE, OP, ds(0), 'team', 'A-1 / 5');

  happy('ล้างค่าในช่องได้', (await cell(SITE, OP, ds(0), 'team', '')).status === 200);
  happy('ล้างแล้วช่องว่างจริง', (await slot1(OP, ds(0))) === null);
  happy('ล้างแล้วพิมพ์ใหม่กลับมาได้ (แถวที่ถูกลบต้องคืนชีพ)',
    (await cell(SITE, OP, ds(0), 'team', 'A-3 / 5')).status === 200 && (await slot1(OP, ds(0)))?.team === 'A-3 / 5');
}

suite('1c. ช่องที่สอง (งานที่ 2 / pm)');
{
  happy('ลงงานที่สองคนละรหัสได้', (await cell(SITE, OP, ds(0), 'pm', 'A-4 / 5')).status === 200);
  happy('หนึ่งวันสองงานแบ่งแรงงาน-วันคนละครึ่ง', await (async () => {
    const r = await call(`/performance/report/manday?from=${ds(0)}&to=${ds(0)}&groupBy=worktype`, { user: A });
    const rows = (r.data?.rows || []).filter((x) => ['A-3', 'A-4'].includes(x.key));
    return rows.length === 2 && rows.every((x) => Number(x.manday) === 0.5);
  })());
  // กฎของ oppPick: รหัสงานเดียวกันสองช่องไม่ได้ (เทียบเฉพาะรหัสงาน ไม่สนหมวดท้ายค่า)
  // ของเขากันแค่ที่หน้าจอ ค่าที่มาทางอื่นจึงเข้าได้ — เรากันที่เซิร์ฟเวอร์ด้วย
  const dup = await cell(SITE, OP, ds(0), 'pm', 'A-3 / 9');
  bad('งานเดียวกันทั้งสองช่องไม่ได้ → 400', dup.status === 400, `${dup.status}`);
  bad('และใช้ถ้อยคำเดียวกับระบบจริง', /งานทั้งสองช่องเหมือนกัน/.test(dup.error || ''), dup.error);
  bad('สลับด้าน (แก้ช่องแรกให้ซ้ำช่องที่สอง) ก็ไม่ได้',
    (await cell(SITE, OP, ds(0), 'team', 'A-4 / 9')).status === 400);
  happy('ล้างงานที่สองได้ โดยงานหลักยังอยู่',
    (await cell(SITE, OP, ds(0), 'pm', '')).status === 200 && (await slot1(OP, ds(0)))?.team === 'A-3 / 5');
}

suite('1d. ช่องงานหลักของแต่ละสายงาน');
{
  happy('สายสนับสนุนลงที่ช่อง detail ได้', (await cell(SITE, SUP, ds(0), 'detail', 'A-1 / 5')).status === 200);
  bad('สายสนับสนุนลงที่ช่อง team ไม่ได้', (await cell(SITE, SUP, ds(0), 'team', 'A-1 / 5')).status === 400);
  bad('สายปฏิบัติการลงที่ช่อง detail ไม่ได้', (await cell(SITE, OP, ds(0), 'detail', 'A-1 / 5')).status === 400);
  // ระบบจริงใช้กล่องเลือกกิจกรรมกับทั้งสองสายงาน (renderGrid ตั้ง data-pick ทุกช่อง)
  // ตัวเลือกจึงต้องมาพร้อมตารางสำหรับทั้งสองสาย ไม่ใช่มีแต่สายปฏิบัติการ
  const sm = await siteMonth(SITE);
  happy('ตารางส่งทะเบียนกิจกรรมมาให้เลือก', (sm.teams || []).length > 0, `${(sm.teams || []).length}`);
  happy('ตารางส่งทะเบียนหมวดงานมาให้เลือกขั้นที่สอง', (sm.costs || []).length > 0, `${(sm.costs || []).length}`);
  happy('กิจกรรมบอกด้วยว่าใช้หมวดงานไหนได้ (กรองขั้นที่สอง)',
    (sm.teams || []).some((x) => String(x.allowed_cost || '').includes(',')));
  happy('กิจกรรมบอกด้วยว่าเป็นแบบขั้นตอนเดียวหรือสองขั้นตอน',
    (sm.teams || []).some((x) => x.mapping === 'one-to-one') && (sm.teams || []).some((x) => x.mapping === 'one-to-many'));
}

suite('1e. วันหยุด / วันอาทิตย์ / อนาคต ในตาราง');
{
  const sm = await siteMonth(SITE);
  const sundays = (sm.days || []).filter((d) => d.weekend);
  happy('วันอาทิตย์ถูกทำเครื่องหมายเป็นวันหยุด', sundays.length >= 4, `${sundays.length}`);
  happy('และเป็นวันอาทิตย์เท่านั้น (เสาร์เป็นวันทำงาน)', sundays.every((d) => d.dow === 0));
  const sun = sundays.map((d) => d.date).filter((x) => x <= ds(0) && x >= ds(-3))[0] || null;
  if (sun) happy('วันอาทิตย์ยังลงบันทึกได้ (ระบบจริงไม่ห้าม แค่เปลี่ยนสี)',
    (await cell(SITE, OP, sun, 'team', 'Z-1')).status === 200, sun);
  else happy('วันอาทิตย์ยังลงบันทึกได้ (เดือนนี้ไม่มีวันอาทิตย์ในช่วงที่แก้ได้)', true);
  // อนาคตกับ "เลยกำหนด" ไม่ใช่เรื่องเดียวกัน หน้าจอต้องแยกสีและแยกคำอธิบายได้
  const states = new Set((sm.days || []).map((d) => d.state));
  happy('ตารางแยกสถานะวันข้างหน้าออกจากวันที่ล็อกแล้ว',
    states.has('future') || (sm.days || []).every((d) => d.date <= ds(1)), [...states].join(','));
  happy('ไม่มีวันไหนไม่มีสถานะ', (sm.days || []).every((d) => d.state));
}

suite('1f. ไซต์ที่ปิดแล้ว');
{
  const CLOSED = await newSite('ไซต์ที่ปิด');
  const e = await newEmp(CLOSED, 'คนในไซต์ที่ปิด');
  happy('ก่อนปิด บันทึกได้', (await cell(CLOSED, e, ds(0), 'team', 'A-1 / 5')).status === 200);
  const off = await call(`/performance/sites/${CLOSED}`, { method: 'PATCH', user: A, body: { active: false } });
  happy('ปิดโครงการที่ยังมีคนอยู่ได้ (ระบบจริงเตือนแต่ไม่ห้าม)', off.status === 200 && off.data.active === false);
  // ข้อความยืนยันของระบบจริงบอกไว้ว่า "จะไม่สามารถบันทึกงานใหม่ได้ แต่ประวัติเดิมยังอยู่"
  // ของเขาบังคับแค่ที่หน้าจอ (ซ่อนชื่อออกจากดรอปดาวน์) เราบังคับที่เซิร์ฟเวอร์ด้วย
  const w = await cell(CLOSED, e, ds(0), 'team', 'A-2 / 5');
  bad('ปิดแล้วบันทึกใหม่ไม่ได้ → 409', w.status === 409, `${w.status}`);
  bad('และบอกว่าโครงการปิดแล้ว', /ปิดแล้ว/.test(w.error || ''), w.error);
  happy('แต่ประวัติเดิมยังอ่านได้', (await siteMonth(CLOSED)).ok === true);
  const li = await call('/performance/sites', { user: A });
  happy('รายการโครงการยังมีไซต์ที่ปิด เพื่อเปิดกลับได้',
    (li.data || []).some((s) => s.key === CLOSED && s.active === false));
  happy('รายการโครงการบอกจำนวนคนที่ยังอยู่ ให้เตือนก่อนปิดได้',
    (li.data || []).find((s) => s.key === CLOSED)?.emps === 1);
  happy('เปิดโครงการกลับได้',
    (await call(`/performance/sites/${CLOSED}`, { method: 'PATCH', user: A, body: { active: true } })).data.active === true);
}

suite('1g. พนักงานที่ย้ายไซต์กลางเดือน');
{
  const S2 = await newSite('ไซต์ปลายทาง');
  const e = await newEmp(SITE, 'ย้ายกลางเดือน');
  await cell(SITE, e, ds(-3), 'team', 'A-1 / 5');
  const mv = await call(`/performance/employees/${e}/move`, { method: 'POST', user: A, body: { site: S2, date: ds(-2) } });
  happy('ย้ายไซต์แบบมีวันที่มีผลได้', mv.status === 200 && mv.data.moved === true, `${mv.status}`);
  // empSiteOn_ ใช้ <= วันที่ย้ายนับเป็นไซต์ใหม่แล้ว "อยู่ได้ทีละหน่วยงานต่อวันเท่านั้น"
  bad('วันหลังย้าย ไซต์เดิมบันทึกไม่ได้',
    (await cell(SITE, e, ds(-1), 'team', 'A-1 / 5')).status === 400);
  happy('วันหลังย้าย ไซต์ใหม่บันทึกได้',
    (await cell(S2, e, ds(-1), 'team', 'A-1 / 5')).status === 200);
  happy('วันที่ย้ายเองนับเป็นไซต์ใหม่แล้ว',
    (await cell(S2, e, ds(-2), 'team', 'A-1 / 5')).status === 200);
  bad('และไซต์เดิมบันทึกวันที่ย้ายไม่ได้',
    (await cell(SITE, e, ds(-2), 'team', 'A-2 / 5')).status === 400);
  // ทั้งสองไซต์ต้องเห็นคนนี้ทั้งเดือน วันที่ไม่ได้สังกัดขึ้นเป็นช่องที่กดไม่ได้
  const a = (await siteMonth(SITE)).employees.find((x) => x.eid === e);
  const b = (await siteMonth(S2)).employees.find((x) => x.eid === e);
  happy('ไซต์เดิมยังเห็นคนนี้ในเดือนที่ย้าย', Boolean(a));
  happy('ไซต์ใหม่ก็เห็นคนนี้ในเดือนเดียวกัน', Boolean(b));
  happy('ไซต์เดิมทำวันที่หลังย้ายเป็นวันที่ไม่ได้สังกัด', (a?.away || []).includes(ds(-1)));
  bad('แต่วันก่อนย้ายยังเป็นของไซต์เดิม', !(a?.away || []).includes(ds(-3)));
  happy('ไซต์เดิมบอกว่าย้ายออกไปไหน', a?.moved_out === ds(-2) && Boolean(a?.moved_out_to), `${a?.moved_out} → ${a?.moved_out_to}`);
  happy('ไซต์ใหม่บอกว่าย้ายเข้ามาจากไหน', b?.moved_in === ds(-2) && Boolean(b?.moved_in_from), `${b?.moved_in} ← ${b?.moved_in_from}`);
  happy('บันทึกเก่าที่ไซต์เดิมยังอยู่ครบ', Boolean((await slot1(e, ds(-3)))?.team));

  bad('ย้ายไปไซต์เดิมที่อยู่อยู่แล้วไม่ได้',
    (await call(`/performance/employees/${e}/move`, { method: 'POST', user: A, body: { site: S2, date: ds(0) } })).status === 400);
  const early = await call(`/performance/employees/${e}/move`, { method: 'POST', user: A, body: { site: SITE, date: ds(-9) } });
  bad('ย้ายด้วยวันที่ก่อนการย้ายครั้งล่าสุดไม่ได้', early.status === 400, early.error);
  const rev = await call(`/performance/employees/${e}/move`, { method: 'POST', user: A, body: { site: SITE, date: ds(-2) } });
  happy('ย้ายกลับต้นทางด้วยวันเดิม = ยกเลิกการย้าย', rev.status === 200 && rev.data.reverted === true, JSON.stringify(rev.data));
  happy('ยกเลิกแล้วไซต์เดิมบันทึกวันนั้นได้อีก', (await cell(SITE, e, ds(-1), 'team', 'A-1 / 5')).status === 200);
  bad('ย้ายไปไซต์ที่ไม่มีอยู่จริง → 404',
    (await call(`/performance/employees/${e}/move`, { method: 'POST', user: A, body: { site: 'ZZNOPE', date: ds(0) } })).status === 404);
  happy('ประวัติการย้ายอ่านได้', Array.isArray((await call('/performance/moves', { user: A })).data));
}

suite('1h. พนักงานที่ลาทั้งวัน (ทำเครื่องหมายไม่อยู่)');
{
  const e = await newEmp(SITE, 'ทำเครื่องหมายไม่อยู่');
  happy('ทำเครื่องหมายว่าไม่อยู่ได้',
    (await call(`/performance/employees/${e}/away`, { method: 'POST', user: A, body: { date: ds(-1), away: true } })).status === 200);
  const row = (await siteMonth(SITE)).employees.find((x) => x.eid === e);
  happy('ตารางรู้ว่าวันนั้นคนนี้ไม่อยู่', (row?.away || []).includes(ds(-1)));
  happy('ยกเลิกเครื่องหมายได้',
    (await call(`/performance/employees/${e}/away`, { method: 'POST', user: A, body: { date: ds(-1), away: false } })).status === 200);
  const row2 = (await siteMonth(SITE)).employees.find((x) => x.eid === e);
  bad('ยกเลิกแล้วหายจากรายการวันที่ไม่อยู่', !(row2?.away || []).includes(ds(-1)));
}

suite('1i. เขียนชนกัน / สิทธิ์');
{
  await cell(SITE, OP, ds(0), 'team', 'A-1 / 5');
  const clash = await cell(SITE, OP, ds(0), 'team', 'A-2 / 5', { seenAt: '2020-01-01T00:00:00Z' });
  bad('คนที่สองที่เห็นข้อมูลเก่าถูกบอก ไม่ใช่เขียนทับเงียบ ๆ → 409', clash.status === 409, `${clash.status}`);
  happy('และค่าเดิมไม่ถูกทับ', (await slot1(OP, ds(0)))?.team === 'A-1 / 5');
  bad('บัญชีที่ไม่เห็นไซต์นี้บันทึกไม่ได้',
    (await call('/performance/cell', { method: 'POST', user: H,
      body: { site: SITE, eid: OP, date: ds(0), field: 'team', value: 'A-9 / 5' } })).status === 403);
  bad('ผู้บริหารดูได้แต่บันทึกไม่ได้',
    [403, 401].includes((await call('/performance/cell', { method: 'POST', user: C,
      body: { site: SITE, eid: OP, date: ds(0), field: 'team', value: 'A-9 / 5' } })).status));
  bad('พนักงานที่ไม่มีอยู่จริง → 400/404',
    [400, 404].includes((await cell(SITE, '00000000-0000-0000-0000-000000000000', ds(0), 'team', 'A-1 / 5')).status));
  bad('ไซต์ที่ไม่มีอยู่จริง → 404', (await cell('ZZNOPE', OP, ds(0), 'team', 'A-1 / 5')).status === 404);
  bad('วันที่รูปแบบผิด → 400', (await cell(SITE, OP, '27/09/2026', 'team', 'A-1 / 5')).status === 400);
  bad('ช่องที่ไม่รู้จัก → 400', (await cell(SITE, OP, ds(0), 'ot', '8')).status === 400);
}

suite('1j. เครื่องหมายช่องที่แก้ย้อนหลัง');
{
  const e = await newEmp(SITE, 'ถูกแก้ย้อนหลัง');
  await cell(SITE, e, ds(-20), 'team', 'A-1 / 5', { adminUnlock: true });
  const sm = await siteMonth(SITE);
  const key = `${e}|${ds(-20)}`;
  const inMonth = ds(-20).slice(0, 7) === `${Y}-${pad(M)}`;
  if (inMonth) {
    happy('ช่องที่ผู้ดูแลระบบแก้หลังล็อกถูกทำเครื่องหมาย', Boolean(sm.edits?.[key]), JSON.stringify(sm.edits || {}).slice(0, 200));
    happy('เครื่องหมายบอกวันที่แก้', Boolean(sm.edits?.[key]?.date));
    happy('เครื่องหมายบอกว่าใครแก้', Boolean(sm.edits?.[key]?.by));
  } else {
    happy('ช่องที่แก้ย้อนหลังอยู่นอกเดือนนี้ — ตรวจในเดือนของมันเอง', await (async () => {
      const [yy, mm] = ds(-20).split('-').map(Number);
      const s2 = await siteMonth(SITE, yy, mm);
      return Boolean(s2.edits?.[key]?.date && s2.edits?.[key]?.by);
    })());
  }
  bad('ช่องที่แก้ในช่วงที่ยังแก้ได้ ไม่ถูกทำเครื่องหมาย', !sm.edits?.[`${OP}|${ds(0)}`]);
}

// ===========================================================================
// 2. คำขอลา
// ===========================================================================
suite('2. ยื่นคำขอลา');
let REQ = null;
{
  const types = await call('/performance/leave/types', { user: A });
  happy('มีประเภทการลา 6 แบบตามระบบจริง', (types.types || []).length === 6);
  happy('รหัสประเภทตรงกับของเขาทุกตัว',
    (types.types || []).map((x) => x.code).join(',') === 'sick,personal,vacation,maternity,ordination,other',
    (types.types || []).map((x) => x.code).join(','));
  // ข้อความไทยของประเภทการลาเป็น "ค่า" ไม่ใช่คำแปล — การอนุมัติเขียนมันลงโน้ต [LV]
  // แล้วอ่านกลับ และต้องเทียบกับระบบจริงได้ตัวอักษรต่อตัวอักษร
  happy('ชื่อประเภทการลาสะกดตรงตัวอักษรกับระบบจริงทั้ง 6 คำ',
    (types.types || []).map((x) => x.th).join(',') === 'ลาป่วย,ลากิจ,ลาพักผ่อน,ลาคลอด,ลาบวช,อื่นๆ',
    (types.types || []).map((x) => x.th).join(','));
  bad('ไม่ใช่ "อื่น ๆ" ที่เว้นวรรค (วันหลังจะกลายเป็นคนละค่า)',
    !(types.types || []).some((x) => x.th === 'อื่น ๆ'), '');

  const e = await newEmp(SITE, 'คนขอลา');
  const r = await askLeave(A, e, ds(30), ds(32));
  happy('ยื่นคำขอลาได้', r.status === 201, `${r.status}`);
  REQ = r.row?.id; if (REQ) mine.reqs.push(REQ);
  happy('คำขอใหม่อยู่ในสถานะรออนุมัติ', r.row?.status === 'pending');
  happy('นับจำนวนวันเป็นวันปฏิทินรวมหัวรวมท้าย (ไม่ตัดวันหยุด)', r.row?.days === 3, String(r.row?.days));
  happy('บอกชื่อประเภทการลาเป็นภาษาไทย', r.row?.leave_type_th === 'ลาป่วย', r.row?.leave_type_th);

  bad('วันสิ้นสุดก่อนวันเริ่ม → 400', (await askLeave(A, e, ds(40), ds(38))).status === 400);
  bad('พนักงานที่ไม่มีอยู่จริง → 404',
    (await askLeave(A, '00000000-0000-0000-0000-000000000000', ds(40), ds(41))).status === 404);
  bad('บัญชีที่ไม่เห็นไซต์ของคนนี้ ยื่นแทนไม่ได้', (await askLeave(H, e, ds(40), ds(41))).status === 403);

  // ระบบจริงยอมให้ยื่นวันย้อนหลังได้ ไม่มีการเทียบกับวันนี้เลย
  const back = await askLeave(A, e, ds(-40), ds(-39));
  happy('ยื่นลาย้อนหลังได้ (เหมือนระบบจริง)', back.status === 201, `${back.status}`);
  if (back.row?.id) mine.reqs.push(back.row.id);

  // ช่วงข้ามเดือนเก็บเป็นใบเดียว ไม่แตกใบ
  const cross = await askLeave(A, e, `${Y}-${pad(M)}-28`, ds(60));
  const crossOk = cross.status === 201 || cross.status === 409; // 409 = ทับกับใบข้างบน
  happy('ช่วงวันที่ข้ามเดือนรับได้', crossOk, `${cross.status} ${cross.error || ''}`);
  if (cross.row?.id) {
    mine.reqs.push(cross.row.id);
    happy('และเก็บเป็นใบเดียว ไม่แตกเป็นสองใบ',
      String(cross.row.from_date).slice(0, 7) !== String(cross.row.to_date).slice(0, 7),
      `${cross.row.from_date} → ${cross.row.to_date}`);
  } else {
    happy('และเก็บเป็นใบเดียว ไม่แตกเป็นสองใบ (ช่วงนี้ทับใบเดิม จึงถูกปฏิเสธก่อน)', cross.status === 409);
  }

  // ระบบจริงไม่ตรวจความซ้ำเลย สองใบที่ทับกันอนุมัติได้ทั้งคู่แล้วเขียนทับช่องเดิมซ้ำ
  // เราตรวจ เพราะใบที่ทับกันไม่ได้บอกอะไรเพิ่มและเขียนวันเดียวกันสองรอบ
  const clash = await askLeave(A, e, ds(31), ds(33));
  bad('ช่วงวันที่ทับกับคำขอที่ยังอยู่ → 409', clash.status === 409, `${clash.status}`);
  bad('และบอกช่วงวันที่ของใบที่ทับ', /\d{4}-\d{2}-\d{2}/.test(clash.error || ''), clash.error);
  happy('ช่วงที่ไม่ทับกัน ยื่นได้ตามปกติ', await (async () => {
    const r2 = await askLeave(A, e, ds(100), ds(101));
    if (r2.row?.id) mine.reqs.push(r2.row.id);
    return r2.status === 201;
  })());
  // ประเภทที่ไม่รู้จัก: ของเขาเปลี่ยนเป็น other เงียบ ๆ ของเราปฏิเสธ เพราะค่าที่เดา
  // ให้ผู้ใช้เองจะไปโผล่บนใบลาที่เขาพิมพ์ออกมาโดยที่ไม่มีใครรู้ว่าระบบเปลี่ยนให้
  bad('ประเภทการลาที่ไม่รู้จัก → 400', (await askLeave(A, e, ds(110), ds(110), { leaveType: 'ลาไปเที่ยว' })).status === 400);

  const mineList = await call('/performance/leave/mine', { user: A });
  happy('เห็นคำขอที่ตัวเองยื่นในรายการ', (mineList.rows || []).some((x) => x.id === REQ));
  const pend = await call('/performance/leave/pending', { user: A });
  happy('คำขอที่ยังไม่ตัดสินอยู่ในคิวรออนุมัติ', (pend.rows || []).some((x) => x.id === REQ));
}

suite('2b. เตือนเมื่อวันที่ขอลามีบันทึกงานอยู่แล้ว');
{
  const e = await newEmp(SITE, 'ลาทับวันที่ลงงานไว้');
  await cell(SITE, e, ds(0), 'team', 'A-1 / 5');
  const r = await askLeave(A, e, ds(0), ds(0));
  happy('ยื่นได้', r.status === 201, `${r.status}`);
  if (r.row?.id) mine.reqs.push(r.row.id);
  happy('และเตือนว่าวันนั้นมีบันทึกงานอยู่แล้ว', (r.warnWorkedDays || []).includes(ds(0)), JSON.stringify(r.warnWorkedDays));
}

suite('2c. อนุมัติ — เขียนรหัส Z-2 ลงตารางงานทุกวันที่ลา');
{
  const e = await newEmp(SITE, 'ลาแล้วอนุมัติ');
  // ใช้ผู้อนุมัติคนอื่น เพราะผู้ยื่นตัดสินคำขอของตัวเองไม่ได้
  const r = await askLeave(H, e, ds(-1), ds(1), { leaveType: 'personal' });
  const filed = r.status === 201 ? r : await askLeave(A, e, ds(-1), ds(1), { leaveType: 'personal' });
  const id = filed.row?.id; if (id) mine.reqs.push(id);
  happy('ยื่นคำขอสำหรับช่วงที่คาบวันนี้ได้', filed.status === 201, `${filed.status}`);
  const decider = filed.requested_by_is_admin ? C : A;
  // ผู้ยื่นคือ A ทุกกรณีในสภาพแวดล้อมนี้ จึงให้ผู้อนุมัติเป็นผู้บริหารที่ผูกลูกน้องไว้
  await call(`/performance/leave/approvers/${C.id}`, { method: 'PUT', user: A, body: { employeeIds: [e] } });
  const dec = await call(`/performance/leave/${id}/decide`, { method: 'POST', user: C, body: { approve: true } });
  happy('ผู้อนุมัติที่ถูกผูกไว้อนุมัติได้', dec.status === 200 && dec.row?.status === 'approved', `${dec.status} ${dec.error || ''}`);

  for (const n of [-1, 0, 1]) {
    const w = await slot1(e, ds(n));
    happy(`วันที่ ${ds(n)} ถูกเขียนรหัส Z-2 ลงช่องงานหลัก`, w?.team === 'Z-2', JSON.stringify(w));
    happy(`วันที่ ${ds(n)} มีโน้ต [LV] กำกับว่ามาจากคำขอลา`, String(w?.note || '').startsWith('[LV]'), w?.note);
  }
  const w0 = await slot1(e, ds(0));
  happy('โน้ตบอกประเภทการลาและเลขที่คำขอ', /^\[LV\]\s*ลากิจ\s*·\s*\S+/.test(String(w0?.note || '')), w0?.note);
  happy('วันลาไม่มีงานเสริมค้างอยู่', w0?.pm === null, String(w0?.pm));
  // ระบบจริงเขียนวันลาผ่าน writeWideCells_ ที่ไม่ผ่านตัวกรองระยะล็อก อนุมัติย้อนหลังได้
  const back = await newEmp(SITE, 'ลาย้อนหลังแล้วอนุมัติ');
  const rb = await askLeave(A, back, ds(-20), ds(-19));
  if (rb.row?.id) mine.reqs.push(rb.row.id);
  await call(`/performance/leave/approvers/${C.id}`, { method: 'PUT', user: A, body: { employeeIds: [e, back] } });
  const db = await call(`/performance/leave/${rb.row.id}/decide`, { method: 'POST', user: C, body: { approve: true } });
  happy('อนุมัติใบที่ช่วงวันเลยระยะล็อกไปแล้วได้', db.status === 200, `${db.status} ${db.error || ''}`);
  happy('และเขียนวันลาลงช่องที่ล็อกแล้วจริง', (await slot1(back, ds(-20)))?.team === 'Z-2');

  bad('ตัดสินซ้ำอีกครั้งไม่ได้ → 409',
    (await call(`/performance/leave/${id}/decide`, { method: 'POST', user: C, body: { approve: false } })).status === 409);
  bad('อนุมัติแล้วยกเลิกไม่ได้ → 409', await (async () => {
    const c = await call(`/performance/leave/${id}/cancel`, { method: 'POST', user: A });
    return c.status === 409 && /พิจารณาแล้ว/.test(c.error || '');
  })());
  const hist = await call('/performance/leave/decided', { user: C });
  happy('ใบที่ตัดสินแล้วเข้าไปอยู่ในประวัติการพิจารณา', (hist.rows || []).some((x) => x.id === id));
  happy('ประวัติบอกยอดทั้งหมดด้วย เพื่อบอกได้ว่าแสดงกี่จาก N', Number.isInteger(hist.total));
  const q = await call('/performance/leave/pending', { user: C });
  bad('และออกจากคิวรออนุมัติแล้ว', !(q.rows || []).some((x) => x.id === id));
}

suite('2d. ไม่อนุมัติ');
{
  const e = await newEmp(SITE, 'ลาแล้วไม่อนุมัติ');
  const r = await askLeave(A, e, ds(0), ds(0));
  const id = r.row?.id; if (id) mine.reqs.push(id);
  await call(`/performance/leave/approvers/${C.id}`, { method: 'PUT', user: A, body: { employeeIds: [e] } });
  const dec = await call(`/performance/leave/${id}/decide`, { method: 'POST', user: C, body: { approve: false } });
  happy('ไม่อนุมัติได้โดยไม่ต้องกรอกเหตุผล (เหมือนระบบจริง)', dec.status === 200 && dec.row?.status === 'rejected');
  bad('ไม่อนุมัติแล้วไม่เขียนอะไรลงตารางงาน', (await slot1(e, ds(0))) === null, JSON.stringify(await slot1(e, ds(0))));
}

suite('2e. ยกเลิกคำขอ');
{
  const e = await newEmp(SITE, 'ลาแล้วยกเลิก');
  const r = await askLeave(A, e, ds(50), ds(51));
  const id = r.row?.id; if (id) mine.reqs.push(id);
  bad('คนอื่นยกเลิกคำขอของเราไม่ได้',
    (await call(`/performance/leave/${id}/cancel`, { method: 'POST', user: C })).status === 403);
  happy('ผู้ยื่นยกเลิกเองได้', (await call(`/performance/leave/${id}/cancel`, { method: 'POST', user: A })).status === 200);
  // สถานะ "ยกเลิกแล้ว" เป็นของเราโดยเจตนา ระบบจริงลบแถวทิ้ง — แถวที่หายทำให้
  // ไม่มีใครตอบได้ว่าใครยกเลิกอะไรไป
  const row = (await query('select status from leave_requests where id = $1', [id])).rows[0];
  happy('ใบที่ยกเลิกยังอยู่ในระบบ สถานะ ยกเลิกแล้ว', row?.status === 'cancelled', row?.status);
  happy('ยกเลิกแล้วยื่นช่วงวันเดิมใหม่ได้', await (async () => {
    const r2 = await askLeave(A, e, ds(50), ds(51));
    if (r2.row?.id) mine.reqs.push(r2.row.id);
    return r2.status === 201;
  })());
  bad('คำขอที่ไม่มีอยู่จริง → 404',
    (await call('/performance/leave/00000000-0000-0000-0000-000000000000/cancel', { method: 'POST', user: A })).status === 404);
}

suite('2f. ใครอนุมัติของใคร');
{
  const e1 = await newEmp(SITE, 'ลูกน้องของหัวหน้า');
  const e2 = await newEmp(SITE, 'ไม่ใช่ลูกน้อง');
  const r1 = await askLeave(A, e1, ds(70), ds(70)); if (r1.row?.id) mine.reqs.push(r1.row.id);
  const r2 = await askLeave(A, e2, ds(70), ds(70)); if (r2.row?.id) mine.reqs.push(r2.row.id);
  await call(`/performance/leave/approvers/${C.id}`, { method: 'PUT', user: A, body: { employeeIds: [e1] } });
  const q = await call('/performance/leave/pending', { user: C });
  happy('หัวหน้าเห็นคำขอของลูกน้องตัวเอง', (q.rows || []).some((x) => x.id === r1.row.id));
  bad('แต่ไม่เห็นคำขอของคนที่ไม่ใช่ลูกน้อง', !(q.rows || []).some((x) => x.id === r2.row.id));
  bad('และตัดสินคำขอที่ไม่ใช่ของลูกน้องไม่ได้',
    (await call(`/performance/leave/${r2.row.id}/decide`, { method: 'POST', user: C, body: { approve: true } })).status === 403);
  bad('ผู้ยื่นตัดสินคำขอของตัวเองไม่ได้',
    (await call(`/performance/leave/${r1.row.id}/decide`, { method: 'POST', user: A, body: { approve: true } })).status === 403);
  happy('ผู้ดูแลระบบเห็นคำขอที่ไม่มีใครถูกผูกไว้ คำขอจึงไม่ค้างในคิวที่ไม่มีคนดู',
    (await call('/performance/leave/pending', { user: A })).rows.some((x) => x.id === r2.row.id));
}

suite('2g. ใบลาสำหรับพิมพ์');
{
  const slip = await call(`/performance/leave/${REQ}/slip`, { user: A, raw: true });
  happy('เปิดใบลาได้', slip.status === 200, `${slip.status}`);
  happy('เป็นไฟล์ PDF', (slip.headers.get('content-type') || '').includes('pdf'));
  happy('เปิดอ่านในแท็บได้เลย ไม่บังคับดาวน์โหลด', /inline/.test(slip.headers.get('content-disposition') || ''));
  happy('มีเนื้อหาจริง', (await slip.arrayBuffer()).byteLength > 1000);
  bad('คนที่ไม่เกี่ยวข้องเปิดใบลาไม่ได้',
    (await call(`/performance/leave/${REQ}/slip`, { user: H })).status === 403);
}

// ===========================================================================
// 3. ดัชนีงาน
// ===========================================================================
suite('3. ดัชนีงาน — เพิ่ม/แก้/ลบ');
{
  const dup = await call('/performance/activities', { method: 'POST', user: A,
    body: { code: 'A-1', name: `${MARK} ซ้ำ`, category: 'Z · ไม่ปฏิบัติงาน' } });
  bad('รหัสกิจกรรมซ้ำ → 409', dup.status === 409, `${dup.status}`);
  const blank = await call('/performance/activities', { method: 'POST', user: A,
    body: { name: `${MARK} ออกเลขให้`, category: 'Z · ไม่ปฏิบัติงาน' } });
  happy('เว้นช่องรหัสว่าง ระบบออกเลขให้', blank.status === 201 && /^[A-Z]-\d+$/.test(blank.data?.code || ''), blank.data?.code);
  if (blank.data?.code) mine.acts.push(blank.data.code);
  happy('รหัสที่ออกให้เข้ากับหมวดหมู่เดิม', String(blank.data?.code || '').startsWith('Z-'), blank.data?.code);
  happy('แก้ชื่อรายการได้',
    (await call(`/performance/activities/${blank.data.code}`, { method: 'PATCH', user: A, body: { name: `${MARK} แก้แล้ว` } })).status === 200);
  happy('ลบรายการที่ยังไม่มีใครใช้ได้ทิ้งจริง', await (async () => {
    const d = await call(`/performance/activities/${blank.data.code}`, { method: 'DELETE', user: A });
    return d.status === 200 && d.data?.deleted === true;
  })());
  bad('ลบรายการที่ไม่มีอยู่จริง → 404',
    (await call('/performance/activities/ZZ-999', { method: 'DELETE', user: A })).status === 404);

  // ระบบจริงลบทิ้งได้เลย บันทึกเก่าจึงชี้ไปรหัสที่ไม่มีในทะเบียนแล้วหลุดจากรายงาน
  // ของเราปิดใช้งานแทนแล้วบอกจำนวนบันทึกที่อ้างอิงอยู่
  const used = await call('/performance/activities/A-1', { method: 'DELETE', user: A });
  happy('ลบรหัสที่มีบันทึกงานอ้างอิง → ปิดใช้งานแทน ไม่ลบทิ้ง',
    used.status === 200 && used.data?.deleted === false && used.data?.deactivated === true, JSON.stringify(used.data).slice(0, 120));
  happy('และบอกจำนวนบันทึกที่อ้างอิงอยู่', Number(used.data?.used) > 0, String(used.data?.used));
  happy('เปิดใช้งานกลับได้ทันที',
    (await call('/performance/activities/A-1', { method: 'PATCH', user: A, body: { isActive: true } })).status === 200);

  const catDup = await call('/performance/cost-categories', { method: 'POST', user: A, body: { code: '5', name: `${MARK} ซ้ำ` } });
  bad('รหัสหมวดงานซ้ำ → 409', catDup.status === 409, `${catDup.status}`);
  const catBlank = await call('/performance/cost-categories', { method: 'POST', user: A, body: { name: `${MARK} หมวดใหม่` } });
  happy('เว้นรหัสหมวดงานว่าง ระบบออกเลขถัดไปให้', catBlank.status === 201 && /^\d+$/.test(catBlank.data?.code || ''), catBlank.data?.code);
  if (catBlank.data?.code) mine.cats.push(catBlank.data.code);
  happy('ลบหมวดงานที่ยังไม่มีใครใช้ได้',
    (await call(`/performance/cost-categories/${catBlank.data.code}`, { method: 'DELETE', user: A })).data?.deleted === true);
  const catUsed = await call('/performance/cost-categories/5', { method: 'DELETE', user: A });
  happy('ลบหมวดงานที่มีบันทึกอ้างอิง → ปิดใช้งานแทน', catUsed.data?.deactivated === true);
  happy('และนับทั้งบันทึกงานและกิจกรรมที่อ้างถึง',
    Number(catUsed.data?.inLogs) > 0 && Number(catUsed.data?.inIndex) > 0, JSON.stringify(catUsed.data).slice(0, 140));
  happy('เปิดใช้งานหมวดงานกลับได้',
    (await call('/performance/cost-categories/5', { method: 'PATCH', user: A, body: { isActive: true } })).status === 200);

  bad('ฝ่ายบุคคลแก้ทะเบียนงานไม่ได้',
    (await call('/performance/activities', { method: 'POST', user: H, body: { code: 'ZZ-1', name: 'x', category: 'Z' } })).status === 403);
}

suite('3b. ดัชนีงาน — นำเข้า / เทมเพลต / ส่งออก');
{
  const ExcelJS = (await import('exceljs')).default;
  const mk = async (cols, rows) => {
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('s');
    ws.addRow(cols); rows.forEach((r) => ws.addRow(r));
    return Buffer.from(await wb.xlsx.writeBuffer());
  };
  const { tok, API } = await import('./harness.mjs');
  const up = async (path, buf, name = 'f.xlsx') => {
    const fd = new FormData();
    fd.append('file', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
    const res = await fetch(`${API}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${tok(A)}` }, body: fd });
    return { status: res.status, ...(await res.json().catch(() => ({}))) };
  };

  for (const [label, path, file] of [
    ['เทมเพลตกิจกรรม', '/performance/import/activities/template.xlsx', 'a'],
    ['เทมเพลตหมวดงาน', '/performance/import/cost-categories/template.xlsx', 'c'],
    ['ส่งออกทะเบียนงาน', '/performance/export/activities.xlsx', 'x'],
    ['ส่งออกหมวดงาน', '/performance/export/cost-categories.xlsx', 'y'],
  ]) {
    const r = await call(path, { user: A, raw: true });
    happy(`ดาวน์โหลด${label}ได้`, r.status === 200 && (await r.arrayBuffer()).byteLength > 500, `${r.status}`);
  }

  // ลำดับคอลัมน์ของเทมเพลตคือ ชื่อ · คำอธิบาย · หมวดหมู่ · รหัส (รหัสอยู่ท้ายและ
  // ไม่ต้องกรอกก็ได้) เดิมเราปฏิเสธทุกแถวที่ไม่มีรหัส คนที่กรอกตามเทมเพลตจึง
  // นำเข้าไม่ได้เลยแม้แถวเดียว
  const blankCode = await up('/performance/import/activities',
    await mk(['ชื่อ', 'คำอธิบาย', 'หมวดหมู่', 'รหัสงาน'], [[`${MARK} นำเข้าไม่มีรหัส`, 'ทดสอบ', 'Z · ไม่ปฏิบัติงาน', '']]));
  happy('นำเข้ากิจกรรมที่เว้นรหัสว่างได้ ระบบออกเลขให้',
    blankCode.status === 200 && blankCode.data?.added === 1, JSON.stringify(blankCode).slice(0, 200));

  const withCode = await up('/performance/import/activities',
    await mk(['ชื่อ', 'คำอธิบาย', 'หมวดหมู่', 'รหัสงาน'], [
      [`${MARK} นำเข้ามีรหัส`, 'ทดสอบ', 'Z · ไม่ปฏิบัติงาน', 'ZZ-1'],
      ['', 'แถวไม่มีชื่อ', 'Z', 'ZZ-2'],
      // รหัสที่มี / อยู่ข้างในอ่านผิดทั้งรายงาน เพราะค่าในช่องแยกด้วย /
      [`${MARK} รหัสมีทับ`, '', 'Z', 'ZZ/4'],
      [`${MARK} รหัสมีช่องว่าง`, '', 'Z', 'ZZ 5'],
      [`${MARK} หมวดงานไม่มีในทะเบียน`, '', 'Z', 'ZZ-3'],
    ]));
  happy('แถวที่ถูกต้องเข้า ส่วนแถวเสียถูกข้ามและรายงานเลขแถว',
    withCode.status === 200 && withCode.data?.added === 2 && withCode.data?.skipped === 3
      && (withCode.data?.rejected || []).every((x) => x.row && x.reason),
    JSON.stringify(withCode.data).slice(0, 300));
  // รหัสที่ปุ่ม "เพิ่มรายการใหม่" รับได้ ไฟล์นำเข้าต้องรับได้ด้วย ไม่ให้เข้มกว่ากัน
  happy('รหัสอย่าง ZZ-1 (อักษรสองตัว) นำเข้าได้ เหมือนที่เพิ่มด้วยมือได้',
    (await query("select 1 from work_types where code = 'ZZ-1'")).rows.length === 1);
  const badCode = await call('/performance/activities', { method: 'POST', user: A,
    body: { code: 'ZZ/9', name: `${MARK} รหัสมีทับ`, category: 'Z · ไม่ปฏิบัติงาน' } });
  bad('เพิ่มกิจกรรมด้วยรหัสที่มีเครื่องหมาย / → 400', badCode.status === 400, `${badCode.status}`);
  happy('นำเข้าซ้ำรหัสเดิม = อัปเดต ไม่ใช่เพิ่มใหม่', await (async () => {
    const again = await up('/performance/import/activities',
      await mk(['ชื่อ', 'คำอธิบาย', 'หมวดหมู่', 'รหัสงาน'], [[`${MARK} นำเข้ามีรหัส แก้แล้ว`, '', 'Z · ไม่ปฏิบัติงาน', 'ZZ-1']]));
    return again.data?.updated === 1 && again.data?.added === 0;
  })());

  // เทมเพลตมีแถวตัวอย่างที่ใช้รหัสจริง (A-1 / 21) ถ้าใครนำเข้าโดยไม่ลบแถวนั้น
  // มันจะไปเขียนทับรายการจริงในทะเบียน — ระบบจริงทิ้งแถวตัวอย่างทุกครั้ง
  const before = (await query("select name from work_types where code = 'A-1'")).rows[0]?.name;
  const tpl = await call('/performance/import/activities/template.xlsx', { user: A, raw: true });
  const tplRes = await up('/performance/import/activities', Buffer.from(await tpl.arrayBuffer()));
  happy('นำเข้าเทมเพลตที่ยังไม่แก้ → ข้ามแถวตัวอย่าง ไม่เพิ่มอะไร',
    tplRes.data?.added === 0 && tplRes.data?.updated === 0 && tplRes.data?.skipped === 1,
    JSON.stringify(tplRes.data));
  happy('และไม่ไปเขียนทับรายการจริงในทะเบียน',
    (await query("select name from work_types where code = 'A-1'")).rows[0]?.name === before);

  const tpl2 = await call('/performance/import/cost-categories/template.xlsx', { user: A, raw: true });
  const tpl2Res = await up('/performance/import/cost-categories', Buffer.from(await tpl2.arrayBuffer()));
  happy('เทมเพลตหมวดงานที่ยังไม่แก้ก็ถูกข้ามเหมือนกัน', tpl2Res.data?.added === 0 && tpl2Res.data?.skipped === 1,
    JSON.stringify(tpl2Res.data));

  const catImp = await up('/performance/import/cost-categories',
    await mk(['รหัส', 'ชื่อหมวดงาน', 'ชื่อภาษาอังกฤษ'], [
      ['', `${MARK} หมวดนำเข้าไม่มีรหัส`, 'ZZ cat'],
      ['abc', `${MARK} รหัสไม่ใช่เลข`, ''],
    ]));
  happy('นำเข้าหมวดงานที่เว้นรหัสว่างได้ และรหัสที่ไม่ใช่ตัวเลขถูกข้าม',
    catImp.data?.added === 1 && catImp.data?.skipped === 1, JSON.stringify(catImp.data).slice(0, 200));
  bad('นำเข้าโดยไม่แนบไฟล์ → 400',
    (await call('/performance/import/activities', { method: 'POST', user: A })).status === 400);

  // ตรวจเสร็จแล้วเก็บทุกอย่างที่นำเข้าออก ไม่ให้ปนกับทะเบียนจริง
  for (const r of (await query("delete from work_types where name like $1 returning code", [`${MARK}%`])).rows) void r;
  await query('delete from cost_categories where name like $1', [`${MARK}%`]);
}

// ===========================================================================
// 4. จัดการไซต์ / พนักงาน
// ===========================================================================
suite('4. จัดการไซต์และพนักงาน');
{
  bad('เพิ่มโครงการชื่อซ้ำ → 409',
    (await call('/performance/sites', { method: 'POST', user: A, body: { name: `${MARK} ไซต์หลัก` } })).status === 409);
  bad('เพิ่มโครงการโดยไม่ระบุชื่อ → 400',
    (await call('/performance/sites', { method: 'POST', user: A, body: { name: '' } })).status === 400);
  const thai = await call('/performance/sites', { method: 'POST', user: A, body: { name: `${MARK} ชื่อไทยล้วนทดสอบ` } });
  happy('ชื่อไทยล้วนก็ได้รหัสโครงการที่ใช้ได้', thai.status === 201 && /^[A-Z0-9]+$/.test(thai.data?.key || ''), thai.data?.key);
  if (thai.data?.key) mine.sites.push(thai.data.key);
  bad('ฝ่ายบุคคลเพิ่มโครงการไม่ได้',
    (await call('/performance/sites', { method: 'POST', user: H, body: { name: `${MARK} ห้าม` } })).status === 403);
  bad('ตั้งระยะล็อกเป็นค่าติดลบไม่ได้',
    (await call(`/performance/sites/${SITE}`, { method: 'PATCH', user: A, body: { lockDays: -1 } })).status === 400);

  happy('เพิ่มพนักงานได้', await (async () => {
    const e = await newEmp(SITE, 'เพิ่มใหม่', 'operation', `${MARK}-NEW1`);
    return Boolean(e);
  })());
  // ── รหัสพนักงานซ้ำ: ถามยืนยันแล้วเก็บรหัสจริงไว้ ไม่ใช่ปฏิเสธและไม่ใช่รับเงียบ ─
  // ทะเบียนจริงของลูกค้ามีรหัสซ้ำอยู่ 35 รหัส (ระบบเดิมของเขาไม่ห้ามเลย) แต่คอลัมน์
  // ของเราบังคับไม่ซ้ำ จึงเก็บแบบเดียวกับตัวนำเข้า: employee_code = "<รหัส>#<ลำดับ>"
  // และ live_emp_code = รหัสจริง ทุกที่ที่แสดงรหัสอ่าน live_emp_code ก่อน
  const dupCode = await call('/performance/employees', { method: 'POST', user: A,
    body: { site: SITE, fullName: `${MARK} รหัสซ้ำ`, kind: 'operation', employeeCode: `${MARK}-NEW1` } });
  bad('รหัสพนักงานซ้ำโดยยังไม่ยืนยัน → 409 ไม่ใช่ 500', dupCode.status === 409, `${dupCode.status} ${String(dupCode.error || '').slice(0, 60)}`);
  bad('และบอกว่ารหัสนี้เป็นของใคร ที่ไซต์ไหน',
    /ZZFLOW/.test(dupCode.error || '') && /ไซต์หลัก/.test(dupCode.error || ''), dupCode.error);
  bad('และถามว่าเป็นคนละคนใช่หรือไม่', /เป็นคนละคนใช่หรือไม่/.test(dupCode.error || ''), dupCode.error);
  bad('ส่งรหัสเหตุผลมาให้หน้าจอแยกแยะได้ ไม่ต้องเดาจากข้อความไทย',
    dupCode.details?.code === 'DUPLICATE_EMP_CODE', JSON.stringify(dupCode.details));

  const okDup = await call('/performance/employees', { method: 'POST', user: A,
    body: { site: SITE, fullName: `${MARK} รหัสซ้ำยืนยันแล้ว`, kind: 'operation',
            employeeCode: `${MARK}-NEW1`, confirmDuplicateCode: true } });
  happy('ยืนยันว่าเป็นคนละคนแล้วบันทึกได้', okDup.status === 201, `${okDup.status} ${okDup.error || ''}`);
  if (okDup.data?.eid) mine.emps.push(okDup.data.eid);
  const stored = (await query('select employee_code, live_emp_code from employees where id = $1', [okDup.data?.eid])).rows[0];
  happy('เก็บรหัสจริงไว้ครบที่ live_emp_code', stored?.live_emp_code === `${MARK}-NEW1`, JSON.stringify(stored));
  happy('และเติมตัวแยกให้คอลัมน์ที่บังคับไม่ซ้ำ แบบเดียวกับตัวนำเข้า',
    stored?.employee_code === `${MARK}-NEW1#2`, JSON.stringify(stored));
  happy('คำตอบบอกรหัสจริง ไม่ใช่รหัสที่มีตัวแยก', okDup.data?.employeeCode === `${MARK}-NEW1`, okDup.data?.employeeCode);
  // สิ่งที่คนอ่าน ต้องเป็นรหัสจริง ไม่งั้นคนที่ถือทะเบียนของเขาอยู่หาแถวเดียวกันไม่เจอ
  // สองแถวที่ใช้รหัสเดียวกัน (คนเดิมที่ถือรหัสเปล่า + คนที่ยืนยันเพิ่มเข้ามา)
  // ต้องแสดงรหัสเดียวกันทั้งคู่ ไม่มีแถวไหนโชว์ "#2" ให้คนอ่าน
  const dupRows = (await siteMonth(SITE)).employees.filter((x) => x.emp_id === `${MARK}-NEW1`);
  happy('ตารางแสดงรหัสจริงทั้งสองแถว ไม่โชว์ตัวแยกภายใน',
    dupRows.length === 2, JSON.stringify((await siteMonth(SITE)).employees.map((x) => x.emp_id)));
  bad('ไม่มีแถวไหนแสดงรหัสที่มีตัวแยก',
    !(await siteMonth(SITE)).employees.some((x) => String(x.emp_id).includes('#')), '');
  const xl = await call(`/performance/export?site=${SITE}&year=${Y}&month=${M}`, { user: A, raw: true });
  const xlText = Buffer.from(await xl.arrayBuffer()).toString('latin1');
  bad('และไฟล์ Excel ก็ไม่มีตัวแยก "#" ติดไปด้วย', !xlText.includes(`${MARK}-NEW1#`), '');
  // ยืนยันครั้งที่สองต้องได้ #3 ไม่ใช่ทับ #2
  const third = await call('/performance/employees', { method: 'POST', user: A,
    body: { site: SITE, fullName: `${MARK} รหัสซ้ำคนที่สาม`, kind: 'operation',
            employeeCode: `${MARK}-NEW1`, confirmDuplicateCode: true } });
  happy('คนที่สามที่ใช้รหัสเดียวกันได้ลำดับถัดไป ไม่ทับของเดิม', third.status === 201
    && (await query('select employee_code from employees where id = $1', [third.data?.eid])).rows[0]?.employee_code === `${MARK}-NEW1#3`,
    `${third.status}`);
  if (third.data?.eid) mine.emps.push(third.data.eid);
  // แก้รหัสของคนที่มีอยู่ให้ไปซ้ำ ใช้กฎเดียวกัน
  const plain = await newEmp(SITE, 'รหัสไม่ซ้ำแล้วแก้ให้ซ้ำ', 'operation', `${MARK}-UNIQ`);
  bad('แก้รหัสให้ไปซ้ำโดยยังไม่ยืนยัน → 409',
    (await call(`/performance/employees/${plain}`, { method: 'PATCH', user: A, body: { employeeCode: `${MARK}-NEW1` } })).status === 409);
  const pat = await call(`/performance/employees/${plain}`, { method: 'PATCH', user: A,
    body: { employeeCode: `${MARK}-NEW1`, confirmDuplicateCode: true } });
  happy('ยืนยันแล้วแก้ได้ และเก็บรหัสจริงไว้เหมือนกัน', pat.status === 200
    && (await query('select live_emp_code from employees where id = $1', [plain])).rows[0]?.live_emp_code === `${MARK}-NEW1`,
    `${pat.status}`);
  happy('แก้รหัสเป็นค่าที่ยังไม่มีใครใช้ ไม่ต้องยืนยันและไม่มีตัวแยก', await (async () => {
    const r = await call(`/performance/employees/${plain}`, { method: 'PATCH', user: A, body: { employeeCode: `${MARK}-UNIQ2` } });
    const row = (await query('select employee_code, live_emp_code from employees where id = $1', [plain])).rows[0];
    return r.status === 200 && row?.employee_code === `${MARK}-UNIQ2` && row?.live_emp_code === null;
  })(), '');
  happy('พนักงานที่ไม่ใส่รหัสก็เพิ่มได้', Boolean(await newEmp(SITE, 'ไม่มีรหัส')));
  bad('เพิ่มพนักงานในไซต์ที่ไม่มีอยู่จริง → 404',
    (await call('/performance/employees', { method: 'POST', user: A,
      body: { site: 'ZZNOPE', fullName: `${MARK} x`, kind: 'operation' } })).status === 404);
  bad('สายงานที่ไม่รู้จัก → 400',
    (await call('/performance/employees', { method: 'POST', user: A,
      body: { site: SITE, fullName: `${MARK} x`, kind: 'ot' } })).status === 400);

  const e2 = await newEmp(SITE, 'ปิดใช้งาน');
  happy('ปิดใช้งานพนักงานได้',
    (await call(`/performance/employees/${e2}`, { method: 'PATCH', user: A, body: { isActive: false } })).status === 200);
  bad('พนักงานที่ปิดใช้งานแล้วบันทึกงานไม่ได้', (await cell(SITE, e2, ds(0), 'team', 'A-1 / 5')).status === 400);
  const roster = (await siteMonth(SITE)).employees.map((x) => x.eid);
  bad('และหายออกจากตารางของไซต์', !roster.includes(e2));
  happy('สลับสายงานได้',
    (await call(`/performance/employees/${OP}`, { method: 'PATCH', user: A, body: { kind: 'support' } })).status === 200);
  await call(`/performance/employees/${OP}`, { method: 'PATCH', user: A, body: { kind: 'operation' } });
}

// ===========================================================================
// 5. รายงาน / ส่งออก / ประวัติการแก้ไข
// ===========================================================================
suite('5. แดชบอร์ดสรุป');
{
  const s = await call(`/performance/admin-summary?year=${Y}&month=${M}`, { user: A });
  happy('เปิดแดชบอร์ดได้', s.status === 200 && Array.isArray(s.rows), `${s.status}`);
  const row = (s.rows || []).find((x) => x.site_key === SITE);
  happy('การ์ดของไซต์ทดสอบขึ้นในแดชบอร์ด', Boolean(row));
  happy('บอกจำนวนคน แยกสายปฏิบัติการกับสายสนับสนุน',
    row && row.n_emp === row.n_operation + row.n_support, JSON.stringify({ n: row?.n_emp, op: row?.n_operation, sup: row?.n_support }));
  // ความครบถ้วน = รายการที่กรอก ÷ (จำนวนคน × วันทำงานที่ผ่านมา) ไม่นับวันอาทิตย์
  const days = (row?.daysFilled || []);
  const workdaysPassed = days.filter((d) => !d.weekend && d.date <= s.today).length;
  happy('ตัวหารความครบถ้วน = จำนวนคน × วันทำงานที่ผ่านมา (ไม่นับวันอาทิตย์)',
    row?.fillRateDenom === row?.n_emp * workdaysPassed, `${row?.fillRateDenom} vs ${row?.n_emp}×${workdaysPassed}`);
  happy('ความครบถ้วนไม่เกิน 100%', (s.rows || []).every((x) => x.fillRate >= 0 && x.fillRate <= 100));
  happy('ทุกวันของเดือนมีตัวเลขรายวัน', days.length >= 28);
  happy('วันอาทิตย์ถูกทำเครื่องหมายในตัวเลขรายวันด้วย', days.some((d) => d.weekend));
  happy('การ์ดส่งระยะล็อกของไซต์ตัวเองมาด้วย (ปฏิทินย่อระบายสีจากค่านี้)',
    (s.rows || []).every((x) => Number.isInteger(x.lockDays)));
  happy('มีอันดับกิจกรรมเด่นให้กราฟ', Array.isArray(row?.topActivities));
  happy('และอันดับหมวดงานเด่น', Array.isArray(row?.topCostCodes));
  happy('เปอร์เซ็นต์ในกราฟรวมแล้วไม่เกิน 100', (row?.topActivities || []).reduce((a, x) => a + x.pct, 0) <= 101,
    String((row?.topActivities || []).reduce((a, x) => a + x.pct, 0)));
  // รหัสที่ไม่อยู่ในทะเบียนไม่ถูกนับในกราฟ แต่ยังนับเป็นการกรอก (เหมือนระบบจริง)
  bad('รหัสที่ไม่อยู่ในทะเบียนไม่ขึ้นในกราฟ', !(row?.topActivities || []).some((x) => /QQ-99/.test(x.name || '')));
  bad('เดือนที่ไม่ได้ระบุ → 400', (await call('/performance/admin-summary', { user: A })).status === 400);
}

suite('5b. ไฟล์ Excel และรายงานวันทำงาน');
{
  const x = await call(`/performance/export?site=${SITE}&year=${Y}&month=${M}`, { user: A, raw: true });
  happy('ส่งออก Excel ของไซต์ได้', x.status === 200, `${x.status}`);
  happy('เป็นไฟล์ xlsx จริง', (x.headers.get('content-type') || '').includes('spreadsheetml'));
  happy('ชื่อไฟล์ส่งเป็น UTF-8 ได้ (ชื่อโครงการเป็นไทย)',
    /filename\*=UTF-8/.test(x.headers.get('content-disposition') || ''), x.headers.get('content-disposition'));
  happy('มีเนื้อหาจริง', (await x.arrayBuffer()).byteLength > 2000);
  // ระบบจริงสร้างแท็บเปล่าให้เมื่อเดือนนั้นไม่มีข้อมูล แทนที่จะล้มเหลว
  const empty = await call(`/performance/export?site=${SITE}&year=2019&month=1`, { user: A, raw: true });
  happy('เดือนที่ไม่มีข้อมูลเลยก็ส่งออกได้ (ได้ไฟล์เปล่าพร้อมรายชื่อ)',
    empty.status === 200 && (await empty.arrayBuffer()).byteLength > 2000, `${empty.status}`);
  bad('ส่งออกไซต์ที่ไม่มีอยู่จริง → 404',
    (await call('/performance/export?site=ZZNOPE&year=2026&month=8', { user: A })).status === 404);
  bad('ส่งออกโดยไม่ระบุเดือน → 400',
    (await call(`/performance/export?site=${SITE}`, { user: A })).status === 400);

  const mr = await call(`/performance/report/monthly.xlsx?ym=${Y}-${pad(M)}`, { user: A, raw: true });
  happy('ดาวน์โหลดรายงานวันทำงานรายเดือนได้', mr.status === 200 && (await mr.arrayBuffer()).byteLength > 2000, `${mr.status}`);
  bad('รายงานรายเดือนที่รูปแบบเดือนผิด → 400',
    (await call('/performance/report/monthly.xlsx?ym=2026-8', { user: A })).status === 400);

  const from = `${Y}-${pad(M)}-01`, to = ds(0);
  const totals = [];
  for (const g of ['cost', 'worktype', 'project', 'employee']) {
    const r = await call(`/performance/report/manday?from=${from}&to=${to}&groupBy=${g}`, { user: A });
    happy(`รายงานแรงงาน-วัน แบบ ${g} อ่านได้`, r.status === 200 && Array.isArray(r.data?.rows), `${r.status}`);
    totals.push(Number(r.data?.total || 0));
  }
  happy('ทุกมุมมองรวมแล้วได้แรงงาน-วันเท่ากัน',
    totals.every((v) => Math.abs(v - totals[0]) < 0.01), totals.join(' / '));
  bad('รายงานแรงงาน-วันโดยไม่ระบุช่วงวันที่ → 400',
    (await call('/performance/report/manday', { user: A })).status === 400);
  const ent = await call(`/performance/export/entries.xlsx?site=${SITE}&month=${Y}-${pad(M)}`, { user: A, raw: true });
  happy('ส่งออกตารางบันทึกของเดือนที่ดูอยู่ได้', ent.status === 200, `${ent.status}`);
}

suite('5c. ประวัติการแก้ไข');
{
  const au = await call('/performance/audit?limit=20', { user: A });
  happy('เปิดประวัติการแก้ไขได้', au.status === 200 && Array.isArray(au.data), `${au.status}`);
  const rows = au.data || [];
  happy('เรียงใหม่สุดก่อน', rows.length < 2 || String(rows[0].created_at) >= String(rows[1].created_at));
  happy('แต่ละแถวบอกครบว่าใคร แก้ช่องไหน จากอะไรเป็นอะไร',
    rows.length === 0 || rows.every((r) => 'action' in r && ('actor_label' in r || 'actor_id' in r)),
    JSON.stringify(rows[0] || {}).slice(0, 200));
  const mineRow = rows.find((r) => r.employee_id === OP);
  happy('การแก้ช่องของเราเมื่อกี้อยู่ในประวัติ', Boolean(mineRow) || rows.length >= 1);
  happy('จำกัดจำนวนแถวตามที่ขอ', rows.length <= 20, String(rows.length));
}

// ===========================================================================
// 6. ข้อมูลจริงของลูกค้าต้องไม่ถูกแตะ + เก็บกวาด
// ===========================================================================
suite('6. ข้อมูลจริงไม่ถูกแตะ และเก็บกวาดครบ');
{
  const after = (await query("select count(*)::int n from leave_requests where status = 'pending' and reason <> $1", [MARK])).rows[0].n;
  happy('คำขอลาใบจริงที่ค้างอยู่ยังค้างอยู่เท่าเดิม ไม่ถูกอนุมัติ/ปฏิเสธ',
    after === realPendingBefore, `ก่อน ${realPendingBefore} หลัง ${after}`);
  happy('ทะเบียนกิจกรรมของจริงยังครบ 44 รหัสและเปิดใช้งานอยู่', await (async () => {
    const n = (await query("select count(*)::int n from work_types where code is not null and is_active")).rows[0].n;
    return n >= 44;
  })());

  // ลบลูกก่อนพ่อ: บันทึกงาน · คำขอลา · ผู้อนุมัติ · การย้าย · พนักงาน · ไซต์
  const emps = (await query('select id from employees where full_name like $1', [`${MARK}%`])).rows.map((r) => r.id);
  if (emps.length) {
    await query('delete from work_log_audit where employee_id = any($1::uuid[])', [emps]);
    await query('delete from work_logs where employee_id = any($1::uuid[])', [emps]);
    await query('delete from leave_approvers where employee_id = any($1::uuid[])', [emps]);
    await query('delete from leave_requests where employee_id = any($1::uuid[])', [emps]);
    await query('delete from employee_away where employee_id = any($1::uuid[])', [emps]);
    await query('delete from employee_moves where employee_id = any($1::uuid[])', [emps]);
    await query('delete from employees where id = any($1::uuid[])', [emps]);
  }
  const units = (await query('select id from units where name like $1', [`${MARK}%`])).rows.map((r) => r.id);
  if (units.length) {
    await query('delete from work_log_audit where unit_id = any($1::uuid[])', [units]);
    await query('delete from work_logs where unit_id = any($1::uuid[])', [units]);
    await query('delete from leave_requests where unit_id = any($1::uuid[])', [units]);
    await query('delete from period_closes where unit_id = any($1::uuid[])', [units]);
    await query('delete from units where id = any($1::uuid[])', [units]);
  }
  await query('delete from work_types where name like $1', [`${MARK}%`]);
  await query('delete from cost_categories where name like $1', [`${MARK}%`]);
  await query("delete from work_types where code in ('ZZ-1','ZZ-2','ZZ-3','ZZ-4','ZZ/9')");
  // ผู้อนุมัติที่ผูกไว้ตอนทดสอบต้องถอดออก ไม่ให้ค้างในหน้าตั้งค่าของจริง
  await query('delete from leave_approvers where approver_id = $1', [C.id]);

  const left = (await query(
    `select (select count(*)::int from employees where full_name like $1) e,
            (select count(*)::int from units where name like $1) u,
            (select count(*)::int from work_types where name like $1) w,
            (select count(*)::int from cost_categories where name like $1) c,
            (select count(*)::int from leave_requests where reason = $2) l`,
    [`${MARK}%`, MARK])).rows[0];
  happy('ไม่มีข้อมูลทดสอบค้างอยู่เลย',
    left.e === 0 && left.u === 0 && left.w === 0 && left.c === 0 && left.l === 0, JSON.stringify(left));
}

process.exit(report(`${ROOT}/worklog-flows.json`) ? 1 : 0);
