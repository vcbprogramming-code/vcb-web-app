import { Router } from 'express';
import { z } from 'zod';
import { Profile, Project, DocumentType, Unit, ROLES } from '../models/index.js';
import { profileOut, projectOut, docTypeOut, letterheadOut } from '../utils/serialize.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { hashPassword } from '../utils/auth.js';

// Everything here is admin-only.
const router = Router();
router.use(requireAuth, requireRole('admin'));

const CI = { locale: 'en', strength: 2 }; // case-insensitive collation

// ===========================================================================
// Users
// ===========================================================================

/** GET /api/admin/users — list all login accounts (with unit name). */
router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const rows = await Profile.find().sort({ createdAt: 1 }).populate('unitId', 'name').lean();
    res.json({
      data: rows.map((p) => ({
        ...profileOut(p),
        unit_name: p.unitId && typeof p.unitId === 'object' ? p.unitId.name : null,
      })),
    });
  })
);

const createUserSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(ROLES),
  unitId: z.string().optional().nullable(),
});

/** POST /api/admin/users — create a login account. */
router.post(
  '/users',
  asyncHandler(async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const { fullName, email, password, role, unitId } = parsed.data;

    const existing = await Profile.findOne({ email }).collation(CI).lean();
    if (existing) throw new ApiError(409, 'อีเมลนี้ถูกใช้งานแล้ว');

    const passwordHash = await hashPassword(password);
    const created = await Profile.create({
      fullName,
      email,
      passwordHash,
      role,
      unitId: unitId || null,
      isActive: true,
    });
    res.status(201).json({ data: profileOut(created.toObject()) });
  })
);

const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  role: z.enum(ROLES).optional(),
  unitId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

/** PATCH /api/admin/users/:id — update name/role/unit/active. */
router.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const f = parsed.data;

    // don't let an admin disable / demote themselves out of admin
    if (req.params.id === req.profile.id && (f.isActive === false || (f.role && f.role !== 'admin'))) {
      throw new ApiError(400, 'ไม่สามารถปิดการใช้งานหรือลดสิทธิ์บัญชีของตนเองได้');
    }

    const set = {};
    if (f.fullName !== undefined) set.fullName = f.fullName;
    if (f.role !== undefined) set.role = f.role;
    if (f.unitId !== undefined) set.unitId = f.unitId || null;
    if (f.isActive !== undefined) set.isActive = f.isActive;
    if (!Object.keys(set).length) throw new ApiError(400, 'No fields to update');

    const row = await Profile.findByIdAndUpdate(req.params.id, { $set: set }, { new: true }).lean();
    if (!row) throw new ApiError(404, 'User not found');
    res.json({ data: profileOut(row) });
  })
);

const pwdSchema = z.object({ password: z.string().min(6) });

/** POST /api/admin/users/:id/reset-password */
router.post(
  '/users/:id/reset-password',
  asyncHandler(async (req, res) => {
    const parsed = pwdSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const passwordHash = await hashPassword(parsed.data.password);
    const row = await Profile.findByIdAndUpdate(
      req.params.id,
      { $set: { passwordHash } },
      { new: true }
    ).lean();
    if (!row) throw new ApiError(404, 'User not found');
    res.json({ data: { reset: true } });
  })
);

// ===========================================================================
// Config: Projects
// ===========================================================================

const projectSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1),
  docPrefix: z.string().min(1).max(20),
  color: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

/** GET /api/admin/projects — all projects (incl. inactive). */
router.get(
  '/projects',
  asyncHandler(async (req, res) => {
    const rows = await Project.find().sort({ sortOrder: 1, code: 1 }).lean();
    res.json({ data: rows.map(projectOut) });
  })
);

router.post(
  '/projects',
  asyncHandler(async (req, res) => {
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const { code, name, docPrefix, color, sortOrder } = parsed.data;
    const dup = await Project.findOne({ code }).collation(CI).lean();
    if (dup) throw new ApiError(409, 'รหัสโครงการนี้มีอยู่แล้ว');
    const created = await Project.create({
      code,
      name,
      docPrefix,
      color: color || null,
      sortOrder: sortOrder ?? 0,
    });
    res.status(201).json({ data: projectOut(created.toObject()) });
  })
);

