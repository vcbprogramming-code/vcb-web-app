/**
 * SOP — ประวัติเวอร์ชันและการกู้คืน
 *
 * ระบบของลูกค้าเก็บคู่มือเป็น JSON ก้อนเดียว จึงใช้ database trigger ดักก่อน
 * update ได้ — ประวัติจึงขาดไม่ได้แม้ผู้พัฒนา route ใดจะลืมเรียก ของเราแยกเป็น
 * เจ็ดตาราง จึงเก็บภาพทั้งเอกสารจากในโค้ดแทน ชุดทดสอบนี้คือสิ่งที่มาแทน trigger:
 * มันไล่ยิง "ทุกเส้นทางที่เขียนข้อมูล" แล้วยืนยันว่าเกิดเวอร์ชันใหม่ทุกครั้ง
 * ถ้ามีใครเพิ่ม route ใหม่แล้วลืม snapshot ข้อนี้จะฟ้อง
 */
import { call, suite, happy, bad, report, U, warm, query } from './harness.mjs';

await warm();
const A = U.admin, H = U.hr;
const MARK = 'ZZVER';

const versions = async () => (await query('select count(*)::int n from sop_versions')).rows[0].n;
const scenarios = async () => (await query('select count(*)::int n from sop_scenarios')).rows[0].n;
const startedWith = await versions();
const mods = (await call('/sop/bootstrap', { user: A })).data.modules;
const MOD = mods[0].code;
let no = null; let reportId = null;

suite('1. ทุกเส้นทางที่เขียนข้อมูลต้องเก็บเวอร์ชันไว้');
{
  // สร้างของสำหรับทดสอบก่อน แล้ววัดว่าแต่ละคำสั่งทำให้เวอร์ชันเพิ่มขึ้นหนึ่ง
  const step = async (name, fn) => {
    const before = await versions();
    const r = await fn();
    const after = await versions();
    happy(`${name} — เก็บเวอร์ชันไว้ก่อนแก้`, after === before + 1, `${before} → ${after}`);
    return r;
  };

  const created = await step('เพิ่มกรณีศึกษา', () => call('/sop/scenarios', { method: 'POST', user: A,
    body: { module: MOD, titleTh: `${MARK} กรณีทดสอบ`, steps: [{ text: 'ขั้นที่หนึ่ง' }] } }));
  no = created.data?.no;
  happy('สร้างกรณีศึกษาได้', created.status === 201 && Boolean(no), `${created.status}`);

  await step('แก้ไขกรณีศึกษา', () => call(`/sop/scenarios/${no}`, { method: 'PATCH', user: A,
    body: { titleTh: `${MARK} กรณีทดสอบ (แก้แล้ว)` } }));
  await step('สลับลำดับ', () => call(`/sop/scenarios/${no}/move`, { method: 'POST', user: A,
    body: { direction: 'up' } }));

  const rep = await step('เพิ่มรายงาน', () => call('/sop/reports', { method: 'POST', user: A,
    body: { caseNo: no, scenarioText: `${MARK} รายงานทดสอบ`, reportPath: 'ทดสอบ > เมนู' } }));
  reportId = rep.data?.id;
  await step('แก้ไขรายงาน', () => call(`/sop/reports/${reportId}`, { method: 'PATCH', user: A,
    body: { reportPath: 'ทดสอบ > เมนู > ย่อย' } }));
  await step('ลบรายงาน', () => call(`/sop/reports/${reportId}`, { method: 'DELETE', user: A }));
}

suite('2. รายการเวอร์ชันบอกได้ว่าใครทำอะไรเมื่อไร');
{
  const list = await call('/sop/versions', { user: A });
  happy('อ่านรายการเวอร์ชันได้', list.status === 200 && Array.isArray(list.data), `${list.status}`);
  const rows = list.data || [];
  happy('เรียงจากใหม่ไปเก่า',
    rows.every((r, i) => i === 0 || new Date(rows[i - 1].taken_at) >= new Date(r.taken_at)), '');
  happy('บอกว่าเป็นการแก้ไขอะไร', rows.some((r) => r.note === 'เพิ่มกรณีศึกษาใหม่'),
    rows.slice(0, 3).map((r) => r.note).join(' · '));
  happy('บอกชื่อผู้แก้ไข', rows.every((r) => r.taken_by_name), rows[0]?.taken_by_name || '');
  happy('บอกขนาดเนื้อหาในเวอร์ชันนั้น',
    rows.every((r) => Number.isInteger(r.scenarios) && Number.isInteger(r.reports)),
    JSON.stringify(rows[0] || {}));
  bad('รายการไม่แบกเนื้อหาเต็มมาด้วย', rows.every((r) => r.data === undefined), '');

  const one = await call(`/sop/versions/${rows[0].id}`, { user: A });
  happy('เปิดดูเวอร์ชันเดียวได้พร้อมเนื้อหาเต็ม',
    one.status === 200 && Array.isArray(one.data?.data?.scenarios), `${one.status}`);
}

