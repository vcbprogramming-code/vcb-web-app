/**
 * วงเงินสินเชื่อ — ไล่ทีละสถานการณ์การใช้งาน เทียบกับระบบที่ลูกค้าใช้อยู่
 *
 * ชุดเดิม (credit.mjs) ตรวจว่าเลขคำนวณถูกและสิทธิ์กั้นได้ ชุดนี้ตรวจอีกเรื่อง:
 * "กดอะไรแล้วระบบตอบอะไร" ทีละสถานการณ์ ทั้งทางปกติและทางที่ผิด เทียบกับ
 * Code.js + index.html ของเขา — เงื่อนไขไหนบล็อก ข้อความว่าอะไร และเกิดผลอะไร
 * กับตัวเลขวงเงินหลังจากนั้น เพราะสิ่งที่พังเงียบที่สุดในโมดูลนี้ไม่ใช่สูตรผิด
 * แต่เป็นคนละกฎกันระหว่างการ์ดที่กดกับตารางที่กดไปถึง
 *
 * ทุกอย่างสร้างในโครงการทิ้งขว้าง kda เท่านั้น และลบทิ้งท้ายชุด — ข้อมูลจริงของ
 * ลูกค้า (วงเงิน 48 ก้อน · รายการ 66) ต้องไม่ขยับแม้แถวเดียว
 */
import ExcelJS from 'exceljs';
import { call, suite, happy, bad, report, U, warm, query, tok, API, TEST_PROJECT } from './harness.mjs';

await warm();
const { admin: A, exec: C, hr: H } = U;
const MARK = 'ZZFLOW';
const made = { fac: [], led: [], req: [] };

// ห้ามเลือกโครงการด้วย "แถวแรกในตาราง" — ครั้งก่อนวิธีนั้นลบงบประมาณจริงไปหนึ่งแถว
const project = (await query('select id, code, name from projects where code = $1', [TEST_PROJECT])).rows[0];
if (!project) throw new Error(`ไม่พบโครงการทดสอบ ${TEST_PROJECT}`);

// บัญชีที่ไม่มีสิทธิ์วงเงินสินเชื่อเลย — ใช้ทดสอบว่าด่านสิทธิ์ยันจริง ไม่ใช่แค่
// ซ่อนปุ่ม (U.exec มีสิทธิ์ตามตำแหน่งอยู่แล้ว จึงใช้แทนกันไม่ได้)
const outsider = (await query(
  `select id from profiles where role not in ('admin','executive')
     and coalesce((permissions->'credit'->>'edit')::boolean, false) = false
     and coalesce((permissions->'credit'->>'view')::boolean, false) = false
   limit 1`)).rows[0] || null;

const p2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const now = new Date();
const D = {
  today: ymd(now),
  earlierThisMonth: ymd(new Date(now.getFullYear(), now.getMonth(), 1)),
  lastMonth: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 15)),
  nextMonth: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 10)),
  in3Days: ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3)),
  farFuture: ymd(new Date(now.getFullYear() + 1, now.getMonth(), 15)),
};

/** สร้างวงเงินสำหรับทดสอบ พร้อมจดไว้ให้ลบทิ้งตอนจบ */
const newFacility = async (body) => {
  const r = await call('/credit/facilities', { method: 'POST', user: A,
    body: { projectId: project.id, notes: MARK, ...body } });
  if (r.status !== 201) throw new Error(`สร้างวงเงินไม่สำเร็จ ${r.status}: ${JSON.stringify(r).slice(0, 200)}`);
  made.fac.push(r.data.id);
  return r.data;
};
const newLedger = async (body) => {
  const r = await call('/credit/ledger', { method: 'POST', user: A, body });
  if (r.status === 201) made.led.push(r.data.id);
  return r;
};
const newRequest = async (body) => {
  const r = await call('/credit/requests', { method: 'POST', user: A, body });
  if (r.status === 201) made.req.push(r.data.id);
  return r;
};
/** วงเงินก้อนเดียวอ่านสด ๆ จาก API (ไม่ใช่จากตัวแปรที่ค้างอยู่) */
const readFacility = async (id) =>
  ((await call(`/credit/facilities?projectId=${project.id}`, { user: A })).data || []).find((f) => f.id === id);
const ledgerRow = async (id) => (await query('select * from credit_ledger where id = $1', [id])).rows[0];

// ───────────────────────────────────────────────────────────────────────────
// 1. ยื่นคำขอสินเชื่อ
//
// ระบบจริง (saveReq → addRequest) บังคับสี่ช่อง: โครงการ ประเภท จำนวนเงิน และ
// ผู้รับผลประโยชน์ ส่วน "เกินวงเงินคงเหลือ" เตือนแต่ไม่ห้าม เพราะธนาคารขยาย
// วงเงินให้ได้จริง การบล็อกจึงผิดกว่าการเตือน
// ───────────────────────────────────────────────────────────────────────────
suite('1. ยื่นคำขอสินเชื่อ');
const facBE = await newFacility({ company: `${MARK} บริษัทเทสต์`, bank: 'ธนาคารกรุงเทพ',
  facilityNo: 6, limit: 10000000, interestNote: '1.25 % ต่อปี' });
{
  const ok = await newRequest({ facilityId: facBE.id, amount: 1000000,
    beneficiary: `${MARK} ผู้รับผลประโยชน์`, purpose: 'ซื้อเหล็ก', dueDate: D.nextMonth });
  happy('กรอกครบ → ยื่นคำขอได้', ok.status === 201, `${ok.status}`);
  happy('คำขอใหม่เริ่มที่สถานะ "อยู่ระหว่างเสนออนุมัติ"', ok.data?.status === 'อยู่ระหว่างเสนออนุมัติ', String(ok.data?.status));

  const noFac = await call('/credit/requests', { method: 'POST', user: A, body: { amount: 500000 } });
  bad('ไม่เลือกวงเงิน → ปฏิเสธ', noFac.status === 400, `${noFac.status}`);
  const noAmt = await call('/credit/requests', { method: 'POST', user: A, body: { facilityId: facBE.id } });
  bad('ไม่กรอกจำนวนเงิน → ปฏิเสธ', noAmt.status === 400, `${noAmt.status}`);
  const zero = await call('/credit/requests', { method: 'POST', user: A, body: { facilityId: facBE.id, amount: 0 } });
  bad('จำนวนเงินศูนย์ → ปฏิเสธ', zero.status === 400, `${zero.status}`);

  // เกินวงเงินคงเหลือ: ต้องยื่นได้ ไม่ใช่ถูกบล็อก (index.html: "ยังยื่นคำขอได้")
  const over = await newRequest({ facilityId: facBE.id, amount: 99000000, beneficiary: `${MARK} เกินวงเงิน` });
  happy('ขอเกินวงเงินคงเหลือ → ยังยื่นได้ (ระบบจริงเตือน ไม่ห้าม)', over.status === 201, `${over.status}`);
  const facNow = await readFacility(facBE.id);
  bad('คำขอที่ยังไม่อนุมัติไม่กินวงเงิน', Number(facNow.used) === 0, `ใช้ไป ${facNow.used}`);

  // โครงการที่ไม่มีวงเงินประเภทนั้น: ฟอร์มของเรามีแต่วงเงินที่มีอยู่จริงให้เลือก
  // ส่วน API ต้องตอบ 404 ไม่ใช่สร้างรายการลอยที่ไม่สังกัดวงเงินใด
  const ghost = await call('/credit/requests', { method: 'POST', user: A,
    body: { facilityId: '00000000-0000-0000-0000-000000000000', amount: 100000 } });
  bad('วงเงินที่ไม่มีอยู่ → 404 ไม่ใช่รายการลอย', ghost.status === 404, `${ghost.status} ${ghost.error || ''}`);
}

