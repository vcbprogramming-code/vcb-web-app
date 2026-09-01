import React from 'react';
import { useAuth, useI18n, useTheme, LANGS, THEMES } from '@vcb/shared';
import { Button, Modal } from '../ui';

const THEME_LABEL = { light: '☀', dark: '🌙', auto: '🖥' };

/**
 * Display preferences and the admin entry point.
 *
 * Theme and language now come from the shared providers, so a choice made here
 * follows the person into every other module — which is the point of one
 * website. The old version wrote vcb_mm_theme / vcb_mm_lang, keys no other
 * module read.
 *
 * The old sheet also had a "Reading size" row wired to nothing (its three
 * dictionary keys existed but no control ever used them) and a build number
 * scraped out of the Apps Script deployment URL. Both are gone: a control that
 * does nothing is worse than no control, and there is no /exec URL any more.
 */
export default function SettingsModal({ open, onClose, onOpenAccess }) {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { user, signedIn, hasRole, signOut } = useAuth();

  if (!open) return null;

  const isAdmin = hasRole('minutes', 'admin');
  const role = isAdmin
    ? t('settings.roleAdmin')
    : hasRole('minutes', 'editor')
      ? t('settings.roleEditor')
      : t('settings.roleViewer');

  const segment =
    'flex-1 rounded-md px-3 py-2 text-[12.5px] font-semibold transition-colors';
  const segmentOn = 'bg-brand-600 text-white';
  const segmentOff =
    'text-ink-muted hover:bg-surface-card hover:text-ink dark:text-ink-dark-muted dark:hover:bg-surface-dark-card dark:hover:text-ink-dark';

  return (
    <Modal
      open
      onClose={onClose}
      title={t('nav.settings')}
      actions={<Button onClick={onClose}>{t('common.close')}</Button>}
    >
      <div className="grid gap-5">
        <section className="grid gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[.06em] text-ink-muted dark:text-ink-dark-muted">
            {t('settings.signedInAs')}
          </div>
          <div className="text-sm font-semibold text-ink dark:text-ink-dark">
            {signedIn ? `${user?.email} · ${role}` : t('settings.notSignedIn')}
          </div>
          {signedIn ? (
            <Button onClick={signOut} className="justify-self-start">
              {t('auth.signOut')}
            </Button>
          ) : null}
        </section>

        <section className="grid gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[.06em] text-brand-900 dark:text-brand-300">
            {t('settings.display')}
          </div>

          <div className="text-xs font-semibold text-ink-muted dark:text-ink-dark-muted">
            {t('settings.theme')}
          </div>
          <div
            role="group"
            aria-label={t('settings.theme')}
            className="flex gap-1 rounded-control bg-surface-sunken p-1 dark:bg-surface-dark-sunken"
          >
            {THEMES.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={theme === v}
                onClick={() => setTheme(v)}
                className={`${segment} ${theme === v ? segmentOn : segmentOff}`}
              >
                {THEME_LABEL[v]} {t(`theme.${v}`)}
              </button>
            ))}
          </div>

          <div className="mt-1.5 text-xs font-semibold text-ink-muted dark:text-ink-dark-muted">
            {t('settings.language')}
          </div>
          <div
            role="group"
            aria-label={t('settings.language')}
            className="flex gap-1 rounded-control bg-surface-sunken p-1 dark:bg-surface-dark-sunken"
          >
            {LANGS.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={lang === v}
                onClick={() => setLang(v)}
                className={`${segment} ${lang === v ? segmentOn : segmentOff}`}
              >
                {v === 'th' ? 'ไทย / TH' : 'English / EN'}
              </button>
            ))}
          </div>
        </section>

        {isAdmin ? (
          <Button onClick={onOpenAccess} className="justify-self-start">
            {t('settings.projectAccess')}
          </Button>
        ) : null}

        <section className="grid gap-1">
          <div className="text-[11px] font-semibold uppercase tracking-[.06em] text-brand-900 dark:text-brand-300">
            {t('settings.about')}
          </div>
          <div className="flex justify-between border-b border-line py-1.5 text-[13px] dark:border-line-dark">
            <span className="font-semibold text-ink-muted dark:text-ink-dark-muted">
              {t('settings.app')}
            </span>
            <span className="text-ink dark:text-ink-dark">{t('app.title')}</span>
          </div>
          <div className="flex justify-between py-1.5 text-[13px]">
            <span className="font-semibold text-ink-muted dark:text-ink-dark-muted">
              {t('settings.admin')}
            </span>
            <a
              href="mailto:c.chavananand@vcb-con.com"
              className="text-brand-600 no-underline hover:underline dark:text-brand-300"
            >
              c.chavananand@vcb-con.com
            </a>
          </div>
        </section>
      </div>
    </Modal>
  );
}
