/**
 * สามโมดูลอ้างอิง (SOP · แผนผังระบบ · พอร์ทัล) — ไล่ทีละสถานการณ์การใช้งาน
 * เทียบกับระบบจริงของลูกค้า
 *
 * สถานการณ์ในชุดนี้ถอดมาจากซอร์สของเขาโดยตรง ไม่ใช่จากหน้าจอของเราเอง:
 *   · sop/apps-script/Code.js + index.html — ช่องค้นหากวาดอะไร รหัสแสดงผลคิดจากอะไร
 *     สลับตำแหน่งทำอะไร ย้ายหมวดแล้วบรรทัดอ้างอิงเปลี่ยนตามไหม กรณีใหม่ได้วันที่ไหม
 *   · system-map/Index.html — ตัวกรองผสมกัน ทะเบียนฟังก์ชัน ชิปหน้าที่ที่เกี่ยวข้อง
 *   · portal/Code.js + index.html — วันเกิดที่กำลังจะถึง ประกาศ กล่องช่วยเหลือ
 *
 * ทุกอย่างที่ชุดนี้สร้างติดคำ ZZREF ไว้และถูกลบตอนจบ เวอร์ชันของคู่มือลบเฉพาะที่
 * เลข id ใหม่กว่าตอนเริ่ม — ฉบับสำรองจริงของเล่มเดิมต้องไม่ถูกแตะ
 */
import { fileURLToPath } from 'node:url';
import { call, suite, happy, bad, report, U, warm, query } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
await warm();

const A = U.admin;          // ผู้ดูแลระบบ — แก้คู่มือได้
const H = U.hr;             // ฝ่ายบุคคล — อ่านได้ แก้ไม่ได้
const MARK = 'ZZREF';

const startMaxVersion = (await query('select coalesce(max(id),0)::int id from sop_versions')).rows[0].id;
/** ลำดับและรหัสของกรณีจริงทั้งเล่มตอนเริ่ม — ชุดนี้สลับ/เลื่อน/ย้ายหมวดจริง ปล่อยไว้
 *  คือรหัสของลูกค้าสลับกันค้าง (เคยเกิดแล้ว: PO-1 กลายเป็น PO-3) */
const orderAtStart = (await query('select no, display_no from sop_scenarios order by no')).rows
  .map((r) => `${r.no}:${r.display_no}`).join(' ');
const made = { scenarios: [], reports: [] };

/** เก็บกวาดก่อนเริ่มด้วย — รอบก่อนถ้าตายกลางคันจะมีของค้างไปบวกกับจำนวนต่อหมวด */
async function clean() {
  const list = (await call('/sop/scenarios', { user: A })).data || [];
  for (const x of list.filter((r) => String(r.title_th).startsWith(MARK))) {
    await call(`/sop/scenarios/${x.no}`, { method: 'DELETE', user: A });
  }
  const reps = (await call('/sop/reports', { user: A })).data || [];
  for (const r of reps.filter((x) => String(x.scenario_text).startsWith(MARK))) {
    await call(`/sop/reports/${r.id}`, { method: 'DELETE', user: A });
  }
  await query('delete from sop_versions where id > $1', [startMaxVersion]);
}
await clean();

const mkCase = async (extra = {}) => {
  const r = await call('/sop/scenarios', {
    method: 'POST', user: A,
    body: { module: 'PO', titleTh: `${MARK} กรณีทดสอบ`, problem: 'สถานการณ์ทดสอบ', steps: [{ text: 'ขั้นที่หนึ่ง' }], ...extra },
  });
  if (r.data?.no) made.scenarios.push(r.data.no);
  return r;
};
const one = async (no) => (await call(`/sop/scenarios/${no}`, { user: A })).data;
const dispOf = async (no) => (await one(no))?.display_no;

// ═══════════════════════════════════════════════════════════════════════════
// SOP — คู่มือปฏิบัติงาน
// ═══════════════════════════════════════════════════════════════════════════

