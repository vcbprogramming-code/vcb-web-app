/**
 * นำเข้ารายงานการประชุมจริงของลูกค้า — กลุ่ม/โครงการ + บันทึก 82 ฉบับ
 *
 *   node scripts/import-live-meetings.mjs --dry     ← พิมพ์สรุป ไม่เขียนอะไรเลย
 *   node scripts/import-live-meetings.mjs           ← เขียนจริง (ธุรกรรมเดียว)
 *   node scripts/import-live-meetings.mjs --src <dir>
 *
 * ต้นทางคือสิ่งที่ดึงสดจากระบบที่ลูกค้าใช้อยู่จริงเมื่อ 2026-09-27 (Apps Script):
 *   meetings.json      getBootstrap (รายการโครงการ) + listMeetings (82 แถว)
 *   mtg-content{1,2}.json  getMeeting ทั้ง 82 ฉบับ พร้อมเนื้อหา HTML
 * สำเนาอยู่ใน scripts/live-meetings/ เพื่อให้รันซ้ำและตรวจซ้ำได้ภายหลัง
 *
 * ── สองเรื่องที่ทำให้สคริปต์นี้ไม่ตรงไปตรงมา ────────────────────────────────
 *
 * 1. "โครงการ" ของแถวหนึ่ง ไม่ใช่ที่ที่แถวนั้นอยู่
 *    59 จาก 82 ฉบับอยู่ในกล่องรอจัดเก็บ (FATHOM_INBOX / TRANSKRIPTOR_INBOX) และ
 *    ถูกจัดเก็บเข้าโครงการด้วย taggedProjectIds — listMeetings ของเขาแสดง
 *    projectId เป็นโครงการที่จัดเก็บไว้ ไม่ใช่กล่องที่มันอยู่ โครงสร้างนี้ตรงกับ
 *    ของเราพอดี (group_id = กล่อง, mtg_meeting_tags = ที่จัดเก็บ) จึงนำเข้าตาม
 *    ความจริงของเขา: บ้านคือกล่อง ป้ายคือโครงการ ไม่ใช่ยัดทุกฉบับเข้าโครงการ
 *    ตรง ๆ ซึ่งจะทำให้คิวที่ต้องไล่ฟังหายไปทั้งคิว
 *
 * 2. จำนวนที่แถบข้างต้องโชว์ = ฉบับที่อยู่ในกลุ่มนั้น + ฉบับที่จัดเก็บเข้ากลุ่มนั้น
 *    (count + tagged_count) เลขของเขาบนหน้าจอจริงจึงเป็น FIN 9 · BT12 18 · BV 19 ·
 *    PN34 4 · ERP 24 · LPP 1 · ลาดหลุมแก้ว 5 · ชวนา 2 = 82 ทั้งที่ getBootstrap
 *    ของเขาส่ง count มาเป็นจำนวน "ฉบับที่อยู่ในโครงการนั้นตรง ๆ" เท่านั้น
 *    (FIN 6, BT12 6, BV 9, PN34 2) สคริปต์นี้ยืนยันเลขชุดแรกตอนจบ
 *
 * idempotent: กุญแจคือ meeting_key = id ของแถวในระบบเขา รันซ้ำแล้วอัปเดตทับ
 * ไม่เกิดแถวซ้ำ · ผู้สร้าง/ผู้แก้ไขปล่อย null เพราะเราไม่รู้ว่าใครเป็นคนเขียนใน
 * ระบบเขา และการยกให้แอดมินของเราคนหนึ่งจะทำให้หน้าจอบอกว่า "บันทึกโดย" คนที่
 * ไม่ได้เขียน
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/config/db.js';
import { sanitizeHtml, htmlToText } from '../src/utils/sanitizeHtml.js';
import { parseDateLabel } from '../src/routes/meetings.routes.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const srcArg = argv.indexOf('--src');
const SRC = srcArg >= 0 && argv[srcArg + 1]
  ? path.resolve(argv[srcArg + 1])
  : path.join(HERE, 'live-meetings');

const read = (name) => {
  const p = path.join(SRC, name);
  if (!fs.existsSync(p)) {
    console.error(`✗ ไม่พบไฟล์ต้นทาง: ${p}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};

// ── ต้นทาง ──────────────────────────────────────────────────────────────────
const boot = read('meetings.json');
const listMeetings = boot.listMeetings || [];
const bootProjects = boot.getBootstrap?.projects || [];
const docs = [...Object.values(read('mtg-content1.json')), ...Object.values(read('mtg-content2.json'))];

/**
 * โครงการที่ getBootstrap ที่ดึงมาไม่ได้ส่งมาด้วย แต่มีการประชุมอ้างถึงจริง
 *
 * ชื่อไทยมาจากแถบข้างของระบบเขาเอง (ภาพหน้าจอวันที่ดึงข้อมูล) และตรงกับชื่อที่
 * โผล่ในชื่อเรื่องของการประชุมในกลุ่มนั้น ("Kick-off โครงการลาดหลุมแก้ว",
 * "LPB - ประชุมภาพรวมโครงการหลวงพระบาง", "ชวนา - หล่อเสาเข็ม")
 *
 * ชื่ออังกฤษ/รอบการประชุม/สีของสี่กลุ่มนี้ไม่มีในข้อมูลที่ดึงมา — cadence จึง
 * ปล่อยว่างไว้ (ไม่เดา) สีเลือกให้ไม่ชนกับห้าสีที่เป็นของเขาจริง
 */
