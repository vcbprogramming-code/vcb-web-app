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
 *   --pages       ดึง "หน้าเนื้อหา" ทุกหน้าและ section ทุกชนิด (ไม่ใช่แค่ checklist)
 *                 ออกมาเป็น scripts/onboarding-pages.json แล้วเขียน migration
 *                 supabase/migrations/0084_onboarding_content_pages.sql
 *   --images <dir> ถอดรูป base64 จาก images.html ออกเป็นไฟล์จริงในโฟลเดอร์ที่ระบุ
 *                 (ไม่เอาเข้า repo — ส่งต่อให้ upload-onboarding-images.mjs อัปขึ้น
 *                 ที่เก็บไฟล์ของโครงการ แล้วเก็บแค่ URL ไว้ในฐานข้อมูล)
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

// ═══════════════════════════════════════════════════════════════════════════
// ส่วนที่ 2 — "หน้าเนื้อหา" ทุกหน้าและ section ทุกชนิด
//
// รอบแรกดึงมาแค่ section ชนิด checklist (180 ข้อของ 5 แผนก × 3 เฟส) ซึ่งเป็น
// แกนของโปรแกรม แต่พอร์ทัลของลูกค้ามี section อีกสิบชนิดที่ไม่ได้ถูกดึงมาเลย:
// สารจากกรรมการผู้จัดการ · ค่านิยม · คารูเซลผลงาน · ผังองค์กร · โครงสร้างกลุ่ม
// บริษัท · หน้าแนะนำแผนก 5 หน้า · รู้จักทีมของเรา · ชีวิตในไซต์งาน · หน้าจบ
//
// สิ่งที่ต้องระวังสามข้อ:
//   1. ลำดับ section สำคัญ — เก็บ sort_order ไว้ ไม่ใช่พึ่งลำดับใน jsonb
//   2. รูปในต้นฉบับเป็น data URI หลายเมกะไบต์ ที่นี่เก็บแต่ "ชื่อคีย์" ของรูป
//      (ObImage ฝั่งหน้าจอไปเรียกไฟล์จริงจากที่เก็บไฟล์ของโครงการทีหลัง)
//   3. คำแปลไทยมาจาก TH_DICT ของเขาเท่านั้น ไม่มีคำแปลก็ปล่อยเป็น null ให้
//      หน้าจอถอยไปใช้อังกฤษ — ชื่อคน 184 คน ป้ายฝ่าย และ caption แกลเลอรี
//      ในระบบของเขาเป็นอังกฤษล้วน ห้ามแปลเพิ่มเอง
// ═══════════════════════════════════════════════════════════════════════════

/** field ที่เป็น "ข้อความที่คนอ่าน" จึงต้องหาคำแปลไทยให้ — นอกลิสต์นี้ไม่แตะ */
const TRANSLATABLE = new Set([
  'heading', 'subheading', 'eyebrow', 'title', 'lead', 'note', 'intro', 'footer',
  'quote', 'attribution', 'caption', 'name', 'desc', 'focus', 'label', 'sub', 'role',
  'body', 'bullets', 'chartSubheading', 'groupSubheading', 'groupName', 'action', 'items',
]);
/**
 * field ที่เป็นข้อมูลของเครื่อง ไม่ใช่ข้อความ — ห้ามส่งเข้าพจนานุกรมเด็ดขาด
 *
 * `images` **ไม่อยู่** ในลิสต์นี้ทั้งที่ชื่อฟังดูเหมือนรูป: หลัง normalizeImages
 * มันเป็นอาเรย์ของ { imageKey, caption } และ caption นั้นคือข้อความที่คนอ่าน
 * (แกลเลอรี "Site Facilities" มี caption สามข้อที่ TH_DICT ของเขาแปลไว้ครบ —
 * ประตูเรือสัญจร / อาคารโรงไฟฟ้า / ทางระบายน้ำล้น) การใส่ `images` ไว้ในลิสต์นี้
 * ทำให้คำแปลสามข้อนั้นหลุดไปเงียบ ๆ ตัว imageKey/className/alt ถูกกันไว้ราย
 * field อยู่แล้ว การเดินเข้าไปข้างในจึงปลอดภัย
 */
