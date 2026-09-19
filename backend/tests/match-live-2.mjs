/**
 * เทียบกับระบบจริงของลูกค้า รอบสอง — ป้อนข้อมูลชุดเดียวกันเข้าทั้งสองระบบแล้วเทียบผล
 *
 * ทุกข้อในชุดนี้มาจากความต่างที่เจอตอนเอาข้อมูลจริงของลูกค้า (วงเงิน 48 ก้อน,
 * บันทึกงานเดือนสิงหาคม 7,013 ช่อง) กับข้อมูลทดสอบชุดเดียวกันไปเทียบกับระบบ
 * Apps Script ที่เขาใช้อยู่ — ชื่อข้อจึงบอกพฤติกรรมของระบบเขา ไม่ใช่ชื่อฟังก์ชันเรา
 */
import ExcelJS from 'exceljs';
import { call, suite, happy, bad, report, U, warm, query } from './harness.mjs';

await warm();
const A = U.admin;
const MARK = 'ZZMATCH2';

const clean = async () => {
  const units = (await query(`select id from units where name like $1`, [`${MARK}%`])).rows.map((r) => r.id);
  if (units.length) {
    const emps = (await query('select id from employees where unit_id = any($1) or id in (select employee_id from employee_moves where from_unit_id = any($1) or to_unit_id = any($1))', [units])).rows.map((r) => r.id);
    await query('delete from work_log_audit where unit_id = any($1) or employee_id = any($2)', [units, emps]);
    await query('delete from work_logs where unit_id = any($1) or employee_id = any($2)', [units, emps]);
    await query('delete from employee_moves where employee_id = any($1)', [emps]);
    await query('delete from employee_away where employee_id = any($1)', [emps]);
    await query('delete from employees where id = any($1)', [emps]);
    await query('delete from units where id = any($1)', [units]);
  }
  await query(`delete from work_log_audit where action like 'site.%' and after_val->>'name' like $1`, [`${MARK}%`]);
  await query(`delete from credit_requests where ref like $1`, [`${MARK}%`]);
  await query(`delete from credit_ledger where ref like $1`, [`${MARK}%`]);
  await query(`delete from credit_category_caps where note = $1`, [MARK]);
  await query(`delete from facilities where notes like $1`, [`%${MARK}%`]);
  const sop = (await query('select no from sop_scenarios where title_th like $1', [`${MARK}%`])).rows.map((r) => r.no);
  if (sop.length) await query('delete from sop_scenarios where no = any($1)', [sop]);
};
await clean();

const pad = (n) => String(n).padStart(2, '0');
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); const t = new Date(y, m - 1, d + n); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
const sheetsOf = async (res) => {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(await res.arrayBuffer()));
  const out = {}; wb.eachSheet((ws) => { out[ws.name] = []; ws.eachRow((r) => out[ws.name].push(r.values.slice(1))); });
  return out;
};

// ── บันทึกงาน: ไซต์และพนักงานทดสอบ ─────────────────────────────────────────
const siteA = await call('/performance/sites', { method: 'POST', user: A, body: { name: `${MARK} ไซต์ก`, company: 'ทดสอบ' } });
const siteB = await call('/performance/sites', { method: 'POST', user: A, body: { name: `${MARK} ไซต์ข` } });
const SA = siteA.data?.key, SB = siteB.data?.key;
const emp = async (site, fullName, kind) =>
  (await call('/performance/employees', { method: 'POST', user: A, body: { site, fullName, kind } })).data;
const op = await emp(SA, `${MARK} ปฏิบัติการ`, 'operation');
const sup = await emp(SA, `${MARK} สนับสนุน`, 'support');
const mover = await emp(SA, `${MARK} ย้ายไซต์`, 'operation');
const grid0 = await call(`/performance/site-month?site=${SA}&year=2026&month=1`, { user: A });
const TODAY = grid0.today;
const [Y, M] = TODAY.split('-').map(Number);
const cell = (site, eid, date, field, value, extra = {}) =>
  call('/performance/cell', { method: 'POST', user: A, body: { site, eid, date, field, value, ...extra } });
