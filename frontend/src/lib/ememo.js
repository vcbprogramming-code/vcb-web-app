import { api, apiUpload, apiBlobUrl } from './api.js';

/** Build a querystring from an object, skipping empty values. */
function qs(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const ememoApi = {
  listProjects: () => api('/projects'),
  listDocCodes: () => api('/projects/doc-codes'),
  listDocumentTypes: () => api('/projects/document-types'),

  stats: () => api('/documents/stats'),
  listDocuments: (filters = {}) => api(`/documents${qs(filters)}`),
  getDocument: (id) => api(`/documents/${id}`),
  nextNumber: (projectId, docCode) =>
    api(`/documents/next-number${qs({ projectId, docCode })}`),
  createDocument: (body) => api('/documents', { method: 'POST', body }),

  // letterhead PDF — generate, then open the resulting attachment via /download
  generatePdf: (id) => api(`/documents/${id}/generate-pdf`, { method: 'POST' }),

  // attachments (files stored in GridFS; streamed through the API)
  uploadAttachment: (id, file) => apiUpload(`/documents/${id}/attachments`, file),
  // returns a blob object URL the browser can open/preview
  attachmentBlobUrl: (id, attId) =>
    apiBlobUrl(`/documents/${id}/attachments/${attId}/download`),
  deleteAttachment: (id, attId) =>
    api(`/documents/${id}/attachments/${attId}`, { method: 'DELETE' }),

  // approval
  submitForApproval: (id, approvers) =>
    api(`/documents/${id}/submit`, { method: 'POST', body: { approvers } }),

  // public approval (no auth — token from email link)
  lookupApproval: (token) => api(`/approvals/${token}`, { auth: false }),
  actOnApproval: (token, action, comment, signatureDataUrl) =>
    api(`/approvals/${token}`, {
      method: 'POST',
      auth: false,
      body: { action, comment, signatureDataUrl },
    }),
};

export const adminApi = {
  // users
  listUsers: () => api('/admin/users'),
  createUser: (body) => api('/admin/users', { method: 'POST', body }),
  updateUser: (id, body) => api(`/admin/users/${id}`, { method: 'PATCH', body }),
  resetPassword: (id, password) =>
    api(`/admin/users/${id}/reset-password`, { method: 'POST', body: { password } }),

  // projects
  listProjects: () => api('/admin/projects'),
  createProject: (body) => api('/admin/projects', { method: 'POST', body }),
  updateProject: (id, body) => api(`/admin/projects/${id}`, { method: 'PATCH', body }),

  // document types
  listDocTypes: () => api('/admin/document-types'),
  createDocType: (body) => api('/admin/document-types', { method: 'POST', body }),
  updateDocType: (id, body) => api(`/admin/document-types/${id}`, { method: 'PATCH', body }),
  deleteDocType: (id) => api(`/admin/document-types/${id}`, { method: 'DELETE' }),

  // letterhead
  getLetterhead: (projectId) => api(`/admin/projects/${projectId}/letterhead`),
  saveLetterhead: (projectId, body) =>
    api(`/admin/projects/${projectId}/letterhead`, { method: 'PUT', body }),
};

/** Role → Thai label. */
export const ROLE_LABELS = {
  admin: 'ผู้ดูแลระบบ',
  executive: 'ผู้บริหาร',
  hr: 'เจ้าหน้าที่ HR',
};

/** Approval action → Thai label + chip classes. */
export const APPROVAL_META = {
  pending:  { label: 'รอดำเนินการ', chip: 'bg-amber-50 text-amber-700' },
  approved: { label: 'อนุมัติ',     chip: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'ไม่อนุมัติ',  chip: 'bg-red-50 text-red-700' },
  returned: { label: 'ส่งกลับแก้ไข', chip: 'bg-orange-50 text-orange-700' },
};

/** Status → Thai label + Tailwind chip classes. */
export const STATUS_META = {
  draft:     { label: 'ฉบับร่าง',  chip: 'bg-slate-100 text-slate-600' },
  pending:   { label: 'รออนุมัติ',  chip: 'bg-amber-50 text-amber-700' },
  approved:  { label: 'อนุมัติแล้ว', chip: 'bg-emerald-50 text-emerald-700' },
  rejected:  { label: 'ไม่อนุมัติ',  chip: 'bg-red-50 text-red-700' },
  returned:  { label: 'ตีกลับ',     chip: 'bg-orange-50 text-orange-700' },
  cancelled: { label: 'ยกเลิก',     chip: 'bg-slate-100 text-slate-400' },
};

/** Format an ISO date (yyyy-mm-dd) as Thai Buddhist-era dd/mm/พ.ศ. */
export function formatThaiDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear() + 543; // Gregorian → Buddhist era
  return `${dd}/${mm}/${yyyy}`;
}
