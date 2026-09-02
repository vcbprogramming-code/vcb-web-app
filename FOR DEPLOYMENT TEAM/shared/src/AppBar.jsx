import React, { useState } from 'react';
import { useI18n } from './i18n.jsx';
import { useTheme } from './theme.jsx';
import { useAuthOptional } from './auth.jsx';

/**
 * The bar every module wears.
 *
 * WHY THIS IS SHARED AND NOT COPIED
 *
 * Before this, six modules each had their own: four different filenames
 * (Header.jsx, TopBar.jsx, Topbar.jsx, or inline in App.jsx), two of them with
 * no way back to the portal at all, one with the language toggle exposed as a
 * button while the rest kept it in settings, and brand text at 17px, 20px and
 * 18px depending on which file you opened. Every one of those was a small
 * decision made twice, drifting apart on its own schedule.
 *
 * A person moving from HR to Credit Facility should not notice they have moved
 * anywhere. That only holds if there is one bar, not six that agree today.
 *
 * WHAT GOES IN THE GEAR, AND WHY
 *
 * Language and appearance live behind the gear, never as their own buttons.
 * They are set once and then forgotten; a button spends the other 99% of its
 * life competing for attention with the controls people actually came to use.
 * The portal already works this way and the modules now match it.
 *
 * BACK TO THE PORTAL
 *
 * The brand name is the way home, as it is on most sites, and it carries the
 * current theme and language so the portal does not flip appearance when
 * someone returns to it. VITE_PORTAL_URL lets each deployment point at the
 * right place; it defaults to '/' because once everything is served from one
 * domain (see docs/ONE_DOMAIN.md) the portal IS the root.
 */

const PORTAL_URL = import.meta.env.VITE_PORTAL_URL || '/';

function GearIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
         strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/** One row in the settings sheet: a label and a segmented control. */
function SettingRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-ink dark:text-ink-dark">{label}</span>
      <div className="flex gap-1 rounded-control bg-surface-sunken p-1 dark:bg-surface-dark-sunken">
        {children}
      </div>
    </div>
  );
}

function Segment({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'rounded-control px-3 py-1 text-xs font-semibold transition-colors ' +
        (active
          ? 'bg-surface-card text-ink shadow-card dark:bg-surface-dark-card dark:text-ink-dark'
          : 'text-ink-muted hover:text-ink dark:text-ink-dark-muted dark:hover:text-ink-dark')
      }
    >
      {children}
    </button>
  );
}

/**
 * The settings sheet.
 *
 * `extra` is where a module adds what only it has — SOP's default view, HR's
 * lock window, Meeting Minutes' project access. Appearance and language are
 * here for everyone and are not a module's business to reproduce.
 */
