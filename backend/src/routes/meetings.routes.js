import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query, queryOne } from '../config/db.js';
import { putObject, getObjectBuffer, deleteObject } from '../config/storage.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { hasPermission } from '../config/permissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { sanitizeHtml, htmlToText } from '../utils/sanitizeHtml.js';

// =============================================================================
// รายงานการประชุม — minutes kept per group, with every version behind them.
//
// The body is HTML the author wrote in the browser and everyone else reads, so
// it is sanitised on the way IN, once, rather than trusted on the way out in
// however many places end up rendering it.
// =============================================================================
const router = Router();
router.use(requireAuth);

const canView = requirePermission('meetings', 'view');
const canEdit = requirePermission('meetings', 'edit');
const canManage = requirePermission('meetings', 'manage');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxUploadBytes } });

// A path id that is not a uuid must read as "no such thing", not as a database
// error — Postgres raises on a malformed uuid and the request would 500. The
// same slip cost us a 500 in E-Memo once already.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
for (const p of ['id', 'attId', 'commentId']) {
  router.param(p, (req, res, next, v) => {
    if (!UUID.test(String(v))) return next(new ApiError(404, 'ไม่พบรายการที่ระบุ'));
    next();
  });
}

/** Multipart filenames arrive UTF-8 but are decoded latin1, which turns Thai
 *  into mojibake. Same fix as E-Memo's uploads. */
function decodeFilename(name) {
  if (!name) return name;
  try {
    const fixed = Buffer.from(name, 'latin1').toString('utf8');
    return fixed.includes('�') ? name : fixed;
  } catch { return name; }
}
/** Storage rejects non-ASCII keys, so the key is a slug and the real name is
 *  kept in the row. */
const slug = (name) => (String(name).replace(/[^\w.\-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file');

// ── วันที่ที่คนพิมพ์เอง ──────────────────────────────────────────────────────
// ระบบจริงของลูกค้าไม่มีช่อง type="date" เลย ช่องวันที่เป็นข้อความอิสระ และ
// เซิร์ฟเวอร์แปลงให้ (parseDateLabel_ ใน Code.js) เพราะคนกรอกเขียน "21/05/2569"
// บ้าง "21 พ.ค. 69" บ้าง "21 May 2569" บ้าง — ถ้าบังคับรูปแบบเดียวคนก็เลี่ยงไป
// พิมพ์ลงชื่อเรื่องแทน แล้ววันที่ก็หายไปจากที่ที่เรียงลำดับได้
const THAI_MONTHS = {
  'ม.ค': 1, 'มกรา': 1, 'มกราคม': 1,
  'ก.พ': 2, 'กุมภา': 2, 'กุมภาพันธ์': 2,
  'มี.ค': 3, 'มีนา': 3, 'มีนาคม': 3,
  'เม.ย': 4, 'เมษา': 4, 'เมษายน': 4,
  'พ.ค': 5, 'พฤษภา': 5, 'พฤษภาคม': 5,
  'มิ.ย': 6, 'มิถุนา': 6, 'มิถุนายน': 6,
  'ก.ค': 7, 'กรกฎา': 7, 'กรกฎาคม': 7,
  'ส.ค': 8, 'สิงหา': 8, 'สิงหาคม': 8,
  'ก.ย': 9, 'กันยา': 9, 'กันยายน': 9,
  'ต.ค': 10, 'ตุลา': 10, 'ตุลาคม': 10,
  'พ.ย': 11, 'พฤศจิกา': 11, 'พฤศจิกายน': 11,
  'ธ.ค': 12, 'ธันวา': 12, 'ธันวาคม': 12,
};
const EN_MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** ปีที่กรอกอาจเป็น 69 / 2569 / 2026 — ทำให้เป็นคริสต์ศักราชเสมอ */
function normYear(y) {
  let n = parseInt(y, 10);
  if (Number.isNaN(n)) return NaN;
  if (n < 100) n += 2500;        // "69" หมายถึง 2569 ไม่ใช่ ค.ศ. 1969
  if (n > 2400) n -= 543;
  return n;
}
const p2 = (n) => String(n).padStart(2, '0');

/**
 * ข้อความวันที่อิสระ → 'yyyy-mm-dd' (หรือ '' ถ้าอ่านไม่ออก)
 *
 * เรียงลำดับการเดาตาม parseDateLabel_ ของเขาเป๊ะ ๆ รวมทั้งเหตุผล: ตัดโทเค็นเวลา
 * ออกก่อน ("10.00น" ไม่ใช่วันที่) แล้วลอง ISO ที่ขึ้นต้นด้วยปีสี่หลักก่อน
 * dd/mm/yyyy เพื่อไม่ให้ 2569-12-03 ถูกอ่านเป็นวันที่ 2569
 */
export function parseDateLabel(label) {
  if (!label) return '';
  const s = String(label).replace(/\d{1,2}\s*[:.]\s*\d{2}\s*(?:AM|PM|am|pm|น\.?)?/g, ' ');

  const iso = s.match(/(\d{4})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})/);
  if (iso) return ok(normYear(iso[1]), +iso[2], +iso[3]);

  // วัน-เดือน-ปี ตามลำดับที่คนไทยเขียน ไม่ใช่ ISO ที่เอาปีขึ้นก่อน
  const dmy = s.match(/(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{2,4})/);
  if (dmy) return ok(normYear(dmy[3]), +dmy[2], +dmy[1]);

  const en1 = s.match(/(\d{1,2})\s*([A-Za-z]{3,9})\.?\s*,?\s*(\d{2,4})/);
  if (en1 && EN_MONTHS[en1[2].slice(0, 3).toLowerCase()]) {
    return ok(normYear(en1[3]), EN_MONTHS[en1[2].slice(0, 3).toLowerCase()], +en1[1]);
  }
  const en2 = s.match(/([A-Za-z]{3,9})\s+(\d{1,2})\s*,?\s*(\d{2,4})/);
  if (en2 && EN_MONTHS[en2[1].slice(0, 3).toLowerCase()]) {
    return ok(normYear(en2[3]), EN_MONTHS[en2[1].slice(0, 3).toLowerCase()], +en2[2]);
  }
  // เดือนไทย — ต้องมีอักษรไทยจริง ไม่ใช่แค่จุดลอย ๆ
  const th = s.match(/(\d{1,2})\s*([ก-๙]+\.?[ก-๙]*\.?)\s*(\d{2,4})/);
  if (th) {
    const key = th[2].replace(/\.+$/, '').trim();
    for (const k of Object.keys(THAI_MONTHS)) {
      if (key && (key === k || key.startsWith(k) || k.startsWith(key))) {
        return ok(normYear(th[3]), THAI_MONTHS[k], +th[1]);
      }
    }
  }
  return '';

  function ok(y, mo, d) {
    if (!y || Number.isNaN(y) || !(mo >= 1 && mo <= 12) || !(d >= 1 && d <= 31)) return '';
    return `${y}-${p2(mo)}-${p2(d)}`;
  }
}

/**
 * วันประชุมที่ส่งออกไป ต้องเป็น 'yyyy-mm-dd' เท่านั้น
 *
 * meeting_date เป็นชนิด date ซึ่งไม่มีเขตเวลา แต่ไดรเวอร์ pg คืนมาเป็น Date ของ
 * จาวาสคริปต์ที่เที่ยงคืนตามเวลาเครื่อง พอ JSON.stringify มันก็กลายเป็น UTC —
 * ที่กรุงเทพ (UTC+7) วันที่ 21 จึงเดินทางออกไปเป็น "2026-05-20T17:00:00Z" และ
 * ทุกที่ที่ตัดสิบตัวแรกมาใช้ก็ได้วันก่อนหน้าหนึ่งวัน ข้อผิดพลาดชนิดเดียวกับที่
 * ทำให้ "วันนี้" ในโมดูลอื่นเคยเป็นเมื่อวานก่อนเจ็ดโมงเช้า
 *
 * และการเทียบว่าวันที่เปลี่ยนไหมใน PATCH ก็เคยใช้ String(Date).slice(0,10) ซึ่ง
 * ได้ "Thu May 2" — เทียบกับ "2026-05-21" ไม่ตรงตลอด จึงเก็บเวอร์ชันเปล่าเพิ่ม
 * ทุกครั้งที่กดบันทึกโดยไม่ได้แก้วันที่เลย
 */
function isoDate(v) {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  if (v instanceof Date) return `${v.getFullYear()}-${p2(v.getMonth() + 1)}-${p2(v.getDate())}`;
  return String(v).slice(0, 10);
}

/** ผู้ใช้พิมพ์ 'yyyy-mm-dd' มาตรง ๆ ไม่ต้องเก็บเป็น date_label — ฟอร์มจะได้
 *  แสดงวันที่แบบไทยสวย ๆ กลับมา ไม่ใช่คืนตัวเลข ISO ที่เครื่องเป็นคนเขียน */
const isPlainIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim());

