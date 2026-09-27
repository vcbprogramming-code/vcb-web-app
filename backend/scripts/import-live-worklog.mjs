#!/usr/bin/env node
/**
 * นำเข้าทะเบียนพนักงานและบันทึกงานจริง จากระบบที่ลูกค้าใช้อยู่ทุกวันนี้
 * ─────────────────────────────────────────────────────────────────────────────
 *   node scripts/import-live-worklog.mjs --dry              ดูว่าจะเขียนอะไรกี่แถว (ไม่เขียน)
 *   node scripts/import-live-worklog.mjs                    เขียนจริง
 *   node scripts/import-live-worklog.mjs --file=<dir>       โฟลเดอร์ต้นทาง
 *   node scripts/import-live-worklog.mjs --drop-demo        ลบข้อมูลสาธิต/ทดสอบออกก่อน
 *   node scripts/import-live-worklog.mjs --prune            ลบบันทึกงานในช่วงเดือนที่นำเข้าที่ไม่มีในต้นทาง
 *   node scripts/import-live-worklog.mjs --backup=<dir>     ที่เก็บไฟล์สำรองก่อนลบ
 *
 * ต้นทางคือผลลัพธ์ของ Apps Script ของเขา ดึงสดจากหน้าจอเมื่อ 2026-09-27
 *   wl-boot.json  api_bootstrap · api_adminListSites · api_masterList · api_costList
 *   wl-calls.json พารามิเตอร์ของทุกคำขอ ตามลำดับ — เป็นตัวบอกว่า #n คือไซต์/เดือนไหน
 *   wl-data.json  api_siteMonth#0..23 (8 ไซต์ × 3 เดือน) · api_employees#24..39
 *   wl-sum.json   api_adminSummary#0/#1 · api_pendingLeaveRequests · api_decidedLeaveRequests
 *
 * ห้าข้อที่ทำให้ตัวเลขออกมาตรงกับของเขา — อ่านก่อนแก้โค้ดนี้:
 *
 * 1) ช่องงานหลักอยู่คนละคอลัมน์ตามสายงาน ต้นทางก็เก็บแบบเดียวกับเรา: สายปฏิบัติการ
 *    ส่งมาเป็นคีย์ `team` สายสนับสนุนส่งมาเป็น `pm` คือช่องที่สองของทั้งสองสาย
 *    (ตรงกับ view worklog_slots ใน migration 0063) — ลงผิดคอลัมน์ = รายงาน
 *    แรงงาน-วันเพี้ยนทั้งชุด เพราะ view มองไม่เห็นช่องที่อยู่ผิดฝั่ง
 *
 * 2) กุญแจของพนักงานคือ (ไซต์, eid) ไม่ใช่รหัสพนักงาน — รหัสพนักงานของเขาซ้ำ
 *    กันจริง 35 รหัส (คนเดียวกันลงทะเบียนสองไซต์ และมีรหัสเดียวกันเป็นคนละคน)
 *    ของเราบังคับ employee_code ไม่ซ้ำ แถวที่สองของรหัสที่ซ้ำจึงเก็บเป็น
 *    "<รหัส>#<eid>" ส่วนรหัสจริงล้วน ๆ อยู่ใน live_emp_code ครบทุกแถว (0078)
 *    — ห้ามทิ้งคนออกเพราะรหัสซ้ำ ต้องได้ครบทุกคน
 *
 * 3) วันหยุดของเขาคือวันอาทิตย์วันเดียว เสาร์เป็นวันทำงาน (days[].weekend เป็น
 *    true เฉพาะ dow 6 ซึ่งในปฏิทินของเขา จันทร์=0) ของเราคิดแบบเดียวกันอยู่แล้ว
 *    (isWeekend ใน performance.routes.js) จึงไม่ต้องแปลงอะไร
 *
 * 4) วันลาที่อนุมัติแล้วของเขาเป็น "บันทึกงานรหัส Z-2 พร้อมโน้ต" ไม่ใช่วันที่
 *    ทำเครื่องหมายว่าไม่อยู่ (employee_away ว่างเปล่าทั้งระบบ) การนำเข้าจึงไม่
 *    เขียน employee_away ให้คำขอลาที่อนุมัติแล้ว — ไม่งั้นวันเดียวจะถูกนับสองทาง
 *
 * 5) ช่องงานมีสองรูปแบบ "A-1 / 5" (รหัสงาน / หมวดต้นทุน) และ "Z-1" เปล่า ๆ
 *    (Standby / ลา / ลาออก — ไม่มีหมวดต้นทุน) เก็บข้อความตามต้นทางตรง ๆ ทั้งคู่
 *
 * รันซ้ำได้: ไซต์ใช้ชื่อ/รหัส · พนักงานใช้ (live_site_key, live_eid) · บันทึกงาน
 * ใช้ (พนักงาน, วันที่) ซึ่งเป็น unique อยู่แล้ว · คำขอลาใช้ leave_requests.source_id
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => args.find((a) => a.startsWith(`${f}=`))?.slice(f.length + 1);

const DRY = has('--dry');
const DROP_DEMO = has('--drop-demo');
const PRUNE = has('--prune');

// ค่าตั้งต้นคือที่ที่การดึงข้อมูลสดเมื่อ 2026-09-27 เก็บไฟล์ไว้
const SCRATCH = '/private/tmp/claude-501/-Users-pok-Desktop-Jobs--------------------/'
  + '433cbf75-c00f-4cb4-a565-7affda174a77/scratchpad';
const SRC_DIR = path.resolve(val('--file') || `${SCRATCH}/live`);
const BACKUP_DIR = path.resolve(val('--backup') || SCRATCH);

const log = (...a) => console.log(...a);
const problems = [];
const warn = (m) => { problems.push(m); log(`  ⚠︎  ${m}`); };
const num = (n) => Number(n).toLocaleString('en-US');

// ── อ่านต้นทาง ───────────────────────────────────────────────────────────────
const readJson = (name) => {
  const p = path.join(SRC_DIR, name);
  if (!fs.existsSync(p)) { console.error(`✗ ไม่พบไฟล์ต้นทาง: ${p}\n  ระบุโฟลเดอร์ด้วย --file=<dir>`); process.exit(1); }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};
const BOOT = readJson('wl-boot.json');
const CALLS = readJson('wl-calls.json');
const DATA = readJson('wl-data.json');
const SUM = readJson('wl-sum.json');

log(`📄 ต้นทาง: ${SRC_DIR}`);

// ── ตัวช่วย ──────────────────────────────────────────────────────────────────
const txt = (v) => { const s = String(v ?? '').trim(); return s === '' ? null : s; };
/** ชื่อไซต์/แผนกเทียบกันแบบยุบช่องว่าง — ต้นทางมีเว้นวรรคซ้อนไม่สม่ำเสมอ */
const norm = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * เวลาจากต้นทางเป็น "YYYY-MM-DD H:mm" ตามเวลาไทย (Apps Script ของเขาตั้ง
 * Asia/Bangkok) เติม +07 ให้ชัด ไม่ปล่อยให้ขึ้นกับ timezone ของเครื่องที่รัน
 */