suite('SOP 1. เปิดอ่านกรณีเฉพาะ');
{
  const b = await call('/sop/bootstrap', { user: A });
  happy('เปิดคู่มือได้', b.status === 200, `${b.status}`);
  happy('มี 11 หมวดอย่างระบบจริง', b.data.modules.length === 11, `${b.data.modules.length}`);
  happy('จำนวนกรณีรวมตรงกับที่นำเข้ามา', b.data.counts.scenarioTotal === 33, `${b.data.counts.scenarioTotal}`);
  happy('จำนวนผังและรายงานตรง', b.data.counts.flowTotal === 33 && b.data.counts.reports === 24,
    `${b.data.counts.flowTotal}/${b.data.counts.reports}`);
  // ผังมีแค่ 8 หมวด — เมนูของเขาไม่ขึ้นหมวดที่ไม่มีผังเลย
  happy('ผังกระบวนการมีเพียง 8 หมวด (PM/FIN/SE ไม่มีผัง)',
    Object.keys(b.data.counts.flows).length === 8, Object.keys(b.data.counts.flows).join(','));
  happy('หมวดมีคำอธิบายให้ขึ้นหัวรายการได้',
    b.data.modules.every((m) => (m.desc_th || '').trim().length > 0), '');

  const s = await one(1);
  happy('อ่านกรณีที่ 1 ได้ครบ ขั้นตอน/อ้างอิง/วันที่เพิ่ม',
    s && s.steps.length > 0 && s.ref && s.date_added, JSON.stringify({ st: s?.steps?.length, ref: !!s?.ref }));
  happy('กรณีมีเอกสารแนบของตัวเอง', (s.attachments || []).length >= 1, `${s.attachments?.length}`);
  bad('เลขกรณีที่ไม่ใช่ตัวเลข → ไม่พบ (ไม่ใช่ 500)',
    (await call('/sop/scenarios/abc', { user: A })).status === 404, '');
  bad('เลขกรณีที่ไม่มีอยู่ → ไม่พบ', (await call('/sop/scenarios/999999', { user: A })).status === 404, '');
}

suite('SOP 2. ค้นหา — ชื่อ · คำที่อยู่ลึกในขั้นตอน · รหัส · หมวด · อ้างอิง');
{
  const find = async (q) => (await call(`/sop/scenarios?q=${encodeURIComponent(q)}`, { user: A })).data || [];
  const byTitle = await find('ใบขอซื้อ');
  happy('ค้นจากชื่อกรณีเจอ', byTitle.length > 0, `${byTitle.length}`);

  // คำที่อยู่ในขั้นตอนอย่างเดียว ไม่มีในชื่อและไม่มีในปัญหา
  const deep = (await query(
    `select s.no, st.text from sop_scenario_steps st join sop_scenarios s on s.no = st.scenario_no
      where length(st.text) > 20 limit 1`)).rows[0];
  const word = String(deep.text).split(/\s+/).find((w) => w.length >= 6) || '';
  const byStep = word ? await find(word) : [];
  happy(`ค้นคำที่อยู่ลึกในขั้นตอนเจอ ("${word}")`,
    byStep.some((r) => r.no === deep.no), `${byStep.length} รายการ`);

  // ระบบจริงกวาดรหัสแสดงผล หมวด และบรรทัดอ้างอิงด้วย — คนของเขาค้นด้วย "PO-3"
  const byCode = await find('PO-3');
  happy('ค้นด้วยรหัสแสดงผล (PO-3) เจอกรณีนั้น',
    byCode.some((r) => r.display_no === 'PO-3'), byCode.map((r) => r.display_no).join(','));
  const byMod = await find('FIN');
  happy('ค้นด้วยรหัสหมวด (FIN) เจอกรณีในหมวดนั้น', byMod.length > 0, `${byMod.length}`);
  const byRef = await find('บทที่ 4');
  happy('ค้นด้วยข้อความในบรรทัดอ้างอิงเจอ', byRef.length > 0, `${byRef.length}`);

  const none = await find('zzqqxx-ไม่มีคำนี้');
  happy('ค้นไม่เจอได้ผลลัพธ์ว่าง ไม่ใช่ error', none.length === 0, `${none.length}`);
  // หมายเหตุไม่อยู่ในชุดที่ค้น — ตรงกับของเขา
  const note = (await query("select note from sop_scenarios where coalesce(note,'') <> '' limit 1")).rows[0];
  if (note) {
    const w = String(note.note).split(/\s+/).find((x) => x.length >= 8);
    if (w) bad('ไม่ค้นจากหมายเหตุ (เหมือนระบบจริง)', (await find(w)).length === 0, w);
  }
}