/** ใส่แถวประวัติการทำงานหนึ่งแถว ล้มเหลวก็ไม่ควรทำให้การกระทำหลักพัง */
async function logAudit(meetingId, action, actorId, details = {}) {
  try {
    await query('insert into mtg_audit (meeting_id, action, actor_id, details) values ($1,$2,$3,$4::jsonb)',
      [meetingId, action, actorId, JSON.stringify(details)]);
  } catch { /* ประวัติขาดหนึ่งแถว ดีกว่าปักหมุดไม่สำเร็จ */ }
}

/** Groups this user may see. Admin sees all; otherwise a group tied to a project
 *  follows the project visibility the client already configures per user. */
async function visibleGroupIds(profile) {
  // ผู้แก้ไขและผู้ดูแลเห็นทุกกลุ่ม — ตอบเป็น null (ไม่จำกัด) ถูกกว่าไล่รายชื่อ
  if (profile.role === 'admin' || hasPermission(profile, 'meetings', 'edit')) return null;

  // ── สิทธิ์สามระดับ (ข้อกำหนดฟังก์ชัน §3.9) ──────────────────────────────
  // กลุ่ม public ผู้ใช้ที่ลงชื่อเข้าใช้แล้วอ่านได้ · กลุ่ม locked อ่านได้เฉพาะ
  // ผู้ที่ถูกระบุอีเมลไว้ กลุ่มที่อ่านไม่ได้ต้อง "หายไปจากรายการ" ไม่ใช่ขึ้นชื่อ
  // แล้วกดไม่ได้ เพราะการโชว์ชื่อกลุ่มที่เปิดไม่ได้ก็คือการรั่วอยู่แล้ว
  const readable = (await query(
    `select g.id from mtg_groups g
      where g.visibility = 'public'
         or exists (select 1 from mtg_group_guests gu
                     where gu.group_id = g.id and lower(gu.email) = lower($1))`,
    [profile.email || ''])).rows.map((r) => r.id);

  // ขอบเขตโครงการรายบุคคลที่ผู้ดูแลตั้งไว้ ยังคงตัดทอนต่อจากนั้นอีกชั้น
  const scope = profile.visibility?.projectIds || profile.visible_project_ids || null;
  if (!scope || !scope.length) return readable;
  const inScope = new Set((await query(
    'select id from mtg_groups where project_id is null or project_id = any($1)', [scope])).rows.map((r) => r.id));
  return readable.filter((id) => inScope.has(id));
}

/** อ่านกลุ่มนี้ได้ไหม — ใช้กับเส้นทางที่รับ groupId มาตรง ๆ */
async function canReadGroup(profile, groupId) {
  const ids = await visibleGroupIds(profile);
  return ids === null || ids.includes(groupId);
}