// ───────────────────────────────────────────────────────────────────────────
// 2. อนุมัติ / ไม่อนุมัติ
// ───────────────────────────────────────────────────────────────────────────
suite('2. อนุมัติและไม่อนุมัติคำขอ');
{
  const r = (await newRequest({ facilityId: facBE.id, amount: 2000000,
    beneficiary: `${MARK} อนุมัติ`, dueDate: D.nextMonth })).data;

  // คนไม่มีสิทธิ์ต้องถูกปฏิเสธก่อนที่อะไรจะเปลี่ยน
  if (outsider) {
    const noPerm = await call(`/credit/requests/${r.id}/decide`, { method: 'POST', user: outsider,
      body: { decision: 'อนุมัติ' } });
    happy('คนที่ไม่มีสิทธิ์เลย → ไม่ผ่าน', noPerm.status === 403, `${noPerm.status}`);
    const still = (await call('/credit/requests', { user: A })).data.find((x) => x.id === r.id);
    bad('คำขอยังไม่ถูกตัดสินหลังถูกปฏิเสธสิทธิ์', still.status === 'อยู่ระหว่างเสนออนุมัติ', still.status);
  }

  const bogus = await call(`/credit/requests/${r.id}/decide`, { method: 'POST', user: A, body: { decision: 'เกือบอนุมัติ' } });
  bad('คำตัดสินที่ไม่มีในระบบ → ปฏิเสธ', bogus.status === 400, `${bogus.status}`);

  const usedBefore = Number((await readFacility(facBE.id)).used);
  const yes = await call(`/credit/requests/${r.id}/decide`, { method: 'POST', user: A, body: { decision: 'อนุมัติ' } });
  happy('อนุมัติสำเร็จ', yes.status === 200, `${yes.status}`);
  if (yes.data?.ledger?.id) made.led.push(yes.data.ledger.id);
  happy('อนุมัติแล้วเกิดรายการในบัญชีวงเงินให้เลย', yes.data?.ledger?.status === 'อนุมัติแล้ว', String(yes.data?.ledger?.status));
  happy('รายการที่เกิดผูกกลับไปที่คำขอ (ไม่นับซ้ำ)', yes.data?.ledger?.request_id === r.id, String(yes.data?.ledger?.request_id));
  const usedAfter = Number((await readFacility(facBE.id)).used);
  happy('ยอดใช้ไปเพิ่มขึ้นเท่ายอดที่อนุมัติ', usedAfter - usedBefore === 2000000, `${usedBefore} → ${usedAfter}`);

  const again = await call(`/credit/requests/${r.id}/decide`, { method: 'POST', user: A, body: { decision: 'ไม่อนุมัติ' } });
  bad('ตัดสินซ้ำ → ปฏิเสธ', again.status === 409, `${again.status} ${again.error || ''}`);
  const usedAfter2 = Number((await readFacility(facBE.id)).used);
  bad('ตัดสินซ้ำไม่ทำให้ยอดใช้ไปขยับอีก', usedAfter2 === usedAfter, `${usedAfter2}`);

  // ไม่อนุมัติ: ต้องไม่เกิดรายการ และวงเงินต้องไม่ขยับ
  const r2 = (await newRequest({ facilityId: facBE.id, amount: 3000000, beneficiary: `${MARK} ปฏิเสธ` })).data;
  const no = await call(`/credit/requests/${r2.id}/decide`, { method: 'POST', user: A,
    body: { decision: 'ไม่อนุมัติ', note: 'เอกสารไม่ครบ' } });
  happy('ไม่อนุมัติสำเร็จ', no.status === 200 && no.data?.request?.status === 'ไม่อนุมัติ', String(no.data?.request?.status));
  bad('ไม่อนุมัติแล้วไม่เกิดรายการใช้วงเงิน', no.data?.ledger === null, JSON.stringify(no.data?.ledger));
  happy('เก็บเหตุผลที่ไม่อนุมัติไว้', no.data?.request?.decision_note === 'เอกสารไม่ครบ', String(no.data?.request?.decision_note));
  happy('วงเงินไม่ขยับเพราะการปฏิเสธ', Number((await readFacility(facBE.id)).used) === usedAfter, '');

  const missing = await call('/credit/requests/00000000-0000-0000-0000-000000000000/decide',
    { method: 'POST', user: A, body: { decision: 'อนุมัติ' } });
  bad('ตัดสินคำขอที่ไม่มีอยู่ → 404', missing.status === 404, `${missing.status}`);
}

// ───────────────────────────────────────────────────────────────────────────
// 3. บันทึกการใช้วงเงิน — บวก / ลบ / ศูนย์ / ปลดเกินที่ใช้
//
// ยอดติดลบคือวิธีที่เขา "ปลดวงเงินคืน" (ธนาคารคืนหนังสือค้ำประกัน) ห้ามค่าลบ
// ไปเลยจะทำแบบนั้นไม่ได้ สิ่งที่ต้องกันคือปลดเกินกว่าที่เคยใช้
// ───────────────────────────────────────────────────────────────────────────
suite('3. บันทึกการใช้วงเงิน');
const facPN = await newFacility({ company: `${MARK} บริษัทเทสต์`, facilityNo: 7, limit: 5000000,
  interestNote: '2 % ต่อปี' });
{
  const plus = await newLedger({ facilityId: facPN.id, amount: 1500000, startDate: D.today,
    dueDate: D.nextMonth, ref: `${MARK}-PN1`, beneficiary: `${MARK} คู่ค้า` });
  happy('ยอดบวก → บันทึกได้ และนับเป็นใช้ไปทันที', plus.status === 201 && plus.data.status === 'อนุมัติแล้ว', `${plus.status}`);
  happy('ยอดใช้ไปเท่ายอดที่เบิก', Number((await readFacility(facPN.id)).used) === 1500000, '');

  const minus = await newLedger({ facilityId: facPN.id, amount: -500000, ref: `${MARK}-ปลด` });
  happy('ยอดติดลบ → ปลดวงเงินคืนได้', minus.status === 201, `${minus.status}`);
  happy('ปลดแล้วยอดใช้ไปลดลงเท่าที่ปลด', Number((await readFacility(facPN.id)).used) === 1000000,
    `${(await readFacility(facPN.id)).used}`);

  const zero = await newLedger({ facilityId: facPN.id, amount: 0, ref: `${MARK}-ศูนย์` });
  bad('ยอดศูนย์ → ปฏิเสธ (ไม่ใช่รายการที่มีความหมาย)', zero.status === 400, `${zero.status}`);

  const tooMuch = await newLedger({ facilityId: facPN.id, amount: -9000000, ref: `${MARK}-ปลดเกิน` });
  bad('ปลดเกินกว่าที่ใช้ไปจริง → ปฏิเสธ', tooMuch.status === 400, `${tooMuch.status}`);
  happy('ข้อความบอกยอดที่ใช้อยู่จริง', /ปลดวงเงินเกินกว่าที่ใช้ไปจริง/.test(String(tooMuch.error || '')), String(tooMuch.error || ''));
  happy('การปฏิเสธไม่ทำให้ยอดใช้ไปเพี้ยน', Number((await readFacility(facPN.id)).used) === 1000000, '');

  // ปลดให้เหลือศูนย์พอดีต้องได้ — เส้นแบ่งอยู่ที่ "เกิน" ไม่ใช่ "เท่า"
  const exact = await newLedger({ facilityId: facPN.id, amount: -1000000, ref: `${MARK}-ปลดพอดี` });
  happy('ปลดจนเหลือศูนย์พอดี → ได้', exact.status === 201, `${exact.status}`);
  happy('ยอดใช้ไปเป็นศูนย์ ไม่ติดลบ', Number((await readFacility(facPN.id)).used) === 0, `${(await readFacility(facPN.id)).used}`);
  // คืนสภาพให้ส่วนถัดไปใช้ต่อ
  await call(`/credit/ledger/${exact.data.id}`, { method: 'DELETE', user: A });
  made.led = made.led.filter((x) => x !== exact.data.id);
}