suite('SOP 3. กรองหมวด และกรองพร้อมค้นหา');
{
  const inMod = async (m, q) => (await call(`/sop/scenarios?module=${m}${q ? `&q=${encodeURIComponent(q)}` : ''}`, { user: A })).data || [];
  const ap = await inMod('AP');
  happy('หมวด AP มี 16 รายการเท่าเมนูซ้ายของเขา', ap.length === 16, `${ap.length}`);
  happy('ทุกแถวเป็นหมวดนี้เองหรือถูกแท็กเข้ามา',
    ap.every((r) => r.module === 'AP' || (r.extra_modules || []).includes('AP')), '');
  // กรณีที่หมวดนี้เป็นหมวดหลักต้องขึ้นก่อน แล้วจึงกรณีที่ถูกแท็กมา
  const firstTagged = ap.findIndex((r) => r.module !== 'AP');
  const lastPrimary = ap.reduce((acc, r, i) => (r.module === 'AP' ? i : acc), -1);
  happy('กรณีหมวดหลักขึ้นก่อน กรณีที่แท็กมาอยู่ท้าย', firstTagged === -1 || firstTagged > lastPrimary,
    `primary จบที่ ${lastPrimary} tagged เริ่มที่ ${firstTagged}`);
  happy('รหัสแสดงผลของหมวดหลักเรียง 1..n', ap.filter((r) => r.module === 'AP')
    .every((r, i) => r.display_no === `AP-${i + 1}`), ap.filter((r) => r.module === 'AP').map((r) => r.display_no).join(','));

  const both = await inMod('AP', 'PO');
  happy('กรองหมวดกับค้นหาทำงานร่วมกันแบบ "และ" ไม่ใช่แทนกัน',
    both.length > 0 && both.length <= ap.length
      && both.every((r) => r.module === 'AP' || (r.extra_modules || []).includes('AP')),
    `${both.length} ⊂ ${ap.length}`);

  const empty = await inMod('AP', 'zzqqxx');
  happy('กรองแล้วไม่เจออะไรได้รายการว่าง', empty.length === 0, `${empty.length}`);
  const badMod = await inMod('ZZ');
  happy('หมวดที่ไม่มีจริงได้รายการว่าง ไม่ใช่ error', badMod.length === 0, `${badMod.length}`);
}

suite('SOP 4. เพิ่มกรณีใหม่');
{
  const before = (await call('/sop/scenarios?module=PO', { user: A })).data.filter((r) => r.module === 'PO').length;
  const mk = await mkCase();
  happy('เพิ่มกรณีใหม่ได้', mk.status === 201, `${mk.status}`);
  const s = await one(mk.data.no);
  happy('ได้รหัสแสดงผลถัดไปของหมวด', s.display_no === `PO-${before + 1}`, `${s.display_no} (คาด PO-${before + 1})`);
  // ระบบจริงประทับวันที่เพิ่มแบบไทยให้กรณีใหม่ทุกใบ
  happy('ประทับวันที่เพิ่มเป็นวันไทยให้อัตโนมัติ',
    /^\d{1,2} \S+ 25\d\d$/.test(s.date_added || ''), `${s.date_added}`);
  // และเขียนบรรทัดอ้างอิงให้ชี้บทของหมวดที่เลือก (PO = บทที่ 4)
  happy('บรรทัดอ้างอิงชี้บทของหมวดที่เลือก', /บทที่\s*4/.test(s.ref || ''), `${s.ref}`);
  happy('ขั้นตอนถูกบันทึกครบ', s.steps.length === 1 && s.steps[0].text === 'ขั้นที่หนึ่ง', JSON.stringify(s.steps));

  bad('ไม่ใส่ชื่อ → ปฏิเสธ', (await call('/sop/scenarios', { method: 'POST', user: A,
    body: { module: 'PO', titleTh: '  ' } })).status === 400, '');
  bad('ไม่ใส่หมวด → ปฏิเสธ', (await call('/sop/scenarios', { method: 'POST', user: A,
    body: { titleTh: `${MARK} ไม่มีหมวด` } })).status === 400, '');
  bad('หมวดที่ไม่มีในระบบ → ปฏิเสธ', (await call('/sop/scenarios', { method: 'POST', user: A,
    body: { module: 'ZZ', titleTh: `${MARK} หมวดผิด` } })).status === 400, '');
}

suite('SOP 5. แก้ไข · เพิ่ม/ลบเอกสารแนบ');
{
  const no = made.scenarios[0];
  const up = await call(`/sop/scenarios/${no}`, { method: 'PATCH', user: A,
    body: { titleTh: `${MARK} แก้ชื่อแล้ว`, note: 'ข้อควรระวัง', steps: [{ text: 'หนึ่ง' }, { text: 'ย่อย', style: 'sub' }] } });
  happy('แก้ไขกรณีได้', up.status === 200, `${up.status}`);
  const s = await one(no);
  happy('ชื่อและหมายเหตุเปลี่ยนจริง', s.title_th.endsWith('แก้ชื่อแล้ว') && s.note === 'ข้อควรระวัง', '');
  happy('ระดับของขั้นตอนถูกเก็บไว้', s.steps.length === 2 && s.steps[1].style === 'sub', JSON.stringify(s.steps));

  // เอกสารแนบ: วางลิงก์ Drive แล้วต้องอ่านกลับได้ตามลำดับ
  await call(`/sop/scenarios/${no}`, { method: 'PATCH', user: A,
    body: { attachments: [
      { label: 'SOP ทดสอบ', url: 'https://drive.google.com/file/d/1AAAAAAAAAAAAAAAAAAAAAA/view' },
      { label: null, url: 'https://example.com/a.pdf' },
    ] } });
  const withAtt = await one(no);
  happy('เพิ่มเอกสารแนบได้สองไฟล์ตามลำดับ',
    withAtt.attachments.length === 2 && withAtt.attachments[0].label === 'SOP ทดสอบ',
    JSON.stringify(withAtt.attachments));
  happy('ไฟล์ที่ไม่ตั้งชื่อเก็บชื่อเป็นค่าว่าง (หน้าจอขึ้นว่า "เอกสารแนบ")',
    !withAtt.attachments[1].label, JSON.stringify(withAtt.attachments[1]));
  await call(`/sop/scenarios/${no}`, { method: 'PATCH', user: A, body: { attachments: [] } });
  happy('ลบเอกสารแนบออกหมดได้', (await one(no)).attachments.length === 0, '');
  bad('ลิงก์ที่ไม่ใช่ URL → ปฏิเสธ', (await call(`/sop/scenarios/${no}`, { method: 'PATCH', user: A,
    body: { attachments: [{ url: 'ไม่ใช่ลิงก์' }] } })).status === 400, '');
}

