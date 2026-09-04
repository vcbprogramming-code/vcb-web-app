import React, { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@vcb/shared';
import { Hint } from './ui';
import { KindPill } from './ui';
import { codesFor, hasWork, cellTitle, splitValue } from './lib/cells';
import { dayNum, isoMinus, isoPlus } from './lib/dates';

/**
 * The month at a glance: one column per day, one row per employee, coloured by
 * whether that day is logged, still editable, locked, or not due yet.
 *
 * Sized to match the original app's covgrid exactly — 34px cells, 3px grid
 * spacing, solid colour badges — rather than a generic dense table, since a
 * quieter/smaller rendering here reads as "different squares" next to the
 * live app.
 *
 * Clicking a cell jumps to that employee and day in the weekly view, which is
 * where editing happens — this grid is 31 columns wide and far too dense to
 * open a picker in.
 */

const HL_KEY = 'hr_covhl';

function loadHighlight() {
  try {
    const v = JSON.parse(localStorage.getItem(HL_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

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
  activities = [],
}) {
  const { t, weekdayName } = useI18n();
  const cutoff = isoMinus(today, lockDays);
  const ahead = isoPlus(today, 1);

  // In-place code highlighter: pick one or more activity codes and every
  // matching cell keeps full opacity while the rest dim — the same picture as
  // the original's 🔦 bar, persisted per-device so it survives a reload.
  const [highlight, setHighlight] = useState(loadHighlight);
  useEffect(() => {
    try {
      localStorage.setItem(HL_KEY, JSON.stringify(highlight));
    } catch {
      /* storage blocked — highlighting still works for this session */
    }
  }, [highlight]);

  const addHighlight = (code) => {
    if (!code || highlight.includes(code)) return;
    setHighlight((prev) => [...prev, code]);
  };
  const removeHighlight = (code) => setHighlight((prev) => prev.filter((c) => c !== code));

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
    <div className="grid min-w-0 gap-3">
      {/* ---- the day strip ---- */}
      {/* min-w-0 on the wrapper as well as the scroller: a grid item defaults
          to min-width:auto, so this plain div stretched to the strip full
          content width and took the page with it. */}
      <div className="min-w-0">
        {/* No min-width floor and no shrink-0: every pill divides the row
            evenly and compresses together, the same way the grid's day
            columns do below, so all 30/31 days sit on one row with no
            scrollbar — a min-width here is exactly what forces one back. */}
        <div className="flex min-w-0 gap-[3px] pb-1">
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
                className={`grid flex-1 place-items-center overflow-hidden rounded-md py-1.5 text-[0.7rem] leading-tight ${st.cls}`}
              >
                <span className="text-[1.1rem] font-extrabold leading-none">{dayNum(day.date)}</span>
                <span className="text-[0.65rem] opacity-85">{weekdayName(day.dow)}</span>
                <span className="mt-px text-[0.7rem] font-semibold opacity-95">{label}</span>
              </div>
            );
          })}
        </div>
        <Hint className="mt-1 block">
          {t('entry.legendA')} {lockDays} {t('entry.legendB')}
        </Hint>
      </div>

      {/* ---- code highlighter bar ---- */}
      <div className="flex flex-wrap items-center gap-2 rounded-control border border-line bg-surface-card px-3 py-2 dark:border-line-dark dark:bg-surface-dark-card">
        <span className="whitespace-nowrap text-[0.82rem] font-bold text-ink dark:text-ink-dark">
          {t('entry.highlightLabel')}
        </span>
        <select
          value=""
          onChange={(e) => addHighlight(e.target.value)}
          className="max-w-[280px] rounded-control border border-line bg-surface-sunken px-2 py-1 text-[0.78rem] text-ink dark:border-line-dark dark:bg-surface-dark-sunken dark:text-ink-dark"
        >
          <option value="">{t('entry.highlightPick')}</option>
          {activities.map((a) => (
            <option key={a.code} value={a.code}>
              {a.code} · {a.name}
            </option>
          ))}
        </select>
        <span className="flex flex-wrap gap-1.5">
          {highlight.map((code) => {
            const name = activityByCode?.(code)?.name || '';
            return (
              <span
                key={code}
                className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-violet-100 py-[.12rem] pl-2.5 pr-1 text-[0.72rem] font-semibold text-violet-800 dark:border-violet-700 dark:bg-violet-900/40 dark:text-violet-200"
              >
                <b className="font-extrabold">{code}</b>
                {name ? <span>{name}</span> : null}
                <button
                  type="button"
                  onClick={() => removeHighlight(code)}
                  title={t('entry.highlightRemove')}
                  aria-label={t('entry.highlightRemove')}
                  className="rounded-full px-1.5 font-extrabold leading-none opacity-65 hover:bg-violet-200 hover:opacity-100 dark:hover:bg-violet-800/60"
                >
                  ×
                </button>
              </span>
            );
          })}
        </span>
      </div>

      {/* ---- the grid ---- */}
      {/* table-layout:fixed + w-full, matching the original exactly: the
          employee column takes its own fixed width and every day column
          divides what's left EVENLY, shrinking as needed so all 30/31 days
          sit on one page with no horizontal scrollbar — a min-width floor on
          the day columns (the previous approach) is exactly what forced the
          scrollbar back in. overflow-x-auto stays only as a safety net for a
          window narrower than the employee column itself. */}
      <div className="min-w-0 overflow-x-auto rounded-control border border-line dark:border-line-dark">
        <table
          className="w-full border-separate text-xs"
          style={{ borderSpacing: '3px', tableLayout: 'fixed' }}
        >
          <colgroup>
            <col style={{ width: 220 }} />
            {days.map((day) => (
              <col key={day.date} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 bg-surface-card p-1.5 text-left font-bold text-ink dark:bg-surface-dark-card dark:text-ink-dark">
                {t('entry.employees')}{' '}
                <Hint>({employees.length})</Hint>
              </th>
              {days.map((day) => (
                <th
                  key={day.date}
                  className={
                    'sticky top-0 z-10 overflow-hidden rounded-md p-1 text-center font-bold leading-tight ' +
                    (day.weekend
                      ? 'bg-weekend text-ink-muted dark:bg-weekend-dark dark:text-ink-dark-muted'
                      : 'bg-transparent text-ink-subtle dark:text-ink-dark-muted') +
                    (day.date === today ? ' !bg-brand-700 !text-white' : '')
                  }
                >
                  {dayNum(day.date)}
                  <span className="block text-[0.62rem] font-medium opacity-75">
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
                  <td className="sticky left-0 z-10 overflow-hidden bg-surface-card p-1.5 dark:bg-surface-dark-card">
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
                    // Bare activity codes (before " / cost"), for the 🔦
                    // highlighter to match against — "A-1 / 5" + "Z-1" → both
                    // codes checked independently, same as the original's
                    // space-joined data-acts attribute.
                    const acts = codes.map((c) => splitValue(c).activity || c);
                    const isHl = highlight.length > 0 && acts.some((c) => highlight.includes(c));
                    const dimmed = highlight.length > 0 && !isHl;
                    return (
                      <td key={day.date} className="p-0">
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
                            'grid h-[34px] w-full place-items-center gap-0 overflow-hidden rounded-[5px] px-0.5 ' +
                            'text-[0.8rem] font-bold leading-none shadow-[inset_0_0_0_1px_rgba(0,0,0,.05)] ' +
                            'transition-transform hover:z-[5] hover:scale-[1.12] hover:shadow-lg ' +
                            (clickable ? 'cursor-pointer' : 'cursor-default') +
                            ' ' +
                            (isHl ? 'outline outline-[3px] -outline-offset-2 outline-violet-600 shadow-[0_0_0_2px_rgba(124,58,237,.45)]' : '') +
                            ' ' +
                            (dimmed ? 'opacity-[.24]' : '') +
                            ' ' +
                            st.cls
                          }
                        >
                          {st.key === 'weekend' ? (
                            <span className="text-[0.65rem]">{t('entry.rest')}</span>
                          ) : codes.length > 1 ? (
                            <span className="flex flex-col gap-0 text-[0.55rem] font-extrabold leading-[1.18]">
                              {codes.map((c) => (
                                <span key={c} className="max-w-full truncate">
                                  {c}
                                </span>
                              ))}
                            </span>
                          ) : (
                            codes.map((c) => (
                              <span key={c} className="block max-w-full truncate">
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
