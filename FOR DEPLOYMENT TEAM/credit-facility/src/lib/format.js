// Money, dates and due-date bucketing — ported from src/app/legacy.js.
//
// The wire format for dates is dd/mm/yyyy in both directions: the API's dmy()
// renders it and its toDate() parses it back (api/src/routes/credit.js). That
// is the sheet's format and it is kept deliberately, so these helpers speak it
// rather than ISO.

/** Thousands-separated, no decimals — matches money() in legacy.js. */
export function money(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Parse a money string that may carry grouping commas. */
export function moneyVal(s) {
  return parseFloat(String(s ?? '').replace(/,/g, '')) || 0;
}

/** Format for a money input: group the integer part, keep what was typed after the dot. */
export function fmtMoneyStr(v) {
  const raw = String(v ?? '').replace(/[^0-9.\-]/g, '');
  if (!raw) return '';
  const neg = raw.startsWith('-');
  const body = neg ? raw.slice(1) : raw;
  const dot = body.indexOf('.');
  const int = dot < 0 ? body : body.slice(0, dot);
  const dec = dot < 0 ? '' : body.slice(dot);
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + grouped + dec;
}

/**
 * Parse a due value. Accepts dd/mm/yyyy and — because the sheet leaked them
 * into the seed data — bare Excel serial numbers.
 */
export function parseDue(s) {
  if (s == null || s === '') return null;
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  if (/^\d{4,6}$/.test(String(s))) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 864e5);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Due today through today+7, inclusive. Independent of dueBucket — a row can be
 * both "this month" and "within 7 days".
 */
export function isDueWithin7(s) {
  const d = parseDue(s);
  if (!d) return false;
  const n = new Date();
  const t0 = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  const t7 = new Date(t0.getTime() + 7 * 86400000);
  return d >= t0 && d <= t7;
}

/**
 * 'overdue' | 'this' | 'next' | 'later' | ''.
 *
 * The whole current month counts as "this month" even once the day has passed —
 * such a row is still unpaid or postponed, not overdue. Overdue means before
 * this month.
 */
export function dueBucket(s) {
  const d = parseDue(s);
  if (!d) return '';
  const n = new Date();
  const tY = n.getFullYear();
  const tM = n.getMonth();
  const dY = d.getFullYear();
  const dM = d.getMonth();
  if (dY < tY || (dY === tY && dM < tM)) return 'overdue';
  if (dY === tY && dM === tM) return 'this';
  const nx = new Date(tY, tM + 1, 1);
  if (dY === nx.getFullYear() && dM === nx.getMonth()) return 'next';
  return 'later';
}

export function daysOverdue(due) {
  const d = parseDue(due);
  if (!d) return 0;
  const n = new Date();
  const t0 = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  const diff = Math.floor((t0 - d) / 86400000);
  return diff > 0 ? diff : 0;
}

/* ------------------------------ date plumbing ----------------------------- */

export function fmtDMY(dt) {
  const dd = `0${dt.getDate()}`.slice(-2);
  const mm = `0${dt.getMonth() + 1}`.slice(-2);
  return `${dd}/${mm}/${dt.getFullYear()}`;
}

/** yyyy-mm-dd (an <input type="date"> value) -> dd/mm/yyyy. */
export function isoToDMY(s) {
  const m = String(s ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** dd/mm/yyyy -> yyyy-mm-dd, for an <input type="date"> value. */
export function dmyToISO(s) {
  const m = String(s ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${`0${m[2]}`.slice(-2)}-${`0${m[1]}`.slice(-2)}` : '';
}

export function parseIso(s) {
  return s ? new Date(`${s}T00:00:00`) : null;
}

export function toIso(dt) {
  const m = `0${dt.getMonth() + 1}`.slice(-2);
  const d = `0${dt.getDate()}`.slice(-2);
  return `${dt.getFullYear()}-${m}-${d}`;
}

/** Is a dd/mm/yyyy string well formed (or empty)? Used to validate doc-date ranges. */
export function isDMYOrBlank(s) {
  const v = String(s ?? '').trim();
  return v === '' || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v);
}

/* --------------------------- start / days / maturity ---------------------- */
// The request form keeps three fields consistent: start date, a day count, and
// the maturity date. Editing any two recomputes the third.

// A blank days field must be a no-op, not "0 days" — Number('') is 0, which
// is finite, so clearing the field used to snap the linked date to match its
// counterpart instead of leaving it alone. The original's parseInt+isNaN
// guard rejected blank input naturally; Number.isFinite alone does not.
function parseDays(days) {
  const s = String(days ?? '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function matFromStartDays(startIso, days) {
  const d = parseIso(startIso);
  const n = parseDays(days);
  if (!d || n === null) return '';
  d.setDate(d.getDate() + n);
  return toIso(d);
}

export function daysFromStartMat(startIso, matIso) {
  const a = parseIso(startIso);
  const b = parseIso(matIso);
  if (!a || !b) return '';
  return String(Math.round((b - a) / 86400000));
}

export function startFromMatDays(matIso, days) {
  const d = parseIso(matIso);
  const n = parseDays(days);
  if (!d || n === null) return '';
  d.setDate(d.getDate() - n);
  return toIso(d);
}
