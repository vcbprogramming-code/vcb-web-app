import React, { useMemo } from 'react';
import { useI18n } from '@vcb/shared';
import { Hint } from './ui';
import { KindPill } from './ui';
import { codesFor, hasWork, cellTitle } from './lib/cells';
import { dayNum, isoMinus, isoPlus } from './lib/dates';

/**
 * The month at a glance: one column per day, one row per employee, coloured by
 * whether that day is logged, still editable, locked, or not due yet.
 *
 * Clicking a cell jumps to that employee and day in the weekly view, which is
 * where editing happens — this grid is 31 columns wide and far too dense to
 * open a picker in.
 */

/** The state of one day for one person, and the colour that says so. */
function dayState({ date, weekend, filled, cutoff, ahead, today }) {
  if (date === today) return { key: 'today', cls: 'bg-brand-700 text-white' };
  if (weekend) return { key: 'weekend', cls: 'bg-cov-rest text-cov-rest-ink' };
  if (date > ahead) return { key: 'future', cls: 'bg-cov-future text-cov-future-ink' };
  if (date >= cutoff) return { key: 'editable', cls: 'bg-cov-edit text-cov-edit-ink' };
  return filled
    ? { key: 'ok', cls: 'bg-cov-ok text-white' }
    : { key: 'miss', cls: 'bg-cov-miss text-white' };
}

export default function CoverageGrid({
  days,
  employees,
  entries,
  today,
  lockDays,
  onJump,
  activityByCode,
  costByCode,
}) {
  const { t, weekdayName } = useI18n();
  const cutoff = isoMinus(today, lockDays);
  const ahead = isoPlus(today, 1);

  /* The per-day header strip: how many of the site's people logged that day.
     `filled` counts PEOPLE, never entries — someone who logged both งานหลัก and
     งานเสริม is one person with one manday, and counting slots here would show
     a day as more than 100% covered. */
  const perDay = useMemo(() => {
    const map = new Map();
    for (const day of days) {
      if (day.weekend) {
        map.set(day.date, null);
        continue;
      }
      let filled = 0;
      for (const e of employees) {
        if (hasWork(entries[e.eid]?.[day.date])) filled++;
      }
      map.set(day.date, { filled, total: employees.length });
    }
    return map;
  }, [days, employees, entries]);

  return (
    <div className="grid gap-3">
      {/* ---- the day strip ---- */}
      <div>
        <div className="no-scrollbar flex gap-0.5 overflow-x-auto pb-1">
          {days.map((day) => {
            const stat = perDay.get(day.date);
            const pct = stat && stat.total ? Math.round((stat.filled / stat.total) * 100) : 0;
            const st = dayState({ ...day, filled: pct >= 100, cutoff, ahead, today });
            const label =
              st.key === 'weekend' ? t('entry.rest') : st.key === 'future' ? '—' : `${pct}%`;
            return (
              <div
                key={day.date}
                title={stat ? `${day.date} · ${stat.filled}/${stat.total}` : day.date}
                className={`grid w-9 shrink-0 place-items-center rounded py-1 text-[0.6rem] leading-tight ${st.cls}`}
              >
                <span className="text-xs font-bold">{dayNum(day.date)}</span>
                <span className="opacity-80">{weekdayName(day.dow)}</span>
                <span className="font-semibold">{label}</span>
              </div>
            );
          })}
        </div>
        <Hint className="mt-1 block">
          {t('entry.legendA')} {lockDays} {t('entry.legendB')}
        </Hint>
      </div>

      {/* ---- the grid ---- */}
      <div className="overflow-auto rounded-control border border-line dark:border-line-dark">
        <table className="w-max border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 min-w-[13rem] max-w-[13rem] border-b border-r border-line bg-surface-card p-1.5 text-left font-bold text-ink dark:border-line-dark dark:bg-surface-dark-card dark:text-ink-dark">
                {t('entry.employees')}{' '}
                <Hint>({employees.length})</Hint>
              </th>
              {days.map((day) => (
                <th
                  key={day.date}
                  className={
                    'sticky top-0 z-10 min-w-[2.1rem] border-b border-line p-1 text-center font-bold leading-tight ' +
                    'dark:border-line-dark ' +
                    (day.weekend
                      ? 'bg-weekend text-ink-muted dark:bg-weekend-dark dark:text-ink-dark-muted'
                      : 'bg-surface-sunken text-ink-subtle dark:bg-surface-dark-sunken dark:text-ink-dark-muted') +
                    (day.date === today ? ' !bg-brand-700 !text-white' : '')
                  }
                >
                  {dayNum(day.date)}
                  <span className="block text-[0.55rem] font-normal opacity-75">
                    {weekdayName(day.dow)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => {
              const byDate = entries[e.eid] || {};
              return (
                <tr key={e.eid}>
                  <td className="sticky left-0 z-10 min-w-[13rem] max-w-[13rem] border-b border-r border-line bg-surface-card p-1.5 dark:border-line-dark dark:bg-surface-dark-card">
                    <div className="truncate font-semibold text-ink dark:text-ink-dark">
                      <KindPill kind={e.kind} />
                      {e.name}
                    </div>
                    <div className="truncate text-[0.65rem] text-ink-muted dark:text-ink-dark-muted">
                      {e.emp_id}
                      {e.department ? ` · ${e.department}` : ''}
                    </div>
                  </td>
                  {days.map((day) => {
                    const cell = byDate[day.date];
                    const filled = hasWork(cell);
                    const st = dayState({ ...day, filled, cutoff, ahead, today });
                    const editable = day.date >= cutoff && day.date <= ahead;
                    const clickable = filled || editable;
                    const codes = filled ? codesFor(cell) : [];
                    return (
                      <td
                        key={day.date}
                        className="border-b border-line/50 p-0.5 dark:border-line-dark/50"
                      >
                        <button
                          type="button"
                          disabled={!clickable}
                          onClick={() => clickable && onJump(e.eid, day.date)}
                          title={
                            day.date +
                            (filled
                              ? ` · ${cellTitle(cell.team || cell.detail, activityByCode, costByCode)}`
                              : '')
                          }
                          className={
                            'grid h-7 w-full min-w-[2rem] place-items-center gap-0 rounded px-0.5 ' +
                            'text-[0.55rem] font-semibold leading-none ' +
                            (clickable ? 'cursor-pointer' : 'cursor-default') +
                            ' ' +
                            st.cls
                          }
                        >
                          {st.key === 'weekend' ? (
                            <span className="opacity-70">{t('entry.rest')}</span>
                          ) : (
                            codes.map((c) => (
                              <span key={c} className="block truncate">
                                {c}
                              </span>
                            ))
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Hint>{t('entry.coverageHint')}</Hint>
    </div>
  );
}
