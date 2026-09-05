import { api } from './api.js';

function qs(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Module 5 — SOP (คู่มือปฏิบัติงาน): reference content + authoring. */
export const sopApi = {
  bootstrap: () => api('/sop/bootstrap'),
  scenarios: ({ module, q } = {}) => api(`/sop/scenarios${qs({ module, q })}`),
  scenario: (no) => api(`/sop/scenarios/${no}`),
  createScenario: (body) => api('/sop/scenarios', { method: 'POST', body }),
  updateScenario: (no, body) => api(`/sop/scenarios/${no}`, { method: 'PATCH', body }),
  deleteScenario: (no) => api(`/sop/scenarios/${no}`, { method: 'DELETE' }),
  moveScenario: (no, direction) => api(`/sop/scenarios/${no}/move`, { method: 'POST', body: { direction } }),

  flows: ({ module } = {}) => api(`/sop/flows${qs({ module })}`),

  reports: () => api('/sop/reports'),
  createReport: (body) => api('/sop/reports', { method: 'POST', body }),
  updateReport: (id, body) => api(`/sop/reports/${id}`, { method: 'PATCH', body }),
  deleteReport: (id) => api(`/sop/reports/${id}`, { method: 'DELETE' }),

  // ประวัติเวอร์ชัน — รายการไม่ส่งเนื้อหาเต็มมาด้วย เพราะแต่ละเวอร์ชันคือเอกสารทั้งฉบับ
  versions: (limit) => api(`/sop/versions${qs({ limit })}`),
  version: (id) => api(`/sop/versions/${id}`),
  restoreVersion: (id) => api(`/sop/versions/${id}/restore`, { method: 'POST' }),
};

/** Per-module accent, so a case/flow reads as belonging to its area at a glance. */
export const MODULE_TONE = {
  PO: 'bg-sky-50 text-sky-700', IC: 'bg-emerald-50 text-emerald-700',
  AP: 'bg-amber-50 text-amber-700', FA: 'bg-purple-50 text-purple-700',
  PM: 'bg-blue-50 text-blue-700', OF: 'bg-orange-50 text-orange-700',
  GL: 'bg-slate-100 text-slate-600', AR: 'bg-rose-50 text-rose-700',
  BD: 'bg-emerald-50 text-emerald-700', FIN: 'bg-sky-50 text-sky-700',
  SE: 'bg-slate-100 text-slate-600',
};
export const toneOf = (code) => MODULE_TONE[code] || 'bg-slate-100 text-slate-600';
