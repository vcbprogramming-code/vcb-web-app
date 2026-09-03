/**
 * Banner: brand mark, search, settings.
 *
 * This was a hand-copied header rather than the shared AppBar. It carried the
 * same Tailwind classes at the time it was written and then drifted: a 36px
 * gear against everyone else's 32px, no sticky, and the signed-in email pinned
 * into the bar itself, which no other module does. Copies drift; this is the
 * component.
 *
 * The identity pill moved into the settings sheet's footer, which is where HR,
 * Credit Facility and Meeting Minutes already show who is signed in. The editor
 * badge goes with it — the three states this module distinguishes (signed out,
 * signed in, signed in as editor) are unchanged, only relocated, because
 * reading the SOP does not imply a session.
 */

import { AppBar, useAuth, useI18n } from '@vcb/shared';

import { Icon } from '../lib/icons.jsx';
import { useStore } from '../store.jsx';

export default function TopBar({ onSettings }) {
  const { t } = useI18n();
  const { signedIn } = useAuth();
  const { query, setQuery, canEdit, userEmail } = useStore();

  return (
    <AppBar
      title={t('app.title')}
      subtitle={t('app.subtitle')}
      settingsExtra={
        onSettings ? (
          <button
            type="button"
            onClick={onSettings}
            className="flex w-full items-center justify-between gap-3 rounded-control px-1 py-2 text-left text-sm text-ink hover:bg-surface-sunken dark:text-ink-dark dark:hover:bg-surface-dark-sunken"
          >
            <span>{t('settings.title')}</span>
            <span aria-hidden="true" className="text-ink-muted dark:text-ink-dark-muted">
              →
            </span>
          </button>
        ) : null
      }
      // The email itself is in the bar now, in the same place as every other
      // module. What stays here is the part specific to this one: reading the
      // SOP does not imply a session, so "read only" is worth saying.
      identityNote={canEdit ? t('auth.editorBadge') : null}
      settingsFooter={
        signedIn ? null : (
          <p className="text-xs text-ink-muted dark:text-ink-dark-muted">
            {t('auth.readOnlyNote')}
          </p>
        )
      }
    >
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
          className="h-10 w-full rounded-[9px] border border-white/[.18] bg-white/10 pl-9 pr-3 text-base text-white placeholder:text-white/60 focus:bg-white/20 focus:outline-none lg:text-sm"
        />
      </label>
    </AppBar>
  );
}
