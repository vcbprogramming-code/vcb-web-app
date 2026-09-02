import { useMemo, useState } from 'react';
import { useI18n } from '@vcb/shared';
import { getHolidays } from './data';
import { IconButton, Panel, PanelHead, PanelTitle } from './ui';

// Ported from the GAS portal's "holiday calendar" IIFE in index.html: month
// grid with prev/next nav, weekend/holiday/today highlighting, a legend, and a
// "next upcoming holiday" callout computed from real today (not the viewed
// month).
//
// The holiday table is a pure function of the year (data.js), so the old
// per-year cache and its loading state are gone — useMemo covers it, and the
// panel no longer renders a blank shell on first paint.

function pad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function dateKey(y, m, d) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

/** The 7-column grid: leading days of the previous month, this month, trailing. */
function buildCells(year, month) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push({ day: daysInPrevMonth - firstDow + 1 + i, outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, outside: false });
  while (cells.length % 7 !== 0) {
    cells.push({ day: cells.length - (firstDow + daysInMonth) + 1, outside: true });
  }
  return cells;
}

export default function HolidayCalendar() {
  const { t, lang } = useI18n();
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const holidays = useMemo(() => getHolidays(year), [year]);
  const holidayName = (h) => (lang === 'th' ? h.name_th : h.name_en);

  const monthLabel = useMemo(
    () => viewDate.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
      month: 'long',
      year: 'numeric',
    }),
    [viewDate, lang]
  );

  const dowNames = t('cal.dow').split(',');

  // Scans forward a full year from real today, crossing the year boundary by
  // recomputing the table rather than relying on a cache of visited years.
  const nextHoliday = useMemo(() => {
    const today = new Date();
    const probe = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let table = getHolidays(probe.getFullYear());
    let tableYear = probe.getFullYear();
    for (let i = 0; i < 366; i++) {
      if (probe.getFullYear() !== tableYear) {
        tableYear = probe.getFullYear();
        table = getHolidays(tableYear);
      }
      const h = table[dateKey(tableYear, probe.getMonth(), probe.getDate())];
      if (h) {
        const daysAway = Math.round((probe.getTime() - today.getTime()) / 86400000);
        return {
          name: lang === 'th' ? h.name_th : h.name_en,
          daysAway,
          date: `${probe.getDate()}/${probe.getMonth() + 1}`,
        };
      }
      probe.setDate(probe.getDate() + 1);
    }
    return null;
  }, [lang]);

  const today = new Date();
  const cells = buildCells(year, month);

  return (
    <Panel>
      <PanelHead>
        <PanelTitle>{t('panel.calendar')}</PanelTitle>
        <div className="flex items-center gap-1">
          <IconButton
            type="button"
            className="h-7 w-7 text-base"
            aria-label={t('cal.prevMonth')}
            onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          >
            &#8249;
          </IconButton>
          <span className="inline-block min-w-[86px] text-center text-xs text-ink-muted dark:text-ink-dark-muted">
            {monthLabel}
          </span>
          <IconButton
            type="button"
            className="h-7 w-7 text-base"
            aria-label={t('cal.nextMonth')}
            onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          >
            &#8250;
          </IconButton>
        </div>
      </PanelHead>

      {/* gap 2px and the small type sizes below are the live .cal-grid /
          .cal-dow / .cal-day values. The port was uniformly a size larger,
          which made the calendar taller than the panel beside it. */}
      <div className="grid grid-cols-7 gap-[2px]">
        {dowNames.map((d, i) => (
          <div
            key={i}
            className="pb-1 text-center text-[8.5px] font-bold uppercase text-ink-muted dark:text-ink-dark-muted"
          >
            {d}
          </div>
        ))}

        {cells.map((c, i) => {
          if (c.outside) {
            return (
              <div
                key={i}
                className="grid h-8 place-items-center rounded text-xs text-ink-muted/40 dark:text-ink-dark-muted/40"
              >
                {c.day}
              </div>
            );
          }

          const dow = new Date(year, month, c.day).getDay();
          const h = holidays[dateKey(year, month, c.day)];
          const isWeekend = dow === 0 || dow === 6;
          const isToday =
            year === today.getFullYear() &&
            month === today.getMonth() &&
            c.day === today.getDate();

          // Today wins over holiday wins over weekend — the same precedence the
          // stacked CSS classes produced.
          let tone = 'text-ink dark:text-ink-dark';
          if (isWeekend) tone = 'bg-weekend text-ink-muted dark:bg-weekend-dark dark:text-ink-dark-muted';
          if (h) tone = 'bg-holiday font-medium text-holiday-fg dark:bg-holiday-dark/15 dark:text-holiday-dark';
          if (isToday) tone = 'bg-accent font-semibold text-white dark:bg-accent-dark dark:text-surface-dark';

          return (
            <div
              key={i}
              title={h ? holidayName(h) : undefined}
              className={`relative grid h-[22px] place-items-center rounded-[5px] text-[9.5px] font-medium ${tone}`}
            >
              {c.day}
              {h && !isToday && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-holiday-fg dark:bg-holiday-dark" />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-2.5 gap-y-1 text-[9px] text-ink-muted dark:text-ink-dark-muted">
        <span className="flex items-center gap-1">
          <span className="h-[7px] w-[7px] shrink-0 rounded-[2px] bg-holiday dark:bg-holiday-dark/40" />
          {t('cal.legendHoliday')}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-[7px] w-[7px] shrink-0 rounded-[2px] bg-weekend dark:bg-weekend-dark" />
          {t('cal.legendWeekend')}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-[7px] w-[7px] shrink-0 rounded-[2px] bg-accent dark:bg-accent-dark" />
          {t('cal.legendToday')}
        </span>
      </div>

      {nextHoliday && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-control bg-surface-sunken px-3 py-2 text-[11px] dark:bg-surface-dark-sunken">
          <span className="text-ink dark:text-ink-dark">
            {t('cal.nextHoliday', { name: nextHoliday.name, date: nextHoliday.date })}
          </span>
          <span className="shrink-0 font-semibold text-accent dark:text-accent-dark">
            {nextHoliday.daysAway === 0
              ? t('cal.today')
              : t('cal.daysAway', { n: nextHoliday.daysAway })}
          </span>
        </div>
      )}
    </Panel>
  );
}
