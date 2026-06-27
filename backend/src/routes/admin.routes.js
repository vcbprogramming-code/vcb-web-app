import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { hashPassword } from '../utils/auth.js';

// Everything here is admin-only.
const router = Router();
router.use(requireAuth, requireRole('admin'));

const ROLES = ['admin', 'executive', 'hr'];

// ===========================================================================
// Users
// ===========================================================================

/** GET /api/admin/users — list all login accounts. */
router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `select p.id, p.full_name, p.email, p.role, p.unit_id, p.is_active,
              p.created_at, u.name as unit_name
         from profiles p
         left join units u on u.id = p.unit_id
        order by p.created_at`
    );
    res.json({ data: rows });
  })
);

const createUserSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(ROLES),
  unitId: z.string().uuid().optional().nullable(),
});

/** POST /api/admin/users — create a login account. */
router.post(
  '/users',
  asyncHandler(async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const { fullName, email, password, role, unitId } = parsed.data;

    const existing = await queryOne('select id from profiles where lower(email) = lower($1)', [email]);
    if (existing) throw new ApiError(409, 'อีเมลนี้ถูกใช้งานแล้ว');

    const hash = await hashPassword(password);
    const row = await queryOne(
      `insert into profiles (full_name, email, password_hash, role, unit_id, is_active)
       values ($1,$2,$3,$4,$5,true)
       returning id, full_name, email, role, unit_id, is_active`,
      [fullName, email, hash, role, unitId || null]
    );
    res.status(201).json({ data: row });
  })
);

const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  role: z.enum(ROLES).optional(),
  unitId: z.string().uuid().optional().nullable(),
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

    const sets = [];
    const vals = [];
    const add = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
    if (f.fullName !== undefined) add('full_name', f.fullName);
    if (f.role !== undefined) add('role', f.role);
    if (f.unitId !== undefined) add('unit_id', f.unitId);
    if (f.isActive !== undefined) add('is_active', f.isActive);
    if (!sets.length) throw new ApiError(400, 'No fields to update');

    vals.push(req.params.id);
    const row = await queryOne(
      `update profiles set ${sets.join(', ')} where id = $${vals.length}
       returning id, full_name, email, role, unit_id, is_active`,
      vals
    );
    if (!row) throw new ApiError(404, 'User not found');
    res.json({ data: row });
  })
);

const pwdSchema = z.object({ password: z.string().min(6) });

/** POST /api/admin/users/:id/reset-password */
router.post(
  '/users/:id/reset-password',
  asyncHandler(async (req, res) => {
    const parsed = pwdSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const hash = await hashPassword(parsed.data.password);
    const row = await queryOne(
      'update profiles set password_hash = $1 where id = $2 returning id',
      [hash, req.params.id]
    );
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
    const { rows } = await query(
      `select id, code, name, doc_prefix, color, sort_order, is_active
         from projects order by sort_order, code`
    );
    res.json({ data: rows });
  })
);

router.post(
  '/projects',
  asyncHandler(async (req, res) => {
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const { code, name, docPrefix, color, sortOrder } = parsed.data;
    const dup = await queryOne('select id from projects where lower(code) = lower($1)', [code]);
    if (dup) throw new ApiError(409, 'รหัสโครงการนี้มีอยู่แล้ว');
    const row = await queryOne(
      `insert into projects (code, name, doc_prefix, color, sort_order)
       values ($1,$2,$3,$4,coalesce($5,0))
       returning id, code, name, doc_prefix, color, sort_order, is_active`,
      [code, name, docPrefix, color || null, sortOrder]
    );
    res.status(201).json({ data: row });
  })
);

router.patch(
  '/projects/:id',
  asyncHandler(async (req, res) => {
    const parsed = projectSchema.partial().safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const f = parsed.data;
    const map = { code: 'code', name: 'name', docPrefix: 'doc_prefix', color: 'color', sortOrder: 'sort_order', isActive: 'is_active' };
    const sets = []; const vals = [];
    for (const [k, col] of Object.entries(map)) {
      if (f[k] !== undefined) { vals.push(f[k]); sets.push(`${col} = $${vals.length}`); }
    }
    if (!sets.length) throw new ApiError(400, 'No fields to update');
    vals.push(req.params.id);
    const row = await queryOne(
      `update projects set ${sets.join(', ')} where id = $${vals.length}
       returning id, code, name, doc_prefix, color, sort_order, is_active`,
      vals
    );
    if (!row) throw new ApiError(404, 'Project not found');
    res.json({ data: row });
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
    const { rows } = await query('select id, name, sort_order from document_types order by sort_order, name');
    res.json({ data: rows });
  })
);