const NEVER_TRANSLATE = new Set([
  'image', 'icon', 'page', 'url', 'viewUrl', 'downloadUrl', 'id', 'deptId',
  'sectionId', 'band', 'type', 'hqDept', 'location', 'level', 'pct', 'alt',
  'imageKey', 'className', 'photo', 'portrait',
]);

/**
 * คำแปลไทยของประโยคที่ต้นฉบับเขียนคนละเรื่องกับอังกฤษ — ตัดออก ไม่ใช่แปลใหม่
 *
 * TH_DICT ของเขาแปลประโยคของ CVN Development ("Develops property ventures on
 * behalf of Vichitbhan Group, currently being established.") เป็น "บริษัทลูก
 * ของวิจิตรภัณฑ์ก่อสร้างซึ่งอยู่ระหว่างการพัฒนาเพื่อขึ้นทะเบียนชั้นหนึ่งพิเศษ"
 * ซึ่งพูดถึงการขึ้นทะเบียนผู้รับเหมาชั้นพิเศษ ไม่ใช่ธุรกิจอสังหาริมทรัพย์เลย
 * คนละความหมายกันคนละเรื่อง การลอกมาทั้งคู่คือหน้าจอไทยที่บอกข้อมูลผิด เราจึง
 * ทิ้งคำแปลข้อนี้ให้เป็น null (หน้าจอถอยไปใช้อังกฤษซึ่งถูก) และไม่แปลเองแทน
 * เพราะกติการอบนี้คือห้ามแปลเพิ่ม
 */
const TH_REJECT = new Set([
  'Develops property ventures on behalf of Vichitbhan Group, currently being established.',
]);

const fixes = [];   // จุดที่ต้นฉบับผิดแล้วเราแก้ — ต้องรายงานทุกข้อ
const pageMissed = [];

/** คำแปลไทยของข้อความหนึ่งข้อในหน้าเนื้อหา · null = ไม่มี ให้ถอยไปใช้อังกฤษ */
const pth = (en, where) => {
  if (typeof en !== 'string' || !en.trim()) return null;
  if (TH_REJECT.has(en)) return null;
  const v = TH[en];
  if (v) return v;
  pageMissed.push({ where, en });
  return null;
};

/**
 * การอ้างรูปในต้นฉบับมาสองรูปแบบ — ทำให้เป็นรูปแบบเดียวก่อนอย่างอื่น
 *
 *   'image:losSafetyReal1'                          (slides[].image, values[].icon,
 *                                                    quote.portrait, gallery.images[])
 *   '<img class="content-image" src="image:…" alt="…">'   (img() ของเขา คืน HTML มาเลย)
 *
 * ทั้งสองแบบกลายเป็น { imageKey, alt?, className? } เหมือนกันหมด ฝั่งหน้าจอจึงมี
 * ทางเดียวที่ต้องรู้จัก และ HTML ดิบของเขาไม่หลุดเข้ามาให้ต้อง dangerouslySetInnerHTML
 */
const normImage = (v) => {
  if (typeof v !== 'string') return null;
  if (v.startsWith('image:')) return { imageKey: v.slice('image:'.length) };
  if (!v.startsWith('<img')) return null;
  const src = /src="([^"]*)"/.exec(v);
  if (!src || !src[1].startsWith('image:')) return null;
  return {
    imageKey: src[1].slice('image:'.length),
    alt: (/alt="([^"]*)"/.exec(v) || [, ''])[1] || null,
    className: (/class="([^"]*)"/.exec(v) || [, ''])[1] || null,
  };
};

/**
 * เดินทั้งต้นแล้วแทนการอ้างรูปทุกจุดด้วย { imageKey, … }
 *
 * `images: [...]` ของ gallery มีสองทรง (สตริงเดี่ยว หรือ { image, caption }) — แบน
 * ให้เป็น { imageKey, caption } ทรงเดียว เพื่อให้หน้าจอไม่ต้องแยกสองกรณี
 */
function normalizeImages(value, key) {
  if (Array.isArray(value)) {
    if (key === 'images') {
      return value.map((e) => {
        const direct = normImage(e);
        if (direct) return direct;
        if (e && typeof e === 'object') {
          const { image, ...rest } = e;
          return { ...(normImage(image) || {}), ...normalizeImages(rest, null) };
        }
        return e;
      });
    }
    return value.map((v) => normalizeImages(v, key));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const img = normImage(v);
      out[k] = img || normalizeImages(v, k);
    }
    return out;
  }
  return normImage(value) || value;
}

