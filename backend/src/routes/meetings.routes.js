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

/** Groups this user may see. Admin sees all; otherwise a group tied to a project
 *  follows the project visibility the client already configures per user. */
async function visibleGroupIds(profile) {
  if (profile.role === 'admin') return null;
  const scope = profile.visibility?.projectIds || profile.visible_project_ids || null;
  if (!scope || !scope.length) return null; // no restriction configured = sees all
  const { rows } = await query(
    'select id from mtg_groups where project_id is null or project_id = any($1)', [scope]);
  return rows.map((r) => r.id);
}
const inGroups = (ids, col = 'm.group_id') => (ids === null ? '' : ` and ${col} = any($GRP)`);

const LIST_SELECT = `
  select m.id, m.group_id, m.title, m.meeting_date, m.time_label, m.excerpt,
         m.attendees, m.pinned, m.visible, m.source, m.created_at, m.updated_at,
         g.name as group_name, g.code as group_code, g.color as group_color,
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
    `select g.id, g.code, g.name, g.name_en, g.cadence, g.color, g.project_id, g.is_active,
            (select count(*)::int from mtg_meetings m where m.group_id = g.id) as count
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
      total: groups.rows.reduce((a, g) => a + g.count, 0),
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
    params.push(groupId); where.push(`m.group_id = $${params.length}`);
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
  const sql = `${LIST_SELECT}${where.length ? ` where ${where.join(' and ')}` : ''}
     order by m.pinned desc, m.meeting_date desc nulls last, m.created_at desc
     limit 300`;
  const { rows } = await query(sql, params);
  res.json({ data: rows });
}));

/** GET /api/meetings/:id — the full record: body, attachments, comments. */
router.get('/:id', canView, asyncHandler(async (req, res) => {
  const m = await queryOne(
    `select m.*, g.name as group_name, g.code as group_code, g.color as group_color,
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

  const [atts, comments, versions] = await Promise.all([
    query(`select id, kind, file_name, content_type, size_bytes, created_at
             from mtg_attachments where meeting_id = $1 and kind = 'file' order by created_at`, [m.id]),
    query(`select c.id, c.body, c.created_at, c.author_id, p.full_name as author_name
             from mtg_comments c left join profiles p on p.id = c.author_id
            where c.meeting_id = $1 order by c.created_at`, [m.id]),
    query(`select v.seq, v.title, v.meeting_date, v.time_label, v.saved_at, p.full_name as saved_by_name
             from mtg_versions v left join profiles p on p.id = v.saved_by
            where v.meeting_id = $1 order by v.seq desc`, [m.id]),
  ]);
  res.json({ data: { ...m, attachments: atts.rows, comments: comments.rows, versions: versions.rows } });
}));

/** GET /api/meetings/:id/versions/:seq — one earlier version, as it was.
 *  Title and date come from the snapshot, not the live row: renaming a meeting
 *  must not rewrite what its own history says it used to be called. */
router.get('/:id/versions/:seq', canView, asyncHandler(async (req, res) => {
  const v = await queryOne(
    `select seq, content, title, meeting_date, time_label, saved_at from mtg_versions
      where meeting_id = $1 and seq = $2`, [req.params.id, Number(req.params.seq) || -1]);
  if (!v) throw new ApiError(404, 'ไม่พบเวอร์ชันนี้');
  res.json({ data: v });
}));

// ── write ───────────────────────────────────────────────────────────────────

const meetingSchema = z.object({
  groupId: z.string().uuid(),
  title: z.string().trim().min(1).max(300),
  meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  timeLabel: z.string().trim().max(60).optional().default(''),
  content: z.string().max(400000).optional().default(''),
  attendees: z.array(z.string().trim().max(120)).max(100).optional().default([]),
  visible: z.boolean().optional().default(true),
});

router.post('/', canEdit, asyncHandler(async (req, res) => {
  const p = meetingSchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const g = await queryOne('select id from mtg_groups where id = $1 and is_active = true', [p.data.groupId]);
  if (!g) throw new ApiError(400, 'ไม่พบกลุ่มที่ระบุ');
  const html = sanitizeHtml(p.data.content);
  const row = await queryOne(
    `insert into mtg_meetings (group_id, title, meeting_date, time_label, content, excerpt,
                               attendees, visible, created_by, updated_by)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$9) returning id`,
    [p.data.groupId, p.data.title, p.data.meetingDate || null, p.data.timeLabel, html,
     htmlToText(html).slice(0, 200), JSON.stringify(p.data.attendees), p.data.visible, req.profile.id]
  );
  res.status(201).json({ data: { id: row.id } });
}));

/** PATCH /api/meetings/:id — save an edit, keeping what was there before. */
router.patch('/:id', canEdit, asyncHandler(async (req, res) => {
  const p = meetingSchema.partial().omit({ groupId: true }).safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const cur = await queryOne('select * from mtg_meetings where id = $1', [req.params.id]);
  if (!cur) throw new ApiError(404, 'ไม่พบรายงานการประชุมนี้');

  // Snapshot BEFORE overwriting, and snapshot the title/date as they stand right
  // now — capturing them afterwards would file the new name against the old body.
  //
  // Snapshot on ANY change to the four, not just the body. Versioning only the
  // body reopens the bug it was meant to close: rename today with no snapshot,
  // edit the text tomorrow, and that version pairs yesterday's words with
  // today's name — which is exactly what a reader would be misled by.
  const changed = ['content', 'title', 'meetingDate', 'timeLabel'].some((k) => {
    if (p.data[k] === undefined) return false;
    const before = { content: cur.content, title: cur.title,
      meetingDate: cur.meeting_date ? String(cur.meeting_date).slice(0, 10) : null,
      timeLabel: cur.time_label }[k];
    return String(p.data[k] ?? '') !== String(before ?? '');
  });
  if (changed && cur.content) {
    const seq = await queryOne(
      'select coalesce(max(seq), 0) + 1 as n from mtg_versions where meeting_id = $1', [cur.id]);
    await query(
      `insert into mtg_versions (meeting_id, seq, content, title, meeting_date, time_label, saved_by)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [cur.id, seq.n, cur.content, cur.title, cur.meeting_date, cur.time_label, req.profile.id]
    );
  }

  const html = p.data.content !== undefined ? sanitizeHtml(p.data.content) : null;
  const row = await queryOne(
    `update mtg_meetings set
       title = coalesce($2, title),
       meeting_date = coalesce($3, meeting_date),
       time_label = coalesce($4, time_label),
       content = coalesce($5, content),
       excerpt = coalesce($6, excerpt),
       attendees = coalesce($7::jsonb, attendees),
       visible = coalesce($8, visible),
       updated_by = $9, updated_at = now()
     where id = $1 returning id, title, updated_at`,
    [cur.id, p.data.title ?? null, p.data.meetingDate ?? null, p.data.timeLabel ?? null,
     html, html === null ? null : htmlToText(html).slice(0, 200),
     p.data.attendees ? JSON.stringify(p.data.attendees) : null,
     p.data.visible ?? null, req.profile.id]
  );
  res.json({ data: row });
}));