suite('3. กู้คืนได้ และการกู้คืนก็ย้อนกลับได้');
{
  const beforeDelete = await scenarios();
  await call(`/sop/scenarios/${no}`, { method: 'DELETE', user: A });
  const afterDelete = await scenarios();
  happy('ลบกรณีศึกษาแล้วหายไปจริง', afterDelete === beforeDelete - 1, `${beforeDelete} → ${afterDelete}`);

  const target = (await call('/sop/versions', { user: A })).data.find((v) => v.note === 'ลบกรณีศึกษาออก');
  happy('มีเวอร์ชันที่เก็บไว้ก่อนลบ', Boolean(target), '');
  const rs = await call(`/sop/versions/${target.id}/restore`, { method: 'POST', user: A });
  happy('กู้คืนได้', rs.status === 200, `${rs.status}`);
  happy('กรณีศึกษาที่ลบไปกลับมาแล้ว', (await scenarios()) === beforeDelete, `${await scenarios()}`);
  const back = (await call('/sop/scenarios', { user: A })).data
    .some((x) => String(x.title_th).startsWith(`${MARK} กรณีทดสอบ`));
  happy('เนื้อหาที่กู้คืนเป็นของเดิมจริง', back, '');

  // การกู้คืนเองก็ถูกเก็บภาพไว้ จึงย้อนกลับไปสถานะ "หลังลบ" ได้อีก
  const undo = (await call('/sop/versions', { user: A })).data.find((v) => String(v.note).startsWith('ก่อนกู้คืนเวอร์ชัน'));
  happy('การกู้คืนถูกเก็บเป็นเวอร์ชันด้วย', Boolean(undo), '');
  await call(`/sop/versions/${undo.id}/restore`, { method: 'POST', user: A });
  happy('ย้อนการกู้คืนกลับได้', (await scenarios()) === afterDelete, `${await scenarios()}`);
}

suite('4. สิทธิ์');
{
  bad('ผู้ที่ไม่มีสิทธิ์แก้ไขเปิดประวัติไม่ได้',
    [403, 404].includes((await call('/sop/versions', { user: H })).status), '');
  bad('และกู้คืนไม่ได้',
    [403, 404].includes((await call('/sop/versions/1/restore', { method: 'POST', user: H })).status), '');
  bad('เวอร์ชันที่ไม่มีอยู่จริง → 404',
    (await call('/sop/versions/99999999', { user: A })).status === 404, '');
}

suite('5. ไม่ทิ้งข้อมูลทดสอบไว้');
{
  const left = (await call('/sop/scenarios', { user: A })).data
    .filter((x) => String(x.title_th).startsWith(MARK));
  for (const x of left) await call(`/sop/scenarios/${x.no}`, { method: 'DELETE', user: A });
  await query('delete from sop_reports where scenario_text like $1', [`${MARK}%`]);
  // ลบเฉพาะเวอร์ชันที่ชุดนี้ทำให้เกิด ไม่แตะของเดิมที่มีอยู่ก่อน
  await query(
    `delete from sop_versions where id in (
       select id from sop_versions order by id desc limit greatest(0, (select count(*) from sop_versions) - $1))`,
    [startedWith]);
  happy('ลบกรณีศึกษาทดสอบหมดแล้ว',
    (await call('/sop/scenarios', { user: A })).data.every((x) => !String(x.title_th).startsWith(MARK)), '');
  happy('จำนวนเวอร์ชันกลับไปเท่าเดิม', (await versions()) === startedWith, `${await versions()} / ${startedWith}`);
}

process.exit(report());
