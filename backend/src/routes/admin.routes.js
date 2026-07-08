import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import multer from 'multer';
import { pool, query, queryOne } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { hashPassword } from '../utils/auth.js';
import { PERMISSION_CATALOG, effectivePermissions } from '../config/permissions.js';
import { putObject } from '../config/storage.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });

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
              p.login_method, p.created_at, u.name as unit_name
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
  // password only matters for email accounts; optional (email login is passwordless)
  password: z.string().min(6).optional(),
  role: z.enum(ROLES),
  unitId: z.string().uuid().optional().nullable(),
  loginMethod: z.enum(['email', 'google']).optional(),
});

/** POST /api/admin/users — create a login account. */
router.post(
  '/users',
  asyncHandler(async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const { fullName, email, password, role, unitId, loginMethod = 'email' } = parsed.data;

    // email accounts must have a password (standard email+password login);
    // google accounts don't (they authenticate via Google).
    if (loginMethod === 'email' && !password) {
      throw new ApiError(400, 'บัญชีแบบอีเมลต้องตั้งรหัสผ่าน');
    }

    const existing = await queryOne('select id from profiles where lower(email) = lower($1)', [email]);
    if (existing) throw new ApiError(409, 'อีเมลนี้ถูกใช้งานแล้ว');

    const hash = password ? await hashPassword(password) : null;
    const row = await queryOne(
      `insert into profiles (full_name, email, password_hash, role, unit_id, is_active, login_method)
       values ($1,$2,$3,$4,$5,true,$6)
       returning id, full_name, email, role, unit_id, is_active, login_method`,
      [fullName, email, hash, role, unitId || null, loginMethod]
    );
    res.status(201).json({ data: row });
  })
);

const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(ROLES).optional(),
  unitId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  loginMethod: z.enum(['email', 'google']).optional(),
});

/** PATCH /api/admin/users/:id — update name/email/role/unit/active/login-method. */
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

    // changing the email: make sure it isn't already used by ANOTHER account
    if (f.email !== undefined) {
      const dup = await queryOne('select id from profiles where lower(email) = lower($1) and id <> $2', [f.email, req.params.id]);
      if (dup) throw new ApiError(409, 'อีเมลนี้ถูกใช้งานแล้ว');
    }

    const sets = [];
    const vals = [];
    const add = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
    if (f.fullName !== undefined) add('full_name', f.fullName);
    if (f.email !== undefined) add('email', f.email);
    if (f.role !== undefined) add('role', f.role);
    if (f.unitId !== undefined) add('unit_id', f.unitId);
    if (f.isActive !== undefined) add('is_active', f.isActive);
    if (f.loginMethod !== undefined) add('login_method', f.loginMethod);
    if (!sets.length) throw new ApiError(400, 'No fields to update');

    vals.push(req.params.id);
    const row = await queryOne(
      `update profiles set ${sets.join(', ')} where id = $${vals.length}
       returning id, full_name, email, role, unit_id, is_active, login_method`,
      vals
    );
    if (!row) throw new ApiError(404, 'User not found');
    res.json({ data: row });
  })
);

/** DELETE /api/admin/users/:id — remove a login account.
 *  FK refs elsewhere are ON DELETE SET NULL, so documents/approvals keep their
 *  data (just lose the user link). An admin cannot delete their own account. */
router.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    if (req.params.id === req.profile.id) {
      throw new ApiError(400, 'ไม่สามารถลบบัญชีของตนเองได้');
    }
    const row = await queryOne('delete from profiles where id = $1 returning id', [req.params.id]);
    if (!row) throw new ApiError(404, 'User not found');
    res.json({ data: { deleted: true } });
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
// Permissions (action-level, backlog round 2 #3)
// ===========================================================================

/** GET /api/admin/permissions/catalog — the module/action catalogue for the UI. */
router.get(
  '/permissions/catalog',
  asyncHandler(async (req, res) => {
    res.json({ data: PERMISSION_CATALOG });
  })
);

