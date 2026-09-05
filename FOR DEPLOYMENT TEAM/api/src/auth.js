// Identity: issuing and verifying tokens, and resolving what a person may do.
//
// Read this before touching any route.
//
// The Apps Script apps got identity free: Session.getActiveUser().getEmail() is
// supplied by Google inside their iframe and cannot be spoofed, so a server-side
// allowlist was enough. That is gone. Here the browser sends a JWT that WE
// issued, so:
//
//   - Anything the React app decides about roles is a UI hint. It hides menus.
//     It is not security, because anyone can call this API directly with curl.
//   - This file plus the middleware are the only real gate. A route without
//     requireAuth is public to the entire internet.
//
// The old schemas enforced access with Postgres Row Level Security, which worked
// because the browser talked to Supabase directly. It no longer does — the API
// connects as one database user, so RLS sees the same principal for every
// request and cannot distinguish callers. Those 45 policies are reproduced here
// and in middleware/, not in SQL.

import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { one, rows } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_TTL = process.env.JWT_TTL || '12h';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const BCRYPT_ROUNDS = 12;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  // Fail at boot, loudly. A short or missing secret means every token this
  // process issues is forgeable, and that failure is silent at runtime.
  throw new Error(
    'JWT_SECRET must be set to at least 32 characters. Generate one with: ' +
      "node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\""
  );
}

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

/* --------------------------------- passwords ------------------------------ */

export function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain, hash) {
  if (!hash) {
    // No password on file. Still run a comparison so that "user does not exist"
    // and "wrong password" take the same time — otherwise the response time
    // tells an attacker which emails are real.
    return bcrypt.compare(plain, '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
  }
  return bcrypt.compare(plain, hash);
}

/* ----------------------------------- JWT ---------------------------------- */

/**
 * Issue a token. Keep the payload small and non-secret: it is base64, not
 * encrypted, and the browser can read every field.
 */
export function issueToken(user) {
  return jwt.sign(
    {
      sub: user.email,
      name: user.name || '',
      roles: user.roles || {},
      // requireHrSite() reads this to decide which sites a non-admin may see.
      // It was computed at sign-in and returned in the response body but never
      // signed into the token, so it arrived at the guard as undefined and
      // every non-admin got 403 SITE_SCOPE_UNKNOWN — or worse, an empty site
      // list from /bootstrap, which reads as "you belong to no sites" rather
      // than as a bug.
      hrSites: user.hrSites || [],
    },
    JWT_SECRET,
    { expiresIn: JWT_TTL, issuer: 'vcb-connect' }
  );
}

/** Verify a token. Returns the payload, or null if it is invalid or expired. */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, { issuer: 'vcb-connect' });
  } catch {
    return null;
  }
}

/* ------------------------------ Google Sign-In ---------------------------- */

/**
 * Verify a Google ID token from the browser and return the verified email.
 *
 * Verifying it here rather than trusting an email the client posts is the whole
 * point: the signature proves Google issued it for our client id.
 */
export async function verifyGoogleIdToken(idToken) {
  if (!googleClient) throw new Error('GOOGLE_CLIENT_ID is not configured');
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email) throw new Error('Google token carried no email');
  if (!payload.email_verified) throw new Error('Google email is not verified');
  return { email: payload.email.toLowerCase(), name: payload.name || '' };
}

/* ---------------------------------- roles --------------------------------- */

/**
 * Resolve every role a person holds, across all modules, in one pass.
 *
 * The modules each kept their own allowlist table and there is no single "users"
 * table that covers them, so this reads all of them. It is one round trip per
 * sign-in, not per request — the result is baked into the JWT.
 *
 * Shape:
 *   {
 *     hr:        'admin' | 'manager' | 'staff' | null,
 *     credit:    'manager' | null,
 *     minutes:   'admin' | 'editor' | null,
 *     sop:       'editor' | null,
 *     portal:    'admin' | null,
 *   }
 */
export async function resolveRoles(email) {
  const e = String(email || '').toLowerCase();
  if (!e) return {};

  const [hr, credit, mAdmin, mEditor, sop, portal] = await Promise.all([
    one('select role from hr.users where lower(email) = $1', [e]),
    one('select 1 from credit.managers where lower(email) = $1', [e]),
    one('select 1 from minutes.admins where lower(email) = $1', [e]),
    one('select 1 from minutes.editors where lower(email) = $1', [e]),
    one('select 1 from sop.sop_editors where lower(email) = $1', [e]),
    one('select 1 from portal.portal_admins where lower(email) = $1', [e]),
  ]);

  return {
    hr: hr?.role || null,
    credit: credit ? 'manager' : null,
    // An admin is also an editor everywhere it matters; collapse it here so
    // routes can ask a single question instead of two.
    minutes: mAdmin ? 'admin' : mEditor ? 'editor' : null,
    sop: sop ? 'editor' : null,
    portal: portal ? 'admin' : null,
  };
}

/**
 * Which HR sites may this person see?
 *
 * Replaces the "within site" RLS policies. An HR admin sees everything; anyone
 * else sees only the site their employee record sits in.
 */
export async function hrSitesFor(email, hrRole) {
  if (hrRole === 'admin') {
    const all = await rows('select site_key from hr.sites');
    return all.map((r) => r.site_key);
  }
  const mine = await rows('select site_key from hr.employees where lower(email) = $1', [
    String(email || '').toLowerCase(),
  ]);
  return [...new Set(mine.map((r) => r.site_key).filter(Boolean))];
}

/* --------------------------------- helpers -------------------------------- */

/** Random token for one-off links (document verification, invites). */
export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export default {
  hashPassword,
  verifyPassword,
  issueToken,
  verifyToken,
  verifyGoogleIdToken,
  resolveRoles,
  hrSitesFor,
  randomToken,
};
