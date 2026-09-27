#!/usr/bin/env node
/**
 * นำเข้าข้อมูลวงเงินสินเชื่อจริง จากระบบที่ลูกค้าใช้อยู่ทุกวันนี้
 * ─────────────────────────────────────────────────────────────────────────────
 *   node scripts/import-live-credit.mjs --dry            ดูว่าจะเขียนอะไรกี่แถว
 *   node scripts/import-live-credit.mjs                  เขียนจริง
 *   node scripts/import-live-credit.mjs --file=<path>    ระบุไฟล์ต้นทางเอง
 *
 * ต้นทางคือผลลัพธ์ getData ของ Apps Script ของเขา (ดึงสดจากหน้าจอ) ซึ่งมี
 * facilities · transactions · projects · costCategories · categoryCaps · facTypes
 *
 * สิ่งที่ต้องรู้ก่อนอ่านโค้ดนี้ — สี่ข้อที่ทำให้ตัวเลขบนหน้าจอออกมาตรงกับของเขา:
 *
 * 1) ยอดใช้ไปของเขา = "ยอดตั้งต้น" ในตารางวงเงิน + รายการที่อนุมัติแล้ว
 *    (Code.js: `u = (Number(f.used) || 0) + delta[...]`) โดยแถวที่ By='seed'
 *    ถือว่าถูกรวมไว้ในยอดตั้งต้นแล้ว จึงไม่ถูกบวกซ้ำ — ซึ่งก็คือ 65 แถวจาก 66
 *    แถวในต้นทางวันนี้ ฝั่งเราไม่มีแนวคิด "แถว seed" เราบวกทุกแถวที่อนุมัติ
 *    ดังนั้น used_baseline ของเรา = ยอดใช้ไปของเขา − ผลรวมแถวที่เรานำเข้าเป็น
 *    "อนุมัติแล้ว" ผลลัพธ์ที่หน้าจอคำนวณได้จึงเท่ากับของเขาเป๊ะ ๆ
 *
 * 2) สถานะ 'active' ของเขา = 'อนุมัติแล้ว' ของเรา (Code.js: isAuthorized_ รับ
 *    ทั้งสองคำ) ถ้าแปลงผิดข้อนี้ ยอดใช้ไปกับการ์ดสถานะจะเพี้ยนทั้งหน้า
 *
 * 3) วันที่ของเขาเป็น dd/mm/yyyy ปี ค.ศ. อยู่แล้ว — ห้ามบวก 543 ซ้ำ
 *
 * 4) ยอดติดลบคือการ "ปลด/คืนวงเงิน" ไม่ใช่ข้อมูลเสีย (T/L ตัดชำระเงินต้น)
 *
 * รันซ้ำได้: วงเงินใช้กุญแจธรรมชาติ (โครงการ × เลขประเภทวงเงิน) · รายการใช้
 * id ของแถวต้นทางในคอลัมน์ credit_ledger.source_id (migration 0076) · งบหมวด
 * ใช้ (โครงการ × หมวด) การล้างจะแตะเฉพาะแถวที่มี source_id ของการนำเข้าเท่านั้น
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const fileArg = args.find((a) => a.startsWith('--file='))?.slice('--file='.length);
// ค่าตั้งต้นคือที่ที่การดึงข้อมูลสดเมื่อ 2026-09-27 เก็บไฟล์ไว้
const DEFAULT_SRC = '/private/tmp/claude-501/-Users-pok-Desktop-Jobs--------------------/'
  + '433cbf75-c00f-4cb4-a565-7affda174a77/scratchpad/live/credit.json';
const SRC = path.resolve(fileArg || DEFAULT_SRC);
const MIGRATION = path.resolve(__dirname, '../../supabase/migrations/0076_credit_import_ref.sql');

const log = (...a) => console.log(...a);
const money = (n) => Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const problems = [];
const warn = (m) => { problems.push(m); log(`  ⚠︎  ${m}`); };

if (!fs.existsSync(SRC)) {
  console.error(`✗ ไม่พบไฟล์ต้นทาง: ${SRC}\n  ระบุด้วย --file=<path>`);
  process.exit(1);
}

// ── อ่านต้นทาง ───────────────────────────────────────────────────────────────
const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const G = raw.getData || raw;
for (const k of ['facilities', 'transactions', 'projects', 'categoryCaps', 'facTypes']) {
  if (!Array.isArray(G[k])) { console.error(`✗ ต้นทางไม่มีคีย์ ${k}`); process.exit(1); }
}
log(`📄 ต้นทาง: ${SRC}`);
log(`   วงเงิน ${G.facilities.length} · รายการ ${G.transactions.length} · โครงการ ${G.projects.length}`
  + ` · งบหมวด ${G.categoryCaps.length} · ประเภทวงเงิน ${G.facTypes.length} · คำขอ ${(G.requests || []).length}`);

// ── ตัวช่วยแปลงค่า ───────────────────────────────────────────────────────────
const txt = (v) => { const s = String(v ?? '').trim(); return s === '' ? null : s; };
const nz = (v) => (v == null || v === '' ? 0 : Number(v));

/**
 * วันที่จากต้นทาง — dd/mm/yyyy ปี ค.ศ. เท่านั้น
 * คืน { iso, rawLeftover } · อ่านไม่ออกคืน iso=null แล้วเก็บข้อความเดิมไว้บอก
 * คนอ่านในหมายเหตุ ดีกว่าเดาวันที่ให้ข้อมูลการเงิน
 */
