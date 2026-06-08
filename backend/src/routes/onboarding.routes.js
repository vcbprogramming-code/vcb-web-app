import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import multer from 'multer';
import {
  OnboardingResource,
  OnboardingPlanTemplate,
  NewHireJourney,
} from '../models/index.js';
import { RESOURCE_CATEGORIES } from '../models/OnboardingResource.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';
import { putObject, deleteObject, openDownloadStream } from '../config/storage.js';

const router = Router();
router.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxUploadBytes } });

const resourceOut = (r) => ({
  id: String(r._id),
  title: r.title,
  category: r.category,
  description: r.description ?? null,
  link: r.link ?? null,
  file_name: r.fileName ?? null,
  has_file: Boolean(r.storageKey),
  requires_signature: r.requiresSignature,
  sort_order: r.sortOrder,
  is_active: r.isActive,
});
const templateOut = (t) => ({
  id: String(t._id),
  phase: t.phase,
  title: t.title,
  description: t.description ?? null,
  owner: t.owner ?? null,
  sort_order: t.sortOrder,
  is_active: t.isActive,
});
const journeyOut = (j) => {
  const total = (j.tasks || []).length;
  const done = (j.tasks || []).filter((t) => t.done).length;
  return {
    id: String(j._id),
    full_name: j.fullName,
    employee_code: j.employeeCode ?? null,
    position: j.position ?? null,
    unit_id: j.unitId ? String(j.unitId) : null,
    email: j.email ?? null,
    phone: j.phone ?? null,
    start_date: j.startDate,
    status: j.status,
    progress: total ? Math.round((done / total) * 100) : 0,
    tasks_total: total,
    tasks_done: done,
    tasks: (j.tasks || []).map((t) => ({
      id: String(t._id),
      phase: t.phase,
      title: t.title,
      description: t.description ?? null,
      owner: t.owner ?? null,
      done: t.done,
      done_at: t.doneAt ?? null,
    })),
    review: j.review || {},
  };
};

// ── resource library ────────────────────────────────────────────────────────

/** GET /api/onboarding/resources?category= */
router.get(
  '/resources',
  asyncHandler(async (req, res) => {
    const filter = { isActive: true };
    if (req.query.category) filter.category = req.query.category;
    const rows = await OnboardingResource.find(filter).sort({ category: 1, sortOrder: 1 }).lean();
    res.json({ data: rows.map(resourceOut) });
  })
);

const resourceSchema = z.object({
  title: z.string().min(1),
  category: z.enum(RESOURCE_CATEGORIES),
  description: z.string().optional().nullable(),
  link: z.string().optional().nullable(),
  requiresSignature: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

/** POST /api/onboarding/resources — multipart (optional `file`) + fields. */
router.post(
  '/resources',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const body = { ...req.body };
    if (body.requiresSignature !== undefined) body.requiresSignature = body.requiresSignature === 'true' || body.requiresSignature === true;
    if (body.sortOrder !== undefined) body.sortOrder = Number(body.sortOrder);
    const parsed = resourceSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());

    let storageKey = null;
    let fileName = null;
    let contentType = null;
    if (req.file) {
      const safe = req.file.originalname.replace(/[^\w.\-ก-๙ ]/g, '_');
      storageKey = `onboarding/${crypto.randomUUID()}-${safe}`;
      await putObject(storageKey, req.file.buffer, req.file.mimetype);
      fileName = req.file.originalname;
      contentType = req.file.mimetype;
    }
    const created = await OnboardingResource.create({
      ...parsed.data,
      storageKey,
      fileName,
      contentType,
      createdBy: req.profile.id,
    });
    res.status(201).json({ data: resourceOut(created.toObject()) });
  })
);

