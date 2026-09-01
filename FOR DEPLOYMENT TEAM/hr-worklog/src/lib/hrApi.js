// Every call the HR Work Log makes to the single Express API at api/.
//
// This file replaces src/mock.ts and src/lib/supabaseClient.ts. The browser now
// holds no database credentials and reaches no database — it talks to
// api/src/routes/hr.js over REST, which is the only place SQL runs.
// TECH_STACK.md: "เบราว์เซอร์ต้องไม่ต่อ Supabase โดยตรง".
//
// Endpoints, from api/src/routes/hr.js (everything under /api/hr requires a
// signed-in user holding an hr role — admin, manager or staff):
//
//   GET    /api/hr/bootstrap                      role, sites in scope, lockDays
//   GET    /api/hr/index                          activities + cost codes
//   PUT    /api/hr/index/activity                 admin
//   GET    /api/hr/sites                          admin — projects table
//   POST   /api/hr/sites                          admin
//   PATCH  /api/hr/sites/:siteKey                 admin — open/close a project
//   GET    /api/hr/sites/:siteKey/employees       within site
//   PUT    /api/hr/employees                      admin
//   GET    /api/hr/month?site&year&month          the grid
//   POST   /api/hr/cells                          batch save
//   GET    /api/hr/summary?year&month[&site]      dashboard
//   GET    /api/hr/mandays?site&from&to[&eid]     workload
//   GET    /api/hr/sites/:siteKey/roster          leave-slip identity fields
//   GET    /api/hr/leave?site&status&eid&limit
//   POST   /api/hr/leave
//   POST   /api/hr/leave/:id/decide               admin | manager
//   DELETE /api/hr/leave/:id?eid=                 own, while pending
//   POST   /api/hr/migrations                     admin
//   GET    /api/hr/migrations                     admin
//   GET    /api/hr/audit                          admin
//
// The api client is created ONCE here rather than per call, and main.jsx hands
// this same instance to <AuthProvider>. A second createApi() anywhere would get
// neither the token source nor the 401 handling, and every call through it
// would go out unsigned.

import { createApi } from '@vcb/shared';

export const api = createApi();

/* -------------------------------- bootstrap ------------------------------- */

/**
 * Who the caller is, which sites they may see, and the edit window.
 *
 * Returns { ok, email, role, isAdmin, canEntry, sites: [{key,name,company,active}],
 * lockDays }. The site list is already narrowed to the caller's scope by the
 * API — this client never filters for access, only for display.
 */
export function getBootstrap({ signal } = {}) {
  return api.get('/api/hr/bootstrap', { signal });
}

/* ------------------------------ reference data ---------------------------- */

/**
 * The picker's two vocabularies: `activities` (กิจกรรม, the master work index)
 * and `costs` (หมวดงาน, the ERP cost codes).
 *
 * An activity is { id, code, name, desc, category, sites, mapping, fixed_cost,
 * allowed_cost }. `mapping` decides how many steps the picker takes:
 * 'one-to-one' assigns fixed_cost and stops at step 1, 'one-to-many' asks for a
 * cost code at step 2.
 */
export function getIndex({ signal } = {}) {
  return api.get('/api/hr/index', { signal });
}

/** Insert or update one activity. Admin only. */
export function saveActivity(activity) {
  return api.put('/api/hr/index/activity', activity);
}

/* ---------------------------------- sites --------------------------------- */

/** The admin projects table, with the still-assigned headcount per project. */
export function listSitesAdmin({ signal } = {}) {
  return api.get('/api/hr/sites', { signal });
}

/**
 * Add a project.
 *
 * `key` is a permanent internal id — it is hr.users.site_key and the foreign key
 * on every entry — so it must be lowercase ASCII and is sent explicitly rather
 * than derived by the API from the Thai name. See siteKeyFrom() below.
 */
export function addSite({ key, name, company }) {
  return api.post('/api/hr/sites', { key, name, company });
}

/**
 * Open or close a project. Closing stops NEW entries; the dashboard keeps the
 * project's history either way.
 */