const EXTRA_GROUPS = {
  ERP: { name: 'ERP Implementation', nameEn: '', cadence: '', color: '#0d9488' },
  LPP: { name: 'โครงการหลวงพระบาง', nameEn: 'Luang Prabang (LPB)', cadence: '', color: '#c2410c' },
  3: { name: 'โครงการลาดหลุมแก้ว ตอน 3', nameEn: 'Lat Lum Kaeo Section 3 (LK)', cadence: '', color: '#4338ca' },
  PROJ: { name: 'โรงหล่อชวนา', nameEn: 'Chawana Casting Yard (CVE)', cadence: '', color: '#b45309' },
};

/** ลำดับแถบข้างตามหน้าจอจริงของเขา ชื่อที่ไม่อยู่ในรายการนี้ต่อท้ายตามลำดับเดิม */
const SIDEBAR_ORDER = ['FIN', 'BT12', 'BV', 'PN34', 'ERP', 'LPP', '3', 'PROJ'];

/** กล่องรอจัดเก็บของเขา → รหัสกล่องของเรา (0046_meeting_inbox.sql) */
const INBOX = { FATHOM_INBOX: 'INBOX_FATHOM', TRANSKRIPTOR_INBOX: 'INBOX_TRANSKRIPTOR' };
const isInbox = (pid) => Object.hasOwn(INBOX, String(pid));

// ── รวมรายชื่อกลุ่มที่ต้องมี ────────────────────────────────────────────────
const wanted = new Map();   // code → {code, name, nameEn, cadence, color}
for (const p of bootProjects) {
  wanted.set(String(p.id), {
    code: String(p.id),
    name: p.name || String(p.id),
    nameEn: p.nameEn || '',
    cadence: p.cadence || '',
    color: p.color || '#64748b',
  });
}
// ทุกรหัสที่การประชุมอ้างถึง ต้องมีกลุ่มรองรับ ไม่งั้นแถวนั้นไม่มีที่ลง
const referenced = new Set();
for (const d of docs) {
  if (!isInbox(d.projectId)) referenced.add(String(d.projectId));
  for (const t of d.taggedProjectIds || []) referenced.add(String(t));
}
for (const code of referenced) {
  if (wanted.has(code)) continue;
  const extra = EXTRA_GROUPS[code];
  if (!extra) {
    console.error(`✗ ไม่รู้จักโครงการรหัส "${code}" — เพิ่มชื่อใน EXTRA_GROUPS ก่อนนำเข้า`);
    process.exit(1);
  }
  wanted.set(code, { code, ...extra });
}
// เรียงตามหน้าจอของเขา ที่เหลือต่อท้าย (BD ไม่มีการประชุมในชุดที่ดึงมาและไม่อยู่
// ในแถบข้างที่เห็น จึงไปอยู่ท้ายแทนที่จะดันลำดับที่ลูกค้าเห็นอยู่ทุกวัน)
const rank = (code) => (SIDEBAR_ORDER.indexOf(code) < 0 ? 900 : SIDEBAR_ORDER.indexOf(code));
const groupRows = [...wanted.values()]
  .sort((a, b) => rank(a.code) - rank(b.code) || a.code.localeCompare(b.code));