suite('SOP 6. ย้ายหมวด — รหัสและบรรทัดอ้างอิงต้องเปลี่ยนตาม');
{
  const no = made.scenarios[0];
  const poBefore = (await call('/sop/scenarios?module=PO', { user: A })).data.filter((r) => r.module === 'PO').length;
  const icBefore = (await call('/sop/scenarios?module=IC', { user: A })).data.filter((r) => r.module === 'IC').length;
  const mv = await call(`/sop/scenarios/${no}`, { method: 'PATCH', user: A, body: { module: 'IC' } });
  happy('ย้ายหมวดได้', mv.status === 200, `${mv.status}`);
  const s = await one(no);
  happy('ได้รหัสท้ายสุดของหมวดใหม่', s.display_no === `IC-${icBefore + 1}`, `${s.display_no}`);
  // ของเขาเขียนเลขบทในบรรทัดอ้างอิงใหม่ เพราะหมวดของเขาอ่านจากบรรทัดนี้
  happy('บรรทัดอ้างอิงถูกเขียนใหม่เป็นบทของหมวดใหม่ (IC = บทที่ 5)',
    /บทที่\s*5/.test(s.ref || '') && !/บทที่\s*4/.test(s.ref || ''), `${s.ref}`);
  const poAfter = (await call('/sop/scenarios?module=PO', { user: A })).data.filter((r) => r.module === 'PO');
  happy('หมวดเดิมเรียงรหัสใหม่ไม่มีเลขขาด',
    poAfter.length === poBefore - 1 && poAfter.every((r, i) => r.display_no === `PO-${i + 1}`),
    poAfter.map((r) => r.display_no).join(','));
  await call(`/sop/scenarios/${no}`, { method: 'PATCH', user: A, body: { module: 'PO' } });
}

suite('SOP 7. สลับลำดับในหมวด — รหัสต้องสลับกัน');
{
  const mine = made.scenarios[0];
  const second = await mkCase({ titleTh: `${MARK} กรณีที่สอง` });
  const a = await dispOf(mine);
  const b = await dispOf(second.data.no);
  const sw = await call(`/sop/scenarios/${mine}/swap`, { method: 'POST', user: A, body: { swapWith: b } });
  happy(`สลับ ${a} ↔ ${b} ได้`, sw.status === 200, `${sw.status} ${JSON.stringify(sw.data || sw)}`);
  const a2 = await dispOf(mine);
  const b2 = await dispOf(second.data.no);
  happy('รหัสของสองใบสลับกันจริง', a2 === b && b2 === a, `${a}→${a2} · ${b}→${b2}`);
  // กรณีอื่นในหมวดไม่ขยับ
  const po = (await call('/sop/scenarios?module=PO', { user: A })).data.filter((r) => r.module === 'PO');
  happy('หมวดยังเรียงรหัส 1..n ต่อเนื่อง', po.every((r, i) => r.display_no === `PO-${i + 1}`),
    po.map((r) => r.display_no).join(','));

  bad('สลับกับตัวเอง → ปฏิเสธ', (await call(`/sop/scenarios/${mine}/swap`, { method: 'POST', user: A,
    body: { swapWith: a2 } })).status === 400, '');
  bad('รหัสที่ไม่มีจริง → ปฏิเสธพร้อมบอกรหัส', await (async () => {
    const r = await call(`/sop/scenarios/${mine}/swap`, { method: 'POST', user: A, body: { swapWith: 'ZZ-99' } });
    return r.status === 400 && String(r.error || '').includes('ZZ-99');
  })(), '');
  bad('ไม่เลือกคู่ → ปฏิเสธ', (await call(`/sop/scenarios/${mine}/swap`, { method: 'POST', user: A,
    body: {} })).status === 400, '');
  // ระบบเราเรียงลำดับรายหมวด สลับข้ามหมวดจึงไม่มีความหมาย และต้องบอกเหตุผล
  const ic = (await call('/sop/scenarios?module=IC', { user: A })).data.find((r) => r.module === 'IC');
  bad('สลับข้ามหมวด → ปฏิเสธพร้อมเหตุผล', await (async () => {
    const r = await call(`/sop/scenarios/${mine}/swap`, { method: 'POST', user: A, body: { swapWith: ic.display_no } });
    return r.status === 400 && String(r.error || '').includes('หมวดเดียวกัน');
  })(), '');

  // เลื่อนขึ้น/ลงของเดิมยังต้องทำงาน และสุดขอบต้องบอกว่าไม่ขยับ
  const mv = await call(`/sop/scenarios/${mine}/move`, { method: 'POST', user: A, body: { direction: 'down' } });
  happy('เลื่อนลงได้', mv.status === 200, `${mv.status}`);
  const first = (await call('/sop/scenarios?module=PO', { user: A })).data.find((r) => r.module === 'PO');
  const edge = await call(`/sop/scenarios/${first.no}/move`, { method: 'POST', user: A, body: { direction: 'up' } });
  happy('อยู่สุดขอบแล้วบอกว่าไม่ขยับ', edge.status === 200 && edge.data.moved === false, JSON.stringify(edge.data));
  bad('ทิศทางที่ไม่รู้จัก → ปฏิเสธ', (await call(`/sop/scenarios/${mine}/move`, { method: 'POST', user: A,
    body: { direction: 'sideways' } })).status === 400, '');
}