const grid = async (site) => call(`/performance/site-month?site=${site}&year=${Y}&month=${M}`, { user: A });

suite('0. จัดการโครงการ — เพิ่มได้โดยไม่ต้องพิมพ์รหัส (api_addSite)');
{
  happy('เพิ่มโครงการได้ และระบบตั้งรหัสให้เอง', siteA.status === 201 && /^ZZMATCH2/.test(SA || ''), `${siteA.status} ${SA}`);
  bad('ชื่อซ้ำไม่ได้ (รายงานจะสับสน)', (await call('/performance/sites', { method: 'POST', user: A, body: { name: `${MARK} ไซต์ก` } })).status === 409, '');
  bad('ผู้ใช้ที่ไม่ใช่ผู้ดูแลระบบเพิ่มโครงการไม่ได้', (await call('/performance/sites', { method: 'POST', user: U.hr, body: { name: `${MARK} ไซต์ค` } })).status === 403, '');
  happy('สร้างพนักงานทดสอบครบ', Boolean(op?.eid && sup?.eid && mover?.eid), '');
}

suite('1. ช่องที่ล้างแล้วพิมพ์ใหม่ต้องไม่หาย');
{
  const d = TODAY;
  await cell(SA, sup.eid, d, 'detail', 'C-3 / 18');
  await cell(SA, sup.eid, d, 'detail', '');
  const re = await cell(SA, sup.eid, d, 'detail', 'C-5 / 18');
  happy('บันทึกค่าใหม่หลังล้างได้', re.status === 200, `${re.status}`);
  const g = await grid(SA);
  happy('ตารางแสดงค่าที่พิมพ์ใหม่ (ระบบจริงแสดง ของเราเคยหาย)', g.entries?.[sup.eid]?.[d]?.detail === 'C-5 / 18', JSON.stringify(g.entries?.[sup.eid]?.[d] || null));
}

suite('2. ช่องที่ถูกล้างไม่ถูกนับในภาพรวมและไฟล์ Excel');
{
  const d = addDays(TODAY, -1);
  await cell(SA, op.eid, d, 'team', 'A-1 / 5');
  await cell(SA, op.eid, d, 'team', '');
  const s = (await call(`/performance/admin-summary?year=${Y}&month=${M}`, { user: A })).rows.find((r) => r.site_key === SA);
  happy('จำนวนรายการไม่นับช่องที่ล้างแล้ว', s?.entries === 1, `${s?.entries}`);
  const x = await sheetsOf(await call(`/performance/export?site=${SA}&year=${Y}&month=${M}`, { user: A, raw: true }));
  const row = Object.values(x)[0].find((r) => r[0] === op.eid);
  const col = 5 + Number(d.slice(8));
  bad('ไฟล์ Excel ไม่มีค่าของช่องที่ล้างแล้ว', !row?.[col - 1], String(row?.[col - 1]));
}

suite('3. ช่องงานหลักต้องตรงกับสายงาน');
{
  bad('สายสนับสนุนบันทึกลงช่อง team ไม่ได้', (await cell(SA, sup.eid, TODAY, 'team', 'A-1 / 5')).status === 400, '');
  bad('สายปฏิบัติการบันทึกลงช่อง detail ไม่ได้', (await cell(SA, op.eid, TODAY, 'detail', 'C-3 / 18')).status === 400, '');
}

suite('4. ผู้ดูแลระบบแก้ย้อนหลังได้โดยไม่ต้องให้เหตุผล (ข้อกำหนดฟังก์ชัน §6)');
{
  const old = addDays(TODAY, -10);
  bad('ยังต้องปลดล็อกโดยตั้งใจ', (await cell(SA, op.eid, old, 'team', 'A-2 / 9')).status === 409, '');
  const r = await cell(SA, op.eid, old, 'team', 'A-2 / 9', { adminUnlock: true });
  happy('ปลดล็อกแล้วบันทึกได้โดยไม่ต้องใส่เหตุผล', r.status === 200, `${r.status} ${r.error || ''}`);
  const g = await grid(SA);
  const edited = g.edits?.[`${op.eid}|${old}`];
  if (old.slice(0, 7) === TODAY.slice(0, 7)) happy('ตารางทำเครื่องหมายช่องที่แก้หลังล็อก', Boolean(edited?.date), JSON.stringify(edited || null));
  bad('ผู้ใช้ทั่วไปปลดล็อกเองไม่ได้', (await call('/performance/cell', { method: 'POST', user: U.hr,
    body: { site: SA, eid: op.eid, date: old, field: 'team', value: 'A-3 / 4', adminUnlock: true } })).status >= 400, '');
}

