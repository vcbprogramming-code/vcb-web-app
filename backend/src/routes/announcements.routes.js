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

const schema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(4000).optional().nullable(),
  level: z.enum(['info', 'warning', 'success']).optional(),
  isActive: z.boolean().optional(),
  pinned: z.boolean().optional(),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
});

/** GET /api/announcements — the active feed for the portal (any signed-in user). */
router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `select id, title, body, level, pinned, starts_at, ends_at, created_at
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
            a.created_at, p.full_name as created_by_name
       from announcements a
       left join profiles p on p.id = a.created_by
      order by a.pinned desc, a.created_at desc`
  );
  res.json({ data: rows });
}));

router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const p = schema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'Invalid input', p.error.flatten());
  const f = p.data;
  const row = await queryOne(
    `insert into announcements (title, body, level, is_active, pinned, starts_at, ends_at, created_by)
     values ($1,$2,coalesce($3,'info'),coalesce($4,true),coalesce($5,false),$6,$7,$8)
     returning *`,
    [f.title, f.body || null, f.level, f.isActive, f.pinned, f.startsAt || null, f.endsAt || null, req.profile.id]
  );
  res.status(201).json({ data: row });
}));

router.patch('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const p = schema.partial().safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'Invalid input', p.error.flatten());
  const map = { title: 'title', body: 'body', level: 'level', isActive: 'is_active', pinned: 'pinned', startsAt: 'starts_at', endsAt: 'ends_at' };
  const sets = ['updated_at = now()']; const vals = [];
  for (const [k, col] of Object.entries(map)) {
    if (p.data[k] !== undefined) { vals.push(p.data[k] === '' ? null : p.data[k]); sets.push(`${col} = $${vals.length}`); }
  }
  vals.push(req.params.id);
  const row = await queryOne(`update announcements set ${sets.join(', ')} where id = $${vals.length} returning *`, vals);
  if (!row) throw new ApiError(404, 'Announcement not found');
  res.json({ data: row });
}));

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const row = await queryOne('delete from announcements where id = $1 returning id', [req.params.id]);
  if (!row) throw new ApiError(404, 'Announcement not found');
  res.json({ data: { deleted: true } });
}));

export default router;
