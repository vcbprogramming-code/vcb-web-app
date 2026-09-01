import React, { useMemo } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, useI18n, useTheme } from '@vcb/shared';
import { useHrData } from './HrData';
import { Card, Empty, Spinner } from './ui';
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

function SignInScreen() {
  const { t } = useI18n();
  const { signInWithPassword, error, loading } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await signInWithPassword(email, password);
    } catch {
      // AuthProvider already stored the error; it is rendered below.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-surface p-4 dark:bg-surface-dark">
      <Card className="w-full max-w-sm">
        <h1 className="m-0 text-lg font-bold text-ink dark:text-ink-dark">{t('app.title')}</h1>
        <p className="mb-4 mt-1 text-sm text-ink-muted dark:text-ink-dark-muted">
          {t('auth.signIn')}
        </p>
        <form onSubmit={submit} className="grid gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-dark-muted">
              {t('auth.email')}
            </span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-control border border-line bg-surface-card px-3 py-2 text-sm text-ink focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 dark:border-line-dark dark:bg-surface-dark-sunken dark:text-ink-dark"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-dark-muted">
              {t('auth.password')}
            </span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-control border border-line bg-surface-card px-3 py-2 text-sm text-ink focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 dark:border-line-dark dark:bg-surface-dark-sunken dark:text-ink-dark"
            />
          </label>
          {error && (
            <p className="m-0 text-sm text-danger dark:text-danger-dark">
              {errorMessage(error, t)}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || loading}
            className="mt-1 rounded-control bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
          >
            {busy ? t('common.loading') : t('auth.signIn')}
          </button>
        </form>
      </Card>
    </div>
  );
}

/* ----------------------------------- app ---------------------------------- */

export default function App() {
  const { t } = useI18n();
  const { signedIn, loading: authLoading } = useAuth();
  const { loading, error, isAdmin, canEntry, sites } = useHrData();

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface dark:bg-surface-dark">
        <Spinner />
      </div>
    );
  }
  if (!signedIn) return <SignInScreen />;

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
        ) : sites.length === 0 && !isAdmin ? (
          // A signed-in person with an HR role but no site scope sees nothing on
          // any screen, so say why rather than showing five empty views.
          <Empty icon="🔑" title={t('dash.noSites')}>
            {t('dash.askForAccess')}
          </Empty>
        ) : (
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            {canEntry && <Route path="/entry" element={<Entry />} />}
            {canEntry && <Route path="/entry/:siteKey" element={<Entry />} />}
            {isAdmin && <Route path="/index" element={<WorkIndex />} />}
            <Route path="/requests" element={<Requests />} />
            <Route path="/settings" element={<SettingsPage />} />
            {/* An unknown path lands on the dashboard rather than a blank
                screen — every role can see it. */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}