/**
 * เดินโครงสร้างที่ extract ได้ทั้งต้น แล้วเติมคำแปลไทยเป็น field คู่ (`x` → `x_th`)
 *
 * เดินเองไม่ใช้ JSON.stringify replacer เพราะต้องรู้ "ชื่อ field" ของค่าที่กำลัง
 * มองอยู่ ถึงจะตัดสินได้ว่าข้อความนั้นเป็นของคนอ่านหรือเป็นข้อมูลของเครื่อง
 */
function withThai(value, key, where) {
  if (Array.isArray(value)) return value.map((v, i) => withThai(v, key, `${where}[${i}]`));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (NEVER_TRANSLATE.has(k)) { out[k] = v; continue; }
      out[k] = withThai(v, k, `${where}.${k}`);
      if (TRANSLATABLE.has(k)) {
        if (typeof v === 'string') {
          const th = pth(v, `${where}.${k}`);
          if (th) out[`${k}_th`] = th;
        } else if (Array.isArray(v) && v.every((x) => typeof x === 'string')) {
          const arr = v.map((x, i) => pth(x, `${where}.${k}[${i}]`));
          if (arr.some(Boolean)) out[`${k}_th`] = arr;
        }
      }
    }
    return out;
  }
  // สตริงเดี่ยวที่ไม่มี field ครอบ (สมาชิกของ body/bullets) — คำแปลถูกเติมไว้
  // ที่ระดับ field ข้างบนแล้วเป็นอาเรย์คู่กัน ที่นี่คืนค่าเดิม
  return value;
}

// ── หน้าที่ต้องเก็บ ────────────────────────────────────────────────────────
// หน้าเฟส (…-day-N-M) ไม่เก็บ เพราะเนื้อหาอยู่ใน ob_phases/ob_blocks/ob_items แล้ว
// section ชนิด checklist และ doclist ก็ไม่เก็บ ด้วยเหตุผลเดียวกัน (ob_items /
// ob_documents เป็นตัวหลัก) — เก็บซ้ำสองที่คือสองแหล่งความจริงที่ไม่ตรงกันในวันหนึ่ง
const SKIP_SECTION_TYPES = new Set(['checklist', 'doclist']);
const PAGE_KIND = {
  home: 'home', 'required-documents': 'preboarding', completion: 'completion',
  'meet-our-team': 'feature', 'life-on-site': 'feature',
};
const DEPT_OF_PAGE = {
  'accounting-team': 'accounting', 'finance-team': 'finance', 'procurement-team': 'procurement',
  'property-asset-management': 'property', 'engineering-team': 'engineering',
};
const PAGE_ORDER = ['home', 'required-documents', 'accounting-team', 'finance-team',
  'procurement-team', 'property-asset-management', 'engineering-team',
  'meet-our-team', 'life-on-site', 'completion'];

/** section หนึ่งอัน → แถวของ ob_sections (แยกหัวข้อออกเป็นคอลัมน์ ที่เหลือลง jsonb) */
function sectionRow(sec, pageKey, order) {
  const clean = withThai(normalizeImages(sec, null), null, `${pageKey}#${order}`);
  const { type, sectionId, band, heading, heading_th: hTh, subheading, subheading_th: sTh,
    eyebrow, eyebrow_th: eTh, ...data } = clean;
  return {
    type, sortOrder: order, sectionId: sectionId || null, band: band || null,
    heading: heading || null, headingTh: hTh || null,
    subheading: subheading || null, subheadingTh: sTh || null,
    // eyebrow ของ section (deptgrid ใช้) ไม่มีคอลัมน์ของตัวเอง เก็บลง data
    data: { ...(eyebrow ? { eyebrow, ...(eTh ? { eyebrow_th: eTh } : {}) } : {}), ...data },
  };
}

