import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from './errorHandler.js';

/**
 * Verifies the Bearer token via Supabase, then loads the user's profile
 * (role + business unit) so downstream handlers can authorize per-unit access.
 * Attaches { auth, profile, accessToken } to req.
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new ApiError(401, 'Missing access token');

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) throw new ApiError(401, 'Invalid or expired token');

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, unit_id, is_active')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiError(403, 'No profile found for this account');
    }
    if (!profile.is_active) {
      throw new ApiError(403, 'Account is disabled');
    }

    req.auth = { id: data.user.id, email: data.user.email };
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