/** GET /api/admin/users/:id/permissions — a user's raw overrides + effective map. */
router.get(
  '/users/:id/permissions',
  asyncHandler(async (req, res) => {
    const row = await queryOne(
      'select id, role, permissions from profiles where id = $1',
      [req.params.id]
    );
    if (!row) throw new ApiError(404, 'User not found');
    res.json({
      data: {
        role: row.role,
        overrides: row.permissions || {},
        effective: effectivePermissions(row),
      },
    });
  })
);

// permission override map: { module: { action: boolean } }
const permissionsSchema = z.object({
  permissions: z.record(z.string(), z.record(z.string(), z.boolean())),
});

/** PUT /api/admin/users/:id/permissions — replace a user's override map. */
router.put(
  '/users/:id/permissions',
  asyncHandler(async (req, res) => {
    const parsed = permissionsSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const row = await queryOne(
      `update profiles set permissions = $2::jsonb where id = $1
        returning id, role, permissions`,
      [req.params.id, JSON.stringify(parsed.data.permissions)]
    );
    if (!row) throw new ApiError(404, 'User not found');
    res.json({ data: { overrides: row.permissions, effective: effectivePermissions(row) } });
  })
);

// ── per-user document visibility (#8) ────────────────────────────────────────

/** GET /api/admin/users/:id/visibility — the user's allowed projects + codes. */
router.get(
  '/users/:id/visibility',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      'select scope_type, scope_value from document_visibility where profile_id = $1',
      [req.params.id]
    );
    res.json({
      data: {
        projectIds: rows.filter((r) => r.scope_type === 'project').map((r) => r.scope_value),
        docCodes: rows.filter((r) => r.scope_type === 'doc_code').map((r) => r.scope_value),
      },
    });
  })
);

const visibilitySchema = z.object({
  projectIds: z.array(z.string().uuid()).default([]),
  docCodes: z.array(z.string()).default([]),
});

/** PUT /api/admin/users/:id/visibility — replace the user's visibility scopes.
 *  Empty arrays = no restriction (the user sees everything). */
router.put(
  '/users/:id/visibility',
  asyncHandler(async (req, res) => {
    const parsed = visibilitySchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const user = await queryOne('select id from profiles where id = $1', [req.params.id]);
    if (!user) throw new ApiError(404, 'User not found');
    const { projectIds, docCodes } = parsed.data;
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('delete from document_visibility where profile_id = $1', [req.params.id]);
      for (const pid of projectIds) {
        await client.query(
          `insert into document_visibility (profile_id, scope_type, scope_value)
           values ($1,'project',$2) on conflict do nothing`, [req.params.id, pid]);
      }
      for (const code of docCodes) {
        await client.query(
          `insert into document_visibility (profile_id, scope_type, scope_value)
           values ($1,'doc_code',$2) on conflict do nothing`, [req.params.id, code]);
      }
      await client.query('commit');
    } catch (e) { await client.query('rollback'); throw e; } finally { client.release(); }
    res.json({ data: { projectIds, docCodes } });
  })
);

// ===========================================================================
// Config: Companies (บริษัท / ตรา) — selectable letterhead identity
// ===========================================================================

/** GET /api/admin/companies — all companies (default first). */
router.get(
  '/companies',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `select id, name, name_en, address, phone, telex, fax, logo_url, is_default, is_active, sort_order
         from companies order by is_default desc, sort_order, name`
    );
    res.json({ data: rows });
  })
);

const companySchema = z.object({
  name: z.string().trim().min(1),
  nameEn: z.string().trim().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  telex: z.string().optional().nullable(),
  fax: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

/** POST /api/admin/companies/logo — upload a logo image, returns { key }. */
router.post(
  '/companies/logo',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, 'No file uploaded (field "file")');
    if (!String(req.file.mimetype || '').startsWith('image/')) {
      throw new ApiError(400, 'โลโก้ต้องเป็นไฟล์รูปภาพ');
    }
    const key = `companies/logo/${crypto.randomUUID()}`;
    await putObject(key, req.file.buffer, req.file.mimetype);
    res.status(201).json({ data: { key } });
  })
);

