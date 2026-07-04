import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../lib/api.js';
import Icon from '../components/Icon.jsx';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

/** Load the Google Identity Services script once. */
function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export default function Login() {
  const { login, loginWithGoogle, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleClientId, setGoogleClientId] = useState(null);
  const googleBtnRef = useRef(null);

  const goDest = useCallback(() => {
    const dest = location.state?.from?.pathname || '/';
    navigate(dest, { replace: true });
  }, [location.state, navigate]);

  // discover whether Google sign-in is configured on the backend
  useEffect(() => {
    api('/auth/config', { auth: false })
      .then((r) => setGoogleClientId(r.data?.googleClientId || null))
      .catch(() => setGoogleClientId(null));
  }, []);

  // once we know the client id, load GIS and render the official button
  useEffect(() => {
    if (!googleClientId || !googleBtnRef.current) return;
    let cancelled = false;
    loadGis()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (resp) => {
            setError('');
            try {
              await loginWithGoogle(resp.credential);
              goDest();
            } catch (err) {
              setError(err.message || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ');
            }
          },
        });
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: 340,
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
        });
      })
      .catch(() => {/* GIS failed to load — email login still works */});
    return () => { cancelled = true; };
  }, [googleClientId, loginWithGoogle, goDest]);

  if (!loading && user) {
    const dest = location.state?.from?.pathname || '/';
    return <Navigate to={dest} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      goDest();
    } catch (err) {
      setError(err.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-brand to-brand-light p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white">
            <Icon name="layers" className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-brand">ระบบงานภายใน</h1>
          <p className="mt-1 text-sm text-slate-500">วิจิตรภัณฑ์ก่อสร้าง</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Sign in with Google (shown only when configured on the backend) */}
        {googleClientId && (
          <>
            <div className="flex justify-center">
              <div ref={googleBtnRef} />
            </div>
            <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" /> หรือ <span className="h-px flex-1 bg-slate-200" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              อีเมล
            </label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              รหัสผ่าน
            </label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <p className="mt-1 text-xs text-slate-400">บัญชีที่ผู้ดูแลระบบสร้างให้ (อีเมล + รหัสผ่าน)</p>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบด้วยอีเมล'}
          </button>
        </form>
      </div>
    </div>
  );
}
