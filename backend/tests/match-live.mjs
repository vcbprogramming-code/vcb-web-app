/**
 * เทียบกับระบบจริงของลูกค้า — สิ่งที่เพิ่งเติมเข้ามาต้องทำงานจริง
 *
 * ทุกข้อในชุดนี้มาจากการเปิดเว็บ Apps Script ที่บริษัทใช้อยู่แล้วเห็นว่าเขามี
 * แต่เราไม่มี ไม่ได้มาจากการเดาว่าน่าจะมีอะไร — จึงตั้งชื่อข้อตามสิ่งที่เห็น
 * บนหน้าจอเขา ไม่ใช่ตามชื่อฟังก์ชันของเรา
 */
import { call, suite, happy, bad, report, U, warm, query } from './harness.mjs';

await warm();
const A = U.admin;
const MARK = 'ZZMATCH';

const clean = async () => {
  await query(`delete from credit_ledger where ref like $1`, [`${MARK}%`]);
  await query(`delete from facilities where notes like $1`, [`%${MARK}%`]);
  await query(`delete from credit_category_caps where note = $1`, [MARK]);
  await query(`delete from cash_plans where note like $1`, [`${MARK}%`]);
  await query(`delete from work_types where name like $1`, [`${MARK}%`]);
};
await clean();
const project = (await query('select id, code from projects order by code limit 1')).rows[0];

// ── 1. คู่มือ SOP ─────────────────────────────────────────────────────────
suite('1. เมนูเรียกรายงานครบ 23 รายการเท่าระบบจริง');
{
  const rows = (await query('select case_no, report_path from sop_reports order by case_no')).rows;
  happy('มี 23 รายการ', rows.length === 23, `${rows.length}`);
  happy('ลำดับที่ 13 คือ Stock Card Report',
    /IC -> Report -> 2\.2/.test(rows.find((r) => r.case_no === 13)?.report_path || ''), '');
  happy('ลำดับที่ 23 คือ Tracking Billing Subcontractor',
    /OF -> Report -> 5\.1/.test(rows.find((r) => r.case_no === 23)?.report_path || ''), '');
  const nos = rows.map((r) => r.case_no);
  bad('เลขลำดับไม่ซ้ำและไม่ข้าม', new Set(nos).size === 23 && Math.max(...nos) === 23, nos.join(','));
}

// ── 2. วงเงินสินเชื่อ: ปลด/คืนวงเงิน ─────────────────────────────────────
suite('2. ใส่ยอดติดลบเพื่อปลดวงเงินได้ แต่ปลดเกินไม่ได้');
{
  const f = await call('/credit/facilities', { method: 'POST', user: A,
    body: { projectId: project.id, facilityNo: 1, limit: 1000000, notes: `${MARK} ทดสอบ` } });
  happy('สร้างวงเงินทดสอบได้', f.status === 201, `${f.status}`);
  const fid = f.data.id;
  const add = (amount, ref, extra = {}) => call('/credit/ledger', { method: 'POST', user: A,
    body: { facilityId: fid, amount, ref: `${MARK} ${ref}`, ...extra } });
  const view = async () => ((await call(`/credit/facilities?projectId=${project.id}`, { user: A })).data || [])
    .find((x) => x.id === fid);

  happy('เบิกใช้ 400,000 ได้', (await add(400000, 'เบิก', { costCategory: 'เหล็ก', counterparty: 'ธนาคารกรุงเทพ' })).status === 201, '');
  const afterDraw = await view();
  happy('ยอดใช้ไปขึ้นเป็น 400,000', Number(afterDraw.used) === 400000, `${afterDraw.used}`);

  // ปลดคืนในหมวดเดิม เพื่อให้ยอดของหมวดนั้นลดตามจริง (หน้าสรุปค่าใช้จ่ายอ่านจากหมวด)
  const rel = await add(-150000, 'ปลดคืน', { costCategory: 'เหล็ก' });
  happy('ใส่ยอดติดลบเพื่อปลดวงเงินได้', rel.status === 201, `${rel.status}`);
  const afterRel = await view();
  happy('ยอดใช้ไปลดลงเหลือ 250,000', Number(afterRel.used) === 250000, `${afterRel.used}`);
  happy('ยอดคงเหลือเพิ่มกลับเป็น 750,000', Number(afterRel.available) === 750000, `${afterRel.available}`);

  const over = await add(-900000, 'ปลดเกิน');
  bad('ปลดเกินกว่าที่ใช้ไปจริงถูกปฏิเสธ', over.status >= 400, `${over.status}`);
  bad('ใส่ศูนย์ถูกปฏิเสธ', (await add(0, 'ศูนย์')).status >= 400, '');
  const last = await view();
  bad('ยอดคงเหลือไม่เกินวงเงินที่ธนาคารให้', Number(last.available) <= Number(last.limit), `${last.available}`);

  happy('เก็บรายละเอียด/คู่ค้าและหมวดค่าใช้จ่ายไว้จริง', await (async () => {
    const l = (await call(`/credit/ledger?facilityId=${fid}`, { user: A })).data || [];
    const row = l.find((x) => String(x.ref).includes('เบิก'));
    return row?.counterparty === 'ธนาคารกรุงเทพ' && row?.cost_category === 'เหล็ก';
  })(), '');
}

