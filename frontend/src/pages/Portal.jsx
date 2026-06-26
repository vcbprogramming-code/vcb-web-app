import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { apps, roleLabels } from '../config/nav.js';
import { formatThaiLongDate } from '../lib/ememo.js';
import Icon from '../components/Icon.jsx';

export default function Portal() {
  const { profile, user, logout } = useAuth();
  const navigate = useNavigate();
  const role = profile?.role;

  const visible = apps.filter(
    (a) => a.enabled !== false && (!a.roles || (role && a.roles.includes(role)))
  );

  const displayName = profile?.full_name || user?.email || 'ผู้ใช้งาน';
  const firstName = displayName.split(' ')[0];

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-full bg-slate-50">
      {/* sticky glass header */}
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-light text-white shadow-sm shadow-brand/30">
              <Icon name="layers" className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-slate-900">VCB Connect</div>
              <div className="text-[11px] text-slate-500">ระบบงานภายใน วิจิตรภัณฑ์ก่อสร้าง</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-tint text-xs font-bold text-brand">
                {firstName.slice(0, 1).toUpperCase()}
              </div>
              <div className="text-right leading-tight">
                <div className="text-xs font-semibold text-slate-800">{displayName}</div>
                <div className="text-[10px] text-slate-500">{roleLabels[role] || role}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            >
              <Icon name="logout" className="h-4 w-4" /> <span className="hidden sm:inline">ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl px-4 py-8 md:px-8 md:py-10">
        {/* hero */}
        <section className="relative mb-10 overflow-hidden rounded-[28px] bg-gradient-to-br from-brand via-brand to-brand-light p-8 text-white shadow-xl shadow-brand/20 md:p-12">
          {/* decorative glows + grid */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-24 left-10 h-72 w-72 rounded-full bg-brand-light/40 blur-3xl" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '22px 22px',
            }}
          />

          <div className="relative">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-400/30 to-teal-400/20 px-3 py-1 text-xs font-semibold text-white shadow-sm ring-1 ring-inset ring-white/25 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_8px] shadow-emerald-300" />
                ระบบออนไลน์
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-white/25 to-white/10 px-3 py-1 text-xs font-semibold text-white shadow-sm ring-1 ring-inset ring-white/25 backdrop-blur-sm">
                <Icon name="layers" className="h-3.5 w-3.5" /> {visible.length} แอป
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-300/25 to-indigo-300/15 px-3 py-1 text-xs font-semibold text-white shadow-sm ring-1 ring-inset ring-white/25 backdrop-blur-sm">
                <Icon name="calendar" className="h-3.5 w-3.5" /> {formatThaiLongDate(new Date())}
              </span>
            </div>

            <h1 className="mt-6 text-3xl font-bold tracking-tight md:text-[42px] md:leading-[1.1]">
              ยินดีต้อนรับสู่ระบบงานภายใน
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/80 md:text-base">
              ศูนย์รวมแอปพลิเคชันภายในของกลุ่มวิจิตรภัณฑ์ก่อสร้าง — เลือกแอปที่ต้องการใช้งานด้านล่าง รองรับการใช้งานทุกอุปกรณ์
            </p>
          </div>
        </section>

        {/* app grid */}
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">แอปพลิเคชัน</h2>
            <p className="text-sm text-slate-500">เลือกระบบที่ต้องการเปิดใช้งาน</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
            {visible.length} รายการ
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((app) => (
            <button
              key={app.to}
              onClick={() => navigate(app.to)}
              className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand/30 hover:shadow-xl hover:shadow-brand/10"
            >
              {/* hover accent wash */}
              <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-brand-tint opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

              <div
                className={`relative flex h-14 w-14 items-center justify-center rounded-2xl ${app.color} ring-1 ring-inset ring-black/5 transition-transform duration-300 group-hover:scale-105`}
              >
                <Icon name={app.icon} className="h-7 w-7" />
              </div>

              <h3 className="relative mt-5 text-base font-bold text-slate-900">{app.title}</h3>
              <p className="relative mt-1.5 flex-1 text-sm leading-relaxed text-slate-500">{app.desc}</p>

              <span className="relative mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                เปิดใช้งาน
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-tint transition-all duration-300 group-hover:translate-x-1 group-hover:bg-brand group-hover:text-white">
                  <Icon name="arrowRight" className="h-3.5 w-3.5" />
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* footer note */}
        <p className="mt-12 text-center text-xs text-slate-400">
          VCB Connect · ระบบงานภายใน กลุ่มวิจิตรภัณฑ์ก่อสร้าง
        </p>
      </main>
    </div>
  );
}