export function setSiteActive(siteKey, active) {
  return api.patch(`/api/hr/sites/${encodeURIComponent(siteKey)}`, { active });
}

/**
 * Derive an ASCII site key from a project name, the way the Apps Script version
 * did. A Thai name yields no ASCII at all, so it falls back to a stable hash of
 * the name rather than site2/site3, which would say nothing when read back in
 * the database. `taken` de-duplicates against the keys already in use.
 */
export function siteKeyFrom(name, taken = []) {
  const nm = String(name || '').trim();
  let base = nm.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (!base) {
    let h = 0;
    for (let i = 0; i < nm.length; i++) h = (h * 31 + nm.charCodeAt(i)) % 1000000;
    base = 'site' + h;
  }
  const used = new Set(taken);
  let key = base;
  let n = 2;
  while (used.has(key)) key = base + n++;
  return key;
}

/* -------------------------------- employees ------------------------------- */

export function listEmployees(siteKey, { signal } = {}) {
  return api.get(`/api/hr/sites/${encodeURIComponent(siteKey)}/employees`, { signal });
}

/** Insert or update one employee. Admin only, across all sites. */
export function saveEmployee(employee) {
  return api.put('/api/hr/employees', employee);
}

/** The identity fields the printed leave slip needs. */
export function getRoster(siteKey, { signal } = {}) {
  return api.get(`/api/hr/sites/${encodeURIComponent(siteKey)}/roster`, { signal });
}

/* ------------------------------- the grid --------------------------------- */

/**
 * One site's month: roster, every entry, and the per-day notes.
 *
 * `entries` arrives keyed eid → date → { team | detail, pm, note }.
 * `team` vs `detail` is a DISPLAY split by employee kind, not a storage one —
 * both are slot 1 (งานหลัก). `pm` is slot 2 (งานเสริม) and is named for the
 * legacy sheet column, NOT for an afternoon: there has never been an AM/PM
 * split in this app. See slotOf()/fieldForSlot() below.
 */
export function getMonth({ site, year, month, signal } = {}) {
  const q = new URLSearchParams({ site, year: String(year), month: String(month) });
  return api.get(`/api/hr/month?${q}`, { signal });
}

/**
 * slot 1 is งานหลัก (the main task); slot 2 is งานเสริม (optional extra work).
 * Never label either as a time of day.
 */
export const SLOT_MAIN = 1;
export const SLOT_EXTRA = 2;

/** Which cell field carries a slot, given the employee's kind. */
export function fieldForSlot(slot, kind) {
  if (slot === SLOT_EXTRA) return 'pm';
  return kind === 'operation' ? 'team' : 'detail';
}

/** The inverse: which slot a cell field writes to. */
export function slotOf(field) {
  return field === 'pm' ? SLOT_EXTRA : SLOT_MAIN;
}

/**
 * Save a batch of cells (and per-day notes) for one site, in one transaction.
 *
 * An empty value DELETES the slot rather than storing '' — the API does this,
 * and it matters: a stored blank row is still a row, and hr.mandays would count
 * it as a day worked. So pass null or '' to clear; never a space.
 *
 * A rejected edit window comes back as 403 OUTSIDE_EDIT_WINDOW (the database
 * trigger's 42501, translated by the API). That is a business rule, not a bug —
 * surface it to the user as such.
 */
export function saveCells({ site, cells = [], notes = [] }) {
  return api.post('/api/hr/cells', { site, cells, notes });
}

/* -------------------------------- dashboard ------------------------------- */

/**
 * Per-site totals for a month.
 *
 * `mandays` on each row comes from the hr.mandays view, which collapses BOTH
 * slots of a day into one row: a day with งานหลัก and งานเสริม filled is ONE
 * manday. Never recompute this client-side from entry counts — that inflates
 * every site that logs extra work, and nothing in the UI would flag it.
 *
 * `topActivities` / `topCostCodes` ARE per-entry counts, deliberately: a day
 * with two different activities genuinely used both, and those lists are
 * activity mix, not workload.
 *
 * Admins get every site; everyone else only theirs.
 */
