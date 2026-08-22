import { api } from './api.js';

/** แผนผังระบบ (System Operating Map) — read by everyone, maintained by admins. */
export const sysmapApi = {
  bootstrap: () => api('/sysmap/bootstrap'),
  functions: () => api('/sysmap/functions'),
  ai: () => api('/sysmap/ai'),

  createLane: (body) => api('/sysmap/lanes', { method: 'POST', body }),
  updateLane: (id, body) => api(`/sysmap/lanes/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  deleteLane: (id) => api(`/sysmap/lanes/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  createNode: (body) => api('/sysmap/nodes', { method: 'POST', body }),
  updateNode: (id, body) => api(`/sysmap/nodes/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  deleteNode: (id) => api(`/sysmap/nodes/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  createConn: (body) => api('/sysmap/conns', { method: 'POST', body }),
  deleteConn: (id) => api(`/sysmap/conns/${id}`, { method: 'DELETE' }),

  createFunction: (body) => api('/sysmap/functions', { method: 'POST', body }),
  updateFunction: (code, body) => api(`/sysmap/functions/${encodeURIComponent(code)}`, { method: 'PATCH', body }),
  deleteFunction: (code) => api(`/sysmap/functions/${encodeURIComponent(code)}`, { method: 'DELETE' }),

  createAi: (body) => api('/sysmap/ai', { method: 'POST', body }),
  updateAi: (key, body) => api(`/sysmap/ai/${encodeURIComponent(key)}`, { method: 'PATCH', body }),
  deleteAi: (key) => api(`/sysmap/ai/${encodeURIComponent(key)}`, { method: 'DELETE' }),
};

/** Pick the Thai text when there is one, else fall back to English.
 *  A blank Thai column must never render as an empty box on screen. */
export const pick = (lang, th, en) => (lang === 'th' && th ? th : (en || th || ''));

/** How work moves from one box to the next — colour carries the meaning. */
export const CONN_META = {
  trigger:     { label: 'สั่งให้เริ่ม',   color: '#2563eb' },
  conditional: { label: 'มีเงื่อนไข',    color: '#c2410c' },
  feeds:       { label: 'ส่งข้อมูลต่อ',  color: '#0e7c66' },
  deferred:    { label: 'ทำภายหลัง',    color: '#7c3aed' },
};
export const connMeta = (t) => CONN_META[t] || CONN_META.feeds;
