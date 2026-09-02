import { useEffect, useRef, useState } from 'react';
import { useAuth, useI18n, useTheme } from '@vcb/shared';
import { GearIcon, HelpIcon, MenuIcon, SearchIcon } from './icons';
import { IconButton } from './ui';

// A segmented two/three-way switch. Small enough to hand-write, and the only
// control the settings menu needs.
function Segmented({ label, options, value, onChange }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex gap-1 rounded-control bg-surface-sunken p-1 dark:bg-surface-dark-sunken"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={
            'flex-1 rounded-[6px] px-2.5 py-1.5 text-xs font-medium transition-colors ' +
            (value === o.value
              ? 'bg-surface-card text-ink shadow-card dark:bg-surface-dark-card dark:text-ink-dark'
              : 'text-ink-muted hover:text-ink dark:text-ink-dark-muted dark:hover:text-ink-dark')
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Topbar({
  query,
  onQuery,
  onMenu,
  onHelp,
  onAdmin,
  showAdmin,
  greeting,
  initials,
  userTitle,
}) {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { signedIn, signOut } = useAuth();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close on an outside click or Escape. One listener pair, only while open.
  useEffect(() => {
    if (!settingsOpen) return undefined;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setSettingsOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [settingsOpen]);

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface-card/85 px-4 py-3 backdrop-blur-md dark:border-line-dark dark:bg-surface-dark-card/85 sm:px-6">
      <IconButton className="lg:hidden" aria-label={t('nav.openMenu')} onClick={onMenu}>
        <MenuIcon />
      </IconButton>

      <div className="relative min-w-0 flex-1 sm:max-w-md">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted dark:text-ink-dark-muted" />
        <input
          type="search"
          className="w-full rounded-pill border border-line bg-surface-sunken py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted/80 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 dark:border-line-dark dark:bg-surface-dark-sunken dark:text-ink-dark dark:placeholder:text-ink-dark-muted/70 dark:focus:border-accent-dark dark:focus:ring-accent-dark/20"
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* "Manage announcement" used to be its own button here, wearing the
            same gear icon as Settings — two identical gears side by side, and
            nothing but a tooltip to tell them apart. It is now an item inside
            the settings menu, which is where a rarely-used admin action
            belongs. */}
        <div className="relative" ref={wrapRef}>
          <IconButton
            aria-label={t('settings.theme')}
            aria-haspopup="menu"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((o) => !o)}
          >
            <GearIcon />
          </IconButton>

          {settingsOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-30 mt-2 w-60 animate-fade-in rounded-card border border-line bg-surface-card p-3 shadow-card-hover dark:border-line-dark dark:bg-surface-dark-card dark:shadow-card-dark"
            >
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-dark-muted">
                {t('settings.language')}
              </p>
              <Segmented
                label={t('settings.language')}
                value={lang}
                onChange={setLang}
                options={[
                  { value: 'th', label: 'ไทย' },
                  { value: 'en', label: 'EN' },
                ]}
              />

              <p className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-dark-muted">
                {t('settings.theme')}
              </p>
              <Segmented
                label={t('settings.theme')}
                value={theme}
                onChange={setTheme}
                options={[
                  { value: 'light', label: t('theme.light') },
                  { value: 'dark', label: t('theme.dark') },
                  { value: 'auto', label: t('theme.auto') },
                ]}
              />

              <div className="my-3 border-t border-line dark:border-line-dark" />

              {showAdmin && (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-control px-2 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-sunken dark:text-ink-dark dark:hover:bg-surface-dark-sunken"
                  onClick={() => {
                    setSettingsOpen(false);
                    onAdmin();
                  }}
                >
                  <GearIcon className="h-4 w-4" />
                  <span>{t('admin.manage')}</span>
                </button>
              )}

              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-control px-2 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-sunken dark:text-ink-dark dark:hover:bg-surface-dark-sunken"
                onClick={() => {
                  setSettingsOpen(false);
                  onHelp();
                }}
              >
                <HelpIcon className="h-4 w-4" />
                <span>{t('nav.help')}</span>
              </button>

              {/* No longer conditional on signedIn: the portal gates on `user`
                  in App.jsx, so anyone seeing this menu is signed in by
                  definition. signOut() clears the token, which drops the app
                  back to the sign-in screen — that is the "return to login"
                  route, and it is also how you switch account. */}
              <button
                type="button"
                className="mt-1 w-full rounded-control px-2 py-2 text-left text-sm text-danger transition-colors hover:bg-danger-bg dark:text-danger-dark dark:hover:bg-danger/10"
                onClick={() => {
                  setSettingsOpen(false);
                  signOut();
                }}
              >
                {t('auth.signOut')}
              </button>
            </div>
          )}
        </div>

        <div className="hidden items-center gap-2 rounded-pill border border-line bg-surface-sunken py-1 pl-1 pr-3 sm:flex dark:border-line-dark dark:bg-surface-dark-sunken">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-[11px] font-semibold text-white dark:bg-accent-dark dark:text-surface-dark">
            {initials}
          </span>
          <span
            className="max-w-[140px] truncate text-sm text-ink dark:text-ink-dark"
            title={userTitle}
          >
            {greeting}
          </span>
        </div>
      </div>
    </header>
  );
}