// ── 3. สรุปค่าใช้จ่ายและงบประมาณ ─────────────────────────────────────────
suite('3. สรุปค่าใช้จ่ายเทียบงบต่อหมวดได้');
{
  happy('ทะเบียนหมวดค่าใช้จ่ายมีให้เลือก',
    ((await call('/credit/cost-categories', { user: A })).data || []).includes('เหล็ก'), '');
  const cap = await call('/credit/category-caps', { method: 'PUT', user: A,
    body: { projectId: project.id, costCategory: 'เหล็ก', cap: 100000, note: MARK } });
  happy('ตั้งงบประมาณต่อหมวดได้', cap.status === 200, `${cap.status}`);

  const sum = (await call(`/credit/cost-summary?projectId=${project.id}`, { user: A })).data;
  const g = (sum.projects || [])[0];
  const line = (g?.lines || []).find((l) => l.cost_category === 'เหล็ก');
  happy('หน้าสรุปเห็นยอดที่เบิกไปในหมวดนั้น', Number(line?.spent) === 250000, `${line?.spent}`);
  happy('เทียบกับงบที่ตั้งไว้ให้', Number(line?.cap) === 100000, `${line?.cap}`);
  happy('คิดเปอร์เซ็นต์การใช้ให้', Number(line?.pct) === 250, `${line?.pct}`);
  happy('บอกว่าเกินงบ', line?.over === true, `${line?.over}`);
  happy('นับจำนวนหมวดที่เกินงบไว้ที่หัวเรื่อง', sum.overCount >= 1, `${sum.overCount}`);
}

// ── 4. แผน / จริง / ผลต่าง ───────────────────────────────────────────────
suite('4. แผนการเงินกับหักค่างานตามจริงแยกฉบับ และเทียบผลต่างได้');
{
  const month = '2569-01'.replace('2569', String(new Date().getFullYear()));
  const mk = (kind, income) => call('/credit/cash-plan', { method: 'POST', user: A,
    body: { projectId: project.id, month, period: '1', income, available: income, note: `${MARK} ${kind}`, kind } });
  happy('บันทึกฉบับแผนได้', (await mk('plan', 1000000)).status === 201, '');
  happy('บันทึกฉบับจริงได้', (await mk('actual', 850000)).status === 201, '');

  const plan = (await call(`/credit/cash-plan?projectId=${project.id}&month=${month}&kind=plan`, { user: A })).data || [];
  const actual = (await call(`/credit/cash-plan?projectId=${project.id}&month=${month}&kind=actual`, { user: A })).data || [];
  bad('สองฉบับไม่ทับกัน', plan.length === 1 && actual.length === 1, `${plan.length}/${actual.length}`);
  happy('ฉบับแผนเก็บยอดตามแผน', Number(plan[0]?.income) === 1000000, `${plan[0]?.income}`);
  happy('ฉบับจริงเก็บยอดจริง', Number(actual[0]?.income) === 850000, `${actual[0]?.income}`);

  const v = (await call(`/credit/cash-plan/variance?projectId=${project.id}&month=${month}`, { user: A })).data || [];
  const row = v[0];
  happy('หน้าผลต่างจับคู่สองฉบับได้', Boolean(row?.has_plan && row?.has_actual), JSON.stringify(row || {}).slice(0, 60));
  happy('คำนวณผลต่างถูก (จริง − แผน = −150,000)', Number(row?.income?.diff) === -150000, `${row?.income?.diff}`);
}

