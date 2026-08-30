import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import multer from 'multer';
import { pool, query, queryOne } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';
import { putObject, deleteObject, openDownloadStream } from '../config/storage.js';

const RESOURCE_CATEGORIES = ['นโยบาย', 'สวัสดิการ', 'คู่มือ', 'เอกสารลงนาม', 'สื่อแนะนำ'];

const router = Router();
router.use(requireAuth);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxUploadBytes } });

const resourceOut = (r) => ({
  id: r.id, title: r.title, category: r.category, description: r.description, link: r.link,
  file_name: r.file_name, has_file: Boolean(r.storage_key), requires_signature: r.requires_signature,
  sort_order: r.sort_order, is_active: r.is_active,
});
const templateOut = (t) => ({ id: t.id, phase: t.phase, title: t.title, description: t.description, owner: t.owner, sort_order: t.sort_order, is_active: t.is_active });

async function journeyDetail(id) {
  const j = await queryOne('select * from newhire_journeys where id = $1', [id]);
  if (!j) return null;
  const tasks = (await query('select * from newhire_journey_tasks where journey_id = $1 order by phase, sort_order', [id])).rows;
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  return {
    id: j.id, full_name: j.full_name, employee_code: j.employee_code, position: j.position, unit_id: j.unit_id,
    email: j.email, phone: j.phone, start_date: j.start_date, status: j.status,
    progress: total ? Math.round((done / total) * 100) : 0, tasks_total: total, tasks_done: done,
    tasks: tasks.map((t) => ({ id: t.id, phase: t.phase, title: t.title, description: t.description, owner: t.owner, done: t.done, done_at: t.done_at })),
    review: {
      reviewer: j.review_reviewer, reviewedAt: j.review_reviewed_at, scores: j.review_scores,
      strengths: j.review_strengths, improvements: j.review_improvements, result: j.review_result, note: j.review_note,
    },
  };
}

// ── resources ─────────────────────────────────────────────────────────────
router.get('/resources', asyncHandler(async (req, res) => {
  const { rows } = req.query.category
    ? await query('select * from onboarding_resources where is_active = true and category = $1 order by category, sort_order', [req.query.category])
    : await query('select * from onboarding_resources where is_active = true order by category, sort_order');
  res.json({ data: rows.map(resourceOut) });
}));
router.post('/resources', upload.single('file'), asyncHandler(async (req, res) => {
  const body = { ...req.body };
  if (body.requiresSignature !== undefined) body.requiresSignature = body.requiresSignature === 'true' || body.requiresSignature === true;
  if (body.sortOrder !== undefined) body.sortOrder = Number(body.sortOrder);
  const parsed = z.object({ title: z.string().min(1), category: z.enum(RESOURCE_CATEGORIES),
    description: z.string().optional().nullable(), link: z.string().optional().nullable(),
    requiresSignature: z.boolean().optional(), sortOrder: z.number().int().optional() }).safeParse(body);
  if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
  let storageKey = null, fileName = null, contentType = null;
  if (req.file) {
    const safe = req.file.originalname.replace(/[^\w.\-ก-๙ ]/g, '_');
    storageKey = `onboarding/${crypto.randomUUID()}-${safe}`;
    await putObject(storageKey, req.file.buffer, req.file.mimetype);
    fileName = req.file.originalname; contentType = req.file.mimetype;
  }
  const d = parsed.data;
  const row = await queryOne(
    `insert into onboarding_resources (title, category, description, link, storage_key, file_name, content_type, requires_signature, sort_order, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [d.title, d.category, d.description || null, d.link || null, storageKey, fileName, contentType, d.requiresSignature || false, d.sortOrder ?? 0, req.profile.id]
  );
  res.status(201).json({ data: resourceOut(row) });
}));
router.get('/resources/:id/download', asyncHandler(async (req, res) => {
  const r = await queryOne('select storage_key, file_name, content_type from onboarding_resources where id = $1', [req.params.id]);
  if (!r || !r.storage_key) throw new ApiError(404, 'File not found');
  const obj = await openDownloadStream(r.storage_key);
  if (!obj) throw new ApiError(404, 'File not found in storage');
  res.setHeader('Content-Type', obj.contentType || r.content_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(r.file_name || 'file')}`);
  obj.stream.on('error', () => res.destroy());
  obj.stream.pipe(res);
}));
router.delete('/resources/:id', asyncHandler(async (req, res) => {
  const r = await queryOne('select storage_key from onboarding_resources where id = $1', [req.params.id]);
  if (!r) throw new ApiError(404, 'Resource not found');
  if (r.storage_key) await deleteObject(r.storage_key).catch(() => {});
  await query('delete from onboarding_resources where id = $1', [req.params.id]);
  res.json({ data: { deleted: true } });
}));

