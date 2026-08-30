// API client for Module 2 — daily work-activity log (hr-worklog).
// Mirrors the backend /api/performance contract (bootstrap / site-month /
// admin-summary / cell save + activity & cost-category catalogs + employees).
import { api, apiBlobUrl, apiUpload } from './api.js';

const qs = (o) => {
  const s = new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== '')).toString();
  return s ? `?${s}` : '';
};

export const perfApi = {
  // session + sites the user may see
  bootstrap: () => api('/performance/bootstrap'),

  // catalogs (Work Index)
  activities: () => api('/performance/activities'),
  createActivity: (body) => api('/performance/activities', { method: 'POST', body }),
  updateActivity: (code, body) => api(`/performance/activities/${encodeURIComponent(code)}`, { method: 'PATCH', body }),
  costCategories: () => api('/performance/cost-categories'),
  createCostCategory: (body) => api('/performance/cost-categories', { method: 'POST', body }),
  updateCostCategory: (code, body) => api(`/performance/cost-categories/${encodeURIComponent(code)}`, { method: 'PATCH', body }),

  // employees for a site
  employees: (site, month) => api(`/performance/employees${qs({ site, month })}`),
  createEmployee: (body) => api('/performance/employees', { method: 'POST', body }),
  updateEmployee: (id, body) => api(`/performance/employees/${id}`, { method: 'PATCH', body }),
  setAway: (id, date, away) => api(`/performance/employees/${id}/away`, { method: 'POST', body: { date, away } }),

  // ── เกณฑ์ตรวจรับ: แรงงาน-วัน ยืนยันข้อมูล ปิดงวด ประวัติ แจ้งเตือน รายงาน ──
  saveDay: (body) => api('/performance/day', { method: 'POST', body }),
  verify: (site, from, to, undo) => api('/performance/verify', { method: 'POST', body: { site, from, to, undo } }),
  periodCloses: (site) => api(`/performance/period-closes${qs({ site })}`),
  closePeriod: (site, ym, note) => api('/performance/period-close', { method: 'POST', body: { site, ym, note } }),
  openPeriod: (site, ym, reason) => api('/performance/period-open', { method: 'POST', body: { site, ym, reason } }),
  workAudit: (params) => api(`/performance/audit${qs(params)}`),
  teams: (site) => api(`/performance/teams${qs({ site })}`),
  createTeam: (body) => api('/performance/teams', { method: 'POST', body }),
  updateTeam: (id, body) => api(`/performance/teams/${id}`, { method: 'PATCH', body }),
  manpower: (params) => api(`/performance/manpower${qs(params)}`),
  mandayReport: (params) => api(`/performance/report/manday${qs(params)}`),
  monthlyReportUrl: (ym) => apiBlobUrl(`/performance/report/monthly.xlsx${qs({ ym })}`),
  alerts: () => api('/performance/alerts'),
  bulkSave: (body) => api('/performance/bulk', { method: 'POST', body }),
  mandayPdfUrl: (params) => apiBlobUrl(`/performance/report/manday.pdf${qs(params)}`),
  importTemplateUrl: () => apiBlobUrl('/performance/import/employees/template.xlsx'),
  importEmployees: (file, dryRun) =>
    apiUpload(`/performance/import/employees${qs({ dryRun: dryRun ? 'true' : undefined })}`, file),
  // ทะเบียนแผนกและตำแหน่ง
  departments: (params) => api(`/performance/departments${qs(params)}`),
  createDepartment: (body) => api('/performance/departments', { method: 'POST', body }),
  updateDepartment: (id, body) => api(`/performance/departments/${id}`, { method: 'PATCH', body }),
  deleteDepartment: (id) => api(`/performance/departments/${id}`, { method: 'DELETE' }),
  positions: (params) => api(`/performance/positions${qs(params)}`),
  createPosition: (body) => api('/performance/positions', { method: 'POST', body }),
  updatePosition: (id, body) => api(`/performance/positions/${id}`, { method: 'PATCH', body }),
  deletePosition: (id) => api(`/performance/positions/${id}`, { method: 'DELETE' }),

  attachments: (params) => api(`/performance/attachments${qs(params)}`),
  uploadAttachment: (site, employeeId, date, file) =>
    apiUpload('/performance/attachments', file, { extra: { site, employeeId, date } }),
  attachmentUrl: (id) => apiBlobUrl(`/performance/attachments/${id}/file`),
  deleteAttachment: (id) => api(`/performance/attachments/${id}`, { method: 'DELETE' }),

  // ระบบลางาน — the request behind a day off
  leaveTypes: () => api('/performance/leave/types'),
  myLeave: () => api('/performance/leave/mine'),
  pendingLeave: () => api('/performance/leave/pending'),
  decidedLeave: () => api('/performance/leave/decided'),
  requestLeave: (body) => api('/performance/leave', { method: 'POST', body }),
  decideLeave: (id, approve, note) => api(`/performance/leave/${id}/decide`, { method: 'POST', body: { approve, note } }),
  cancelLeave: (id) => api(`/performance/leave/${id}/cancel`, { method: 'POST' }),
  leaveSlipUrl: (id) => apiBlobUrl(`/performance/leave/${id}/slip`),
  leaveApprovers: () => api('/performance/leave/approvers'),
  setLeaveApprover: (approverId, employeeIds) =>
    api(`/performance/leave/approvers/${approverId}`, { method: 'PUT', body: { employeeIds } }),

  // month grid for one site
  siteMonth: (site, year, month) => api(`/performance/site-month${qs({ site, year, month })}`),

  // autosave one cell field: field ∈ 'team'|'detail'|'pm'; empty value clears it
  saveCell: ({ site, eid, date, field, value, adminUnlock }) =>
    api('/performance/cell', { method: 'POST', body: { site, eid, date, field, value, adminUnlock } }),

  // site settings (lock-days window)
  updateSite: (code, body) => api(`/performance/sites/${encodeURIComponent(code)}`, { method: 'PATCH', body }),

  // dashboard summary across all visible sites
  adminSummary: (year, month) => api(`/performance/admin-summary${qs({ year, month })}`),

  // Excel export (blob URL)
  exportUrl: (site, year, month) => apiBlobUrl(`/performance/export${qs({ site, year, month })}`),
};

// ── shared helpers (composite cell value "A-1 / 5" = activityCode / costCode) ──
export const splitSlot = (s) => {
  if (!s) return { act: '', cost: '' };
  const [act, cost] = String(s).split(' / ').map((x) => (x || '').trim());
  return { act: act || '', cost: cost || '' };
};
export const joinSlot = (act, cost) => (cost ? `${act} / ${cost}` : act);

/** true when a cell has any content (used for coverage/fill counting). */
export const cellFilled = (c) => Boolean(c && ((c.team && c.team.trim()) || (c.detail && c.detail.trim()) || (c.pm && c.pm.trim())));

// ── client-side display prefs (localStorage) ─────────────────────────────────
const PREFS_KEY = 'hr_perf_prefs';
const readPrefs = () => { try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { return {}; } };
export const perfPrefs = {
  get: () => ({ cellNames: 'code', hiddenSites: [], ...readPrefs() }),
  set: (patch) => { const next = { ...readPrefs(), ...patch }; localStorage.setItem(PREFS_KEY, JSON.stringify(next)); return next; },
};