/** GET /api/onboarding/resources/:id/download — stream the file. */
router.get(
  '/resources/:id/download',
  asyncHandler(async (req, res) => {
    const r = await OnboardingResource.findById(req.params.id).lean();
    if (!r || !r.storageKey) throw new ApiError(404, 'File not found');
    const obj = await openDownloadStream(r.storageKey);
    if (!obj) throw new ApiError(404, 'File not found in storage');
    res.setHeader('Content-Type', obj.contentType || r.contentType || 'application/octet-stream');
    const encoded = encodeURIComponent(r.fileName || 'file');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encoded}`);
    obj.stream.on('error', () => res.destroy());
    obj.stream.pipe(res);
  })
);

router.delete(
  '/resources/:id',
  asyncHandler(async (req, res) => {
    const r = await OnboardingResource.findById(req.params.id).lean();
    if (!r) throw new ApiError(404, 'Resource not found');
    if (r.storageKey) await deleteObject(r.storageKey).catch(() => {});
    await OnboardingResource.findByIdAndDelete(req.params.id);
    res.json({ data: { deleted: true } });
  })
);

// ── 30-60-90 plan templates ─────────────────────────────────────────────────

/** GET /api/onboarding/templates — the master 30-60-90 task list. */
router.get(
  '/templates',
  asyncHandler(async (req, res) => {
    const rows = await OnboardingPlanTemplate.find({ isActive: true }).sort({ phase: 1, sortOrder: 1 }).lean();
    res.json({ data: rows.map(templateOut) });
  })
);

const templateSchema = z.object({
  phase: z.union([z.literal(30), z.literal(60), z.literal(90)]),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  owner: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

router.post(
  '/templates',
  asyncHandler(async (req, res) => {
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const created = await OnboardingPlanTemplate.create(parsed.data);
    res.status(201).json({ data: templateOut(created.toObject()) });
  })
);

router.patch(
  '/templates/:id',
  asyncHandler(async (req, res) => {
    const parsed = templateSchema.partial().safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const row = await OnboardingPlanTemplate.findByIdAndUpdate(req.params.id, { $set: parsed.data }, { new: true }).lean();
    if (!row) throw new ApiError(404, 'Template not found');
    res.json({ data: templateOut(row) });
  })
);

router.delete(
  '/templates/:id',
  asyncHandler(async (req, res) => {
    await OnboardingPlanTemplate.findByIdAndDelete(req.params.id);
    res.json({ data: { deleted: true } });
  })
);

// ── new-hire journeys ───────────────────────────────────────────────────────

/** GET /api/onboarding/journeys?status= */
router.get(
  '/journeys',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const rows = await NewHireJourney.find(filter).sort({ startDate: -1 }).lean();
    res.json({ data: rows.map(journeyOut) });
  })
);

/** GET /api/onboarding/journeys/:id — full journey detail. */
router.get(
  '/journeys/:id',
  asyncHandler(async (req, res) => {
    const j = await NewHireJourney.findById(req.params.id).lean();
    if (!j) throw new ApiError(404, 'Journey not found');
    res.json({ data: journeyOut(j) });
  })
);

const journeySchema = z.object({
  fullName: z.string().min(1),
  employeeCode: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  unitId: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  startDate: z.string().min(1),
});

/** POST /api/onboarding/journeys — create from active templates. */
router.post(
  '/journeys',
  asyncHandler(async (req, res) => {
    const parsed = journeySchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const d = parsed.data;
    const templates = await OnboardingPlanTemplate.find({ isActive: true }).sort({ phase: 1, sortOrder: 1 }).lean();
    const tasks = templates.map((t) => ({
      phase: t.phase,
      title: t.title,
      description: t.description || null,
      owner: t.owner || null,
      done: false,
    }));
    const created = await NewHireJourney.create({
      ...d,
      unitId: d.unitId || null,
      startDate: new Date(d.startDate),
      tasks,
      review: {},
      createdBy: req.profile.id,
    });
    res.status(201).json({ data: journeyOut(created.toObject()) });
  })
);

/** PATCH /api/onboarding/journeys/:id/tasks/:taskId — toggle done. */
router.patch(
  '/journeys/:id/tasks/:taskId',
  asyncHandler(async (req, res) => {
    const parsed = z.object({ done: z.boolean() }).safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const updated = await NewHireJourney.findOneAndUpdate(
      { _id: req.params.id, 'tasks._id': req.params.taskId },
      { $set: { 'tasks.$.done': parsed.data.done, 'tasks.$.doneAt': parsed.data.done ? new Date() : null } },
      { new: true }
    ).lean();
    if (!updated) throw new ApiError(404, 'Task not found');
    res.json({ data: journeyOut(updated) });
  })
);

/** PUT /api/onboarding/journeys/:id/review — probation review. */
router.put(
  '/journeys/:id/review',
  asyncHandler(async (req, res) => {
    const parsed = z.object({
      reviewer: z.string().optional().nullable(),
      scores: z.record(z.string(), z.number()).optional().nullable(),
      strengths: z.string().optional().nullable(),
      improvements: z.string().optional().nullable(),
      result: z.enum(['pass', 'extend', 'fail']).optional().nullable(),
      note: z.string().optional().nullable(),
    }).safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const review = { ...parsed.data, reviewedAt: new Date() };
    const status = parsed.data.result === 'fail' ? 'left' : parsed.data.result === 'pass' ? 'completed' : 'active';
    const updated = await NewHireJourney.findByIdAndUpdate(
      req.params.id, { $set: { review, status } }, { new: true }
    ).lean();
    if (!updated) throw new ApiError(404, 'Journey not found');
    res.json({ data: journeyOut(updated) });
  })
);

export default router;
