import { useState } from 'react';
import { useAuth, useI18n } from '@vcb/shared';
import { Page, PageTitle, Section } from './ui.jsx';

// Real sign-in, replacing the shared admin password.
//
// The old gate asked for one password shared by every admin and checked it
// with check_admin_password() — a security-definer function granted to `anon`
// whose fallback literal was sitting in a file anyone could read.
// 007_onboarding.sql drops it. This asks for an actual account instead, so the
// "who edited this checklist" question has an answer.
//
// Signing in here signs the person into every VCB app: the token is the shared
// one from @vcb/shared, not a module-local session.
//
// `missingRole` is the case where the person IS signed in but has no portal
// admin role — a different problem from not being signed in, and it needs a
// different instruction (ask IT), not another password box.

export default function AdminSignIn({ missingRole = false }) {
  const { t } = useI18n();
  const { signInWithPassword, signOut, user, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await signInWithPassword(email, password);
    } catch {
      // AuthProvider already holds the error; it is rendered below. Swallowed
      // here so an expected bad-password does not surface as an unhandled
      // rejection in the console.
    } finally {
      setBusy(false);
    }
  }

  if (missingRole) {
    return (
      <Page>
        <PageTitle>{t('admin.title')}</PageTitle>
        <Section>
          <p className="mb-3">{t('admin.needAdminRole')}</p>
          <p className="text-sm text-ink-muted dark:text-ink-dark-muted">
            {t('admin.signedInAs')}: {user?.email}
          </p>
          <button
            type="button"
            onClick={signOut}
            className="mt-4 rounded-control border border-line px-4 py-2 text-sm font-semibold hover:bg-surface-sunken dark:border-line-dark dark:hover:bg-surface-dark-sunken"
          >
            {t('auth.signOut')}
          </button>
        </Section>
      </Page>
    );
  }

  return (
    <Page>
      <PageTitle>{t('admin.title')}</PageTitle>
      <Section>
        <p className="mb-4 text-ink-subtle dark:text-ink-dark-muted">{t('admin.signInPrompt')}</p>

        {error && (
          <p role="alert" className="mb-3 text-sm text-danger dark:text-danger-dark">
            {/* The API returns a machine code; render OUR message for it, never
                err.message. Unmapped codes fall back to a generic line. */}
            {t(`error.${error.code}`) === `error.${error.code}`
              ? t('common.error')
              : t(`error.${error.code}`)}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t('auth.email')}
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-control border border-line bg-surface-card px-3 py-2 text-base font-normal outline-none focus:border-brand-600 focus:shadow-focus dark:border-line-dark dark:bg-surface-dark-sunken"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t('auth.password')}
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="rounded-control border border-line bg-surface-card px-3 py-2 text-base font-normal outline-none focus:border-brand-600 focus:shadow-focus dark:border-line-dark dark:bg-surface-dark-sunken"
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="mt-1 rounded-pill bg-accent px-6 py-2.5 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-accent-dark dark:text-surface-dark"
          >
            {busy ? t('admin.checking') : t('auth.signIn')}
          </button>
        </form>
      </Section>
    </Page>
  );
}