suite('SOP 8. ลบกรณี — กรณีที่อยู่หลังจากนั้นเลื่อนเลขขึ้น');
{
  const po = (await call('/sop/scenarios?module=PO', { user: A })).data.filter((r) => r.module === 'PO');
  const victim = po.find((r) => String(r.title_th).startsWith(MARK));
  const del = await call(`/sop/scenarios/${victim.no}`, { method: 'DELETE', user: A });
  happy('ลบได้', del.status === 200, `${del.status}`);
  made.scenarios = made.scenarios.filter((n) => n !== victim.no);
  const after = (await call('/sop/scenarios?module=PO', { user: A })).data.filter((r) => r.module === 'PO');
  happy('รหัสในหมวดเรียงใหม่ไม่มีเลขขาด', after.every((r, i) => r.display_no === `PO-${i + 1}`),
    after.map((r) => r.display_no).join(','));
  bad('ลบซ้ำ → ไม่พบ', (await call(`/sop/scenarios/${victim.no}`, { method: 'DELETE', user: A })).status === 404, '');
}

suite('SOP 9. วิธีเรียก Report — เพิ่ม แก้ ลบ');
{
  const before = (await call('/sop/reports', { user: A })).data.length;
  const mk = await call('/sop/reports', { method: 'POST', user: A,
    body: { scenarioText: `${MARK} ตรวจสอบอะไรบางอย่าง`, reportPath: 'AP -> Report -> 9.9.9' } });
  happy('เพิ่มรายการรายงานได้', mk.status === 201, `${mk.status}`);
  if (mk.data?.id) made.reports.push(mk.data.id);
  happy('เลขรายการต่อจากรายการสุดท้าย', Number(mk.data.case_no) === before + 1, `${mk.data.case_no} (มี ${before})`);
  const up = await call(`/sop/reports/${mk.data.id}`, { method: 'PATCH', user: A,
    body: { reportPath: 'AP -> Report -> 1.1.1' } });
  happy('แก้ไขรายการได้', up.status === 200 && up.data.report_path.endsWith('1.1.1'), `${up.status}`);
  bad('ไม่กรอกข้อความ → ปฏิเสธ', (await call('/sop/reports', { method: 'POST', user: A,
    body: { scenarioText: '  ', reportPath: 'x' } })).status === 400, '');
  bad('ไม่กรอกเมนู → ปฏิเสธ', (await call('/sop/reports', { method: 'POST', user: A,
    body: { scenarioText: `${MARK} ไม่มีเมนู` } })).status === 400, '');
  const del = await call(`/sop/reports/${mk.data.id}`, { method: 'DELETE', user: A });
  happy('ลบรายการได้', del.status === 200, `${del.status}`);
  made.reports = made.reports.filter((x) => x !== mk.data.id);
  bad('ลบรายการที่ไม่มี → ไม่พบ', (await call('/sop/reports/99999999', { method: 'DELETE', user: A })).status === 404, '');
}