const DMY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
function asDate(v) {
  const s = String(v ?? '').trim();
  if (!s) return { iso: null, leftover: null };
  const m = s.match(DMY);
  if (!m) return { iso: null, leftover: s };
  const [, d, mo, y] = m;
  const Y = Number(y);
  // ปี พ.ศ. หลุดเข้ามาเมื่อไรต้องรู้ตัว ไม่ใช่แปลงเงียบ ๆ (และไม่ใช่บวก 543 ซ้ำ)
  if (Y > 2400) return { iso: null, leftover: s };
  return { iso: `${Y}-${String(Number(mo)).padStart(2, '0')}-${String(Number(d)).padStart(2, '0')}`, leftover: null };
}

/** อัตราต่อปีเป็นตัวเลขจากประโยคของหนังสือธนาคาร — เดียวกับ ratePct ใน services/credit.js */
const ratePct = (note) => {
  const m = String(note ?? '').match(/(\d+(\.\d+)?)\s*%/);
  return m ? Number(m[1]) : null;
};

/** สถานะของเขา → สถานะของเรา ('active' = อนุมัติแล้ว ตาม isAuthorized_ ของเขา) */
const OUR_STATUSES = ['คำขอใหม่', 'อยู่ระหว่างเสนออนุมัติ', 'อนุมัติแล้ว', 'ชำระแล้ว', 'void'];
function ourStatus(s) {
  const v = String(s ?? '').trim();
  if (v.toLowerCase() === 'active') return 'อนุมัติแล้ว';
  if (OUR_STATUSES.includes(v)) return v;
  return null;
}
const AUTHORIZED = 'อนุมัติแล้ว';

// ── วันเริ่ม/วันครบกำหนดของแถวหนึ่ง ──────────────────────────────────────────
// due กับ maturity ในต้นทางเป็นค่าเดียวกันทุกแถว (ตรวจแล้ว) แต่ยังเทียบไว้กันพลาด
function dueOf(t) {
  const a = asDate(t.due); const b = asDate(t.maturity);
  if (a.iso && b.iso && a.iso !== b.iso) warn(`${t.id}: due (${t.due}) ไม่เท่ากับ maturity (${t.maturity}) — ใช้ due`);
  return a.iso || b.iso ? { iso: a.iso || b.iso, leftover: null } : { iso: null, leftover: a.leftover || b.leftover };
}

