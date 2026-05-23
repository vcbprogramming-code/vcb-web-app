import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { navItems, roleLabels } from '../config/nav.js';

export default function AppLayout() {
  const { profile, user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const role = profile?.role;
  const visibleItems = navItems.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-brand text-white transition-transform md:static md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-5">
          <span className="text-lg font-bold">HR System</span>
        </div>
        <nav className="space-y-1 p-3">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  isActive ? 'bg-white/15 font-medium' : 'text-white/80 hover:bg-white/10'
                }`
              }
            >
              <span aria-hidden>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Backdrop for mobile */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            onClick={() => setOpen(true)}
            aria-label="เปิดเมนู"
          >
            ☰
          </button>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium text-slate-800">
                {profile?.full_name || user?.email}
              </div>
              <div className="text-xs text-slate-500">
                {roleLabels[role] || role}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              ออกจากระบบ
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
