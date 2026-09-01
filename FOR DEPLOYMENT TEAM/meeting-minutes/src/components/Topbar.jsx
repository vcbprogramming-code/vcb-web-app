import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useI18n } from '@vcb/shared';
import { IconButton } from '../ui';

/**
 * The brand bar: identity, search, settings.
 *
 * The old version read `session.user`/`session.isAdmin` from a bootstrap
 * payload the API no longer returns — identity comes from the JWT now, through
 * useAuth. `session.appDisplayTitle`/`subtitle` were server-configured strings;
 * they are dictionary entries here, because they are interface copy and a Thai
 * reader was being shown the English one.
 */
export default function Topbar({ query, onQuery, onSettings }) {
  const { t } = useI18n();
  const { user, hasRole, signedIn } = useAuth();

  const role = hasRole('minutes', 'admin')
    ? t('settings.roleAdmin')
    : hasRole('minutes', 'editor')
      ? t('settings.roleEditor')
      : '';

  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 bg-brand-bar px-4 py-2.5 shadow-topbar dark:bg-brand-bar-dark">
      <div className="flex min-w-0 items-center gap-4">
        <h1 className="m-0 text-2xl font-extrabold leading-none tracking-[.3px] text-white">
          {/* Back to the portal. In the Apps Script app this was a dead anchor
              (preventDefault) because each module was its own deployment; under
              one website it is a real route. */}
          <Link to="/" className="text-inherit no-underline transition-opacity hover:opacity-80" title={t('app.backToPortal')}>
            {t('app.brand')}
          </Link>
        </h1>
        <span aria-hidden="true" className="h-10 w-px bg-white/45" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="truncate text-[12.5px] font-bold uppercase tracking-[2.5px] text-white">
            {t('app.title')}
          </span>
          <span className="truncate text-[13px] font-medium leading-none tracking-[.5px] text-white/90">
            {t('app.subtitle')}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
        <div className="flex min-w-0 max-w-[420px] flex-1 items-center gap-2 rounded-pill bg-white/15 px-3 py-1.5 focus-within:bg-white/25 sm:flex-none sm:w-[320px]">
          <span aria-hidden="true" className="text-sm">🔎</span>
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

        <IconButton
          aria-label={t('nav.settings')}
          title={t('nav.settings')}
          onClick={onSettings}
          className="text-white hover:border-white/30 hover:bg-white/20 hover:text-white dark:text-white dark:hover:bg-white/20"
        >
          ⚙
        </IconButton>

        {signedIn ? (
          <span className="hidden whitespace-nowrap text-[13.5px] font-medium text-white lg:inline">
            {user?.email}
            {role ? ` · ${role}` : ''}
          </span>
        ) : null}
      </div>
    </header>
  );
}
