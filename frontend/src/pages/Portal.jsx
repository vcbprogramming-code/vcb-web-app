import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useTheme } from '../theme/ThemeContext.jsx';
import { apps, roleLabels } from '../config/nav.js';
import { formatThaiLongDate, ememoApi } from '../lib/ememo.js';
import { portalApi } from '../lib/portal.js';
import Icon from '../components/Icon.jsx';
import GlobeMark from '../components/GlobeMark.jsx';
import HolidayCalendar from '../components/HolidayCalendar.jsx';
import HelpModal from '../components/HelpModal.jsx';

const greeting = (h) => (h < 12 ? 'สวัสดีตอนเช้า' : h < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น');

/** Ticking clock + greeting. Owns its own 1s interval so only THIS subtree
 *  re-renders each second — the Portal (nav, app cards, calendar) does not. */
function WelcomeCard({ name }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-brand to-blue-600 p-6 text-white shadow-sm dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> ระบบพร้อมใช้งาน
          </div>
          <h1 className="mt-3 text-2xl font-extrabold leading-tight">{greeting(now.getHours())}, {name}</h1>
          <p className="mt-1 text-sm text-white/80">ยินดีต้อนรับสู่ศูนย์รวมแอปพลิเคชันภายในกลุ่มวิจิตรภัณฑ์ก่อสร้าง</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-3xl font-bold tabular-nums tracking-tight">{now.toLocaleTimeString('th-TH', { hour12: false })}</div>
          <div className="mt-0.5 text-xs text-white/80">{formatThaiLongDate(now)}</div>
        </div>
      </div>
    </div>
  );
}

/** One launcher card. Defined at module scope: a component created inside the
 *  Portal's render would be a NEW type every render, so React would unmount +
 *  remount every card (losing hover/focus) on each state change. */