const pages = [];
for (const key of PAGE_ORDER) {
  const p = PAGES[key];
  if (!p) { console.warn(`ไม่พบหน้า ${key} ในต้นฉบับ`); continue; }
  const hero = withThai(p.hero || {}, null, `${key}.hero`);
  const heroImage = typeof p.hero?.photo === 'string' && p.hero.photo.startsWith('image:')
    ? p.hero.photo.slice('image:'.length) : null;
  const secs = (p.sections || [])
    .filter((s) => !SKIP_SECTION_TYPES.has(s.type))
    .map((s, i) => sectionRow(s, key, i + 1));
  // หน้าจบมี "sections สำรอง" สำหรับคนที่ยังทำไม่ครบ (notCompleteSections ของเขา)
  const notDone = (p.notCompleteSections || []).map((s, i) => sectionRow(s, `${key}!notdone`, i + 1));
  pages.push({
    key, kind: PAGE_KIND[key] || 'dept', deptSlug: DEPT_OF_PAGE[key] || null,
    sortOrder: PAGE_ORDER.indexOf(key) + 1,
    title: hero.title || key, titleTh: hero.title_th || null,
    eyebrow: hero.eyebrow || null, eyebrowTh: hero.eyebrow_th || null,
    lead: hero.lead || null, leadTh: hero.lead_th || null,
    note: hero.note || null, noteTh: hero.note_th || null,
    heroImage,
    closing: p.closing ? withThai(p.closing, null, `${key}.closing`) : null,
    sections: secs, notCompleteSections: notDone,
  });
}

// ── แก้จุดที่ต้นฉบับผิด ────────────────────────────────────────────────────
// (1) adminDepartments ของทุกโครงการผูก "HR - Administration" ไว้กับ hqDept
//     'procurement' ทั้งที่ผังมีฝ่าย 'hr' (Human Resources) อยู่จริง ป้าย
//     "Reports to …" ของเจ้าหน้าที่บุคคล/ธุรการที่ไซต์งานจึงขึ้นว่ารายงานต่อ
//     ฝ่ายจัดซื้อ ซึ่งผิดตามคำอธิบายของเขาเองว่าเส้นประคือ "ต่อฝ่ายที่ HQ ที่ตรง
//     กับหน้าที่ของคนนั้น" — แก้เป็น 'hr'
const homeOrg = pages.find((p) => p.key === 'home')?.sections.find((s) => s.type === 'orgchart');
if (homeOrg) {
  const deptIds = new Set((homeOrg.data.departments || []).map((d) => d.id));
  for (const proj of homeOrg.data.projectManagers?.projects || []) {
    for (const ad of proj.adminDepartments || []) {
      if (/^HR/i.test(ad.label || '') && ad.hqDept !== 'hr' && deptIds.has('hr')) {
        fixes.push(`${proj.id}: "${ad.label}" hqDept ${ad.hqDept} → hr`);
        ad.hqDept = 'hr';
      }
    }
  }
}
// (2) IMAGES.wfAccountingTeamPhoto ถูกอ้างใน deptLanding ของฝ่ายบัญชี แต่ไม่ได้
//     ประกาศไว้ที่ไหนเลย ทั้งใน IMAGES และ EMBEDDED_IMAGES — ของเขาจึงได้
//     image: null เหมือนอีกสี่แผนก ไม่ใช่ "รูปทีมที่หายไป" เราไม่เดารูปมาใส่แทน
//     (ตารางรองรับ field รูปทีมไว้ให้ฝ่ายบุคคลเติมภายหลังได้)
{
  const src = read('content.html');
  if (/teamImage:\s*IMAGES\.wfAccountingTeamPhoto/.test(src) && !/wfAccountingTeamPhoto\s*:/.test(src)) {
    fixes.push('accounting-team: teamImage อ้าง IMAGES.wfAccountingTeamPhoto ที่ไม่มีอยู่จริง — '
      + 'ไม่มีไฟล์รูปทีมฝ่ายบัญชีในต้นฉบับ จึงไม่แสดงรูป (เหมือนที่ของเขาแสดงจริง)');
  }
}
// (3) คำแปลไทยของ CVN Development ที่เขียนคนละเรื่อง — ตัดออกไปแล้วใน TH_REJECT
for (const en of TH_REJECT) {
  if (TH[en]) fixes.push(`ทิ้งคำแปลไทยที่ความหมายไม่ตรงกับอังกฤษ: "${en.slice(0, 60)}…"`);
}

