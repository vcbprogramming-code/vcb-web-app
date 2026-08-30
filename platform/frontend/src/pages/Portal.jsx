import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { apps, roleLabels } from '../config/nav.js';
import { formatThaiLongDate } from '../lib/ememo.js';
import Icon from '../components/Icon.jsx';
import GlowOrb from '../components/GlowOrb.jsx';
import GlobeMark from '../components/GlobeMark.jsx';

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
    <div className="cyber-bg min-h-full text-slate-100">
      {/* sticky glass header */}
      <header className="sticky top-0 z-30 border-b border-cyan-300/10 bg-[#060b18]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/15 to-blue-500/10 ring-1 ring-cyan-300/30 shadow-[0_0_18px_-6px_rgba(34,211,238,0.7)]">
              <GlobeMark className="h-6 w-6" />
            </div>
            <div className="leading-tight">
              <div className="cyber-title text-sm font-bold text-white">
                VCB <span className="text-cyan-300">CONNECT</span>
              </div>
              <div className="cyber-label text-[9px] text-cyan-200/50">Internal Intranet Portal</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2.5 rounded-full border border-cyan-300/20 bg-white/[0.03] py-1 pl-1 pr-3 sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-bold text-cyan-200 ring-1 ring-inset ring-cyan-300/30">
                {firstName.slice(0, 1).toUpperCase()}
              </div>
              <div className="text-right leading-tight">
                <div className="text-xs font-semibold text-slate-100">{displayName}</div>
                <div className="text-[10px] text-cyan-200/50">{roleLabels[role] || role}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/20 bg-white/[0.03] px-3 py-1.5 text-sm text-slate-300 transition hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-300"
            >
              <Icon name="logout" className="h-4 w-4" /> <span className="hidden sm:inline">ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-screen-xl px-4 py-10 md:px-8 md:py-14">
        {/* hero */}
        <section className="relative mb-14 grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
          {/* perspective grid behind the hero */}
          <div className="pointer-events-none absolute inset-x-0 -top-10 bottom-0 cyber-grid" />

          <div className="relative">
            <div className="mb-6 flex flex-wrap items-center gap-2.5">
              <span className="cyber-badge">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_8px] shadow-emerald-300" />
                System Online
              </span>
              <span className="cyber-badge">
                <Icon name="layers" className="h-3.5 w-3.5" /> {visible.length} Apps
              </span>
              <span className="cyber-badge">
                <Icon name="calendar" className="h-3.5 w-3.5" /> {formatThaiLongDate(new Date())}
              </span>
            </div>

            <h1 className="cyber-title text-4xl font-extrabold leading-[1.05] text-white md:text-6xl">
              WELCOME TO
              <br />
              <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-400 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(34,211,238,0.35)]">
                VCB CONNECT
              </span>
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-300/80 md:text-base">
              ยินดีต้อนรับสู่ศูนย์รวมแอปพลิเคชันภายในของกลุ่มวิจิตรภัณฑ์ก่อสร้าง
              — เลือกระบบที่ต้องการใช้งานด้านล่าง รองรับทุกอุปกรณ์
            </p>
          </div>

          {/* animated globe */}
          <div className="relative flex justify-center lg:justify-end">
            <GlowOrb size={380} className="animate-float-slow max-w-full" />
          </div>
        </section>

        {/* section heading */}
        <div className="mb-5 flex items-end justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_10px] shadow-cyan-300" />
            <h2 className="cyber-label text-sm font-bold text-cyan-100">Applications</h2>
          </div>
          <span className="cyber-label text-xs text-cyan-200/40">{visible.length} Available</span>
        </div>

        {/* app grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((app) => (
            <button
              key={app.to}
              onClick={() => navigate(app.to)}
              className="cyber-panel group relative flex flex-col overflow-hidden p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/40"
            >
              {/* corner accents */}
              <span className="pointer-events-none absolute left-3 top-3 h-3 w-3 border-l border-t border-cyan-300/40 opacity-60 transition-opacity group-hover:opacity-100" />
              <span className="pointer-events-none absolute bottom-3 right-3 h-3 w-3 border-b border-r border-cyan-300/40 opacity-60 transition-opacity group-hover:opacity-100" />
              {/* hover glow */}
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-cyan-400/20 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-blue-500/10 text-cyan-200 ring-1 ring-inset ring-cyan-300/30 transition-transform duration-300 group-hover:scale-105">
                <Icon name={app.icon} className="h-7 w-7" />
              </div>

              <h3 className="relative mt-5 text-base font-bold text-white">{app.title}</h3>
              <p className="relative mt-1.5 flex-1 text-sm leading-relaxed text-slate-400">{app.desc}</p>

              <span className="cyber-label relative mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                Launch
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400/15 ring-1 ring-inset ring-cyan-300/30 transition-all duration-300 group-hover:translate-x-1 group-hover:bg-cyan-300 group-hover:text-slate-900">
                  <Icon name="arrowRight" className="h-3.5 w-3.5" />
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* footer note */}
        <p className="cyber-label mt-14 text-center text-[10px] text-cyan-200/30">
          VCB Connect · ระบบงานภายใน กลุ่มวิจิตรภัณฑ์ก่อสร้าง
        </p>
      </main>
    </div>
  );
}
