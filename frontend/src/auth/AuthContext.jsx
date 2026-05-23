import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, tokenStore } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, if we have a token, restore the session by fetching /auth/me.
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      setLoading(false);
      return;
    }
    api('/auth/me')
      .then((res) => {
        setUser(res.user);
        setProfile(res.profile);
      })
      .catch(() => {
        tokenStore.clear();
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api('/auth/login', {
      method: 'POST',
      auth: false,
      body: { email, password },
    });
    tokenStore.set(res.session.access_token);
    setUser(res.user);
    setProfile(res.profile);
    return res;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