suite('5. รหัสตัวพิมพ์เล็กนับเป็นรหัสเดียวกัน (ระบบจริงไม่สนตัวพิมพ์)');
{
  await cell(SA, op.eid, TODAY, 'team', 'a-1 / 5');
  const r = (await call(`/performance/report/manday?from=${TODAY}&to=${TODAY}&groupBy=worktype`, { user: A })).data;
  happy('รายงานแรงงาน-วันนับ a-1 เป็น A-1', (r?.rows || []).some((x) => x.key === 'A-1'), JSON.stringify((r?.rows || []).slice(0, 3)));
  bad('ไม่มีแถวรหัสตัวพิมพ์เล็กแยกออกมา', !(r?.rows || []).some((x) => x.key === 'a-1'), '');
}

suite('6. ภาพรวม: สูตรความครบถ้วนและลำดับไซต์ตามระบบจริง');
{
  const sum = (await call(`/performance/admin-summary?year=${Y}&month=${M}`, { user: A })).rows;
  const s = sum.find((r) => r.site_key === SA);
  const workdays = s.daysFilled.filter((d) => d.date <= TODAY && !d.weekend).length;
  const expect = s.n_emp * workdays ? Math.min(100, Math.round((s.entries / (s.n_emp * workdays)) * 100)) : 0;
  happy('ความครบถ้วน = รายการ ÷ (คน × วันทำงานที่ผ่านมา)', s.fillRate === expect && s.fillRateDenom === s.n_emp * workdays, `${s.fillRate} vs ${expect}`);
  happy('ตัวตั้งรายวันคือคนทั้งไซต์ทุกวัน รวมวันอาทิตย์', s.daysFilled.every((d) => d.total === s.n_emp), '');
  const ns = sum.map((r) => r.n_emp);
  happy('ไซต์ใหญ่ขึ้นก่อน', ns.every((n, i) => i === 0 || ns[i - 1] >= n), ns.join(','));
  bad('กราฟไม่นับค่าที่ไม่อยู่ในทะเบียน', !s.topActivities.some((x) => /^[a-z]-\d/.test(x.name)), JSON.stringify(s.topActivities));
}

suite('7. ไฟล์ Excel สองแบบรูปแบบเดียวกับระบบจริง');
{
  const res = await call(`/performance/report/monthly.xlsx?ym=${TODAY.slice(0, 7)}`, { user: A, raw: true });
  const disp = decodeURIComponent((res.headers.get('content-disposition') || '').split("UTF-8''")[1] || '');
  const x = await sheetsOf(res);
  const names = Object.keys(x);
  happy('ชื่อไฟล์ HR Manday Report ปี พ.ศ.', disp.startsWith(`HR Manday Report ${Y + 543}-${pad(M)}`), disp);
  happy('สองแผ่นแรกคือ หมวดงาน / กิจกรรม', names[0] === 'หมวดงาน Work Category' && names[1] === 'กิจกรรม Activity', names.join(' | '));
  happy('หัวตารางตรงกับระบบจริง', JSON.stringify(x[names[1]][0]) === JSON.stringify(['เดือน', 'หน่วยงาน', 'รหัสกิจกรรม', 'กิจกรรม', 'วันทำงาน']), JSON.stringify(x[names[1]][0]));
  const mine = x[names[1]].filter((r) => String(r[1]).startsWith(MARK));
  happy('แถวของไซต์ทดสอบนับวันทำงานถูก (A-1 = 1 วัน)', mine.some((r) => r[2] === 'A-1' && Number(r[4]) === 1), JSON.stringify(mine));
  const site = await sheetsOf(await call(`/performance/export?site=${SA}&year=${Y}&month=${M}`, { user: A, raw: true }));
  const head = Object.values(site)[0][0];
  happy('ไฟล์รายไซต์: eid · emp_id · name · kind · department · Day 1…', head.slice(0, 6).join('|') === 'eid|emp_id|name|kind|department|Day 1', head.slice(0, 6).join('|'));
  happy('ชื่อแผ่นรายไซต์ใช้ปี พ.ศ.', Object.keys(site)[0].endsWith(`${Y + 543}-${pad(M)}`), Object.keys(site)[0]);
}