// ── สิ่งที่ต้องรู้ต่อหนึ่งฉบับ ──────────────────────────────────────────────
const listById = new Map(listMeetings.map((m) => [m.id, m]));
const missing = docs.filter((d) => !listById.has(d.id));
if (missing.length) console.warn(`⚠ ${missing.length} ฉบับมีเนื้อหาแต่ไม่อยู่ใน listMeetings`);
const noContent = listMeetings.filter((m) => !docs.some((d) => d.id === m.id));
if (noContent.length) console.warn(`⚠ ${noContent.length} ฉบับอยู่ในรายการแต่ไม่มีเนื้อหา`);

const http = (v) => (/^https?:\/\//i.test(String(v || '').trim()) ? String(v).trim() : '');
/** วันที่ของเขาเป็น 'yyyy-mm-dd' อยู่แล้ว ส่งเป็นสตริงตรง ๆ ให้ Postgres เพื่อไม่
 *  ให้ Date ของจาวาสคริปต์แปลงเป็น UTC แล้ววันเลื่อนไปหนึ่งวัน */
const isoDay = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim()) ? String(v).trim() : null);

const stat = {
  groupsInserted: 0, groupsUpdated: 0, groupsDeleted: [], groupsKept: [],
  meetingsInserted: 0, meetingsUpdated: 0,
  tags: 0, attachments: 0, comments: 0,
  unparsedDates: [], droppedLabels: [], authorsUnmatched: new Set(),
};

