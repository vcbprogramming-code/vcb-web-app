/**
 * Banner: brand mark, search, settings, and the identity pill.
 *
 * The pill now reflects three states rather than the old app's two, because
 * reading no longer implies a session: signed out (the common case — the SOP is
 * public), signed in without the editor role, and signed in as an editor.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useI18n } from '@vcb/shared';

import { Icon } from '../lib/icons.jsx';
import { useStore } from '../store.jsx';
import SettingsModal from './SettingsModal.jsx';

// The portal this module is one tile of. Env-overridable so a deployment can
// point it at the real portal origin without a code change.
const PORTAL_URL = import.meta.env.VITE_PORTAL_URL || '/';

export default function TopBar() {
  const { t } = useI18n();
  const { signedIn } = useAuth();
  const { query, setQuery, canEdit, userEmail } = useStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <header className="z-20 flex flex-wrap items-center gap-3 bg-brand-bar px-4 py-2.5 text-white shadow-topbar dark:bg-brand-bar-dark">
        {/* brand */}
        <div className="order-1 flex min-w-0 flex-1 items-center gap-2.5 lg:flex-none">
          <a
            href={PORTAL_URL}
            title={t('app.backToPortal')}
            className="shrink-0 text-[17px] font-bold tracking-wide text-white no-underline hover:text-brand-100 lg:text-xl"
          >
            {t('app.brand')}
          </a>
          <span className="h-7 w-px shrink-0 bg-white/30" aria-hidden="true" />
          <div className="flex min-w-0 flex-col gap-0.5 overflow-hidden">
            <span className="truncate text-[9.5px] font-semibold uppercase tracking-wider text-white/90 lg:text-[11px]">
              {t('app.subtitle')}
            </span>
            <span className="truncate text-[9.5px] text-white/70 lg:text-[11px]">
              {t('app.subtitleTH')}
            </span>
          </div>
        </div>

        {/* search + actions */}
        <div className="order-3 flex w-full items-center gap-2 lg:order-2 lg:ml-auto lg:w-auto">
          <label className="relative flex min-w-0 flex-1 items-center lg:w-72 lg:flex-none">
            <span className="pointer-events-none absolute left-2.5 text-white/70">
              <Icon name="search" className="h-4 w-4" />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search.placeholder')}
              autoComplete="off"
              aria-label={t('common.search')}
              // ≥16px on narrow screens, or iOS zooms the page on focus.
              className="w-full rounded-control border border-white/25 bg-white/15 py-2 pl-9 pr-3 text-base text-white placeholder:text-white/60 focus:border-white/50 focus:bg-white/25 focus:outline-none lg:text-sm"
            />
          </label>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title={t('settings.title')}
            aria-label={t('settings.title')}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-white/25 bg-white/15 text-white hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <Icon name="settings" className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* identity */}
        <div className="order-2 ml-auto hidden max-w-[280px] items-center gap-2 lg:order-3 lg:ml-0 lg:flex">
          {signedIn ? (
            <span
              className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-white"
              title={userEmail}
            >
              {canEdit && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-white/20 px-2 py-0.5 text-[11px] font-semibold">
                  <Icon name="shield" className="h-3 w-3" />
                  {t('auth.editorBadge')}
                </span>
              )}
              <span className="truncate">{userEmail}</span>
            </span>
          ) : (
            <span className="truncate text-[12px] text-white/70">{t('auth.readOnlyNote')}</span>
          )}
        </div>
      </header>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  );
}