// ── ทะเบียนประเภทวงเงิน + โครงการ ────────────────────────────────────────────
const client = await pool.connect();
let exitCode = 0;
try {
  await client.query('begin');

  // คอลัมน์อ้างกลับไปต้นทางต้องมีก่อน ไม่งั้นการนำเข้าไม่มีกุญแจกันซ้ำ
  const hasCol = await client.query(
    `select 1 from information_schema.columns where table_name='credit_ledger' and column_name='source_id'`);
  if (!hasCol.rowCount) {
    log('\n🔧 ยังไม่มีคอลัมน์ credit_ledger.source_id — ใช้ SQL จาก 0076_credit_import_ref.sql');
    if (!fs.existsSync(MIGRATION)) throw new Error(`ไม่พบ ${MIGRATION}`);
    await client.query(fs.readFileSync(MIGRATION, 'utf8'));
    log('   เพิ่มคอลัมน์ให้แล้วในทรานแซกชันนี้ (ยังต้อง npm run migrate เพื่อบันทึกใน schema_migrations)');
  }

  const facTypes = new Map((await client.query(
    'select no, code, doc_kind, name_th from facility_types')).rows.map((r) => [Number(r.no), r]));
  // เลขประเภทในต้นทางต้องตรงกับทะเบียนของเราทุกตัวอักษร ไม่ตรง = หยุด
  for (const ft of G.facTypes) {
    const ours = facTypes.get(Number(ft.no));
    if (!ours) throw new Error(`ประเภทวงเงินเลข ${ft.no} (${ft.code}) ไม่มีในทะเบียนของเรา`);
    if (ours.code !== ft.code) throw new Error(`ประเภทวงเงินเลข ${ft.no}: ของเขา ${ft.code} ของเรา ${ours.code}`);
    if (ours.name_th !== ft.th) warn(`ประเภทวงเงินเลข ${ft.no}: ชื่อไทยต่างกัน "${ft.th}" / "${ours.name_th}"`);
  }
  log(`\n✔ ประเภทวงเงิน ${G.facTypes.length} รายการตรงกับ facility_types ของเรา (รหัสตรงทุกเลข)`);

  // ── จับคู่โครงการ ──────────────────────────────────────────────────────────
  const ourProjects = (await client.query('select id, code, name from projects')).rows;
  const byCode = new Map(ourProjects.map((p) => [p.code.toLowerCase(), p]));
  // สร้างโครงการใหม่เฉพาะที่ข้อมูลนำเข้าอ้างถึงจริง — โครงการที่ไม่มีวงเงิน
  // ไม่มีรายการ และไม่มีงบ ไม่ต้องมีแถวใหม่ที่จะไปโผล่ในโมดูลอื่นด้วย
  const referenced = new Set([
    ...G.facilities.map((f) => f.project),
    ...G.transactions.map((t) => t.project),
    ...G.categoryCaps.map((c) => c.project),
  ].filter(Boolean));
  const projMap = new Map();   // code ของเขา → { id, ourCode, ourName, action }
  log('\n🔗 การจับคู่โครงการ');
  for (const p of G.projects) {
    const ours = byCode.get(String(p.code).toLowerCase());
    const used = referenced.has(p.code);
    if (ours) {
      projMap.set(p.code, { id: ours.id, ourCode: ours.code, ourName: ours.name, action: 'จับคู่รหัสเดิม' });
    } else if (used) {
      const ins = await client.query(
        `insert into projects (code, name, doc_prefix, sort_order)
         values ($1,$2,$3,(select coalesce(max(sort_order),0)+1 from projects)) returning id, code, name`,
        [p.code, p.th, String(p.code).replace(/[^A-Za-z0-9]/g, '').slice(0, 6) || p.code]);
      projMap.set(p.code, { id: ins.rows[0].id, ourCode: ins.rows[0].code, ourName: ins.rows[0].name, action: 'สร้างใหม่' });
    } else {
      projMap.set(p.code, { id: null, ourCode: '—', ourName: '—', action: 'ไม่มีข้อมูลอ้างถึง — ไม่สร้าง' });
    }
    const m = projMap.get(p.code);
    log(`   ${String(p.code).padEnd(5)} ${String(p.th).padEnd(40)} → ${String(m.ourCode).padEnd(5)} ${String(m.ourName).padEnd(34)} [${m.action}]`);
  }
  for (const code of referenced) {
    if (!projMap.get(code)?.id) throw new Error(`รายการอ้างโครงการ ${code} แต่จับคู่ไม่ได้`);
  }
  const companyOf = new Map(G.projects.map((p) => [p.code, p.company || null]));

  // ── เตรียมรายการใช้วงเงิน (ทำก่อน เพราะยอดตั้งต้นของวงเงินต้องรู้ผลรวมนี้) ──
  const seen = new Set();
  const ledgerRows = [];
  const authSumByFac = new Map();      // "โครงการ|เลขประเภท" → ผลรวมแถวที่อนุมัติ
  for (const t of G.transactions) {
    const sid = txt(t.id);
    if (!sid) throw new Error(`มีรายการที่ไม่มี id ในต้นทาง: ${JSON.stringify(t).slice(0, 120)}`);
    if (seen.has(sid)) throw new Error(`id ซ้ำในต้นทาง: ${sid}`);
    seen.add(sid);

    const status = ourStatus(t.status);
    if (!status) throw new Error(`${sid}: สถานะ "${t.status}" ไม่รู้จัก`);
    const amount = Number(t.amount);
    if (!Number.isFinite(amount)) throw new Error(`${sid}: ยอดเงินอ่านไม่ออก (${t.amount})`);

    const fkey = `${t.project}|${Number(t.facilityNo)}`;
    if (status === AUTHORIZED) authSumByFac.set(fkey, (authSumByFac.get(fkey) || 0) + amount);

    const start = asDate(t.start);
    const due = dueOf(t);
    const dateRec = asDate(t.date);
    const updated = asDate(t.updated);
    const paid = asDate(t.paidDate);

    // ค่าที่อ่านเป็นวันที่ไม่ได้ ห้ามทิ้งเงียบ ๆ — เขียนกำกับไว้ในหมายเหตุ
    const notes = [txt(t.note)];
    // ข้อความต้องอ่านออกว่า "ต้นทางผิดรูปมาแบบนี้" ไม่ใช่ "ระบบใหม่ทำวันที่หาย"
    const malformed = (field, v) => `[นำเข้าจากระบบเดิม] ช่อง${field}ในระบบเดิมเก็บค่า "${v}" ซึ่งไม่ใช่วันที่`
      + ` — ข้อมูลต้นทางผิดรูปมาแบบนี้ ไม่ได้หายไปตอนนำเข้า จึงเว้นช่องนี้ไว้ให้ผู้ใช้ตรวจแล้วกรอกยืนยันเอง`;
    if (start.leftover) notes.push(malformed('วันเริ่ม', start.leftover));
    if (due.leftover) notes.push(malformed('วันครบกำหนด', due.leftover));
    if (dateRec.leftover) notes.push(malformed('วันที่บันทึก', dateRec.leftover));
    // ผู้บันทึกเก็บไว้เฉพาะเมื่อเป็นคนจริง — 'seed' คือตัวโหลดยอดตั้งต้นของเขา
    // ไม่ใช่ชื่อคน เขียนกำกับไว้ 65 แถวก็เป็นแค่เสียงรบกวนบนหน้าจอการเงิน
    if (txt(t.by)?.includes('@')) notes.push(`[นำเข้า] ผู้บันทึกในระบบเดิม: ${txt(t.by)}`);

    // purpose ในผลลัพธ์ของเขาถอยไปใช้ Description เมื่อคอลัมน์ Purpose ว่าง
    // (Code.js: `purpose: t.Purpose || t.Description`) ค่าที่เท่ากับ desc จึง
    // ไม่ใช่ "วัตถุประสงค์" จริง — ลง counterparty ช่องเดียวตามที่ฟอร์มเขาใช้
    const desc = txt(t.desc);
    const purpose = txt(t.purpose) && String(txt(t.purpose)) !== String(desc) ? txt(t.purpose) : null;

    // เลขประเภทวงเงินกับ kind ที่เขาเขียนกำกับต้องไม่ขัดกัน
    const ft = facTypes.get(Number(t.facilityNo));
    if (!ft) throw new Error(`${sid}: เลขประเภทวงเงิน ${t.facilityNo} ไม่มีในทะเบียน`);

    ledgerRows.push({
      sid, project: t.project, facilityNo: Number(t.facilityNo), amount, status,
      start_date: start.iso, due_date: due.iso, settled_date: paid.iso,
      ref: txt(t.ref), source: txt(t.source), doc_from: txt(t.docFrom), doc_to: txt(t.docTo),
      note: notes.filter(Boolean).join(' · ') || null,
      beneficiary: txt(t.beneficiary), counterparty: desc, purpose,
      cost_category: txt(t.costCategory),
      ref_doc_from: asDate(t.refDocFrom).iso, ref_doc_to: asDate(t.refDocTo).iso,
      created_at: dateRec.iso, updated_at: updated.iso || dateRec.iso,
    });
  }

  // ── วงเงิน ────────────────────────────────────────────────────────────────
  const facRows = [];
  for (const f of G.facilities) {
    const pm = projMap.get(f.project);
    if (!pm?.id) throw new Error(`วงเงินอ้างโครงการ ${f.project} แต่จับคู่ไม่ได้`);
    const no = Number(f.facilityNo);
    const ft = facTypes.get(no);
    if (!ft) throw new Error(`วงเงิน ${f.project}#${no}: เลขประเภทไม่มีในทะเบียน`);
    if (f.type && ft.code !== f.type) throw new Error(`วงเงิน ${f.project}#${no}: รหัสประเภทของเขา ${f.type} ไม่ตรงกับ ${ft.code}`);

    const limit = nz(f.limit);
    const used = nz(f.used);
    // available ของเขาต้องเท่ากับ limit − used เสมอ ไม่เท่า = อ่านต้นทางผิด
    if (Math.abs(limit - used - nz(f.available)) > 0.005)
      warn(`วงเงิน ${f.project}#${no}: available ของเขา (${money(f.available)}) ≠ limit − used`);

    const authSum = authSumByFac.get(`${f.project}|${no}`) || 0;
    const baseline = Math.round((used - authSum) * 100) / 100;
    if (baseline < 0) warn(`วงเงิน ${f.project}#${no}: ยอดตั้งต้นคำนวณได้ติดลบ (${money(baseline)}) — ยอดใช้ไปจะถูกตัดที่ศูนย์`);

    const note = txt(f.interest);
    facRows.push({
      project_id: pm.id, project: f.project, facility_no: no, type: ft.doc_kind,
      company: companyOf.get(f.project), limit, used_baseline: baseline,
      used_override: f.usedOverridden ? used : null,
      interest_note: note, interest_rate: ratePct(note),
      notes: txt(f.notes), expectUsed: used,
    });
  }

  /**
   * หมวดค่าใช้จ่ายที่รายการอ้างถึงแต่ไม่อยู่ในทะเบียน → ขึ้นทะเบียนแบบปิดใช้งาน
   *
   * รายการเก่าในระบบเขายังอ้างชื่อหมวดชุดห้าหมวดเดิม ('ทราย' · 'ค่าแรง') ซึ่ง
   * ทะเบียนสิบแปดหมวดของวันนี้ไม่มี — ค่าในรายการห้ามแปลง (นั่นคือสิ่งที่ระบบ
   * เขาเก็บไว้จริง) แต่ทะเบียนควรรู้จักชื่อนี้ หน้าสรุปค่าใช้จ่ายจึงเรียกชื่อ
   * หมวดได้ถูก ส่วนเมนูเลือกหมวดอ่านเฉพาะแถวที่เปิดใช้งาน จึงยังสะอาดเหมือนเดิม
   */
  const regCats = new Set((await client.query('select name from credit_cost_categories')).rows.map((r) => r.name));
  const offReg = [...new Set(ledgerRows.map((l) => l.cost_category).filter(Boolean))].filter((c) => !regCats.has(c));
  for (const name of offReg) {
    await client.query(
      `insert into credit_cost_categories (name, sort_order, is_active)
       values ($1, (select coalesce(max(sort_order),0)+1 from credit_cost_categories), false)
       on conflict (name) do nothing`, [name]);
  }
  if (offReg.length) log(`\n🏷  หมวดค่าใช้จ่ายที่รายการใช้แต่ไม่มีในทะเบียน ${offReg.length} หมวด: ${offReg.join(', ')}`
    + `\n   → ขึ้นทะเบียนแบบปิดใช้งาน (ไม่โผล่ในเมนู) และไม่แปลงค่าในรายการ`);

  // ── งบประมาณต่อหมวด ──────────────────────────────────────────────────────
  // งบที่ลูกค้าทำไว้ตอนทดลองระบบแล้วลืมลบ (หมายเหตุมีคำว่า TEST/ZZTEST และตั้งงบ
  // ไว้ศูนย์) ไม่ลอกเข้ามา — ของเราถือว่างบศูนย์คือ "ล้างงบ" อยู่แล้ว ลอกเข้ามา
  // ก็ได้แค่บรรทัด "ไม่ได้ตั้งงบ · ZZTEST" ค้างบนหน้าสรุปของงานจริง
  const TESTNOTE = /test/i;
  const capSkipped = [];
  const capRows = G.categoryCaps.filter((c) => {
    if (!TESTNOTE.test(String(c.note ?? ''))) return true;
    capSkipped.push(`${c.project}/${c.costCategory} (งบ ${money(nz(c.cap))} · หมายเหตุ "${c.note}")`);
    return false;
  }).map((c) => {
    const pm = projMap.get(c.project);
    if (!pm?.id) throw new Error(`งบหมวดอ้างโครงการ ${c.project} แต่จับคู่ไม่ได้`);
    return { project_id: pm.id, project: c.project, cost_category: String(c.costCategory), cap: nz(c.cap), note: txt(c.note) };
  });
  if (capSkipped.length) log(`\n🚫 ข้ามงบหมวดที่เป็นของทดสอบในระบบเขา ${capSkipped.length} แถว: ${capSkipped.join(' · ')}`);
  // แถวที่เคยนำเข้าไว้ก่อนจะมีกฎนี้ ต้องลบออกด้วย ไม่ใช่ปล่อยค้าง
  for (const c of G.categoryCaps) {
    if (!TESTNOTE.test(String(c.note ?? ''))) continue;
    const pid = projMap.get(c.project)?.id;
    if (!pid) continue;
    // เทียบหมายเหตุด้วยค่าที่ "ตัดช่องว่างแล้ว" ให้ตรงกับที่ตอนนำเข้าเขียนลงไป
    // (txt()) ไม่งั้นช่องว่างท้ายข้อความในไฟล์ส่งออกรอบหน้าจะทำให้ลบไม่เจอเงียบ ๆ
    const d = await client.query(
      'delete from credit_category_caps where project_id=$1 and cost_category=$2 and note = $3 returning cost_category',
      [pid, String(c.costCategory), txt(c.note)]);
    if (d.rowCount) log(`   ลบแถวที่นำเข้าไว้รอบก่อนแล้ว: ${c.project}/${c.costCategory}`);
  }

  // ══ เขียน ═════════════════════════════════════════════════════════════════
  const stat = { facIns: 0, facUpd: 0, ledIns: 0, ledUpd: 0, ledDel: 0, capIns: 0, capUpd: 0 };
  const facIdOf = new Map();
  for (const f of facRows) {
    // ตาราง facilities ไม่มี unique key บน (โครงการ × เลขประเภท) — หน้าจอเพิ่ม
    // วงเงินซ้ำได้โดยเจตนา ถ้าคีย์ธรรมชาติซ้ำอยู่แล้ว การนำเข้าต้องหยุด ไม่ใช่
    // เดาว่าจะอัปเดตแถวไหน เพราะเดาผิดคือวงเงินถูกนับสองรอบ
    const cur = await client.query(
      'select id from facilities where project_id = $1 and facility_no = $2 order by created_at',
      [f.project_id, f.facility_no]);
    if (cur.rowCount > 1) throw new Error(`วงเงิน ${f.project}#${f.facility_no} มี ${cur.rowCount} แถวในฐาน — แก้ให้เหลือแถวเดียวก่อนนำเข้า`);
    if (cur.rowCount) {
      await client.query(
        `update facilities set company=$2, facility_no=$3, type=$4, "limit"=$5, used_baseline=$6,
                used_override=$7, interest_rate=$8, interest_note=$9, notes=$10, is_active=true
           where id=$1`,
        [cur.rows[0].id, f.company, f.facility_no, f.type, f.limit, f.used_baseline,
         f.used_override, f.interest_rate, f.interest_note, f.notes]);
      facIdOf.set(`${f.project}|${f.facility_no}`, cur.rows[0].id); stat.facUpd++;
    } else {
      const ins = await client.query(
        `insert into facilities (project_id, company, facility_no, type, "limit", used_baseline,
                                 used_override, interest_rate, interest_note, notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
        [f.project_id, f.company, f.facility_no, f.type, f.limit, f.used_baseline,
         f.used_override, f.interest_rate, f.interest_note, f.notes]);
      facIdOf.set(`${f.project}|${f.facility_no}`, ins.rows[0].id); stat.facIns++;
    }
  }
  // กันซ้ำอีกชั้นหลังเขียน: คีย์ธรรมชาติต้องมีแถวเดียวเสมอ
  const dupFac = await client.query(
    `select p.code, f.facility_no, count(*)::int n from facilities f join projects p on p.id = f.project_id
      where f.project_id = any($1) group by 1,2 having count(*) > 1`,
    [[...new Set(facRows.map((f) => f.project_id))]]);
  if (dupFac.rowCount) throw new Error('เกิดวงเงินซ้ำ: '
    + dupFac.rows.map((r) => `${r.code}#${r.facility_no}×${r.n}`).join(', '));

  for (const l of ledgerRows) {
    const facId = facIdOf.get(`${l.project}|${l.facilityNo}`);
    if (!facId) throw new Error(`${l.sid}: ไม่พบวงเงิน ${l.project}#${l.facilityNo} ในชุดที่นำเข้า`);
    const projectId = projMap.get(l.project).id;
    const vals = [l.sid, facId, projectId, l.amount, l.status, l.start_date, l.due_date, l.settled_date,
      l.ref, l.source, l.doc_from, l.doc_to, l.note, l.beneficiary, l.counterparty, l.purpose,
      l.cost_category, l.ref_doc_from, l.ref_doc_to, l.created_at, l.updated_at];
    const cur = await client.query('select id from credit_ledger where source_id = $1', [l.sid]);
    if (cur.rowCount > 1) throw new Error(`source_id ${l.sid} มีมากกว่าหนึ่งแถวในฐาน`);
    if (cur.rowCount) {
      await client.query(
        `update credit_ledger set facility_id=$2, project_id=$3, amount=$4, status=$5, start_date=$6,
                due_date=$7, settled_date=$8, ref=$9, source=$10, doc_from=$11, doc_to=$12, note=$13,
                beneficiary=$14, counterparty=$15, purpose=$16, cost_category=$17, ref_doc_from=$18,
                ref_doc_to=$19, created_at=coalesce($20::date, created_at), updated_at=coalesce($21::date, updated_at)
           where source_id=$1`, vals);
      stat.ledUpd++;
    } else {
      await client.query(
        `insert into credit_ledger (source_id, facility_id, project_id, amount, status, start_date, due_date,
                settled_date, ref, source, doc_from, doc_to, note, beneficiary, counterparty, purpose,
                cost_category, ref_doc_from, ref_doc_to, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
                 coalesce($20::date, now()), coalesce($21::date, now()))`, vals);
      stat.ledIns++;
    }
  }
  // แถวจากการนำเข้ารอบก่อนที่ต้นทางไม่มีอีกแล้ว — ลบเฉพาะแถวที่มี source_id
  // (รายการที่คนกรอกผ่านหน้าจอมี source_id เป็น null จึงไม่ถูกแตะ)
  const del = await client.query(
    'delete from credit_ledger where source_id is not null and not (source_id = any($1)) returning source_id',
    [[...seen]]);
  stat.ledDel = del.rowCount;
  if (del.rowCount) log(`\n🧹 ลบรายการนำเข้ารอบก่อนที่ต้นทางไม่มีแล้ว ${del.rowCount} แถว: ${del.rows.map((r) => r.source_id).join(', ')}`);

  for (const c of capRows) {
    const cur = await client.query(
      'select cap from credit_category_caps where project_id=$1 and cost_category=$2', [c.project_id, c.cost_category]);
    await client.query(
      `insert into credit_category_caps (project_id, cost_category, cap, note, updated_at)
       values ($1,$2,$3,$4, now())
       on conflict (project_id, cost_category) do update set cap=excluded.cap, note=excluded.note, updated_at=now()`,
      [c.project_id, c.cost_category, c.cap, c.note]);
    if (cur.rowCount) stat.capUpd++; else stat.capIns++;
  }

  // วงเงินของโครงการที่นำเข้า ที่ต้นทางไม่มีเลขประเภทนั้นอีกแล้ว — รายงาน ไม่ลบ
  // (อาจเป็นวงเงินที่คนกรอกในระบบเราเอง การนำเข้าไม่มีสิทธิ์ลบของคนอื่น)
  const projectIds = [...new Set(facRows.map((f) => f.project_id))];
  const wanted = new Set(facRows.map((f) => `${f.project_id}|${f.facility_no}`));
  const extra = (await client.query(
    `select p.code, f.project_id, f.facility_no from facilities f
       join projects p on p.id = f.project_id where f.project_id = any($1)`, [projectIds]))
    .rows.filter((r) => !wanted.has(`${r.project_id}|${Number(r.facility_no)}`));
  if (extra.length) warn(`วงเงินในโครงการที่นำเข้าแต่ต้นทางไม่มี ${extra.length} แถว (ไม่ลบให้): `
    + extra.map((r) => `${r.code}#${r.facility_no}`).join(', '));

  // ── ตรวจว่ายอดใช้ไปที่ระบบเราคำนวณได้ ตรงกับของเขาทุกแถว ──────────────────
  const check = await client.query(
    `select f.project_id, f.facility_no, f."limit"::float8 lim,
            greatest(0, f.used_baseline::float8
              + coalesce((select sum(l.amount)::float8 from credit_ledger l
                           where l.facility_id = f.id and l.status = $2), 0)) used_auto,
            f.used_override::float8 ovr
       from facilities f where f.project_id = any($1)`,
    [projectIds, AUTHORIZED]);
  let off = 0;
  for (const f of facRows) {
    const row = check.rows.find((r) => r.project_id === f.project_id && Number(r.facility_no) === f.facility_no);
    if (!row) { warn(`ตรวจยอดใช้ไป: ไม่พบ ${f.project}#${f.facility_no} หลังเขียน`); off++; continue; }
    const got = row.ovr != null ? Number(row.ovr) : Number(row.used_auto);
    if (Math.abs(got - f.expectUsed) > 0.005) {
      off++; warn(`ยอดใช้ไปไม่ตรง ${f.project}#${f.facility_no}: ของเขา ${money(f.expectUsed)} ของเรา ${money(got)}`);
    }
  }
  log(`\n✔ ยอดใช้ไปตรงกับของเขา ${facRows.length - off}/${facRows.length} วงเงิน`);
  if (off) throw new Error(`ยอดใช้ไปไม่ตรง ${off} วงเงิน — ไม่เขียนข้อมูล`);

  // ── เทียบกับตัวเลขบนแดชบอร์ดของเขา (ทำในทรานแซกชัน จึงตรวจได้ก่อนเขียนจริง) ──
  // ตรรกะเดียวกับ GET /api/credit/overview — FOLD คัดลอกจาก credit.routes.js
  // (ค้ำประกันสามใบรวมเป็นกล่อง BG · L/G วัสดุ · DLC · P/N Post พับเข้ากล่อง B/E)
  const foldNo = (n) => ([1, 2, 3].includes(Number(n)) ? 1 : [5, 9, 10].includes(Number(n)) ? 6 : Number(n));
  const live = (await client.query(
    `select f.facility_no, f."limit"::float8 lim, f.used_override::float8 ovr, f.used_baseline::float8 base,
            coalesce((select sum(l.amount)::float8 from credit_ledger l
                       where l.facility_id = f.id and l.status = $2), 0) auth
       from facilities f where f.is_active and f.project_id = any($1)`, [projectIds, AUTHORIZED])).rows;
  const boxes = new Map();
  for (const f of live) {
    const used = f.ovr != null ? Number(f.ovr) : Math.max(0, f.base + f.auth);
    const key = facTypes.get(foldNo(f.facility_no)).doc_kind;
    const b = boxes.get(key) || { limit: 0, used: 0 };
    b.limit += f.lim; b.used += used; boxes.set(key, b);
  }
  const rows = (await client.query(
    `select amount::float8 amount, status, due_date from credit_ledger where source_id is not null`)).rows;
  const now = new Date();
  const m0 = new Date(now.getFullYear(), now.getMonth(), 1);
  const m1 = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const m2 = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  const bk = { overdue: { c: 0, a: 0 }, thisMonth: { c: 0, a: 0 }, nextMonth: { c: 0, a: 0 }, later: { c: 0, a: 0 } };
  for (const r of rows) {
    if (r.status === 'ชำระแล้ว' || String(r.status).toLowerCase() === 'void' || !(r.amount > 0) || !r.due_date) continue;
    const d = new Date(r.due_date);
    const k = d < m0 ? 'overdue' : d < m1 ? 'thisMonth' : d < m2 ? 'nextMonth' : 'later';
    bk[k].c++; bk[k].a += r.amount;
  }
  const tally = (f) => { const s = rows.filter(f); return { c: s.length, a: s.reduce((x, r) => x + r.amount, 0) }; };
  const pend = tally((r) => r.status === 'อยู่ระหว่างเสนออนุมัติ');
  const appr = tally((r) => r.status === AUTHORIZED);
  const box = (k) => boxes.get(k) || { limit: 0, used: 0 };
  const pctOf = (b) => (b.limit > 0 ? Math.min(100, Math.round((b.used / b.limit) * 100)) : (b.used > 0 ? 100 : 0));
  const R = (n) => Math.round(n);
  const EXPECT = [
    ['การ์ด T/L  คงเหลือ / % ใช้ไป', `${R(box('T/L').limit - box('T/L').used)} / ${pctOf(box('T/L'))}%`, '70526685 / 54%'],
    ['การ์ด BG   คงเหลือ / % ใช้ไป', `${R(box('BG').limit - box('BG').used)} / ${pctOf(box('BG'))}%`, '233721997 / 66%'],
    ['การ์ด B/E  คงเหลือ / % ใช้ไป', `${R(box('B/E').limit - box('B/E').used)} / ${pctOf(box('B/E'))}%`, '93525463 / 68%'],
    ['การ์ด P/N  คงเหลือ / % ใช้ไป', `${R(box('P/N').limit - box('P/N').used)} / ${pctOf(box('P/N'))}%`, '283274287 / 13%'],
    ['ครบกำหนด เดือนนี้', `${R(bk.thisMonth.a)} / ${bk.thisMonth.c} รายการ`, '0 / 0 รายการ'],
    ['เกินกำหนดค้าง', `${R(bk.overdue.a)}`, '150163817'],
    ['ครบกำหนด เดือนหน้า', `${R(bk.nextMonth.a)} / ${bk.nextMonth.c} รายการ`, '7374934 / 2 รายการ'],
    ['อยู่ระหว่างเสนออนุมัติ', `${pend.c} รายการ / ${R(pend.a)}`, '0 รายการ / 0'],
    ['อนุมัติ', `${appr.c} รายการ / ${R(appr.a)}`, '65 รายการ / 158059797'],
  ];
  log('\n🎯 เทียบกับแดชบอร์ดของเขา (คำนวณจากข้อมูลในทรานแซกชันนี้)');
  let mismatch = 0;
  for (const [label, got, want] of EXPECT) {
    const ok = got === want;
    if (!ok) mismatch++;
    log(`   ${ok ? '✔' : '✗'} ${label.padEnd(30)} ได้ ${got.padEnd(24)} ควรเป็น ${want}`);
  }
  if (mismatch) warn(`ตัวเลขไม่ตรงกับแดชบอร์ดของเขา ${mismatch} ค่า`);

  // ── สรุป ──────────────────────────────────────────────────────────────────
  log('\n📊 สรุปที่จะเขียน');
  log(`   facilities            เพิ่ม ${stat.facIns} · อัปเดต ${stat.facUpd}`);
  log(`   credit_ledger         เพิ่ม ${stat.ledIns} · อัปเดต ${stat.ledUpd} · ลบของรอบก่อน ${stat.ledDel}`);
  log(`   credit_category_caps  เพิ่ม ${stat.capIns} · อัปเดต ${stat.capUpd}`);
  log(`   credit_requests       0 (ต้นทางไม่มีคำขอค้าง)`);
  const byStatus = {};
  for (const l of ledgerRows) byStatus[l.status] = (byStatus[l.status] || 0) + 1;
  log(`   สถานะรายการ: ${Object.entries(byStatus).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  const sumAuth = ledgerRows.filter((l) => l.status === AUTHORIZED).reduce((a, l) => a + l.amount, 0);
  log(`   ยอดรวมรายการที่อนุมัติแล้ว ฿${money(sumAuth)} (${ledgerRows.filter((l) => l.status === AUTHORIZED).length} รายการ)`);
  log(`   วงเงินรวม ฿${money(facRows.reduce((a, f) => a + f.limit, 0))}`
    + ` · ใช้ไปรวม ฿${money(facRows.reduce((a, f) => a + f.expectUsed, 0))}`);
  const annotated = ledgerRows.filter((l) => /\[นำเข้าจากระบบเดิม\] ช่องวัน/.test(l.note || ''));
  if (annotated.length) log(`   รายการที่วันที่ในต้นทางอ่านไม่ออก จึงเว้นว่างไว้และเขียนกำกับในหมายเหตุ: `
    + `${annotated.length} แถว (${annotated.map((l) => l.sid).join(', ')})`);
  const noDue = ledgerRows.filter((l) => !l.due_date).length;
  log(`   รายการที่ไม่มีวันครบกำหนดในต้นทาง ${noDue} แถว (ไม่เข้ากลุ่มครบกำหนดใด ๆ เหมือนของเขา)`);

  if (DRY) {
    await client.query('rollback');
    log('\n🧪 --dry: ย้อนทรานแซกชันแล้ว ไม่มีอะไรถูกเขียน');
  } else {
    await client.query('commit');
    log('\n✅ เขียนลงฐานข้อมูลแล้ว (ทรานแซกชันเดียว)');
  }
  if (problems.length) log(`\n⚠︎ เรื่องที่ต้องรู้ ${problems.length} ข้อ (ดูด้านบน)`);
} catch (e) {
  await client.query('rollback').catch(() => {});
  console.error(`\n✗ ล้มเหลว — ย้อนทรานแซกชันทั้งหมด: ${e.message}`);
  exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
process.exit(exitCode);