const inGroups = (ids, col = 'm.group_id') => (ids === null ? '' : ` and ${col} = any($GRP)`);

const LIST_SELECT = `
  select m.id, m.group_id, m.title, m.meeting_date, m.time_label, m.excerpt,
         m.attendees, m.pinned, m.visible, m.source, m.recording_url,
         m.kind, m.date_label, m.meeting_key,
         m.created_at, m.updated_at,
         g.name as group_name, g.code as group_code, g.color as group_color, g.is_inbox,
         (select coalesce(json_agg(json_build_object('id', tg.id, 'name', tg.name, 'color', tg.color)
                                   order by tg.sort_order), '[]'::json)
            from mtg_meeting_tags t join mtg_groups tg on tg.id = t.group_id
           where t.meeting_id = m.id) as tags,
         cp.full_name as created_by_name,
         (select count(*)::int from mtg_attachments a where a.meeting_id = m.id and a.kind = 'file') as attachment_count,
         (select count(*)::int from mtg_comments c where c.meeting_id = m.id) as comment_count
    from mtg_meetings m
    join mtg_groups g on g.id = m.group_id
    left join profiles cp on cp.id = m.created_by`;

// ── read ────────────────────────────────────────────────────────────────────

/** GET /api/meetings/bootstrap — groups + counts, enough to draw the shell. */
router.get('/bootstrap', canView, asyncHandler(async (req, res) => {
  const ids = await visibleGroupIds(req.profile);
  const groups = await query(
    `select g.id, g.code, g.name, g.name_en, g.cadence, g.color, g.project_id, g.is_active, g.is_inbox,
            (select count(*)::int from mtg_meetings m where m.group_id = g.id) as count,
            (select count(*)::int from mtg_meeting_tags t where t.group_id = g.id) as tagged_count
       from mtg_groups g
      where g.is_active = true${ids === null ? '' : ' and g.id = any($1)'}
      order by g.sort_order, g.name`,
    ids === null ? [] : [ids]
  );
  // Ask the permission resolver, not the raw override map: most people's rights
  // come from their ROLE and were never written as an override, so reading the
  // map directly hid the buttons from everyone who had not been edited by hand.
  res.json({
    data: {
      groups: groups.rows,
      canEdit: hasPermission(req.profile, 'meetings', 'edit'),
      canManage: hasPermission(req.profile, 'meetings', 'manage'),
      // the headline total counts each meeting once, wherever it is filed
      total: groups.rows.reduce((a, g) => a + g.count, 0),
      inboxTotal: groups.rows.filter((g) => g.is_inbox).reduce((a, g) => a + g.count, 0),
      // จำนวนที่แถว "ทุกการประชุม" ต้องแสดง นับด้วยกฎเดียวกับรายการเป๊ะ ๆ —
      // เลขข้าง ๆ ที่ไม่เท่ากับจำนวนแถวที่โผล่มาอ่านเป็นข้อมูลหาย
      allTotal: groups.rows.filter((g) => !g.is_inbox).reduce((a, g) => a + g.count, 0)
        + (await queryOne(
          `select count(distinct t.meeting_id)::int as n
             from mtg_meeting_tags t
             join mtg_groups home on home.id = (select group_id from mtg_meetings where id = t.meeting_id)
             join mtg_groups dest on dest.id = t.group_id
            where home.is_inbox and not dest.is_inbox`)).n,
    },
  });
}));

/** GET /api/meetings — the list, filtered and searched.
 *  Search covers the body too: people look for a decision, not a title. */
router.get('/', canView, asyncHandler(async (req, res) => {
  const ids = await visibleGroupIds(req.profile);
  const params = [];
  const where = [];
  const groupId = String(req.query.groupId || '').trim();
  if (groupId) {
    if (!/^[0-9a-f-]{36}$/i.test(groupId)) throw new ApiError(400, 'รหัสกลุ่มไม่ถูกต้อง');
    // A recording filed into this group belongs in its list too, even though it
    // still lives in the inbox — that is the point of filing it.
    params.push(groupId);
    where.push(`(m.group_id = $${params.length}
                 or exists (select 1 from mtg_meeting_tags t
                             where t.meeting_id = m.id and t.group_id = $${params.length}))`);
  } else {
    // "ทุกการประชุม" ไม่รวมบันทึกเสียงที่ยังไม่ได้จัดเก็บ — กล่องรอจัดเก็บเป็นคิว
    // ที่ต้องไล่ฟัง ไม่ใช่ที่ที่บันทึกการประชุมอยู่ (isInboxProject_ ของเขาตัด
    // ออกจาก ALL เหมือนกัน) แต่เราไม่ตัดแถวที่ "จัดเก็บแล้ว" ทิ้งไปด้วย —
    // การจัดเก็บคือการเพิ่มที่ให้หาเจอ ตัดออกจากรายการรวมก็เท่ากับทำให้หาไม่เจอ
    where.push(`(not g.is_inbox
                 or exists (select 1 from mtg_meeting_tags t2
                              join mtg_groups g2 on g2.id = t2.group_id
                             where t2.meeting_id = m.id and not g2.is_inbox))`);
  }
  if (ids !== null) { params.push(ids); where.push(`m.group_id = any($${params.length})`); }
  // A hidden meeting is a draft: its author still needs to find it.
  if (req.profile.role !== 'admin') {
    params.push(req.profile.id);
    where.push(`(m.visible = true or m.created_by = $${params.length})`);
  }
  const q = String(req.query.q || '').trim();
  if (q) {
    params.push(`%${q}%`);
    const p = `$${params.length}`;
    where.push(`(m.title ilike ${p} or m.excerpt ilike ${p} or m.content ilike ${p}
                 or m.attendees::text ilike ${p})`);
  }
  // แถว overview ไม่มีวันประชุม มันคือหน้าภาพรวมของโครงการ จึงต้องอยู่ท้าย
  // รายการเสมอ ไม่ใช่ลอยขึ้นมาปนกับการประชุมที่ไม่มีวันที่ — เรียงแบบเดียวกับ
  // visibleMeetings ของเขา: ปักหมุด → ไม่ใช่ overview → วันที่ใหม่สุด
  const sql = `${LIST_SELECT}${where.length ? ` where ${where.join(' and ')}` : ''}
     order by m.pinned desc, (m.kind = 'overview'),
              m.meeting_date desc nulls last, m.created_at desc
     limit 300`;
  const { rows } = await query(sql, params);
  res.json({ data: rows.map((r) => ({ ...r, meeting_date: isoDate(r.meeting_date) })) });
}));

