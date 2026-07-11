import { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { moduleTitles, roleLabels } from '../config/nav.js';
import { useTheme } from '../theme/ThemeContext.jsx';
import { useHeaderSlotValue } from './HeaderSlot.jsx';
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
  const { isDark, toggle } = useTheme();
  const headerSlot = useHeaderSlotValue();
  const navigate = useNavigate();
  const location = useLocation();
  const role = profile?.role;
  // user menu (#4): logout/theme/profile are tucked behind the name so they can't
  // be hit by accident while reaching for the prominent "add document" button.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);
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
          {/* page-injected actions/stats (fills the old blue banner's role) */}
          {headerSlot && (
            <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
              {headerSlot}
            </div>
          )}
          {/* user menu (#4): one avatar/name button opens a dropdown holding
              profile, theme toggle and logout — declutters the bar and prevents
              accidental logout next to the "add document" action. */}
          <div className="relative flex shrink-0 items-center" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="เมนูผู้ใช้"
              className={`flex items-center gap-2 rounded-xl px-2 py-1.5 transition ${navyHeader ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${navyHeader ? 'bg-cyan-400/15 text-cyan-100 ring-1 ring-cyan-300/30' : 'bg-brand/10 text-brand'}`}>
                {(profile?.full_name || user?.email || '?').trim().charAt(0).toUpperCase()}
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className={`block max-w-[160px] truncate text-sm font-medium ${navyHeader ? 'text-slate-100' : 'text-slate-800'}`}>{profile?.full_name || user?.email}</span>
                <span className={`block text-xs ${navyHeader ? 'text-cyan-200/60' : 'text-slate-500'}`}>{roleLabels[role] || role}</span>
              </span>
              <Icon name="chevronDown" className={`h-4 w-4 shrink-0 transition ${menuOpen ? 'rotate-180' : ''} ${navyHeader ? 'text-cyan-200/70' : 'text-slate-400'}`} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1.5 shadow-xl">
                <div className="border-b border-slate-100 px-4 py-2.5 sm:hidden">
                  <div className="truncate text-sm font-medium text-slate-800">{profile?.full_name || user?.email}</div>
                  <div className="text-xs text-slate-500">{roleLabels[role] || role}</div>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); navigate('/profile'); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <Icon name="user" className="h-4 w-4 text-slate-400" /> โปรไฟล์ของฉัน
                </button>
                <button
                  onClick={toggle}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <Icon name={isDark ? 'sun' : 'moon'} className="h-4 w-4 text-slate-400" /> {isDark ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  onClick={() => { setMenuOpen(false); handleLogout(); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  <Icon name="logout" className="h-4 w-4" /> ออกจากระบบ
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6 md:px-8">
        <Outlet />
      </main>
    </div>
  );
}
