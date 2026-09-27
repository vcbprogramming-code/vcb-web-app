/**
 * เก็บกวาดประวัติเวอร์ชันของคู่มือที่เกิดจากชุดทดสอบ
 *
 *   node scripts/purge-sop-test-versions.mjs          ดูว่าจะลบอะไร (ไม่ลบจริง)
 *   node scripts/purge-sop-test-versions.mjs --apply  ลบจริง
 *
 * ชุดทดสอบของ SOP ลบเวอร์ชันที่ตัวเองทำให้เกิดตอนจบอยู่แล้ว แต่ถ้ารอบนั้นตาย
 * กลางคัน (API รีสตาร์ตระหว่างแก้โค้ด) เวอร์ชันจะค้างอยู่ในประวัติที่ลูกค้าเห็น
 * สคริปต์นี้ลบเฉพาะเวอร์ชันที่ยังอ้างถึงกรณีทดสอบ (ชื่อขึ้นต้นด้วย ZZ) หรือเป็น
 * ภาพก่อนเพิ่ม/แก้/ลบกรณีทดสอบนั้น — ดูจากเนื้อในเวอร์ชันและเวอร์ชันข้างเคียง
 *
 * ของจริงที่ต้องไม่หาย: ภาพสำรองก่อนนำเข้าคู่มือฉบับใหม่ (note ขึ้นต้น
 * "ฉบับก่อนนำเข้า") และเวอร์ชันที่ไม่มีร่องรอยกรณีทดสอบเลย
 */
import { query, pool } from '../src/config/db.js';

const APPLY = process.argv.includes('--apply');
const KEEP_NOTE = 'ฉบับก่อนนำเข้า%';

/** เวอร์ชันที่เนื้อในมีกรณีทดสอบ = เกิดจากชุดทดสอบแน่นอน */
const marked = async () => (await query(
  `select id, note, taken_at from sop_versions
    where data::text ~ '"title_th"\\s*:\\s*"ZZ'
      and note not like $1
    order by id`, [KEEP_NOTE])).rows;

/**
 * ภาพ "ก่อนเพิ่มกรณีทดสอบ" ไม่มีคำว่า ZZ อยู่ในตัวเอง จับจากการที่มันนั่งติดกับ
 * เวอร์ชันที่มี ZZ ในรอบเดียวกัน — รอบเดียวกันคือห่างกันไม่เกิน 10 นาที
 */
const neighbours = async () => (await query(
  `select v.id, v.note, v.taken_at from sop_versions v
    where v.note not like $1
      and v.data::text !~ '"title_th"\\s*:\\s*"ZZ'
      and exists (
        select 1 from sop_versions z
         where z.data::text ~ '"title_th"\\s*:\\s*"ZZ'
           and abs(extract(epoch from (z.taken_at - v.taken_at))) <= 600)
    order by v.id`, [KEEP_NOTE])).rows;

const rows = [...await marked(), ...await neighbours()].sort((a, b) => a.id - b.id);
const total = (await query('select count(*)::int n from sop_versions')).rows[0].n;

console.log(`ประวัติเวอร์ชันทั้งหมด ${total} รายการ · เข้าเกณฑ์ว่าเกิดจากการทดสอบ ${rows.length} รายการ`);
for (const r of rows.slice(0, 5)) console.log(`  #${r.id} ${String(r.taken_at).slice(0, 19)} ${r.note || ''}`);
if (rows.length > 5) console.log(`  … อีก ${rows.length - 5} รายการ`);

const keep = (await query(
  `select id, note, taken_at from sop_versions where note like $1 order by id`, [KEEP_NOTE])).rows;
console.log(`เก็บไว้แน่นอน ${keep.length} รายการ:`);
for (const r of keep) console.log(`  #${r.id} ${String(r.taken_at).slice(0, 19)} ${r.note}`);

if (!APPLY) {
  console.log('\nยังไม่ได้ลบ — สั่งซ้ำด้วย --apply ถ้าถูกต้องแล้ว');
} else if (rows.length) {
  const del = await query('delete from sop_versions where id = any($1::int[]) returning id',
    [rows.map((r) => r.id)]);
  console.log(`\nลบแล้ว ${del.rows.length} รายการ · เหลือ ${(await query('select count(*)::int n from sop_versions')).rows[0].n} รายการ`);
}
await pool.end();