/**
 * GET /api/meetings/access — ภาพรวมสิทธิ์ทุกกลุ่มในหน้าเดียว
 *
 * เตือนกลุ่มที่ล็อกไว้แต่ไม่มีใครถูกระบุชื่อเลย — ถูกต้องตามกฎ (แปลว่าเฉพาะผู้ดูแล
 * และผู้แก้ไขเข้าถึงได้) แต่มักเกิดโดยไม่ตั้งใจ และมองจากข้างนอกวินิจฉัยยาก
 */
router.get('/access', canManage, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `select g.id, g.name, g.code, g.color, g.visibility, g.is_inbox,
            coalesce(array_agg(gu.email order by gu.email) filter (where gu.email is not null), '{}') as emails
       from mtg_groups g left join mtg_group_guests gu on gu.group_id = g.id
      where g.is_active = true
      group by g.id order by g.sort_order, g.name`);
  res.json({ data: rows.map((r) => ({ ...r, bare: r.visibility === 'locked' && r.emails.length === 0 })) });
}));

/** GET /api/meetings/:id — the full record: body, attachments, comments. */
router.get('/:id', canView, asyncHandler(async (req, res) => {
  const m = await queryOne(
    `select m.*, g.name as group_name, g.code as group_code, g.color as group_color, g.is_inbox,
            cp.full_name as created_by_name, up.full_name as updated_by_name
       from mtg_meetings m
       join mtg_groups g on g.id = m.group_id
       left join profiles cp on cp.id = m.created_by
       left join profiles up on up.id = m.updated_by
      where m.id = $1`, [req.params.id]);
  if (!m) throw new ApiError(404, 'ไม่พบรายงานการประชุมนี้');

  const ids = await visibleGroupIds(req.profile);
  if (ids !== null && !ids.includes(m.group_id)) throw new ApiError(403, 'ไม่มีสิทธิ์เปิดรายงานฉบับนี้');
  if (!m.visible && req.profile.role !== 'admin' && m.created_by !== req.profile.id) {
    throw new ApiError(403, 'รายงานฉบับนี้ยังไม่เผยแพร่');
  }

  const [atts, comments, versions, tags, audit] = await Promise.all([
    // external_url ต้องมาด้วย: ไฟล์แนบที่นำเข้ามาจากระบบเดิมอยู่บน Google Drive
    // ไม่ใช่ไบต์ที่เราถือไว้ หน้าจอต้องรู้ว่าจะเปิดลิงก์ ไม่ใช่ขอไฟล์จากเรา
    query(`select id, kind, file_name, content_type, size_bytes, external_url, created_at
             from mtg_attachments where meeting_id = $1 and kind = 'file' order by created_at`, [m.id]),
    query(`select c.id, c.body, c.created_at, c.author_id, p.full_name as author_name
             from mtg_comments c left join profiles p on p.id = c.author_id
            where c.meeting_id = $1 order by c.created_at`, [m.id]),
    query(`select v.seq, v.title, v.meeting_date, v.time_label, v.saved_at, p.full_name as saved_by_name
             from mtg_versions v left join profiles p on p.id = v.saved_by
            where v.meeting_id = $1 order by v.seq desc`, [m.id]),
    query(`select g.id, g.name, g.color from mtg_meeting_tags t
             join mtg_groups g on g.id = t.group_id
            where t.meeting_id = $1 order by g.sort_order`, [m.id]),
    // ประวัติการทำงาน: สิ่งที่เกิดกับเอกสารโดยไม่ได้แก้เนื้อหา ส่งมาพร้อมกันใน
    // คำขอเดียว เพราะแผงนี้เปิดจากหน้าที่โหลดข้อมูลนี้อยู่แล้ว
    query(`select a.id, a.action, a.details, a.created_at, p.full_name as actor_name
             from mtg_audit a left join profiles p on p.id = a.actor_id
            where a.meeting_id = $1 order by a.created_at`, [m.id]),
  ]);
  res.json({ data: { ...m, meeting_date: isoDate(m.meeting_date),
    attachments: atts.rows, comments: comments.rows,
    versions: versions.rows.map((v) => ({ ...v, meeting_date: isoDate(v.meeting_date) })),
    tags: tags.rows, audit: audit.rows } });
}));

/** GET /api/meetings/:id/versions/:seq — one earlier version, as it was.
 *  Title and date come from the snapshot, not the live row: renaming a meeting
 *  must not rewrite what its own history says it used to be called. */
router.get('/:id/versions/:seq', canView, asyncHandler(async (req, res) => {
  const v = await queryOne(
    `select seq, content, title, meeting_date, time_label, saved_at from mtg_versions
      where meeting_id = $1 and seq = $2`, [req.params.id, Number(req.params.seq) || -1]);
  if (!v) throw new ApiError(404, 'ไม่พบเวอร์ชันนี้');
  res.json({ data: { ...v, meeting_date: isoDate(v.meeting_date) } });
}));

// ── write ───────────────────────────────────────────────────────────────────

