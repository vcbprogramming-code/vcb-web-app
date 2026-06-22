import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { moduleTitles, roleLabels } from '../config/nav.js';
import Icon from './Icon.jsx';

/** Resolve the module title from the current path (longest matching prefix). */
function titleFor(pathname) {
  const match = Object.keys(moduleTitles)
    .filter((p) => pathname === p || pathname.startsWith(p + '/'))
    .sort((a, b) => b.length - a.length)[0];
  return match ? moduleTitles[match] : '';
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

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              <Icon name="arrowLeft" className="h-4 w-4" /> กลับ Portal
            </button>
            <div className="hidden h-6 w-px bg-slate-200 sm:block" />
            <h1 className="truncate text-base font-bold text-slate-800">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-slate-800">{profile?.full_name || user?.email}</div>
              <div className="text-xs text-slate-500">{roleLabels[role] || role}</div>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
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
