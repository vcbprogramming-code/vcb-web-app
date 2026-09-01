// Date helpers. Every date that crosses the wire is a yyyy-mm-dd string, so
// these work on strings and only build a Date when arithmetic needs one.
//
// Strings are compared directly (`a < b`) throughout the app rather than parsed:
// ISO dates sort lexicographically, and comparing strings avoids the timezone
// class of bug entirely — `new Date('2026-05-18')` is midnight UTC, which is
// the previous day in any negative offset.

/** yyyy-mm-dd for a local calendar date. */
export function iso(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Today, in the browser's own timezone — not toISOString(), which is UTC. */
export function todayIso() {
  const d = new Date();
  return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function shift(isoDate, days) {
  // Noon, not midnight: a DST transition moves the clock by an hour, and from
  // midnight that lands on the previous day.
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export const isoMinus = (isoDate, n) => shift(isoDate, -n);
export const isoPlus = (isoDate, n) => shift(isoDate, n);

/** The day number, for a calendar cell label. */
export const dayNum = (isoDate) => Number(isoDate.slice(8, 10));

/**
 * Every day of a month as { date, dow, weekend }.
 *
 * Sunday alone is the weekend here, matching the sheet the live app was built
 * on: these are construction sites, and Saturday is a working day.
 */
export function daysInMonth(year, month) {
  const last = new Date(year, month, 0).getDate();
  const out = [];
  for (let d = 1; d <= last; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    out.push({ date: iso(year, month, d), dow, weekend: dow === 0 });
  }
  return out;
}

/**
 * The editable window, as the database trigger enforces it: nobody may fill in
 * more than one day ahead, and a non-admin may not reach further back than
 * LOCK_DAYS. An admin has no back limit.
 *
 * This is a UI hint that stops people typing into a cell the server will
 * refuse. The rule itself lives in the enforce_entry_window trigger, and the
 * API turns its rejection into 403 OUTSIDE_EDIT_WINDOW. Never treat the answer
 * here as permission.
 */
export function editWindow(today, lockDays, isAdmin = false) {
  return {
    from: isAdmin ? '0000-00-00' : isoMinus(today, lockDays),
    to: isoPlus(today, 1),
  };
}

export function isEditable(date, today, lockDays, isAdmin = false) {
  const w = editWindow(today, lockDays, isAdmin);
  return date >= w.from && date <= w.to;
}

/* --------------------------------- display -------------------------------- */

/** dd/mm/yy — Thai readers are day-first, and the short year saves width. */
export function fmtDate(isoDate) {
  if (!isoDate || isoDate.length < 10) return isoDate || '';
  return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}/${isoDate.slice(2, 4)}`;
}

/**
 * A from–to pair as one compact string. The same month and year collapses to
 * "17–18/08/26"; crossing a boundary prints both halves in full.
 */
export function fmtRange(from, to) {
  if (!from) return '';
  if (!to || from === to) return fmtDate(from);
  if (from.slice(0, 7) === to.slice(0, 7)) return `${from.slice(8, 10)}–${fmtDate(to)}`;
  return `${fmtDate(from)} – ${fmtDate(to)}`;
}

/** Inclusive day count across a leave range. */
export function dayCount(from, to) {
  if (!from || !to) return 0;
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  return Math.round((b - a) / 86400000) + 1;
}

/** Approvers are recorded by email; the local part identifies them at a glance. */
export function shortBy(v) {
  const s = String(v || '');
  const at = s.indexOf('@');
  return at > 0 ? s.slice(0, at) : s;
}

/**
 * Legacy sheet tabs were labelled in the Buddhist era: "2569-08" is Gregorian
 * 2026-08. Only needed where a legacy label is parsed — everything the API
 * serves is already Gregorian.
 */
export function fromBuddhistLabel(label) {
  const m = String(label || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  return { year: Number(m[1]) - 543, month: Number(m[2]) };
}