// ── 5. ตัวกรองที่ระบบจริงมี ──────────────────────────────────────────────
suite('5. ตัวกรองครบใน 7 วัน และตัวกรองบริษัท');
{
  for (const due of ['due7', 'thisMonth', 'nextMonth', 'overdue']) {
    const r = await call(`/credit/ledger?due=${due}`, { user: A });
    happy(`กรอง "${due}" ได้ ไม่ล้ม`, r.status === 200, `${r.status}`);
  }
  happy('กรองตามบริษัทได้', (await call('/credit/facilities?company=ไม่มีบริษัทนี้', { user: A })).status === 200, '');
}

// ── 6. บันทึกงาน: ส่งออก/นำเข้า และย้ายพนักงาน ───────────────────────────
suite('6. ทะเบียนงานออก-เข้าเป็น Excel ได้');
{
  for (const [path, label] of [
    ['/performance/export/activities.xlsx', 'ทะเบียนงาน'],
    ['/performance/export/cost-categories.xlsx', 'หมวดต้นทุน'],
  ]) {
    const r = await call(path, { user: A, raw: true });
    const buf = Buffer.from(await r.arrayBuffer());
    happy(`ส่งออก${label}เป็นไฟล์ Excel ได้`, r.status === 200 && buf.subarray(0, 2).toString() === 'PK', `${r.status} · ${buf.length} ไบต์`);
  }
  const unit = (await query('select code from units where code is not null limit 1')).rows[0];
  const p2 = (n) => String(n).padStart(2, '0'); const d = new Date();
  const r = await call(`/performance/export/entries.xlsx?site=${encodeURIComponent(unit.code)}&month=${d.getFullYear()}-${p2(d.getMonth() + 1)}`,
    { user: A, raw: true });
  const buf = Buffer.from(await r.arrayBuffer());
  happy('ส่งออกตารางลงบันทึกของเดือนนี้ได้', r.status === 200 && buf.subarray(0, 2).toString() === 'PK', `${r.status}`);
}

// ── 7. รหัสกิจกรรมตรงกับระบบจริง ─────────────────────────────────────────
suite('7. ทะเบียนงานเหลือ 44 รหัสเท่าระบบจริง');
{
  const active = (await query('select code from work_types where is_active order by code')).rows.map((r) => r.code);
  happy('รหัสที่เปิดใช้งานมี 44 รหัส', active.length === 44, `${active.length}`);
  bad('ไม่มี Z-4 ถึง Z-6 ที่ระบบเขาไม่มี',
    !active.some((c) => ['Z-4', 'Z-5', 'Z-6'].includes(c)), active.filter((c) => c.startsWith('Z')).join(','));
}

// ── 8. หน้าหลัก: ใครลาวันนี้ ─────────────────────────────────────────────
suite('8. หน้าหลักบอกได้ว่าวันนี้ใครลา');
{
  const r = await call('/portal/today', { user: A });
  happy('เรียกข้อมูลของวันนี้ได้', r.status === 200, `${r.status}`);
  happy('ตอบทั้งรายชื่อคนลาและวันเกิด',
    Array.isArray(r.data?.onLeave) && Array.isArray(r.data?.birthdays), JSON.stringify(r.data || {}).slice(0, 60));
}

// ── 9. เก็บกวาด ──────────────────────────────────────────────────────────
suite('9. ไม่ทิ้งข้อมูลทดสอบไว้');
{
  await clean();
  const left = (await query(`select count(*)::int n from facilities where notes like $1`, [`%${MARK}%`])).rows[0].n
    + (await query(`select count(*)::int n from cash_plans where note like $1`, [`${MARK}%`])).rows[0].n;
  happy('ลบข้อมูลทดสอบหมดแล้ว', left === 0, `${left}`);
}

process.exit(report() ? 1 : 0);
