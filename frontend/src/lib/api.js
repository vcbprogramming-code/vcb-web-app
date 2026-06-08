const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const TOKEN_KEY = 'hr_access_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/**
 * Thin fetch wrapper that attaches the Bearer token and parses JSON.
 * Throws an Error with the server's message on non-2xx responses.
 */
export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = tokenStore.get();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

/**
 * Upload a file via multipart/form-data. Does NOT set Content-Type — the
 * browser sets the multipart boundary itself. Returns the parsed JSON.
 */
export async function apiUpload(path, file, { field = 'file' } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  const form = new FormData();
  form.append(field, file);

  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Upload failed (${res.status})`);
  }
  return data;
}

/**
 * Fetch a file (with auth) and return an object URL the browser can open.
 * GridFS has no presigned URLs, so downloads stream through the API; window.open
 * can't send a Bearer header, hence this blob-fetch helper.
 */
export async function apiBlobUrl(path) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
