/**
 * ทะเบียนงาน 44 รหัส + หมวดต้นทุน 20 หมวด ตามระบบที่ลูกค้าใช้จริง
 *
 *   node scripts/seed-vcb-index.mjs          ดูว่าจะเปลี่ยนอะไรบ้าง (ไม่เขียน)
 *   node scripts/seed-vcb-index.mjs --write  เขียนจริง
 *
 * ทำไมต้องแทนที่ ไม่ใช่เพิ่ม: ทะเบียนเดิมของเรา 31 รหัสใช้ "รหัสเดียวกันแต่คนละ
 * ความหมาย" กับระบบจริง — A-1 ของเราคือ "งานบุคคล-ธุรการ-บัญชี" แต่ A-1 ของจริง
 * คือ "งานผูก-ตัด-ดัดเหล็ก" เช่นเดียวกับหมวดต้นทุน 1 ที่ของเราคือ "ค่าบริหาร
 * โครงการ" แต่ของจริงคือ "งานรื้อย้ายโครงสร้างเดิม" ถ้าเก็บของเดิมไว้ปนกัน
 * ค่าแรงจะถูกกระจายลงหมวดผิดโดยไม่มีอะไรฟ้อง
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { query, queryOne } from '../src/config/db.js';

const SRC = JSON.parse(readFileSync(fileURLToPath(new URL('./vcb-index.json', import.meta.url)), 'utf8'));
const write = process.argv.includes('--write');

// ── ข้อมูลสาธิตที่ลงไว้ก่อนมีทะเบียนจริง ────────────────────────────────────
// ค่าที่บันทึกไว้เป็นชื่องานล้วน ไม่ใช่รหัส จับคู่กับรหัสจริงที่ใกล้เคียงที่สุด
// เพื่อให้ข้อมูลสาธิตยังอ่านได้หลังเปลี่ยนทะเบียน (เจ้าของงานสั่งให้เก็บไว้)
const DEMO_MAP = {
  'งานเหล็ก': 'A-1 / 5',                  // งานผูก-ตัด-ดัดเหล็ก → งานโครงสร้าง
  'งานคอนกรีต': 'A-2 / 5',                // งานเทคอนกรีต → งานโครงสร้าง
  'งานสำรวจ / วางแนว': 'A-10 / 5',        // งานสำรวจ (กลางวัน)
  'งานปรับพื้นที่ / ดินถม': 'A-6 / 3',    // งานขุดดิน/ถมดิน → งานรองพื้นทาง (รหัสเดียวที่ A-6 ใช้ได้)
  'งานระบบไฟฟ้า': 'A-14 / 10',            // งานช่างไฟฟ้าหน้างาน → งานไฟฟ้า
  // สองแถวนี้คีย์ไว้ตอนทดสอบ ใต้ความหมายเดิมของรหัส จึงย้ายตามความหมาย ไม่ใช่ตามรหัส
  'A-3 / 1': 'E-5 / 8',                   // เดิม "งานการเงิน/จัดซื้อ" → งานธุรการ/สำนักงาน/จัดซื้อ
  'B-3 / 4': 'E-1 / 8',                   // เดิม "งาน Safety" → งาน Safety (กลางวัน)
};

const run = async () => {
  const plan = [];

  // ── หมวดต้นทุน 20 หมวด ────────────────────────────────────────────────
  const costRows = SRC.costTypes.map(([code, name, nameEn], i) => ({ code, name, nameEn, sort: i + 1 }));
  const haveCost = (await query('select code, name from cost_categories')).rows;
  const costByCode = new Map(haveCost.map((r) => [r.code, r]));
  for (const c of costRows) {
    const cur = costByCode.get(c.code);
    if (!cur) plan.push(`+ หมวดต้นทุน ${c.code} ${c.name}`);
    else if (cur.name !== c.name) plan.push(`~ หมวดต้นทุน ${c.code}: "${cur.name}" → "${c.name}"`);
  }
  const keepCost = new Set(costRows.map((c) => c.code));
  const dropCost = haveCost.filter((r) => !keepCost.has(r.code));
  dropCost.forEach((r) => plan.push(`- หมวดต้นทุน ${r.code} ${r.name}`));

  // ── ทะเบียนงาน 44 รหัส ────────────────────────────────────────────────
  // [code, thai, english, category, detail, mapping, fixedCost, allowedCosts]
  const workRows = SRC.workTypes.map(([code, name, nameEn, category, desc, , fixedCost, allowed], i) => {
    const list = String(allowed || '').split(',').map((s) => s.trim()).filter(Boolean);
    return {
      code, name, nameEn, category, desc, sort: i + 1,
      allowed: list.join(','),
      // ระบบจริงอนุมานจาก allowed_cost: 1 รหัส = ข้ามขั้นที่สอง, หลายรหัส = ให้เลือก
      mapping: list.length === 1 ? 'one-to-one' : 'one-to-many',
      fixedCost: list.length === 1 ? list[0] : (fixedCost || null),
    };
  });
  const haveWork = (await query('select code, name from work_types')).rows;
  const workByCode = new Map(haveWork.filter((r) => r.code).map((r) => [r.code, r]));
  for (const w of workRows) {
    const cur = workByCode.get(w.code);
    if (!cur) plan.push(`+ ประเภทงาน ${w.code} ${w.name}`);
    else if (cur.name !== w.name) plan.push(`~ ประเภทงาน ${w.code}: "${cur.name}" → "${w.name}"`);
  }
  const keepWork = new Set(workRows.map((w) => w.code));
  const dropWork = haveWork.filter((r) => !keepWork.has(r.code));
  dropWork.forEach((r) => plan.push(`- ประเภทงาน ${r.code || '(ไม่มีรหัส)'} ${r.name}`));

  // ── ข้อมูลสาธิตที่ต้องแปลง ────────────────────────────────────────────
  const cells = (await query(
    `select v, count(*)::int n from (
       select detail v from work_logs where detail is not null and deleted_at is null
       union all select pm from work_logs where pm is not null and deleted_at is null
       union all select team from work_logs where team is not null and deleted_at is null) x
      group by v order by n desc`)).rows;
  // team คือ "ทีม/ชุดงาน" ไม่ใช่รหัสงาน — หน้าจอลงบันทึกเคยเขียนรหัสของพนักงาน
  // สายปฏิบัติการลงช่องนี้ ทำให้คอลัมน์เดียวถือความหมายสองอย่าง ย้ายกลับไปช่อง
  // งานหลักให้ตรงกับระบบจริงที่แยก "ทีม" ออกจาก "งานที่ทำ" ชัดเจน
  const strays = (await query(
    `select id, team from work_logs where team ~ '^[A-Z]-[0-9]+' and deleted_at is null`)).rows;
  strays.forEach((r) => plan.push(`~ ย้ายรหัสงานออกจากช่องทีม: "${r.team}" → ช่องงานหลัก`));
  const unmapped = cells.filter((r) => !DEMO_MAP[r.v]
    && !/^[A-Z]-\d+( \/ \d+)?$/.test(r.v) && !/^ทีม /.test(r.v));
  cells.filter((r) => DEMO_MAP[r.v]).forEach((r) => plan.push(`~ ข้อมูล ${r.n} แถว: "${r.v}" → "${DEMO_MAP[r.v]}"`));
  unmapped.forEach((r) => plan.push(`! ไม่รู้จะแปลงเป็นอะไร ${r.n} แถว: "${r.v}" — ปล่อยไว้ตามเดิม`));

  console.log(plan.join('\n') || 'ไม่มีอะไรต้องเปลี่ยน');
  if (!write) { console.log(`\n(ยังไม่เขียน — เติม --write เพื่อบันทึกจริง · ${plan.length} รายการ)`); return; }

  // ── เขียน ─────────────────────────────────────────────────────────────
  for (const c of costRows) {
    await query(
      `insert into cost_categories (code, name, name_en, sort_order, is_active)
       values ($1,$2,$3,$4,true)
       on conflict (code) do update set name = excluded.name, name_en = excluded.name_en,
         sort_order = excluded.sort_order, is_active = true, updated_at = now()`,
      [c.code, c.name, c.nameEn, c.sort]);
  }
  // หมวดที่ไม่มีในทะเบียนจริง: ปิดใช้งาน ไม่ลบ — ข้อมูลเก่าที่อ้างถึงยังอ่านออก
  for (const r of dropCost) await query('update cost_categories set is_active = false where code = $1', [r.code]);

  for (const w of workRows) {
    await query(
      `insert into work_types (code, name, name_en, description, category, sort_order,
                               mapping, fixed_cost, allowed_cost, is_active)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
       -- ดัชนี unique ของ work_types เป็นแบบมีเงื่อนไข (where code is not null)
       -- ต้องเขียนเงื่อนไขซ้ำตรงนี้ ไม่งั้น Postgres หาดัชนีที่จะชนไม่เจอ
       on conflict (code) where code is not null
       do update set name = excluded.name, name_en = excluded.name_en,
         description = excluded.description, category = excluded.category,
         sort_order = excluded.sort_order, mapping = excluded.mapping,
         fixed_cost = excluded.fixed_cost, allowed_cost = excluded.allowed_cost,
         is_active = true, updated_at = now()`,
      [w.code, w.name, w.nameEn, w.desc, w.category, w.sort, w.mapping, w.fixedCost, w.allowed]);
  }
  for (const r of dropWork) {
    if (r.code) await query('update work_types set is_active = false where code = $1', [r.code]);
    // แถวที่ไม่มีรหัสคือเศษที่ระบบจริงเรียกว่า "uncoded" — ลบได้ ไม่มีอะไรอ้างถึง
    else await query('delete from work_types where name = $1 and code is null', [r.name]);
  }

  for (const [from, to] of Object.entries(DEMO_MAP)) {
    await query('update work_logs set detail = $2, updated_at = now() where detail = $1', [from, to]);
    await query('update work_logs set pm = $2, updated_at = now() where pm = $1', [from, to]);
    await query('update work_logs set team = $2, updated_at = now() where team = $1', [from, to]);
  }
  for (const r of strays) {
    await query(
      `update work_logs set detail = coalesce(detail, team), team = null, updated_at = now() where id = $1`,
      [r.id]);
  }

  const n = await queryOne("select count(*)::int c from work_types where is_active");
  const m = await queryOne("select count(*)::int c from cost_categories where is_active");
  console.log(`\n✅ ทะเบียนงานใช้งาน ${n.c} รหัส · หมวดต้นทุนใช้งาน ${m.c} หมวด`);
};

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
