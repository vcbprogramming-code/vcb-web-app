/**
 * ดึงเนื้อหาปฐมนิเทศ 90 วันออกจากต้นฉบับ Apps Script
 *
 *   node scripts/extract-onboarding.mjs "<path ไป ORIGINAL CODE/onboarding/src>"
 *
 * content.html ของต้นฉบับเป็น JavaScript ธรรมดาที่ประกอบ object PAGES ขึ้นมา
 * ด้วยฟังก์ชันช่วยไม่กี่ตัว (it / sr / phasePage / deptLanding / ph / img …)
 * วิธีที่เชื่อถือได้ที่สุดคือ **รันมันจริง** โดยวางฟังก์ชันปลอมให้ครบ แล้วอ่าน
 * PAGES ที่ได้ — ไม่ใช่ไล่ regex ทีละบรรทัด ซึ่งจะพลาดทันทีที่เนื้อหาขึ้นบรรทัดใหม่
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
      items: (s.items || []).map((it) =>
        (typeof it === 'string' ? { id: null, text: it, level: 'junior' } : it)),
    }));
  (depts[slug] ||= { slug, phases: [] }).phases.push({
    key, range, eyebrow: p.hero?.eyebrow || '', title: p.hero?.title || '',
    closing: (p.sections || []).find((s) => s.type === 'text' && !s.heading)?.body?.[0] || null,
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
  .flatMap((s) => (s.type === 'doclist' ? s.docs || s.items || [] : []));

const out = {
  departments: Object.values(depts),
  requiredDocuments: docs,
  nav: NAV,
  pageKeys: Object.keys(PAGES),
};
const counts = {
  แผนก: out.departments.length,
  เฟส: out.departments.reduce((a, d) => a + d.phases.length, 0),
  รายการเช็กลิสต์: out.departments.reduce((a, d) =>
    a + d.phases.reduce((b, p) => b + p.blocks.reduce((c, x) => c + x.items.length, 0), 0), 0),
  เอกสารที่ต้องส่ง: docs.length,
  หน้าเนื้อหาทั้งหมด: out.pageKeys.length,
};
console.log(JSON.stringify(counts, null, 1));
fs.writeFileSync(new URL('./onboarding-content.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('เขียนแล้ว scripts/onboarding-content.json');
