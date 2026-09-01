// The credit module's data layer.
//
// Everything here goes through `createApi` from @vcb/shared, which is the only
// thing that speaks HTTP: base URL, Bearer token and the API's error shape are
// its business, not ours. There is no Supabase client in this app and there
// must never be one — TECH_STACK.md puts the database behind the Express API,
// which is the single place holding credentials and enforcing roles.
//
// Endpoints are exactly those defined in api/src/routes/credit.js, mounted at
// /api/credit. Where the route's response shape differs from what the old mock
// returned, the route wins and the difference is noted at the call site.

import { createApi } from '@vcb/shared';

/** Base URL comes from VITE_API_URL; see .env.example. */
export const api = createApi();

const BASE = '/api/credit';

/* ------------------------------- reference -------------------------------- */
//
// credit.projects and credit.facility_types are REAL TABLES (003_credit.sql),
// seeded from what used to be the hardcoded SEED_PROJECTS / SEED_FAC_TYPES
// arrays in src/mock/seed.ts.
//
// The API does not expose them yet: credit.js has no /projects or
// /facility-types route, and GET /data does not include them (it returns me,
// facilities, costCategories, categoryCaps, transactions, requests). Rather
// than reintroduce a hardcoded copy of data that now lives in Postgres, this
// asks the API for them and degrades to deriving what it can from /data when
// the routes 404. Delete the fallback the moment the routes land — see
// PORT_NOTES.md, "What the API does not provide".

async function optional(path) {
  try {
    return await api.get(path);
  } catch (err) {
    // 404 = route not implemented yet. Anything else is a real failure and
    // must not be swallowed into a silently empty screen.
    if (err?.status === 404) return null;
    throw err;
  }
}

export function getProjects() {
  return optional(`${BASE}/projects`);
}

export function getFacilityTypes() {
  return optional(`${BASE}/facility-types`);
}

/* --------------------------------- reads ---------------------------------- */

/**
 * The whole module in one response — what the Apps Script getData() returned.
 *
 *   { me: { email, isManager },
 *     facilities: [{ project, facilityNo, type, limit, used, available,
 *                    usedOverridden, interest, notes }],
 *     costCategories: [string],
 *     categoryCaps: [{ project, costCategory, cap, note, updated }],
 *     transactions: [TransactionOut],
 *     requests: [RequestOut] }
 *
 * Note `projects` and `facTypes` are NOT in here — see above.
 */
export function getData() {
  return api.get(`${BASE}/data`);
}

export function getTransactions(filters = {}) {
  return api.get(`${BASE}/transactions${query(filters)}`);
}

export function getRequests(filters = {}) {
  return api.get(`${BASE}/requests${query(filters)}`);
}

export function getCostCategories() {
  return api.get(`${BASE}/cost-categories`);
}

/** variant: 'plan' (forecast) | 'actual' (recorded). The route defaults to plan. */
export function getCashPlan(project, month, variant = 'plan') {
  return api.get(`${BASE}/cash-plan${query({ project, month, variant })}`);
}

/** Managers only — the route puts requireRole('credit','manager') on it. */
export function getAudit(limit = 200) {
  return api.get(`${BASE}/audit${query({ limit })}`);
}

/* --------------------------------- writes --------------------------------- */
//
// Every write below is manager-only in the API. The UI hides the controls via
// `me.isManager`, but that is a hint: requireRole re-checks server-side.

/**
 * Create a credit REQUEST.
 *
 * This is the mismatch the port had to fix. The old mock's addRequest() wrote
 * into the transactions array (insertTxn), while decideRequest() read a
 * separate requests array — so a request created through the UI could never be
 * found, let alone approved. There are two real tables now, and requests go to
 * the requests endpoint.
 */
export function addRequest(payload) {
  return api.post(`${BASE}/requests`, payload);
}

export function updateRequest(id, payload) {
  return api.patch(`${BASE}/requests/${encodeURIComponent(id)}`, payload);
}

export function deleteRequest(id) {
  return api.del(`${BASE}/requests/${encodeURIComponent(id)}`);
}

/**
 * Approve or reject. `decision` must be 'อนุมัติ' or 'ไม่อนุมัติ' — the route's
 * Zod enum rejects anything else. On approval the API also creates the linked
 * drawdown transaction in the same database transaction.
 */
export function decideRequest(id, decision) {
  return api.post(`${BASE}/requests/${encodeURIComponent(id)}/decide`, { decision });
}

export function addTransaction(payload) {
  return api.post(`${BASE}/transactions`, payload);
}

export function updateTransaction(id, payload) {
  return api.patch(`${BASE}/transactions/${encodeURIComponent(id)}`, payload);
}

export function setTxnStatus(id, status) {
  return api.post(`${BASE}/transactions/${encodeURIComponent(id)}/status`, { status });
}

/** Settle. May reject with ALREADY_SETTLED (409) or NOTHING_OWING (409). */
export function settleTxn(id) {
  return api.post(`${BASE}/transactions/${encodeURIComponent(id)}/settle`);
}

export function deleteTxn(id) {
  return api.del(`${BASE}/transactions/${encodeURIComponent(id)}`);
}

export function setLimit(project, facilityNo, limit) {
  return api.put(`${BASE}/limits`, { project, facilityNo, limit });
}

/** `used` of null clears the pin and hands the figure back to the view. */
export function setUsedOverride(project, facilityNo, used) {
  return api.put(`${BASE}/limits/used-override`, { project, facilityNo, used });
}

/** `cap` of null removes the budget. */
export function setCategoryCap(project, costCategory, cap, note = '') {
  return api.put(`${BASE}/category-caps`, { project, costCategory, cap, note });
}

export function setCostCategories(list) {
  return api.put(`${BASE}/cost-categories`, { list });
}

export function saveCashPlanPeriod(period) {
  return api.put(`${BASE}/cash-plan`, period);
}

export function deleteCashPlanPeriod(id) {
  return api.del(`${BASE}/cash-plan/${encodeURIComponent(id)}`);
}

/* --------------------------------- helper --------------------------------- */

function query(params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}
