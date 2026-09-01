import React, { useEffect, useState } from 'react';
import { useI18n } from '@vcb/shared';
import { useMinutesData } from '../MinutesData';
import { copyLink, projectLink, projectMeetings, SOURCE } from '../lib/minutes';
import { summaryHtml } from '../lib/docCss';
import { fmtDate, timeSuffix } from '../lib/dates';
import { Badge, Button, Dot, Empty } from '../ui';

/**
 * One project's landing panel: the executive summary and action items of its
 * most recent meeting.
 */
export default function ProjectDashboard({ project, onOpen, onToast }) {
  const { t, lang } = useI18n();
  const { meetings, getCached, fetchMeeting, cacheVersion } = useMinutesData();

  const items = projectMeetings(meetings, project.id);
  const latest = items[0];

  const [summary, setSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    if (!latest) {
      setSummary('');
      return undefined;
    }
    let alive = true;

    const cached = getCached(latest.id);
    if (cached) {
      setSummary(summaryHtml(cached.html, latest.excerpt, t));
      setLoadingSummary(false);
      return undefined;
    }

    setLoadingSummary(true);
    const ac = new AbortController();
    fetchMeeting(latest.id, { signal: ac.signal })
      .then((full) => {
        if (!alive || !full) return;
        setSummary(summaryHtml(full.html, latest.excerpt, t));
      })
      .catch(() => {
        // The card still shows the date, title and the read-more link, which is
        // the useful part; a failed summary should not blank the whole panel.
        if (alive) setSummary('');
      })
      .finally(() => {
        if (alive) setLoadingSummary(false);
      });

    return () => {
      alive = false;
      ac.abort();
    };
    // cacheVersion so a record warmed by the boot prefetch after this mounted
    // still lands here rather than leaving the panel on its loading line.
  }, [latest?.id, latest?.excerpt, getCached, fetchMeeting, cacheVersion, t]);

  /**
   * A permalink that always resolves to whatever is CURRENTLY latest in this
   * project — unlike a meeting's own share link, which is fixed. Paste it once
   * into a chat and it keeps pointing at the newest minutes.
   */
  const shareProject = () => {
    copyLink(
      projectLink(project.id),
      () => onToast(t('dash.shareProjectCopied')),
      t('dash.shareProjectPrompt')
    );
  };

  if (!latest) {
    return (
      <Empty glyph="📄">
        {t('dash.noMeetingsFor', { name: project.name || t('dash.thisProject') })}
      </Empty>
    );
  }

  // A title that is itself a Buddhist-era date duplicates the date line above
  // it, so it is not repeated as a subtitle.
  const titleIsDate = /25\d{2}/.test(latest.title || '');

  return (
    <div className="max-w-[1100px] px-7 py-6">
      <header className="mb-4">
        <h2 className="mb-1 flex items-center gap-2 text-xl font-bold text-brand-900 dark:text-brand-300">
          <Dot color={project.color} size={11} />
          {t('dash.projectLatest', { name: project.name || '' })}
        </h2>
        <Button onClick={shareProject} title={t('dash.shareProjectHint')} className="my-2">
          {t('dash.shareProject')}
        </Button>
        <p className="text-[13.5px] text-ink-muted dark:text-ink-dark-muted">
          {t('dash.projectIntro')}
        </p>
      </header>

      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          // A link inside the summary is a link, not a way into the meeting.
          if (e.target.closest('a')) return;
          onOpen(latest.id);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen(latest.id);
          }
        }}
        style={{ borderLeftColor: project.color || '#1D4E89' }}
        className="max-w-[880px] cursor-pointer rounded-card border border-l-[5px] border-line bg-surface-card px-[26px] py-[22px] transition-all hover:-translate-y-0.5 hover:shadow-card-hover dark:border-line-dark dark:bg-surface-dark-card"
      >
        <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[17px] font-bold text-brand-600 dark:text-brand-300">
          <span>
            🗓 {fmtDate(latest, lang, t)}
            {timeSuffix(latest)}
          </span>
          {latest.pinned ? (
            <Badge tone="pin" title={t('meeting.pinned')}>
              ★
            </Badge>
          ) : null}
          {latest.hasFathom ? <Badge tone="fathom">▶ {t('meeting.badgeFathom')}</Badge> : null}
          {latest.source === SOURCE.TRANSKRIPTOR ? (
            <Badge tone="fathom">▤ {t('meeting.badgeTranskriptor')}</Badge>
          ) : null}
        </div>

        {!titleIsDate ? (
          <div className="mb-2.5 text-sm font-bold text-ink dark:text-ink-dark">{latest.title}</div>
        ) : null}

        {/* The ONE place server HTML is injected into the app shell. It is
            content an editor wrote, already sanitised of its own styling by
            sectionHtml, and styled by .doc-body in index.css — Tailwind cannot
            reach markup it never sees. */}
        {loadingSummary ? (
          <div className="min-h-[40px] text-sm italic text-ink-muted dark:text-ink-dark-muted">
            {t('dash.loadingSummary')}
          </div>
        ) : (
          <div
            className="doc-body min-h-[40px] text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: summary }}
          />
        )}

        <div className="mt-2.5 text-[12.5px] font-bold text-brand-600 dark:text-brand-300">
          {t('dash.readMinutes')}
        </div>
      </div>
    </div>
  );
}
