import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import multer from 'multer';
import { queryOne } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { verifyPassword, signToken, tokenExpiresAt } from '../utils/auth.js';
import { putObject, openDownloadStream } from '../config/storage.js';
import { effectivePermissions } from '../config/permissions.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });

const loginSchema = z.object({
  email: z.string().email(),
  // passwordless login (client request, round 2 #1): password is optional. When
  // supplied it is still verified (backwards compatible); when omitted, an active
  // account with a known email is enough. Intended for the internal tool only.
  password: z.string().min(1).optional(),
});

/**
 * POST /api/auth/login
 * Looks up the email in profiles and returns a signed JWT. If a password is
 * provided it is verified against the stored bcrypt hash; if omitted, login
 * succeeds for any active account with that email (email-only / passwordless).
 * The frontend stores the access token and sends it as a Bearer.
 */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    }
    const { email, password } = parsed.data;

    const profile = await queryOne(
      `select id, full_name, email, role, unit_id, is_active, password_hash, permissions
         from profiles where lower(email) = lower($1)`,
      [email]
    );

    // Unknown email → generic error (don't reveal which emails exist).
    if (!profile) {
      throw new ApiError(401, 'ไม่พบบัญชีอีเมลนี้');
    }
    // When a password is supplied, it must match (keeps password login working).
    if (password) {
      const ok = profile.password_hash && await verifyPassword(password, profile.password_hash);
      if (!ok) throw new ApiError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    if (!profile.is_active) {
      throw new ApiError(403, 'บัญชีนี้ยังไม่ได้เปิดใช้งาน');
    }

    const token = signToken(profile.id);
    res.json({
      user: { id: profile.id, email: profile.email },
      profile: {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role,
        unit_id: profile.unit_id,
        is_active: profile.is_active,
        effective_permissions: effectivePermissions(profile),
      },
      session: {
        access_token: token,
        expires_at: tokenExpiresAt(),
      },
    });
  })
);

/** GET /api/auth/me — current user + profile (requires Bearer token). */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const profile = await queryOne(
      `select id, full_name, email, role, unit_id, is_active, job_title, signature_url, permissions
         from profiles where id = $1`,
      [req.profile.id]
    );
    // resolved permission map for the frontend to gate UI (admin = all true)
    profile.effective_permissions = effectivePermissions(profile);
    res.json({ user: req.auth, profile });
  })
);

const updateMeSchema = z.object({
  fullName: z.string().min(1).optional(),
  jobTitle: z.string().optional().nullable(),
  signatureUrl: z.string().optional().nullable(),
});

/** PATCH /api/auth/me — update own profile (name, job title, signature). */
router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = updateMeSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const f = parsed.data;
    const sets = [];
    const vals = [];
    const add = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
    if (f.fullName !== undefined) add('full_name', f.fullName);
    if (f.jobTitle !== undefined) add('job_title', f.jobTitle || null);
    if (f.signatureUrl !== undefined) add('signature_url', f.signatureUrl || null);
    if (!sets.length) throw new ApiError(400, 'No fields to update');
    vals.push(req.profile.id);
    const profile = await queryOne(
      `update profiles set ${sets.join(', ')} where id = $${vals.length}
        returning id, full_name, email, role, unit_id, is_active, job_title, signature_url`,
      vals
    );
    res.json({ data: profile });
  })
);

/** GET /api/auth/me/signature — stream the current user's saved signature image. */
router.get(
  '/me/signature',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await queryOne('select signature_url from profiles where id = $1', [req.profile.id]);
    if (!row?.signature_url) throw new ApiError(404, 'ยังไม่มีลายเซ็น');
    const obj = await openDownloadStream(row.signature_url);
    if (!obj) throw new ApiError(404, 'ไม่พบไฟล์ลายเซ็น');
    res.setHeader('Content-Type', obj.contentType || 'image/png');
    obj.stream.on('error', () => res.destroy());
    obj.stream.pipe(res);
  })
);

/** POST /api/auth/me/signature — upload own signature image, returns { key }. */
router.post(
  '/me/signature',
  requireAuth,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, 'No file uploaded (field "file")');
    if (!String(req.file.mimetype || '').startsWith('image/')) {
      throw new ApiError(400, 'ลายเซ็นต้องเป็นรูปภาพ');
    }
    const key = `signatures/profile/${req.profile.id}-${crypto.randomUUID()}`;
    await putObject(key, req.file.buffer, req.file.mimetype);
    res.status(201).json({ data: { key } });
  })
);

export default router;
