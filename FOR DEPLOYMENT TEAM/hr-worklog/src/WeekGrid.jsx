import React from 'react';
import { useI18n } from '@vcb/shared';
import { Hint, KindPill } from './ui';
import { usePrefs } from './prefs';
import {
  cellDisplay,
  cellTitle,
  extraValue,
  mainValue,
  parseLeaveNote,
  primaryField,
} from './lib/cells';
import { dayNum, isoMinus, isoPlus } from './lib/dates';

/**
 * A week at a time, and the only place cells are edited.
 *
 * Each day holds TWO slots stacked vertically:
 *
 *   slot 1  งานหลัก — the main task. Always shown.
 *   slot 2  งานเสริม — OPTIONAL extra work. Shown as "+ งานที่ 2" when empty.
 *
 * These are NOT morning and afternoon. The API field for slot 2 is called `pm`
 * after a legacy sheet column, and the UI must never repeat that mistake by
 * labelling either slot with a time of day.
 *
 * Filling both is still ONE manday. The grid deliberately shows no per-cell
 * manday figure at all — the number belongs to the dashboard, which reads it
 * from the hr.mandays view.
 */

function Slot({
  value,
  field,
  isExtra,
  weekend,
  locked,
  onOpen,
  activityByCode,
  costByCode,
  mainFilled,
}) {
  const { t } = useI18n();
  const { cellNames } = usePrefs();
  const text = cellDisplay(value, cellNames, activityByCode);

  // "+ Task 2" is an add-on to an already-logged day, never a way in on its
  // own: the original hides the second slot entirely until the first has a
  // value (a filled second slot stays visible regardless, so nothing already
  // saved ever disappears). Gating on disabled alone would still show a live
  // "+" that just refuses the click; hiding it is what tells someone there is
  // nothing to click yet.
  if (isExtra && !value && !mainFilled) return null;

  // The placeholder is rendered by a CSS pseudo-element reading data-ph (see
  // index.css): a real <input> per slot would be 31 x 2 x N focusable nodes in
  // one screen, and this grid has to stay scrollable on a site tablet.
  const placeholder = isExtra ? t('entry.addSecond') : weekend ? t('entry.dayOff') : '';

  // The empty main slot's hover hint is the browser's own tooltip, not a CSS
  // swap crammed into the slot's own thumbnail-sized footprint — the original
  // shows "Click a cell to choose Activity → Work Category" stacked over
  // "+ Task 2" as one floating box, which is exactly what a native title
  // attribute with a newline renders, and nothing this small needs a custom
  // tooltip component for.
  const hintTitle =
    !value && !isExtra && !weekend && !locked
      ? `${t('entry.weeklyHint')}\n${t('entry.addSecond')}`
      : undefined;

  return (
    <button
      type="button"
      disabled={locked}
      onClick={(ev) => !locked && onOpen(field, ev.currentTarget)}
      title={value ? cellTitle(value, activityByCode, costByCode) : hintTitle}
      data-ph={!value && placeholder ? placeholder : undefined}
      className={
        'block w-full truncate rounded px-1 py-0.5 text-left text-[0.68rem] leading-tight ' +
        (locked ? 'cursor-default' : 'cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-900/30') +
        ' ' +
        (isExtra
          ? 'cell-ph border-t border-dashed border-line/70 text-ink-muted dark:border-line-dark/70 dark:text-ink-dark-muted'
          : 'font-semibold text-ink dark:text-ink-dark') +
        (!value && !isExtra && !weekend && !locked ? ' cell-pick' : '')
      }
    >
      {text}
    </button>
  );
}