function stamp(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) { warn(`อ่านเวลาไม่ออก ปล่อยว่างไว้: "${s}"`); return null; }
  const [, Y, Mo, D, h, mi, se] = m;
  const p2 = (x) => String(Number(x)).padStart(2, '0');
  return `${Y}-${p2(Mo)}-${p2(D)} ${p2(h)}:${mi}:${se || '00'}+07`;
}

// ── โครงข้อมูลจากต้นทาง ──────────────────────────────────────────────────────
/** ลำดับไซต์ตามที่ wl-calls.json บันทึกไว้ — ห้ามเดาจากรายการใน wl-boot */
const SITE_ORDER = [];
for (const [fn, p] of CALLS) if (fn === 'api_siteMonth' && !SITE_ORDER.includes(p[0])) SITE_ORDER.push(p[0]);

const siteMeta = new Map();          // key -> { key, name, company, active, lockDays }
for (const s of BOOT.api_bootstrap?.sites || []) {
  siteMeta.set(s.key, { key: s.key, name: norm(s.name), company: null, active: s.active !== false, lockDays: 3 });
}
for (const r of BOOT.api_adminListSites?.rows || []) {
  const m = siteMeta.get(r.key) || { key: r.key, name: norm(r.name), active: r.active !== false, lockDays: 3 };
  // company เก็บตามที่เขาเก็บจริง (เว้นวรรคซ้อนและคำว่า "บริษัท" รวมอยู่ด้วย)
  m.company = String(r.company ?? '').trim() || null;
  m.emps = r.emps;
  siteMeta.set(r.key, m);
}
if (!siteMeta.size) { console.error('✗ ต้นทางไม่มีรายการไซต์'); process.exit(1); }

/** พนักงานทุกคน จาก api_employees#n ซึ่งแยกตาม (ไซต์, สายงาน) */
const people = [];                   // { siteKey, eid, empId, name, kind, department, position }
const seenRef = new Set();
CALLS.forEach(([fn, p], i) => {
  if (fn !== 'api_employees') return;
  const rows = DATA[`api_employees#${i}`];
  if (!Array.isArray(rows)) { warn(`ไม่พบ api_employees#${i} (${p.join('/')})`); return; }
  // สายงานอยู่ในพารามิเตอร์ของคำขอ ไม่ได้อยู่ในแถว — แถวของ api_employees มีแค่
  // name/eid/position/department/emp_id เท่านั้น การอ่าน e.kind จะได้ undefined
  // และทุกคนกลายเป็นสายปฏิบัติการ ซึ่งย้ายช่องงานหลักไปผิดคอลัมน์ทั้งชุด
  const kindFromCall = p[1] === 'support' ? 'support' : 'operation';
  for (const e of rows) {
    const ref = `${p[0]}#${e.eid}`;
    if (seenRef.has(ref)) { warn(`พนักงานซ้ำในต้นทาง ${ref} — ข้ามแถวที่สอง`); continue; }
    seenRef.add(ref);
    people.push({
      siteKey: p[0], eid: Number(e.eid), empId: String(e.emp_id ?? '').trim(),
      // ชื่อเก็บตามต้นทางตรง ๆ ไม่แก้ ไม่เดา — ทะเบียนพนักงานจริง
      name: String(e.name ?? '').trim(), kind: kindFromCall,
      department: norm(e.department), position: norm(e.position),
      away: [], moves: [],
    });
  }
});
const byRef = new Map(people.map((x) => [`${x.siteKey}#${x.eid}`, x]));

