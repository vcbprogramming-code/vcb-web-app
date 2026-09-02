import { useEffect, useMemo, useState } from 'react';
import { useI18n, useTheme } from '@vcb/shared';
import { AnnouncementIcon, AppIcon } from './icons';
import HolidayCalendar from './HolidayCalendar';
import { SAMPLE_BIRTHDAYS, SAMPLE_LEAVE, appLink } from './data';
import { appCopy } from './lib/appCopy';
import { CARD_CLASS, IconButton, Panel, PanelHead, PanelTitle } from './ui';

function initialsFromName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}

function greetingKeyForHour(h) {
  if (h < 12) return 'dash.goodMorning';
  if (h < 18) return 'dash.goodAfternoon';
  return 'dash.goodEvening';
}

export default function Dashboard({
  apps,
  appsError,
  announcement,
  bannerDismissed,
  onDismissBanner,
  greeting,
  query,
  bindTooltip,
}) {
  const { t, lang } = useI18n();
  // Passed to appLink() so a tile carries the current appearance across to the
  // module it opens — see the note on appLink in data.js.
  const { theme } = useTheme();

  // The clock ticks every 30s, as index.html's did — a minute-resolution
  // display does not need a per-second render.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const locale = lang === 'th' ? 'th-TH' : 'en-GB';
  const clockText = `${now.toLocaleDateString(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })} · ${now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;

  // Search matches whatever the person can actually read, so the resolved copy
  // is what gets searched — not the raw English row.
  const q = query.trim().toLowerCase();
  const filteredApps = useMemo(() => {
    if (!q) return apps;
    return apps.filter((a) => {
      const copy = appCopy(a, lang, t);
      return `${copy.name} ${copy.desc}`.toLowerCase().includes(q);
    });
  }, [q, apps, lang, t]);

  const hasAnnouncement = Boolean(announcement?.show && (announcement.title || announcement.body));
  const showBanner = hasAnnouncement && !bannerDismissed;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      {/* dismissible banner */}
      {showBanner && (
        <div className={`${CARD_CLASS} mb-4 flex items-start gap-3.5 px-4 py-3.5`}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-control bg-accent/10 text-accent dark:bg-accent-dark/15 dark:text-accent-dark">
            <AnnouncementIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            {announcement.title && (
              <p className="font-semibold text-ink dark:text-ink-dark">{announcement.title}</p>
            )}
            {announcement.body && (
              <p className="mt-0.5 whitespace-pre-line text-sm text-ink-muted dark:text-ink-dark-muted">
                {announcement.body}
              </p>
            )}
          </div>
          <IconButton
            className="h-7 w-7 shrink-0 text-lg leading-none"
            title={t('banner.dismiss')}
            aria-label={t('banner.dismiss')}
            onClick={onDismissBanner}
          >
            ×
          </IconButton>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* -------------------- left column -------------------- */}
        <div className="min-w-0 space-y-5">
          {/* Greeting first, then announcements — the order the live app uses.
              The port had them reversed, which buried the person's own name
              under a panel that is usually empty.

              Dark gradient with white text, matching .welcome-card in the live
              index.html: the same sidebar gradient, so the greeting reads as
              part of the app's chrome rather than as another white card in a
              stack of white cards. The ::after radial highlight is reproduced
              as the absolutely-positioned span below. */}
          <section
            className="reveal relative flex flex-wrap items-center justify-between gap-5 overflow-hidden rounded-card bg-gradient-to-br from-brand-900 to-brand-700 px-8 py-6 text-white shadow-card"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(420px_220px_at_90%_0%,rgba(79,209,255,0.22),transparent_70%)]"
            />
            <div className="relative min-w-0">
              <p className="text-xl font-bold">
                {t(greetingKeyForHour(now.getHours()))}, {greeting}
              </p>
              <p className="mt-1 text-sm text-white/65">{t('dash.welcomeSub')}</p>
            </div>
            <div className="relative flex flex-col items-start gap-2 sm:items-end">
              <span className="inline-flex items-center gap-2 rounded-pill bg-white/10 px-3 py-1 text-xs font-medium text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-ok-dark" />
                {t('dash.systemOnline')}
              </span>
              <span className="text-xs text-white/60">{clockText}</span>
            </div>
          </section>

          {/* The panel is hidden entirely while the banner is showing the same
              announcement. It used to render regardless, so a dashboard with a
              live announcement in the banner ALSO said "No announcements right
              now" directly beneath it - two statements contradicting each other
              on the same screen. */}
          {hasAnnouncement && !bannerDismissed ? null : (
          <Panel className="reveal" style={{ animationDelay: '45ms' }}>
            <PanelHead>
              <PanelTitle>{t('panel.announcements')}</PanelTitle>
            </PanelHead>
            {/* Only shown once the banner above is dismissed. Both were
                rendering the same announcement at the same time, so the same
                Thai paragraph appeared twice on first load. The banner is the
                one that demands attention; the panel is where it lives
                afterwards. */}
            {hasAnnouncement && bannerDismissed ? (
              <div>
                {announcement.title && (
                  <p className="font-semibold text-ink dark:text-ink-dark">{announcement.title}</p>
                )}
                {announcement.body && (
                  <p className="mt-1 whitespace-pre-line text-sm text-ink-muted dark:text-ink-dark-muted">
                    {announcement.body}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-muted dark:text-ink-dark-muted">
                {t('panel.announcementsEmpty')}
              </p>
            )}
          </Panel>
          )}

          <div className="reveal flex items-baseline justify-between gap-3" style={{ animationDelay: '90ms' }}>
            <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">
              {t('dash.applications')}
            </h2>
            <span className="text-xs text-ink-muted dark:text-ink-dark-muted">
              {apps.length} {t('dash.available')}
            </span>
          </div>

          {appsError && (
            <p className="text-sm text-danger dark:text-danger-dark" role="alert">
              {appsError}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {filteredApps.map((a, i) => {
              const copy = appCopy(a, lang, t);
              return (
                <a
                  key={a.key}
                  href={appLink(a.url, { theme, lang })}
                  target="_blank"
                  rel="noopener noreferrer"
                  // The per-tile accent is a database column, so it has to be an
                  // inline style — Tailwind cannot generate a class for a value
                  // it never sees at build time.
                  style={{ borderTopColor: a.accent || undefined, animationDelay: `${i * 45}ms` }}
                  className={`${CARD_CLASS} reveal group flex flex-col gap-2.5 border-t-2 p-4 transition-shadow hover:shadow-card-hover`}
                  {...bindTooltip({
                    key: `card-${a.key}`,
                    name: copy.name,
                    desc: copy.preview,
                    kind: 'card',
                  })}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-control"
                      style={{
                        backgroundColor: a.accent ? `${a.accent}1f` : undefined,
                        color: a.accent || undefined,
                      }}
                    >
                      <AppIcon icon={a.icon} className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1 font-semibold text-ink dark:text-ink-dark">
                      {copy.name}
                    </span>
                  </div>
                  <p className="text-sm text-ink-muted dark:text-ink-dark-muted">{copy.desc}</p>
                  <span className="mt-auto pt-1 text-sm font-medium text-accent dark:text-accent-dark">
                    {t('dash.launch')}{' '}
                    <span className="inline-block transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </span>
                </a>
              );
            })}
          </div>

          {filteredApps.length === 0 && !appsError && (
            <p className="text-sm text-ink-muted dark:text-ink-dark-muted">{t('search.empty')}</p>
          )}
        </div>

        {/* -------------------- right column -------------------- */}
        {/* The globe used to sit at the top of this column. It was decoration
            costing 210px above the calendar — the thing people actually come
            here to read. It now fills the sign-in screen behind the login card,
            where being decorative is the entire job. */}
        <div className="space-y-5">
          <HolidayCalendar />

          <Panel className="reveal">
            <PanelHead>
              <PanelTitle>{t('panel.birthdays')}</PanelTitle>
            </PanelHead>
            <div className="space-y-3">
              {SAMPLE_BIRTHDAYS.map((b) => (
                <div key={b.name} className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/10 text-[11px] font-semibold text-accent dark:bg-accent-dark/15 dark:text-accent-dark">
                    {initialsFromName(b.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink dark:text-ink-dark">
                      {b.name}{' '}
                      <span className="text-[10px] uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted">
                        {b.dept}
                      </span>
                    </p>
                    <p className="text-xs text-ink-muted dark:text-ink-dark-muted">{b.when}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 border-t border-line pt-3 text-[11px] text-ink-muted dark:border-line-dark dark:text-ink-dark-muted">
              {t('panel.birthdaysNote')}
            </p>
          </Panel>

          <Panel className="reveal">
            <PanelHead>
              <PanelTitle>{t('panel.leave')}</PanelTitle>
            </PanelHead>
            {SAMPLE_LEAVE.length === 0 ? (
              <p className="text-sm text-ink-muted dark:text-ink-dark-muted">
                {t('panel.leaveEmpty')}
              </p>
            ) : (
              <div className="space-y-3">
                {SAMPLE_LEAVE.map((l) => (
                  <div key={l.name} className="flex items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/10 text-[11px] font-semibold text-accent dark:bg-accent-dark/15 dark:text-accent-dark">
                      {initialsFromName(l.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink dark:text-ink-dark">{l.name}</p>
                      <p className="text-xs text-ink-muted dark:text-ink-dark-muted">{l.when}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

export { initialsFromName };
