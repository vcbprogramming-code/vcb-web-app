import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

/**
 * POST /api/auth/login
 * Verifies credentials with Supabase and returns the session + profile.
 * The frontend stores the access token and sends it as a Bearer header.
 */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    }

    const { data, error } = await supabaseAdmin.auth.signInWithPassword(parsed.data);
    if (error || !data?.session) {
      throw new ApiError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, unit_id, is_active')
      .eq('id', data.user.id)
      .single();

    if (!profile || !profile.is_active) {
      throw new ApiError(403, 'บัญชีนี้ยังไม่ได้เปิดใช้งาน');
    }

    res.json({
      user: { id: data.user.id, email: data.user.email },
      profile,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
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