suite('SOP 10. แก้ไขหัวเอกสาร');
{
  const before = (await call('/sop/bootstrap', { user: A })).data.meta;
  const up = await call('/sop/meta', { method: 'PATCH', user: A, body: { version: `${MARK}-v9` } });
  happy('แก้ฉบับเอกสารได้', up.status === 200 && up.data.version === `${MARK}-v9`, `${up.status}`);
  const seen = (await call('/sop/bootstrap', { user: A })).data.meta;
  happy('ค่าที่แก้ขึ้นบนหน้าจอทุกคน', seen.version === `${MARK}-v9`, seen.version);
  happy('ช่องที่ไม่ได้ส่งมาไม่ถูกล้างทิ้ง', seen.title === before.title && seen.scope === before.scope, '');
  bad('ส่งข้อมูลเปล่า → ปฏิเสธ', (await call('/sop/meta', { method: 'PATCH', user: A, body: {} })).status === 400, '');
  await call('/sop/meta', { method: 'PATCH', user: A, body: { version: before.version } });
  happy('คืนค่าฉบับเดิมแล้ว',
    (await call('/sop/bootstrap', { user: A })).data.meta.version === before.version, '');
}

suite('SOP 11. สิทธิ์ — คนไม่มีสิทธิ์แก้ไขต้องถูกปฏิเสธที่ API');
{
  const b = await call('/sop/bootstrap', { user: H });
  happy('ฝ่ายบุคคลอ่านคู่มือได้', b.status === 200, `${b.status}`);
  happy('และหน้าจอถูกบอกว่าแก้ไขไม่ได้ (ปุ่มจะไม่ขึ้น)', b.data.canEdit === false, `${b.data.canEdit}`);
  const no = made.scenarios[0];
  bad('เพิ่มกรณีไม่ได้', (await call('/sop/scenarios', { method: 'POST', user: H,
    body: { module: 'PO', titleTh: `${MARK} ห้าม` } })).status === 403, '');
  bad('แก้ไขกรณีไม่ได้', (await call(`/sop/scenarios/${no}`, { method: 'PATCH', user: H,
    body: { titleTh: 'x' } })).status === 403, '');
  bad('ลบกรณีไม่ได้', (await call(`/sop/scenarios/${no}`, { method: 'DELETE', user: H })).status === 403, '');
  bad('สลับลำดับไม่ได้', (await call(`/sop/scenarios/${no}/swap`, { method: 'POST', user: H,
    body: { swapWith: 'PO-1' } })).status === 403, '');
  bad('เลื่อนลำดับไม่ได้', (await call(`/sop/scenarios/${no}/move`, { method: 'POST', user: H,
    body: { direction: 'up' } })).status === 403, '');
  bad('แก้หัวเอกสารไม่ได้', (await call('/sop/meta', { method: 'PATCH', user: H,
    body: { version: 'x' } })).status === 403, '');
  bad('เพิ่มรายการรายงานไม่ได้', (await call('/sop/reports', { method: 'POST', user: H,
    body: { scenarioText: 'x', reportPath: 'y' } })).status === 403, '');
  bad('เปิดประวัติเวอร์ชันไม่ได้', (await call('/sop/versions', { user: H })).status === 403, '');
  bad('ไม่ล็อกอินอ่านไม่ได้', (await call('/sop/bootstrap')).status === 401, '');
}

suite('SOP 12. ทุกการแก้ไขถูกเก็บเป็นเวอร์ชันไว้ก่อน');
{
  const notes = (await call('/sop/versions', { user: A })).data.map((v) => v.note);
  const wanted = ['เพิ่มกรณีศึกษาใหม่', 'แก้ไขเนื้อหากรณีศึกษา', 'สลับตำแหน่งกรณีศึกษา',
    'สลับลำดับกรณีศึกษา', 'เพิ่มรายการรายงาน', 'แก้ไขหัวเอกสาร'];
  for (const w of wanted) happy(`มีเวอร์ชันของ "${w}"`, notes.includes(w), '');
}

// ═══════════════════════════════════════════════════════════════════════════
// แผนผังระบบ
// ═══════════════════════════════════════════════════════════════════════════

