import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { moduleTitles, roleLabels } from '../config/nav.js';
import Icon from './Icon.jsx';
import GlobeMark from './GlobeMark.jsx';

/** Resolve the module title from the current path (longest matching prefix). */
function titleFor(pathname) {
  const match = Object.keys(moduleTitles)
    .filter((p) => pathname === p || pathname.startsWith(p + '/'))
    .sort((a, b) => b.length - a.length)[0];
  return match ? moduleTitles[match] : '';
}

/** Brand name in the header — per active module (E-Memo shows "VCB E-Memo"). */
function brandFor(pathname) {
  if (pathname.startsWith('/memos') || pathname.startsWith('/dashboard')) return 'VCB E-Memo';
  return 'VCB Connect';
}

/**
 * Shell for module pages: a slim top bar with "back to Portal", the module
 * title, and the user/logout block. No sidebar.
 */
export default function ModuleShell() {
  const { profile, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const role = profile?.role;
  const title = titleFor(location.pathname);
  const brand = brandFor(location.pathname);
  // Light page everywhere; E-Memo + admin/settings get a dark-navy HEADER only
  // (the client found a full dark page too heavy). Portal/Login keep their own
  // sci-fi theme elsewhere.
  const navyHeader = location.pathname.startsWith('/memos')
    || location.pathname.startsWith('/dashboard')
    || location.pathname.startsWith('/admin');

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className={`sticky top-0 z-20 border-b backdrop-blur-lg ${navyHeader ? 'border-white/10 bg-[#0a1226]/95' : 'border-slate-200/70 bg-white/80'}`}>
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => navigate('/')}
              title="กลับสู่หน้า Portal"
              className="group flex min-w-0 items-center gap-3 rounded-xl px-1 py-0.5 transition hover:opacity-90"
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl transition group-hover:scale-105 ${navyHeader ? 'bg-gradient-to-br from-cyan-400/15 to-blue-500/10 ring-1 ring-cyan-300/30' : 'bg-white shadow-sm ring-1 ring-slate-200'}`}>
                {navyHeader
                  ? <GlobeMark className="h-6 w-6" />
                  : <img src="/logo.png" alt="VCB" className="h-9 w-9 object-contain" />}
              </span>
              <span className="min-w-0 text-left leading-tight">
                <span className={`block text-sm font-bold tracking-tight ${navyHeader ? 'text-white' : 'text-slate-900'}`}>{brand}</span>
                {title && <span className={`block truncate text-[11px] ${navyHeader ? 'text-cyan-200/60' : 'text-slate-500'}`}>{title}</span>}
              </span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/profile')}
              title="โปรไฟล์ของฉัน"
              className={`hidden rounded-lg px-2 py-1 text-right transition sm:block ${navyHeader ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}
            >
              <div className={`text-sm font-medium ${navyHeader ? 'text-slate-100' : 'text-slate-800'}`}>{profile?.full_name || user?.email}</div>
              <div className={`text-xs ${navyHeader ? 'text-cyan-200/60' : 'text-slate-500'}`}>{roleLabels[role] || role}</div>
            </button>
            <button
              onClick={handleLogout}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition ${navyHeader ? 'border-white/15 bg-white/[0.06] text-slate-200 hover:bg-white/[0.12]' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
              title="ออกจากระบบ"
            >
              <Icon name="logout" className="h-4 w-4" />
              <span className="hidden md:inline">ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6 md:px-8">
        <Outlet />
      </main>
    </div>
  );
}
