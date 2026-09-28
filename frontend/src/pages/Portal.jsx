import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useTheme } from '../theme/ThemeContext.jsx';
import { apps, portalRoleLabel, shortcuts } from '../config/nav.js';
import { ememoApi } from '../lib/ememo.js';
import { portalApi, birthdayWhen } from '../lib/portal.js';
import Icon from '../components/Icon.jsx';
import LangToggle from '../components/LangToggle.jsx';
import { useLang, useT } from '../lib/i18n.jsx';
import { EN } from '../lib/en.js';
import GlobeMark from '../components/GlobeMark.jsx';
import HolidayCalendar from '../components/HolidayCalendar.jsx';
import HelpModal from '../components/HelpModal.jsx';

const greeting = (h) => (h < 12 ? 'สวัสดีตอนเช้า' : h < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น');

/** Ticking clock + greeting. Owns its own 1s interval so only THIS subtree
 *  re-renders each second — the Portal (nav, app cards, calendar) does not. */
function WelcomeCard({ name }) {
  const t = useT();
  const { lang } = useLang();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  // A wall-clock the size of the greeting competed with it for attention and made
  // the card read like a screensaver. The status pill carries the "system is up"
  // message; the time rides quietly alongside the date.
  //
  // รูปแบบเดียวกับพอร์ทัลที่บริษัทใช้อยู่: "วันอาทิตย์ที่ 27 ก.ย. · 11:51" —
  // ชื่อวันนำหน้า เดือนแบบย่อ ไม่มีปี และเวลาไม่มีวินาที (วินาทีที่วิ่งตลอด
  // ดึงสายตาออกจากคำทักทาย)
  const locale = lang === 'en' ? 'en-US' : 'th-TH';
  const stamp = `${now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' })}`
    + ` · ${now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  return (
    <div data-surface="dark" className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#132a54] to-[#0d1b36] p-6 text-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight">{t(greeting(now.getHours()))}, {name}</h1>
          <p className="mt-1 text-sm text-white/70">{t('ความเคลื่อนไหวของ VCB Connect ในวันนี้')}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> {t('ระบบออนไลน์')}
          </span>
          <div className="text-xs tabular-nums text-white/70">{stamp}</div>
        </div>
      </div>
    </div>
  );
}

/** One launcher card. Defined at module scope: a component created inside the
 *  Portal's render would be a NEW type every render, so React would unmount +
 *  remount every card (losing hover/focus) on each state change. */
function AppCard({ app, soon, awaiting, onOpen }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={soon ? undefined : onOpen}
      // คำบรรยายยาว (preview) ของระบบจริงโผล่เป็น tooltip ตอนชี้ค้าง — ของเขา
      // เขียน tooltip เองเพื่อคุมจังหวะ fade เราใช้ title ของเบราว์เซอร์แทน
      // เพราะได้ข้อความเดียวกันโดยไม่ต้องเพิ่มโครงสร้างใหม่ทั้งชุด
      title={app.preview ? t(app.preview) : undefined}
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
          ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">{t('เร็วๆ นี้')}</span>
          : awaiting > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-[#0f172a]">
              <Icon name="clock" className="h-3.5 w-3.5" /> {t('รออนุมัติ')} {awaiting}
            </span>
          )}
      </div>
      <h3 className="mt-4 text-base font-bold text-slate-800">{t(app.title)}</h3>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-500">{t(app.desc)}</p>
      {!soon && (
        <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-brand">
          {t('เปิดใช้งาน')} <Icon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      )}
    </button>
  );
}

/** Sidebar nav row (module scope — same remount reason as AppCard).
 *  `opens` marks a row that launches an application, which gets the ↗ affordance;
 *  plain rows (help, sign out) don't. */
/** ทางลัดออกไปเว็บอื่น — หน้าตาเหมือนเมนูในระบบ แต่เปิดแท็บใหม่ */
function NavLink({ icon, label, href, title }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" title={title}
      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white">
      <Icon name={icon} className="h-[18px] w-[18px] shrink-0 text-slate-400 transition group-hover:text-white" />
      <span className="flex-1 truncate text-left">{label}</span>
      <Icon name="arrowUpRight" className="h-3.5 w-3.5 shrink-0 text-slate-500 opacity-0 transition group-hover:opacity-100" />
    </a>
  );
}

/** วงกลมตัวอักษรแรกของชื่อ — แบบเดียวกับแถวรายชื่อวันเกิดของระบบจริง */
function Initials({ name }) {
  const first = String(name || '').trim().slice(0, 1).toUpperCase() || '?';
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
      {first}
    </span>
  );
}

/**
 * ลาวันนี้ · วันเกิดที่กำลังจะถึง
 *
 * สองกล่องเดียวกับที่พอร์ทัลของบริษัทมีข้างปฏิทินวันหยุด ทั้งคู่ขึ้นเสมอแม้ยัง
 * ไม่มีข้อมูล แล้วบอกตรง ๆ ว่าไม่มี — ระบบจริงทำแบบนี้ และกล่องที่หายไปเงียบ ๆ
 * ทำให้คนเข้าใจว่าหน้าโหลดไม่ครบ
 */
function TodayPanel() {
  const t = useT();
  const { lang } = useLang();
  const [data, setData] = useState(null);
  useEffect(() => { portalApi.today().then((r) => setData(r.data)).catch(() => setData({ onLeave: [], birthdays: [] })); }, []);
  const { onLeave = [], birthdays = [] } = data || {};

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
          <Icon name="userClock" className="h-4 w-4 text-brand" /> {t('ลาวันนี้')}
        </h3>
        {onLeave.length === 0 ? (
          <p className="text-xs text-slate-400">{t('วันนี้ไม่มีพนักงานลา')}</p>
        ) : (
          <ul className="space-y-1.5">
            {onLeave.map((p) => (
              <li key={`${p.employee_code}-${p.from_date}`} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-slate-700">{p.full_name}</span>
                <span className="shrink-0 text-[11px] text-slate-400">
                  {t(p.leave_type, null, 'leave')}{p.day_part && p.day_part !== 'full' ? ` · ${t('ครึ่งวัน')}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
          <Icon name="calendar" className="h-4 w-4 text-brand" /> {t('วันเกิดที่กำลังจะถึง')}
        </h3>
        {birthdays.length === 0 ? (
          <p className="text-xs text-slate-400">{t('ยังไม่มีวันเกิดที่กำลังจะถึง')}</p>
        ) : (
          <ul className="space-y-2">
            {birthdays.map((p) => ({ ...p, days: Number(p.days) })).map((p) => (
              <li key={p.employee_code || p.full_name} className="flex items-center gap-2.5">
                <Initials name={p.full_name} />
                <div className="min-w-0 flex-1">
                  {/* ชื่อเล่นต่อท้ายในวงเล็บ แบบเดียวกับทะเบียนวันเกิดของระบบจริง */}
                  <div className="truncate text-sm text-slate-700">
                    {p.full_name}{p.nickname ? ` (${p.nickname})` : ''}
                  </div>
                  {/* ป้ายแผนกของระบบจริงขึ้นเป็น "Acct" ไม่ใช่ "ACCT" — ข้อมูลเก็บเป็น
                      ตัวพิมพ์ใหญ่ทั้งคำ จัดรูปด้วย CSS ไม่ใช่ไปแก้ค่าที่เก็บไว้ */}
                  {p.dept && (
                    <div className="truncate text-[11px] lowercase text-slate-400 first-letter:uppercase">{p.dept}</div>
                  )}
                </div>
                {/* วันนี้/พรุ่งนี้ เป็นป้าย ส่วนวันอื่นเป็นวันที่ย่อ — เหมือนระบบจริง */}
                {p.days <= 1 ? (
                  <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">
                    {p.days === 0 ? t('วันนี้') : t('พรุ่งนี้')}
                  </span>
                ) : (
                  <span className="shrink-0 text-[11px] text-slate-400">{birthdayWhen(p.days, lang)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NavRow({ icon, label, onClick, badge = 0, opens = false, tip }) {
  return (
    <button onClick={onClick} title={tip || label}
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
  const t = useT();
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
  // ระบบจริงแยก "แอปพลิเคชัน" (หกแอปหลัก) ออกจาก "เพิ่มเติม" — ตัวนับบนหัวข้อ
  // จึงนับแอปหลักเท่านั้น เหมือนที่เขานับ apps.length
  const mainApps = liveApps.filter((a) => a.group !== 'more');
  const moreApps = liveApps.filter((a) => a.group === 'more');

  // greeting should use a person's first name, not their whole email address
  const displayName = profile?.full_name || user?.email || t('ผู้ใช้งาน');
  const shortName = profile?.full_name ? profile.full_name.trim().split(' ')[0] : (user?.email || '').split('@')[0] || t('ผู้ใช้งาน');
  const initial = displayName.trim().slice(0, 1).toUpperCase();

  const [awaiting, setAwaiting] = useState(0);
  const [announcements, setAnnouncements] = useState([]);
  // ประกาศที่ปักหมุดขึ้นเป็นแถบเด่นด้านบนก่อน กดปิดแล้วจึงย้ายไปอยู่ในการ์ด
  // ประกาศด้านล่าง — ไม่แสดงข้อความเดียวกันสองที่บนจอเดียวกัน
  const [dismissed, setDismissed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('vcb_ann_dismissed') || '[]')); }
    catch { return new Set(); }
  });
  const dismiss = (id) => {
    setDismissed((prev) => {
      const next = new Set(prev); next.add(String(id));
      // เก็บเป็นข้อความทึบ ไม่ตีความ — ค่าที่ค้างจากรุ่นก่อนจึงแปลว่า "ไม่ใช่อันนี้"
      // อย่างมากก็แค่เห็นแถบอีกครั้ง ซึ่งเป็นผลลัพธ์ที่ถูกต้อง
      try { localStorage.setItem('vcb_ann_dismissed', JSON.stringify([...next])); } catch { /* โหมดส่วนตัว */ }
      return next;
    });
  };

  // แถบเด่นแสดงประกาศที่ปักหมุดอันแรกที่ยังไม่ถูกปิด — ที่เหลือ (และอันที่ถูกปิดแล้ว)
  // ไปอยู่ในการ์ดประกาศ เพื่อไม่ให้ข้อความเดียวกันซ้ำสองที่บนจอเดียว
  const banner = useMemo(
    () => announcements.find((a) => a.pinned && !dismissed.has(String(a.id))) || null,
    [announcements, dismissed]);
  const panelAnnouncements = useMemo(
    () => announcements.filter((a) => !banner || a.id !== banner.id),
    [announcements, banner]);
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
  // ค้นได้ทั้งไทยและอังกฤษไม่ว่าหน้าจอกำลังเป็นภาษาไหน — ระบบจริงเก็บคำค้นเป็น
  // อังกฤษชุดเดียว พิมพ์ไทยจึงไม่เจออะไรเลย ของเราเคยกลับกัน (พิมพ์ "credit"
  // ตอนหน้าจอเป็นไทยแล้วไม่เจอ) รวมสองชุดไว้ด้วยกันจึงตอบได้ทั้งสองทาง
  const match = (a) => !term
    || [a.title, a.navTitle, a.desc, EN[a.title], EN[a.navTitle], EN[a.desc]]
      .filter(Boolean).join(' ').toLowerCase().includes(term);
  const shownMain = mainApps.filter(match);
  const shownMore = moreApps.filter(match);
  const shownSoon = soonApps.filter(match); // searchable too — "แผนผัง" must find System Map
  const shownCount = shownMain.length + shownMore.length + shownSoon.length;

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
        <aside id="portal-sidebar" data-surface="dark" aria-label={t('เมนูหลัก')}
          className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#0d1b36] transition-transform lg:static lg:z-auto lg:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <GlobeMark className="h-6 w-6" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-extrabold tracking-tight text-white">VCB CONNECT</div>
              <div className="text-[10px] text-slate-400">{t('พอร์ทัลอินทราเน็ตภายในองค์กร')}</div>
            </div>
          </div>

          <div className="mx-3 mb-2 flex items-center gap-3 rounded-xl bg-white/[0.07] px-3 py-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{initial}</div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold text-white">{displayName}</div>
              {/* ctx 'portal': "พนักงาน" ที่อื่นในระบบแปลว่า Employees แต่ป้าย
                  บทบาทบนหน้านี้คือ Staff ตามระบบจริง */}
              <div className="text-[11px] text-slate-400">{t(portalRoleLabel(role), null, 'portal')}</div>
            </div>
          </div>

          {/* เมนูข้างจัดสามกลุ่มเหมือนพอร์ทัลจริง: แอปพลิเคชัน · ทางลัด · เพิ่มเติม */}
          <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label={t('แอปพลิเคชัน')}>
            <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('แอปพลิเคชัน')}</div>
            {/* เมนูของหกแอปหลักได้ tooltip เป็นคำบรรยายยาว (preview) เหมือน
                applyAppTooltips ของเขา ส่วนกลุ่มเพิ่มเติมได้คำสั้น (tt_*_desc) */}
            {mainApps.map((a) => (
              <NavRow key={a.to} icon={a.icon} label={t(a.navTitle || a.title)} tip={t(a.preview || a.desc)}
                onClick={() => go(a.to)} badge={a.to === '/memos' ? awaiting : 0} opens />
            ))}
            {/* ทางลัดออกไประบบอื่นที่พนักงานใช้คู่กันทุกวัน — เปิดแท็บใหม่
                เพราะไม่ใช่ส่วนหนึ่งของ VCB Connect */}
            <div className="mt-3 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('ทางลัด')}</div>
            {shortcuts.map((s) => (
              <NavLink key={s.key} icon={s.icon} label={s.label} title={t(s.tip)} href={s.href} />
            ))}
            <div className="mt-3 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('เพิ่มเติม')}</div>
            {moreApps.map((a) => (
              <NavRow key={a.to} icon={a.icon} label={t(a.navTitle || a.title)} tip={t(a.desc)}
                onClick={() => go(a.to)} opens />
            ))}
            <NavRow icon="help" label={t('ช่วยเหลือ / แจ้งปัญหา')} onClick={() => { setNavOpen(false); setHelp(true); }} />
          </nav>

          <div className="border-t border-white/10 px-3 py-3">
            <button onClick={handleSwitchAccount}
              title={t('ออกจากระบบแล้วเข้าด้วยบัญชีอื่น')}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/10 hover:text-slate-200">
              <Icon name="people" className="h-[18px] w-[18px]" /> {t('สลับบัญชี')}
            </button>
            <button onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300">
              <Icon name="logout" className="h-[18px] w-[18px]" /> {t('ออกจากระบบ')}
            </button>
          </div>
          <div className="px-5 pb-4 text-[10px] leading-tight text-slate-500">
            {t('VCB Group · สำหรับใช้งานภายในเท่านั้น')}
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* topbar */}
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
            <button onClick={() => setNavOpen((v) => !v)} aria-label={t('เมนู')} aria-expanded={navOpen} aria-controls="portal-sidebar"
              className="tap rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden">
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <div className="relative max-w-md flex-1">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ค้นหาแอปพลิเคชัน…')} aria-label={t('ค้นหาแอปพลิเคชัน')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
            </div>
            <LangToggle />
            <button onClick={toggle} aria-label={t('สลับธีมสว่าง/มืด')} aria-pressed={isDark}
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

                {/* แถบประกาศเด่น — ตัดข้อความไว้สองบรรทัดเสมอ ไม่ให้ยืดตามความยาว */}
                {banner && (
                  <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${ANNOUNCE_STYLE[banner.level] || ANNOUNCE_STYLE.info}`}>
                    <Icon name="bell" className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{t(banner.title)}</div>
                      {banner.body && <div className="mt-0.5 line-clamp-2 text-sm opacity-90">{banner.body}</div>}
                    </div>
                    <button onClick={() => dismiss(banner.id)} aria-label={t('ปิดแถบประกาศ')}
                      className="shrink-0 rounded p-1 opacity-60 hover:opacity-100">×</button>
                  </div>
                )}

                {/* ประกาศ — พอร์ทัลจริงโชว์แผงนี้เสมอแม้ยังไม่มีประกาศ แล้วบอก
                    ตรง ๆ ว่าไม่มี (แผงที่หายไปเงียบ ๆ ทำให้คนเข้าใจว่าหน้าโหลด
                    ไม่ครบ) ข้อยกเว้นเดียว: ถ้าประกาศทั้งหมดกำลังขึ้นเป็นแถบเด่น
                    อยู่ด้านบนแล้ว แผงนี้จะไม่ขึ้น — เพราะจะกลายเป็นบอกว่า
                    "ยังไม่มีประกาศ" ทั้งที่ประกาศอยู่เหนือหัวพอดี */}
                {(annErr || announcements.length === 0 || panelAnnouncements.length > 0) && (
                  <div className="space-y-2">
                    <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700"><Icon name="bell" className="h-4 w-4 text-brand" /> {t('ประกาศ')}</h2>
                    {annErr ? (
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                        {t('โหลดประกาศไม่สำเร็จ')}
                        <button onClick={() => { setAnnErr(false); portalApi.announcements().then((r) => setAnnouncements(r.data || [])).catch(() => setAnnErr(true)); }}
                          className="ml-2 font-semibold text-brand hover:underline">{t('ลองใหม่')}</button>
                      </div>
                    ) : announcements.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400">
                        {t('ยังไม่มีประกาศในขณะนี้')}
                      </div>
                    ) : panelAnnouncements.map((a) => (
                      <div key={a.id} className={`rounded-xl border px-4 py-3 ${ANNOUNCE_STYLE[a.level] || ANNOUNCE_STYLE.info}`}>
                        <div className="flex items-center gap-1.5 text-sm font-semibold">
                          {a.pinned && <Icon name="pin" className="h-3.5 w-3.5 shrink-0" />}{t(a.title)}
                        </div>
                        {a.body && <div className="mt-0.5 whitespace-pre-wrap text-sm opacity-90">{a.body}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* apps grid — หกแอปหลักก่อน แล้วค่อยกลุ่ม "เพิ่มเติม" ตามลำดับ
                    ของระบบจริง ตัวนับข้างหัวข้อนับแอปหลักเท่านั้น */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-700">{t('แอปพลิเคชัน')}</h2>
                    <span className="text-xs text-slate-500" aria-live="polite">{shownMain.length} {t('รายการ')}</span>
                  </div>
                  {/* a third column once the window is wide enough to carry it */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                    {shownMain.map((a) => (
                      <AppCard key={a.to} app={a} awaiting={a.to === '/memos' ? awaiting : 0} onOpen={() => go(a.to)} />
                    ))}
                    {shownSoon.map((a) => <AppCard key={a.to} app={a} soon />)}
                  </div>

                  {shownMore.length > 0 && (
                    <>
                      <h2 className="mb-3 mt-6 text-sm font-bold text-slate-700">{t('เพิ่มเติม')}</h2>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                        {shownMore.map((a) => <AppCard key={a.to} app={a} onOpen={() => go(a.to)} />)}
                      </div>
                    </>
                  )}

                  {shownCount === 0 && term && (
                    <p className="py-8 text-center text-sm text-slate-500" aria-live="polite">{t('ไม่พบแอปพลิเคชันที่ค้นหา')}</p>
                  )}
                </div>
              </div>

              {/* side column */}
              <div className="space-y-6">
                <HolidayCalendar />
                <TodayPanel />
              </div>
            </div>

            <p className="mt-10 text-center text-[11px] text-slate-500">{t('VCB Connect · ระบบงานภายใน กลุ่มวิจิตรภัณฑ์ก่อสร้าง')}</p>
          </main>
        </div>
      </div>

      {help && <HelpModal onClose={() => setHelp(false)} />}
    </div>
  );
}