suite('8. ย้ายไซต์มีวันที่มีผล ประวัติยังอยู่กับไซต์เดิม (api_migrateEmployee)');
{
  const before = addDays(TODAY, -3), eff = addDays(TODAY, -1);
  await cell(SA, mover.eid, before, 'team', 'A-4 / 6');
  const mv = await call(`/performance/employees/${mover.eid}/move`, { method: 'POST', user: A, body: { site: SB, date: eff } });
  happy('ย้ายโดยระบุวันที่มีผลได้', mv.status === 200 && mv.data?.date === eff, `${mv.status} ${JSON.stringify(mv.data || mv.error)}`);
  const ga = await grid(SA);
  const inA = ga.employees.find((e) => e.eid === mover.eid);
  if (eff.slice(0, 7) === TODAY.slice(0, 7)) {
    happy('ไซต์เดิมยังแสดงแถวของคนที่ย้ายออก', Boolean(inA), '');
    happy('ไซต์เดิมยังเห็นบันทึกก่อนย้าย', ga.entries?.[mover.eid]?.[before]?.team === 'A-4 / 6', '');
    happy('วันหลังย้ายเป็นวันที่ไม่ได้สังกัดไซต์เดิม', inA?.away?.includes(eff) && !inA?.away?.includes(before), JSON.stringify(inA?.away?.slice(0, 5)));
    happy('บอกว่าย้ายไปที่ไหน', Boolean(inA?.moved_out === eff && inA?.moved_out_to), `${inA?.moved_out} ${inA?.moved_out_to}`);
  }
  bad('บันทึกที่ไซต์เดิมหลังวันย้ายไม่ได้', (await cell(SA, mover.eid, TODAY, 'team', 'A-1 / 5')).status === 400, '');
  happy('บันทึกที่ไซต์ใหม่หลังวันย้ายได้', (await cell(SB, mover.eid, TODAY, 'team', 'A-1 / 5')).status === 200, '');
  bad('ย้ายย้อนไปก่อนการย้ายครั้งล่าสุดไม่ได้',
    (await call(`/performance/employees/${mover.eid}/move`, { method: 'POST', user: A, body: { site: SA, date: addDays(eff, -1) } })).status === 400, '');
  const back = await call(`/performance/employees/${mover.eid}/move`, { method: 'POST', user: A, body: { site: SA, date: eff } });
  happy('ย้ายกลับในวันเดียวกัน = ยกเลิกการย้าย', back.data?.reverted === true, JSON.stringify(back.data || back.error));
  const left = (await query('select count(*)::int n from employee_moves where employee_id = $1', [mover.eid])).rows[0].n;
  happy('ประวัติการย้ายที่ยกเลิกถูกลบออก', left === 0, `${left}`);
}

suite('9. ปิดโครงการ = หยุดรับบันทึกใหม่ ประวัติยังอยู่');
{
  const close = await call(`/performance/sites/${SB}`, { method: 'PATCH', user: A, body: { active: false } });
  happy('ปิดโครงการได้', close.status === 200 && close.data?.active === false, `${close.status}`);
  const boot = await call('/performance/bootstrap', { user: A });
  happy('รายชื่อไซต์บอกว่าโครงการนี้ปิดแล้ว', boot.sites.find((s) => s.key === SB)?.active === false, '');
  const other = await emp(SA, `${MARK} คนไซต์ข`, 'operation');
  await query('update employees set unit_id = (select id from units where code = $1) where id = $2', [SB, other.eid]);
  bad('บันทึกงานในโครงการที่ปิดแล้วไม่ได้', (await cell(SB, other.eid, TODAY, 'team', 'A-1 / 5')).status === 409, '');
  const s = (await call(`/performance/admin-summary?year=${Y}&month=${M}`, { user: A })).rows.find((r) => r.site_key === SB);
  happy('โครงการที่ปิดยังขึ้นในภาพรวม', Boolean(s), '');
  await call(`/performance/sites/${SB}`, { method: 'PATCH', user: A, body: { active: true } });
}