suite('MAP 1. ข้อมูลที่หน้าจอต้องใช้วาดผังและทะเบียน');
{
  const b = await call('/sysmap/bootstrap', { user: A });
  happy('เปิดแผนผังได้', b.status === 200, `${b.status}`);
  happy('10 เลน · 79 กล่องงาน อย่างระบบจริง',
    b.data.counts.lanes === 10 && b.data.counts.nodes === 79,
    `${b.data.counts.lanes}/${b.data.counts.nodes}`);
  happy('7 แผนก และเอกสารหน้างาน 7 ใบ',
    b.data.depts.length === 7 && b.data.counts.docNodes === 7,
    `${b.data.depts.length}/${b.data.counts.docNodes}`);
  happy('กล่องงานทุกใบมีหน้าที่ที่เกี่ยวข้องผูกไว้ (ชิปต้องมีให้กด)',
    new Set((b.data.nodeFns || []).map((r) => r.node_id)).size === b.data.counts.nodes,
    `${new Set((b.data.nodeFns || []).map((r) => r.node_id)).size}`);

  const fns = await call('/sysmap/functions', { user: A });
  happy('ทะเบียนฟังก์ชัน 158 แถว', fns.data.length === 158, `${fns.data.length}`);
  happy('มี 8 กลุ่ม (7 แผนก + ปฏิบัติการหน้างาน)',
    new Set(fns.data.map((r) => r.dept)).size === 8, [...new Set(fns.data.map((r) => r.dept))].join(','));
  // ตัวเลขที่บรรทัดสรุปของเขาโชว์: จุดที่คนนอกกรอก และงานที่ทำหน้างาน
  happy('มีจุดที่คนนอกเป็นผู้กรอกติดธงไว้', fns.data.filter((r) => r.external_entry).length >= 18,
    `${fns.data.filter((r) => r.external_entry).length}`);
  happy('มีงานที่ทำที่หน้างานติดธงไว้', fns.data.filter((r) => r.at_site).length >= 18,
    `${fns.data.filter((r) => r.at_site).length}`);
  bad('ทุกรหัสในชิปหน้าที่มีอยู่จริงในทะเบียน', await (async () => {
    const codes = new Set(fns.data.map((r) => r.code));
    return (b.data.nodeFns || []).every((r) => codes.has(r.code));
  })(), '');

  const ai = await call('/sysmap/ai', { user: A });
  happy('รายการโอกาสใช้ AI ครบ 35 รายการ', ai.data.length >= 35, `${ai.data.length}`);
  happy('ทุกรายการมีระดับผลกระทบและความยากที่หน้าจอเรียงได้',
    ai.data.every((r) => ['High', 'Medium', 'Low'].includes(r.impact)
      && ['High', 'Medium', 'Low'].includes(r.effort)), '');
  bad('ไม่มีข้อเสนอ AI ที่ผูกกับกล่องงานที่ไม่มีจริง', await (async () => {
    const ids = new Set(b.data.nodes.map((n) => n.id));
    return ai.data.every((r) => !r.node_id || ids.has(r.node_id));
  })(), '');
}

suite('MAP 2. สิทธิ์ — ทุกคนดูได้ หน้าจอแก้ไขปิดไว้');
{
  happy('ฝ่ายบุคคลเปิดดูได้', (await call('/sysmap/bootstrap', { user: H })).status === 200, '');
  happy('และไม่ได้สิทธิ์แก้ไข', (await call('/sysmap/bootstrap', { user: H })).data.canEdit === false, '');
  bad('แม้ผู้ดูแลก็แก้จากหน้าจอไม่ได้ (เป็นข้อมูลอ้างอิง)',
    (await call('/sysmap/nodes/n-pr', { method: 'PATCH', user: A, body: { label_en: 'x' } })).status === 404, '');
  bad('ไม่ล็อกอินเปิดไม่ได้', (await call('/sysmap/functions')).status === 401, '');
}

// ═══════════════════════════════════════════════════════════════════════════
// พอร์ทัล
// ═══════════════════════════════════════════════════════════════════════════

suite('PORTAL 1. วันเกิดที่กำลังจะถึง · ลาวันนี้');
{
  const r = await call('/portal/today', { user: A });
  happy('เปิดกล่องวันนี้ได้', r.status === 200, `${r.status}`);
  const bd = (r.data.birthdays || []).map((x) => ({ ...x, days: Number(x.days) }));
  happy('แสดงสามคนที่ใกล้ที่สุด เท่าที่ระบบจริงแสดง', bd.length === 3, `${bd.length}`);
  happy('เรียงจากใกล้ไปไกล', bd.every((x, i) => i === 0 || bd[i - 1].days <= x.days), bd.map((x) => x.days).join(','));
  happy('ไม่จำกัดช่วงวัน จึงข้ามปีได้เอง', bd.every((x) => x.days >= 0 && x.days <= 366), bd.map((x) => x.days).join(','));
  bad('ไม่ส่งวันเกิดจริง (ปีเกิด = อายุ) ออกไป',
    bd.every((x) => !('birth_date' in x) && !('birth_month' in x)), Object.keys(bd[0] || {}).join(','));
  happy('ทุกแถวมีชื่อให้แสดง ไม่มีบรรทัดเปล่า', bd.every((x) => String(x.full_name || '').trim()), '');
  happy('ลาวันนี้เป็นรายการ (ว่างได้ และหน้าจอบอกว่าไม่มี)', Array.isArray(r.data.onLeave), '');
  bad('ไม่ส่งเหตุผลการลาออกไป',
    (r.data.onLeave || []).every((x) => !('reason' in x)), '');
  bad('ไม่ล็อกอินเปิดไม่ได้', (await call('/portal/today')).status === 401, '');
}

