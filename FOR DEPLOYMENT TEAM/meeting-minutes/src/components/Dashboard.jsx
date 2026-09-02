import React from 'react';
import { useI18n } from '@vcb/shared';
import { useMinutesData } from '../MinutesData';
import { isInboxProject, SOURCE } from '../lib/minutes';
import { fmtDate, timeSuffix } from '../lib/dates';
import { Badge, Dot, Empty } from '../ui';

// Beyond six the grid just kept growing with every new project, past the point
// of being a quick "what's new" glance.
const CARD_CAP = 6;

/**
 * The ALL-projects landing view: the latest meeting of each tracked project.
 *
 * Neither inbox gets a card — they are review queues, not tracked projects, and
 * a recording awaiting triage is not "what's new" in a project.
 */
export default function Dashboard({ onOpen }) {
  const { t, lang } = useI18n();
  const { projects, meetings } = useMinutesData();

  const latestByProject = {};
  for (const m of meetings) {
    if (m.kind === 'overview') continue;
    const cur = latestByProject[m.projectId];
    if (!cur || (m.date || '') > (cur.date || '')) latestByProject[m.projectId] = m;
  }

  const cards = projects
    .filter((p) => !isInboxProject(p.id))
    .map((p) => ({ p, m: latestByProject[p.id] }))
    .filter((x) => !!x.m)
    .sort((a, b) => (b.m.date || '').localeCompare(a.m.date || ''))
    .slice(0, CARD_CAP);

  return (
    <div className="max-w-[1100px] px-7 py-6">
      <header className="mb-4">
        <h2 className="mb-1 text-xl font-bold text-brand-900 dark:text-brand-300">
          {t('nav.latestMeetings')}
        </h2>
        <p className="text-[13.5px] text-ink-muted dark:text-ink-dark-muted">{t('dash.intro')}</p>
      </header>

      {cards.length ? (
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
          {cards.map(({ p, m }) => (
            <button
              // Keyed by PROJECT + meeting, not the meeting alone. One meeting
              // can be the latest for two projects at once - it is tagged into
              // a second project and arrives in the list under both - and two
              // cards keyed by the same m.id collide, so React drops one and
              // that project silently loses its card.
              key={`${p.id}:${m.id}`}
              type="button"
              onClick={() => onOpen(m.id)}
              // The project colour is per-row data, so it is the one inline
              // style on the card: a border-left utility cannot carry a value
              // that only exists at runtime.
              style={{ borderLeftColor: p.color || '#1D4E89' }}
              className="rounded-card border border-l-4 border-line bg-surface-card px-4 py-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-card-hover dark:border-line-dark dark:bg-surface-dark-card dark:hover:shadow-card-dark"
            >
              <div className="mb-2 flex items-center gap-[7px] text-xs font-bold text-ink-muted dark:text-ink-dark-muted">
                <Dot color={p.color} />
                {p.name}
              </div>
              <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-300">
                <span>
                  🗓 {fmtDate(m, lang, t)}
                  {timeSuffix(m)}
                </span>
                {m.hasFathom ? <Badge tone="fathom">▶ {t('meeting.badgeFathom')}</Badge> : null}
                {m.source === SOURCE.TRANSKRIPTOR ? (
                  <Badge tone="fathom">▤ {t('meeting.badgeTranskriptor')}</Badge>
                ) : null}
              </div>
              <div className="mb-1.5 text-[15px] font-bold text-ink dark:text-ink-dark">
                {m.title}
              </div>
              <div className="excerpt-3 text-[12.5px] text-ink-muted dark:text-ink-dark-muted">
                {m.excerpt || ''}
              </div>
              <div className="mt-2.5 text-[12.5px] font-bold text-brand-600 dark:text-brand-300">
                {t('dash.readMinutes')}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Empty className="!h-auto py-10">{t('dash.empty')}</Empty>
      )}
    </div>
  );
}
