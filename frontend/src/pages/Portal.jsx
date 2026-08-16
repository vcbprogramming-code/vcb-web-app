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
  // A wall-clock the size of the greeting competed with it for attention and made
  // the card read like a screensaver. The status pill carries the "system is up"
  // message; the time rides quietly alongside the date.
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#132a54] to-[#0d1b36] p-6 text-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight">{greeting(now.getHours())}, {name}</h1>
          <p className="mt-1 text-sm text-white/70">ความเคลื่อนไหวของ VCB Connect ในวันนี้</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> ระบบออนไลน์
          </span>
          <div className="text-xs text-white/70">
            {formatThaiLongDate(now)} · <span className="tabular-nums">{now.toLocaleTimeString('th-TH', { hour12: false })}</span>
          </div>
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

/** Sidebar nav row (module scope — same remount reason as AppCard).
 *  `opens` marks a row that launches an application, which gets the ↗ affordance;
 *  plain rows (help, sign out) don't. */
function NavRow({ icon, label, onClick, badge = 0, opens = false }) {
  return (
    <button onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white">
      <Icon name={icon} className="h-[18px] w-[18px] shrink-0 text-slate-400 transition group-hover:text-white" />
      <span className="flex-1 truncate text-left">{label}</span>
      {badge > 0 && <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-[#0f172a]">{badge}</span>}
      {opens && badge === 0 && (
        <Icon name="arrowUpRight" className="h-3.5 w-3.5 shrink-0 text-slate-500 opacity-0 transition group-hover:opacity-100" />
      )}
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
  // sign out and come back here — see ModuleShell.handleSwitchAccount
  function handleSwitchAccount() {
    logout();
    navigate('/login', { replace: true, state: { from: { pathname: '/', search: '' } } });
  }
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
        {/* The sidebar is navy in BOTH themes — it's the app's spine, and a white
            rail against a white page gave the launcher no shape. Fixed colours,
            not `dark:` variants, so it looks the same either way. */}
        <aside id="portal-sidebar" aria-label="เมนูหลัก"
          className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#0d1b36] transition-transform lg:static lg:z-auto lg:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <GlobeMark className="h-6 w-6" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-extrabold tracking-tight text-white">VCB CONNECT</div>
              <div className="text-[10px] text-slate-400">ระบบงานภายใน</div>
            </div>
          </div>

          <div className="mx-3 mb-2 flex items-center gap-3 rounded-xl bg-white/[0.07] px-3 py-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{initial}</div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold text-white">{displayName}</div>
              <div className="text-[11px] text-slate-400">{roleLabels[role] || role}</div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="แอปพลิเคชัน">
            <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">แอปพลิเคชัน</div>
            {liveApps.map((a) => <NavRow key={a.to} icon={a.icon} label={a.navTitle || a.title} onClick={() => go(a.to)} badge={a.to === '/memos' ? awaiting : 0} opens />)}
            <div className="mt-3 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">ช่วยเหลือ</div>
            <NavRow icon="help" label="ช่วยเหลือ / แจ้งปัญหา" onClick={() => { setNavOpen(false); setHelp(true); }} />
          </nav>

          <div className="border-t border-white/10 px-3 py-3">
            <button onClick={handleSwitchAccount}
              title="ออกจากระบบแล้วเข้าด้วยบัญชีอื่น"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/10 hover:text-slate-200">
              <Icon name="people" className="h-[18px] w-[18px]" /> สลับบัญชี
            </button>
            <button onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300">
              <Icon name="logout" className="h-[18px] w-[18px]" /> ออกจากระบบ
            </button>
          </div>
          <div className="px-5 pb-4 text-[10px] leading-tight text-slate-500">
            VCB Group · สำหรับใช้งานภายในเท่านั้น
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
