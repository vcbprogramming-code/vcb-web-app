/**
 * อัปรูปของพอร์ทัลปฐมนิเทศขึ้นที่เก็บไฟล์ของโครงการ แล้วจดคีย์ไว้ในฐานข้อมูล
 *
 *   node scripts/upload-onboarding-images.mjs "<path ไป .../onboarding/src>"
 *   node scripts/upload-onboarding-images.mjs "<path>" --write
 *
 * ต้นฉบับของลูกค้าฝังรูปทั้ง 37 ภาพเป็น data URI ไว้ใน images.html ไฟล์เดียว
 * ขนาด 7.3 MB — เอาเข้า repo ไม่ได้ (โคลนช้าลงถาวรและแก้ไม่ได้ย้อนหลัง) และฝัง
 * ลง bundle ของหน้าเว็บก็ไม่ได้ (หน้าจอเดียวโหลด 5 MB ก่อนวาดอะไรได้) ที่ถูกคือ
 * เอาขึ้นที่เก็บไฟล์เดียวกับไฟล์แนบของทุกโมดูล (Supabase Storage ผ่าน S3 facade
 * ที่ src/config/storage.js ห่อไว้) แล้วเก็บแต่ path ไว้ในฐานข้อมูล
 *
 * ไม่ทำอะไรเลยถ้าไม่ใส่ --write — พิมพ์ว่าจะอัปอะไรกี่ไบต์เท่านั้น
 *
 * รันซ้ำได้: key เป็น path คงที่ (onboarding-content/<คีย์>.<สกุล>) การอัปรอบใหม่
 * จึงเขียนทับตัวเอง ไม่ทิ้งไฟล์กำพร้าไว้ในที่เก็บ
 */
import fs from 'node:fs';
import path from 'node:path';
import { putObject } from '../src/config/storage.js';
import { query, queryOne } from '../src/config/db.js';

const SRC = process.argv[2];
const write = process.argv.includes('--write');
if (!SRC) {
  console.error('ต้องระบุ path ไปยังโฟลเดอร์ src ของ onboarding (ที่มี images.html)');
  process.exit(1);
}