suite('PORTAL 2. ประกาศ — มี/ไม่มี/หมดอายุ/ปักหมุด');
{
  const feed = await call('/announcements', { user: H });
  happy('พนักงานอ่านประกาศได้', feed.status === 200 && Array.isArray(feed.data), `${feed.status}`);
  happy('ที่ปักหมุดขึ้นก่อน', (() => {
    const p = feed.data.findIndex((a) => !a.pinned);
    return p === -1 || !feed.data.slice(p).some((a) => a.pinned);
  })(), feed.data.map((a) => (a.pinned ? 'P' : '-')).join(''));
  happy('ทุกฉบับที่ส่งมายังไม่หมดอายุและถึงเวลาแสดงแล้ว',
    feed.data.every((a) => a.is_active
      && (!a.starts_at || new Date(a.starts_at) <= new Date())
      && (!a.ends_at || new Date(a.ends_at) >= new Date())), '');
  bad('พนักงานเปิดรายการจัดการ (รวมฉบับที่ปิดอยู่) ไม่ได้',
    (await call('/announcements/all', { user: H })).status === 403, '');
  bad('พนักงานสร้างประกาศไม่ได้', (await call('/announcements', { method: 'POST', user: H,
    body: { title: `${MARK} ห้าม` } })).status === 403, '');
  bad('วันเริ่มหลังวันสิ้นสุด → ปฏิเสธ', (await call('/announcements', { method: 'POST', user: A,
    body: { title: `${MARK} ช่วงเวลาผิด`, startsAt: '2026-10-02T00:00:00+07:00', endsAt: '2026-10-01T00:00:00+07:00' } })).status === 400, '');
  bad('รหัสประกาศที่ไม่ใช่ UUID → ไม่พบ (ไม่ใช่ 500)',
    (await call('/announcements/abc', { method: 'DELETE', user: A })).status === 404, '');
}

suite('PORTAL 3. กล่องช่วยเหลือ — ไม่กรอกต้องไม่ผ่าน');
{
  // ทางที่ส่งสำเร็จไม่ยิงในชุดนี้ เพราะปลายทางเป็นอีเมลผู้ดูแลตัวจริง
  bad('ไม่กรอกข้อความ → ปฏิเสธ',
    (await call('/support', { method: 'POST', user: H, body: { area: 'SOP', message: '   ' } })).status === 400, '');
  bad('ไม่ส่งข้อความมาเลย → ปฏิเสธ',
    (await call('/support', { method: 'POST', user: H, body: { area: 'SOP' } })).status === 400, '');
  bad('ข้อความยาวเกินที่รับไหว → ปฏิเสธ',
    (await call('/support', { method: 'POST', user: H, body: { message: 'x'.repeat(2100) } })).status === 400, '');
  bad('ไม่ล็อกอินส่งไม่ได้', (await call('/support', { method: 'POST', body: { message: 'hi' } })).status === 401, '');
}

// ═══════════════════════════════════════════════════════════════════════════
suite('เก็บกวาด');
{
  await clean();
  const left = ((await call('/sop/scenarios', { user: A })).data || [])
    .filter((r) => String(r.title_th).startsWith(MARK));
  happy('ไม่มีกรณีทดสอบค้างไว้', left.length === 0, left.map((r) => r.display_no).join(','));
  const reps = ((await call('/sop/reports', { user: A })).data || [])
    .filter((r) => String(r.scenario_text).startsWith(MARK));
  happy('ไม่มีรายการรายงานทดสอบค้างไว้', reps.length === 0, `${reps.length}`);
  const anns = ((await call('/announcements/all', { user: A })).data || [])
    .filter((a) => String(a.title).startsWith(MARK));
  for (const a of anns) await call(`/announcements/${a.id}`, { method: 'DELETE', user: A });
  happy('ไม่มีประกาศทดสอบค้างไว้', anns.length === 0, `${anns.length}`);
  const vers = (await query('select count(*)::int n from sop_versions where id > $1', [startMaxVersion])).rows[0].n;
  happy('ประวัติเวอร์ชันกลับไปเท่าตอนเริ่ม (ไม่แตะฉบับสำรองจริง)', vers === 0, `${vers}`);
  const total = (await call('/sop/bootstrap', { user: A })).data.counts.scenarioTotal;
  happy('จำนวนกรณีในคู่มือกลับมาเป็น 33', total === 33, `${total}`);
  const orderNow = (await query('select no, display_no from sop_scenarios order by no')).rows
    .map((r) => `${r.no}:${r.display_no}`).join(' ');
  bad('ลำดับและรหัสของกรณีจริงทั้งเล่มไม่ถูกเปลี่ยนทิ้งไว้', orderNow === orderAtStart,
    orderNow === orderAtStart ? '' : 'ลำดับเปลี่ยนไป — ต้องสลับกลับก่อนจบ');
}

process.exit(report(`${ROOT}/refmodules-flows.json`) ? 1 : 0);