/** POST /api/admin/companies — create a company. */
router.post(
  '/companies',
  asyncHandler(async (req, res) => {
    const parsed = companySchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const f = parsed.data;
    const client = await pool.connect();
    try {
      await client.query('begin');
      if (f.isDefault) await client.query('update companies set is_default = false where is_default = true');
      const { rows } = await client.query(
        `insert into companies (name, name_en, address, phone, telex, fax, logo_url, is_default, sort_order)
         values ($1,$2,$3,$4,$5,$6,$7,coalesce($8,false),coalesce($9,0))
         returning *`,
        [f.name, f.nameEn || null, f.address || null, f.phone || null, f.telex || null, f.fax || null,
         f.logoUrl || null, f.isDefault || false, f.sortOrder]
      );
      await client.query('commit');
      res.status(201).json({ data: rows[0] });
    } catch (e) { await client.query('rollback'); throw e; } finally { client.release(); }
  })
);

/** PATCH /api/admin/companies/:id — update. */
router.patch(
  '/companies/:id',
  asyncHandler(async (req, res) => {
    const parsed = companySchema.partial().safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const f = parsed.data;
    const map = { name: 'name', nameEn: 'name_en', address: 'address', phone: 'phone', telex: 'telex', fax: 'fax', logoUrl: 'logo_url', isDefault: 'is_default', isActive: 'is_active', sortOrder: 'sort_order' };
    const client = await pool.connect();
    try {
      await client.query('begin');
      if (f.isDefault === true) await client.query('update companies set is_default = false where is_default = true and id <> $1', [req.params.id]);
      const sets = []; const vals = [];
      for (const [k, col] of Object.entries(map)) {
        if (f[k] !== undefined) { vals.push(f[k]); sets.push(`${col} = $${vals.length}`); }
      }
      if (!sets.length) { await client.query('rollback'); throw new ApiError(400, 'No fields to update'); }
      vals.push(req.params.id);
      const { rows } = await client.query(`update companies set ${sets.join(', ')} where id = $${vals.length} returning *`, vals);
      if (!rows[0]) { await client.query('rollback'); throw new ApiError(404, 'Company not found'); }
      await client.query('commit');
      res.json({ data: rows[0] });
    } catch (e) { if (!(e instanceof ApiError)) await client.query('rollback').catch(() => {}); throw e; } finally { client.release(); }
  })
);

/** DELETE /api/admin/companies/:id — remove (blocked if it's the default or in use). */
router.delete(
  '/companies/:id',
  asyncHandler(async (req, res) => {
    const c = await queryOne('select is_default from companies where id = $1', [req.params.id]);
    if (!c) throw new ApiError(404, 'Company not found');
    if (c.is_default) throw new ApiError(409, 'ลบบริษัทหลัก (ค่าเริ่มต้น) ไม่ได้ — ตั้งบริษัทอื่นเป็นค่าเริ่มต้นก่อน');
    const used = await queryOne('select count(*)::int as n from documents where company_id = $1', [req.params.id]);
    if (used && used.n > 0) throw new ApiError(409, `ลบไม่ได้ — มีเอกสาร ${used.n} ฉบับใช้บริษัทนี้อยู่`);
    await query('delete from companies where id = $1', [req.params.id]);
    res.json({ data: { deleted: true } });
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
      `select p.id, p.code, p.name, p.doc_prefix, p.color, p.sort_order, p.is_active,
              lh.signatory_name, lh.signatory_title, lh.company_name,
              lh.signature_url is not null as has_signature
         from projects p
         left join project_letterhead lh on lh.project_id = p.id
        order by p.sort_order, p.code`
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

/** POST /api/admin/projects/:id/signature — upload the signatory's signature
 *  image (#6). Returns { key }; the caller then saves it via the letterhead PUT.
 *  Stored per project so every memo of that project auto-stamps this signature. */
router.post(
  '/projects/:id/signature',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, 'No file uploaded (field "file")');
    if (!String(req.file.mimetype || '').startsWith('image/')) {
      throw new ApiError(400, 'ลายเซ็นต้องเป็นไฟล์รูปภาพ');
    }
    const key = `projects/${req.params.id}/signature/${crypto.randomUUID()}`;
    await putObject(key, req.file.buffer, req.file.mimetype);
    res.status(201).json({ data: { key } });
  })
);