suite('10. ไซต์ตรงกับระบบจริง');
{
  const u = (await query(`select code, name, is_active from units where code in ('DRV','HQ','U1','U2','U3','U4','U5') order by code`)).rows;
  happy('มี พขร.ปูน และ สำนักงานใหญ่', u.some((x) => x.name === 'พขร.ปูน') && u.some((x) => x.name === 'สำนักงานใหญ่'), JSON.stringify(u));
  happy('หน่วยงานตัวอย่าง U1–U5 ถูกปิด ไม่ขึ้นเป็นไซต์', u.filter((x) => /^U\d$/.test(x.code)).every((x) => x.is_active === false), '');
}

// ── วงเงินสินเชื่อ ─────────────────────────────────────────────────────────
const project = (await query('select id, code from projects order by code limit 1')).rows[0];
const fac = async (body) => (await call('/credit/facilities', { method: 'POST', user: A,
  body: { projectId: project.id, notes: `${MARK} ทดสอบ`, ...body } })).data;
const view = async (id) => ((await call(`/credit/facilities?projectId=${project.id}`, { user: A })).data || []).find((x) => x.id === id);
const led = (facilityId, amount, extra = {}) => call('/credit/ledger', { method: 'POST', user: A,
  body: { facilityId, amount, ref: `${MARK}`, ...extra } });

suite('11. ปลดวงเงินนับยอดตั้งต้นของวงเงินด้วย');
{
  const f = await fac({ facilityNo: 3, limit: 1000000, usedBaseline: 500000 });
  const r = await led(f.id, -200000);
  happy('ปลดวงเงินที่มีแต่ยอดตั้งต้นได้ (เดิมถูกปฏิเสธ)', r.status === 201, `${r.status} ${r.error || ''}`);
  happy('ยอดใช้ไปลดเหลือ 300,000', Number((await view(f.id))?.used) === 300000, `${(await view(f.id))?.used}`);
  bad('ปลดเกินกว่าที่ใช้ยังไม่ได้ (ระบบจริงรับไว้แล้วซ่อนยอดการเบิกครั้งถัดไป)', (await led(f.id, -400000)).status === 400, '');
  bad('ยอดศูนย์ไม่ได้ (ระบบจริงรับเป็นรายการอนุมัติแล้ว)', (await led(f.id, 0)).status === 400, '');
}

suite('12. ตั้งยอดใช้ไปเอง (setUsedOverride)');
{
  const f = await fac({ facilityNo: 7, limit: 2000000 });
  await led(f.id, 100000);
  const p = await call(`/credit/facilities/${f.id}`, { method: 'PATCH', user: A, body: { usedOverride: 1234567 } });
  happy('ปักยอดใช้ไปได้', p.status === 200 && p.data?.used === 1234567 && p.data?.used_overridden === true, JSON.stringify(p.data || p.error));
  happy('คงเหลือคิดจากยอดที่ปัก', Number(p.data?.available) === 2000000 - 1234567, `${p.data?.available}`);
  happy('ยังบอกยอดที่คำนวณได้ไว้ให้เทียบ', p.data?.used_auto === 100000, `${p.data?.used_auto}`);
  const c = await call(`/credit/facilities/${f.id}`, { method: 'PATCH', user: A, body: { usedOverride: null } });
  happy('ล้างแล้วกลับไปคำนวณจากรายการ', c.data?.used === 100000 && c.data?.used_overridden === false, JSON.stringify(c.data || c.error));
}

