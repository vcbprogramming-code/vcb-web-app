// Every call the portal makes to the single Express API at api/.
//
// This file replaces mockBackend.ts and lib/supabaseClient.ts. The browser now
// holds no database credentials and reaches no database — it talks to
// api/src/routes/portal.js over REST, which is the only place SQL runs.
// TECH_STACK.md: "เบราว์เซอร์ต้องไม่ต่อ Supabase โดยตรง".
//
// Endpoints, from api/src/routes/portal.js:
//
//   GET    /api/portal/apps[?includeDisabled=1]   anonymous; disabled tiles
//                                                 served only to a portal admin
//   POST   /api/portal/apps                       admin
//   PATCH  /api/portal/apps/:key                  admin
//   DELETE /api/portal/apps/:key                  admin
//   PUT    /api/portal/apps/order                 admin  { keys: [...] }
//   GET    /api/portal/announcement               anonymous; null when hidden
//   PUT    /api/portal/announcement               admin
//   DELETE /api/portal/announcement               admin
//
// The api client is created once here rather than per call so AuthProvider can
// wire its token source and 401 handling into this exact instance.

import { createApi } from '@vcb/shared';

export const api = createApi();

/* ----------------------------------- apps --------------------------------- */

/**
 * The tile list.
 *
 * An app row is { key, name, nameTh, desc, descTh, url, icon, accent,
 * sortOrder, enabled }. Thai copy rides along on the row so switching language
 * does not need a second request — see appName()/appDesc() in appCopy.js for
 * which of the two wins.
 */
export function listApps({ includeDisabled = false, signal } = {}) {
  const q = includeDisabled ? '?includeDisabled=1' : '';
  return api.get(`/api/portal/apps${q}`, { signal });
}

export function createApp(app) {
  return api.post('/api/portal/apps', app);
}

export function updateApp(key, patch) {
  return api.patch(`/api/portal/apps/${encodeURIComponent(key)}`, patch);
}

export function deleteApp(key) {
  return api.del(`/api/portal/apps/${encodeURIComponent(key)}`);
}

/** Bulk reorder — position in `keys` becomes sort_order. */
export function reorderApps(keys) {
  return api.put('/api/portal/apps/order', { keys });
}

/* ------------------------------- announcement ----------------------------- */

/**
 * The banner, or null.
 *
 * Returns null for a hidden banner unless the caller is a portal admin, in
 * which case the hidden draft comes back so the editor can load it — the API
 * decides that, not this client.
 *
 * `id` is String(revision), a bigint the database bumps on every save. It used
 * to be a uuid; see readDismissed() in announcementDismissal.js for why the
 * change matters to stored state.
 */
export function getAnnouncement({ signal } = {}) {
  return api.get('/api/portal/announcement', { signal });
}

export function saveAnnouncement({ title, body, show }) {
  return api.put('/api/portal/announcement', { title, body, show });
}

/**
 * Blank the banner. The API clears the text in place rather than deleting the
 * row, so `revision` keeps climbing and an old dismissed banner never re-shows.
 */
export function clearAnnouncement() {
  return api.del('/api/portal/announcement');
}
