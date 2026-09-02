import { Link, NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { AppSettings, useI18n } from '@vcb/shared';
import JourneyStepper from './JourneyStepper.jsx';
import { useProgress } from '../lib/useProgress.js';
import { REQUIRED_DOCUMENTS } from '../data/requiredDocuments.js';

// The sidebar shell, ported from the original app's Index.html/app.html.
//
// Theme and language now come from @vcb/shared, not from this module's own
// useTheme/useLang. That is the point of the shared providers: the choice
// follows the person across every VCB app instead of each one keeping its own
// key. The old local hooks wrote vcb-theme/vcb-lang and toggled
// [data-theme] — the shared ones write vcb_theme/vcb_lang and toggle
// class="dark", which is what Tailwind's darkMode: 'class' reads.
//
// The journey stepper (Pre-boarding -> ... -> Completion, with done/current/
// locked states and per-block sub-steps) lives in JourneyStepper.jsx and is
// what this column renders. It replaced a flat list of page links, which said
// nothing about where in the 90 days anyone actually was.
//
// There is deliberately no /company-structure entry: the live app has no such
// page. Its org chart is a section inside the home page, and a top-level nav
// item for it was something this port invented.

const navLinkClass = ({ isActive }) =>
  [
    'block rounded-control px-3 py-2 text-sm transition-colors',
    isActive
      ? 'bg-white/15 font-semibold text-white'
      : 'text-sidebar-text hover:bg-white/10 hover:text-white dark:text-sidebar-text-dark',
  ].join(' ');

// Same rule as every other module: the deployment says where the portal is,
// and it defaults to the root because on one domain the portal IS the root.
const PORTAL_URL = import.meta.env.VITE_PORTAL_URL || '/';

export default function Layout() {
  const { t } = useI18n();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // The stepper needs to know who this is and what they have finished. This is
  // the same hook every page uses; useProgress keeps one cache per employee, so
  // reading it here does not fetch a second time.
  const { department, level, isTaskDone } = useProgress();

  // The same rule as the original's areRequiredDocsComplete(): every required
  // document ticked. RequiredDocuments.jsx records an upload as the task
  // `doc::<id>`, so the completion state is already in the progress map and
  // does not need its own request.
  const requiredDocsDone = REQUIRED_DOCUMENTS.every((doc) => isTaskDone(`doc::${doc.id}`));

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex w-full flex-none flex-col gap-6 bg-onb-sidebar px-5 py-6 text-white dark:bg-onb-sidebar-dark md:w-[274px]">
        {/* A sidebar has room for a real label where a topbar only has room
            for a brand mark, so the way back to the portal says so. */}
        <div className="flex flex-col gap-3">
          <a
            href={PORTAL_URL}
            className="inline-flex items-center gap-1.5 self-start rounded-control text-xs text-sidebar-dim transition-colors hover:text-white dark:text-sidebar-dim-dark"
          >
            <span aria-hidden="true">←</span>
            {t('app.backToPortal')}
          </a>
          <Link to="/" className="flex flex-col">
            <span className="font-display text-base font-extrabold tracking-[0.04em]">
              {t('app.brand')}
            </span>
            <span className="text-xs text-sidebar-text opacity-70 dark:text-sidebar-text-dark">
              {t('app.company')}
            </span>
          </Link>
        </div>

        {/* The journey, not a page index. Which step someone is on, what is
            behind them and what is still locked is the whole point of this
            column in the live app - a flat list of links says none of it.

            The department landing pages are still reachable: the stepper links
            straight to the phase pages, which is where the work actually is,
            and the department name is in the step label. */}
        <JourneyStepper
          department={department}
          level={level}
          isTaskDone={isTaskDone}
          requiredDocsDone={requiredDocsDone}
        />

        <div className="mt-auto flex flex-col gap-1 border-t border-white/10 pt-4">
          {/* One gear, as in every other module. Appearance and language were
              two segmented blocks taking a third of this column for settings
              somebody chooses once. */}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-2 rounded-control px-3 py-2 text-left text-sm text-sidebar-text transition-colors hover:bg-white/10 hover:text-white dark:text-sidebar-text-dark"
          >
            <span aria-hidden="true">⚙</span>
            {t('settings.title')}
          </button>
          <NavLink
            to="/admin"
            className="rounded-control px-3 py-2 text-xs text-sidebar-dim transition-colors hover:bg-white/10 hover:text-white dark:text-sidebar-dim-dark"
          >
            {t('nav.admin')}
          </NavLink>
        </div>
      </aside>

      {/* section.block: padding 8px 28px 28px in the original. */}
      <main className="w-full max-w-page flex-1 px-7 pb-7 pt-2">
        <Outlet />
      </main>

      <AppSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
