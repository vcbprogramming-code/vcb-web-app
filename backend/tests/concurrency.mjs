/**
 * หลายคนกดพร้อมกัน — เลขที่ต้องไม่ชนกัน และต้องไม่มีใครได้ 500
 *
 * ที่ทำงานจริงมีคนใช้พร้อมกัน เลขที่กรณีศึกษา SOP และเลขรุ่นของรายงานการ
 * ประชุมเคยจองด้วยวิธี "อ่านค่ามากสุดแล้วบวกหนึ่ง" ซึ่งสองคนที่กดพร้อมกันจะ
 * ได้เลขเดียวกัน คนหลังชนกุญแจซ้ำแล้วเห็นหน้าจอแจ้งว่าระบบขัดข้อง — วัดได้
 * ว่าแปดคนกดพร้อมกัน สำเร็จแค่คนเดียว
 *
 * ไม่แตะ E-memo — เลขที่หนังสือของโมดูลนั้นมีชุดทดสอบของตัวเองอยู่แล้ว
 */
import { call, suite, happy, bad, report, U, warm, query } from './harness.mjs';

await warm();
const A = U.admin;
const MARK = 'ZZCONC';

const clean = async () => {
  await query('delete from mtg_meetings where title like $1', [`${MARK}%`]);
  for (const x of ((await call('/sop/scenarios', { user: A })).data || [])
    .filter((s) => String(s.title_th).startsWith(MARK))) {
    await call(`/sop/scenarios/${x.no}`, { method: 'DELETE', user: A });
  }
};
await clean();

suite('1. สร้างกรณีศึกษา SOP พร้อมกันแปดคน');
{
  const mods = (await call('/sop/bootstrap', { user: A })).data.modules;
  const res = await Promise.all(Array.from({ length: 8 }, (_, i) =>
    call('/sop/scenarios', { method: 'POST', user: A, body: {
      module: mods[0].code, titleTh: `${MARK} กรณี ${i + 1}`, steps: [{ text: 'ขั้นที่หนึ่ง' }] } })));
  const codes = res.map((r) => r.status);
  happy('ทุกคนบันทึกสำเร็จ ไม่มีใครเจอระบบขัดข้อง', codes.every((c) => c === 201), codes.join(','));
  const nos = res.map((r) => r.data?.no).filter((n) => n != null);
  happy('ได้เลขที่ครบทุกคน', nos.length === 8, `${nos.length} เลข`);
  bad('เลขที่ไม่ซ้ำกันเลย', new Set(nos).size === nos.length, nos.join(','));

  const saved = ((await call('/sop/scenarios', { user: A })).data || [])
    .filter((s) => String(s.title_th).startsWith(MARK));
  happy('กรณีศึกษาทั้งแปดอยู่ในคู่มือจริง', saved.length === 8, `${saved.length} รายการ`);
}

suite('2. แก้รายงานการประชุมฉบับเดียวกันพร้อมกันหกคน');
{
  const grp = (await query("select id from mtg_groups where visibility = 'public' limit 1")).rows[0];
  const mk = await call('/meetings', { method: 'POST', user: A, body: {
    groupId: grp.id, title: `${MARK} ประชุมแก้พร้อมกัน`, meetingDate: '2026-01-05',
    content: '<p>ฉบับเริ่มต้น</p>', visible: true } });
  happy('สร้างรายงานตั้งต้นได้', mk.status === 201, `${mk.status}`);

  const res = await Promise.all(Array.from({ length: 6 }, (_, i) =>
    call(`/meetings/${mk.data.id}`, { method: 'PATCH', user: A, body: { content: `<p>แก้ครั้งที่ ${i + 1}</p>` } })));
  const codes = res.map((r) => r.status);
  happy('ทุกคนบันทึกสำเร็จ', codes.every((c) => c === 200), codes.join(','));
  const versions = (await query('select count(*)::int n from mtg_versions where meeting_id = $1', [mk.data.id])).rows[0].n;
  happy('เก็บประวัติไว้ครบทุกครั้งที่แก้', versions === 6, `${versions} รุ่น`);
  const seqs = (await query('select seq from mtg_versions where meeting_id = $1 order by seq', [mk.data.id])).rows.map((r) => r.seq);
  bad('เลขรุ่นไม่ซ้ำกัน', new Set(seqs).size === seqs.length, seqs.join(','));
}

suite('3. ไม่ทิ้งข้อมูลทดสอบไว้');
{
  await clean();
  const left = ((await call('/sop/scenarios', { user: A })).data || [])
    .filter((s) => String(s.title_th).startsWith(MARK)).length;
  const m = (await query('select count(*)::int n from mtg_meetings where title like $1', [`${MARK}%`])).rows[0].n;
  happy('ลบข้อมูลทดสอบหมดแล้ว', left === 0 && m === 0, `${left} / ${m}`);
}

process.exit(report() ? 1 : 0);