router.post('/:id/pin', canEdit, asyncHandler(async (req, res) => {
  const row = await queryOne(
    'update mtg_meetings set pinned = not pinned, updated_at = now() where id = $1 returning pinned',
    [req.params.id]);
  if (!row) throw new ApiError(404, 'ไม่พบรายงานการประชุมนี้');
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
  res.status(201).json({ data: row });
}));

router.get('/:id/attachments/:attId', canView, asyncHandler(async (req, res) => {
  const a = await queryOne(
    'select * from mtg_attachments where id = $1 and meeting_id = $2', [req.params.attId, req.params.id]);
  if (!a) throw new ApiError(404, 'ไม่พบไฟล์นี้');
  const buf = await getObjectBuffer(a.storage_key);
  res.setHeader('Content-Type', a.content_type || 'application/octet-stream');
  res.setHeader('Content-Disposition',
    `${a.kind === 'inline' ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(a.file_name)}`);
  res.send(buf);
}));

router.delete('/:id/attachments/:attId', canEdit, asyncHandler(async (req, res) => {
  const a = await queryOne(
    'delete from mtg_attachments where id = $1 and meeting_id = $2 returning storage_key',
    [req.params.attId, req.params.id]);
  if (!a) throw new ApiError(404, 'ไม่พบไฟล์นี้');
  await deleteObject(a.storage_key).catch(() => {});
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

// ── groups ──────────────────────────────────────────────────────────────────

const groupSchema = z.object({
  name: z.string().trim().min(1).max(200),
  name_en: z.string().trim().max(200).optional().default(''),
  code: z.string().trim().max(32).optional().default(''),
  cadence: z.string().trim().max(60).optional().default(''),
  color: z.string().trim().max(24).optional().default('#64748b'),
  is_active: z.boolean().optional(),
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
       is_active = coalesce($6, is_active)
     where id = $1 returning *`,
    [req.params.id, p.data.name ?? null, p.data.name_en ?? null, p.data.cadence ?? null,
     p.data.color ?? null, p.data.is_active ?? null]);
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

export default router;
