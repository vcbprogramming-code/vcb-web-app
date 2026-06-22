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

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-full bg-slate-50">
      {/* top header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
              <Icon name="layers" className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-slate-900">VCB Connect</div>
              <div className="text-[11px] text-slate-500">ระบบงานภายใน วิจิตรภัณฑ์ก่อสร้าง</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-slate-800">{profile?.full_name || user?.email}</div>
              <div className="text-xs text-slate-500">{roleLabels[role] || role}</div>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <Icon name="logout" className="h-4 w-4" /> ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        {/* hero */}
        <section className="mb-8 overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-brand to-brand-light p-8 text-white md:p-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-white/15 text-white">ระบบออนไลน์</span>
            <span className="chip bg-white/15 text-white">{visible.length} แอป</span>
            <span className="chip bg-white/15 text-white">{formatThaiLongDate(new Date())}</span>
          </div>
          <h1 className="mt-4 text-3xl font-bold md:text-4xl">ยินดีต้อนรับสู่ระบบงานภายใน</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/80 md:text-base">
            ศูนย์รวมแอปพลิเคชันภายในของกลุ่มวิจิตรภัณฑ์ก่อสร้าง — เลือกแอปที่ต้องการใช้งานด้านล่าง ใช้ได้ทุกอุปกรณ์
          </p>
        </section>

        {/* app grid */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">แอปพลิเคชัน</h2>
          <span className="text-xs text-slate-400">{visible.length} รายการ</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((app) => (
            <button
              key={app.to}
              onClick={() => navigate(app.to)}
              className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 text-left transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${app.color}`}>
                <Icon name={app.icon} className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-bold text-slate-800">{app.title}</h3>
              <p className="mt-1 flex-1 text-sm text-slate-500">{app.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand">
                เปิดใช้งาน <Icon name="arrowRight" className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
