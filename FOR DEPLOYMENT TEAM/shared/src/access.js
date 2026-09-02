// Access rights: who may use which app.
//
// Lives in shared because BOTH surfaces call it - the portal settings screen
// (every person, every app) and each app own settings (its own slice, via
// { app }). One client and one shape, so the two screens cannot drift apart
// about what a role means or what an empty role list implies.
//
// Every function takes the module api instance as its first argument:
// createApi() is a factory, not a singleton, and a second instance would get
// neither the token source nor the 401 handling.
//
// NOT ENFORCED YET. api/src/auth.js resolveRoles() still reads the per-module
// tables (hr.users, credit.managers, ...), so a grant made here changes what
// the admin screens show and not yet what anyone can open. Switching
// resolveRoles() over is a separate, deliberate change - see
// supabase/migrations/008_access.sql.

/**
 * The role vocabulary. Pass `app` for one app, omit for all of them.
 *
 * Returns [{ app_key, role, label, label_th, description, rank, app_name }].
 * Render dropdowns from this rather than hard-coding role names, so an app that
 * gains a role gains it in the UI without a deploy.
 */
export function getAccessRoles(api, { app, signal } = {}) {
  const q = app ? `?app=${encodeURIComponent(app)}` : '';
  return api.get(`/api/portal/access/roles${q}`, { signal });
}

/**
 * Existing grants. Narrow with `app` (an app's own settings screen) or `email`
 * (answering "why can't this person open Credit?").
 */
export function getAccessGrants(api, { app, email, signal } = {}) {
  const q = new URLSearchParams();
  if (app) q.set('app', app);
  if (email) q.set('email', email);
  const qs = q.toString();
  return api.get(`/api/portal/access/grants${qs ? `?${qs}` : ''}`, { signal });
}

/**
 * One person across every app: { email, apps: [{ app_key, name, role, roles }] }.
 *
 * `roles` is the vocabulary available for that app and `role` is what they hold,
 * so a per-person screen can render the whole matrix from one call. An app with
 * `roles: []` has no roles defined — everyone who can sign in may use it — and
 * is included rather than omitted so the screen shows the complete picture.
 */
export function getPersonAccess(api, email, { signal } = {}) {
  return api.get(`/api/portal/access/person/${encodeURIComponent(email)}`, { signal });
}

/**
 * Grant, change, or revoke. Pass `role: null` to revoke.
 *
 * Idempotent — PUT the state you want, not a delta. A revocation still lands in
 * portal.access_audit, because the trigger fires on delete too.
 */
export function setAccessGrant(api, { email, app, role, note } = {}) {
  return api.put('/api/portal/access/grants', { email, app, role: role ?? null, note });
}

/**
 * The change history. Portal admins only — this is the record of who granted
 * whom what, and it is the question asked after an incident.
 */
export function getAccessAudit(api, { email, app, limit, signal } = {}) {
  const q = new URLSearchParams();
  if (email) q.set('email', email);
  if (app) q.set('app', app);
  if (limit) q.set('limit', String(limit));
  const qs = q.toString();
  return api.get(`/api/portal/access/audit${qs ? `?${qs}` : ''}`, { signal });
}