// ── รูปที่เนื้อหาอ้างถึง ───────────────────────────────────────────────────
// normalizeImages() แปลงทุกการอ้างรูปเป็น { imageKey } ไปแล้ว จึงเหลือเดินหา
// field ชื่อ imageKey เท่าที่มี — ไม่ต้องรู้จักทรงของแต่ละชนิด section อีก
const imageKeys = new Set();
(function collect(v) {
  if (Array.isArray(v)) return v.forEach(collect);
  if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      if (k === 'imageKey' && typeof x === 'string') imageKeys.add(x);
      else collect(x);
    }
  }
})(pages);
for (const p of pages) if (p.heroImage) imageKeys.add(p.heroImage);

if (process.argv.includes('--pages')) {
  const secCount = pages.reduce((a, p) => a + p.sections.length + p.notCompleteSections.length, 0);
  const byType = {};
  for (const p of pages) for (const s of [...p.sections, ...p.notCompleteSections]) byType[s.type] = (byType[s.type] || 0) + 1;
  console.log('\n── หน้าเนื้อหา ─────────────────────────────────────────');
  console.log(JSON.stringify({
    หน้า: pages.length, section: secCount, ชนิดsection: byType,
    รูปที่เนื้อหาอ้างถึง: imageKeys.size,
  }, null, 1));
  if (fixes.length) { console.log('\nแก้จุดที่ต้นฉบับผิด:'); fixes.forEach((f) => console.log(`  · ${f}`)); }
  console.log(`\nไม่มีคำแปลไทย ${pageMissed.length} ข้อความ (คงอังกฤษตามต้นฉบับ)`);

  fs.writeFileSync(new URL('./onboarding-pages.json', import.meta.url),
    JSON.stringify({ pages, images: [...imageKeys].sort(), fixes }, null, 1));
  console.log('เขียนแล้ว scripts/onboarding-pages.json');
  writePagesMigration(pages, [...imageKeys].sort(), byType, secCount);
}

// ── รูป base64 → ไฟล์จริง ──────────────────────────────────────────────────
// images.html เป็น object ตัวเดียวขนาด 7.3 MB ที่มี data URI 37 ข้อ (คีย์ซ้ำ 2
// คู่ ตัวหลังชนะเหมือน JS จริง) ถอดออกเป็นไฟล์ .jpg/.png แล้วให้สคริปต์อัปโหลด
// เอาไปขึ้นที่เก็บไฟล์ของโครงการ — ไม่เอา base64 เข้า repo และไม่ฝังใน bundle
const imgDirArg = process.argv.indexOf('--images');
if (imgDirArg > -1) {
  const dir = process.argv[imgDirArg + 1];
  if (!dir) { console.error('--images ต้องระบุโฟลเดอร์ปลายทาง'); process.exit(1); }
  fs.mkdirSync(dir, { recursive: true });
  const raw = read('images.html');
  const re = /([A-Za-z0-9_]+)\s*:\s*"data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)"/g;
  const found = new Map();  // คีย์ซ้ำ: ตัวหลังทับตัวหน้า ตรงกับที่ JS ทำ
  let m;
  while ((m = re.exec(raw))) found.set(m[1], { type: m[2], b64: m[3] });
  const manifest = [];
  for (const [key, v] of found) {
    const ext = v.type === 'image/png' ? 'png' : v.type === 'image/webp' ? 'webp' : 'jpg';
    const buf = Buffer.from(v.b64, 'base64');
    fs.writeFileSync(path.join(dir, `${key}.${ext}`), buf);
    manifest.push({ key, file: `${key}.${ext}`, contentType: v.type, bytes: buf.length });
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 1));
  const mb = (manifest.reduce((a, x) => a + x.bytes, 0) / 1024 / 1024).toFixed(1);
  console.log(`\nถอดรูปแล้ว ${manifest.length} ไฟล์ (${mb} MB) ไปที่ ${dir}`);
  const unused = manifest.filter((x) => !imageKeys.has(x.key)).map((x) => x.key);
  const missing = [...imageKeys].filter((k) => !found.has(k));
  if (unused.length) console.log(`  · ไม่มีเนื้อหาไหนอ้างถึง ${unused.length} ไฟล์: ${unused.join(', ')}`);
  if (missing.length) console.log(`  · เนื้อหาอ้างถึงแต่ไม่มีไฟล์ ${missing.length} คีย์: ${missing.join(', ')}`);
}