// ───────────────────────────────────────────────────────────────────────────
// 4. แก้ไขรายการ
// ───────────────────────────────────────────────────────────────────────────
suite('4. แก้ไขรายการที่บันทึกไว้');
{
  const l = (await newLedger({ facilityId: facPN.id, amount: 400000, ref: `${MARK}-แก้ไข`,
    beneficiary: 'ก่อนแก้', dueDate: D.nextMonth })).data;
  const before = Number((await readFacility(facPN.id)).used);

  const ed = await call(`/credit/ledger/${l.id}`, { method: 'PATCH', user: A,
    body: { amount: 700000, beneficiary: 'หลังแก้', costCategory: 'ค่าแรง' } });
  happy('แก้ยอดและผู้รับผลประโยชน์ได้', ed.status === 200 && ed.data.beneficiary === 'หลังแก้', `${ed.status}`);
  happy('ยอดใช้ไปคำนวณใหม่ตามยอดที่แก้', Number((await readFacility(facPN.id)).used) === before + 300000,
    `${before} → ${(await readFacility(facPN.id)).used}`);

  const nothing = await call(`/credit/ledger/${l.id}`, { method: 'PATCH', user: A, body: {} });
  bad('ส่งมาแต่ไม่มีช่องให้แก้ → ปฏิเสธ', nothing.status === 400, `${nothing.status}`);
  const notUuid = await call('/credit/ledger/ไม่ใช่รหัส', { method: 'PATCH', user: A, body: { amount: 1 } });
  bad('รหัสรายการที่ไม่ใช่ UUID → 404 ไม่ใช่ 500', notUuid.status === 404, `${notUuid.status}`);
  const gone = await call('/credit/ledger/00000000-0000-0000-0000-000000000000', { method: 'PATCH', user: A, body: { amount: 1 } });
  bad('แก้รายการที่ไม่มีอยู่ → 404', gone.status === 404, `${gone.status}`);

  // แก้เป็นยอดลบที่มากกว่าที่ใช้อยู่ ต้องถูกกันเหมือนตอนบันทึกใหม่
  const overEdit = await call(`/credit/ledger/${l.id}`, { method: 'PATCH', user: A, body: { amount: -9000000 } });
  bad('แก้ให้ปลดเกินที่ใช้ไปจริง → ปฏิเสธ', overEdit.status === 400, `${overEdit.status}`);

  await call(`/credit/ledger/${l.id}`, { method: 'DELETE', user: A });
  made.led = made.led.filter((x) => x !== l.id);
}

// ───────────────────────────────────────────────────────────────────────────
// 5. เปลี่ยนสถานะจากฟอร์มแก้ไข
//
// ระบบจริงเอาปุ่ม "อนุมัติ" ออกจากแถวไปแล้ว การอนุมัติคือการเปลี่ยนสถานะในฟอร์ม
// (comment ใน index.html: "Authorize moved out of row — use Edit → สถานะ")
// ───────────────────────────────────────────────────────────────────────────
suite('5. เปลี่ยนสถานะแล้ววงเงินต้องขยับตาม');
{
  const l = (await newLedger({ facilityId: facPN.id, amount: 800000, status: 'คำขอใหม่',
    ref: `${MARK}-สถานะ`, dueDate: D.nextMonth })).data;
  happy('บันทึกเป็น "คำขอใหม่" ได้', l.status === 'คำขอใหม่', l.status);
  const base = Number((await readFacility(facPN.id)).used);
  bad('สถานะคำขอใหม่ยังไม่กินวงเงิน', base === 1000000, `${base}`);

  await call(`/credit/ledger/${l.id}`, { method: 'PATCH', user: A, body: { status: 'อยู่ระหว่างเสนออนุมัติ' } });
  bad('สถานะเสนออนุมัติก็ยังไม่กินวงเงิน', Number((await readFacility(facPN.id)).used) === base, '');

  await call(`/credit/ledger/${l.id}`, { method: 'PATCH', user: A, body: { status: 'อนุมัติแล้ว' } });
  happy('เปลี่ยนเป็นอนุมัติแล้ว → กินวงเงินทันที', Number((await readFacility(facPN.id)).used) === base + 800000,
    `${(await readFacility(facPN.id)).used}`);

  const paid = await call(`/credit/ledger/${l.id}`, { method: 'PATCH', user: A, body: { status: 'ชำระแล้ว' } });
  happy('เปลี่ยนเป็นชำระแล้ว → ปล่อยวงเงินคืน', Number((await readFacility(facPN.id)).used) === base, '');
  // จอรายละเอียดมีบรรทัด "ชำระเมื่อ" — ปิดรายการจากฟอร์มก็ต้องมีวันชำระ ไม่ใช่ว่าง
  happy('ปิดรายการจากฟอร์มแก้ไขแล้วมีวันชำระด้วย', Boolean(paid.data?.settled_date), String(paid.data?.settled_date));

  const back = await call(`/credit/ledger/${l.id}`, { method: 'PATCH', user: A, body: { status: 'อนุมัติแล้ว' } });
  happy('ถอยกลับออกจากชำระแล้ว วันชำระต้องหายไปด้วย', back.data?.settled_date == null, String(back.data?.settled_date));

  await call(`/credit/ledger/${l.id}`, { method: 'DELETE', user: A });
  made.led = made.led.filter((x) => x !== l.id);
}