const letterheadSchema = z.object({
  companyName: z.string().optional(),
  companyNameEn: z.string().optional(),
  address: z.string().optional(),
  logoUrl: z.string().optional(),
  // the form's "— use system default —" option sends '' — coerce it to null so the
  // whole save doesn't 400 (which would also discard a just-uploaded signature).
  companyId: z.preprocess((v) => (v === '' ? null : v), z.string().uuid().nullable().optional()),
  phone: z.string().optional(),
  telex: z.string().optional(),
  fax: z.string().optional(),
  signatoryName: z.string().optional(),
  signatoryTitle: z.string().optional(),
  signatureUrl: z.string().optional().nullable(),
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
         (project_id, company_name, company_name_en, address, logo_url, company_id,
          phone, telex, fax, signatory_name, signatory_title, signature_url,
          closing_line, default_recipient)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       on conflict (project_id) do update set
         company_name = excluded.company_name,
         company_name_en = excluded.company_name_en,
         address = excluded.address,
         logo_url = excluded.logo_url,
         company_id = excluded.company_id,
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
        f.companyId || null,
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

const docCodeSchema = z.object({
  code: z.string().trim().min(1).max(20),
  department: z.string().trim().min(1),
  recipientTitle: z.string().trim().optional(),
});
const docCodeEditSchema = z.object({
  department: z.string().trim().min(1),
  recipientTitle: z.string().trim().optional(),
});

/** POST /api/admin/doc-codes — add a new document code. */
router.post(
  '/doc-codes',
  asyncHandler(async (req, res) => {
    const parsed = docCodeSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const code = parsed.data.code.toUpperCase();
    const dup = await queryOne('select code from doc_code_departments where upper(code) = $1', [code]);
    if (dup) throw new ApiError(409, `รหัสเอกสาร "${code}" มีอยู่แล้ว`);
    const row = await queryOne(
      `insert into doc_code_departments (code, department, recipient_title, default_approvers)
       values ($1, $2, $3, '[]'::jsonb)
       returning code, department, recipient_title, default_approvers`,
      [code, parsed.data.department, parsed.data.recipientTitle || null]
    );
    res.status(201).json({ data: row });
  })
);

/** PUT /api/admin/doc-codes/:code — edit a code's department / recipient title. */
router.put(
  '/doc-codes/:code',
  asyncHandler(async (req, res) => {
    const parsed = docCodeEditSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const row = await queryOne(
      `update doc_code_departments set department = $2, recipient_title = $3
        where code = $1
        returning code, department, recipient_title, default_approvers`,
      [req.params.code, parsed.data.department, parsed.data.recipientTitle || null]
    );
    if (!row) throw new ApiError(404, 'Doc code not found');
    res.json({ data: row });
  })
);

/** DELETE /api/admin/doc-codes/:code — remove a code (blocked if documents use it). */
router.delete(
  '/doc-codes/:code',
  asyncHandler(async (req, res) => {
    const used = await queryOne('select count(*)::int as n from documents where doc_code = $1', [req.params.code]);
    if (used && used.n > 0) {
      throw new ApiError(409, `ลบไม่ได้ — มีเอกสาร ${used.n} ฉบับใช้รหัสนี้อยู่`);
    }
    const row = await queryOne('delete from doc_code_departments where code = $1 returning code', [req.params.code]);
    if (!row) throw new ApiError(404, 'Doc code not found');
    res.json({ data: { code: row.code } });
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