// ── templates ─────────────────────────────────────────────────────────────
router.get('/templates', asyncHandler(async (req, res) => {
  const { rows } = await query('select * from onboarding_plan_templates where is_active = true order by phase, sort_order');
  res.json({ data: rows.map(templateOut) });
}));
const templateSchema = z.object({ phase: z.union([z.literal(30), z.literal(60), z.literal(90)]), title: z.string().min(1), description: z.string().optional().nullable(), owner: z.string().optional().nullable(), sortOrder: z.number().int().optional() });
router.post('/templates', asyncHandler(async (req, res) => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
  const d = parsed.data;
  const row = await queryOne('insert into onboarding_plan_templates (phase, title, description, owner, sort_order) values ($1,$2,$3,$4,$5) returning *', [d.phase, d.title, d.description || null, d.owner || null, d.sortOrder ?? 0]);
  res.status(201).json({ data: templateOut(row) });
}));
router.patch('/templates/:id', asyncHandler(async (req, res) => {
  const parsed = templateSchema.partial().safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
  const d = parsed.data;
  const map = { phase: 'phase', title: 'title', description: 'description', owner: 'owner', sortOrder: 'sort_order' };
  const sets = []; const vals = [];
  for (const [k, col] of Object.entries(map)) if (d[k] !== undefined) { vals.push(d[k] ?? null); sets.push(`${col} = $${vals.length}`); }
  if (!sets.length) throw new ApiError(400, 'No fields to update');
  vals.push(req.params.id);
  const row = await queryOne(`update onboarding_plan_templates set ${sets.join(', ')} where id = $${vals.length} returning *`, vals);
  if (!row) throw new ApiError(404, 'Template not found');
  res.json({ data: templateOut(row) });
}));
router.delete('/templates/:id', asyncHandler(async (req, res) => {
  await query('delete from onboarding_plan_templates where id = $1', [req.params.id]);
  res.json({ data: { deleted: true } });
}));

// ── journeys ──────────────────────────────────────────────────────────────
router.get('/journeys', asyncHandler(async (req, res) => {
  const { rows } = req.query.status
    ? await query('select id from newhire_journeys where status = $1 order by start_date desc', [req.query.status])
    : await query('select id from newhire_journeys order by start_date desc');
  const out = [];
  for (const r of rows) out.push(await journeyDetail(r.id));
  res.json({ data: out });
}));
router.get('/journeys/:id', asyncHandler(async (req, res) => {
  const j = await journeyDetail(req.params.id);
  if (!j) throw new ApiError(404, 'Journey not found');
  res.json({ data: j });
}));
router.post('/journeys', asyncHandler(async (req, res) => {
  const parsed = z.object({ fullName: z.string().min(1), employeeCode: z.string().optional().nullable(),
    position: z.string().optional().nullable(), unitId: z.string().uuid().optional().nullable(),
    email: z.string().optional().nullable(), phone: z.string().optional().nullable(), startDate: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
  const d = parsed.data;
  const client = await pool.connect();
  try {
    await client.query('begin');
    const j = (await client.query(
      `insert into newhire_journeys (full_name, employee_code, position, unit_id, email, phone, start_date, created_by)
       values ($1,$2,$3,$4,$5,$6,$7::date,$8) returning id`,
      [d.fullName, d.employeeCode || null, d.position || null, d.unitId || null, d.email || null, d.phone || null, d.startDate, req.profile.id]
    )).rows[0];
    const templates = (await client.query('select * from onboarding_plan_templates where is_active = true order by phase, sort_order')).rows;
    for (const t of templates) {
      await client.query(
        `insert into newhire_journey_tasks (journey_id, phase, title, description, owner, sort_order) values ($1,$2,$3,$4,$5,$6)`,
        [j.id, t.phase, t.title, t.description, t.owner, t.sort_order]
      );
    }
    await client.query('commit');
    res.status(201).json({ data: await journeyDetail(j.id) });
  } catch (err) {
    await client.query('rollback'); throw err;
  } finally {
    client.release();
  }
}));
router.patch('/journeys/:id/tasks/:taskId', asyncHandler(async (req, res) => {
  const parsed = z.object({ done: z.boolean() }).safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
  const r = await queryOne(
    `update newhire_journey_tasks set done = $1, done_at = case when $1 then now() else null end
     where id = $2 and journey_id = $3 returning id`,
    [parsed.data.done, req.params.taskId, req.params.id]
  );
  if (!r) throw new ApiError(404, 'Task not found');
  res.json({ data: await journeyDetail(req.params.id) });
}));
router.put('/journeys/:id/review', asyncHandler(async (req, res) => {
  const parsed = z.object({ reviewer: z.string().optional().nullable(), scores: z.record(z.string(), z.number()).optional().nullable(),
    strengths: z.string().optional().nullable(), improvements: z.string().optional().nullable(),
    result: z.enum(['pass', 'extend', 'fail']).optional().nullable(), note: z.string().optional().nullable() }).safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
  const d = parsed.data;
  const status = d.result === 'fail' ? 'left' : d.result === 'pass' ? 'completed' : 'active';
  const r = await queryOne(
    `update newhire_journeys set review_reviewer=$1, review_reviewed_at=now(), review_scores=$2::jsonb,
       review_strengths=$3, review_improvements=$4, review_result=$5, review_note=$6, status=$7
     where id = $8 returning id`,
    [d.reviewer || null, d.scores ? JSON.stringify(d.scores) : null, d.strengths || null, d.improvements || null, d.result || null, d.note || null, status, req.params.id]
  );
  if (!r) throw new ApiError(404, 'Journey not found');
  res.json({ data: await journeyDetail(req.params.id) });
}));

export default router;