// ───────────────────────────────────────────────────────────────────────────
// 6. ชำระ / ปิดรายการ
// ───────────────────────────────────────────────────────────────────────────
suite('6. ชำระและปิดรายการ');
{
  const l = (await newLedger({ facilityId: facPN.id, amount: 600000, ref: `${MARK}-ชำระ`, dueDate: D.lastMonth })).data;
  const base = Number((await readFacility(facPN.id)).used);
  const s = await call(`/credit/ledger/${l.id}/settle`, { method: 'POST', user: A });
  happy('ปิดรายการสำเร็จ', s.status === 200 && s.data.status === 'ชำระแล้ว', `${s.status}`);
  happy('มีวันชำระติดมากับรายการ', Boolean(s.data.settled_date), String(s.data.settled_date));
  happy('วงเงินถูกปล่อยคืน', Number((await readFacility(facPN.id)).used) === base - 600000, '');

  const twice = await call(`/credit/ledger/${l.id}/settle`, { method: 'POST', user: A });
  bad('ปิดซ้ำ → ปฏิเสธ', twice.status === 409, `${twice.status}`);
  happy('ข้อความตรงกับระบบจริง ("รายการนี้ชำระแล้ว")', String(twice.error || '') === 'รายการนี้ชำระแล้ว', String(twice.error || ''));

  // ยอดติดลบ = แถวปลดวงเงิน ไม่ใช่หนี้ค้าง ปิดได้จะทำให้ยอดใช้ไปเด้งกลับเอง
  const rel = (await newLedger({ facilityId: facPN.id, amount: -200000, ref: `${MARK}-ปลด2` })).data;
  const usedRel = Number((await readFacility(facPN.id)).used);
  const negSettle = await call(`/credit/ledger/${rel.id}/settle`, { method: 'POST', user: A });
  bad('ปิดรายการยอดติดลบ → ปฏิเสธ', negSettle.status === 409, `${negSettle.status}`);
  happy('ข้อความตรงกับระบบจริง ("รายการนี้ไม่ใช่ยอดค้างชำระ")',
    String(negSettle.error || '') === 'รายการนี้ไม่ใช่ยอดค้างชำระ', String(negSettle.error || ''));
  happy('ยอดใช้ไปไม่เด้งกลับเพราะการปฏิเสธ', Number((await readFacility(facPN.id)).used) === usedRel, '');

  const ghost = await call('/credit/ledger/00000000-0000-0000-0000-000000000000/settle', { method: 'POST', user: A });
  bad('ปิดรายการที่ไม่มีอยู่ → 404', ghost.status === 404, `${ghost.status}`);
}

// ───────────────────────────────────────────────────────────────────────────
// 7. ลบรายการ — วงเงินที่ใช้ไปต้องถูกปล่อยคืน
// ───────────────────────────────────────────────────────────────────────────
suite('7. ลบรายการแล้ววงเงินคืน');
{
  const base = Number((await readFacility(facPN.id)).used);
  const l = (await newLedger({ facilityId: facPN.id, amount: 900000, ref: `${MARK}-ลบ` })).data;
  happy('บันทึกแล้วยอดใช้ไปเพิ่ม', Number((await readFacility(facPN.id)).used) === base + 900000, '');
  const del = await call(`/credit/ledger/${l.id}`, { method: 'DELETE', user: A });
  made.led = made.led.filter((x) => x !== l.id);
  happy('ลบสำเร็จ', del.status === 200, `${del.status}`);
  happy('วงเงินที่ใช้ไปถูกปล่อยคืนเท่าเดิม', Number((await readFacility(facPN.id)).used) === base, '');
  const again = await call(`/credit/ledger/${l.id}`, { method: 'DELETE', user: A });
  bad('ลบซ้ำ → 404', again.status === 404, `${again.status}`);
  happy('มีร่องรอยในประวัติว่าใครลบ',
    ((await call(`/credit/audit?target=ledger&targetId=${l.id}`, { user: A })).data || []).some((a) => a.action === 'delete'), '');
}

// ───────────────────────────────────────────────────────────────────────────
// 8. ปรับวงเงิน และตั้งยอดใช้ไปเอง
//
// setLimit / setUsedOverride ของเขา: ยอดที่ปักเองเชื่อตามที่กรอกเป๊ะ ๆ (ไม่ตัดที่
// ศูนย์ ไม่ตัดที่วงเงิน) ส่วนค่าว่างคือ "กลับไปคำนวณอัตโนมัติ" ไม่ใช่ตั้งเป็นศูนย์
// ───────────────────────────────────────────────────────────────────────────
suite('8. ปรับวงเงินและตั้งยอดใช้ไปเอง');
{
  const f = await newFacility({ company: `${MARK} ปรับวงเงิน`, facilityNo: 4, limit: 8000000 });
  await newLedger({ facilityId: f.id, amount: 3000000, ref: `${MARK}-TL` });
  let v = await readFacility(f.id);
  happy('ยอดใช้ไปคำนวณจากรายการ', Number(v.used) === 3000000 && v.used_overridden === false, `${v.used}`);
  happy('คงเหลือ = วงเงิน − ใช้ไป', Number(v.available) === 5000000, `${v.available}`);

  const lim = await call(`/credit/facilities/${f.id}/limit`, { method: 'PUT', user: A, body: { limit: 4000000 } });
  happy('ปรับวงเงินได้', lim.status === 200 && Number(lim.data.limit) === 4000000, `${lim.status}`);
  happy('คงเหลือคำนวณใหม่ทันที', Number(lim.data.available) === 1000000, `${lim.data.available}`);
  bad('วงเงินติดลบ → ปฏิเสธ',
    (await call(`/credit/facilities/${f.id}/limit`, { method: 'PUT', user: A, body: { limit: -1 } })).status === 400, '');

  // ปักยอดเกินวงเงิน: คงเหลือติดลบได้จริง ตารางขึ้นป้าย "เกินวงเงิน"
  await call(`/credit/facilities/${f.id}`, { method: 'PATCH', user: A, body: { usedOverride: 5000000 } });
  v = await readFacility(f.id);
  happy('ปักยอดใช้ไปเองแล้วใช้ตัวเลขนั้นตรง ๆ', Number(v.used) === 5000000 && v.used_overridden === true, `${v.used}`);
  happy('ยังบอกยอดที่คำนวณได้ไว้ให้เทียบ', Number(v.used_auto) === 3000000, `${v.used_auto}`);
  happy('ปักเกินวงเงิน → คงเหลือติดลบ', Number(v.available) === -1000000, `${v.available}`);
  happy('หลอดเปอร์เซ็นต์ไม่เกินร้อย', v.pct === 100, `${v.pct}`);

  await call(`/credit/facilities/${f.id}`, { method: 'PATCH', user: A, body: { usedOverride: 0 } });
  v = await readFacility(f.id);
  happy('ปักเป็นศูนย์ได้ (ธนาคารแจ้งว่าไม่มียอดใช้)', Number(v.used) === 0 && v.used_overridden === true, `${v.used}/${v.used_overridden}`);

  await call(`/credit/facilities/${f.id}`, { method: 'PATCH', user: A, body: { usedOverride: null } });
  v = await readFacility(f.id);
  happy('ล้างค่าแล้วกลับไปคำนวณอัตโนมัติ', Number(v.used) === 3000000 && v.used_overridden === false, `${v.used}`);
  happy('มีร่องรอยทั้งตอนปักและตอนล้าง',
    ((await call(`/credit/audit?target=facility&targetId=${f.id}`, { user: A })).data || [])
      .filter((a) => a.action === 'usedoverride' || a.action === 'usedclear').length >= 2, '');
}