const meetingSchema = z.object({
  groupId: z.string().uuid(),
  title: z.string().trim().min(1).max(300),
  // ข้อความอิสระ ไม่ใช่ ISO เท่านั้น — "21/05/2569", "21 พ.ค. 69", "21 May 2569"
  // และ "2026-05-21" ที่เคยส่งมาอยู่แล้วต้องรับได้ทั้งหมด (ดู parseDateLabel)
  meetingDate: z.string().trim().max(60).optional().nullable(),
  // ถ้าผู้เรียกอยากกำหนดข้อความวันที่เองแยกจากวันที่จริง ก็ส่งมาได้
  dateLabel: z.string().trim().max(60).optional(),
  kind: z.enum(['meeting', 'overview']).optional(),
  timeLabel: z.string().trim().max(60).optional().default(''),
  content: z.string().max(400000).optional().default(''),
  attendees: z.array(z.string().trim().max(120)).max(100).optional().default([]),
  // no .default() on purpose: the caller not saying anything has to stay
  // distinguishable from the caller saying `true`, or an inbox recording
  // publishes itself before anyone has listened to it
  visible: z.boolean().optional(),
  recordingUrl: z.string().trim().max(600).optional().default(''),
  source: z.enum(['manual', 'doc-import', 'fathom', 'transkriptor']).optional(),
});

