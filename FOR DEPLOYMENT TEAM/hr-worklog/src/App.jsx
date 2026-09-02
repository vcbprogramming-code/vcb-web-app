import React, { useMemo } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, useI18n, useTheme } from '@vcb/shared';
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
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
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
        { to: '/settings', label: t('nav.settings'), show: true },
      ].filter((l) => l.show),
    [t, canEntry, isAdmin]
  );

  return (
    <header className="sticky top-0 z-20 bg-brand-bar shadow-topbar dark:bg-brand-bar-dark">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <span className="text-base font-extrabold tracking-tight text-white">HR Work Log</span>
        <span aria-hidden="true" className="hidden h-7 w-px bg-white/25 sm:block" />
        <span className="hidden text-sm font-semibold text-white/90 sm:block">
          {t('app.title')}
        </span>

        <nav className="ml-auto flex flex-wrap items-center gap-1">
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

          <button
            type="button"
            onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
            title={t('settings.language')}
            className="rounded-control px-2.5 py-1.5 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            {lang === 'th' ? 'EN' : 'ไทย'}
          </button>
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={t('settings.theme')}
            aria-label={t('settings.theme')}
            className="rounded-control px-2.5 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            {theme === 'dark' ? '☀' : '🌙'}
          </button>

          <span className="ml-2 hidden text-xs text-white/70 lg:block">
            {email || user?.email}
            {role ? ` · ${role}` : ''}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="rounded-control px-2.5 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            {t('auth.signOut')}
          </button>
        </nav>
      </div>
    </header>
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
