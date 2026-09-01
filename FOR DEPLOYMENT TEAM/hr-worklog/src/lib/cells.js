// Reading and displaying the value stored in a work-log cell.
//
// -----------------------------------------------------------------------
// SLOTS ARE NOT TIMES OF DAY.
// -----------------------------------------------------------------------
// Slot 1 is งานหลัก, the main task. Slot 2 is งานเสริม, OPTIONAL extra work.
// The legacy sheet named its columns "AM 1"…"PM 31" and the API still calls
// slot 2's field `pm` for that reason, but this app has never had a morning /
// afternoon split and must never label one. A cell arrives as:
//
//   { team | detail, pm, note }
//
// where `team` (operation staff) and `detail` (support staff) are the SAME
// slot 1 — the split is a display choice by employee kind, not storage.
//
// A day with both slots filled is still ONE manday. Nothing in this file counts
// anything; manday numbers come from the API's hr.mandays view and only from
// there.
// -----------------------------------------------------------------------

/** Slot 1's field for an employee of this kind. */
export const primaryField = (kind) => (kind === 'operation' ? 'team' : 'detail');

/** Slot 1's value, whichever field carries it. */
export const mainValue = (cell) => cell?.team || cell?.detail || '';

/** Slot 2's value — งานเสริม, the optional extra task. */
export const extraValue = (cell) => cell?.pm || '';

/** Does this day have any work logged at all? */
export const hasWork = (cell) => Boolean(mainValue(cell) || extraValue(cell));

/**
 * The composite stored value is "<activity> / <cost>", e.g. "A-1 / 5".
 * Codes with no cost (Z-1 Standby, Z-2 Leave, Z-3 Resignation) store the bare
 * activity code.
 */
export function splitValue(value) {
  const [activity = '', cost = ''] = String(value || '').split(' / ');
  return { activity: activity.trim(), cost: cost.trim() };
}

/** A readable tooltip: "A-1 · งานผูก-ตัด-ดัดเหล็ก → 5 · งานดิน". */
export function cellTitle(value, activityByCode, costByCode) {
  if (!value) return '';
  const { activity, cost } = splitValue(value);
  const an = activityByCode(activity)?.name || '';
  const cn = cost ? costByCode(cost)?.name || '' : '';
  return (
    activity +
    (an ? ` · ${an}` : '') +
    (cost ? `   →   ${cost}${cn ? ` · ${cn}` : ''}` : '')
  );
}

/**
 * What the cell shows, per the "การแสดงในตารางสัปดาห์" preference: the raw
 * code (default, and what fits a 31-column grid) or the activity's full name.
 */
export function cellDisplay(value, mode, activityByCode) {
  if (!value) return '';
  if (mode === 'code') return value;
  const { activity } = splitValue(value);
  return activityByCode(activity)?.name || value;
}

/**
 * The one or two codes to render inside a coverage tile. Two identical codes
 * collapse to one — showing "A-1 A-1" says nothing the single code does not.
 */
export function codesFor(cell) {
  const a = mainValue(cell).split(' / ').join('/');
  const b = extraValue(cell).split(' / ').join('/');
  if (a && b && a !== b) return [a, b];
  const one = a || b;
  return one ? [one] : [];
}

/**
 * Reads a cell's note and reports whether that day was written by an APPROVED
 * LEAVE REQUEST rather than typed by hand.
 *
 * Server-written notes look like "[LV] ลาป่วย · LV20260819143210-047". The
 * ASCII marker is what is matched — the Thai wording after it is display text
 * that may be reworded or translated, and matching that would silently break
 * the indicator. Returns null for an ordinary remark, so a hand-typed note
 * never shows the badge.
 *
 * This matters because an approval writes a plain Z-2 — byte-identical to what
 * HR would type — so without the note there is nothing to tell them apart.
 */
export function parseLeaveNote(note) {
  const s = String(note ?? '').trim();
  if (s.indexOf('[LV]') !== 0) return null;
  const rest = s.slice(4).trim();
  const dot = rest.lastIndexOf('·');
  const label = (dot >= 0 ? rest.slice(0, dot) : rest).trim();
  const doc = dot >= 0 ? rest.slice(dot + 1).trim() : '';
  return { label, doc };
}