/** Only http(s) — a recording link is put in front of a reader to click. */
const safeLink = (v) => (/^https?:\/\//i.test(String(v || '').trim()) ? String(v).trim() : '');

router.post('/', canEdit, asyncHandler(async (req, res) => {
  const p = meetingSchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const g = await queryOne('select id, is_inbox from mtg_groups where id = $1 and is_active = true', [p.data.groupId]);
  if (!g) throw new ApiError(400, 'ไม่พบกลุ่มที่ระบุ');
  const html = sanitizeHtml(p.data.content);
  // A recording arrives before anyone has decided what it is about, so it starts
  // unpublished — visible once it has been listened to and filed.
  const visible = p.data.visible !== undefined ? p.data.visible : !g.is_inbox;
  const raw = String(p.data.meetingDate || '').trim();
  const iso = raw ? parseDateLabel(raw) : '';
  const label = p.data.dateLabel !== undefined ? p.data.dateLabel
    : (raw && !isPlainIso(raw) ? raw : '');
  // คีย์กันนำเข้าซ้ำ ชนได้เมื่อสองคำขอมาถึงในมิลลิวินาทีเดียวกัน — คำนวณใหม่แล้ว
  // ลองอีกครั้ง ไม่ใช่ปล่อย 500 ออกไป (แบบเดียวกับ seq ของ mtg_versions)
  let row = null;
  for (let attempt = 0; ; attempt += 1) {
    const key = `manual-${Date.now()}${attempt ? `-${attempt}` : ''}`;
    try {
      row = await queryOne(
        `insert into mtg_meetings (group_id, title, meeting_date, date_label, kind, time_label,
                                   content, excerpt, attendees, visible, recording_url,
                                   source, meeting_key, created_by, updated_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$14) returning id`,
        [p.data.groupId, p.data.title, iso || null, label, p.data.kind || 'meeting',
         p.data.timeLabel, html, htmlToText(html).slice(0, 200),
         JSON.stringify(p.data.attendees), visible, safeLink(p.data.recordingUrl),
         p.data.source || 'manual', key, req.profile.id]
      );
      break;
    } catch (e) {
      if (e?.code !== '23505' || attempt >= 4) throw e;   // 23505 = กุญแจซ้ำ
    }
  }
  res.status(201).json({ data: { id: row.id } });
}));

/** PATCH /api/meetings/:id — save an edit, keeping what was there before. */
router.patch('/:id', canEdit, asyncHandler(async (req, res) => {
  const p = meetingSchema.partial().safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const cur = await queryOne('select * from mtg_meetings where id = $1', [req.params.id]);
  if (!cur) throw new ApiError(404, 'ไม่พบรายงานการประชุมนี้');

  // ── ย้ายโครงการได้ตอนแก้ไข ────────────────────────────────────────────────
  // ของเขาย้ายได้ (ช่อง Project ในกล่องแก้ไขไม่เคยถูกล็อก) และคนกรอกผิดโครงการ
  // เป็นเรื่องปกติ — เดิมเราล็อกไว้ ทางออกเดียวคือลบแล้วพิมพ์ใหม่ทั้งฉบับ
  let moveTo = null;
  if (p.data.groupId !== undefined && p.data.groupId !== cur.group_id) {
    const g = await queryOne(
      'select id, name, is_inbox from mtg_groups where id = $1 and is_active = true', [p.data.groupId]);
    if (!g) throw new ApiError(400, 'ไม่พบกลุ่มที่ระบุ');
    moveTo = g;
  }

  // วันที่ที่ส่งมาเป็นข้อความอิสระ แปลงก่อนเทียบ ไม่ใช่เทียบข้อความดิบกับ date
  // ในฐานข้อมูล — ไม่อย่างนั้น "21/05/2569" จะนับเป็นการเปลี่ยนแปลงทุกครั้งที่
  // กดบันทึก แล้วก็เก็บเวอร์ชันเปล่าเพิ่มขึ้นทุกครั้งไปเรื่อย ๆ
  const rawDate = p.data.meetingDate === undefined ? undefined : String(p.data.meetingDate || '').trim();
  const nextIso = rawDate === undefined ? undefined : (rawDate ? parseDateLabel(rawDate) : '');
  const nextLabel = p.data.dateLabel !== undefined ? p.data.dateLabel
    : (rawDate === undefined ? undefined : (rawDate && !isPlainIso(rawDate) ? rawDate : ''));

  // Snapshot BEFORE overwriting, and snapshot the title/date as they stand right
  // now — capturing them afterwards would file the new name against the old body.
  //
  // Snapshot on ANY change to the four, not just the body. Versioning only the
  // body reopens the bug it was meant to close: rename today with no snapshot,
  // edit the text tomorrow, and that version pairs yesterday's words with
  // today's name — which is exactly what a reader would be misled by.
  const changed = ['content', 'title', 'meetingDate', 'timeLabel'].some((k) => {
    const given = k === 'meetingDate' ? nextIso : p.data[k];
    if (given === undefined) return false;
    const before = { content: cur.content, title: cur.title,
      meetingDate: isoDate(cur.meeting_date),
      timeLabel: cur.time_label }[k];
    return String(given ?? '') !== String(before ?? '');
  });
  if (changed && cur.content) {
    // (meeting_id, seq) มีดัชนีไม่ซ้ำ ถ้าสองคนแก้รายงานฉบับเดียวกันพร้อมกัน
    // ทั้งคู่อ่าน max ได้เลขเดียวกันแล้วคนหลังชนกุญแจซ้ำ — ชนเมื่อไรก็คำนวณ
    // เลขใหม่แล้วลองอีกครั้ง เก็บประวัติไว้ได้ทั้งสองฉบับ ไม่ใช่ให้คนหลังเห็น 500
    for (let attempt = 0; ; attempt += 1) {
      const seq = await queryOne(
        'select coalesce(max(seq), 0) + 1 as n from mtg_versions where meeting_id = $1', [cur.id]);
      try {
        await query(
          `insert into mtg_versions (meeting_id, seq, content, title, meeting_date, time_label, saved_by)
           values ($1,$2,$3,$4,$5,$6,$7)`,
          [cur.id, seq.n, cur.content, cur.title, cur.meeting_date, cur.time_label, req.profile.id]
        );
        break;
      } catch (e) {
        if (e?.code !== '23505' || attempt >= 4) throw e;   // 23505 = กุญแจซ้ำ
      }
    }
  }

  const html = p.data.content !== undefined ? sanitizeHtml(p.data.content) : null;
  // ล้างวันที่ต้องทำได้จริง coalesce เพียว ๆ ทำให้ค่าว่างกลายเป็น "ไม่เปลี่ยน"
  // คนที่ลบวันที่ผิดออกจึงลบไม่ออกและไม่มีอะไรบอกว่าทำไม
  const dateGiven = rawDate !== undefined || p.data.dateLabel !== undefined;
  const row = await queryOne(
    `update mtg_meetings set
       title = coalesce($2, title),
       meeting_date = case when $11 then $3 else meeting_date end,
       date_label = case when $12 then $13 else date_label end,
       kind = coalesce($14, kind),
       group_id = coalesce($15, group_id),
       time_label = coalesce($4, time_label),
       content = coalesce($5, content),
       excerpt = coalesce($6, excerpt),
       attendees = coalesce($7::jsonb, attendees),
       visible = coalesce($8, visible),
       recording_url = coalesce($10, recording_url),
       updated_by = $9, updated_at = now()
     where id = $1 returning id, title, group_id, updated_at`,
    [cur.id, p.data.title ?? null, nextIso || null, p.data.timeLabel ?? null,
     html, html === null ? null : htmlToText(html).slice(0, 200),
     p.data.attendees ? JSON.stringify(p.data.attendees) : null,
     p.data.visible ?? null, req.profile.id,
     p.data.recordingUrl === undefined ? null : safeLink(p.data.recordingUrl),
     rawDate !== undefined, nextLabel !== undefined, nextLabel ?? '',
     p.data.kind ?? null, moveTo ? moveTo.id : null]
  );

  if (moveTo) {
    await logAudit(cur.id, 'move', req.profile.id, { to: moveTo.name });
    // ย้ายเข้าโครงการที่ปักป้ายไว้แล้ว ป้ายนั้นก็ซ้ำซ้อน — ของเราห้ามป้ายชี้กลุ่ม
    // ของตัวเองอยู่แล้ว (POST /tags คืน 409) ถ้าไม่เก็บก็จะเหลือแถวที่สร้างใหม่ไม่ได้
    await query('delete from mtg_meeting_tags where meeting_id = $1 and group_id = $2',
      [cur.id, moveTo.id]);
  }
  if (p.data.visible !== undefined && p.data.visible !== cur.visible) {
    await logAudit(cur.id, p.data.visible ? 'publish' : 'unpublish', req.profile.id);
  }
  res.json({ data: row });
}));

router.post('/:id/pin', canEdit, asyncHandler(async (req, res) => {
  const row = await queryOne(
    'update mtg_meetings set pinned = not pinned, updated_at = now() where id = $1 returning pinned',
    [req.params.id]);
  if (!row) throw new ApiError(404, 'ไม่พบรายงานการประชุมนี้');
  await logAudit(req.params.id, row.pinned ? 'pin' : 'unpin', req.profile.id);
  res.json({ data: row });
}));

router.delete('/:id', canEdit, asyncHandler(async (req, res) => {
  const keys = await query('select storage_key from mtg_attachments where meeting_id = $1', [req.params.id]);
  const row = await queryOne('delete from mtg_meetings where id = $1 returning id', [req.params.id]);
  if (!row) throw new ApiError(404, 'ไม่พบรายงานการประชุมนี้');
  // the rows cascade; the stored files do not
  for (const k of keys.rows) await deleteObject(k.storage_key).catch(() => {});
  res.json({ data: { ok: true, removedFiles: keys.rows.length } });
}));

// ── attachments + inline images ─────────────────────────────────────────────

router.post('/:id/attachments', canEdit, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'ไม่พบไฟล์ที่แนบมา');
  const m = await queryOne('select id from mtg_meetings where id = $1', [req.params.id]);
  if (!m) throw new ApiError(404, 'ไม่พบรายงานการประชุมนี้');
  const kind = req.body?.kind === 'inline' ? 'inline' : 'file';
  if (kind === 'inline' && !String(req.file.mimetype || '').startsWith('image/')) {
    throw new ApiError(400, 'รูปในเนื้อหาต้องเป็นไฟล์ภาพ');
  }
  // An SVG is a document that can carry script, so it is never accepted as an
  // image here — the same rule the signature upload already applies.
  if (/svg/i.test(req.file.mimetype || '')) throw new ApiError(400, 'ไม่รองรับไฟล์ SVG');

  const fileName = decodeFilename(req.file.originalname);
  const key = `meetings/${m.id}/${Date.now()}-${slug(fileName)}`;
  await putObject(key, req.file.buffer, req.file.mimetype || 'application/octet-stream');
  const row = await queryOne(
    `insert into mtg_attachments (meeting_id, kind, file_name, content_type, size_bytes, storage_key, uploaded_by)
     values ($1,$2,$3,$4,$5,$6,$7) returning id, kind, file_name, content_type, size_bytes, created_at`,
    [m.id, kind, fileName, req.file.mimetype || '', req.file.size || 0, key, req.profile.id]
  );
  if (kind === 'file') await logAudit(m.id, 'attach', req.profile.id, { file: fileName });
  res.status(201).json({ data: row });
}));