/** migration 0084 — สร้างตารางแล้วเติมเนื้อหา คำสั่งทุกบรรทัดรันซ้ำได้ */
function writePagesMigration(pageRows, imgKeys, byType, secCount) {
  const q = (v) => (v == null || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
  const j = (v) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  const L = [];
  L.push(`-- ═══════════════════════════════════════════════════════════════════════════
-- ปฐมนิเทศพนักงานใหม่ — "หน้าเนื้อหา" ของพอร์ทัลลูกค้า ${pageRows.length} หน้า · ${secCount} section
--
-- สร้างจาก backend/scripts/extract-onboarding.mjs --pages ไม่ได้พิมพ์มือ
-- ชนิด section ที่นำเข้า: ${Object.entries(byType).map(([k, v]) => `${k}×${v}`).join(' · ')}
--
-- migration 0059 เก็บ "แกน" ของโปรแกรมไว้ครบ (แผนก เฟส บล็อก 180 ข้อ เอกสาร 8
-- ฉบับ) แต่สคริปต์ที่ดึงเนื้อหามาอ่านแต่ section ชนิด checklist อีกสิบชนิดจึง
-- หายไปทั้งหมด: สารจากกรรมการผู้จัดการ ค่านิยม คารูเซลผลงาน ผังองค์กร
-- โครงสร้างกลุ่มบริษัท หน้าแนะนำแผนก 5 หน้า รู้จักทีมของเรา ชีวิตในไซต์งาน
-- และหน้าจบ ไฟล์นี้เติมส่วนนั้นเข้ามา
--
-- เพิ่มอย่างเดียว ไม่แก้ไม่ลบของเดิม: ตารางทั้งสามเป็นตารางใหม่ล้วน โค้ดรุ่นก่อน
-- ที่ยังไม่รู้จักมันทำงานต่อได้เหมือนเดิม (ระบบ dev รัน migration กับฐานข้อมูล
-- จริงตอนบูต ไฟล์นี้จึงต้องปลอดภัยกับโค้ดรุ่นก่อนหน้า)
--
-- รูปภาพ: เนื้อหาเก็บแค่ "ชื่อคีย์" ของรูป (ob_sections.data → image: 'losSafetyReal1')
-- ตัวไฟล์อยู่ในที่เก็บไฟล์ของโครงการ (Supabase Storage ผ่าน S3 facade เหมือน
-- ไฟล์แนบอื่นทุกโมดูล) และแถวใน ob_images มาจาก
-- backend/scripts/upload-onboarding-images.mjs --write ซึ่งอัปไฟล์ขึ้นก่อนแล้ว
-- จึงค่อยบันทึก storage_key — base64 ขนาด 7.3 MB ของต้นฉบับไม่เข้า repo และ
-- ไม่เข้า bundle ของหน้าเว็บแม้แต่ไบต์เดียว
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists ob_images (
  key          text primary key,        -- คีย์เดิมจาก EMBEDDED_IMAGES ของเขา
  storage_key  text not null,           -- path ในที่เก็บไฟล์ของโครงการ
  content_type text not null default 'image/jpeg',
  byte_size    int,
  alt          text,
  uploaded_at  timestamptz not null default now()
);

create table if not exists ob_pages (
  key         text primary key,         -- 'accounting-team' · คีย์เดิมของเขา
  kind        text not null,            -- home | preboarding | dept | feature | completion
  dept_slug   text references ob_departments(slug) on delete set null,
  title       text not null,
  title_th    text,
  eyebrow     text,
  eyebrow_th  text,
  lead        text,
  lead_th     text,
  note        text,
  note_th     text,
  hero_image  text,                     -- ob_images.key (ไม่ผูก FK: เนื้อหามาก่อนรูป)
  team_image  text,                     -- ob_images.key ของรูปทีมในหน้าแนะนำแผนก
  closing     jsonb,                    -- { label, label_th, page }
  sort_order  int not null default 0,
  is_active   boolean not null default true
);

create table if not exists ob_sections (
  id            bigint generated always as identity primary key,
  page_key      text not null references ob_pages(key) on delete cascade,
  variant       text not null default 'main',   -- main | notdone (หน้าจบของคนที่ยังไม่ครบ)
  sort_order    int not null default 0,
  type          text not null,
  section_id    text,
  band          text,
  heading       text,
  heading_th    text,
  subheading    text,
  subheading_th text,
  data          jsonb not null default '{}'::jsonb,
  unique (page_key, variant, sort_order)
);
create index if not exists ob_sections_page_idx on ob_sections (page_key, variant, sort_order);

comment on table ob_pages is
  'หน้าเนื้อหาของพอร์ทัลปฐมนิเทศ — คีย์เดียวกับ PAGES ในต้นฉบับ Apps Script ของลูกค้า';
comment on column ob_sections.data is
  'เนื้อของ section ตามชนิด · ข้อความที่มีคำแปลไทยมี field คู่ชื่อ <field>_th อยู่ข้าง ๆ · '
  'ว่าง = ไม่มีคำแปล ให้หน้าจอถอยไปใช้อังกฤษ (ต้นฉบับของเขาก็เป็นอังกฤษ)';
comment on column ob_images.storage_key is
  'path ในที่เก็บไฟล์ของโครงการ · เสิร์ฟผ่าน GET /api/onboarding-program/images/:key';
`);

  L.push(`\n-- ── ${pageRows.length} หน้า ────────────────────────────────────────────────`);
  for (const p of pageRows) {
    L.push(`insert into ob_pages (key, kind, dept_slug, title, title_th, eyebrow, eyebrow_th,`
      + ` lead, lead_th, note, note_th, hero_image, closing, sort_order)`
      + ` values (${q(p.key)}, ${q(p.kind)}, ${q(p.deptSlug)}, ${q(p.title)}, ${q(p.titleTh)},`
      + ` ${q(p.eyebrow)}, ${q(p.eyebrowTh)}, ${q(p.lead)}, ${q(p.leadTh)}, ${q(p.note)},`
      + ` ${q(p.noteTh)}, ${q(p.heroImage)}, ${p.closing ? j(p.closing) : 'null'}, ${p.sortOrder})`
      + ` on conflict (key) do update set kind = excluded.kind, dept_slug = excluded.dept_slug,`
      + ` title = excluded.title, title_th = excluded.title_th, eyebrow = excluded.eyebrow,`
      + ` eyebrow_th = excluded.eyebrow_th, lead = excluded.lead, lead_th = excluded.lead_th,`
      + ` note = excluded.note, note_th = excluded.note_th, hero_image = excluded.hero_image,`
      + ` closing = excluded.closing, sort_order = excluded.sort_order, is_active = true;`);
  }

  L.push(`\n-- ── ${secCount} section ───────────────────────────────────────────────`);
  L.push(`-- ลบ section ของหน้าที่กำลังเติมก่อนใส่ใหม่ เพื่อให้รันซ้ำได้และไม่ค้างของเก่า`);
  L.push(`-- (section ไม่มี id ถาวรที่ความคืบหน้าของใครผูกอยู่ ต่างจาก ob_items)`);
  L.push(`delete from ob_sections where page_key in (${pageRows.map((p) => q(p.key)).join(', ')});`);
  for (const p of pageRows) {
    for (const [variant, list] of [['main', p.sections], ['notdone', p.notCompleteSections]]) {
      for (const s of list) {
        L.push(`insert into ob_sections (page_key, variant, sort_order, type, section_id, band,`
          + ` heading, heading_th, subheading, subheading_th, data)`
          + ` values (${q(p.key)}, ${q(variant)}, ${s.sortOrder}, ${q(s.type)}, ${q(s.sectionId)},`
          + ` ${q(s.band)}, ${q(s.heading)}, ${q(s.headingTh)}, ${q(s.subheading)},`
          + ` ${q(s.subheadingTh)}, ${j(s.data)});`);
      }
    }
  }

  L.push(`\n-- ── รูปที่เนื้อหาอ้างถึง ${imgKeys.length} คีย์ ──────────────────────────`);
  L.push(`-- แถวจริงมาจาก scripts/upload-onboarding-images.mjs --write (ต้องอัปไฟล์ก่อน`);
  L.push(`-- จึงจะมี storage_key) ที่นี่แค่จดไว้ว่าเนื้อหาต้องใช้คีย์ไหนบ้าง:`);
  L.push(`-- ${imgKeys.join(', ')}`);

  const target = new URL('../../supabase/migrations/0084_onboarding_content_pages.sql', import.meta.url);
  fs.writeFileSync(target, `${L.join('\n')}\n`);
  console.log(`เขียนแล้ว supabase/migrations/0084_onboarding_content_pages.sql (${L.length} บรรทัดคำสั่ง)`);
}
