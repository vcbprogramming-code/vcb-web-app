import { api, apiUpload, apiBlobUrl } from './api.js';

/** Build a querystring from an object, skipping empty values. */
function qs(params = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// ── Module 2: Performance / OT ──────────────────────────────────────────────
export const performanceApi = {
  sites: () => api('/performance/sites'),
  dashboard: (month) => api(`/performance/dashboard${qs({ month })}`),
  employees: (unitId) => api(`/performance/employees${qs({ unitId })}`),
  addEmployee: (body) => api('/performance/employees', { method: 'POST', body }),
  updateEmployee: (id, body) => api(`/performance/employees/${id}`, { method: 'PATCH', body }),
  workTypes: () => api('/performance/work-types'),
  addWorkType: (body) => api('/performance/work-types', { method: 'POST', body }),
  grid: (unitId, month) => api(`/performance/grid${qs({ unitId, month })}`),
  saveGrid: (unitId, cells, adminUnlock = false) =>
    api('/performance/grid/save', { method: 'POST', body: { unitId, cells, adminUnlock } }),
  coverage: (unitId, month) => api(`/performance/coverage${qs({ unitId, month })}`),
  exportUrl: (unitId, month) => apiBlobUrl(`/performance/export${qs({ unitId, month })}`),
};

// ── Module 3: Credit Facility ───────────────────────────────────────────────
export const creditApi = {
  overview: () => api('/credit/overview'),
  facilities: (filters) => api(`/credit/facilities${qs(filters)}`),
  addFacility: (body) => api('/credit/facilities', { method: 'POST', body }),
  updateFacility: (id, body) => api(`/credit/facilities/${id}`, { method: 'PATCH', body }),
  setLimit: (id, limit) => api(`/credit/facilities/${id}/limit`, { method: 'PUT', body: { limit } }),
  ledger: (filters) => api(`/credit/ledger${qs(filters)}`),
  addLedger: (body) => api('/credit/ledger', { method: 'POST', body }),
  updateLedger: (id, body) => api(`/credit/ledger/${id}`, { method: 'PATCH', body }),
  settleLedger: (id) => api(`/credit/ledger/${id}/settle`, { method: 'POST' }),
  deleteLedger: (id) => api(`/credit/ledger/${id}`, { method: 'DELETE' }),
  requests: (status) => api(`/credit/requests${qs({ status })}`),
  addRequest: (body) => api('/credit/requests', { method: 'POST', body }),
  decideRequest: (id, decision, note) =>
    api(`/credit/requests/${id}/decide`, { method: 'POST', body: { decision, note } }),
  overdue: () => api('/credit/overdue'),
  cashPlan: (filters) => api(`/credit/cash-plan${qs(filters)}`),
  addCashPlan: (body) => api('/credit/cash-plan', { method: 'POST', body }),
  updateCashPlan: (id, body) => api(`/credit/cash-plan/${id}`, { method: 'PATCH', body }),
  deleteCashPlan: (id) => api(`/credit/cash-plan/${id}`, { method: 'DELETE' }),
  audit: (filters) => api(`/credit/audit${qs(filters)}`),
  exportUrl: (filters) => apiBlobUrl(`/credit/export${qs(filters)}`),
};

// ── Module 4: Onboarding ────────────────────────────────────────────────────
export const onboardingApi = {
  resources: (category) => api(`/onboarding/resources${qs({ category })}`),
  addResource: (file, fields) => apiUpload('/onboarding/resources', file, { extra: fields }),
  resourceBlobUrl: (id) => apiBlobUrl(`/onboarding/resources/${id}/download`),
  deleteResource: (id) => api(`/onboarding/resources/${id}`, { method: 'DELETE' }),
  templates: () => api('/onboarding/templates'),
  addTemplate: (body) => api('/onboarding/templates', { method: 'POST', body }),
  updateTemplate: (id, body) => api(`/onboarding/templates/${id}`, { method: 'PATCH', body }),
  deleteTemplate: (id) => api(`/onboarding/templates/${id}`, { method: 'DELETE' }),
  journeys: (status) => api(`/onboarding/journeys${qs({ status })}`),
  journey: (id) => api(`/onboarding/journeys/${id}`),
  addJourney: (body) => api('/onboarding/journeys', { method: 'POST', body }),
  toggleTask: (id, taskId, done) =>
    api(`/onboarding/journeys/${id}/tasks/${taskId}`, { method: 'PATCH', body: { done } }),
  saveReview: (id, body) => api(`/onboarding/journeys/${id}/review`, { method: 'PUT', body }),
};

/** Format a number as Thai baht (no decimals). */
export function formatMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return '฿' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}