// ───────────────────────────────────────────────────────────────────────────
// 9. ตั้งและล้างงบหมวดค่าใช้จ่าย
// ───────────────────────────────────────────────────────────────────────────
suite('9. งบประมาณรายหมวด');
{
  const CAT = `${MARK}-หมวดงบ`;
  const l = (await newLedger({ facilityId: facBE.id, amount: 1200000, ref: `${MARK}-งบ`, costCategory: CAT })).data;

  const set = await call('/credit/category-caps', { method: 'PUT', user: A,
    body: { projectId: project.id, costCategory: CAT, cap: 1000000, note: 'จาก cashflow ที่ส่งธนาคาร' } });
  happy('ตั้งงบได้', set.status === 200 && Number(set.data.cap) === 1000000, `${set.status}`);

  const sum = await call(`/credit/cost-summary?projectId=${project.id}`, { user: A });
  const line = (sum.data.projects[0]?.lines || []).find((x) => x.cost_category === CAT);
  happy('หน้าสรุปเทียบใช้ไปกับงบให้', line && line.spent === 1200000 && line.cap === 1000000, JSON.stringify(line));
  happy('บอกว่าเกินงบ', line?.over === true, String(line?.over));
  happy('บอกว่าเกินไปเท่าไร', line?.remaining === -200000, String(line?.remaining));

  const near = await call('/credit/category-caps', { method: 'PUT', user: A,
    body: { projectId: project.id, costCategory: CAT, cap: 1400000 } });
  happy('แก้งบแล้วเขียนทับแถวเดิม ไม่เพิ่มแถว', near.status === 200, `${near.status}`);
  const line2 = ((await call(`/credit/cost-summary?projectId=${project.id}`, { user: A }))
    .data.projects[0]?.lines || []).find((x) => x.cost_category === CAT);
  happy('ใช้ไป 1.2 ล้านจากงบ 1.4 ล้าน → ใกล้เต็มงบ', line2?.near === true && line2?.over === false,
    `near=${line2?.near} over=${line2?.over}`);

  const clear = await call('/credit/category-caps', { method: 'PUT', user: A,
    body: { projectId: project.id, costCategory: CAT, cap: 0 } });
  happy('งบศูนย์ = ล้างงบ', clear.status === 200 && clear.data.cleared === true, JSON.stringify(clear.data));
  const line3 = ((await call(`/credit/cost-summary?projectId=${project.id}`, { user: A }))
    .data.projects[0]?.lines || []).find((x) => x.cost_category === CAT);
  happy('ล้างแล้วกลับเป็น "ยังไม่ได้ตั้งงบ" ไม่ใช่งบศูนย์', line3 && line3.cap === null, JSON.stringify(line3));

  // "(ไม่ระบุหมวด)" เป็นกองที่หน้าสรุปรวมรายการที่ยังไม่กรอกหมวด ไม่ใช่หมวดจริง
  const pseudo = await call('/credit/category-caps', { method: 'PUT', user: A,
    body: { projectId: project.id, costCategory: '(ไม่ระบุหมวด)', cap: 500000 } });
  bad('ตั้งงบให้กลุ่ม "(ไม่ระบุหมวด)" → ปฏิเสธ', pseudo.status === 400, `${pseudo.status}`);
  happy('บอกให้ไปกรอกหมวดที่คำขอก่อน', /ยังไม่ได้ระบุหมวด/.test(String(pseudo.error || '')), String(pseudo.error || ''));
  bad('ไม่มีแถวงบของกลุ่มนั้นค้างในฐาน',
    (await query(`select count(*)::int c from credit_category_caps where project_id = $1 and cost_category = '(ไม่ระบุหมวด)'`,
      [project.id])).rows[0].c === 0, '');

  const negCap = await call('/credit/category-caps', { method: 'PUT', user: A,
    body: { projectId: project.id, costCategory: CAT, cap: -5 } });
  bad('งบติดลบ → ปฏิเสธ', negCap.status === 400, `${negCap.status}`);

  await call(`/credit/ledger/${l.id}`, { method: 'DELETE', user: A });
  made.led = made.led.filter((x) => x !== l.id);
  await query('delete from credit_category_caps where project_id = $1 and cost_category like $2', [project.id, `${MARK}%`]);
}

// ───────────────────────────────────────────────────────────────────────────
// 10. ทะเบียนหมวดค่าใช้จ่าย — เพิ่ม ย้ายลำดับ ลบที่ถูกใช้อยู่
// ───────────────────────────────────────────────────────────────────────────
suite('10. ทะเบียนหมวดค่าใช้จ่าย');
{
  const original = (await call('/credit/cost-categories', { user: A })).data || [];
  const A1 = `${MARK}-ก`; const A2 = `${MARK}-ข`;

  const add = await call('/credit/cost-categories', { method: 'PUT', user: A, body: { list: [...original, A1, A2] } });
  happy('เพิ่มสองหมวดแล้วได้กลับมาครบ', add.data?.count === original.length + 2, `${add.data?.count}`);
  happy('ลำดับที่จัดคือลำดับที่แสดง',
    ((await call('/credit/cost-categories', { user: A })).data || []).join('|') === [...original, A1, A2].join('|'), '');

  const moved = [...original, A2, A1];
  await call('/credit/cost-categories', { method: 'PUT', user: A, body: { list: moved } });
  happy('ย้ายลำดับแล้วเมนูเรียงตามที่ย้าย',
    ((await call('/credit/cost-categories', { user: A })).data || []).join('|') === moved.join('|'), '');

  const dup = await call('/credit/cost-categories', { method: 'PUT', user: A, body: { list: [...moved, A1, A1] } });
  happy('ส่งชื่อซ้ำมา → ตัดซ้ำให้ ไม่เพิ่มสองแถว', dup.data?.count === moved.length, `${dup.data?.count}`);

  // หมวดที่เงินก้อนหนึ่งอ้างอยู่ ลบไม่ได้ ต้องปิด — ไม่งั้นเงินที่เบิกไปแล้วกลาย
  // เป็นหมวดที่ไม่มีอยู่ และหน้าสรุปตั้งงบให้มันอีกไม่ได้
  const l = (await newLedger({ facilityId: facBE.id, amount: 100000, ref: `${MARK}-ทะเบียน`, costCategory: A1 })).data;
  const drop = await call('/credit/cost-categories', { method: 'PUT', user: A, body: { list: original } });
  happy('เอาออกทั้งสองหมวด', drop.status === 200, `${drop.status}`);
  happy('หมวดที่ยังถูกใช้ถูกปิด ไม่ได้ลบ', (drop.data?.deactivated || []).includes(A1), JSON.stringify(drop.data?.deactivated));
  happy('หมวดที่ไม่มีใครใช้ถูกลบจริง', (drop.data?.removed || []).includes(A2), JSON.stringify(drop.data?.removed));
  bad('หมวดที่ปิดแล้วหายจากเมนู', !((await call('/credit/cost-categories', { user: A })).data || []).includes(A1), '');
  happy('แต่แถวยังอยู่ในฐาน',
    (await query('select count(*)::int c from credit_cost_categories where name = $1', [A1])).rows[0].c === 1, '');
  happy('เงินที่เบิกด้วยหมวดที่ปิดแล้วยังขึ้นในหน้าสรุป',
    ((await call(`/credit/cost-summary?projectId=${project.id}`, { user: A })).data.projects[0]?.lines || [])
      .some((x) => x.cost_category === A1), '');

  // กดบันทึกโดยไม่แตะอะไรเลย ต้องไม่ลบหมวดที่ "ปิดอยู่" ทิ้ง (ข้อมูลจริงมีอยู่สองหมวด)
  const offBefore = (await query('select count(*)::int c from credit_cost_categories where not is_active')).rows[0].c;
  await call('/credit/cost-categories', { method: 'PUT', user: A, body: { list: original } });
  happy('บันทึกซ้ำโดยไม่แตะอะไร ไม่ลบหมวดที่ปิดอยู่',
    (await query('select count(*)::int c from credit_cost_categories where not is_active')).rows[0].c === offBefore,
    `${offBefore}`);

  await call(`/credit/ledger/${l.id}`, { method: 'DELETE', user: A });
  made.led = made.led.filter((x) => x !== l.id);
  await query('delete from credit_cost_categories where name like $1', [`${MARK}%`]);
  happy('คืนทะเบียนกลับชุดเดิมครบ',
    ((await call('/credit/cost-categories', { user: A })).data || []).join('|') === original.join('|'), '');
}

