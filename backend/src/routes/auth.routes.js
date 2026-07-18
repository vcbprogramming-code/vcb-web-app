import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import multer from 'multer';
import { OAuth2Client } from 'google-auth-library';
import { queryOne } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { verifyPassword, signToken, tokenExpiresAt } from '../utils/auth.js';
import { putObject, openDownloadStream } from '../config/storage.js';
import { effectivePermissions } from '../config/permissions.js';
import { env } from '../config/env.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });

// Google ID-token verifier (lazily constructed; only used when a client id is set).
const googleClient = env.googleClientId ? new OAuth2Client(env.googleClientId) : null;

/** Build the standard login response (JWT + profile + effective permissions). */
function loginResponse(profile) {
  return {
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
      access_token: signToken(profile.id),
      expires_at: tokenExpiresAt(),
    },
  };
}

// ── lightweight in-memory brute-force throttle for login ────────────────────
// Single-instance deployment (Render), so an in-memory map is enough; no extra
// dependency. Keyed by IP + email, generous enough not to bother real users.
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX = 12;
const loginHits = new Map(); // key -> { count, resetAt }

function throttleKey(req) {
  const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'ip').trim();
  const email = (req.body?.email || '').toString().toLowerCase();
  return `${ip}|${email}`;
}
function loginThrottle(req, res, next) {
  const now = Date.now();
  if (loginHits.size > 5000) { // opportunistic cleanup so the map can't grow unbounded
    for (const [k, v] of loginHits) if (v.resetAt < now) loginHits.delete(k);
  }
  const key = throttleKey(req);
  let rec = loginHits.get(key);
  if (!rec || rec.resetAt < now) { rec = { count: 0, resetAt: now + LOGIN_WINDOW_MS }; loginHits.set(key, rec); }
  if (rec.count >= LOGIN_MAX) {
    res.setHeader('Retry-After', String(Math.ceil((rec.resetAt - now) / 1000)));
    return next(new ApiError(429, 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่'));
  }
  rec.count++;
  next();
}
const clearThrottle = (req) => loginHits.delete(throttleKey(req));

const loginSchema = z.object({
  email: z.string().email(),
  // email accounts log in with email + password (standard flow, 2026-07-04).
  password: z.string().min(1),
});

/**
 * POST /api/auth/login
 * Standard email + password login for 'email'-type accounts. Verifies the
 * password against the stored bcrypt hash and returns a signed JWT. 'google'-type
 * accounts are rejected here (they must use Sign in with Google).
 */
router.post(
  '/login',
  loginThrottle,
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    }
    const { email, password } = parsed.data;

    const profile = await queryOne(
      `select id, full_name, email, role, unit_id, is_active, password_hash, permissions, login_method
         from profiles where lower(email) = lower($1)`,
      [email]
    );

    // Same generic error for unknown email OR wrong password (don't leak which).
    if (!profile) {
      throw new ApiError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }
    // google-type accounts must use "Sign in with Google", not the email box.
    if (profile.login_method === 'google') {
      throw new ApiError(403, 'บัญชีนี้ต้องเข้าสู่ระบบด้วย Google เท่านั้น');
    }
    // password is required and must match.
    const ok = profile.password_hash && await verifyPassword(password, profile.password_hash);
    if (!ok) throw new ApiError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');

    if (!profile.is_active) {
      throw new ApiError(403, 'บัญชีนี้ยังไม่ได้เปิดใช้งาน');
    }

    clearThrottle(req); // successful login — reset the attempt counter
    res.json(loginResponse(profile));
  })
);

const googleSchema = z.object({ credential: z.string().min(10) });

/**
 * POST /api/auth/google
 * Verifies a Google ID token (from "Sign in with Google") against our client id,
 * then logs the user in IF their (Google-verified) email exists as an active
 * profile. We never trust the email from the client — only the one Google signed.
 * No new accounts are created here; the admin provisions users.
 */
router.post(
  '/google',
  asyncHandler(async (req, res) => {
    if (!googleClient) {
      throw new ApiError(501, 'ยังไม่ได้ตั้งค่า Google Sign-In (ไม่มี GOOGLE_CLIENT_ID)');
    }
    const parsed = googleSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: parsed.data.credential,
        audience: env.googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new ApiError(401, 'ยืนยัน Google ไม่สำเร็จ');
    }
    if (!payload?.email || !payload.email_verified) {
      throw new ApiError(401, 'บัญชี Google นี้ยังไม่ได้ยืนยันอีเมล');
    }

    const profile = await queryOne(
      `select id, full_name, email, role, unit_id, is_active, permissions, login_method
         from profiles where lower(email) = lower($1)`,
      [payload.email]
    );
    // Only pre-provisioned emails may enter (client chose "เฉพาะอีเมลที่อยู่ในระบบ").
    if (!profile) {
      throw new ApiError(403, `บัญชี ${payload.email} ยังไม่ได้รับสิทธิ์ใช้งานระบบ — โปรดติดต่อผู้ดูแล`);
    }
    // email-type accounts must use the email login, not Google.
    if (profile.login_method === 'email') {
      throw new ApiError(403, 'บัญชีนี้ต้องเข้าสู่ระบบด้วยอีเมล ไม่ใช่ Google');
    }
    if (!profile.is_active) {
      throw new ApiError(403, 'บัญชีนี้ยังไม่ได้เปิดใช้งาน');
    }

    res.json(loginResponse(profile));
  })
);

/** GET /api/auth/config — public auth config for the frontend (Google enabled?). */
router.get(
  '/config',
  asyncHandler(async (req, res) => {
    res.json({ data: { googleEnabled: Boolean(env.googleClientId), googleClientId: env.googleClientId || null } });
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
    if (f.signatureUrl !== undefined) {
      const sig = f.signatureUrl || null;
      // Only accept null (clear) or a key this user uploaded via POST /me/signature.
      // Without this, a caller could store any bucket key (another user's signature,
      // a document PDF) and stream it back through GET /me/signature.
      if (sig !== null && !sig.startsWith(`signatures/profile/${req.profile.id}-`)) {
        throw new ApiError(400, 'ลายเซ็นไม่ถูกต้อง');
      }
      add('signature_url', sig);
    }
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
