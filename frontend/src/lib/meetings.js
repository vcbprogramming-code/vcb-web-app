import { api, apiBlobUrl } from './api.js';

const qs = (o) => {
  const s = new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== '')).toString();
  return s ? `?${s}` : '';
};

/** รายงานการประชุม — minutes per group, every version kept. */
export const meetingsApi = {
  bootstrap: () => api('/meetings/bootstrap'),
  list: ({ groupId, q } = {}) => api(`/meetings${qs({ groupId, q })}`),
  get: (id) => api(`/meetings/${id}`),
  version: (id, seq) => api(`/meetings/${id}/versions/${seq}`),

  create: (body) => api('/meetings', { method: 'POST', body }),
  update: (id, body) => api(`/meetings/${id}`, { method: 'PATCH', body }),
  togglePin: (id) => api(`/meetings/${id}/pin`, { method: 'POST' }),
  remove: (id) => api(`/meetings/${id}`, { method: 'DELETE' }),

  attach: (id, file, kind = 'file') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', kind);
    return api(`/meetings/${id}/attachments`, { method: 'POST', body: fd });
  },
  fileUrl: (id, attId) => apiBlobUrl(`/meetings/${id}/attachments/${attId}`),
  removeFile: (id, attId) => api(`/meetings/${id}/attachments/${attId}`, { method: 'DELETE' }),

  comment: (id, body) => api(`/meetings/${id}/comments`, { method: 'POST', body: { body } }),
  removeComment: (id, cid) => api(`/meetings/${id}/comments/${cid}`, { method: 'DELETE' }),

  createGroup: (body) => api('/meetings/groups/new', { method: 'POST', body }),
  updateGroup: (id, body) => api(`/meetings/groups/${id}`, { method: 'PATCH', body }),
  removeGroup: (id) => api(`/meetings/groups/${id}`, { method: 'DELETE' }),
};

/** dd/mm/พ.ศ. */
export const thaiDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear() + 543}`;
};
