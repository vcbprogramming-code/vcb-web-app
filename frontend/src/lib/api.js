// Where the backend API lives. Priority:
//   1. VITE_API_BASE_URL (set per environment)
//   2. on localhost dev → "/api" (Vite proxy to the local backend)
//   3. otherwise → the deployed Render backend (production default)
const isLocalhost =
  typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
const BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (isLocalhost ? '/api' : 'https://vcb-hr-api.onrender.com/api');

const TOKEN_KEY = 'hr_access_token';
// Where to send the user back to after a forced re-login (read by Login.jsx).
const REDIRECT_KEY = 'hr_post_login_redirect';

// Generous timeout: the Render free tier can cold-start for ~30–50s, so a short
// timeout would falsely fail the very first request after the server sleeps.
const DEFAULT_TIMEOUT_MS = 45000;
// File transfers can be large (attachments up to 200 MB) and take far longer than
// a JSON call — the 45s default would abort a healthy transfer mid-flight. (#D3)
const TRANSFER_TIMEOUT_MS = 10 * 60 * 1000;

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/**
 * The API answers in English for programmer-facing conditions ("Document not
 * found"), and those strings were reaching the screen exactly as written — an
 * English sentence in a Thai interface. Everything the user reads is Thai first
 * and translated from there, so the message is turned round here, once, rather
 * than at each of the places that display it. Anything unrecognised is passed
 * through unchanged: a raw message the user can quote to us still beats none.
 */
const SERVER_TH = {
  'Document not found': 'ไม่พบเอกสารนี้',
  'Project not found': 'ไม่พบโครงการนี้',
  'User not found': 'ไม่พบผู้ใช้รายนี้',
  'Facility not found': 'ไม่พบวงเงินนี้',
  'Ledger item not found': 'ไม่พบรายการสินเชื่อนี้',
  'Request not found': 'ไม่พบคำขอนี้',
  'Attachment not found': 'ไม่พบไฟล์แนบนี้',
  'Message not found': 'ไม่พบข้อความนี้',
  'Company not found': 'ไม่พบบริษัทนี้',
  'Doc code not found': 'ไม่พบรหัสเอกสารนี้',
  'Type not found': 'ไม่พบประเภทนี้',
  'Cash plan row not found': 'ไม่พบงวดแผนเงินสดนี้',
  'File not found in storage': 'ไม่พบไฟล์ในที่จัดเก็บ',
  'Not found': 'ไม่พบข้อมูลที่ต้องการ',
  'Invalid input': 'ข้อมูลที่กรอกไม่ถูกต้อง',
  'No fields to update': 'ไม่มีข้อมูลที่เปลี่ยนแปลง',
  'No file uploaded (field "file")': 'ยังไม่ได้เลือกไฟล์',
  'Not authenticated': 'กรุณาเข้าสู่ระบบใหม่',
  'Insufficient permissions': 'ไม่มีสิทธิ์ดำเนินการนี้',
};

/** Build an Error carrying the HTTP status + friendly Thai message. */
function apiError(message, { status, network = false, timeout = false } = {}) {
  const err = new Error(SERVER_TH[message] || message);
  if (status != null) err.status = status;
  if (network) err.network = true;
  if (timeout) err.timeout = true;
  return err;
}

/**
 * On an auth-level failure (expired/invalid token, disabled account — all 401)
 * clear the token, remember where the user was, and bounce to /login. NOT
 * triggered by permission 403s, which are legitimate "you can't do that" errors.
 */
function handleUnauthorized(res, auth) {
  if (res.status === 401 && auth && tokenStore.get()) {
    tokenStore.clear();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      try {
        sessionStorage.setItem(REDIRECT_KEY, window.location.pathname + window.location.search);
      } catch { /* private mode — ignore */ }
      window.location.href = '/login';
    }
  }
}

/** fetch() with an abort timeout; converts low-level failures to Thai errors. */
async function timedFetch(url, options, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw apiError('เซิร์ฟเวอร์ตอบสนองช้ากว่าปกติ (ระบบอาจกำลังเริ่มทำงาน) กรุณาลองใหม่อีกครั้ง', {
        network: true,
        timeout: true,
      });
    }
    // fetch rejects with a TypeError on network/DNS/CORS failures
    throw apiError('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่', {
      network: true,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Thin fetch wrapper that attaches the Bearer token and parses JSON.
 * Throws an Error (with .status) carrying the server's message on non-2xx.
 */
export async function api(path, { method = 'GET', body, auth = true, timeoutMs } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = tokenStore.get();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await timedFetch(
    `${BASE}${path}`,
    { method, headers, body: body ? JSON.stringify(body) : undefined },
    timeoutMs,
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    handleUnauthorized(res, auth);
    throw apiError(data.error || `เกิดข้อผิดพลาด (${res.status})`, { status: res.status });
  }
  return data;
}

/**
 * Upload a file via multipart/form-data. Does NOT set Content-Type — the
 * browser sets the multipart boundary itself. Returns the parsed JSON.
 */
export async function apiUpload(path, file, { field = 'file', extra = {} } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  const form = new FormData();
  if (file) form.append(field, file);
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null) form.append(k, v);
  }

  const res = await timedFetch(`${BASE}${path}`, { method: 'POST', headers, body: form }, TRANSFER_TIMEOUT_MS);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    handleUnauthorized(res, true);
    throw apiError(data.error || `อัปโหลดไม่สำเร็จ (${res.status})`, { status: res.status });
  }
  return data;
}

/**
 * Fetch a file (with auth) and return an object URL the browser can open.
 * Storage downloads stream through the API; window.open can't send a Bearer
 * header, hence this blob-fetch helper.
 */
/**
 * `auth: false` for a token-gated PUBLIC file (the สำเนาเรียน link), where there
 * is no session to attach — the blob step is still required. The API sets
 * `X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'self'`, so pointing an
 * <iframe> straight at an API URL renders nothing once the app and the API sit
 * on different hosts, as they do in production.
 */
export async function apiBlobUrl(path, { auth = true } = {}) {
  const headers = {};
  const token = auth ? tokenStore.get() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await timedFetch(`${BASE}${path}`, { headers }, TRANSFER_TIMEOUT_MS);
  if (!res.ok) {
    if (auth) handleUnauthorized(res, true);
    const data = await res.json().catch(() => ({}));
    throw apiError(data.error || `เปิดไฟล์ไม่สำเร็จ (${res.status})`, { status: res.status });
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** Pop the "return to after login" path saved during a forced logout. */
export function takeRedirectAfterLogin() {
  try {
    const v = sessionStorage.getItem(REDIRECT_KEY);
    if (v) sessionStorage.removeItem(REDIRECT_KEY);
    return v && v !== '/login' ? v : null;
  } catch {
    return null;
  }
}
