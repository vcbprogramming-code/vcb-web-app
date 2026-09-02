// The topbar, now the shared AppBar.
//
// It used to be this module's own: a language toggle, a theme toggle with an
// emoji for a label, an emoji gear, the identity, and a sign-out button — six
// controls across the bar, none of which anyone came here to use. It also had
// no way back to the portal.
//
// AppBar puts appearance and language behind the gear, makes the brand the way
// home, and leaves the identity and sign-out in the settings sheet where the
// other modules already keep them. What stays in the bar is what this module
// is for.

import React from 'react';
import { AppBar, useAuth, useI18n } from '@vcb/shared';
import { useData } from '../lib/DataContext.jsx';

export default function Header({ onOpenSettings }) {
  const { t } = useI18n();
  const { user, signOut, signedIn } = useAuth();
  const { me, isManager } = useData();

  const email = me?.email || user?.email || '';

  return (
    <AppBar
      title="CREDIT FACILITY MANAGER"
      subtitle={t('app.subtitle')}
      settingsExtra={
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex w-full items-center justify-between gap-3 rounded-control px-1 py-2 text-left text-sm text-ink hover:bg-surface-sunken dark:text-ink-dark dark:hover:bg-surface-dark-sunken"
        >
          <span>{t('set.open')}</span>
          <span aria-hidden="true" className="text-ink-muted dark:text-ink-dark-muted">
            →
          </span>
        </button>
      }
      settingsFooter={
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-ink dark:text-ink-dark">
              {email || t('app.noUser')}
            </p>
            <p className="text-[11px] text-ink-muted dark:text-ink-dark-muted">
              {isManager ? t('app.manager') : t('app.guest')}
            </p>
          </div>
          {signedIn ? (
            <button
              type="button"
              onClick={signOut}
              className="shrink-0 rounded-control px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger-bg dark:text-danger-dark"
            >
              {t('auth.signOut')}
            </button>
          ) : null}
        </div>
      }
    />
  );
}
