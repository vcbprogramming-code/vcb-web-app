// Every call this module makes to the single Express API at api/.
//
// This file replaces lib/supabaseClient.ts and the direct `supabase.from(...)`
// calls that used to live in useProgress, useChecklistOverrides and
// useDocUpload. The browser now holds no database credentials and reaches no
// database — it talks to api/src/routes/onboarding.js over REST, which is the
// only place SQL runs. TECH_STACK.md: "เบราว์เซอร์ต้องไม่ต่อ Supabase โดยตรง".
//
// Endpoints, from api/src/routes/onboarding.js:
//
//   POST   /api/onboarding/employees                  anonymous  upsert identity
//   GET    /api/onboarding/employees/:name            anonymous
//   PATCH  /api/onboarding/employees/:name            anonymous  department/level
//   POST   /api/onboarding/employees/:name/rename     anonymous  merges progress
//   POST   /api/onboarding/employees/:name/department anonymous  switch + clear
//   GET    /api/onboarding/progress/:name             anonymous  404 = unknown
//   PUT    /api/onboarding/progress/:name             anonymous  one checkbox
//   POST   /api/onboarding/progress/:name/batch       anonymous  whole page
//   GET    /api/onboarding/checklist                  anonymous  overrides
//   PUT    /api/onboarding/checklist                  portal ADMIN
//   DELETE /api/onboarding/checklist/:itemId          portal ADMIN
//   GET    /api/onboarding/documents/:name/path       anonymous  storage key
//   GET    /api/onboarding/admin/employees            portal ADMIN
//
// MOST OF THIS SURFACE IS ANONYMOUS BY DESIGN. The people using it are new
// hires on their first day, before anyone has created an account for them, so
// requiring a token would lock out exactly the users the module exists for.
// The API scopes every anonymous write to one named employee record. Do not
// add a sign-in wall to those flows. The two admin routes are the exception —
// they touch shared content and the whole cohort, and they replace the dropped
// shared-password back door (007_onboarding.sql, DROPPED FUNCTIONS).
//
// The api client is created once here rather than per call so AuthProvider can
// wire its token source and 401 handling into this exact instance.

import { createApi } from '@vcb/shared';

export const api = createApi();

// The name is the primary key of onboarding.employees and travels in the URL
// path, so it is encoded at every call site. Thai names and spaces are normal
// here, and an unencoded space silently produces a 404 against a different row.
const seg = (value) => encodeURIComponent(String(value ?? '').trim());

/* -------------------------------- employees ------------------------------- */

/** Upsert the employee doing the onboarding. Returns the stored row. */
export function saveEmployee({ name, department, level }) {
  return api.post('/api/onboarding/employees', { name, department, level });
}

export function getEmployee(name, { signal } = {}) {
  return api.get(`/api/onboarding/employees/${seg(name)}`, { signal });
}

/** Partial update — an omitted field is left alone, never blanked. */
export function updateEmployee(name, patch) {
  return api.patch(`/api/onboarding/employees/${seg(name)}`, patch);
}

/**
 * Correct a mistyped name.
 *
 * The API carries the progress across in ONE transaction and unions it with
 * anything already saved under the target name, so a task completed under
 * either spelling stays completed. The client no longer reads, merges and
 * re-writes those rows itself — that was three round trips with no transaction,
 * and a failure between them orphaned the progress.
 */
export function renameEmployee(from, to) {
  return api.post(`/api/onboarding/employees/${seg(from)}/rename`, { to });
}

/**
 * Switch department, discarding the old department's progress.
 *
 * `clearTaskIds` comes from the old department's own content file because the
 * API does not have it. Do not let this fall back to prefix matching: the ids
 * use an abbreviated scheme ("acct-p1-know-3") that never matched the page-key
 * prefix ("accounting-"), so the original silently deleted nothing and the old
 * checkmarks reappeared on the next load.
 */
export function switchDepartment(name, department, clearTaskIds = []) {
  return api.post(`/api/onboarding/employees/${seg(name)}/department`, {
    department,
    clear_task_ids: clearTaskIds,
  });
}

/* --------------------------------- progress ------------------------------- */

/**
 * One employee's completed tasks: { name, rows: [{ task_id, completed }] }.
 *
 * 404 for an unknown name is meaningful and deliberate — the caller renders
 * "new employee" and "could not load" very differently. Callers must branch on
 * err.status === 404 rather than treating every failure as an empty checklist.
 */
export function getProgress(name, { signal } = {}) {
  return api.get(`/api/onboarding/progress/${seg(name)}`, { signal });
}

/** Tick or untick one box. */
export function setTaskDone(name, taskId, completed) {
  return api.put(`/api/onboarding/progress/${seg(name)}`, {
    task_id: taskId,
    completed,
  });
}

/** Save a whole page at once, in one transaction. */
export function setTasksDone(name, tasks) {
  return api.post(`/api/onboarding/progress/${seg(name)}/batch`, { tasks });
}

/* --------------------------- checklist overrides -------------------------- */

/**
 * The admin's checklist edits, layered over the hardcoded content at render
 * time. Reading is anonymous — every employee's page load applies them.
 *
 * Soft-deleted rows come back too: the client needs the row in order to know
 * to hide the hardcoded item it overlays.
 */
export function listChecklistOverrides({ pageKey, signal } = {}) {
  const q = pageKey ? `?page_key=${encodeURIComponent(pageKey)}` : '';
  return api.get(`/api/onboarding/checklist${q}`, { signal });
}

/**
 * Save one override. REQUIRES the portal admin role — a real signed-in person,
 * not the shared password this replaces. Fields left undefined are preserved
 * server-side, so a partial edit does not blank the rest of the row.
 */
export function saveChecklistOverride(itemId, fields = {}) {
  return api.put('/api/onboarding/checklist', {
    item_id: itemId,
    page_key: fields.pageKey ?? null,
    block_index: fields.blockIndex ?? null,
    text: fields.text ?? null,
    level: fields.level ?? null,
    deleted: fields.deleted ?? false,
    sort_order: fields.order ?? null,
  });
}

/** Soft-delete one item. REQUIRES the portal admin role. */
export function deleteChecklistOverride(itemId) {
  return api.del(`/api/onboarding/checklist/${seg(itemId)}`);
}

/* -------------------------------- documents ------------------------------- */

// Mirrors ALLOWED_DOC_EXTENSIONS in api/src/routes/onboarding.js and the
// original app's MAX_DOC_UPLOAD_BYTES_. 10MB comfortably fits a phone photo of
// a document while staying well clear of Storage limits.
export const MAX_DOC_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_DOC_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];

/**
 * Where one document belongs in storage: { bucket, path }.
 *
 * Keyed by employee name + docId + extension and NOT by the uploaded filename,
 * so re-uploading a differently-named file for the same requirement replaces
 * the first object instead of creating a second nobody can tell apart.
 */
export function getDocumentPath(name, docId, ext, { signal } = {}) {
  const q = `?doc_id=${encodeURIComponent(docId)}&ext=${encodeURIComponent(ext)}`;
  return api.get(`/api/onboarding/documents/${seg(name)}/path${q}`, { signal });
}

/* ---------------------------------- admin --------------------------------- */

/** The whole cohort and how far along each person is. REQUIRES portal admin. */
export function listAdminEmployees({ signal } = {}) {
  return api.get('/api/onboarding/admin/employees', { signal });
}
