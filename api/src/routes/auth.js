// Sign-in. Two ways in: Google, or email + password.

import { Router } from 'express';
import { z } from 'zod';
import { one } from '../db.js';
import {
  issueToken,
  verifyPassword,
  verifyGoogleIdToken,
  resolveRoles,
  hrSitesFor,
} from '../auth.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/error.js';

const router = Router();

const googleSchema = z.object({ idToken: z.string().min(1) });
const passwordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Build the token payload for a verified identity.
 *
 * hrSites goes in the token so the per-site guard does not need a database
 * round trip on every request. It is a snapshot: someone moved between sites
 * keeps their old scope until the token expires (12h default). That is an
 * accepted trade — sites change rarely, and requests are constant.
 */
async function sessionFor(email, name) {
  const roles = await resolveRoles(email);
  const hrSites = roles.hr ? await hrSitesFor(email, roles.hr) : [];
  const token = issueToken({ email, name, roles });
  return { token, user: { email, name, roles, hrSites } };
}

router.post(
  '/google',
  asyncRoute(async (req, res) => {
    const { idToken } = googleSchema.parse(req.body);
    const { email, name } = await verifyGoogleIdToken(idToken);
    res.json(await sessionFor(email, name));
  })
);

router.post(
  '/login',
  asyncRoute(async (req, res) => {
    const { email, password } = passwordSchema.parse(req.body);
    const lower = email.toLowerCase();

    const user = await one(
      'select email, name, password_hash from hr.users where lower(email) = $1',
      [lower]
    );

    // Run the comparison even when there is no user, so the timing does not
    // reveal which addresses exist. verifyPassword handles a null hash.
    const ok = await verifyPassword(password, user?.password_hash);
    if (!user || !ok) return res.status(401).json({ error: 'BAD_CREDENTIALS' });

    res.json(await sessionFor(user.email, user.name || ''));
  })
);

/** Who am I? Re-reads roles from the database rather than trusting the token. */
router.get(
  '/me',
  requireAuth,
  asyncRoute(async (req, res) => {
    const roles = await resolveRoles(req.user.email);
    const hrSites = roles.hr ? await hrSitesFor(req.user.email, roles.hr) : [];
    res.json({ user: { email: req.user.email, name: req.user.name, roles, hrSites } });
  })
);

export default router;
