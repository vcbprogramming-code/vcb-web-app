import { Router } from 'express';
import { z } from 'zod';
import { queryOne } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { verifyPassword, signToken, tokenExpiresAt } from '../utils/auth.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

/**
 * POST /api/auth/login
 * Verifies email + password (bcrypt) against the profiles table and returns
 * a signed JWT. The frontend stores the access token and sends it as a Bearer.
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
      `select id, full_name, email, role, unit_id, is_active, password_hash
         from profiles where lower(email) = lower($1)`,
      [email]
    );

    // Same error whether the email is unknown or the password is wrong.
    if (!profile || !profile.password_hash) {
      throw new ApiError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }
    const ok = await verifyPassword(password, profile.password_hash);
    if (!ok) throw new ApiError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');

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
    res.json({ user: req.auth, profile: req.profile });
  })
);

export default router;
