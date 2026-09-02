// The topbar, now the shared AppBar.
//
// This one was closest to right already — it had a brand link and a search box.
// Two things were wrong: the link was <Link to="/">, which navigates inside
// THIS app rather than to the portal, and the gear was an emoji rather than the
// icon the other modules use.
//
// The search box stays: it is what this module is for, and AppBar leaves a slot
// for exactly that.

import React from 'react';
import { AppBar, useAuth, useI18n } from '@vcb/shared';

export default function Topbar({ query, onQuery, onSettings }) {
  const { t } = useI18n();
  const { user, hasRole, signedIn } = useAuth();

  // From the token, not from MinutesData - that context has no role field, and
  // reading one off it would have shown an empty label rather than failing.
  const role = hasRole('minutes', 'admin')
    ? t('settings.roleAdmin')
    : hasRole('minutes', 'editor')
      ? t('settings.roleEditor')
      : '';

  return (
    <AppBar
      title={t('app.title')}
      subtitle={t('app.subtitle')}
      settingsExtra={
        <button
          type="button"
          onClick={onSettings}
          className="flex w-full items-center justify-between gap-3 rounded-control px-1 py-2 text-left text-sm text-ink hover:bg-surface-sunken dark:text-ink-dark dark:hover:bg-surface-dark-sunken"
        >
          <span>{t('nav.settings')}</span>
          <span aria-hidden="true" className="text-ink-muted dark:text-ink-dark-muted">
            →
          </span>
        </button>
      }
      settingsFooter={
        signedIn ? (
          <p className="truncate text-xs text-ink-muted dark:text-ink-dark-muted">
            {user?.email}
            {role ? ` · ${role}` : ''}
          </p>
        ) : null
      }
    >
      <div className="flex min-w-0 max-w-[420px] flex-1 items-center gap-2 rounded-pill bg-white/15 px-3 py-1.5 focus-within:bg-white/25 sm:w-[320px] sm:flex-none">
        <span aria-hidden="true" className="text-sm">
          🔎
        </span>
        <input
          type="search"
          aria-label={t('common.search')}
          placeholder={t('nav.search')}
          autoComplete="off"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          className="w-full min-w-0 border-0 bg-transparent text-[13.5px] text-white outline-none placeholder:text-white/60"
        />
      </div>
    </AppBar>
  );
}