// ───────────────────────────────────────────────────────────────────────────
// 11. ตัวกรองห้าช่องรวมกัน
//
// แถบตัวกรองของเขามีหกช่อง (บริษัท ประเภท โครงการ สถานะ ระยะเวลา คำค้น) และทุก
// ช่องรวมกันด้วย "และ" — ที่พลาดได้จริงคือช่องหนึ่งกลืนอีกช่อง
// ───────────────────────────────────────────────────────────────────────────
suite('11. ตัวกรองรวมกันทุกช่อง');
const facFilter = await newFacility({ company: `${MARK} บริษัทกรอง`, facilityNo: 5, limit: 7000000 });
{
  const mk = (amount, status, ref, dueDate, extra = {}) =>
    newLedger({ facilityId: facFilter.id, amount, status, ref, dueDate, ...extra });
  const rNew = (await mk(110000, 'คำขอใหม่', `${MARK}-F-ใหม่`, D.nextMonth)).data;
  const rProp = (await mk(120000, 'อยู่ระหว่างเสนออนุมัติ', `${MARK}-F-เสนอ`, D.in3Days)).data;
  const rAppr = (await mk(130000, 'อนุมัติแล้ว', `${MARK}-F-อนุมัติ`, D.lastMonth,
    { beneficiary: `${MARK} ผู้รับเงินพิเศษ` })).data;
  const rPaid = (await mk(140000, 'ชำระแล้ว', `${MARK}-F-ชำระ`, D.farFuture)).data;

  const q = async (qs) => ((await call(`/credit/ledger?${qs}`, { user: A })).data || [])
    .filter((x) => String(x.ref || '').startsWith(`${MARK}-F-`));

  happy('โครงการเดียว → เห็นทั้งสี่แถวของชุดนี้', (await q(`projectId=${project.id}`)).length === 4,
    `${(await q(`projectId=${project.id}`)).length}`);
  happy('บริษัท + ประเภท รวมกัน',
    (await q(`company=${encodeURIComponent(facFilter.company)}&facilityNo=5`)).length === 4, '');
  bad('บริษัทถูก แต่ประเภทไม่ใช่ → ไม่เห็นอะไร',
    (await q(`company=${encodeURIComponent(facFilter.company)}&facilityNo=7`)).length === 0, '');
  happy('สถานะรออนุมัติ (ใหม่/เสนอ) ได้สองแถว',
    (await q(`projectId=${project.id}&status=${encodeURIComponent('คำขอใหม่,อยู่ระหว่างเสนออนุมัติ')}`)).length === 2, '');

  const five = await q(`projectId=${project.id}&company=${encodeURIComponent(facFilter.company)}`
    + `&facilityNo=5&status=${encodeURIComponent('อนุมัติแล้ว')}&due=overdue`
    + `&search=${encodeURIComponent('ผู้รับเงินพิเศษ')}`);
  happy('ห้าช่องพร้อมกัน (โครงการ+บริษัท+ประเภท+สถานะ+ระยะเวลา+คำค้น) → เหลือแถวเดียว',
    five.length === 1 && five[0].id === rAppr.id, `${five.length}`);

  // ช่องคำค้นต้องหาจากคอลัมน์ที่เห็นอยู่บนตาราง รวมถึงป้ายประเภท
  happy('ค้นด้วยเลขที่เอกสารเจอ', (await q(`search=${encodeURIComponent(`${MARK}-F-เสนอ`)}`)).length === 1, '');
  happy('ค้นด้วยป้ายประเภทบนตาราง (L/G) เจอรายการของประเภทนั้น',
    (await q(`projectId=${project.id}&search=${encodeURIComponent('L/G')}`)).length === 4,
    `${(await q(`projectId=${project.id}&search=${encodeURIComponent('L/G')}`)).length}`);
  bad('ค้นคำที่ไม่มีอยู่ → ว่าง ไม่ใช่ทั้งตาราง',
    (await q(`projectId=${project.id}&search=${encodeURIComponent('ไม่มีคำนี้ที่ไหนเลย')}`)).length === 0, '');

  // ตัวกรองของตารางวงเงินต้องหาจากชื่อโครงการและชื่อประเภทได้ด้วย
  const fq = async (qs) => ((await call(`/credit/facilities?${qs}`, { user: A })).data || [])
    .filter((f) => made.fac.includes(f.id));
  happy('ตารางวงเงิน: ค้นด้วยรหัสโครงการเจอ', (await fq(`search=${project.code}`)).length >= 4,
    `${(await fq(`search=${project.code}`)).length}`);
  happy('ตารางวงเงิน: ค้นด้วยชื่อประเภทวงเงินเจอ', (await fq(`search=${encodeURIComponent('อาวัล')}`)).length >= 1, '');
  happy('ตารางวงเงิน: ค้นด้วยชื่อบริษัทเจอ', (await fq(`search=${encodeURIComponent(`${MARK} บริษัทกรอง`)}`)).length === 1, '');

  // เก็บไว้ใช้ในส่วนถัดไป
  facFilter.rows = { rNew, rProp, rAppr, rPaid };
}