router.post(
  '/document-types',
  asyncHandler(async (req, res) => {
    const parsed = docTypeSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const dup = await queryOne('select id from document_types where name = $1', [parsed.data.name]);
    if (dup) throw new ApiError(409, 'ประเภทเอกสารนี้มีอยู่แล้ว');
    const row = await queryOne(
      `insert into document_types (name, sort_order) values ($1, coalesce($2,0))
       returning id, name, sort_order`,
      [parsed.data.name, parsed.data.sortOrder]
    );
    res.status(201).json({ data: row });
  })
);

router.patch(
  '/document-types/:id',
  asyncHandler(async (req, res) => {
    const parsed = docTypeSchema.partial().safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const f = parsed.data;
    const sets = []; const vals = [];
    if (f.name !== undefined) { vals.push(f.name); sets.push(`name = $${vals.length}`); }
    if (f.sortOrder !== undefined) { vals.push(f.sortOrder); sets.push(`sort_order = $${vals.length}`); }
    if (!sets.length) throw new ApiError(400, 'No fields to update');
    vals.push(req.params.id);
    const row = await queryOne(
      `update document_types set ${sets.join(', ')} where id = $${vals.length} returning id, name, sort_order`,
      vals
    );
    if (!row) throw new ApiError(404, 'Type not found');
    res.json({ data: row });
  })
);

router.delete(
  '/document-types/:id',
  asyncHandler(async (req, res) => {
    await query('delete from document_types where id = $1', [req.params.id]);
    res.json({ data: { deleted: true } });
  })
);

// ===========================================================================
// Config: Project letterhead (1:1 with a project)
// ===========================================================================

/** GET /api/admin/projects/:id/letterhead */
router.get(
  '/projects/:id/letterhead',
  asyncHandler(async (req, res) => {
    const row = await queryOne('select * from project_letterhead where project_id = $1', [req.params.id]);
    res.json({ data: row || null });
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

/** PUT /api/admin/projects/:id/letterhead — upsert. */
router.put(
  '/projects/:id/letterhead',
  asyncHandler(async (req, res) => {
    const parsed = letterheadSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const f = parsed.data;
    const row = await queryOne(
      `insert into project_letterhead
         (project_id, company_name, company_name_en, address, logo_url,
          phone, telex, fax, signatory_name, signatory_title, signature_url,
          closing_line, default_recipient)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       on conflict (project_id) do update set
         company_name = excluded.company_name,
         company_name_en = excluded.company_name_en,
         address = excluded.address,
         logo_url = excluded.logo_url,
         phone = excluded.phone,
         telex = excluded.telex,
         fax = excluded.fax,
         signatory_name = excluded.signatory_name,
         signatory_title = excluded.signatory_title,
         signature_url = excluded.signature_url,
         closing_line = excluded.closing_line,
         default_recipient = excluded.default_recipient,
         updated_at = now()
       returning *`,
      [
        req.params.id, f.companyName || null, f.companyNameEn || null, f.address || null, f.logoUrl || null,
        f.phone || null, f.telex || null, f.fax || null,
        f.signatoryName || null, f.signatoryTitle || null, f.signatureUrl || null,
        f.closingLine || null, f.defaultRecipient || null,
      ]
    );
    res.json({ data: row });
  })
);

// ===========================================================================
// Doc-code → default approvers config (locks the approver chain per code).
// ===========================================================================

/** GET /api/admin/doc-codes — codes with their default approver chains. */
router.get(
  '/doc-codes',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `select code, department, recipient_title, default_approvers
         from doc_code_departments order by code`
    );
    res.json({ data: rows });
  })
);

const approversSchema = z.object({
  approvers: z.array(z.object({
    name: z.string().optional(),
    email: z.string().email(),
  })),
});

/** PUT /api/admin/doc-codes/:code/approvers — set the default approver chain. */
router.put(
  '/doc-codes/:code/approvers',
  asyncHandler(async (req, res) => {
    const parsed = approversSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const cleaned = parsed.data.approvers.map((a) => ({ name: a.name?.trim() || undefined, email: a.email.trim() }));
    const row = await queryOne(
      `update doc_code_departments set default_approvers = $2::jsonb
        where code = $1
        returning code, department, recipient_title, default_approvers`,
      [req.params.code, JSON.stringify(cleaned)]
    );
    if (!row) throw new ApiError(404, 'Doc code not found');
    res.json({ data: row });
  })
);

export default router;
