import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';

// Portal announcements — read by any signed-in user (shown on the launcher),
// created/edited/removed by admins only.
const router = Router();
router.use(requireAuth);

// An absolute instant (with offset/Z) — a bare "2026-08-01T09:00" would be read
// as UTC and land 7h off in Bangkok, and free text would blow up the timestamptz
// cast with a 500 instead of a clean 400.
const instant = z.string().datetime({ offset: true });

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(4000).optional().nullable(),
  level: z.enum(['info', 'warning', 'success']).optional(),
  isActive: z.boolean().optional(),
  pinned: z.boolean().optional(),
  startsAt: instant.optional().nullable(),
  endsAt: instant.optional().nullable(),
}).refine(
  (d) => !d.startsAt || !d.endsAt || d.startsAt <= d.endsAt,
  { message: 'วันที่เริ่มแสดงต้องไม่หลังวันที่สิ้นสุด', path: ['endsAt'] }
);

/** Columns returned to clients — one shape for every route (no created_by leak). */
const PUBLIC_COLS = 'id, title, body, level, is_active, pinned, starts_at, ends_at, created_at';

/** 400 on a malformed id so Postgres' uuid cast can't turn it into a 500. */
function assertUuid(id) {
  if (!z.string().uuid().safeParse(id).success) throw new ApiError(404, 'ไม่พบประกาศ');
  return id;
}

/** GET /api/announcements — the active feed for the portal (any signed-in user). */
router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `select ${PUBLIC_COLS}
       from announcements
      where is_active = true
        and (starts_at is null or starts_at <= now())
        and (ends_at   is null or ends_at   >= now())
      order by pinned desc, created_at desc
      limit 20`
  );
  res.json({ data: rows });
}));

/** GET /api/announcements/all — every announcement incl. inactive (admin manage view). */
router.get('/all', requireRole('admin'), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `select a.id, a.title, a.body, a.level, a.is_active, a.pinned, a.starts_at, a.ends_at,
            a.created_at, a.updated_at, p.full_name as created_by_name
       from announcements a
       left join profiles p on p.id = a.created_by
      order by a.pinned desc, a.created_at desc`
  );
  res.json({ data: rows });
}));

router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const p = schema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const f = p.data;
  const row = await queryOne(
    `insert into announcements (title, body, level, is_active, pinned, starts_at, ends_at, created_by)
     values ($1,$2,coalesce($3,'info'),coalesce($4,true),coalesce($5,false),$6,$7,$8)
     returning ${PUBLIC_COLS}`,
    [f.title, f.body || null, f.level, f.isActive, f.pinned, f.startsAt || null, f.endsAt || null, req.profile.id]
  );
  res.status(201).json({ data: row });
}));

router.patch('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  // `.partial()` on a refined schema needs the inner object — rebuild the check
  const p = schema.innerType().partial().safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  if (p.data.startsAt && p.data.endsAt && p.data.startsAt > p.data.endsAt) {
    throw new ApiError(400, 'วันที่เริ่มแสดงต้องไม่หลังวันที่สิ้นสุด');
  }
  const map = { title: 'title', body: 'body', level: 'level', isActive: 'is_active', pinned: 'pinned', startsAt: 'starts_at', endsAt: 'ends_at' };
  const sets = []; const vals = [];
  for (const [k, col] of Object.entries(map)) {
    if (p.data[k] !== undefined) { vals.push(p.data[k] === '' ? null : p.data[k]); sets.push(`${col} = $${vals.length}`); }
  }
  if (!sets.length) throw new ApiError(400, 'ไม่มีข้อมูลที่ต้องแก้ไข');
  sets.push('updated_at = now()');
  vals.push(req.params.id);
  const row = await queryOne(`update announcements set ${sets.join(', ')} where id = $${vals.length} returning ${PUBLIC_COLS}`, vals);
  if (!row) throw new ApiError(404, 'ไม่พบประกาศ');
  res.json({ data: row });
}));

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  const row = await queryOne('delete from announcements where id = $1 returning id', [req.params.id]);
  if (!row) throw new ApiError(404, 'ไม่พบประกาศ');
  res.json({ data: { deleted: true } });
}));

export default router;