suite('13. การ์ดครบกำหนดนับทุกรายการที่ยังต้องจ่าย รวมคำขอที่รออนุมัติ');
{
  const f = await fac({ facilityNo: 7, limit: 5000000 });
  const before = (await call('/credit/overview', { user: A })).data;
  const due = addDays(TODAY, 2).slice(0, 7) === TODAY.slice(0, 7) ? addDays(TODAY, 2) : TODAY;
  await call('/credit/requests', { method: 'POST', user: A, body: { facilityId: f.id, amount: 70000, dueDate: due, ref: MARK } });
  await led(f.id, 30000, { dueDate: due });
  const settled = await led(f.id, 11000, { dueDate: due });
  await call(`/credit/ledger/${settled.data.id}/settle`, { method: 'POST', user: A });
  const after = (await call('/credit/overview', { user: A })).data;
  happy('เดือนนี้เพิ่มเท่าคำขอรออนุมัติ + รายการอนุมัติ (ไม่รวมที่ชำระแล้ว)',
    Math.round(after.buckets.thisMonth.amount - before.buckets.thisMonth.amount) === 100000,
    `${after.buckets.thisMonth.amount - before.buckets.thisMonth.amount}`);
  happy('ครบใน 7 วันเพิ่มด้วย', Math.round(after.buckets.due7.amount - before.buckets.due7.amount) === 100000, '');
  happy('การ์ดรออนุมัติ +1 รายการ 70,000', after.pendingCount - before.pendingCount === 1 && Math.round(after.pendingAmount - before.pendingAmount) === 70000, '');
  happy('การ์ดอนุมัตินับรายการที่อนุมัติ พร้อมยอดเงิน', after.approvedCount - before.approvedCount === 1 && Math.round(after.approvedAmount - before.approvedAmount) === 30000,
    `${after.approvedCount - before.approvedCount} / ${after.approvedAmount - before.approvedAmount}`);
}

suite('14. สรุปค่าใช้จ่าย: หัวโครงการนับเฉพาะหมวดที่ตั้งงบ');
{
  const f = await fac({ facilityNo: 7, limit: 9000000 });
  await call('/credit/category-caps', { method: 'PUT', user: A, body: { projectId: project.id, costCategory: 'ทรายถม', cap: 1000000, note: MARK } });
  await led(f.id, 400000, { costCategory: 'ทรายถม' });
  const g1 = (await call(`/credit/cost-summary?projectId=${project.id}`, { user: A })).data.projects[0];
  const line = g1?.lines.find((l) => l.cost_category === 'ทรายถม');
  happy('หมวดที่ตั้งงบคิด % จากงบ', line?.pct === 40, JSON.stringify(line));
  happy('ยอดหัวโครงการไม่รวมหมวดที่ไม่มีงบ', g1 && g1.spent <= g1.cap * 1.5 && g1.lines.filter((l) => l.cap != null).reduce((a, l) => a + l.spent, 0) === g1.spent, `${g1?.spent} / ${g1?.cap}`);
  await call('/credit/category-caps', { method: 'PUT', user: A, body: { projectId: project.id, costCategory: 'หิน', cap: 500000, note: MARK } });
  const g2 = (await call(`/credit/cost-summary?projectId=${project.id}`, { user: A })).data.projects[0];
  happy('งบที่ยังไม่มีการใช้ขึ้นเป็นแถวว่าง', g2?.lines.some((l) => l.cost_category === 'หิน' && l.items === 0), '');
  await call('/credit/category-caps', { method: 'PUT', user: A, body: { projectId: project.id, costCategory: 'หิน', cap: 0 } });
  const g3 = (await call(`/credit/cost-summary?projectId=${project.id}`, { user: A })).data.projects[0];
  bad('ล้างงบแล้วแถวหายไป ไม่ค้างเป็น "ไม่ได้ตั้ง"', !g3?.lines.some((l) => l.cost_category === 'หิน'), '');
}

suite('15. หมวดค่าใช้จ่ายชุดเดียวกับระบบจริง');
{
  const cats = (await call('/credit/cost-categories', { user: A })).data || [];
  happy('มี 18 หมวด', cats.length === 18, `${cats.length}`);
  happy('เริ่มที่ ทรายถม จบที่ อื่นๆ', cats[0] === 'ทรายถม' && cats[17] === 'อื่นๆ', `${cats[0]} … ${cats[17]}`);
}

