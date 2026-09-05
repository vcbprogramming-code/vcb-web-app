/**
 * นำเนื้อหาปฐมนิเทศ 90 วันเข้าฐานข้อมูล
 *
 *   node scripts/seed-onboarding.mjs           ดูว่าจะเปลี่ยนอะไร
 *   node scripts/seed-onboarding.mjs --write   เขียนจริง
 *
 * อ่านจาก onboarding-content.json ที่ extract-onboarding.mjs ดึงมาจากต้นฉบับ
 * รันซ้ำได้ — รายการที่หายไปจากเนื้อหาจะถูก "ปิด" ไม่ใช่ลบ เพราะอาจมีพนักงาน
 * ติ๊กไว้แล้ว และ id ของรายการเป็นสิ่งที่ความคืบหน้าผูกอยู่
 */
import { readFileSync } from 'node:fs';
import { query, queryOne } from '../src/config/db.js';

const SRC = JSON.parse(readFileSync(new URL('./onboarding-content.json', import.meta.url), 'utf8'));
const write = process.argv.includes('--write');
const plan = [];

const DEPT_TH = {
  accounting: 'ฝ่ายบัญชี',
  finance: 'ฝ่ายการเงิน',
  procurement: 'ฝ่ายจัดซื้อ',
  property: 'ฝ่ายทรัพย์สินและครุภัณฑ์',
  engineering: 'ฝ่ายวิศวกรรม',
};

const run = async () => {
  const haveItems = new Set((await query('select id from ob_items')).rows.map((r) => r.id));
  const seen = new Set();

  for (const [di, d] of SRC.departments.entries()) {
    if (!(await queryOne('select slug from ob_departments where slug = $1', [d.slug]))) {
      plan.push(`+ แผนก ${d.slug} — ${d.name}`);
    }
    if (write) {
      await query(
        `insert into ob_departments (slug, name, name_th, sort_order) values ($1,$2,$3,$4)
         on conflict (slug) do update set name = excluded.name, name_th = excluded.name_th,
           sort_order = excluded.sort_order, is_active = true`,
        [d.slug, d.name, DEPT_TH[d.slug] || null, di + 1]);
    }

    for (const [pi, p] of d.phases.entries()) {
      if (write) {
        await query(
          `insert into ob_phases (id, dept_slug, day_range, eyebrow, title, closing, next_phase, sort_order)
           values ($1,$2,$3,$4,$5,$6,$7,$8)
           on conflict (id) do update set dept_slug = excluded.dept_slug, day_range = excluded.day_range,
             eyebrow = excluded.eyebrow, title = excluded.title, closing = excluded.closing,
             next_phase = excluded.next_phase, sort_order = excluded.sort_order`,
          [p.key, d.slug, p.range, p.eyebrow, p.title, p.closing, p.next, pi + 1]);
        // บล็อกไม่มี id ถาวรของตัวเอง — เขียนใหม่ทุกครั้งตามลำดับ ส่วนรายการ
        // ผูกกับบล็อกด้วย sort_order เดิม จึงไม่กระทบ id ของรายการ
        await query('delete from ob_blocks where phase_id = $1', [p.key]);
      }
      for (const [bi, b] of p.blocks.entries()) {
        let blockId = null;
        if (write) {
          blockId = (await queryOne(
            'insert into ob_blocks (phase_id, heading, sort_order) values ($1,$2,$3) returning id',
            [p.key, b.heading, bi + 1])).id;
        }
        for (const [ii, it] of b.items.entries()) {
          if (!it.id) { plan.push(`! รายการไม่มี id ใน ${p.key}/${b.heading}: ${it.text}`); continue; }
          seen.add(it.id);
          if (!haveItems.has(it.id)) plan.push(`+ รายการ ${it.id} (${it.level}) ${it.text.slice(0, 40)}`);
          if (write) {
            await query(
              `insert into ob_items (id, block_id, text, level, sort_order, is_active)
               values ($1,$2,$3,$4,$5,true)
               on conflict (id) do update set block_id = excluded.block_id, text = excluded.text,
                 level = excluded.level, sort_order = excluded.sort_order, is_active = true`,
              [it.id, blockId, it.text, it.level, ii + 1]);
          }
        }
      }
    }
  }

  for (const [i, doc] of (SRC.requiredDocuments || []).entries()) {
    if (!doc.id) continue;
    if (!(await queryOne('select id from ob_documents where id = $1', [doc.id]))) {
      plan.push(`+ เอกสาร ${doc.id} — ${doc.title}`);
    }
    if (write) {
      await query(
        `insert into ob_documents (id, title, descr, action, sort_order) values ($1,$2,$3,$4,$5)
         on conflict (id) do update set title = excluded.title, descr = excluded.descr,
           action = excluded.action, sort_order = excluded.sort_order, is_active = true`,
        [doc.id, doc.title, doc.desc || doc.descr || null, doc.action || null, i + 1]);
    }
  }

  // รายการที่หายไปจากเนื้อหา: ปิด ไม่ลบ — อาจมีคนติ๊กไว้แล้ว
  const stale = [...haveItems].filter((id) => !seen.has(id));
  stale.forEach((id) => plan.push(`- ปิดรายการที่ไม่มีในเนื้อหาแล้ว ${id}`));
  if (write && stale.length) {
    await query('update ob_items set is_active = false where id = any($1)', [stale]);
  }

  console.log(plan.length ? plan.slice(0, 20).join('\n') + (plan.length > 20 ? `\n… อีก ${plan.length - 20} รายการ` : '') : 'ไม่มีอะไรต้องเปลี่ยน');
  if (!write) { console.log(`\n(ยังไม่เขียน — เติม --write · ${plan.length} รายการ)`); return; }
  const n = await queryOne(`select
    (select count(*) from ob_departments)::int d,
    (select count(*) from ob_phases)::int p,
    (select count(*) from ob_blocks)::int b,
    (select count(*) from ob_items where is_active)::int i,
    (select count(*) from ob_documents where is_active)::int doc`);
  console.log(`\n✅ ${n.d} แผนก · ${n.p} เฟส · ${n.b} บล็อก · ${n.i} รายการ · ${n.doc} เอกสาร`);
};

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
