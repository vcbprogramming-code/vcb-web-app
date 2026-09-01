// Access control. This is where the old Row Level Security policies now live.
//
// Every route that touches non-public data must go through requireAuth, and
// then through a role guard. Forgetting one does not fail loudly — it just
// silently publishes that data — so the rule is: no route without a guard,
// and public routes say so explicitly with `allowAnonymous`.

import { verifyToken } from '../auth.js';

/** 401 unless the request carries a valid token. Populates req.user. */
export function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'AUTH_INVALID' });

  req.user = {
    email: payload.sub,
    name: payload.name || '',
    roles: payload.roles || {},
  };
  next();
}

/**
 * Reads the token when present but never rejects. For endpoints that show more
 * to a signed-in person than to a visitor — Meeting Minutes' public projects,
 * the SOP document, the portal's app list.
 */
export function allowAnonymous(req, _res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  req.user = payload
    ? { email: payload.sub, name: payload.name || '', roles: payload.roles || {} }
    : null;
  next();
}

/**
 * Require a role within one module.
 *
 *   requireRole('minutes', 'editor', 'admin')
 *
 * Use after requireAuth.
 */
export function requireRole(module, ...allowed) {
  return (req, res, next) => {
    const role = req.user?.roles?.[module] ?? null;
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ error: 'FORBIDDEN', module, need: allowed });
    }
    next();
  };
}

/**
 * HR's "within site" policies.
 *
 * Admins pass for any site. Everyone else must be asking about a site they
 * belong to. The site is read from wherever the route puts it — params, query
 * or body — because the HR routes vary.
 *
 * req.user.hrSites is filled by the sign-in flow; if it is missing we refuse
 * rather than assume, because assuming here means leaking another site's data.
 */
export function requireHrSite(getSiteKey = (req) => req.params.siteKey) {
  return (req, res, next) => {
    const role = req.user?.roles?.hr ?? null;
    if (!role) return res.status(403).json({ error: 'FORBIDDEN', module: 'hr' });
    if (role === 'admin') return next();

    const siteKey = getSiteKey(req);
    if (!siteKey) return res.status(400).json({ error: 'SITE_REQUIRED' });

    const mine = req.user?.hrSites;
    if (!Array.isArray(mine)) {
      return res.status(403).json({ error: 'SITE_SCOPE_UNKNOWN' });
    }
    if (!mine.includes(siteKey)) {
      return res.status(403).json({ error: 'FORBIDDEN_SITE', siteKey });
    }
    next();
  };
}

/** Convenience: any signed-in user, no particular role. */
export function requireAnyRole(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  next();
}
