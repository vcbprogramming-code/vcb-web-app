import { query, queryOne } from '../config/db.js';
import { verifyToken } from '../utils/auth.js';
import { ApiError } from './errorHandler.js';
import { hasPermission } from '../config/permissions.js';

/**
 * Verifies our own JWT Bearer token, then loads the user's profile
 * (role + business unit(s)) so downstream handlers can authorize per-unit access.
 * Attaches { auth, profile, accessToken } to req. profile.unit_ids is the full
 * in-scope set (for HR users covering several units).
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new ApiError(401, 'Missing access token');

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new ApiError(401, 'Invalid or expired token');
    }

    const profile = await queryOne(
      `select id, full_name, email, role, unit_id, is_active, permissions, password_changed_at
         from profiles where id = $1`,
      [payload.sub]
    );
    // These are session-level failures (the token no longer maps to a usable
    // account), so return 401 — the client treats 401 as "log out & re-login",
    // whereas 403 is reserved for "authenticated but not allowed".
    if (!profile) throw new ApiError(401, 'บัญชีนี้ไม่พบในระบบ กรุณาเข้าสู่ระบบใหม่');
    if (!profile.is_active) throw new ApiError(401, 'บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ');

    // Session revocation: reject tokens issued before the last password change,
    // so an admin password reset immediately invalidates existing tokens.
    // Second-granularity compare (iat is in seconds) avoids a same-second false reject.
    if (profile.password_changed_at && payload.iat) {
      const changedSec = Math.floor(new Date(profile.password_changed_at).getTime() / 1000);
      if (payload.iat < changedSec) throw new ApiError(401, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    }

    const { rows: units } = await query(
      'select unit_id from profile_units where profile_id = $1',
      [profile.id]
    );
    profile.unit_ids = units.map((u) => u.unit_id);

    req.auth = { id: profile.id, email: profile.email };
    req.profile = profile;
    req.accessToken = token;
    next();
  } catch (err) {
    next(err);
  }
}

/** Restricts a route to one or more roles. Use after requireAuth. */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.profile) return next(new ApiError(401, 'Not authenticated'));
    if (!roles.includes(req.profile.role)) {
      return next(new ApiError(403, 'Insufficient permissions'));
    }
    next();
  };
}

/**
 * Restricts a route to callers holding "<module>.<action>" (see config/
 * permissions.js). admin always passes. Use after requireAuth.
 */
export function requirePermission(module, action) {
  return (req, res, next) => {
    if (!req.profile) return next(new ApiError(401, 'Not authenticated'));
    if (!hasPermission(req.profile, module, action)) {
      return next(new ApiError(403, 'ไม่มีสิทธิ์ดำเนินการนี้'));
    }
    next();
  };
}