router.get('/:id/attachments/:attId', canView, asyncHandler(async (req, res) => {
  const a = await queryOne(
    'select * from mtg_attachments where id = $1 and meeting_id = $2', [req.params.attId, req.params.id]);
  if (!a) throw new ApiError(404, 'ไม่พบไฟล์นี้');
  // ไฟล์แนบที่อยู่ภายนอก (ลิงก์ Drive ที่นำเข้ามา) ไม่มีไบต์ให้ส่ง — ส่งทางไป
  // ที่ไฟล์กลับไปแทน ดีกว่าไปขอ storage แล้วได้ 404 ที่อธิบายอะไรไม่ได้เลย
  if (a.external_url) return res.redirect(302, a.external_url);
  const buf = await getObjectBuffer(a.storage_key);
  res.setHeader('Content-Type', a.content_type || 'application/octet-stream');
  res.setHeader('Content-Disposition',
    `${a.kind === 'inline' ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(a.file_name)}`);
  res.send(buf);
}));

router.delete('/:id/attachments/:attId', canEdit, asyncHandler(async (req, res) => {
  const a = await queryOne(
    `delete from mtg_attachments where id = $1 and meeting_id = $2
      returning storage_key, kind, file_name`,
    [req.params.attId, req.params.id]);
  if (!a) throw new ApiError(404, 'ไม่พบไฟล์นี้');
  await deleteObject(a.storage_key).catch(() => {});
  if (a.kind === 'file') await logAudit(req.params.id, 'detach', req.profile.id, { file: a.file_name });
  res.json({ data: { ok: true } });
}));

// ── comments ────────────────────────────────────────────────────────────────

router.post('/:id/comments', canView, asyncHandler(async (req, res) => {
  const p = z.object({ body: z.string().trim().min(1).max(4000) }).safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'กรุณาพิมพ์ความเห็น');
  const m = await queryOne('select id from mtg_meetings where id = $1', [req.params.id]);
  if (!m) throw new ApiError(404, 'ไม่พบรายงานการประชุมนี้');
  const row = await queryOne(
    `insert into mtg_comments (meeting_id, author_id, body) values ($1,$2,$3)
     returning id, body, created_at`, [m.id, req.profile.id, p.data.body]);
  res.status(201).json({ data: { ...row, author_name: req.profile.full_name } });
}));

router.delete('/:id/comments/:commentId', canView, asyncHandler(async (req, res) => {
  const c = await queryOne(
    'select author_id from mtg_comments where id = $1 and meeting_id = $2',
    [req.params.commentId, req.params.id]);
  if (!c) throw new ApiError(404, 'ไม่พบความเห็นนี้');
  if (c.author_id !== req.profile.id && req.profile.role !== 'admin') {
    throw new ApiError(403, 'ลบได้เฉพาะความเห็นของตัวเอง');
  }
  await query('delete from mtg_comments where id = $1', [req.params.commentId]);
  res.json({ data: { ok: true } });
}));

// ── การจัดเก็บเข้ากลุ่ม ─────────────────────────────────────────────────────

/** POST /api/meetings/:id/tags — file this recording against a group.
 *
 *  Adds, never moves. The recording keeps living in the inbox so the archive of
 *  everything recorded stays whole, and a recording that concerns two projects
 *  can sit under both instead of one stealing it from the other.
 */
router.post('/:id/tags', canEdit, asyncHandler(async (req, res) => {
  const p = z.object({ groupId: z.string().uuid() }).safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const m = await queryOne('select id, group_id from mtg_meetings where id = $1', [req.params.id]);
  if (!m) throw new ApiError(404, 'ไม่พบรายงานการประชุมนี้');
  const g = await queryOne(
    'select id, name, is_inbox from mtg_groups where id = $1 and is_active = true', [p.data.groupId]);
  if (!g) throw new ApiError(400, 'ไม่พบกลุ่มที่ระบุ');
  if (g.is_inbox) throw new ApiError(400, 'จัดเก็บเข้ากล่องรอจัดเก็บไม่ได้ — เลือกกลุ่มปลายทาง');
  if (g.id === m.group_id) throw new ApiError(409, 'รายงานนี้อยู่ในกลุ่มนี้อยู่แล้ว');

  await query(
    `insert into mtg_meeting_tags (meeting_id, group_id, tagged_by) values ($1,$2,$3)
     on conflict do nothing`, [m.id, g.id, req.profile.id]);
  await logAudit(m.id, 'tag', req.profile.id, { group: g.name });
  const tags = await query(
    `select g.id, g.name, g.color from mtg_meeting_tags t join mtg_groups g on g.id = t.group_id
      where t.meeting_id = $1 order by g.sort_order`, [m.id]);
  res.status(201).json({ data: tags.rows });
}));

/** DELETE /api/meetings/:id/tags/:groupId — take it out of one group only,
 *  leaving every other place it was filed alone. */
