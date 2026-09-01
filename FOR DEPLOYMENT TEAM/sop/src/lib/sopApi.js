/**
 * SOP endpoints on the single Express API (api/src/routes/sop.js).
 *
 * This replaces two things at once: the in-memory mock in the old lib/api.ts,
 * and lib/supabaseClient.ts. The browser no longer reaches Supabase at all —
 * Express is the only thing holding database credentials, and the only thing
 * enforcing who may write. See TECH_STACK.md.
 *
 * The client is created here rather than imported as the shared default
 * instance so AuthProvider can be handed the same object (main.jsx passes it
 * in), which is what lets a 401 clear the session exactly once.
 *
 * ---------------------------------------------------------------------------
 * READS ARE PUBLIC. WRITES NEED THE `sop` EDITOR ROLE.
 * ---------------------------------------------------------------------------
 * GET /api/sop, /scenarios, /reports are allowAnonymous — the SOP is reference
 * material staff open without signing in, and requiring auth would be a
 * regression from the Apps Script app. Everything else is
 * requireRole('sop','editor'), including the version history, which carries
 * pre-edit content.
 */

import { createApi, ApiError } from '@vcb/shared';

export const api = createApi();

const BASE = '/api/sop';

/* --------------------------------- document ------------------------------- */

/**
 * The whole SOP — { meta, scenarios, reports }.
 *
 * meta.isAdmin and meta.userEmail are injected per request by the API from the
 * caller's JWT. They are a UI hint (they decide whether Edit affordances
 * render), never the gate — the write routes are.
 *
 * Returns null for 404 NOT_SEEDED rather than throwing. The document row is
 * deliberately not seeded by migration 006, so "no SOP yet" is an expected
 * pre-launch state that deserves an onboarding screen, not an error page.
 */
export async function fetchSop(opts) {
  try {
    return await api.get(`${BASE}/`, opts);
  } catch (err) {
    if (err instanceof ApiError && err.code === 'NOT_SEEDED') return null;
    throw err;
  }
}

/** Document metadata: title, subtitle, manual, version, effective, scope,
 * purpose, notes. Every field optional — an omitted key is left alone. */
export function patchMeta(patch) {
  return api.patch(`${BASE}/meta`, patch);
}

/* -------------------------------- scenarios ------------------------------- */

/**
 * Append a case.
 *
 * `no` is assigned server-side as length + 1 — a row-order id, not a per-module
 * one. Do NOT send `no`, and do NOT send `displayNo`: the per-module label is
 * recomputed from row order on every read and is never persisted.
 */
export function createScenario(payload) {
  return api.post(`${BASE}/scenarios`, payload);
}

/**
 * Edit one case in place, addressed by its `no`.
 *
 * Every field is optional and an omitted key means "leave alone". `attachments`
 * is the one place that distinction bites: omitting it keeps the existing
 * files, while sending [] removes them all.
 */
export function editScenario(no, patch) {
  return api.patch(`${BASE}/scenarios/${encodeURIComponent(no)}`, patch);
}

/**
 * Trade two cases' content. `swapWith` is the TARGET'S displayNo ("PO-5"), not
 * its `no` — that is the label on the card the editor actually picked.
 */
export function swapScenario(no, swapWith) {
  return api.post(`${BASE}/scenarios/${encodeURIComponent(no)}/swap`, { swapWith });
}

export function deleteScenario(no) {
  return api.del(`${BASE}/scenarios/${encodeURIComponent(no)}`);
}

/* --------------------------------- reports -------------------------------- */

/** Append a row to the "which report do I run" table. `case` is a label the
 * caller supplies, defaulting server-side to the next row number. */
export function createReport(payload) {
  return api.post(`${BASE}/reports`, payload);
}

export function deleteReport(caseNo) {
  return api.del(`${BASE}/reports/${encodeURIComponent(caseNo)}`);
}

/* -------------------------------- versions -------------------------------- */
//
// Editor-only: a version row is a whole pre-edit document. Rows are written by
// the sop_snapshot database trigger on every update, never by a client — so
// there is no create call here, only list / read / restore.

export function listVersions(limit = 50) {
  return api.get(`${BASE}/versions?limit=${encodeURIComponent(limit)}`);
}

export function getVersion(id) {
  return api.get(`${BASE}/versions/${encodeURIComponent(id)}`);
}

/** Restore a past version. The write is an ordinary update, so the trigger
 * snapshots the CURRENT document first — a restore is itself undoable. */
export function restoreVersion(id) {
  return api.post(`${BASE}/versions/${encodeURIComponent(id)}/restore`);
}

/* ---------------------------------- errors -------------------------------- */

/**
 * Map an ApiError onto a dictionary key for t().
 *
 * Two API codes deserve their own wording rather than the generic fallback:
 *
 *   NOT_SEEDED  409 on a write — the document row does not exist, so there is
 *               nothing to edit yet. Telling someone "something went wrong"
 *               would send them hunting for a fault that is not there.
 *   CONFLICT    every mutation is a read-modify-write under `select … for
 *               update`. A client cannot assume it will win: if the row is
 *               locked or the update is rejected, the person's typing was NOT
 *               saved, and they must be told to refresh rather than left
 *               believing it landed. See the note in api/src/routes/sop.js.
 */
export function errorKey(err) {
  const code = err?.code || 'INTERNAL';
  // 409 is always a lost write under this API's locking scheme.
  if (err?.status === 409 && code !== 'NOT_SEEDED') return 'error.CONFLICT';
  return `error.${code}`;
}

export { ApiError };