function AppCard({ app, soon, awaiting, onOpen }) {
  return (
    <button
      type="button"
      onClick={soon ? undefined : onOpen}
      // aria-disabled (not `disabled`) keeps the card reachable by keyboard so the
      // "เร็วๆ นี้" state is actually announced instead of being skipped over
      aria-disabled={soon || undefined}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition dark:border-slate-700 ${
        soon ? 'cursor-default opacity-70' : 'hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${app.color || 'bg-slate-100 text-slate-600'}`}>
          <Icon name={app.icon} className="h-6 w-6" />
        </div>
        {soon
          ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">เร็วๆ นี้</span>
          : awaiting > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-[#0f172a]">
              <Icon name="clock" className="h-3.5 w-3.5" /> รออนุมัติ {awaiting}
            </span>
          )}
      </div>
      <h3 className="mt-4 text-base font-bold text-slate-800">{app.title}</h3>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-500">{app.desc}</p>
      {!soon && (
        <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-brand">
          เปิดใช้งาน <Icon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      )}
    </button>
  );
}

/** Sidebar nav row (module scope — same remount reason as AppCard). */
function NavRow({ icon, label, onClick, badge = 0 }) {
  return (
    <button onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
      <Icon name={icon} className="h-[18px] w-[18px] shrink-0" />
      <span className="flex-1 truncate text-left">{label}</span>
      {badge > 0 && <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-[#0f172a]">{badge}</span>}
    </button>
  );
}
const ANNOUNCE_STYLE = {
  info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
};

export default function Portal() {
  const { profile, user, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();
  const role = profile?.role;

  const eff = profile?.effective_permissions;
  const permOk = (a) => !a.perm || !eff || eff[a.perm[0]]?.[a.perm[1]] === true;
  const allowed = (a) => (!a.roles || (role && a.roles.includes(role))) && permOk(a);
  const liveApps = apps.filter((a) => a.enabled !== false && !a.comingSoon && allowed(a));
  // a coming-soon entry is never "live" — guard both sides so one can't render twice
  const soonApps = apps.filter((a) => a.comingSoon && a.enabled === false && allowed(a));

  // greeting should use a person's first name, not their whole email address
  const displayName = profile?.full_name || user?.email || 'ผู้ใช้งาน';
  const shortName = profile?.full_name ? profile.full_name.trim().split(' ')[0] : (user?.email || '').split('@')[0] || 'ผู้ใช้งาน';
  const initial = displayName.trim().slice(0, 1).toUpperCase();

  const [awaiting, setAwaiting] = useState(0);
  const [announcements, setAnnouncements] = useState([]);
  const [annErr, setAnnErr] = useState(false);
  const [q, setQ] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => { ememoApi.awaitingMe().then((r) => setAwaiting(r.data?.count || 0)).catch(() => {}); }, []);
  useEffect(() => {
    let dead = false;
    portalApi.announcements()
      .then((r) => { if (!dead) { setAnnouncements(r.data || []); setAnnErr(false); } })
      .catch(() => { if (!dead) setAnnErr(true); }); // surfaced below, not swallowed
    return () => { dead = true; };
  }, []);

  // close the mobile drawer on Escape
  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setNavOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen]);

  const term = q.trim().toLowerCase();
  const match = (a) => !term || `${a.title} ${a.desc}`.toLowerCase().includes(term);
  const shownLive = liveApps.filter(match);
  const shownSoon = soonApps.filter(match); // searchable too — "แผนผัง" must find System Map

  function handleLogout() { logout(); navigate('/login', { replace: true }); }
  const go = (to) => { setNavOpen(false); navigate(to); };

  return (
    /* Arbitrary page background: index.css remaps bg-slate-50/bg-white in dark
       mode with !important, which would make the PAGE lighter than the CARDS on
       it. An arbitrary value isn't remapped, so the hierarchy stays correct. */
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 dark:bg-[#0b1220] dark:text-slate-100">
      {/* full-bleed: capping at max-w-screen-2xl (1536px) left black bars down
          both sides of any wider monitor */}
      <div className="flex min-h-screen">
        {/* ── Sidebar ── */}
        {navOpen && <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden="true" />}
        <aside id="portal-sidebar" aria-label="เมนูหลัก"
          className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:z-auto lg:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 ring-1 ring-brand/20">
              <GlobeMark className="h-6 w-6" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-extrabold tracking-tight text-slate-800">VCB CONNECT</div>
              <div className="text-[10px] text-slate-500">ระบบงานภายใน</div>
            </div>
          </div>

          <div className="mx-3 mb-2 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/15 text-sm font-bold text-brand">{initial}</div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold text-slate-800">{displayName}</div>
              <div className="text-[11px] text-slate-500">{roleLabels[role] || role}</div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="แอปพลิเคชัน">
            <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">แอปพลิเคชัน</div>
            {liveApps.map((a) => <NavRow key={a.to} icon={a.icon} label={a.title} onClick={() => go(a.to)} badge={a.to === '/memos' ? awaiting : 0} />)}
            <div className="mt-3 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">ช่วยเหลือ</div>
            <NavRow icon="help" label="ช่วยเหลือ / แจ้งปัญหา" onClick={() => { setNavOpen(false); setHelp(true); }} />
          </nav>

          <div className="px-3 py-3">
            <button onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-600">
              <Icon name="logout" className="h-[18px] w-[18px]" /> ออกจากระบบ
            </button>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* topbar */}
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
            <button onClick={() => setNavOpen((v) => !v)} aria-label="เมนู" aria-expanded={navOpen} aria-controls="portal-sidebar"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden">
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <div className="relative max-w-md flex-1">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาแอปพลิเคชัน…" aria-label="ค้นหาแอปพลิเคชัน"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
            </div>
            <button onClick={toggle} aria-label="สลับธีมสว่าง/มืด" aria-pressed={isDark}
              className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100">
              <Icon name={isDark ? 'sun' : 'moon'} className="h-[18px] w-[18px]" />
            </button>
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-3 sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/15 text-xs font-bold text-brand">{initial}</div>
              <span className="text-xs font-semibold text-slate-700">{displayName}</span>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* main column */}
              <div className="space-y-6 lg:col-span-2">
                <WelcomeCard name={shortName} />

                {/* announcements — a failed fetch is shown, not silently hidden */}
                {(announcements.length > 0 || annErr) && (
                  <div className="space-y-2">
                    <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700"><Icon name="bell" className="h-4 w-4 text-brand" /> ประกาศ</h2>
                    {annErr ? (
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                        โหลดประกาศไม่สำเร็จ
                        <button onClick={() => { setAnnErr(false); portalApi.announcements().then((r) => setAnnouncements(r.data || [])).catch(() => setAnnErr(true)); }}
                          className="ml-2 font-semibold text-brand hover:underline">ลองใหม่</button>
                      </div>
                    ) : announcements.map((a) => (
                      <div key={a.id} className={`rounded-xl border px-4 py-3 ${ANNOUNCE_STYLE[a.level] || ANNOUNCE_STYLE.info}`}>
                        <div className="flex items-center gap-1.5 text-sm font-semibold">
                          {a.pinned && <Icon name="pin" className="h-3.5 w-3.5 shrink-0" />}{a.title}
                        </div>
                        {a.body && <div className="mt-0.5 whitespace-pre-wrap text-sm opacity-90">{a.body}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* apps grid */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-700">แอปพลิเคชัน</h2>
                    <span className="text-xs text-slate-500" aria-live="polite">{shownLive.length + shownSoon.length} รายการ</span>
                  </div>
                  {/* a third column once the window is wide enough to carry it */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                    {shownLive.map((a) => (
                      <AppCard key={a.to} app={a} awaiting={a.to === '/memos' ? awaiting : 0} onOpen={() => go(a.to)} />
                    ))}
                    {shownSoon.map((a) => <AppCard key={a.to} app={a} soon />)}
                  </div>
                  {shownLive.length + shownSoon.length === 0 && term && (
                    <p className="py-8 text-center text-sm text-slate-500" aria-live="polite">ไม่พบแอปที่ตรงกับ “{q.trim()}”</p>
                  )}
                </div>
              </div>

              {/* side column */}
              <div className="space-y-6">
                <HolidayCalendar />
              </div>
            </div>

            <p className="mt-10 text-center text-[11px] text-slate-500">VCB Connect · ระบบงานภายใน กลุ่มวิจิตรภัณฑ์ก่อสร้าง</p>
          </main>
        </div>
      </div>

      {help && <HelpModal onClose={() => setHelp(false)} />}
    </div>
  );
}