router.delete('/:id/tags/:groupId', canEdit, asyncHandler(async (req, res) => {
  if (!UUID.test(req.params.groupId)) throw new ApiError(404, 'ไม่พบกลุ่มที่ระบุ');
  const row = await queryOne(
    `delete from mtg_meeting_tags where meeting_id = $1 and group_id = $2
      returning meeting_id, (select name from mtg_groups where id = $2) as group_name`,
    [req.params.id, req.params.groupId]);
  if (!row) throw new ApiError(404, 'รายงานนี้ไม่ได้ถูกจัดเก็บไว้ในกลุ่มนั้น');
  await logAudit(req.params.id, 'untag', req.profile.id, { group: row.group_name || '' });
  const tags = await query(
    `select g.id, g.name, g.color from mtg_meeting_tags t join mtg_groups g on g.id = t.group_id
      where t.meeting_id = $1 order by g.sort_order`, [req.params.id]);
  res.json({ data: tags.rows });
}));

// ── groups ──────────────────────────────────────────────────────────────────

const groupSchema = z.object({
  name: z.string().trim().min(1).max(200),
  name_en: z.string().trim().max(200).optional().default(''),
  code: z.string().trim().max(32).optional().default(''),
  cadence: z.string().trim().max(60).optional().default(''),
  color: z.string().trim().max(24).optional().default('#64748b'),
  is_active: z.boolean().optional(),
  visibility: z.enum(['public', 'locked']).optional(),
});

router.post('/groups/new', canManage, asyncHandler(async (req, res) => {
  const p = groupSchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const next = await queryOne('select coalesce(max(sort_order), 0) + 1 as n from mtg_groups');
  const row = await queryOne(
    `insert into mtg_groups (code, name, name_en, cadence, color, sort_order)
     values (nullif($1,''),$2,$3,$4,$5,$6) returning *`,
    [p.data.code, p.data.name, p.data.name_en, p.data.cadence, p.data.color, next.n]);
  res.status(201).json({ data: row });
}));

router.patch('/groups/:id', canManage, asyncHandler(async (req, res) => {
  const p = groupSchema.partial().safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const row = await queryOne(
    `update mtg_groups set name = coalesce($2, name), name_en = coalesce($3, name_en),
       cadence = coalesce($4, cadence), color = coalesce($5, color),
       is_active = coalesce($6, is_active), visibility = coalesce($7, visibility)
     where id = $1 returning *`,
    [req.params.id, p.data.name ?? null, p.data.name_en ?? null, p.data.cadence ?? null,
     p.data.color ?? null, p.data.is_active ?? null, p.data.visibility ?? null]);
  if (!row) throw new ApiError(404, 'ไม่พบกลุ่มนี้');
  res.json({ data: row });
}));

router.delete('/groups/:id', canManage, asyncHandler(async (req, res) => {
  const n = await queryOne('select count(*)::int as n from mtg_meetings where group_id = $1', [req.params.id]);
  if (n.n > 0) throw new ApiError(409, `กลุ่มนี้ยังมีรายงาน ${n.n} ฉบับ — ย้ายหรือลบรายงานออกก่อน`);
  const row = await queryOne('delete from mtg_groups where id = $1 returning id', [req.params.id]);
  if (!row) throw new ApiError(404, 'ไม่พบกลุ่มนี้');
  res.json({ data: { ok: true } });
}));

// ── ผู้ที่ถูกระบุชื่อให้อ่านกลุ่มที่ล็อกไว้ (ข้อกำหนดฟังก์ชัน §3.9) ──────────

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** GET /api/meetings/groups/:id/guests — รายชื่อผู้ที่อ่านกลุ่มนี้ได้ */
router.get('/groups/:id/guests', canManage, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `select gu.email, gu.added_at, p.full_name as added_by_name
       from mtg_group_guests gu left join profiles p on p.id = gu.added_by
      where gu.group_id = $1 order by gu.email`, [req.params.id]);
  res.json({ data: rows });
}));

/**
 * POST /api/meetings/groups/:id/guests — เพิ่มทีละคนหรือวางมาทีเดียวหลายอีเมล
 *
 * ถ้ามีอีเมลผิดรูปแบบแม้แค่ตัวเดียว ปฏิเสธทั้งชุดพร้อมบอกว่าตัวไหนผิด — บันทึก
 * ครึ่ง ๆ กลาง ๆ แล้วปล่อยให้ผู้ดูแลไปไล่หาเองว่าใครเข้าไม่ได้ แย่กว่าไม่บันทึกเลย
 */
router.post('/groups/:id/guests', canManage, asyncHandler(async (req, res) => {
  const raw = String(req.body?.emails ?? req.body?.email ?? '');
  const list = [...new Set(raw.split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean))];
  if (!list.length) throw new ApiError(400, 'ยังไม่ได้ระบุอีเมล');
  const bad = list.filter((e) => !EMAIL.test(e));
  if (bad.length) throw new ApiError(400, `อีเมลไม่ถูกต้อง: ${bad.join(', ')}`, { emails: bad });

  const g = await queryOne('select id from mtg_groups where id = $1', [req.params.id]);
  if (!g) throw new ApiError(404, 'ไม่พบกลุ่มนี้');
  for (const email of list) {
    await query(
      `insert into mtg_group_guests (group_id, email, added_by) values ($1,$2,$3)
       on conflict (group_id, email) do nothing`,
      [req.params.id, email, req.profile.id]);
  }
  res.status(201).json({ data: { added: list.length } });
}));

/** DELETE /api/meetings/groups/:id/guests/:email */
router.delete('/groups/:id/guests/:email', canManage, asyncHandler(async (req, res) => {
  await query('delete from mtg_group_guests where group_id = $1 and lower(email) = lower($2)',
    [req.params.id, req.params.email]);
  res.json({ data: { ok: true } });
}));

export default router;
