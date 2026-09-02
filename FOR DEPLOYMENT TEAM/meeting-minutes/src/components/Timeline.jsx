import React, { useMemo, useState } from 'react';
import { useI18n, WEEKDAYS } from '@vcb/shared';
import { useMinutesData } from '../MinutesData';
import { isInboxProject } from '../lib/minutes';
import { monthLabel } from '../lib/dates';
import { Dot, Empty, Loading } from '../ui';

/**
 * When each project met, two ways.
 *
 * Hand-written, as TECH_STACK.md requires — no chart library. Neither view
 * needs one: the horizontal lanes are absolutely-positioned dots along a
 * percentage axis, and the calendar is a CSS grid. The only SVG here is the two
 * mode icons.
 */

const ICON_BARS = (
  <svg viewBox="0 0 20 20" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 16V9" />
    <path d="M10 16V4" />
    <path d="M16 16v-6" />
  </svg>
);

const ICON_CAL = (
  <svg viewBox="0 0 20 20" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x={3} y={4.5} width={14} height={12} rx={1.8} />
    <path d="M3 8.5h14" />
    <path d="M6.5 3v3" />
    <path d="M13.5 3v3" />
  </svg>
);

const pad2 = (n) => (n < 10 ? '0' : '') + n;
const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export default function Timeline({ onOpen }) {
  const { t, lang } = useI18n();
  const { projects, projectsById, meetings, loaded } = useMinutesData();

  const [mode, setMode] = useState('horizontal');
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [hidden, setHidden] = useState({});

  const tracked = useMemo(() => projects.filter((p) => !isInboxProject(p.id)), [projects]);

  /**
   * Real, dated meetings only.
   *
   * No Overview rows (undated by design) and no inbox rows — a tagged
   * recording's inbox copy shares its project copy's date and would plot the
   * same meeting twice.
   */
  const plotted = useMemo(
    () =>
      meetings.filter(
        (m) =>
          m.kind !== 'overview' && !isInboxProject(m.projectId) && m.date && !hidden[m.projectId]
      ),
    [meetings, hidden]
  );

  if (!loaded) return <Loading />;

  const toggleProject = (pid) =>
    setHidden((h) => {
      const next = { ...h };
      if (next[pid]) delete next[pid];
      else next[pid] = true;
      return next;
    });

  const modeBtn = 'inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-7 pb-6 pt-5">
      <header className="mb-3.5 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 mr-auto inline-flex items-center gap-2 text-xl font-bold text-brand-900 dark:text-brand-300">
          {ICON_CAL} {t('timeline.title')}
        </h2>

        {mode === 'calendar' ? (
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              aria-label={t('timeline.prevYear')}
              onClick={() => setYear((y) => y - 1)}
              className="rounded-control border border-line px-3 py-1 hover:bg-surface-sunken dark:border-line-dark dark:hover:bg-surface-dark-sunken"
            >
              ←
            </button>
            {/* Buddhist era, like every other year in this app. */}
            <b className="text-ink dark:text-ink-dark">{lang === 'th' ? year + 543 : year}</b>
            <button
              type="button"
              aria-label={t('timeline.nextYear')}
              onClick={() => setYear((y) => y + 1)}
              className="rounded-control border border-line px-3 py-1 hover:bg-surface-sunken dark:border-line-dark dark:hover:bg-surface-dark-sunken"
            >
              →
            </button>
          </div>
        ) : null}

        <div className="flex gap-1 rounded-[9px] bg-surface-sunken p-[3px] dark:bg-surface-dark-sunken">
          {[
            ['horizontal', ICON_BARS, t('timeline.horizontal')],
            ['calendar', ICON_CAL, t('timeline.calendar')],
          ].map(([key, icon, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={mode === key}
              onClick={() => setMode(key)}
              className={`${modeBtn} ${
                mode === key
                  ? 'bg-surface-card text-brand-600 shadow-card dark:bg-surface-dark-card dark:text-brand-300'
                  : 'text-ink-muted dark:text-ink-dark-muted'
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>
      </header>

      <div className="mb-4 flex shrink-0 flex-wrap gap-2">
        {tracked.map((p) => {
          const off = !!hidden[p.id];
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={!off}
              onClick={() => toggleProject(p.id)}
              className={`inline-flex items-center gap-[7px] rounded-pill border border-line py-[5px] pl-2 pr-3 text-[12.5px] font-semibold text-ink hover:border-brand-600 dark:border-line-dark dark:text-ink-dark ${
                off ? 'line-through opacity-45' : 'bg-surface-card dark:bg-surface-dark-card'
              }`}
            >
              <Dot color={off ? '#ccc' : p.color} size={9} />
              {p.name}
            </button>
          );
        })}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {mode === 'horizontal' ? (
          <HorizontalTimeline projects={tracked} meetings={plotted} hidden={hidden} onOpen={onOpen} />
        ) : (
          <CalendarTimeline
            meetings={plotted}
            projectsById={projectsById}
            year={year}
            lang={lang}
            onOpen={onOpen}
          />
        )}
      </div>
    </div>
  );
}

/** One lane per project, dots plotted along a shared date axis. */
function HorizontalTimeline({ projects, meetings, hidden, onOpen }) {
  const { t, lang } = useI18n();

  if (!meetings.length) {
    return <Empty className="!h-auto py-10">{t('timeline.noDated')}</Empty>;
  }

  const dates = meetings.map((m) => m.date).sort();
  const minD = new Date(dates[0]);
  const maxD = new Date(dates[dates.length - 1]);

  // Pad both ends by ~3% of the span so dots at the very edges are not clipped
  // by their own half-width.
  const spanMs = Math.max(1, maxD.getTime() - minD.getTime());
  const padMs = spanMs * 0.03;
  const startMs = minD.getTime() - padMs;
  const totalMs = maxD.getTime() + padMs - startMs;
  const pct = (iso) => ((new Date(iso).getTime() - startMs) / totalMs) * 100;

  const byProject = {};
  for (const m of meetings) (byProject[m.projectId] ||= []).push(m);

  const lanes = projects.filter((p) => !hidden[p.id] && byProject[p.id]?.length);

  const ticks = [];
  const cursor = new Date(minD.getFullYear(), minD.getMonth(), 1);
  while (cursor <= maxD) {
    const left = pct(isoOf(cursor));
    if (left >= 0 && left <= 100) {
      ticks.push({
        // Keyed by the month, not by `left`: with a short date range two
        // consecutive months can land on the same percentage, and duplicate
        // keys made React drop one of the labels.
        key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
        left,
        label: `${monthLabel(cursor.getMonth(), lang, true)} '${String(
          lang === 'th' ? cursor.getFullYear() + 543 : cursor.getFullYear()
        ).slice(-2)}`,
      });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col">
        {lanes.length ? (
          lanes.map((p) => {
            const pts = byProject[p.id]
              .slice()
              .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            return (
              <div
                key={p.id}
                className="relative z-[1] grid min-h-0 flex-1 grid-cols-lane items-center gap-3.5 py-2.5"
              >
                <div className="flex items-center gap-2 truncate text-[12.5px] font-semibold text-ink dark:text-ink-dark">
                  <Dot color={p.color} size={9} />
                  {p.name}{' '}
                  <small className="font-normal text-ink-muted dark:text-ink-dark-muted">
                    ({pts.length})
                  </small>
                </div>
                {/* The lane track. Deliberately faint: in the original this is
                    var(--line-soft) (#eaeef2) on a white panel, a step small
                    enough that the eye reads the dots and the month gridlines
                    rather than a row of grey bars. surface-sunken is the
                    app's panel grey and sat too heavy here. */}
                <div className="relative h-[22px] rounded bg-[#eaeef2] dark:bg-white/[.06]">
                  {pts.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      title={`${m.title} — ${m.dateLabel}`}
                      aria-label={`${m.title} — ${m.dateLabel}`}
                      onClick={() => onOpen(m.id)}
                      // left is per-meeting data computed from the date range;
                      // there is no utility that can express it.
                      style={{ left: `${pct(m.date).toFixed(2)}%`, background: p.color }}
                      className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface-card shadow-card transition-transform hover:z-[2] hover:scale-[1.35] dark:border-surface-dark-card"
                    />
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <Empty className="!h-auto py-10">{t('timeline.noVisible')}</Empty>
        )}

        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-[214px] right-0 z-0">
          {ticks.map((tick) => (
            <div
              key={tick.key}
              style={{ left: `${tick.left.toFixed(2)}%` }}
              className="absolute inset-y-0 w-0 border-l border-dashed border-line dark:border-line-dark"
            />
          ))}
        </div>
      </div>

      <div className="relative ml-[214px] mt-1.5 h-[26px] shrink-0">
        {ticks.map((tick) => (
          <div
            key={tick.key}
            style={{ left: `${tick.left.toFixed(2)}%` }}
            className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10.5px] text-ink-muted dark:text-ink-dark-muted"
          >
            {tick.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A twelve-month grid, dots on the days that had a meeting. */
function CalendarTimeline({ meetings, projectsById, year, lang, onOpen }) {
  const byDate = {};
  for (const m of meetings) (byDate[m.date] ||= []).push(m);
  const todayIso = isoOf(new Date());
  const dows = WEEKDAYS[lang === 'th' ? 'th' : 'en'];

  return (
    <div className="grid min-h-0 flex-1 grid-cols-2 gap-4 overflow-auto md:grid-cols-3 xl:grid-cols-4 xl:grid-rows-3">
      {Array.from({ length: 12 }, (_, mo) => {
        const firstDow = new Date(year, mo, 1).getDay();
        const daysInMonth = new Date(year, mo + 1, 0).getDate();

        return (
          <div
            key={mo}
            className="flex min-h-0 flex-col overflow-hidden rounded-[10px] border border-line bg-surface-card p-2.5 dark:border-line-dark dark:bg-surface-dark-card"
          >
            <div className="mb-1.5 shrink-0 text-center text-sm font-bold text-brand-900 dark:text-brand-300">
              {monthLabel(mo, lang)}
            </div>
            <div className="mb-0.5 grid shrink-0 grid-cols-7 text-center text-[10px] font-bold text-ink-muted dark:text-ink-dark-muted">
              {dows.map((d, i) => (
                <div key={i}>{d}</div>
              ))}
            </div>
            <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-0.5">
              {Array.from({ length: firstDow }, (_, i) => (
                <div key={`e${i}`} className="invisible" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const d = i + 1;
                const iso = `${year}-${pad2(mo + 1)}-${pad2(d)}`;
                const dayMeetings = byDate[iso] || [];
                const isToday = iso === todayIso;
                const has = dayMeetings.length > 0;

                const cell = (
                  <>
                    {d}
                    {has ? (
                      <span className="absolute bottom-0.5 left-1/2 flex -translate-x-1/2 gap-[2.5px]">
                        {dayMeetings.slice(0, 3).map((m, k) => (
                          <span
                            key={k}
                            className={`h-[5px] w-[5px] rounded-full ${isToday ? 'outline outline-1 outline-white' : ''}`}
                            style={{ background: projectsById[m.projectId]?.color || '#888' }}
                          />
                        ))}
                      </span>
                    ) : null}
                  </>
                );

                const base = `relative flex min-h-0 items-center justify-center rounded-[5px] text-xs ${
                  isToday
                    ? 'bg-brand-600 font-bold text-white'
                    : 'text-ink dark:text-ink-dark'
                }`;

                return has ? (
                  <button
                    key={d}
                    type="button"
                    title={dayMeetings.map((m) => m.title).join(', ')}
                    onClick={() => onOpen(dayMeetings[0].id)}
                    className={`${base} cursor-pointer font-bold hover:bg-surface-sunken dark:hover:bg-surface-dark-sunken`}
                  >
                    {cell}
                  </button>
                ) : (
                  <div key={d} className={base}>
                    {cell}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