export default function WeekGrid({
  days,
  employees,
  entries,
  today,
  lockDays,
  focus,
  onOpenPicker,
  activityByCode,
  costByCode,
}) {
  const { t, weekdayName } = useI18n();
  const cutoff = isoMinus(today, lockDays);
  const ahead = isoPlus(today, 1);

  return (
    <div className="grid min-w-0 gap-3">
      {/* min-w-0 - see CoverageGrid.jsx. */}
      <div className="min-w-0 overflow-auto rounded-control border border-line dark:border-line-dark">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 min-w-[14rem] border-b border-r border-line bg-surface-card p-1.5 text-left font-bold text-ink dark:border-line-dark dark:bg-surface-dark-card dark:text-ink-dark">
                {t('entry.employees')} <Hint>({employees.length})</Hint>
              </th>
              {days.map((day) => (
                <th
                  key={day.date}
                  className={
                    'sticky top-0 z-10 min-w-[6rem] border-b border-line p-1 text-center font-bold ' +
                    'dark:border-line-dark ' +
                    (day.weekend
                      ? 'bg-weekend text-ink-muted dark:bg-weekend-dark dark:text-ink-dark-muted'
                      : 'bg-surface-sunken text-ink-subtle dark:bg-surface-dark-sunken dark:text-ink-dark-muted') +
                    (day.date === today ? ' !bg-brand-700 !text-white' : '')
                  }
                >
                  {dayNum(day.date)}
                  <span className="block text-[0.6rem] font-normal opacity-75">
                    {weekdayName(day.dow)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => {
              const byDate = entries[e.eid] || {};
              const field = primaryField(e.kind);
              const rowFocused = focus?.eid === e.eid;
              return (
                <tr
                  key={e.eid}
                  className={rowFocused ? 'bg-brand-50/60 dark:bg-brand-900/20' : undefined}
                >
                  <td className="sticky left-0 z-10 min-w-[14rem] border-b border-r border-line bg-surface-card p-1.5 dark:border-line-dark dark:bg-surface-dark-card">
                    <div className="truncate font-semibold text-ink dark:text-ink-dark">
                      <KindPill kind={e.kind} />
                      {e.name}
                    </div>
                    <div className="truncate text-[0.65rem] text-ink-muted dark:text-ink-dark-muted">
                      {e.emp_id}
                      {e.department ? ` · ${e.department}` : ''}
                      {e.position ? ` · ${e.position}` : ''}
                    </div>
                  </td>
                  {days.map((day) => {
                    const cell = byDate[day.date];
                    // A UI hint only: the real gate is enforce_entry_window in
                    // the database, and the API's 403 OUTSIDE_EDIT_WINDOW is
                    // what actually decides. This just avoids opening a picker
                    // whose save is certain to be refused.
                    const locked = day.date < cutoff || day.date > ahead;
                    const focused = rowFocused && focus?.date === day.date;
                    const leave = parseLeaveNote(cell?.note);
                    const onOpen = (f, anchor) => onOpenPicker(e.eid, day.date, f, anchor, e.kind);
                    return (
                      <td
                        key={day.date}
                        className={
                          'relative border-b border-l border-line/60 p-0.5 align-top ' +
                          'dark:border-line-dark/60 ' +
                          (day.weekend ? 'bg-weekend/60 dark:bg-weekend-dark/50 ' : '') +
                          (locked ? 'cell-locked bg-surface-sunken/60 dark:bg-surface-dark-sunken/50 ' : '') +
                          (focused ? 'outline outline-2 -outline-offset-2 outline-brand-600 ' : '') +
                          (leave ? 'bg-info-bg/60 dark:bg-info/10 ' : '')
                        }
                      >
                        <Slot
                          value={mainValue(cell)}
                          field={field}
                          isExtra={false}
                          weekend={day.weekend}
                          locked={locked}
                          onOpen={onOpen}
                          activityByCode={activityByCode}
                          costByCode={costByCode}
                        />
                        <Slot
                          value={extraValue(cell)}
                          field="pm"
                          isExtra
                          weekend={day.weekend}
                          locked={locked}
                          onOpen={onOpen}
                          activityByCode={activityByCode}
                          costByCode={costByCode}
                          mainFilled={Boolean(mainValue(cell))}
                        />
                        {/* An approval writes a plain Z-2 — byte-identical to a
                            hand-typed one — so without this marker the request
                            behind the day is invisible on the grid. */}
                        {leave && (
                          <div
                            title={
                              t('leave.fromApproved') + (leave.doc ? ` · ${leave.doc}` : '')
                            }
                            className="mt-0.5 truncate rounded bg-info/15 px-1 text-[0.55rem] font-semibold text-info-fg dark:text-info-dark"
                          >
                            ✓ {leave.label || t('leave.leave')}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Hint>
        {t('entry.weeklyHint')} · {t('entry.lockedBeyond')} {lockDays} {t('entry.lockedAuto')}
      </Hint>
    </div>
  );
}
