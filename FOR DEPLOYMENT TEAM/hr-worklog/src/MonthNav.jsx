import React from 'react';
import { useMonthName, useYear } from './prefs';

/**
 * ‹ May 2569 › — the month stepper the dashboard and the entry grid share.
 *
 * The year respects the yearFmt preference (พ.ศ. / ค.ศ.), which is separate
 * from the display language on purpose: HR staff read Thai menus while
 * reconciling against Gregorian-dated ERP exports. See useYear() in prefs.jsx.
 */
export default function MonthNav({ value, onChange, className = '' }) {
  const monthName = useMonthName();
  const year = useYear();

  const step = (delta) => {
    const m = value.month + delta;
    if (m < 1) onChange({ year: value.year - 1, month: 12 });
    else if (m > 12) onChange({ year: value.year + 1, month: 1 });
    else onChange({ year: value.year, month: m });
  };

  const btn =
    'grid h-8 w-8 place-items-center rounded-control text-lg leading-none text-ink-muted ' +
    'transition-colors hover:bg-surface-sunken hover:text-ink ' +
    'dark:text-ink-dark-muted dark:hover:bg-surface-dark-sunken dark:hover:text-ink-dark';

  return (
    <div
      className={
        'inline-flex items-center gap-1 rounded-control border border-line bg-surface-card p-0.5 ' +
        'dark:border-line-dark dark:bg-surface-dark-card ' +
        className
      }
    >
      <button type="button" className={btn} onClick={() => step(-1)} aria-label="previous month">
        ‹
      </button>
      <span className="min-w-[8.5rem] text-center text-sm font-semibold text-ink dark:text-ink-dark">
        {monthName(value.month)} {year(value.year)}
      </span>
      <button type="button" className={btn} onClick={() => step(1)} aria-label="next month">
        ›
      </button>
    </div>
  );
}
