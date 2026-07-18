import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, tokenStore } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // Set when we hold a token but couldn't reach the server to restore the
  // session (network/cold-start/5xx). Distinct from "no token" — we must NOT
  // silently log the user out on a transient failure.
  const [authError, setAuthError] = useState(null);

  const restore = useCallback(async () => {
    const token = tokenStore.get();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setAuthError(null);
    try {
      const res = await api('/auth/me');
      setUser(res.user);
      setProfile(res.profile);
      setAuthError(null);
    } catch (err) {
      if (err?.status === 401) {
        // token genuinely invalid/expired — drop it and fall through to /login
        tokenStore.clear();
        setUser(null);
        setProfile(null);
      } else {
        // network / cold start / server error — keep the token, offer a retry
        setAuthError(err?.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount, restore the session if we have a token.
  useEffect(() => { restore(); }, [restore]);

  const login = useCallback(async (email, password) => {
    const res = await api('/auth/login', {
      method: 'POST',
      auth: false,
      body: { email, password },
    });
    tokenStore.set(res.session.access_token);
    setUser(res.user);
    setProfile(res.profile);
    setAuthError(null);
    return res;
  }, []);

  // Sign in with Google: exchange the Google ID token (credential) for our JWT.
  const loginWithGoogle = useCallback(async (credential) => {
    const res = await api('/auth/google', {
      method: 'POST',
      auth: false,
      body: { credential },
    });
    tokenStore.set(res.session.access_token);
    setUser(res.user);
    setProfile(res.profile);
    setAuthError(null);
    return res;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setProfile(null);
    setAuthError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, authError, login, loginWithGoogle, logout, retry: restore }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
