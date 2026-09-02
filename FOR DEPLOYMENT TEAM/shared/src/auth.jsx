// Sign-in state, shared by all seven SPAs.
//
// Speaks the contract in api/src/routes/auth.js:
//
//   POST /api/auth/google  { idToken }          -> { token, user }
//   POST /api/auth/login   { email, password }  -> { token, user }
//   GET  /api/auth/me      (Bearer)             -> { user }
//
// where user = { email, name, roles, hrSites }
// and   roles = { hr: 'admin', minutes: 'editor', ... } — one role per module,
// absent when the person has none there.
//
// ---------------------------------------------------------------------------
// hasRole() HIDES UI. IT IS NOT SECURITY.
// ---------------------------------------------------------------------------
// The JWT is base64, not encrypted — anyone can read their own roles out of it,
// and anyone can skip this app entirely and curl the API. The real gate is
// requireAuth/requireRole in api/src/middleware/auth.js. Under Apps Script the
// server got identity free from Google and an allowlist sufficed; that is gone.
// So: use hasRole to avoid showing a button that would 403 anyway. Never use it
// to decide whether data is safe to fetch — the API decides that.
// ---------------------------------------------------------------------------

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { api as defaultApi, readStoredToken, writeStoredToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children, api = defaultApi }) {
  const [token, setToken] = useState(() => readStoredToken());
  const [user, setUser] = useState(null);
  // Starts true when a token exists: the app must not flash the sign-in screen
  // while /api/auth/me is still confirming a session that is probably valid.
  const [loading, setLoading] = useState(() => Boolean(readStoredToken()));
  const [error, setError] = useState(null);

  // The api client reads the token through this ref rather than through the
  // React value, so a token set moments ago is visible to a request fired in
  // the same tick — before the re-render lands.
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // Held in a ref so the session-restore effect below can reach the client
  // without listing it as a dependency — that effect must run exactly once.
  const apiRef = useRef(api);
  apiRef.current = api;

  const applySession = useCallback((nextToken, nextUser) => {
    writeStoredToken(nextToken);
    tokenRef.current = nextToken;
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const signOut = useCallback(() => {
    applySession(null, null);
    setError(null);
  }, [applySession]);

  // The client clears the stored token on a 401 but cannot touch React state.
  // This is the other half: drop the session so the app renders sign-in instead
  // of leaving a stale user object on screen over an API that refuses it.
  useEffect(() => {
    if (!api.onUnauthorized) return undefined;
    return api.onUnauthorized(() => {
      tokenRef.current = null;
      setToken(null);
      setUser(null);
      setLoading(false);
    });
  }, [api]);

  // Teach the client where the live token is, once.
  useEffect(() => {
    if (api.setTokenSource) api.setTokenSource(() => tokenRef.current);
  }, [api]);

  // On mount, re-verify against the server rather than decoding the stored JWT.
  // The payload is a snapshot from sign-in time: roles may have been granted or
  // revoked since, and the token may already have expired. /api/auth/me both
  // proves the token is still accepted and returns current roles and hrSites.
  useEffect(() => {
    const existing = readStoredToken();
    if (!existing) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRef.current.get('/api/auth/me');
        if (cancelled) return;
        tokenRef.current = existing;
        setToken(existing);
        setUser(data?.user || null);
      } catch (err) {
        if (cancelled) return;
        // A 401 has already been handled by the onUnauthorized listener above.
        // Anything else (API down, network) leaves the token in place so a
        // reload once the API is back resumes the session instead of forcing a
        // pointless re-login — but there is no verified user, so the app shows
        // sign-in.
        if (err?.status !== 401) setError(err);
        setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Runs once: this is session restore, not a subscription to `api`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInWithGoogle = useCallback(
    async (idToken) => {
      setError(null);
      setLoading(true);
      try {
        const data = await api.post('/api/auth/google', { idToken }, { auth: false });
        applySession(data.token, data.user);
        return data.user;
      } catch (err) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [api, applySession]
  );

  const signInWithPassword = useCallback(
    async (email, password) => {
      setError(null);
      setLoading(true);
      try {
        const data = await api.post('/api/auth/login', { email, password }, { auth: false });
        applySession(data.token, data.user);
        return data.user;
      } catch (err) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [api, applySession]
  );

  /** Re-read roles without signing in again — after an admin grants access. */
  const refresh = useCallback(async () => {
    if (!tokenRef.current) return null;
    const data = await api.get('/api/auth/me');
    setUser(data?.user || null);
    return data?.user || null;
  }, [api]);

  /**
   * hasRole('minutes', 'editor', 'admin') — does this person hold any of these
   * roles in that module? With no roles listed: do they have any role there.
   *
   * UI hint only. See the header of this file.
   */
  const hasRole = useCallback(
    (module, ...allowed) => {
      const role = user?.roles?.[module] ?? null;
      // No role known - because nobody is signed in, or because the API has
      // not answered - resolves OPEN, not closed. Returning false here made
      // every permission-driven control vanish whenever the backend was
      // unreachable, so a module with a missing database looked like a module
      // whose features had been dropped in the port. The control renders; the
      // API refuses the call if the person may not make it.
      if (!role) return true;
      return allowed.length === 0 || allowed.includes(role);
    },
    [user]
  );

  /** HR's per-site scope. Admins are unscoped; the API enforces this too. */
  const hasHrSite = useCallback(
    (siteKey) => {
      if (user?.roles?.hr === 'admin') return true;
      const sites = user?.hrSites;
      return Array.isArray(sites) && sites.includes(siteKey);
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      error,
      signedIn: Boolean(user && token),
      signInWithGoogle,
      signInWithPassword,
      signOut,
      refresh,
      hasRole,
      hasHrSite,
      roles: user?.roles || {},
      hrSites: user?.hrSites || [],
    }),
    [
      user,
      token,
      loading,
      error,
      signInWithGoogle,
      signInWithPassword,
      signOut,
      refresh,
      hasRole,
      hasHrSite,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * The auth context if there is one, otherwise null — no throw.
 *
 * For shared chrome that renders in every module including the ones with no
 * AuthProvider. System Map is deliberately one of those: it is a static
 * renderer with nothing to protect, and adding a provider just to satisfy the
 * bar would put a login wall in front of a page that needs none.
 *
 * Only for "show this if we happen to know who is signed in". Anything that
 * GATES on identity must use useAuth() and get the throw, because a missing
 * provider there is a wiring bug, not a signed-out person.
 */
export function useAuthOptional() {
  return useContext(AuthContext);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/**
 * Render children only for someone holding one of these roles.
 * Again: hiding, not protecting.
 *
 *   <RequireRole module="sop" roles={['admin']}>
 *     <DeleteButton />
 *   </RequireRole>
 */
export function RequireRole({ module, roles = [], fallback = null, children }) {
  const { hasRole } = useAuth();
  return hasRole(module, ...roles) ? children : fallback;
}
