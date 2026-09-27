/**
 * ดึงเนื้อหาปฐมนิเทศ 90 วันออกจากต้นฉบับ Apps Script
 *
 *   node scripts/extract-onboarding.mjs "<path ไป ORIGINAL CODE/onboarding/src>"
 *
 * content.html ของต้นฉบับเป็น JavaScript ธรรมดาที่ประกอบ object PAGES ขึ้นมา
 * ด้วยฟังก์ชันช่วยไม่กี่ตัว (it / sr / phasePage / deptLanding / ph / img …)
 * วิธีที่เชื่อถือได้ที่สุดคือ **รันมันจริง** โดยวางฟังก์ชันปลอมให้ครบ แล้วอ่าน
 * PAGES ที่ได้ — ไม่ใช่ไล่ regex ทีละบรรทัด ซึ่งจะพลาดทันทีที่เนื้อหาขึ้นบรรทัดใหม่
 *
 * translations.html ก็รันแบบเดียวกันเพื่ออ่าน TH_DICT (พจนานุกรมของเขา คีย์ด้วย
 * ข้อความอังกฤษตรงตัว) แล้วจับคู่คำแปลไทยกลับเข้าเนื้อหาที่ extract ได้ ตัวเลข
 * ที่จับคู่ได้/ไม่ได้ต้องพิมพ์ออกมาเสมอ — คำแปลที่หลุดไปเงียบ ๆ คือหน้าจอที่
 * พนักงานเปิดโหมดไทยแล้วยังเห็นอังกฤษ ซึ่งเป็นอาการที่พาเรามาทำงานรอบนี้
 *
 *   --migration   เขียน supabase/migrations/0071_onboarding_th_and_docs.sql ทับ
 *                 (คำสั่ง alter … add column if not exists + update ทุกแถว)
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SRC = process.argv[2];
if (!SRC) { console.error('ต้องระบุ path ไปยังโฟลเดอร์ src ของ onboarding'); process.exit(1); }

const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');
/** ดึงเฉพาะเนื้อใน <script> ออกมา — ไฟล์เป็น partial ของ Apps Script ไม่ใช่ JS ล้วน */
const scripts = (html) => [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');

const sandbox = {
  // รูปทั้งหมดเป็น data URI ขนาดหลายเมกะไบต์ ไม่เอาเข้ามา — เก็บแค่ชื่อไว้อ้างอิง
  EMBEDDED_IMAGES: new Proxy({}, { get: (_, k) => `image:${String(k)}` }),
  console, window: {},
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(scripts(read('content.html')), sandbox, { timeout: 20000 });

const PAGES = sandbox.PAGES || {};
const NAV = sandbox.NAV || [];

// ── พจนานุกรมไทยของเขา ─────────────────────────────────────────────────────
// คีย์คือข้อความอังกฤษตรงตัว จับคู่ด้วยสตริงเท่ากันแบบเป๊ะเท่านั้น ไม่ normalize
// ช่องว่างหรือเครื่องหมายคำพูด — ถ้าจับไม่ได้ต้องเห็นว่าจับไม่ได้ ดีกว่าจับผิดข้อ
const dictBox = { console };
dictBox.window = dictBox;
vm.createContext(dictBox);
vm.runInContext(scripts(read('translations.html')), dictBox, { timeout: 20000 });
const TH = dictBox.TH_DICT || {};
const missed = [];
/** คำแปลไทยของข้อความอังกฤษหนึ่งข้อ — จำไว้ด้วยว่าข้อไหนไม่มีคำแปล */
const th = (en, where) => {
  if (!en) return null;
  const v = TH[en];
  if (v) return v;
  missed.push({ where, en });
  return null;
};

// ── แผนกและเฟส ────────────────────────────────────────────────────────────
const phasePages = Object.keys(PAGES).filter((k) => /-day-\d+-\d+$/.test(k));
const depts = {};
for (const key of phasePages) {
  const [, slug, range] = /^(.*)-day-(\d+-\d+)$/.exec(key);
  const p = PAGES[key];
  const blocks = (p.sections || [])
    .filter((s) => s.type === 'checklist')
    .map((s) => ({
      heading: s.heading,
      heading_th: th(s.heading, `block ${key}`),
      items: (s.items || []).map((it) => {
        const item = typeof it === 'string' ? { id: null, text: it, level: 'junior' } : { ...it };
        item.text_th = th(item.text, `item ${item.id || key}`);
        return item;
      }),
    }));
  const closing = (p.sections || []).find((s) => s.type === 'text' && !s.heading)?.body?.[0] || null;
  (depts[slug] ||= { slug, phases: [] }).phases.push({
    key, range, eyebrow: p.hero?.eyebrow || '', title: p.hero?.title || '',
    eyebrow_th: th(p.hero?.eyebrow, `phase eyebrow ${key}`),
    title_th: th(p.hero?.title, `phase title ${key}`),
    closing,
    closing_th: closing ? th(closing, `phase closing ${key}`) : null,
    next: p.nextPhase?.page || null,
    blocks,
  });
}
for (const d of Object.values(depts)) {
  d.phases.sort((a, b) => Number(a.range.split('-')[0]) - Number(b.range.split('-')[0]));
  // หน้าแนะนำแผนกอาจใช้ชื่อ key ไม่ตรงกับ slug ของเฟส (property vs property-asset-management)
  const landing = Object.keys(PAGES).find((k) => k === `${d.slug}-team`)
    || Object.keys(PAGES).find((k) => k.startsWith(d.slug) && !/-day-/.test(k));
  d.landingKey = landing || null;
  d.name = PAGES[landing]?.hero?.title || d.slug;
}

// ── เอกสารที่ต้องส่ง ───────────────────────────────────────────────────────
const docsPage = PAGES['required-documents'] || {};
const docs = (docsPage.sections || [])
  .flatMap((s) => (s.type === 'doclist' ? s.docs || s.items || [] : []))
  .map((d) => ({
    ...d,
    title_th: th(d.title, `doc ${d.id}`),
    desc_th: d.desc ? th(d.desc, `doc descr ${d.id}`) : null,
  }));

const out = {
  departments: Object.values(depts),
  requiredDocuments: docs,
  nav: NAV,
  pageKeys: Object.keys(PAGES),
};
const allItems = out.departments.flatMap((d) => d.phases.flatMap((p) => p.blocks.flatMap((b) => b.items)));
const allPhases = out.departments.flatMap((d) => d.phases);
const allBlocks = allPhases.flatMap((p) => p.blocks);
// หัวบล็อกไม่มี id ถาวรของตัวเอง (seed ลบแล้วสร้างใหม่ทุกครั้ง) จึงจับคู่คำแปล
// ด้วยข้อความหัวบล็อกเอง — สามข้อความ ใช้ซ้ำทั้ง 45 บล็อก
const blockHeadings = [...new Map(allBlocks.map((b) => [b.heading, b.heading_th])).entries()];

const counts = {
  แผนก: out.departments.length,
  เฟส: allPhases.length,
  รายการเช็กลิสต์: allItems.length,
  เอกสารที่ต้องส่ง: docs.length,
  หน้าเนื้อหาทั้งหมด: out.pageKeys.length,
  คำแปลไทยของรายการ: `${allItems.filter((i) => i.text_th).length}/${allItems.length}`,
  คำแปลไทยของเฟส: `${allPhases.filter((p) => p.eyebrow_th && p.title_th).length}/${allPhases.length}`,
  คำแปลไทยของหัวบล็อก: `${blockHeadings.filter(([, v]) => v).length}/${blockHeadings.length}`,
  คำแปลไทยของเอกสาร: `${docs.filter((d) => d.title_th).length}/${docs.length}`,
  ลิงก์เอกสาร: `${docs.filter((d) => d.viewUrl).length} ดู · ${docs.filter((d) => d.downloadUrl).length} ดาวน์โหลด`,
};
console.log(JSON.stringify(counts, null, 1));
if (missed.length) {
  console.log(`\nไม่มีคำแปลไทย ${missed.length} ข้อ:`);
  for (const m of missed.slice(0, 40)) console.log(`  · [${m.where}] ${m.en.slice(0, 80)}`);
  if (missed.length > 40) console.log(`  … อีก ${missed.length - 40} ข้อ`);
}
fs.writeFileSync(new URL('./onboarding-content.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('เขียนแล้ว scripts/onboarding-content.json');

// ── สร้างไฟล์ migration ────────────────────────────────────────────────────
// เขียนไฟล์ ไม่รันเอง — ระบบ dev รัน migration กับฐานข้อมูลจริงตอนบูต จึงต้อง
// เป็นคำสั่งที่เพิ่มคอลัมน์/เติมข้อมูลเท่านั้น (if not exists + update) โค้ดเก่า
// ที่ยังไม่รู้จักคอลัมน์ใหม่ต้องทำงานต่อได้เหมือนเดิม
if (process.argv.includes('--migration')) {
  const q = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
  const L = [];
  L.push(`-- ═══════════════════════════════════════════════════════════════════════════
-- ปฐมนิเทศพนักงานใหม่ — คำแปลไทยของเนื้อหา และลิงก์เอกสาร 8 ฉบับ
--
-- สร้างจาก backend/scripts/extract-onboarding.mjs --migration ไม่ได้พิมพ์มือ
-- คำแปลทุกบรรทัดมาจาก TH_DICT ใน translations.html ของลูกค้าตรงตัว จับคู่ด้วย
-- ข้อความอังกฤษเดิมแบบเท่ากันเป๊ะ — ไม่มีการแปลเพิ่มเองแม้แต่ข้อเดียว
--
-- เพิ่มคอลัมน์เท่านั้น ไม่แก้ ไม่ลบของเดิม: โค้ดที่ยังไม่รู้จักคอลัมน์ *_th
-- อ่านคอลัมน์อังกฤษเดิมได้เหมือนเคย ระบบ dev รัน migration กับฐานข้อมูลจริง
-- ตอนบูต ไฟล์นี้จึงต้องปลอดภัยกับโค้ดรุ่นก่อนหน้าด้วย
--
-- migration 0059 สร้าง ob_documents ไว้โดยไม่มีที่เก็บลิงก์ ทั้งที่เนื้อหา
-- ต้นฉบับมีทั้ง viewUrl (เปิดอ่านในเบราว์เซอร์) และ downloadUrl (บังคับ
-- ดาวน์โหลด) — เอกสารสองชนิดใช้รูป URL ต่างกัน (ไฟล์ใน Drive กับ Google Doc)
-- จึงเก็บสองคอลัมน์ ไม่ใช่คำนวณอันหนึ่งจากอีกอันหนึ่ง
-- ═══════════════════════════════════════════════════════════════════════════

alter table ob_items      add column if not exists text_th     text;
alter table ob_phases     add column if not exists eyebrow_th  text;
alter table ob_phases     add column if not exists title_th    text;
alter table ob_phases     add column if not exists closing_th  text;
alter table ob_blocks     add column if not exists heading_th  text;
alter table ob_documents  add column if not exists title_th    text;
alter table ob_documents  add column if not exists descr_th    text;
alter table ob_documents  add column if not exists view_url    text;
alter table ob_documents  add column if not exists download_url text;

-- ใบเสร็จการอัปโหลด: ชนิดไฟล์ที่ส่งกลับตอนเปิดดู (file_name/storage_key มีอยู่แล้ว)
alter table ob_doc_submissions add column if not exists content_type text;

comment on column ob_items.text_th is
  'คำแปลไทยจาก TH_DICT ของลูกค้า · ว่าง = ยังไม่มีคำแปล ให้หน้าจอถอยไปใช้ text อังกฤษ';
comment on column ob_documents.view_url is
  'ลิงก์เปิดอ่านเอกสารต้นแบบในเบราว์เซอร์ (Drive preview / Google Docs)';
comment on column ob_documents.download_url is
  'ลิงก์บังคับดาวน์โหลดเอกสารต้นแบบ — ไม่ใช่ไฟล์ที่พนักงานอัปโหลดกลับ';
`);

  L.push(`\n-- ── หัวบล็อก ${blockHeadings.length} ข้อความ (ใช้ซ้ำทั้ง ${allBlocks.length} บล็อก) ──`);
  for (const [heading, thai] of blockHeadings) {
    L.push(`update ob_blocks set heading_th = ${q(thai)} where heading = ${q(heading)};`);
  }

  L.push(`\n-- ── ${allPhases.length} เฟส: eyebrow + title (+ closing ถ้ามี) ──`);
  for (const p of allPhases) {
    L.push(`update ob_phases set eyebrow_th = ${q(p.eyebrow_th)}, title_th = ${q(p.title_th)}`
      + `, closing_th = ${q(p.closing_th)} where id = ${q(p.key)};`);
  }

  L.push(`\n-- ── ${docs.length} เอกสาร: ชื่อ คำบรรยาย และลิงก์ดู/ดาวน์โหลด ──`);
  for (const d of docs) {
    L.push(`update ob_documents set title_th = ${q(d.title_th)}, descr_th = ${q(d.desc_th)}`
      + `, view_url = ${q(d.viewUrl || null)}, download_url = ${q(d.downloadUrl || null)}`
      + ` where id = ${q(d.id)};`);
  }

  L.push(`\n-- ── ${allItems.length} ข้อเช็กลิสต์ จับคู่ด้วย id ถาวรของรายการ ──`);
  for (const it of allItems) {
    if (!it.id) continue;
    L.push(`update ob_items set text_th = ${q(it.text_th)} where id = ${q(it.id)};`);
  }

  const target = new URL('../../supabase/migrations/0071_onboarding_th_and_docs.sql', import.meta.url);
  fs.writeFileSync(target, `${L.join('\n')}\n`);
  console.log(`เขียนแล้ว supabase/migrations/0071_onboarding_th_and_docs.sql (${L.length} บรรทัดคำสั่ง)`);
}