export function getSummary({ year, month, site, signal } = {}) {
  const q = new URLSearchParams({ year: String(year), month: String(month) });
  if (site) q.set('site', site);
  return api.get(`/api/hr/summary?${q}`, { signal });
}

/** Mandays per employee over a range — the workload figure, never a row count. */
export function getMandays({ site, from, to, eid, signal } = {}) {
  const q = new URLSearchParams({ site, from, to });
  if (eid) q.set('eid', eid);
  return api.get(`/api/hr/mandays?${q}`, { signal });
}

/* ------------------------------ leave requests ---------------------------- */

/**
 * The leave-type codes the API accepts (api/src/routes/hr.js: leaveType).
 * The Thai label for each lives in the dictionary under leave.* so it can be
 * translated; the code is what crosses the wire.
 */
export const LEAVE_TYPES = [
  { code: 'sick', key: 'leave.sick' },
  { code: 'personal', key: 'leave.personal' },
  { code: 'vacation', key: 'leave.vacation' },
  { code: 'maternity', key: 'leave.maternity' },
  { code: 'ordination', key: 'leave.ordination' },
  { code: 'other', key: 'common.none' },
];

/**
 * One endpoint serves mine / pending / decided — the filters narrow, but the
 * caller's site scope is what decides what is visible at all.
 *
 * Returns { rows, total, shown }. `total` may exceed rows.length because the
 * list is capped and the count is not, which is what lets the UI say
 * "showing N of M" instead of presenting a truncated history as the whole record.
 */
export function listLeave({ site, status, eid, limit, signal } = {}) {
  const q = new URLSearchParams();
  if (site) q.set('site', site);
  if (status) q.set('status', status);
  if (eid) q.set('eid', eid);
  if (limit) q.set('limit', String(limit));
  const qs = q.toString();
  return api.get(`/api/hr/leave${qs ? `?${qs}` : ''}`, { signal });
}

/**
 * File a request. Only the eid is sent: the API resolves the site and the name
 * from the roster, so a caller cannot file against a site they cannot see.
 */
export function requestLeave({ eid, from_date, to_date, reason, leave_type }) {
  return api.post('/api/hr/leave', { eid, from_date, to_date, reason, leave_type });
}

/** Approve or reject. Admin or manager, within site. 409 = already decided. */
export function decideLeave(id, approve) {
  return api.post(`/api/hr/leave/${encodeURIComponent(id)}/decide`, { approve });
}

/**
 * The requester's own escape hatch, and only while pending — once decided the
 * row is a record, not a draft. Admins may cancel for anyone.
 */
export function cancelLeave(id, eid) {
  return api.del(`/api/hr/leave/${encodeURIComponent(id)}?eid=${encodeURIComponent(eid)}`);
}

/* --------------------------- migrations and audit ------------------------- */

/** Move an employee between sites. Admin only; recorded and applied atomically. */
export function migrateEmployee({ eid, to_site, move_date }) {
  return api.post('/api/hr/migrations', { eid, to_site, move_date });
}

export function listMigrations({ signal } = {}) {
  return api.get('/api/hr/migrations', { signal });
}

/**
 * The edit log. Read-only by design: rows are appended by a database trigger,
 * and an endpoint that let a client write them would make the log worthless as
 * evidence. There is no POST here and there must not be one.
 */
export function listAudit({ site, eid, limit, signal } = {}) {
  const q = new URLSearchParams();
  if (site) q.set('site', site);
  if (eid) q.set('eid', eid);
  if (limit) q.set('limit', String(limit));
  const qs = q.toString();
  return api.get(`/api/hr/audit${qs ? `?${qs}` : ''}`, { signal });
}

// There is deliberately no bulk historical import here. The Apps Script version
// has one that times out part-way through a large sheet and is not resumable,
// so a retry double-writes some months and skips others. Historical data is
// loaded by the one-off migration script instead, where a failure can be
// inspected and restarted. Do not add one back.