// ───────────────────────────────────────────────────────────────────────────
// 12. การ์ดแดชบอร์ดกดแล้วต้องได้ของที่การ์ดนับไว้
//
// นี่คือจุดที่หลุดมาจริง: การ์ด "ครบกำหนดเดือนนี้" นับด้วย dueBucket (ทั้งเดือน
// นับเป็นเดือนนี้ แม้วันจะเลยไปแล้ว) แต่ตัวกรอง "เกินกำหนด" เคยใช้ "ก่อนวันนี้"
// — ตั๋วใบเดียวจึงโผล่ทั้งสองที่ แล้วยอดในตารางไม่เท่ากับยอดบนการ์ดที่กดมา
// ───────────────────────────────────────────────────────────────────────────
suite('12. การ์ดแดชบอร์ด ↔ ตัวกรองที่กดไปถึง');
{
  const f = await newFacility({ company: `${MARK} การ์ด`, facilityNo: 7, limit: 20000000 });
  const early = (await newLedger({ facilityId: f.id, amount: 1010000, dueDate: D.earlierThisMonth,
    ref: `${MARK}-C-ต้นเดือน` })).data;
  const old = (await newLedger({ facilityId: f.id, amount: 1020000, dueDate: D.lastMonth,
    ref: `${MARK}-C-เดือนก่อน` })).data;
  // ครบกำหนด "วันนี้" — อยู่ในหน้าต่างเจ็ดวันและอยู่ในเดือนนี้เสมอ ไม่ว่าจะรันชุดนี้
  // วันไหนของเดือน (วันที่ +3 ตกเดือนถัดไปเมื่อรันปลายเดือน แล้วเทสต์จะแดงเอง)
  const soon = (await newLedger({ facilityId: f.id, amount: 1030000, dueDate: D.today,
    ref: `${MARK}-C-ครบวันนี้` })).data;
  const next = (await newLedger({ facilityId: f.id, amount: 1040000, dueDate: D.nextMonth,
    ref: `${MARK}-C-เดือนหน้า` })).data;

  const ids = async (due) => new Set(((await call(`/credit/ledger?due=${due}&projectId=${project.id}`, { user: A })).data || [])
    .map((x) => x.id));
  const over = await ids('overdue'); const thisM = await ids('thisMonth');
  const nextM = await ids('nextMonth'); const d7 = await ids('due7');

  happy('เกินกำหนด = ก่อนเดือนนี้ (ไม่ใช่ก่อนวันนี้)', over.has(old.id), '');
  bad('ตั๋วที่ครบกำหนดต้นเดือนนี้ไม่ถูกนับเป็นเกินกำหนด', !over.has(early.id), '');
  happy('ตั๋วต้นเดือนนี้อยู่ในกลุ่ม "เดือนนี้"', thisM.has(early.id), '');
  bad('ตั๋วเดือนก่อนไม่หลุดเข้ากลุ่มเดือนนี้', !thisM.has(old.id), '');
  happy('เดือนหน้าได้เฉพาะของเดือนหน้า', nextM.has(next.id) && !nextM.has(soon.id), '');
  happy('ครบใน 7 วันเป็นกลุ่มซ้อน — ตั๋วเดียวอยู่ได้ทั้ง 7 วันและเดือนนี้',
    d7.has(soon.id) && thisM.has(soon.id), '');

  // ตัวเลขบนการ์ดต้องมาจากกฎเดียวกับตัวกรอง จึงเทียบยอดของโครงการนี้ตรง ๆ
  const ov = (await call('/credit/overview', { user: A })).data;
  const sumOf = async (due) => ((await call(`/credit/ledger?due=${due}&projectId=${project.id}`, { user: A })).data || [])
    .filter((x) => x.status !== 'ชำระแล้ว' && String(x.status).toLowerCase() !== 'void' && Number(x.amount) > 0)
    .reduce((a, x) => a + Number(x.amount), 0);
  for (const [card, due] of [['thisMonth', 'thisMonth'], ['nextMonth', 'nextMonth'], ['due7', 'due7']]) {
    const inList = await sumOf(due);
    happy(`ยอดการ์ด ${card} ครอบยอดในตารางของโครงการทดสอบ`,
      Number(ov.buckets[card].amount) >= inList - 0.01, `การ์ด ${ov.buckets[card].amount} · ตาราง ${inList}`);
  }

  for (const id of [early.id, old.id, soon.id, next.id]) {
    await call(`/credit/ledger/${id}`, { method: 'DELETE', user: A });
    made.led = made.led.filter((x) => x !== id);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 13. ส่งออก Excel ตามตัวกรองที่เห็นบนหน้าจอ
// ───────────────────────────────────────────────────────────────────────────
suite('13. ส่งออก Excel ตามตัวกรอง');
{
  const grab = async (qs) => {
    const res = await fetch(`${API}/credit/export?${qs}`, { headers: { Authorization: `Bearer ${tok(A)}` } });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await res.arrayBuffer()));
    const read = (name, col) => {
      const ws = wb.getWorksheet(name); const out = [];
      if (ws) ws.eachRow((row, i) => { if (i > 1) out.push(String(row.getCell(col).value ?? '')); });
      return out;
    };
    return { status: res.status, facProjects: read('วงเงินสินเชื่อ', 1), facTypes: read('วงเงินสินเชื่อ', 3),
      ledgerDetails: read('รายการสินเชื่อ', 5), ledgerStatus: read('รายการสินเชื่อ', 10),
      ledgerRefs: read('รายการสินเชื่อ', 13) };
  };

  const all = await grab(`projectId=${project.id}`);
  happy('ส่งออกตามโครงการได้', all.status === 200 && all.facProjects.length > 0, `${all.status}`);
  bad('ไฟล์มีแต่โครงการที่กรองไว้', new Set(all.facProjects).size === 1, [...new Set(all.facProjects)].join(','));

  const byStatus = await grab(`projectId=${project.id}&status=${encodeURIComponent('อนุมัติแล้ว')}`);
  bad('กรองสถานะแล้วแผ่นรายการมีแต่สถานะนั้น',
    byStatus.ledgerStatus.every((s) => s === 'อนุมัติแล้ว'), [...new Set(byStatus.ledgerStatus)].join(','));

  const bySearch = await grab(`projectId=${project.id}&search=${encodeURIComponent(`${MARK} บริษัทกรอง`)}`);
  bad('คำค้นกรองแผ่นวงเงินด้วย ไม่ใช่แผ่นรายการอย่างเดียว',
    bySearch.facProjects.length === 1, `${bySearch.facProjects.length} แถว`);

  const byDue = await grab(`projectId=${project.id}&due=overdue`);
  happy('ส่งออกตามระยะเวลาใช้กฎเดียวกับตาราง', byDue.status === 200, `${byDue.status}`);
  const overIds = new Set(((await call(`/credit/ledger?due=overdue&projectId=${project.id}`, { user: A })).data || [])
    .map((x) => x.ref).filter(Boolean));
  bad('ทุกแถวในไฟล์อยู่ในชุดเดียวกับที่ตารางแสดง',
    byDue.ledgerRefs.filter(Boolean).every((r) => overIds.has(r)), '');

  const empty = await grab(`projectId=${project.id}&search=${encodeURIComponent('ไม่มีคำนี้ที่ไหนเลย')}`);
  bad('กรองจนไม่เหลืออะไร → ไฟล์ว่าง ไม่ใช่ทั้งฐาน', empty.facProjects.length === 0 && empty.ledgerRefs.length === 0,
    `${empty.facProjects.length}/${empty.ledgerRefs.length}`);
}