const EXT = { 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/jpeg': 'jpg' };

/**
 * ถอด data URI ทุกข้อออกจาก images.html
 *
 * คีย์ซ้ำสองคู่ (losPowerHouseReal, losNavigationLockReal ประกาศสองครั้ง) —
 * ใช้ Map เพื่อให้ "ตัวหลังทับตัวหน้า" เหมือนที่ JavaScript ทำกับ object literal
 * จริง มิฉะนั้นเราจะอัปรูปคนละใบกับที่หน้าจอของเขาแสดง
 */
function readImages() {
  const raw = fs.readFileSync(path.join(SRC, 'images.html'), 'utf8');
  const re = /([A-Za-z0-9_]+)\s*:\s*"data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)"/g;
  const found = new Map();
  let m;
  let dupes = 0;
  while ((m = re.exec(raw))) {
    if (found.has(m[1])) dupes++;
    found.set(m[1], { contentType: m[2], buffer: Buffer.from(m[3], 'base64') });
  }
  return { found, dupes };
}

/** คีย์ที่เนื้อหาอ้างถึงจริง — ไฟล์ที่ไม่มีใครอ้างก็ไม่ต้องอัป */
function wantedKeys() {
  const p = new URL('./onboarding-pages.json', import.meta.url);
  if (!fs.existsSync(p)) {
    console.warn('ไม่พบ scripts/onboarding-pages.json — อัปทุกรูปที่อยู่ใน images.html\n'
      + '  (รัน extract-onboarding.mjs --pages ก่อน จะอัปเฉพาะรูปที่เนื้อหาใช้จริง)');
    return null;
  }
  return new Set(JSON.parse(fs.readFileSync(p, 'utf8')).images || []);
}

/**
 * ตรวจ magic bytes จริง ไม่เชื่อ MIME ที่เขียนไว้ใน data URI
 *
 * เหตุผลเดียวกับ utils/imageUpload.js: SVG เป็นเอกสาร XML ที่พา <script> มาได้
 * เสิร์ฟกลับจาก origin ของเราแล้วกลายเป็น stored XSS ที่นี่ต้นทางเป็นซอร์สของ
 * ลูกค้าไม่ใช่ผู้ใช้ภายนอก แต่การตรวจไม่ได้แพงและปิดช่องนั้นไปเลย
 */
function sniff(b) {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

const run = async () => {
  const { found, dupes } = readImages();
  const wanted = wantedKeys();
  const todo = [...found.entries()].filter(([k]) => !wanted || wanted.has(k));
  const skipped = [...found.keys()].filter((k) => wanted && !wanted.has(k));
  const missing = wanted ? [...wanted].filter((k) => !found.has(k)) : [];

  let bytes = 0;
  const rejected = [];
  for (const [key, v] of todo) {
    const real = sniff(v.buffer);
    if (!real) { rejected.push(key); continue; }
    v.contentType = real;
    bytes += v.buffer.length;
  }

  console.log(`พบรูปใน images.html ${found.size} คีย์${dupes ? ` (ประกาศซ้ำ ${dupes} ข้อ ตัวหลังชนะ)` : ''}`);
  console.log(`จะอัป ${todo.length - rejected.length} ไฟล์ · ${(bytes / 1024 / 1024).toFixed(1)} MB`);
  if (skipped.length) console.log(`ข้าม ${skipped.length} ไฟล์ที่ไม่มีเนื้อหาไหนอ้างถึง: ${skipped.join(', ')}`);
  if (rejected.length) console.log(`⚠️  ไม่ใช่รูป PNG/JPEG/GIF/WebP จริง ${rejected.length} ไฟล์: ${rejected.join(', ')}`);
  if (missing.length) console.log(`⚠️  เนื้อหาอ้างถึงแต่ไม่มีไฟล์ ${missing.length} คีย์: ${missing.join(', ')}`);

  if (!write) { console.log('\n(ยังไม่อัป — เติม --write)'); return; }

  let ok = 0;
  const failed = [];
  for (const [key, v] of todo) {
    if (rejected.includes(key)) continue;
    const storageKey = `onboarding-content/${key}.${EXT[v.contentType] || 'jpg'}`;
    try {
      // อัปไฟล์ก่อน จดแถวทีหลัง — แถวที่ชี้ไปยังไฟล์ที่ไม่มีอยู่คือรูปเสียบนหน้าจอ
      // ซึ่งมองไม่ออกว่าเป็นของใคร ส่วนไฟล์ที่ยังไม่มีแถวคือแค่ไฟล์ที่ยังไม่ถูกใช้
      await putObject(storageKey, v.buffer, v.contentType);
      await query(
        `insert into ob_images (key, storage_key, content_type, byte_size)
         values ($1,$2,$3,$4)
         on conflict (key) do update set storage_key = excluded.storage_key,
           content_type = excluded.content_type, byte_size = excluded.byte_size,
           uploaded_at = now()`,
        [key, storageKey, v.contentType, v.buffer.length]);
      ok++;
    } catch (e) {
      failed.push(`${key}: ${e.message}`);
    }
  }
  if (failed.length) {
    console.error(`\n❌ อัปไม่สำเร็จ ${failed.length} ไฟล์:`);
    failed.forEach((f) => console.error(`  · ${f}`));
  }
  const n = await queryOne('select count(*)::int c, coalesce(sum(byte_size),0)::bigint b from ob_images');
  console.log(`\n✅ อัปแล้ว ${ok} ไฟล์ · ob_images มี ${n.c} แถว รวม ${(Number(n.b) / 1024 / 1024).toFixed(1)} MB`);
  if (failed.length) process.exitCode = 1;
};

run().then(() => process.exit(process.exitCode || 0)).catch((e) => { console.error(e); process.exit(1); });
