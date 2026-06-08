import { Router } from 'express';
import { z } from 'zod';
import { Profile } from '../models/index.js';
import { profileOut } from '../utils/serialize.js';
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
 * Verifies email + password (bcrypt) against the profiles collection and
 * returns a signed JWT. Email match is case-insensitive (collation).
 */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    }
    const { email, password } = parsed.data;

    const profile = await Profile.findOne({ email })
      .collation({ locale: 'en', strength: 2 })
      .lean();

    // Same error whether the email is unknown or the password is wrong.
    if (!profile || !profile.passwordHash) {
      throw new ApiError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }
    const ok = await verifyPassword(password, profile.passwordHash);
    if (!ok) throw new ApiError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');

    if (!profile.isActive) {
      throw new ApiError(403, 'บัญชีนี้ยังไม่ได้เปิดใช้งาน');
    }

    const out = profileOut(profile);
    const token = signToken(out.id);
    res.json({
      user: { id: out.id, email: out.email },
      profile: {
        id: out.id,
        full_name: out.full_name,
        email: out.email,
        role: out.role,
        unit_id: out.unit_id,
        is_active: out.is_active,
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