export function AppSettings({ open, onClose, extra = null, footer = null }) {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();

  if (!open) return null;

  return (
    <div
      // Above everything. z-50 put this behind System Map's trace overlay
      // (z-65) and its detail sidebar (z-200), so pressing the gear in trace
      // mode appeared to do nothing — the sheet opened underneath. A modal
      // invoked from the app bar has to outrank whatever the module stacks
      // beneath it, and the bar itself is z-20.
      className="fixed inset-0 z-[1000] grid place-items-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('settings.title')}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-card border border-line bg-surface-card p-5 shadow-card dark:border-line-dark dark:bg-surface-dark-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="m-0 text-base font-bold text-ink dark:text-ink-dark">
            {t('settings.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="grid h-7 w-7 place-items-center rounded-control text-lg leading-none text-ink-muted hover:bg-surface-sunken dark:text-ink-dark-muted dark:hover:bg-surface-dark-sunken"
          >
            ×
          </button>
        </div>

        <SettingRow label={t('settings.appearance')}>
          <Segment active={theme === 'light'} onClick={() => setTheme('light')}>
            {t('theme.light')}
          </Segment>
          <Segment active={theme === 'dark'} onClick={() => setTheme('dark')}>
            {t('theme.dark')}
          </Segment>
          <Segment active={theme === 'auto'} onClick={() => setTheme('auto')}>
            {t('theme.auto')}
          </Segment>
        </SettingRow>

        <SettingRow label={t('settings.language')}>
          <Segment active={lang === 'th'} onClick={() => setLang('th')}>
            ไทย
          </Segment>
          <Segment active={lang === 'en'} onClick={() => setLang('en')}>
            EN
          </Segment>
        </SettingRow>

        {/* onClick closes the sheet: extra often holds a link, and navigating
            with the overlay still up leaves the person tapping a scrim to get
            to the page they just opened. */}
        {extra ? (
          <div
            className="mt-2 border-t border-line pt-2 dark:border-line-dark"
            onClick={onClose}
          >
            {extra}
          </div>
        ) : null}

        {footer ? (
          <div className="mt-3 border-t border-line pt-3 dark:border-line-dark">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The bar itself.
 *
 * `title` / `subtitle` name the module. `children` is whatever that module
 * needs in the bar — a search box, a nav, a month picker — and sits between the
 * brand and the gear.
 */
export default function AppBar({
  title,
  subtitle,
  subtitleTh,
  children,
  settingsExtra = null,
  settingsFooter = null,
  right = null,
  identityNote = null,
}) {
  const { t, lang } = useI18n();
  const { theme } = useTheme();
  // Optional: System Map has no AuthProvider by design, and the bar must not
  // be the thing that forces one onto a module with nothing to protect.
  const auth = useAuthOptional();
  const user = auth?.user;
  const signedIn = auth?.signedIn;
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Carry appearance and language home, so returning to the portal does not
  // flip it back — the same reason module links carry them outward. See
  // appLink() in the portal.
  const home = (() => {
    try {
      const u = new URL(PORTAL_URL, window.location.origin);
      if (theme) u.searchParams.set('theme', theme);
      if (lang) u.searchParams.set('lang', lang);
      return u.origin === window.location.origin ? u.pathname + u.search : u.toString();
    } catch {
      return PORTAL_URL;
    }
  })();

  return (
    <>
      {/* Metrics taken from E-Memo, which is the one that reads clearly:
          padding 16px 28px, brand 17px, subtitle 11px. The 9.5px title the
          other modules had was too small to read at a glance. */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 bg-brand-bar px-7 py-4 text-white shadow-topbar dark:bg-brand-bar-dark">
        <div className="order-1 flex min-w-0 flex-1 items-center gap-2.5 lg:flex-none">
          {/* The brand is the way back to the portal — the convention everywhere
              else on the web, and it means no module needs its own "back"
              button competing for space in the bar. */}
          <a
            href={home}
            title={t('app.backToPortal')}
            className="shrink-0 text-[17px] font-bold tracking-wide text-white no-underline transition-colors hover:text-white/80"
          >
            {t('app.brand')}
          </a>
          <span className="h-8 w-px shrink-0 bg-white/30" aria-hidden="true" />
          {/* Fixed 40px, matching the chips beside it. Left to size itself the
              block came out 40px with one subtitle and 45px with two, so the
              bar was 72px in most modules and 77px in Meeting Minutes — the
              kind of difference nobody can name but everybody sees when moving
              between two tabs. leading-tight keeps both lines inside it. */}
          <div className="flex h-10 min-w-0 flex-col justify-center gap-0.5 overflow-hidden leading-tight">
            <span className="truncate text-[13px] font-semibold uppercase tracking-wider text-white/95">
              {title}
            </span>
            {(subtitle || subtitleTh) && (
              <span className="truncate text-[11px] text-white/70">
                {lang === 'th' ? subtitleTh || subtitle : subtitle || subtitleTh}
              </span>
            )}
          </div>
        </div>

        {children ? (
          <div className="order-3 flex w-full items-center gap-2 lg:order-2 lg:ml-auto lg:w-auto">
            {children}
          </div>
        ) : (
          <span className="order-2 ml-auto" />
        )}

        <div className="order-2 flex shrink-0 items-center gap-2 lg:order-3">
          {right}
          {/* Who is signed in, in the bar, in the same place in every module.
              The live apps show it here; the port showed it in SOP's bar only,
              and elsewhere buried in the settings sheet or not at all. Hidden
              below lg — at that width the bar has no room and the settings
              sheet still carries it. */}
          {signedIn && user?.email ? (
            <span
              className="hidden max-w-[280px] items-center gap-1.5 text-[13px] font-medium text-white/90 lg:flex"
              title={user.email}
            >
              <span className="truncate">{user.email}</span>
              {identityNote ? (
                <span className="shrink-0 text-white/70">· {identityNote}</span>
              ) : null}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title={t('settings.title')}
            aria-label={t('settings.title')}
            // E-Memo's .dm-btn: a 40px chip with a 9px radius and an 18px
            // glyph, matching every other control in the bar so their top and
            // bottom edges sit on one plane. A bare 32px icon button did not.
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[9px] border border-white/[.18] bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <GearIcon className="h-[18px] w-[18px]" />
          </button>
        </div>
      </header>

      <AppSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        extra={settingsExtra}
        footer={settingsFooter}
      />
    </>
  );
}