/** บันทึกงาน + วันที่ไม่อยู่ + การย้ายไซต์ จาก api_siteMonth#n */
const cells = [];                    // { ref, ymd, slot1, pm, note }
const monthsSeen = new Set();
CALLS.forEach(([fn, p], i) => {
  if (fn !== 'api_siteMonth') return;
  const m = DATA[`api_siteMonth#${i}`];
  if (!m) { warn(`ไม่พบ api_siteMonth#${i} (${p.join('/')})`); return; }
  const [siteKey, Y, Mo] = p;
  monthsSeen.add(`${Y}-${String(Mo).padStart(2, '0')}`);
  if (m.lockDays != null) {
    const meta = siteMeta.get(siteKey);
    if (meta) meta.lockDays = Number(m.lockDays) || 3;
  }
  for (const e of m.employees || []) {
    const person = byRef.get(`${siteKey}#${e.eid}`);
    if (!person) { warn(`บันทึกงานอ้างพนักงานที่ไม่อยู่ในทะเบียน ${siteKey}#${e.eid}`); continue; }
    // ตารางรายเดือนส่ง kind มาด้วย ใช้ยันกับสายงานที่ได้จากพารามิเตอร์ของ
    // api_employees — ถ้าสองที่ไม่ตรงกันแปลว่าอ่านต้นทางผิด ต้องรู้ตัวก่อนเขียน
    if (e.kind && e.kind !== person.kind) {
      warn(`สายงานของ ${siteKey}#${e.eid} ไม่ตรงกันระหว่างสองแหล่ง (ทะเบียน ${person.kind} · ตารางเดือน ${e.kind})`);
    }
    for (const d of e.away || []) if (DATE_RE.test(d) && !person.away.includes(d)) person.away.push(d);
    if (e.movedIn) person.moves.push({ dir: 'in', date: e.movedIn, other: norm(e.movedInFrom) });
    if (e.movedOut) person.moves.push({ dir: 'out', date: e.movedOut, other: norm(e.movedOutTo) });
  }
  for (const [eid, days] of Object.entries(m.entries || {})) {
    const ref = `${siteKey}#${eid}`;
    const person = byRef.get(ref);
    if (!person) { warn(`ช่องบันทึกงานอ้าง eid ที่ไม่มีในทะเบียน ${ref} — ข้าม`); continue; }
    for (const [ymd, cell] of Object.entries(days || {})) {
      if (!DATE_RE.test(ymd)) { warn(`วันที่อ่านไม่ออก ${ref} "${ymd}" — ข้าม`); continue; }
      // ① สายปฏิบัติการเก็บช่องแรกที่ team สายสนับสนุนที่ detail — ทั้งของเขาและของเรา
      const slot1 = txt(person.kind === 'operation' ? cell.team : cell.detail);
      const other = txt(person.kind === 'operation' ? cell.detail : cell.team);
      if (other) warn(`${ref} ${ymd}: ต้นทางมีค่าในช่องของสายงานอื่นด้วย ("${other}") — ใช้ช่องของสายงานตัวเอง`);
      cells.push({ ref, ymd, slot1, pm: txt(cell.pm), note: txt(cell.note) });
    }
  }
});

/** คำขอลา — ค้างอยู่ + ตัดสินแล้ว */
const leaves = [];
const pushLeave = (r) => {
  const ref = `${r.site_key}#${r.eid}`;
  if (!byRef.has(ref)) { warn(`คำขอลา id ${r.id} อ้างพนักงานที่ไม่อยู่ในทะเบียน ${ref} — ข้าม`); return; }
  const status = ['pending', 'approved', 'rejected', 'cancelled'].includes(r.status) ? r.status : 'pending';
  if (!DATE_RE.test(r.from_date) || !DATE_RE.test(r.to_date)) { warn(`คำขอลา id ${r.id} วันที่อ่านไม่ออก — ข้าม`); return; }
  if (r.to_date < r.from_date) { warn(`คำขอลา id ${r.id} วันที่สิ้นสุดก่อนวันเริ่ม — ข้าม`); return; }
  leaves.push({
    sourceId: String(r.id), ref, status,
    from: r.from_date, to: r.to_date, reason: String(r.reason ?? ''),
    // ต้นทางไม่เก็บประเภทการลา (leave_type ว่างทุกแถว) — ลงเป็น "อื่น ๆ" ไม่เดาจาก
    // ข้อความเหตุผล การเดาประเภทการลาให้คนอื่นคือการแต่งข้อมูลในทะเบียนจริง
    leaveType: ['sick', 'personal', 'vacation', 'maternity', 'ordination', 'other'].includes(r.leave_type) ? r.leave_type : 'other',
    requestedAt: stamp(r.requested_at), decidedAt: stamp(r.decided_at),
    decidedByLabel: String(r.decided_by ?? '').trim(),
  });
};
for (const r of SUM.api_pendingLeaveRequests || []) pushLeave(r);
for (const r of (SUM.api_decidedLeaveRequests?.rows) || SUM.api_decidedLeaveRequests || []) pushLeave(r);

log(`   ไซต์ ${siteMeta.size} · พนักงาน ${num(people.length)} · ช่องบันทึกงาน ${num(cells.length)}`
  + ` · เดือน ${[...monthsSeen].sort().join(', ')} · คำขอลา ${leaves.length}`);

