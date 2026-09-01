// Row filtering and reference lookups shared by the views.
//
// These were free functions over the global `D` in legacy.js (projTh, typeName,
// kindShort, flt, matchCo, …). They now take the data they read, so a view can
// call them without a module-level singleton.

import { KIND_SHORT, isAuthorized, STATUS } from './domain.js';
import { dueBucket, isDueWithin7, parseDue } from './format.js';

/* ------------------------------ reference names --------------------------- */

export function projectOf(projects, code) {
  return (projects || []).find((p) => p.code === code) || null;
}

/** Thai project name, falling back to the code when reference rows are absent. */
export function projTh(projects, code) {
  const p = projectOf(projects, code);
  return p ? p.th : code;
}

/** "BT1 · บางเตย ตอน 1" — the label used in dropdowns. */
export function projName(projects, code) {
  const p = projectOf(projects, code);
  return p && p.th !== p.code ? `${p.code} · ${p.th}` : code;
}

/** Name with the parenthetical stripped, for tight table cells. */
export function projThShort(projects, code) {
  return String(projTh(projects, code))
    .replace(/\s*\([^)]*\)\s*/g, '')
    .trim();
}

export function projCompany(projects, code) {
  const p = projectOf(projects, code);
  return p ? p.company : '';
}

export function facTypeOf(facTypes, no) {
  return (facTypes || []).find((t) => String(t.no) === String(no)) || null;
}

export function typeName(facTypes, no) {
  const t = facTypeOf(facTypes, no);
  return t ? t.th : `#${no}`;
}

export function typeKind(facTypes, no) {
  const t = facTypeOf(facTypes, no);
  return t ? t.kind : '';
}

/**
 * The short label on the document pill.
 *
 * Prefers credit.facility_types.doc_kind, which is what the migration stores;
 * falls back to the KIND_SHORT map only when reference rows are unavailable.
 */
export function kindShort(facTypes, no) {
  const t = facTypeOf(facTypes, no);
  if (t?.docKind) return t.docKind;
  const kind = t?.kind || '';
  return KIND_SHORT[kind] || kind || '-';
}

/** The unique company list, for the company filter. */
export function companies(projects) {
  return [...new Set((projects || []).map((p) => p.company).filter(Boolean))].sort();
}

/* --------------------------------- matching ------------------------------- */

export function matchCompany(projects, project, filters) {
  return !filters.co || projCompany(projects, project) === filters.co;
}

/** A status filter may be a comma-separated set — the dashboard sets several. */
export function matchStatus(status, want) {
  if (!want) return true;
  return String(want).split(',').includes(String(status));
}

export function matchKind(facTypes, facilityNo, want) {
  if (!want) return true;
  // The B/E filter deliberately includes the lines that share its credit cap.
  if (want === 'AVAL') {
    const k = typeKind(facTypes, facilityNo);
    return k === 'AVAL' || k === 'LGM' || k === 'DLC' || k === 'PNPOST';
  }
  // The BG filter covers the three หนังสือค้ำประกัน lines.
  if (want === 'LG') return typeKind(facTypes, facilityNo) === 'LG';
  return typeKind(facTypes, facilityNo) === want;
}

export function matchDue(due, want) {
  if (!want) return true;
  if (want === 'week') return isDueWithin7(due);
  return dueBucket(due) === want;
}

/** Free-text search across the fields the old placeholder promised. */
export function matchQuery(row, q) {
  if (!q) return true;
  const needle = String(q).toLowerCase();
  const hay = [
    row.ref,
    row.desc,
    row.purpose,
    row.beneficiary,
    row.project,
    row.note,
    row.costCategory,
    row.source,
    row.id,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(needle);
}

/** Apply the whole filter bar to a transaction/request list. */
export function applyFilters(rows, { projects, facTypes, filters }) {
  return (rows || []).filter(
    (r) =>
      (!filters.proj || r.project === filters.proj) &&
      matchCompany(projects, r.project, filters) &&
      matchKind(facTypes, r.facilityNo, filters.type) &&
      matchDue(r.due || r.maturity, filters.due) &&
      matchStatus(r.status, filters.status) &&
      matchQuery(r, filters.q)
  );
}

export function filterFacilities(facilities, { projects, facTypes, filters }) {
  return (facilities || []).filter(
    (f) =>
      (!filters.proj || f.project === filters.proj) &&
      matchCompany(projects, f.project, filters) &&
      matchKind(facTypes, f.facilityNo, filters.type)
  );
}

/* --------------------------------- derived -------------------------------- */

/**
 * Interest accrued past the due date on an authorised, unsettled item.
 *
 * Returns null when the facility's rate is not numeric — credit.facilities
 * .interest is free text ("MLR ต่อปี"), so there is often no rate to apply and
 * the UI must say so instead of showing a fabricated 0.
 */
export function overdueInterest(facilities, txn) {
  if (!isAuthorized(txn.status) || txn.status === STATUS.SETTLED) return 0;
  const due = parseDue(txn.due || txn.maturity);
  if (!due) return 0;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.floor((today - due) / 86400000);
  if (days <= 0) return 0;

  const f = (facilities || []).find(
    (x) => x.project === txn.project && String(x.facilityNo) === String(txn.facilityNo)
  );
  const m = String(f?.interest ?? '').match(/(\d+(?:\.\d+)?)\s*%/);
  if (!m) return null;
  return ((Number(txn.amount) || 0) * (Number(m[1]) / 100) * days) / 365;
}

/** The "เอกสารแนบ" cell: source plus an optional document date or range. */
export function attachText(row) {
  let s = row.source || '';
  if (row.docFrom) s += (s ? ' | ' : '') + row.docFrom + (row.docTo ? `–${row.docTo}` : '');
  return s || '-';
}
