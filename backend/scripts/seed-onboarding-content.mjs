/**
 * นำเนื้อหา "หน้าเนื้อหา" ของพอร์ทัลปฐมนิเทศเข้าฐานข้อมูลอีกครั้ง
 *
 *   node scripts/seed-onboarding-content.mjs           ดูว่าจะเปลี่ยนอะไร
 *   node scripts/seed-onboarding-content.mjs --write   เขียนจริง
 *
 * ทำไมต้องมีสคริปต์นี้ทั้งที่เนื้อหาอยู่ใน migration 0084 แล้ว:
 * ตัวรัน migration จดชื่อไฟล์ที่รันแล้วไว้ใน schema_migrations และข้ามไฟล์นั้น
 * ตลอดไป — ฐานข้อมูลที่รัน 0084 ไปแล้วจึงไม่รับเนื้อหาที่แก้ทีหลัง (เช่นตอนเจอ
 * ว่าคำแปล caption ของแกลเลอรีหลุดไป) การเพิ่มเลข migration ใหม่ทุกครั้งที่แก้
 * คำหนึ่งคำคือประวัติที่อ่านไม่รู้เรื่อง สคริปต์นี้จึงรัน **ไฟล์ 0084 ตัวเดียวกัน**
 * ซ้ำอีกครั้ง ได้ผลเหมือนกันทุกครั้งเพราะทุกคำสั่งในไฟล์นั้นรันซ้ำได้
 * (create table if not exists · insert … on conflict do update · delete ก่อน insert)
 *
 * ปลอดภัยกับข้อมูลของพนักงาน: ไฟล์นั้นแตะแต่ ob_pages / ob_sections / ob_images
 * ซึ่งเป็น "เนื้อหา" ไม่มีใครติ๊กอะไรไว้ในนั้น ต่างจาก ob_items ที่ความคืบหน้า
 * ผูกกับ id — ตารางนั้นไม่อยู่ในไฟล์นี้เลย
 */
import fs from 'node:fs';
import { pool, queryOne } from '../src/config/db.js';

const FILE = new URL('../../supabase/migrations/0084_onboarding_content_pages.sql', import.meta.url);
const write = process.argv.includes('--write');

const run = async () => {
  const sql = fs.readFileSync(FILE, 'utf8');
  const touched = [...sql.matchAll(/^(?:insert into|delete from|create table if not exists|alter table)\s+(\w+)/gim)]
    .map((m) => m[1]);
  const safe = ['ob_pages', 'ob_sections', 'ob_images'];
  const unexpected = [...new Set(touched)].filter((tb) => !safe.includes(tb));
  if (unexpected.length) {
    // กันไว้ตรง ๆ: ถ้าวันหนึ่งไฟล์ 0084 ถูกแก้ให้ไปแตะตารางที่ความคืบหน้าของ
    // พนักงานผูกอยู่ การรันซ้ำจะไม่ใช่การรันซ้ำที่ไม่มีผลข้างเคียงอีกต่อไป
    console.error(`❌ ไฟล์ 0084 แตะตารางที่สคริปต์นี้ไม่ได้ออกแบบมาให้รันซ้ำ: ${unexpected.join(', ')}`);
    process.exit(1);
  }

  const before = await queryOne(
    `select (select count(*) from ob_pages)::int p, (select count(*) from ob_sections)::int s`)
    .catch(() => ({ p: 0, s: 0 }));
  console.log(`ก่อนรัน: ${before.p} หน้า · ${before.s} section`);
  if (!write) { console.log('(ยังไม่เขียน — เติม --write)'); return; }

  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(sql);
    await c.query('commit');
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally { c.release(); }

  const after = await queryOne(
    `select (select count(*) from ob_pages)::int p, (select count(*) from ob_sections)::int s,
            (select count(*) from ob_images)::int i`);
  console.log(`✅ หลังรัน: ${after.p} หน้า · ${after.s} section · รูป ${after.i} ไฟล์`);
};

run().then(() => process.exit(0)).catch((e) => { console.error(e.message || e); process.exit(1); });
