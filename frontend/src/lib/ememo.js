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
  // companies (for the create-form brand picker) — active only
  listCompanies: () => api('/documents/companies'),
  companyLogoUrl: (companyId) => apiBlobUrl(`/documents/companies/${companyId}/logo`),
  createDocument: (body) => api('/documents', { method: 'POST', body }),
  combineDocument: (id) => api(`/documents/${id}/combine`, { method: 'POST' }),
  postMessage: (id, body) => api(`/documents/${id}/messages`, { method: 'POST', body: { body } }),
  attachMessageFile: (id, msgId, file) => apiUpload(`/documents/${id}/messages/${msgId}/attachments`, file),
  listApprovers: () => api('/documents/approvers'),
  myApproval: (id) => api(`/documents/${id}/my-approval`),
  approveDocument: (id, action, comment) => api(`/documents/${id}/approve`, { method: 'POST', body: { action, comment } }),
  consultDocument: (id, email, name, question) => api(`/documents/${id}/consult`, { method: 'POST', body: { email, name, question } }),
  updateDocument: (id, body) => api(`/documents/${id}`, { method: 'PATCH', body }),
  cancelDocument: (id, reason) => api(`/documents/${id}/cancel`, { method: 'POST', body: { reason } }),
  resendApproval: (id) => api(`/documents/${id}/resend-approval`, { method: 'POST' }),
  exportUrl: (filters = {}) => apiBlobUrl(`/documents/export${qs(filters)}`),

  // letterhead PDF — generate, then open the resulting attachment via /download
  generatePdf: (id) => api(`/documents/${id}/generate-pdf`, { method: 'POST' }),

  // upload an author signature image, returns { key } (used at create time)
  uploadSignature: (file) => apiUpload('/documents/signature', file),

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
  // open an attachment from the public approval page (token-gated, no login)
  approvalAttachmentBlobUrl: (token, attId) =>
    apiBlobUrl(`/approvals/${token}/attachments/${attId}/download`),
  actOnApproval: (token, action, comment, signatureDataUrl) =>
    api(`/approvals/${token}`, {
      method: 'POST',
      auth: false,
      body: { action, comment, signatureDataUrl },
    }),
  // delegate the current step to someone else
  forwardApproval: (token, toEmail, toName, comment) =>
    api(`/approvals/${token}/forward`, {
      method: 'POST',
      auth: false,
      body: { toEmail, toName, comment },
    }),
};

export const profileApi = {
  me: () => api('/auth/me'),
  update: (body) => api('/auth/me', { method: 'PATCH', body }),
  uploadSignature: (file) => apiUpload('/auth/me/signature', file),
  signatureBlobUrl: () => apiBlobUrl('/auth/me/signature'),
};

export const adminApi = {
  // users
  listUsers: () => api('/admin/users'),
  createUser: (body) => api('/admin/users', { method: 'POST', body }),
  updateUser: (id, body) => api(`/admin/users/${id}`, { method: 'PATCH', body }),
  deleteUser: (id) => api(`/admin/users/${id}`, { method: 'DELETE' }),
  resetPassword: (id, password) =>
    api(`/admin/users/${id}/reset-password`, { method: 'POST', body: { password } }),

  // action-level permissions
  permissionCatalog: () => api('/admin/permissions/catalog'),
  getUserPermissions: (id) => api(`/admin/users/${id}/permissions`),
  saveUserPermissions: (id, permissions) =>
    api(`/admin/users/${id}/permissions`, { method: 'PUT', body: { permissions } }),

  // per-user document visibility (#8) — allowed projects + doc codes ([] = all)
  getUserVisibility: (id) => api(`/admin/users/${id}/visibility`),
  saveUserVisibility: (id, projectIds, docCodes) =>
    api(`/admin/users/${id}/visibility`, { method: 'PUT', body: { projectIds, docCodes } }),

  // projects
  listProjects: () => api('/admin/projects'),
  createProject: (body) => api('/admin/projects', { method: 'POST', body }),
  updateProject: (id, body) => api(`/admin/projects/${id}`, { method: 'PATCH', body }),

  // document types
  listDocTypes: () => api('/admin/document-types'),
  createDocType: (body) => api('/admin/document-types', { method: 'POST', body }),
  updateDocType: (id, body) => api(`/admin/document-types/${id}`, { method: 'PATCH', body }),
  deleteDocType: (id) => api(`/admin/document-types/${id}`, { method: 'DELETE' }),

  // companies (บริษัท / ตรา — selectable letterhead identity)
  listCompanies: () => api('/admin/companies'),
  createCompany: (body) => api('/admin/companies', { method: 'POST', body }),
  updateCompany: (id, body) => api(`/admin/companies/${id}`, { method: 'PATCH', body }),
  deleteCompany: (id) => api(`/admin/companies/${id}`, { method: 'DELETE' }),
  uploadCompanyLogo: (file) => apiUpload('/admin/companies/logo', file),
  companyLogoBlobUrl: (id) => apiBlobUrl(`/documents/companies/${id}/logo`),

  // letterhead
  getLetterhead: (projectId) => api(`/admin/projects/${projectId}/letterhead`),
  saveLetterhead: (projectId, body) =>
    api(`/admin/projects/${projectId}/letterhead`, { method: 'PUT', body }),

  // doc-code → default approver chain
  listDocCodeApprovers: () => api('/admin/doc-codes'),
  saveDocCodeApprovers: (code, approvers) =>
    api(`/admin/doc-codes/${encodeURIComponent(code)}/approvers`, { method: 'PUT', body: { approvers } }),
  // doc-code CRUD (the code itself: code + department + recipient title)
  createDocCode: (body) => api('/admin/doc-codes', { method: 'POST', body }),
  updateDocCode: (code, body) =>
    api(`/admin/doc-codes/${encodeURIComponent(code)}`, { method: 'PUT', body }),
  deleteDocCode: (code) =>
    api(`/admin/doc-codes/${encodeURIComponent(code)}`, { method: 'DELETE' }),
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

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

/** Long Thai date with Buddhist-era year: "8 มิถุนายน 2569". */
export function formatThaiLongDate(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/** Thai BE date + time: "08/06/2569 19:43". */
export function formatThaiDateTime(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear() + 543;
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}
