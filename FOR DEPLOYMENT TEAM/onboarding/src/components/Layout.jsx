import { Link, NavLink, Outlet } from 'react-router-dom';
import { useI18n, useTheme } from '@vcb/shared';
import { ALL_DEPARTMENTS } from '../data/allDepartments.js';
import { useContentText } from '../lib/contentText.js';

// The sidebar shell, ported from the original app's Index.html/app.html.
//
// Theme and language now come from @vcb/shared, not from this module's own
// useTheme/useLang. That is the point of the shared providers: the choice
// follows the person across every VCB app instead of each one keeping its own
// key. The old local hooks wrote vcb-theme/vcb-lang and toggled
// [data-theme] — the shared ones write vcb_theme/vcb_lang and toggle
// class="dark", which is what Tailwind's darkMode: 'class' reads.
//
// The full journey stepper (Pre-boarding -> ... -> Completion with
// done/current/locked states) is still NOT ported; this remains a plain nav
// list, as it was before the conversion.

const navLinkClass = ({ isActive }) =>
  [
    'block rounded-control px-3 py-2 text-sm transition-colors',
    isActive
      ? 'bg-white/15 font-semibold text-white'
      : 'text-sidebar-text hover:bg-white/10 hover:text-white dark:text-sidebar-text-dark',
  ].join(' ');

function SegmentedButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'flex-1 rounded-control px-2 py-1.5 text-xs font-semibold transition-colors',
        active
          ? 'bg-white/20 text-white'
          : 'text-sidebar-dim hover:bg-white/10 hover:text-white dark:text-sidebar-dim-dark',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export default function Layout() {
  const { resolved, setTheme } = useTheme();
  const { lang, setLang, t } = useI18n();
  const tc = useContentText();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex w-full flex-none flex-col gap-6 bg-onb-sidebar px-5 py-6 text-white dark:bg-onb-sidebar-dark md:w-[274px]">
        <Link to="/" className="flex flex-col">
          <span className="font-display text-base font-extrabold tracking-[0.04em]">
            {t('app.brand')}
          </span>
          <span className="text-xs text-sidebar-text opacity-70 dark:text-sidebar-text-dark">
            {t('app.company')}
          </span>
        </Link>

        <nav className="flex flex-col gap-1">
          <NavLink to="/" end className={navLinkClass}>
            {t('nav.home')}
          </NavLink>
          <NavLink to="/required-documents" className={navLinkClass}>
            {t('nav.requiredDocuments')}
          </NavLink>
          {ALL_DEPARTMENTS.map((dept) => (
            <NavLink key={dept.id} to={`/${dept.landingPageKey}`} className={navLinkClass}>
              {tc(dept.content.title)}
            </NavLink>
          ))}
          <NavLink to="/completion" className={navLinkClass}>
            {t('nav.completion')}
          </NavLink>
          <NavLink to="/company-structure" className={navLinkClass}>
            {t('nav.companyStructure')}
          </NavLink>
        </nav>

        <div className="mt-auto flex flex-col gap-3 border-t border-white/10 pt-4">
          <div>
            <p className="mb-1.5 text-[0.7rem] uppercase tracking-wide text-sidebar-dim dark:text-sidebar-dim-dark">
              {t('settings.appearance')}
            </p>
            <div className="flex gap-1 rounded-control bg-black/20 p-1">
              <SegmentedButton active={resolved !== 'dark'} onClick={() => setTheme('light')}>
                {t('theme.light')}
              </SegmentedButton>
              <SegmentedButton active={resolved === 'dark'} onClick={() => setTheme('dark')}>
                {t('theme.dark')}
              </SegmentedButton>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[0.7rem] uppercase tracking-wide text-sidebar-dim dark:text-sidebar-dim-dark">
              {t('settings.language')}
            </p>
            <div className="flex gap-1 rounded-control bg-black/20 p-1">
              <SegmentedButton active={lang === 'th'} onClick={() => setLang('th')}>
                ไทย
              </SegmentedButton>
              <SegmentedButton active={lang === 'en'} onClick={() => setLang('en')}>
                EN
              </SegmentedButton>
            </div>
          </div>

          <NavLink
            to="/admin"
            className="rounded-control px-3 py-2 text-center text-xs text-sidebar-dim transition-colors hover:bg-white/10 hover:text-white dark:text-sidebar-dim-dark"
          >
            {t('nav.admin')}
          </NavLink>
        </div>
      </aside>

      <main className="w-full max-w-page flex-1 px-6 py-10 md:px-10">
        <Outlet />
      </main>
    </div>
  );
}
