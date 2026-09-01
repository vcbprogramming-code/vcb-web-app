// The topbar: title, identity, theme and language, settings.
//
// The brand gradient is the shared preset's `bg-brand-bar` — the same one every
// VCB Connect module wears, so the portal and this app do not disagree.

import React from 'react';
import { useAuth, useI18n, useTheme } from '@vcb/shared';
import { useData } from '../lib/DataContext.jsx';

export default function Header({ onOpenSettings }) {
  const { t, lang, setLang } = useI18n();
  const { resolved, toggleTheme } = useTheme();
  const { user, signOut, signedIn } = useAuth();
  const { me, isManager } = useData();

  const email = me?.email || user?.email || '';

  return (
    <header className="bg-brand-bar text-ink-invert shadow-topbar dark:bg-brand-bar-dark">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold tracking-tight">{t('app.title')}</h1>
          <p className="truncate text-xs text-white/70">{t('app.subtitle')}</p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
            title={t('settings.language')}
            className="focusable rounded-control px-2.5 py-1.5 text-xs font-bold text-white/85 transition-colors hover:bg-white/15 hover:text-white"
          >
            {lang === 'th' ? 'EN' : 'ไทย'}
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            title={t('settings.theme')}
            aria-label={t('settings.theme')}
            className="focusable rounded-control px-2.5 py-1.5 text-sm text-white/85 transition-colors hover:bg-white/15 hover:text-white"
          >
            {resolved === 'dark' ? '🌙' : '☀'}
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            title={t('set.open')}
            aria-label={t('set.open')}
            className="focusable rounded-control px-2.5 py-1.5 text-sm text-white/85 transition-colors hover:bg-white/15 hover:text-white"
          >
            ⚙
          </button>

          <div className="ml-1 hidden min-w-0 flex-col items-end leading-tight sm:flex">
            <span className="max-w-[16rem] truncate text-xs font-semibold">
              {email || t('app.noUser')}
            </span>
            <span className="text-[11px] text-white/65">
              {isManager ? t('app.manager') : t('app.guest')}
            </span>
          </div>

          {signedIn ? (
            <button
              type="button"
              onClick={signOut}
              className="focusable ml-1 rounded-control border border-white/25 px-2.5 py-1.5 text-xs font-semibold text-white/90 transition-colors hover:bg-white/15"
            >
              {t('auth.signOut')}
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