router.patch(
  '/projects/:id',
  asyncHandler(async (req, res) => {
    const parsed = projectSchema.partial().safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const f = parsed.data;
    const map = {
      code: 'code',
      name: 'name',
      docPrefix: 'docPrefix',
      color: 'color',
      sortOrder: 'sortOrder',
      isActive: 'isActive',
    };
    const set = {};
    for (const [k, field] of Object.entries(map)) {
      if (f[k] !== undefined) set[field] = f[k];
    }
    if (!Object.keys(set).length) throw new ApiError(400, 'No fields to update');
    const row = await Project.findByIdAndUpdate(req.params.id, { $set: set }, { new: true }).lean();
    if (!row) throw new ApiError(404, 'Project not found');
    res.json({ data: projectOut(row) });
  })
);

// ===========================================================================
// Config: Document types
// ===========================================================================

const docTypeSchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int().optional(),
});

router.get(
  '/document-types',
  asyncHandler(async (req, res) => {
    const rows = await DocumentType.find().sort({ sortOrder: 1, name: 1 }).lean();
    res.json({ data: rows.map(docTypeOut) });
  })
);

router.post(
  '/document-types',
  asyncHandler(async (req, res) => {
    const parsed = docTypeSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const dup = await DocumentType.findOne({ name: parsed.data.name }).lean();
    if (dup) throw new ApiError(409, 'ประเภทเอกสารนี้มีอยู่แล้ว');
    const created = await DocumentType.create({
      name: parsed.data.name,
      sortOrder: parsed.data.sortOrder ?? 0,
    });
    res.status(201).json({ data: docTypeOut(created.toObject()) });
  })
);

router.patch(
  '/document-types/:id',
  asyncHandler(async (req, res) => {
    const parsed = docTypeSchema.partial().safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const f = parsed.data;
    const set = {};
    if (f.name !== undefined) set.name = f.name;
    if (f.sortOrder !== undefined) set.sortOrder = f.sortOrder;
    if (!Object.keys(set).length) throw new ApiError(400, 'No fields to update');
    const row = await DocumentType.findByIdAndUpdate(req.params.id, { $set: set }, { new: true }).lean();
    if (!row) throw new ApiError(404, 'Type not found');
    res.json({ data: docTypeOut(row) });
  })
);

router.delete(
  '/document-types/:id',
  asyncHandler(async (req, res) => {
    await DocumentType.findByIdAndDelete(req.params.id);
    res.json({ data: { deleted: true } });
  })
);

// ===========================================================================
// Config: Project letterhead (embedded 1:1 in the project)
// ===========================================================================

/** GET /api/admin/projects/:id/letterhead */
router.get(
  '/projects/:id/letterhead',
  asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.id).select('letterhead').lean();
    res.json({ data: project?.letterhead ? letterheadOut(project.letterhead) : null });
  })
);

const letterheadSchema = z.object({
  companyName: z.string().optional(),
  companyNameEn: z.string().optional(),
  address: z.string().optional(),
  logoUrl: z.string().optional(),
  phone: z.string().optional(),
  telex: z.string().optional(),
  fax: z.string().optional(),
  signatoryName: z.string().optional(),
  signatoryTitle: z.string().optional(),
  signatureUrl: z.string().optional(),
  closingLine: z.string().optional(),
  defaultRecipient: z.string().optional(),
});

/** PUT /api/admin/projects/:id/letterhead — upsert the embedded letterhead. */
router.put(
  '/projects/:id/letterhead',
  asyncHandler(async (req, res) => {
    const parsed = letterheadSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const f = parsed.data;
    const letterhead = {
      companyName: f.companyName || null,
      companyNameEn: f.companyNameEn || null,
      address: f.address || null,
      logoUrl: f.logoUrl || null,
      phone: f.phone || null,
      telex: f.telex || null,
      fax: f.fax || null,
      signatoryName: f.signatoryName || null,
      signatoryTitle: f.signatoryTitle || null,
      signatureUrl: f.signatureUrl || null,
      closingLine: f.closingLine || null,
      defaultRecipient: f.defaultRecipient || null,
    };
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { $set: { letterhead } },
      { new: true }
    ).lean();
    if (!project) throw new ApiError(404, 'Project not found');
    res.json({ data: letterheadOut(project.letterhead) });
  })
);

export default router;