// ── รหัสพนักงานที่ซ้ำกัน ─────────────────────────────────────────────────────
// ② รหัสจริงเก็บไว้ครบทุกแถวใน live_emp_code · employee_code ของแถวที่สองขึ้นไป
//    ถูกเติม "#<eid>" เพราะคอลัมน์นั้นบังคับไม่ซ้ำ การเรียงลำดับคงที่ (ไซต์ตาม
//    ลำดับของ wl-calls แล้ว eid) เพื่อให้รันซ้ำได้ผลเดิมทุกครั้ง
const siteIdx = (k) => { const i = SITE_ORDER.indexOf(k); return i < 0 ? 99 : i; };
const codeGroups = new Map();
for (const p of people) (codeGroups.get(p.empId) || codeGroups.set(p.empId, []).get(p.empId)).push(p);
const dupReport = [];
for (const [code, group] of codeGroups) {
  group.sort((a, b) => siteIdx(a.siteKey) - siteIdx(b.siteKey) || a.eid - b.eid);
  group.forEach((p, i) => { p.uniqueCode = i === 0 ? code : `${code}#${p.eid}`; });
  if (group.length > 1) {
    dupReport.push({ code, rows: group.map((p) => ({ site: p.siteKey, eid: p.eid, name: p.name, stored: p.uniqueCode })) });
  }
}
if (!people.every((p) => p.empId)) warn(`มีพนักงาน ${people.filter((p) => !p.empId).length} คนไม่มีรหัสพนักงาน`);
const noName = people.filter((p) => !p.name);
if (noName.length) warn(`มีพนักงาน ${noName.length} คนที่ต้นทางไม่มีชื่อ: ${noName.map((p) => `${p.siteKey}#${p.eid} (รหัส ${p.empId})`).join(', ')}`);
const mojibake = people.filter((p) => /�/.test(p.name));
if (mojibake.length) warn(`มีพนักงาน ${mojibake.length} คนที่ชื่อในต้นทางมีอักขระเสีย (U+FFFD) — นำเข้าตามต้นทาง ไม่เดาแทน`);
log(`   รหัสพนักงานที่ซ้ำกัน ${dupReport.length} รหัส (${dupReport.reduce((s, d) => s + d.rows.length, 0)} แถว)`);

// ═══════════════════════════════════════════════════════════════════════════
// เขียนลงฐานข้อมูล — ทรานแซกชันเดียว
// ═══════════════════════════════════════════════════════════════════════════
const client = await pool.connect();
const stats = {};
const bump = (k, n = 1) => { stats[k] = (stats[k] || 0) + n; };
let failed = false;

try {
  await client.query('begin');

  // ── ไซต์ ─────────────────────────────────────────────────────────────────
  log('\n▸ ไซต์งาน');
  const units = (await client.query('select id, code, name, company, lock_days, is_active from units')).rows;
  const byName = new Map(units.map((u) => [norm(u.name), u]));
  // แผนสำรองเมื่อชื่อไม่ตรง: รหัสหน่วยงานที่ migration 0063 ตั้งไว้
  const FALLBACK = {
    bangtoei: 'BTBP', bangwua: 'BWA', phutthamonthon: 'PTM', sai5: 'S5',
    suphanburi: 'SPB', banphaeo: 'BPW', drivers: 'DRV', headoffice: 'HQ',
  };
  const byCode = new Map(units.map((u) => [u.code, u]));
  const unitOf = new Map();                       // siteKey -> unit row
  for (const key of [...siteMeta.keys()]) {
    const m = siteMeta.get(key);
    const u = byName.get(m.name) || byCode.get(FALLBACK[key]);
    if (!u) { console.error(`✗ จับคู่ไซต์ "${m.name}" (${key}) กับหน่วยงานของเราไม่ได้ — หยุดก่อนเขียน`); failed = true; break; }
    if (unitOf.has(key) || [...unitOf.values()].some((x) => x.id === u.id)) {
      console.error(`✗ ไซต์ ${key} ชี้ไปหน่วยงานเดียวกับไซต์อื่น (${u.code}) — หยุดก่อนเขียน`); failed = true; break;
    }
    if (norm(u.name) !== m.name) warn(`ชื่อหน่วยงานต่างกัน คงชื่อของเราไว้: "${u.name}" ≠ ต้นทาง "${m.name}" (${u.code})`);
    unitOf.set(key, u);
    await client.query(
      `update units set company = $1, lock_days = $2, is_active = true where id = $3`,
      [m.company, m.lockDays, u.id]);
    bump('units', 1);
    log(`   ${key.padEnd(15)} → ${u.code.padEnd(5)} ${u.name}  · lock ${m.lockDays} · ${m.company || '(ไม่มีบริษัท)'}`);
  }
  if (failed) throw new Error('site-mapping');

  // ── ลบข้อมูลสาธิต/ทดสอบ (ถ้าสั่ง) ───────────────────────────────────────
  if (DROP_DEMO) {
    log('\n▸ ข้อมูลสาธิต/ทดสอบที่จะลบ');
    // demo-worklog.mjs สร้างทุกอย่างไว้ใต้ไซต์รหัส DEMO เท่านั้น (SITE_CODE)
    // ส่วนแถวชื่อ "ทดสอบ" รหัส sd01/sd02 คือเศษจากการทดสอบหน้าจอที่ค้างอยู่บน
    // ไซต์จริง (บางเตย-บ้านพร้าว) ถ้าไม่เอาออกก็นับรวมเข้าตัวเลขของไซต์จริง
    const demoUnit = (await client.query("select id from units where code = 'DEMO'")).rows[0];
    const scope = (await client.query(
      `select e.id from employees e
        where ($1::uuid is not null and e.unit_id = $1)
           or e.employee_code in ('sd01','sd02')`, [demoUnit?.id || null])).rows.map((r) => r.id);
    const dump = {
      generated_at: new Date().toISOString(),
      why: 'ข้อมูลสาธิต (backend/scripts/demo-worklog.mjs ไซต์ DEMO) + แถวทดสอบ sd01/sd02 บนไซต์ BTBP — ลบก่อนนำเข้าข้อมูลจริง',
      employees: (await client.query('select * from employees where id = any($1)', [scope])).rows,
      work_logs: (await client.query('select * from work_logs where employee_id = any($1) or unit_id = $2', [scope, demoUnit?.id || null])).rows,
      work_log_lines: (await client.query(
        'select * from work_log_lines where work_log_id in (select id from work_logs where employee_id = any($1) or unit_id = $2)',
        [scope, demoUnit?.id || null])).rows,
      leave_requests: (await client.query('select * from leave_requests where employee_id = any($1) or unit_id = $2', [scope, demoUnit?.id || null])).rows,
      leave_approvers: (await client.query('select * from leave_approvers where employee_id = any($1)', [scope])).rows,
      employee_away: (await client.query('select * from employee_away where employee_id = any($1)', [scope])).rows,
      work_log_audit: (await client.query('select * from work_log_audit where employee_id = any($1) or unit_id = $2', [scope, demoUnit?.id || null])).rows,
      work_log_attachments: (await client.query('select * from work_log_attachments where employee_id = any($1) or unit_id = $2', [scope, demoUnit?.id || null])).rows,
      teams: (await client.query('select * from teams where unit_id = $1', [demoUnit?.id || null])).rows,
      period_closes: (await client.query(
        `select * from period_closes where unit_id = $1
          or (unit_id = (select id from units where code = 'BTBP') and ym = '2026-08')`, [demoUnit?.id || null])).rows,
      departments: (await client.query(
        `select * from departments where unit_id = $1 or (unit_id = (select id from units where code='BTBP') and name = 'ทดสอบ')`,
        [demoUnit?.id || null])).rows,
      positions: (await client.query(
        `select p.* from positions p join departments d on d.id = p.department_id
          where d.unit_id = $1 or (d.unit_id = (select id from units where code='BTBP') and d.name = 'ทดสอบ')`,
        [demoUnit?.id || null])).rows,
    };
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stampName = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `worklog-demo-backup-${stampName}${DRY ? '.dry' : ''}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(dump, null, 1));
    log(`   สำรองไว้แล้ว: ${backupPath}`);
    for (const [k, v] of Object.entries(dump)) if (Array.isArray(v)) log(`     ${k.padEnd(22)} ${v.length}`);

    // ลบจากใบไปหาราก — work_log_lines/employee_away/leave_approvers ตามหลัง cascade
    // อยู่แล้ว แต่สั่งตรง ๆ เพื่อให้จำนวนที่รายงานตรงกับที่ลบจริง
    const del = async (label, sql, p) => { const r = await client.query(sql, p); bump(`ลบ ${label}`, r.rowCount); };
    await del('work_log_attachments', 'delete from work_log_attachments where employee_id = any($1) or unit_id = $2', [scope, demoUnit?.id || null]);
    await del('work_log_lines', 'delete from work_log_lines where work_log_id in (select id from work_logs where employee_id = any($1) or unit_id = $2)', [scope, demoUnit?.id || null]);
    await del('work_logs', 'delete from work_logs where employee_id = any($1) or unit_id = $2', [scope, demoUnit?.id || null]);
    await del('work_log_audit', 'delete from work_log_audit where employee_id = any($1) or unit_id = $2', [scope, demoUnit?.id || null]);
    await del('leave_requests', 'delete from leave_requests where employee_id = any($1) or unit_id = $2', [scope, demoUnit?.id || null]);
    await del('leave_approvers', 'delete from leave_approvers where employee_id = any($1)', [scope]);
    await del('employee_away', 'delete from employee_away where employee_id = any($1)', [scope]);
    await del('employees', 'delete from employees where id = any($1)', [scope]);
    await del('teams', 'delete from teams where unit_id = $1', [demoUnit?.id || null]);
    await del('period_closes', `delete from period_closes where unit_id = $1
      or (unit_id = (select id from units where code = 'BTBP') and ym = '2026-08')`, [demoUnit?.id || null]);
    await del('positions', `delete from positions where department_id in (
        select id from departments where unit_id = $1
           or (unit_id = (select id from units where code='BTBP') and name = 'ทดสอบ'))`, [demoUnit?.id || null]);
    await del('departments', `delete from departments where unit_id = $1
      or (unit_id = (select id from units where code='BTBP') and name = 'ทดสอบ')`, [demoUnit?.id || null]);
    // ไซต์สาธิตไม่ถูกลบ — ปิดไว้ ประวัติในบันทึกตรวจสอบยังอ้างถึงมันได้
  }

  // ── แผนก / ตำแหน่ง ───────────────────────────────────────────────────────
  log('\n▸ แผนกและตำแหน่ง');
  const deptId = new Map();                       // `${siteKey}|${dept}` -> id
  const posId = new Map();                        // `${siteKey}|${dept}|${pos}` -> id
  for (const p of people) {
    if (!p.department) continue;
    const dk = `${p.siteKey}|${p.department}`;
    if (!deptId.has(dk)) {
      const r = await client.query(
        `insert into departments (unit_id, name) values ($1, $2)
         on conflict (unit_id, name) do update set is_active = true returning id`,
        [unitOf.get(p.siteKey).id, p.department]);
      deptId.set(dk, r.rows[0].id);
      bump('แผนก');
    }
    if (!p.position) continue;
    const pk = `${dk}|${p.position}`;
    if (!posId.has(pk)) {
      const r = await client.query(
        `insert into positions (department_id, name) values ($1, $2)
         on conflict (department_id, name) do update set is_active = true returning id`,
        [deptId.get(dk), p.position]);
      posId.set(pk, r.rows[0].id);
      bump('ตำแหน่ง');
    }
  }
  log(`   แผนก ${deptId.size} · ตำแหน่ง ${posId.size}`);

  // ── พนักงาน ──────────────────────────────────────────────────────────────
  log('\n▸ พนักงาน');
  // รหัสที่ถูกจับจองโดยแถวที่ไม่ใช่ของการนำเข้านี้ — ชนแล้วต้องเติมตัวแยก ไม่ใช่
  // ทับของคนอื่น (employee_code เป็น unique ทั้งตาราง ไม่ได้แยกตามไซต์)
  const foreign = new Set((await client.query(
    `select employee_code from employees
      where employee_code is not null
        and not (live_site_key is not null and live_eid is not null)`)).rows.map((r) => r.employee_code));
  for (const p of people) {
    if (foreign.has(p.uniqueCode)) {
      const alt = `${p.empId}#${p.eid}`;
      if (foreign.has(alt)) throw new Error(`รหัส ${p.uniqueCode} และ ${alt} ถูกใช้โดยแถวที่ไม่ใช่ของการนำเข้า — หยุดก่อนเขียน`);
      warn(`รหัส ${p.uniqueCode} ถูกใช้อยู่แล้วโดยแถวที่ไม่ใช่ของการนำเข้า → เก็บเป็น ${alt}`);
      p.uniqueCode = alt;
    }
  }

  const empIdOf = new Map();                      // ref -> employees.id
  const CHUNK = 400;
  for (let i = 0; i < people.length; i += CHUNK) {
    const part = people.slice(i, i + CHUNK);
    const r = await client.query(
      `insert into employees (live_site_key, live_eid, live_emp_code, employee_code, full_name,
                              kind, unit_id, department_id, position_id, is_active)
       select u.site, u.eid, u.live_code, u.code, u.name, u.kind::employee_kind, u.unit, u.dept, u.pos, true
         from unnest($1::text[], $2::int[], $3::text[], $4::text[], $5::text[], $6::text[],
                     $7::uuid[], $8::uuid[], $9::uuid[])
              as u(site, eid, live_code, code, name, kind, unit, dept, pos)
       on conflict (live_site_key, live_eid) where live_site_key is not null and live_eid is not null
       do update set live_emp_code = excluded.live_emp_code, employee_code = excluded.employee_code,
                     full_name = excluded.full_name, kind = excluded.kind, unit_id = excluded.unit_id,
                     department_id = excluded.department_id, position_id = excluded.position_id,
                     is_active = true
       returning id, live_site_key, live_eid`,
      [part.map((p) => p.siteKey), part.map((p) => p.eid), part.map((p) => p.empId || null),
       part.map((p) => p.uniqueCode || null), part.map((p) => p.name), part.map((p) => p.kind),
       part.map((p) => unitOf.get(p.siteKey).id),
       part.map((p) => deptId.get(`${p.siteKey}|${p.department}`) || null),
       part.map((p) => posId.get(`${p.siteKey}|${p.department}|${p.position}`) || null)]);
    for (const row of r.rows) empIdOf.set(`${row.live_site_key}#${row.live_eid}`, row.id);
    bump('พนักงาน', r.rowCount);
  }
  if (empIdOf.size !== people.length) throw new Error(`พนักงานเข้าไม่ครบ: ${empIdOf.size}/${people.length}`);
  log(`   ${num(empIdOf.size)} คน (สายปฏิบัติการ ${people.filter((p) => p.kind === 'operation').length}`
    + ` · สายสนับสนุน ${people.filter((p) => p.kind === 'support').length})`);

  // ── บันทึกงาน ────────────────────────────────────────────────────────────
  log('\n▸ บันทึกงาน');
  const kindOf = new Map(people.map((p) => [`${p.siteKey}#${p.eid}`, p.kind]));
  const unitIdOf = new Map(people.map((p) => [`${p.siteKey}#${p.eid}`, unitOf.get(p.siteKey).id]));
  for (let i = 0; i < cells.length; i += 1000) {
    const part = cells.slice(i, i + 1000);
    // ① ช่องแรกลงคอลัมน์ตามสายงาน — operation → team, support → detail
    const r = await client.query(
      `insert into work_logs (employee_id, unit_id, ymd, kind, team, detail, pm, note)
       select u.emp, u.unit, u.ymd, u.kind::worklog_kind, u.team, u.detail, u.pm, u.note
         from unnest($1::uuid[], $2::uuid[], $3::date[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[])
              as u(emp, unit, ymd, kind, team, detail, pm, note)
       on conflict (employee_id, ymd) do update set
            unit_id = excluded.unit_id, kind = excluded.kind, team = excluded.team,
            detail = excluded.detail, pm = excluded.pm, note = excluded.note,
            deleted_at = null, deleted_by = null`,
      [part.map((c) => empIdOf.get(c.ref)), part.map((c) => unitIdOf.get(c.ref)),
       part.map((c) => c.ymd), part.map((c) => kindOf.get(c.ref)),
       part.map((c) => (kindOf.get(c.ref) === 'operation' ? c.slot1 : null)),
       part.map((c) => (kindOf.get(c.ref) === 'operation' ? null : c.slot1)),
       part.map((c) => c.pm), part.map((c) => c.note)]);
    bump('บันทึกงาน', r.rowCount);
  }
  log(`   ${num(stats['บันทึกงาน'] || 0)} ช่อง`);

  // แถวส่วนเกินในช่วงเดือนที่นำเข้า — ไม่ลบเองโดยปริยาย เพราะอาจเป็นของที่คน
  // กรอกผ่านหน้าจอหลังนำเข้า สั่ง --prune เมื่อจะให้ตรงกับต้นทางเป๊ะ ๆ
  const ms = [...monthsSeen].sort();
  const from = `${ms[0]}-01`;
  const [lastY, lastM] = ms[ms.length - 1].split('-').map(Number);
  const to = `${ms[ms.length - 1]}-${String(new Date(lastY, lastM, 0).getDate()).padStart(2, '0')}`;
  const keep = new Set(cells.map((c) => `${empIdOf.get(c.ref)}|${c.ymd}`));
  const extra = (await client.query(
    `select id, employee_id, ymd::text ymd from work_logs
      where employee_id = any($1) and ymd between $2 and $3`,
    [[...empIdOf.values()], from, to])).rows.filter((r) => !keep.has(`${r.employee_id}|${r.ymd}`));
  if (extra.length) {
    if (PRUNE) {
      await client.query('delete from work_log_lines where work_log_id = any($1)', [extra.map((r) => r.id)]);
      const r = await client.query('delete from work_logs where id = any($1)', [extra.map((r) => r.id)]);
      bump('ลบบันทึกงานส่วนเกิน', r.rowCount);
      log(`   ลบส่วนเกินในช่วง ${from}..${to}: ${r.rowCount} แถว`);
    } else {
      warn(`มีบันทึกงาน ${extra.length} แถวในช่วง ${from}..${to} ที่ไม่มีในต้นทาง (ไม่ลบ — สั่ง --prune ถ้าต้องการให้ตรงเป๊ะ)`);
    }
  }

  // ── วันที่ไม่อยู่หน้างาน / การย้ายไซต์ ───────────────────────────────────
  // ④ ต้นทางวันนี้ไม่มีทั้งสองอย่าง (away ว่างทุกคน ไม่มี movedIn/movedOut เลย)
  //    โค้ดยังรับไว้ เพื่อให้การดึงข้อมูลรอบหน้าที่มีค่าจริงนำเข้าได้ทันที
  const awayRows = people.flatMap((p) => p.away.map((d) => [empIdOf.get(`${p.siteKey}#${p.eid}`), d]));
  if (awayRows.length) {
    const r = await client.query(
      `insert into employee_away (employee_id, ymd)
       select * from unnest($1::uuid[], $2::date[]) on conflict do nothing`,
      [awayRows.map((x) => x[0]), awayRows.map((x) => x[1])]);
    bump('วันไม่อยู่หน้างาน', r.rowCount);
  }
  const moveRows = [];
  for (const p of people) {
    for (const mv of p.moves) {
      if (!DATE_RE.test(mv.date)) { warn(`วันที่ย้ายไซต์อ่านไม่ออก ${p.siteKey}#${p.eid} "${mv.date}"`); continue; }
      const otherUnit = byName.get(mv.other);
      if (!otherUnit) { warn(`ย้ายไซต์ของ ${p.siteKey}#${p.eid} อ้างหน่วยงาน "${mv.other}" ที่จับคู่ไม่ได้ — ข้าม`); continue; }
      const here = unitOf.get(p.siteKey).id;
      moveRows.push(mv.dir === 'in'
        ? { emp: empIdOf.get(`${p.siteKey}#${p.eid}`), from: otherUnit.id, to: here, date: mv.date }
        : { emp: empIdOf.get(`${p.siteKey}#${p.eid}`), from: here, to: otherUnit.id, date: mv.date });
    }
  }
  for (const mv of moveRows) {
    const exists = await client.query(
      'select 1 from employee_moves where employee_id = $1 and effective_date = $2 and from_unit_id = $3 and to_unit_id = $4',
      [mv.emp, mv.date, mv.from, mv.to]);
    if (exists.rowCount) continue;
    await client.query(
      `insert into employee_moves (employee_id, from_unit_id, to_unit_id, effective_date, note)
       values ($1,$2,$3,$4,'นำเข้าจากระบบเดิม')`, [mv.emp, mv.from, mv.to, mv.date]);
    bump('ย้ายหน่วยงาน');
  }
  log(`   วันไม่อยู่หน้างาน ${stats['วันไม่อยู่หน้างาน'] || 0} · ย้ายหน่วยงาน ${stats['ย้ายหน่วยงาน'] || 0}`);

  // ── คำขอลา ───────────────────────────────────────────────────────────────
  log('\n▸ คำขอลา');
  for (const lv of leaves) {
    const emp = empIdOf.get(lv.ref);
    const unit = unitIdOf.get(lv.ref);
    const days = (new Date(`${lv.to}T00:00:00Z`) - new Date(`${lv.from}T00:00:00Z`)) / 86400000 + 1;
    const cur = (await client.query('select id from leave_requests where source_id = $1', [lv.sourceId])).rows[0];
    const vals = [emp, unit, lv.leaveType, lv.from, lv.to, lv.reason, lv.status,
      lv.requestedAt, lv.decidedAt, 'full', days];
    if (cur) {
      await client.query(
        `update leave_requests set employee_id=$1, unit_id=$2, leave_type=$3, from_date=$4, to_date=$5,
           reason=$6, status=$7, requested_at=coalesce($8::timestamptz, requested_at), decided_at=$9::timestamptz,
           day_part=$10, days=$11 where id=$12`, [...vals, cur.id]);
      bump('คำขอลา (แก้)');
    } else {
      await client.query(
        `insert into leave_requests (employee_id, unit_id, leave_type, from_date, to_date, reason, status,
            requested_at, decided_at, day_part, days, source_id)
         values ($1,$2,$3,$4,$5,$6,$7, coalesce($8::timestamptz, now()), $9::timestamptz, $10,$11,$12)`,
        [...vals, lv.sourceId]);
      bump('คำขอลา (ใหม่)');
    }
    // ผู้ตัดสินในระบบเดิมคือ "(guest)" ซึ่งไม่มีบัญชีในระบบเรา decided_by จึงเป็น null
    if (lv.decidedByLabel && lv.decidedByLabel !== '(guest)') {
      warn(`คำขอลา ${lv.sourceId} ตัดสินโดย "${lv.decidedByLabel}" ซึ่งไม่มีบัญชีในระบบเรา — decided_by เป็นค่าว่าง`);
    }
  }
  log(`   ใหม่ ${stats['คำขอลา (ใหม่)'] || 0} · แก้ ${stats['คำขอลา (แก้)'] || 0} (รวม ${leaves.length})`);

  // ── ปิดหน่วยงานที่ระบบจริงไม่มีและไม่มีใครใช้ ─────────────────────────────
  log('\n▸ หน่วยงานที่ไม่มีในระบบจริง');
  const keepUnits = [...unitOf.values()].map((u) => u.id);
  const closed = await client.query(
    `update units u set is_active = false
      where u.id <> all($1) and u.is_active = true
        and not exists (select 1 from employees e where e.unit_id = u.id)
        and not exists (select 1 from work_logs w where w.unit_id = u.id)
        and not exists (select 1 from profiles p where p.unit_id = u.id)
        and not exists (select 1 from profile_units pu where pu.unit_id = u.id)
      returning code, name`, [keepUnits]);
  for (const r of closed.rows) log(`   ปิด ${r.code} ${r.name}`);
  bump('ปิดหน่วยงาน', closed.rowCount);
  const stillOpen = (await client.query(
    `select u.code, u.name, (select count(*)::int from employees e where e.unit_id = u.id) emps
       from units u where u.id <> all($1) and u.is_active = true and u.code is not null`, [keepUnits])).rows;
  for (const r of stillOpen) warn(`หน่วยงาน ${r.code} "${r.name}" ไม่มีในระบบจริงแต่ยังมีข้อมูลผูกอยู่ (พนักงาน ${r.emps}) — ไม่ปิดให้`);

  // ── สรุปที่จะออกจากทรานแซกชันนี้ ─────────────────────────────────────────
  log('\n▸ ยอดในตารางหลังนำเข้า (ในทรานแซกชัน)');
  const after = (await client.query(`select
      (select count(*)::int from units) units,
      (select count(*)::int from units where is_active) units_active,
      (select count(*)::int from employees) employees,
      (select count(*)::int from employees where live_site_key is not null) employees_imported,
      (select count(*)::int from work_logs) work_logs,
      (select count(*)::int from work_logs where deleted_at is null) work_logs_live,
      (select count(*)::int from leave_requests) leave_requests,
      (select count(*)::int from employee_away) employee_away,
      (select count(*)::int from employee_moves) employee_moves,
      (select count(*)::int from departments) departments,
      (select count(*)::int from positions) positions`)).rows[0];
  for (const [k, v] of Object.entries(after)) log(`   ${k.padEnd(20)} ${num(v)}`);

  log('\n▸ ตรวจกับสรุปเดือนสิงหาคมของระบบเดิม (นับจากแถวที่เพิ่งเขียน)');
  const bench = new Map(((SUM['api_adminSummary#1']?.rows) || []).map((r) => [r.site_key, r]));
  const augDays = 31, tgtY = 2026, tgtM = 8;
  let sundays = 0;
  for (let d = 1; d <= augDays; d += 1) if (new Date(tgtY, tgtM - 1, d).getDay() === 0) sundays += 1;
  const workdays = augDays - sundays;
  let allOk = true;
  for (const [key, u] of unitOf) {
    const b = bench.get(key);
    const r = (await client.query(
      `select count(*)::int entries,
              count(distinct case when e.kind='operation' then e.id end)::int op_started,
              count(distinct case when e.kind='support'   then e.id end)::int sup_started
         from work_logs w join employees e on e.id = w.employee_id
        where w.unit_id = $1 and w.ymd between $2 and $3 and w.deleted_at is null
          and (coalesce(btrim(w.team),'') <> '' or coalesce(btrim(w.detail),'') <> ''
               or coalesce(btrim(w.pm),'') <> '' or coalesce(btrim(w.note),'') <> '')`,
      [u.id, `${tgtY}-08-01`, `${tgtY}-08-${augDays}`])).rows[0];
    const nEmp = (await client.query('select count(*)::int n from employees where unit_id = $1 and is_active', [u.id])).rows[0].n;
    const denom = nEmp * workdays;
    const fill = denom > 0 ? Math.min(100, Math.round((r.entries / denom) * 100)) : 0;
    const got = { n_emp: nEmp, entries: r.entries, operation_started: r.op_started, support_started: r.sup_started, fillRate: fill, fillRateDenom: denom };
    const diffs = b ? Object.keys(got).filter((k) => Number(got[k]) !== Number(b[k])) : ['(ไม่มีเกณฑ์)'];
    if (diffs.length) allOk = false;
    log(`   ${diffs.length ? '✗' : '✓'} ${(b?.site_name || u.name).padEnd(26)} `
      + `คน ${String(got.n_emp).padStart(3)} · บันทึก ${String(got.entries).padStart(5)} · op ${String(got.operation_started).padStart(3)}`
      + ` · sup ${String(got.support_started).padStart(3)} · ${got.fillRate}% / ${got.fillRateDenom}`
      + (diffs.length ? `   ต่างที่: ${diffs.map((k) => `${k} ได้ ${got[k]} ควรเป็น ${b?.[k]}`).join(', ')}` : ''));
  }
  log(`   ${allOk ? '✓ ตรงทุกไซต์ทุกค่า' : '✗ ยังมีค่าที่ไม่ตรง'}`);

  if (DRY) { await client.query('rollback'); log('\n⟲ --dry: ยกเลิกทุกอย่าง ไม่มีอะไรถูกเขียน'); }
  else { await client.query('commit'); log('\n✓ บันทึกลงฐานข้อมูลแล้ว'); }
} catch (e) {
  await client.query('rollback').catch(() => {});
  console.error(`\n✗ ล้มเหลว ยกเลิกทั้งหมด: ${e.message}`);
  failed = true;
} finally {
  client.release();
}

// ── รายงาน ───────────────────────────────────────────────────────────────────
log('\n── สิ่งที่ทำ ' + '─'.repeat(46));
for (const [k, v] of Object.entries(stats)) log(`   ${k.padEnd(26)} ${num(v)}`);
if (dupReport.length) {
  log(`\n── รหัสพนักงานที่ซ้ำกัน ${dupReport.length} รหัส ` + '─'.repeat(20));
  for (const d of dupReport) {
    log(`   ${d.code}`);
    for (const r of d.rows) log(`      ${r.site}#${r.eid}  ${r.name || '(ไม่มีชื่อในต้นทาง)'}  → employee_code ${r.stored}`);
  }
}
if (problems.length) { log(`\n── ข้อควรรู้ ${problems.length} ข้อ ` + '─'.repeat(36)); problems.forEach((p) => log(`   · ${p}`)); }
await pool.end();
process.exit(failed ? 1 : 0);
