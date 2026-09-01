// HTTP client for the single Express API at api/.
//
// Every module talks to the same backend, so the base URL, the Authorization
// header and the error shape are written once here rather than seven times.
//
// The API's failure shape is fixed by api/src/middleware/error.js:
//
//   { error: 'VALIDATION_FAILED', issues: [{ path, message }] }
//   { error: 'FORBIDDEN', module, need }
//   { error: 'BAD_CREDENTIALS' }
//   { error: 'INTERNAL' }
//
// `error` is always a machine-readable code, never prose meant for a user.
// Callers branch on `err.code` and render their own Thai/English message
// through t(); they must not print `err.message` at a user.

export const TOKEN_KEY = 'vcb_token';

/**
 * localStorage throws — it is not merely empty — in a Safari private window,
 * when a browser is set to block site data, and inside some embedded webviews.
 * An uncaught throw here happens during module init and takes the whole app
 * down with a blank screen, so every access is wrapped. Losing the remembered
 * session is an acceptable degradation; a white page is not.
 */
export function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeStoredToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked — the session simply will not survive a reload */
  }
}

export function clearStoredToken() {
  writeStoredToken(null);
}

/** An API failure. `code` is the API's `error` string; `status` is the HTTP status. */
export class ApiError extends Error {
  constructor(code, status, extra) {
    super(code || 'REQUEST_FAILED');
    this.name = 'ApiError';
    this.code = code || 'REQUEST_FAILED';
    this.status = status;
    // Only VALIDATION_FAILED carries these; forms use them to mark fields.
    this.issues = extra?.issues || null;
    // FORBIDDEN carries module/need — useful when explaining what is missing.
    this.module = extra?.module ?? null;
    this.need = extra?.need ?? null;
    this.body = extra ?? null;
  }
}

function resolveBaseUrl(explicit) {
  if (explicit) return String(explicit).replace(/\/+$/, '');
  // Vite substitutes import.meta.env at build time. Guarded because this module
  // is also loaded by Node in tests, where import.meta.env does not exist.
  const fromEnv =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_API_URL
      : undefined;
  return String(fromEnv || '').replace(/\/+$/, '');
}

/**
 * Create the client.
 *
 *   const api = createApi();                      // VITE_API_URL
 *   const api = createApi('http://localhost:8080');
 *
 * AuthProvider wires `getToken` and `onUnauthorized` into it; used standalone
 * the client falls back to reading the token straight out of localStorage.
 */
export function createApi(baseUrl, options = {}) {
  const base = resolveBaseUrl(baseUrl);
  let getToken = options.getToken || readStoredToken;
  const listeners = new Set();
  if (options.onUnauthorized) listeners.add(options.onUnauthorized);

  async function request(method, path, body, opts = {}) {
    const url = base + (path.startsWith('/') ? path : `/${path}`);
    const token = opts.auth === false ? null : getToken();

    const headers = { Accept: 'application/json', ...(opts.headers || {}) };
    let payload;
    if (body instanceof FormData) {
      // Let the browser set multipart/form-data with its own boundary.
      payload = body;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: payload,
        signal: opts.signal,
      });
    } catch (err) {
      // fetch only rejects on network/CORS failure, never on a 4xx/5xx.
      if (err?.name === 'AbortError') throw err;
      throw new ApiError('NETWORK_ERROR', 0, { cause: String(err) });
    }

    if (res.status === 204) return null;

    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    let data = null;
    if (isJson) {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    } else if (opts.raw) {
      // Callers that want a file (PDF, xlsx) ask for the Response itself.
      if (!res.ok) throw new ApiError('REQUEST_FAILED', res.status, null);
      return res;
    }

    if (res.ok) return data;

    // 401 means the token is gone, expired, or was signed with another secret
    // (api/src/middleware/auth.js: AUTH_REQUIRED / AUTH_INVALID). Keeping it
    // would make every subsequent request fail the same way, and any component
    // that retries on error would spin forever against a dead session. So we
    // drop it here, at the one place that sees the status, and tell the auth
    // layer to fall back to the sign-in screen.
    //
    // Deliberately NOT done for 403: there the token is valid, the person just
    // lacks a role. Signing them out for that would be baffling.
    if (res.status === 401) {
      clearStoredToken();
      for (const fn of listeners) {
        try {
          fn(new ApiError(data?.error || 'AUTH_REQUIRED', 401, data));
        } catch {
          /* a broken listener must not mask the original failure */
        }
      }
    }

    throw new ApiError(data?.error, res.status, data);
  }

  return {
    get: (path, opts) => request('GET', path, undefined, opts),
    post: (path, body, opts) => request('POST', path, body, opts),
    put: (path, body, opts) => request('PUT', path, body, opts),
    patch: (path, body, opts) => request('PATCH', path, body, opts),
    del: (path, opts) => request('DELETE', path, undefined, opts),

    baseUrl: base,

    /** AuthProvider uses this to be told about 401s. Returns an unsubscribe. */
    onUnauthorized(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /**
     * Point the client at AuthProvider's in-memory token instead of
     * localStorage. Matters when storage is blocked: the session then lives
     * only in React state, and without this every request would go unsigned.
     */
    setTokenSource(fn) {
      getToken = fn || readStoredToken;
    },
  };
}

/** The default instance. Modules that do not need a custom base URL use this. */
export const api = createApi();