// ───────────────────────────────────────────────────────────────────────────
// 14. ดอกเบี้ยเกินกำหนดเมื่ออัตราเป็นข้อความอย่าง "MLR"
// ───────────────────────────────────────────────────────────────────────────
suite('14. ดอกเบี้ยเกินกำหนดเมื่ออัตราไม่ใช่ตัวเลข');
{
  const f = await newFacility({ company: `${MARK} MLR`, facilityNo: 6, limit: 9000000, interestNote: 'MLR ต่อปี' });
  happy('เก็บประโยคอัตราไว้ตรงตัว', f.interest_note === 'MLR ต่อปี', String(f.interest_note));
  happy('ไม่มีตัวเลข % → อัตราเป็น null ไม่ใช่ 0', f.interest_pct === null, String(f.interest_pct));

  const lateDue = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 40));
  const l = (await newLedger({ facilityId: f.id, amount: 1000000, dueDate: lateDue, ref: `${MARK}-MLR` })).data;
  const row = ((await call('/credit/overdue', { user: A })).data || []).find((x) => x.id === l.id);
  happy('บอกว่าระบุอัตราไม่ได้', row?.overdue_rate_unavailable === true, String(row?.overdue_rate_unavailable));
  happy('ไม่เดายอดดอกเบี้ยเป็นตัวเลข', Number(row?.overdue_interest) === 0, String(row?.overdue_interest));
  happy('ยังนับวันที่เกินกำหนดให้', Number(row?.overdue_days) === 40, String(row?.overdue_days));

  // ครบกำหนด "วันนี้" ยังไม่ค้าง — ห้ามถูกนับเข้า "N รายการระบุอัตราไม่ได้"
  const before = Number((await call('/credit/overview', { user: A })).data.overdueRateUnknown);
  const todayRow = (await newLedger({ facilityId: f.id, amount: 500000, dueDate: D.today, ref: `${MARK}-MLR-วันนี้` })).data;
  const after = Number((await call('/credit/overview', { user: A })).data.overdueRateUnknown);
  bad('ตั๋วที่ครบกำหนดวันนี้ไม่ถูกนับเป็น "ระบุอัตราไม่ได้"', after === before, `${before} → ${after}`);
  bad('และไม่โผล่ในรายการเกินกำหนด',
    !((await call('/credit/overdue', { user: A })).data || []).some((x) => x.id === todayRow.id), '');

  // กรอกอัตราเป็นประโยคที่มีตัวเลขแล้วต้องคำนวณได้ทันที
  const upd = await call(`/credit/facilities/${f.id}`, { method: 'PATCH', user: A,
    body: { interestNote: '1.5 % ต่อปีเรียกเก็บทุก 3 เดือน' } });
  happy('ดึงตัวเลขหน้า % ออกจากประโยคได้', upd.data.interest_pct === 1.5, String(upd.data.interest_pct));
  const row2 = ((await call('/credit/overdue', { user: A })).data || []).find((x) => x.id === l.id);
  const want = Math.round(1000000 * 0.015 * 40 / 365);
  happy(`คำนวณดอกเบี้ยตามสูตร ยอด × อัตรา × วัน ÷ 365 (${want})`,
    Math.abs(Number(row2?.overdue_interest) - want) <= 1, String(row2?.overdue_interest));
  bad('ไม่ขึ้นว่าระบุอัตราไม่ได้อีก', row2?.overdue_rate_unavailable === false, String(row2?.overdue_rate_unavailable));

  // ที่ยังไม่อนุมัติไม่คิดดอกเบี้ย ตามกฎ isAuth ของเขา
  const pend = (await newLedger({ facilityId: f.id, amount: 2000000, dueDate: lateDue,
    status: 'คำขอใหม่', ref: `${MARK}-MLR-ยังไม่อนุมัติ` })).data;
  bad('รายการที่ยังไม่อนุมัติไม่คิดดอกเบี้ยเกินกำหนด',
    !((await call('/credit/overdue', { user: A })).data || []).some((x) => x.id === pend.id), '');
}

// ───────────────────────────────────────────────────────────────────────────
// 15. สิทธิ์ — ปุ่มบนจอกับ API ต้องกั้นด้วยกฎเดียวกัน
// ───────────────────────────────────────────────────────────────────────────
suite('15. สิทธิ์เปิดให้รายบุคคลแล้วต้องใช้ได้จริง');
{
  const perms = (await query('select role, permissions from profiles where id = $1', [H.id])).rows[0];
  const canEdit = perms?.permissions?.credit?.edit === true;
  happy('บัญชีฝ่ายบุคคลที่ถูกเปิดสิทธิ์ไว้ ยังถืออยู่จริง', canEdit, JSON.stringify(perms?.permissions?.credit || {}));
  if (canEdit) {
    const r = (await newRequest({ facilityId: facBE.id, amount: 150000, beneficiary: `${MARK} สิทธิ์` })).data;
    const d = await call(`/credit/requests/${r.id}/decide`, { method: 'POST', user: H, body: { decision: 'อนุมัติ' } });
    happy('เปิดสิทธิ์ "แก้ไขข้อมูล" แล้วอนุมัติได้ ไม่ใช่เฉพาะผู้บริหาร', d.status === 200, `${d.status}`);
    if (d.data?.ledger?.id) made.led.push(d.data.ledger.id);
  }
  // ผู้ที่ไม่มีสิทธิ์อ่านเลย ต้องไม่เห็นตัวเลขเงิน
  const nobody = (await query(
    `select id from profiles where role not in ('admin','executive')
       and coalesce((permissions->'credit'->>'view')::boolean, false) = false limit 1`)).rows[0];
  if (nobody) {
    const g = await call('/credit/facilities', { user: { id: nobody.id } });
    happy('คนที่ไม่มีสิทธิ์ดู → ไม่เห็นตัวเลขวงเงิน', g.status === 403, `${g.status}`);
  }
}

// ───────────────────────────────────────────────────────────────────────────
suite('16. ไม่ทิ้งข้อมูลทดสอบไว้');
{
  // เก็บด้วยเครื่องหมาย ไม่ใช่ด้วยรายชื่อ id ของรอบนี้ — รอบที่ล้มกลางคันทิ้ง
  // วงเงินทดสอบไว้ แล้วรอบถัดไปมองไม่เห็นเพราะ id พวกนั้นไม่อยู่ในตัวแปรอีก
  const marked = (await query('select id from facilities where notes = $1', [MARK])).rows.map((r) => r.id);
  const ids = [...new Set([...made.fac, ...marked])];
  if (ids.length) {
    await query('delete from credit_ledger where facility_id = any($1::uuid[])', [ids]);
    await query('delete from credit_requests where facility_id = any($1::uuid[])', [ids]);
    await query('delete from facilities where id = any($1::uuid[])', [ids]);
  }
  await query('delete from credit_ledger where ref like $1', [`${MARK}%`]);
  await query('delete from credit_category_caps where cost_category like $1', [`${MARK}%`]);
  await query('delete from credit_cost_categories where name like $1', [`${MARK}%`]);
  const left = (await query(
    `select (select count(*) from facilities where notes = $1)
          + (select count(*) from credit_ledger where ref like $2)
          + (select count(*) from credit_cost_categories where name like $2) n`,
    [MARK, `${MARK}%`])).rows[0].n;
  happy('ลบข้อมูลทดสอบหมดแล้ว', Number(left) === 0, `เหลือ ${left}`);
  // ข้อมูลจริงของลูกค้าต้องเท่าเดิมทุกครั้งที่ชุดนี้จบ
  const real = (await query(
    `select (select count(*) from facilities f join projects p on p.id = f.project_id where p.code <> $1) fac,
            (select count(*) from credit_ledger where source_id is not null) led`, [TEST_PROJECT])).rows[0];
  happy('วงเงินจริงของลูกค้ายังครบ 48 ก้อน', Number(real.fac) === 48, String(real.fac));
  happy('รายการที่นำเข้ายังครบ 66 แถว', Number(real.led) === 66, String(real.led));
}

process.exit(report(`${new URL('./.out/credit-flows.json', import.meta.url).pathname}`) ? 1 : 0);