const client = await pool.connect();
try {
  await client.query('begin');

  // ── 1. กลุ่มเดิมของเราที่ไม่มีใครใช้ ─────────────────────────────────────
  // กลุ่ม 9 กลุ่มที่ migration 0045 หว่านไว้จากโครงการ E-Memo ไม่ตรงกับรายการของ
  // ลูกค้าเลย (และมีกลุ่มชื่อ "test" ติดมาด้วย) เจ้าของงานอนุมัติให้ลบ — แต่ลบ
  // เฉพาะกลุ่มที่พิสูจน์ได้ว่าไม่มีอะไรอ้างถึงจริง ๆ ไม่ใช่ลบตามชื่อ
  //
  // กล่องรอจัดเก็บสองกล่องไม่ใช่ "กลุ่มเดิมของเรา" ที่จะลบ: ข้อมูลของเขา 59 ฉบับ
  // อยู่ในกล่องพวกนี้ ลบทิ้งแล้วไม่มีที่ให้ลง
  const codes = groupRows.map((g) => g.code);
  const legacy = (await client.query(
    `select g.id, g.code, g.name,
            (select count(*)::int from mtg_meetings m where m.group_id = g.id) as meetings,
            (select count(*)::int from mtg_meeting_tags t where t.group_id = g.id) as tags,
            (select count(*)::int from mtg_group_guests gu where gu.group_id = g.id) as guests
       from mtg_groups g
      where not g.is_inbox and (g.code is null or not (g.code = any($1)))`, [codes])).rows;
  for (const g of legacy) {
    const refs = g.meetings + g.tags + g.guests;
    if (refs > 0) {
      stat.groupsKept.push({ ...g, refs });
      // ถ้ากลุ่มที่เก็บไว้ถือรหัสเดียวกับกลุ่มของลูกค้า การ upsert ข้างล่างจะเขียน
      // ทับชื่อกลุ่มที่ยังมีข้อมูลอยู่ หยุดทั้งธุรกรรมดีกว่าเปลี่ยนชื่อข้อมูลของ
      // คนอื่นอย่างเงียบ ๆ
      if (codes.includes(g.code)) throw new Error(`รหัสกลุ่ม "${g.code}" ชนกับกลุ่มเดิมที่ยังมีข้อมูล (${g.name}) — ต้องตัดสินใจก่อน`);
      continue;
    }
    await client.query('delete from mtg_groups where id = $1', [g.id]);
    stat.groupsDeleted.push(g);
  }

  // ── 2. กลุ่มของลูกค้า ────────────────────────────────────────────────────
  // project_id ปล่อย null โดยตั้งใจ: กลุ่มของเขาไม่ใช่โครงการ E-Memo ของเราแบบ
  // หนึ่งต่อหนึ่ง ("งบการเงินทุกโครงการ", "Business Development", "ERP
  // Implementation" ไม่ใช่ไซต์งาน) การผูกมั่ว ๆ จะทำให้ขอบเขตการมองเห็นราย
  // บุคคลตัดกลุ่มผิดกลุ่มออกไปจากคนที่ควรเห็น
  const groupIdByCode = new Map();
  for (const [i, g] of groupRows.entries()) {
    const row = (await client.query(
      `insert into mtg_groups (code, name, name_en, cadence, color, sort_order, project_id, is_active)
       values ($1,$2,$3,$4,$5,$6,null,true)
       on conflict (code) do update set
         name = excluded.name, name_en = excluded.name_en, cadence = excluded.cadence,
         color = excluded.color, sort_order = excluded.sort_order, is_active = true,
         -- กลุ่มเดิมของเราที่ถือรหัสเดียวกัน (BV) ผูกอยู่กับโครงการ E-Memo อีก
         -- โครงการหนึ่ง ("บางโฉลง-บางบัว" ไม่ใช่ "บางวัว") ถ้าไม่ล้างทิ้ง กลุ่ม
         -- ของลูกค้าจะสืบทอดการผูกที่ผิดไปเงียบ ๆ แล้วขอบเขตการมองเห็นราย
         -- บุคคลก็จะตัดกลุ่มนี้ตามโครงการที่ไม่เกี่ยวกันเลย
         project_id = null
       returning id, (xmax = 0) as inserted`,
      [g.code, g.name, g.nameEn, g.cadence, g.color, i + 1])).rows[0];
    groupIdByCode.set(g.code, row.id);
    if (row.inserted) stat.groupsInserted += 1; else stat.groupsUpdated += 1;
  }
  for (const [theirs, ours] of Object.entries(INBOX)) {
    const row = (await client.query('select id from mtg_groups where code = $1', [ours])).rows[0];
    if (!row) throw new Error(`ไม่พบกล่องรอจัดเก็บรหัส ${ours} — migration 0046 ยังไม่ถูกรัน`);
    groupIdByCode.set(theirs, row.id);
  }

  // ── 3. ผู้เขียนความเห็น ──────────────────────────────────────────────────
  // ความเห็นของเขาเก็บอีเมลคนเขียน ถ้าอีเมลนั้นมีบัญชีในระบบเราก็ผูกให้ ถ้าไม่มี
  // ก็ปล่อย null (ห้ามสร้างผู้ใช้ใหม่) หน้าจอจะขึ้นว่า "ไม่ระบุ"
  const profileByEmail = new Map((await client.query(
    'select id, lower(email) as email from profiles where email is not null')).rows.map((r) => [r.email, r.id]));

  // ── 4. บันทึกการประชุม ───────────────────────────────────────────────────
  for (const d of docs) {
    const L = listById.get(d.id) || {};
    const homeCode = isInbox(d.projectId) ? d.projectId : String(d.projectId);
    const groupId = groupIdByCode.get(homeCode);
    if (!groupId) throw new Error(`ฉบับ ${d.id} อ้างกลุ่ม "${homeCode}" ที่ไม่มีอยู่`);

    const html = sanitizeHtml(d.html || '');
    const excerpt = String(L.excerpt || htmlToText(html)).slice(0, 200);
    const date = isoDay(d.date ?? L.date);
    const rawLabel = String(d.dateLabel ?? L.dateLabel ?? '').trim();
    // ── date_label เก็บเฉพาะข้อความที่เป็น "วันที่" จริง ๆ ───────────────────
    // ช่องวันที่ในฟอร์มแก้ไขของเราแสดง date_label ก่อน meeting_date (dateFieldValue)
    // ดังนั้นข้อความที่อ่านเป็นวันที่ไม่ได้หรืออ่านได้คนละวัน จะกลายเป็นกับดัก:
    // ใครเปิดแก้ไขแล้วกดบันทึก วันที่จริงของเขาก็เปลี่ยนหรือหายไปเงียบ ๆ
    //   · 74 ฉบับ label อ่านได้ตรงกับวันที่ของเขา → เก็บไว้ (ยังเป็นสิ่งที่คนพิมพ์)
    //   ·  5 ฉบับ label เขียน "2568-09-10" แต่วันที่ของเขาคือ 9 ต.ค. 2568 (ระบบเขา
    //      อ่านแบบ ปี-วัน-เดือน) ของเราอ่านเป็น ปี-เดือน-วัน แล้วได้คนละวัน → ไม่เก็บ
    //   ·  1 ฉบับ label เป็นชื่อเรื่อง ไม่ใช่วันที่เลย → ไม่เก็บ
    // วันประชุมยังเป็นวันของเขาเป๊ะ ๆ ทุกฉบับ ที่ไม่เก็บคือข้อความ ไม่ใช่วันที่
    let label = rawLabel;
    if (date && rawLabel && parseDateLabel(rawLabel) !== date) {
      stat.droppedLabels.push({ id: d.id, date, label: rawLabel, reads: parseDateLabel(rawLabel) || '—' });
      label = '';
    }
    if (!date && rawLabel) stat.unparsedDates.push({ id: d.id, label: rawLabel });

    const vals = [
      groupId, d.title || '(ไม่มีชื่อเรื่อง)', date, label,
      d.kind === 'overview' ? 'overview' : 'meeting',
      String(d.time || L.time || ''), html, excerpt,
      JSON.stringify((d.attendees || []).filter(Boolean)),
      Boolean(d.pinned), d.visible !== false,
      ['manual', 'doc-import', 'fathom', 'transkriptor'].includes(d.source) ? d.source : 'doc-import',
      http(d.fathomUrl), http(d.docUrl), d.id,
      d.createdAt || null, d.updatedAt || d.createdAt || null,
    ];
    const existing = (await client.query('select id from mtg_meetings where meeting_key = $1', [d.id])).rows[0];
    let id;
    if (existing) {
      id = existing.id;
      await client.query(
        `update mtg_meetings set group_id=$1, title=$2, meeting_date=$3, date_label=$4, kind=$5,
           time_label=$6, content=$7, excerpt=$8, attendees=$9::jsonb, pinned=$10, visible=$11,
           source=$12, recording_url=$13, source_url=$14,
           created_at=coalesce($16::timestamptz, created_at), updated_at=coalesce($17::timestamptz, now())
         where meeting_key=$15`, vals);
      stat.meetingsUpdated += 1;
    } else {
      id = (await client.query(
        `insert into mtg_meetings (group_id, title, meeting_date, date_label, kind, time_label,
           content, excerpt, attendees, pinned, visible, source, recording_url, source_url,
           meeting_key, created_at, updated_at, created_by, updated_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,
                 coalesce($16::timestamptz, now()), coalesce($17::timestamptz, now()), null, null)
         returning id`, vals)).rows[0].id;
      stat.meetingsInserted += 1;
    }

    // ป้ายโครงการ — เขียนใหม่ทั้งชุดทุกครั้ง เพราะป้ายคือภาพปัจจุบันของการจัดเก็บ
    // ไม่ใช่ประวัติ (ป้ายที่ชี้กลุ่มบ้านตัวเองถือว่าซ้ำซ้อน ของเราไม่อนุญาต)
    await client.query('delete from mtg_meeting_tags where meeting_id = $1', [id]);
    for (const code of new Set((d.taggedProjectIds || []).map(String))) {
      const gid = groupIdByCode.get(code);
      if (!gid || gid === groupId) continue;
      await client.query(
        `insert into mtg_meeting_tags (meeting_id, group_id, tagged_by, created_at)
         values ($1,$2,null,coalesce($3::timestamptz, now())) on conflict do nothing`,
        [id, gid, d.updatedAt || d.createdAt || null]);
      stat.tags += 1;
    }

    // ไฟล์แนบ — ของเขาอยู่บน Google Drive เก็บเป็นลิงก์ ไม่ดาวน์โหลดไบต์มาเอง
    for (const a of d.attachments || []) {
      const url = http(a.url);
      const name = String(a.name || 'ไฟล์แนบ');
      const dup = (await client.query(
        `select id from mtg_attachments where meeting_id = $1 and file_name = $2
           and (external_url = $3 or $3 = '')`, [id, name, url])).rows[0];
      if (dup) continue;
      await client.query(
        `insert into mtg_attachments (meeting_id, kind, file_name, content_type, size_bytes,
           storage_key, external_url, uploaded_by, created_at)
         values ($1,'file',$2,$3,$4,'',$5,null,coalesce($6::timestamptz, now()))`,
        [id, name, String(a.mimeType || ''), Number(a.size) || 0, url, a.uploadedAt || null]);
      stat.attachments += 1;
    }

    // ความเห็น — id ของเขาเป็น uuid ใช้เป็นกุญแจหลักของเราได้ตรง ๆ รันซ้ำก็ไม่ซ้ำ
    for (const c of d.comments || []) {
      const email = String(c.author || '').toLowerCase();
      const authorId = profileByEmail.get(email) || null;
      if (email && !authorId) stat.authorsUnmatched.add(email);
      const body = String(c.text || '').trim();
      if (!body) continue;
      const r = await client.query(
        `insert into mtg_comments (id, meeting_id, author_id, body, created_at)
         values (coalesce($1::uuid, gen_random_uuid()),$2,$3,$4,coalesce($5::timestamptz, now()))
         on conflict (id) do nothing returning id`,
        [/^[0-9a-f-]{36}$/i.test(String(c.id || '')) ? c.id : null, id, authorId, body, c.createdAt || null]);
      if (r.rows.length) stat.comments += 1;
    }
  }

  // ── 5. ตรวจตัวเลขต่อกลุ่มก่อนจะยืนยัน ────────────────────────────────────
  const counts = (await client.query(
    `select g.code, g.name, g.sort_order, g.is_inbox,
            (select count(*)::int from mtg_meetings m where m.group_id = g.id) as own,
            (select count(*)::int from mtg_meeting_tags t where t.group_id = g.id) as tagged
       from mtg_groups g where g.is_active = true order by g.sort_order, g.name`)).rows;

  console.log(`\n${DRY ? '── ทดลอง (ไม่เขียน) ' : '── นำเข้าจริง '}${'─'.repeat(40)}`);
  console.log(`ต้นทาง: ${SRC}`);
  console.log(`\nกลุ่ม: เพิ่ม ${stat.groupsInserted} · อัปเดต ${stat.groupsUpdated} · ลบกลุ่มเดิมที่ไม่มีใครใช้ ${stat.groupsDeleted.length}`);
  for (const g of stat.groupsDeleted) console.log(`   – ลบ ${g.code} · ${g.name}`);
  for (const g of stat.groupsKept) console.log(`   ! เก็บไว้ ${g.code} · ${g.name} (ยังมีอ้างอิง ${g.refs})`);
  console.log(`\nการประชุม: เพิ่ม ${stat.meetingsInserted} · อัปเดต ${stat.meetingsUpdated} (ต้นทาง ${docs.length})`);
  console.log(`ป้ายข้ามโครงการ ${stat.tags} · ไฟล์แนบ ${stat.attachments} · ความเห็น ${stat.comments}`);
  if (stat.unparsedDates.length) console.log(`วันที่แปลงไม่ออก ${stat.unparsedDates.length}: ${stat.unparsedDates.map((x) => x.label).join(' | ')}`);
  if (stat.droppedLabels.length) {
    console.log(`\nข้อความวันที่ที่ไม่เก็บ ${stat.droppedLabels.length} ฉบับ (วันประชุมยังเป็นของเขาครบ):`);
    for (const x of stat.droppedLabels) console.log(`   ${x.date}  ← "${x.label}" (ระบบเราอ่านได้ ${x.reads})`);
  }
  if (stat.authorsUnmatched.size) console.log(`ผู้เขียนความเห็นที่ไม่มีบัญชีในระบบเรา: ${[...stat.authorsUnmatched].join(', ')}`);

  console.log('\nจำนวนต่อกลุ่ม (แถบข้างแสดง own+tagged สำหรับโครงการ, own สำหรับกล่อง):');
  for (const c of counts) {
    console.log(`  ${String(c.sort_order).padStart(3)} ${(c.code || '—').padEnd(20)} ${String(c.own + c.tagged).padStart(3)}  (ในกลุ่ม ${c.own} + จัดเก็บเข้า ${c.tagged})  ${c.name}`);
  }
  const allTotal = counts.filter((c) => !c.is_inbox).reduce((a, c) => a + c.own, 0)
    + (await client.query(
      `select count(distinct t.meeting_id)::int as n from mtg_meeting_tags t
         join mtg_groups home on home.id = (select group_id from mtg_meetings where id = t.meeting_id)
         join mtg_groups dest on dest.id = t.group_id
        where home.is_inbox and not dest.is_inbox`)).rows[0].n;
  console.log(`\n"ทุกการประชุม" = ${allTotal}`);

  // เลขบนหน้าจอจริงของลูกค้าวันที่ดึงข้อมูล — ต่างแม้หนึ่งกลุ่มก็ถือว่านำเข้าผิด
  const EXPECT = { FIN: 9, BT12: 18, BV: 19, PN34: 4, ERP: 24, LPP: 1, 3: 5, PROJ: 2 };
  let mismatch = 0;
  for (const [code, want] of Object.entries(EXPECT)) {
    const c = counts.find((x) => x.code === code);
    const got = c ? c.own + c.tagged : 0;
    if (got !== want) { mismatch += 1; console.log(`  ✗ ${code}: ได้ ${got} ควรเป็น ${want}`); }
  }
  if (allTotal !== 82) { mismatch += 1; console.log(`  ✗ ทุกการประชุม: ได้ ${allTotal} ควรเป็น 82`); }
  console.log(mismatch ? `\n✗ ตัวเลขไม่ตรงกับหน้าจอของลูกค้า ${mismatch} จุด` : '\n✓ ตัวเลขทุกกลุ่มตรงกับหน้าจอจริงของลูกค้า');

  if (DRY) {
    await client.query('rollback');
    console.log('\n(ทดลองเท่านั้น — ย้อนคืนทั้งหมด ไม่มีอะไรถูกเขียน)');
  } else if (mismatch) {
    await client.query('rollback');
    console.error('\n✗ ย้อนคืนทั้งหมดเพราะตัวเลขไม่ตรง — แก้ต้นทางหรือการจับคู่กลุ่มก่อน');
    process.exitCode = 1;
  } else {
    await client.query('commit');
    console.log('\n✓ บันทึกแล้ว');
  }
} catch (e) {
  await client.query('rollback').catch(() => {});
  console.error('\n✗ ล้มเหลว ย้อนคืนทั้งหมด:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
