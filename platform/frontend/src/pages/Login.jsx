import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../lib/api.js';
import Icon from '../components/Icon.jsx';
import GlowOrb from '../components/GlowOrb.jsx';
import GlobeMark from '../components/GlobeMark.jsx';

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
          theme: 'filled_black',
          size: 'large',
          width: 320,
          text: 'signin_with',
          shape: 'pill',
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
    <div className="cyber-bg relative flex min-h-full w-full items-center justify-center overflow-hidden p-4">
      {/* perspective grid backdrop */}
      <div className="pointer-events-none absolute inset-0 cyber-grid opacity-70" />

      {/* two-pane composition: brand + orb (left) · card (right) */}
      <div className="relative grid w-full max-w-5xl items-center gap-8 lg:grid-cols-2">
        {/* left brand pane (hidden on small screens) */}
        <div className="relative hidden flex-col items-center justify-center lg:flex">
          <GlowOrb size={420} className="animate-float-slow" />
          <div className="mt-4 text-center">
            <h2 className="cyber-title text-3xl font-extrabold text-white">
              VCB <span className="text-cyan-300 drop-shadow-[0_0_18px_rgba(34,211,238,0.5)]">CONNECT</span>
            </h2>
            <p className="cyber-label mt-2 text-[10px] text-cyan-200/50">Internal Intranet Portal</p>
          </div>
        </div>

        {/* login card */}
        <div className="cyber-panel relative mx-auto w-full max-w-md p-8">
        {/* corner accents */}
        <span className="pointer-events-none absolute left-3 top-3 h-4 w-4 border-l border-t border-cyan-300/40" />
        <span className="pointer-events-none absolute bottom-3 right-3 h-4 w-4 border-b border-r border-cyan-300/40" />

        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/25 to-blue-500/15 ring-1 ring-inset ring-cyan-300/40 shadow-[0_0_30px_-6px_rgba(34,211,238,0.6)]">
            <GlobeMark className="h-9 w-9" />
          </div>
          <h1 className="cyber-title text-2xl font-extrabold tracking-wide text-white">
            VCB <span className="text-cyan-300 drop-shadow-[0_0_16px_rgba(34,211,238,0.5)]">CONNECT</span>
          </h1>
          <p className="cyber-label mt-2 text-[10px] text-cyan-200/50">ระบบงานภายใน · วิจิตรภัณฑ์ก่อสร้าง</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        )}

        {/* Sign in with Google (shown only when configured on the backend) */}
        {googleClientId && (
          <>
            {/* wrapper clips the GIS iframe's default light frame to a clean pill */}
            <div className="flex justify-center">
              <div className="overflow-hidden rounded-full ring-1 ring-cyan-300/25" style={{ colorScheme: 'dark', lineHeight: 0 }}>
                <div ref={googleBtnRef} />
              </div>
            </div>
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-cyan-300/15" />
              <span className="cyber-label text-[10px] text-cyan-200/50">หรือ</span>
              <span className="h-px flex-1 bg-cyan-300/15" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="cyber-label mb-1.5 block text-[11px] font-semibold text-cyan-200">อีเมล</label>
            <input
              type="email"
              className="cyber-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>
          <div>
            <label className="cyber-label mb-1.5 block text-[11px] font-semibold text-cyan-200">รหัสผ่าน</label>
            <input
              type="password"
              className="cyber-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <p className="mt-1.5 text-xs text-slate-500">บัญชีที่ผู้ดูแลระบบสร้างให้ (อีเมล + รหัสผ่าน)</p>
          </div>

          <button type="submit" className="cyber-btn w-full" disabled={submitting}>
            {submitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบด้วยอีเมล'}
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}
