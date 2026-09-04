import React, { useMemo } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { AppBar, useAuth, useI18n } from '@vcb/shared';
import { useHrData } from './HrData';
import { Empty, Spinner } from './ui';
import { errorMessage } from './lib/errors';
import Dashboard from './Dashboard';
import Entry from './Entry';
import WorkIndex from './WorkIndex';
import Requests from './Requests';
import SettingsPage from './SettingsPage';

/* --------------------------------- topbar --------------------------------- */

function Topbar() {
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  const { isAdmin, canEntry, email, role } = useHrData();

  // Routes are listed here rather than in <Routes> so the nav and the router
  // cannot drift apart. `show` hides a link the API would refuse anyway —
  // it is decluttering, not security; api/src/middleware/auth.js is the gate.
  const links = useMemo(
    () =>
      [
        { to: '/dashboard', label: t('nav.dashboard'), show: true },
        { to: '/entry', label: t('nav.entry'), show: canEntry },
        { to: '/index', label: t('nav.index'), show: isAdmin },
        { to: '/requests', label: t('nav.requests'), show: true },
        // Settings is NOT a nav link: the gear in the bar is the one way in,
        // as it is in the live app and in every other module. Two controls
        // labelled Settings side by side is a question, not a feature.
      ].filter((l) => l.show),
    [t, canEntry, isAdmin]
  );

  // Both rows must track the current language — a banner reading "HR DAILY
  // WORK LOG" over "บันทึกการทำงานรายวัน" in Thai mode is half-translated.
  // title was a hardcoded English literal; app.title already resolves per
  // language and is exactly what the top row (the module's own name,
  // uppercased by AppBar) needs. Passing it to subtitle too, unchanged from
  // before this fix, is what AppBar's own descriptor line (company name +
  // this string) is built from.
  return (
    <AppBar
      title={t('app.title')}
      subtitle={t('app.title')}
      settingsExtra={
        <NavLink
          to="/settings"
          className="flex items-center justify-between gap-3 rounded-control px-1 py-2 text-sm text-ink hover:bg-surface-sunken dark:text-ink-dark dark:hover:bg-surface-dark-sunken"
        >
          <span>{t('nav.settings')}</span>
          <span aria-hidden="true" className="text-ink-muted dark:text-ink-dark-muted">→</span>
        </NavLink>
      }
      settingsFooter={
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-xs text-ink-muted dark:text-ink-dark-muted">
            {email || user?.email}
            {role ? ` · ${role}` : ''}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="shrink-0 rounded-control px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger-bg dark:text-danger-dark"
          >
            {t('auth.signOut')}
          </button>
        </div>
      }
    >
      {/* The module's own nav, in the slot AppBar leaves for it. Sign out and
          the identity moved into the settings sheet: they were three more
          things competing with the pages people came here to open, and every
          other module already keeps them behind the gear. */}
      <nav className="flex flex-wrap items-center gap-1">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              'rounded-control px-3 py-1.5 text-sm font-medium transition-colors ' +
              (isActive ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white')
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
    </AppBar>
  );
}

/* ------------------------------- sign-in gate ------------------------------ */


/* ----------------------------------- app ---------------------------------- */

export default function App() {
  const { t } = useI18n();
  const { loading, error } = useHrData();

  /* Deliberately NOT held behind authLoading.

     AuthProvider verifies a stored token against /auth/me on mount. With no API
     reachable that call hangs or fails, and blocking the render on it meant the
     whole app sat on a spinner that never cleared — which is what made this one
     of the two modules that would not load without a backend.

     The shell does not need to know who you are. It renders; the data arrives
     when it arrives, and useHrData's own error state says so if it does not. */
  // NOT gated. Access control lives in the portal: it authenticates, and the
  // API enforces roles on every route. A module that also blocks its own render
  // just adds a second place for a signed-in person to be told they are not.
  //
  // signedIn is still read and still passed down, so the UI can hide controls a
  // viewer cannot use - the structure is here, it simply does not bar the door.

  return (
    <div className="min-h-screen bg-surface dark:bg-surface-dark">
      <Topbar />
      <main className="mx-auto grid max-w-[1600px] gap-4 p-4">
        {loading ? (
          <Spinner />
        ) : error ? (
          <Empty icon="⚠️" title={t('err.loadFailed')}>
            {errorMessage(error, t)}
          </Empty>
        ) : (
          // Every route is registered unconditionally. Hiding one behind a role
          // only removed the page from the router, so the person got a silent
          // redirect rather than an explanation — and the same check already
          // exists in the API, which is the one that counts. The nav still hides
          // links a viewer has no use for, so the UI stays uncluttered.
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/entry" element={<Entry />} />
            <Route path="/entry/:siteKey" element={<Entry />} />
            <Route path="/index" element={<WorkIndex />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}