// ── คู่มือ SOP ──────────────────────────────────────────────────────────────
suite('16. คู่มือ SOP ฉบับเดียวกับหน้าเว็บที่ลูกค้าใช้อยู่');
{
  const n = (await query('select count(*)::int n from sop_scenarios')).rows[0].n;
  happy('มี 32 กรณีศึกษา', n >= 32, `${n}`);
  const reps = (await call('/sop/reports', { user: A })).data || [];
  happy('มี 24 รายการเรียกรายงาน', reps.length >= 24, `${reps.length}`);
  happy('รายการที่ 24 คือ AP Voucher Tracking', /AP -> Report -> 2\.3/.test(reps.find((r) => r.case_no === 24)?.report_path || ''), '');
  const c32 = (await call('/sop/scenarios/32', { user: A })).data;
  happy('กรณีที่ 32 (เพิ่มเมื่อ 18 ก.ย. 2569) มีครบ', /จ่ายเช็ค/.test(c32?.title_th || '') && c32?.attachments?.length > 0, c32?.title_th);
  const styles = (await query('select style, count(*)::int n from sop_scenario_steps group by style')).rows;
  happy('ขั้นตอนมีสี่ระดับ (ลำดับ · จุด · ย่อย · ย่อยชั้นสอง)', ['num', 'bullet', 'sub', 'sub2'].every((s) => styles.some((x) => x.style === s)), JSON.stringify(styles));
  const noAtt = (await query('select count(*)::int n from sop_scenarios s where not exists (select 1 from sop_scenario_attachments a where a.scenario_no = s.no) and s.title_th not like $1', [`${MARK}%`])).rows[0].n;
  happy('ทุกกรณีมีไฟล์ SOP แนบ', noAtt === 0, `${noAtt} กรณีไม่มี`);
  const v = (await query(`select count(*)::int n from sop_versions where note like 'ฉบับก่อนนำเข้า%'`)).rows[0].n;
  happy('ฉบับเดิมเก็บไว้ในประวัติเวอร์ชัน กู้คืนได้', v >= 1, `${v}`);

  const mk = await call('/sop/scenarios', { method: 'POST', user: A, body: {
    module: 'PO', titleTh: `${MARK} ทดสอบระดับขั้นตอน`,
    steps: [{ text: 'หนึ่ง', style: 'num' }, { text: 'จุด', style: 'bullet' }, { text: 'ย่อย', style: 'sub' }, { text: 'ย่อยสอง', style: 'sub2' }],
    attachments: [{ label: 'คู่มือ', url: 'https://drive.google.com/file/d/test/view' }],
  } });
  const got = (await call(`/sop/scenarios/${mk.data?.no}`, { user: A })).data;
  happy('บันทึกและอ่านระดับขั้นตอนได้ครบสี่แบบ', got?.steps?.map((s) => s.style).join(',') === 'num,bullet,sub,sub2', JSON.stringify(got?.steps));
  happy('บันทึกและอ่านไฟล์แนบได้', got?.attachments?.[0]?.label === 'คู่มือ', JSON.stringify(got?.attachments));
  bad('ลิงก์ไฟล์แนบต้องเป็น URL', (await call(`/sop/scenarios/${mk.data?.no}`, { method: 'PATCH', user: A,
    body: { attachments: [{ label: 'x', url: 'ไม่ใช่ลิงก์' }] } })).status === 400, '');
  await call(`/sop/scenarios/${mk.data?.no}`, { method: 'DELETE', user: A });
}

suite('17. ไม่ทิ้งข้อมูลทดสอบไว้');
{
  await clean();
  const left = (await query(`select count(*)::int n from units where name like $1`, [`${MARK}%`])).rows[0].n
    + (await query(`select count(*)::int n from facilities where notes like $1`, [`%${MARK}%`])).rows[0].n
    + (await query(`select count(*)::int n from credit_requests where ref like $1`, [`${MARK}%`])).rows[0].n
    + (await query(`select count(*)::int n from sop_scenarios where title_th like $1`, [`${MARK}%`])).rows[0].n;
  happy('ลบข้อมูลทดสอบหมดแล้ว', left === 0, `${left}`);
}

process.exit(report() ? 1 : 0);
