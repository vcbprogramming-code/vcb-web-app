import React, { useMemo } from 'react';
import { useI18n } from '@vcb/shared';
import { useMinutesData } from '../MinutesData';
import {
  ALL_PROJECTS,
  RANGES,
  TIMELINE_PROJECT,
  inRange,
  matchesQuery,
  passesProjectFilter,
  sortMeetingsWithOverview,
  SOURCE,
} from '../lib/minutes';
import { fmtDate, timeSuffix } from '../lib/dates';
import { Badge, Dot, Loading } from '../ui';

/**
 * The middle column: the meetings of whichever project is selected.
 *
 * The visible set is what the API returned — hidden rows are already absent for
 * anyone but an editor. What this filters is presentation: the project tab, the
 * date range, and the search text.
 */
export default function MeetingList({ activeProject, activeId, query, searchMatchIds, range, onRange, onOpen }) {
  const { t, lang } = useI18n();
  const { meetings, projectsById, loaded } = useMinutesData();

  const q = query.trim().toLowerCase();

  const items = useMemo(() => {
    return meetings
      .filter((m) => {
        if (!passesProjectFilter(m, activeProject)) return false;
        if (!inRange(m, range)) return false;
        if (!q) return true;
        // The instant local filter covers what the list payload carries; the
        // debounced server search covers the body text it does not, and its
        // matching ids are merged in here rather than replacing the local one.
        return matchesQuery(m, q) || (searchMatchIds?.has(m.id) ?? false);
      })
      .sort(sortMeetingsWithOverview);
  }, [meetings, activeProject, range, q, searchMatchIds]);

  const countInRange = (r) =>
    meetings.filter((m) => passesProjectFilter(m, activeProject) && inRange(m, r)).length;

  // Timeline replaces this column entirely — the timeline itself renders in the
  // detail pane. The header stays so the column does not collapse mid-animation.
  if (activeProject === TIMELINE_PROJECT) {
    return (
      <section className="flex min-h-0 flex-col overflow-hidden border-r border-line bg-surface dark:border-line-dark dark:bg-surface-dark">
        <div className="px-3.5 pb-1.5 pt-3 text-xs text-ink-muted dark:text-ink-dark-muted">
          {t('nav.timeline')}
        </div>
      </section>
    );
  }

  const label =
    activeProject === ALL_PROJECTS
      ? t('nav.allMeetings')
      : projectsById[activeProject]?.name || '';

  const showLoader = !loaded && !items.length;
  const recWord = items.length === 1 ? t('count.record') : t('count.records');

  return (
    <section className="flex min-h-0 flex-col overflow-y-auto border-r border-line bg-surface dark:border-line-dark dark:bg-surface-dark">
      <div className="sticky top-0 z-10 bg-surface px-3.5 pb-1.5 pt-3 text-xs text-ink-muted dark:bg-surface-dark dark:text-ink-dark-muted">
        {showLoader ? label : `${label} · ${items.length} ${recWord}`}
      </div>

      <div className="sticky top-[34px] z-10 flex gap-1.5 bg-surface px-3 pb-2 pt-1 dark:bg-surface-dark">
        {RANGES.map((r) => {
          const on = range === r;
          return (
            <button
              key={r}
              type="button"
              aria-pressed={on}
              onClick={() => onRange(r)}
              className={`flex-1 rounded-control border px-1 py-1.5 text-xs font-semibold transition-colors ${
                on
                  ? 'border-brand-900 bg-brand-900 text-white'
                  : 'border-line bg-surface-card text-ink-muted hover:bg-surface-sunken dark:border-line-dark dark:bg-surface-dark-card dark:text-ink-dark-muted dark:hover:bg-surface-dark-sunken'
              }`}
            >
              {t(`range.${r}`)}{' '}
              <span className={on ? 'font-normal text-brand-200' : 'font-normal text-ink-muted dark:text-ink-dark-muted'}>
                {countInRange(r)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="pb-3">
        {showLoader ? (
          <Loading />
        ) : !items.length ? (
          <div className="px-4 py-8 text-center text-ink-muted dark:text-ink-dark-muted">
            {t('meeting.emptyList')}
          </div>
        ) : (
          items.map((m) => {
            const p = projectsById[m.projectId];
            // Only an editor is ever sent a hidden row, so the hatch marks a row
            // that the caller can see BUT staff cannot — never one staff sees.
            const hidden = !m.visible;
            const isActive = m.id === activeId;
            return (
              <button
                key={`${m.projectId}:${m.id}`}
                type="button"
                onClick={() => onOpen(m.id)}
                aria-current={isActive ? 'true' : undefined}
                className={`mx-3 my-2 block w-[calc(100%-1.5rem)] rounded-[10px] border px-3.5 py-3 text-left transition-shadow ${
                  isActive
                    ? 'border-brand-600 shadow-[0_0_0_2px_rgba(31,111,235,.18)]'
                    : 'border-line hover:border-line-strong hover:shadow-card dark:border-line-dark'
                } ${hidden ? 'hatch-hidden opacity-[.62]' : 'bg-surface-card dark:bg-surface-dark-card'}`}
              >
                <div className="mb-1 flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden">
                  <Dot color={p?.color} size={8} />
                  <span className="shrink-0 whitespace-nowrap text-xs font-bold text-brand-900 dark:text-brand-300">
                    {fmtDate(m, lang, t)}
                    {timeSuffix(m)}
                  </span>
                  {hidden ? <Badge tone="hidden">{t('meeting.hidden')}</Badge> : null}
                  {m.pinned ? (
                    <Badge tone="pin" title={t('meeting.pinned')}>
                      ★
                    </Badge>
                  ) : null}
                  {m.kind === 'overview' ? (
                    <Badge tone="overview">{t('meeting.overview')}</Badge>
                  ) : null}
                  {m.hasFathom ? <Badge tone="fathom">▶ {t('meeting.badgeFathom')}</Badge> : null}
                  {m.source === SOURCE.TRANSKRIPTOR ? (
                    <Badge tone="fathom">▤ {t('meeting.badgeTranskriptor')}</Badge>
                  ) : null}
                  {m.attachmentCount > 0 ? (
                    <Badge tone="manual">📎 {m.attachmentCount}</Badge>
                  ) : null}
                </div>
                <div className="mb-1 text-[13.5px] font-semibold text-ink dark:text-ink-dark">
                  {m.title}
                </div>
                <div className="excerpt-2 text-xs text-ink-muted dark:text-ink-dark-muted">
                  {m.excerpt || ''}
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

