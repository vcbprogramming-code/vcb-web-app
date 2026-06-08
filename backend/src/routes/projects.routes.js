import { Router } from 'express';
import { Project, DocCodeDepartment, DocumentType } from '../models/index.js';
import { projectOut, docTypeOut } from '../utils/serialize.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

/** GET /api/projects — list active projects (the register chips). */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await Project.find({ isActive: true })
      .sort({ sortOrder: 1, code: 1 })
      .lean();
    res.json({ data: rows.map(projectOut) });
  })
);

/** GET /api/projects/doc-codes — the doc-code → department mapping. */
router.get(
  '/doc-codes',
  asyncHandler(async (req, res) => {
    const rows = await DocCodeDepartment.find().sort({ _id: 1 }).lean();
    res.json({
      data: rows.map((r) => ({
        code: r._id,
        department: r.department,
        recipient_title: r.recipientTitle ?? null,
      })),
    });
  })
);

/** GET /api/projects/document-types — document type options. */
router.get(
  '/document-types',
  asyncHandler(async (req, res) => {
    const rows = await DocumentType.find().sort({ sortOrder: 1, name: 1 }).lean();
    res.json({ data: rows.map((t) => ({ id: String(t._id), name: t.name })) });
  })
);

export default router;
