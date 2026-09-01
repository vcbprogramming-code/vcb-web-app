// Credit-facility domain vocabulary: statuses, facility kinds, cost categories.
//
// The Thai strings here are DATA, not UI copy. They are the literal values
// stored in credit.transactions.status / credit.requests.status and validated
// by the Zod enums in api/src/routes/credit.js — 'อนุมัติ' and 'ไม่อนุมัติ' are
// what POST /requests/:id/decide accepts. They are therefore never translated:
// translating a status would change what gets written to the database. The
// dictionary in i18n.js supplies the *labels* shown for them.

/* --------------------------------- status --------------------------------- */

export const STATUS = {
  NEW: 'คำขอใหม่',
  PENDING: 'อยู่ระหว่างเสนออนุมัติ',
  APPROVED: 'อนุมัติแล้ว',
  SETTLED: 'ชำระแล้ว',
};

/** The two decisions POST /requests/:id/decide accepts. */
export const DECISION = {
  APPROVE: 'อนุมัติ',
  REJECT: 'ไม่อนุมัติ',
};

/**
 * Map a stored status to a pill tone and a dictionary key.
 *
 * 'active' (lower case) appears in older imported rows and means approved;
 * 'void' means cancelled. Both are matched case-insensitively, as in legacy.js.
 */
export function statusMeta(s) {
  const v = String(s ?? '');
  const low = v.toLowerCase();
  if (v === STATUS.NEW) return { tone: 'new', key: 'status.new', raw: v };
  if (v === STATUS.PENDING) return { tone: 'pending', key: 'status.pending', raw: v };
  if (v === STATUS.APPROVED || low === 'active') {
    return { tone: 'approved', key: 'status.approved', raw: STATUS.APPROVED };
  }
  if (v === STATUS.SETTLED) return { tone: 'approved', key: 'status.settled', raw: v };
  if (low === 'void') return { tone: 'rejected', key: 'status.void', raw: v };
  return { tone: 'new', key: null, raw: v || '—' };
}

/** Approved-and-outstanding, i.e. the amount counts against the facility. */
export function isAuthorized(s) {
  const v = String(s ?? '');
  return v === STATUS.APPROVED || v.toLowerCase() === 'active';
}

/* ---------------------------- facility type kinds ------------------------- */

/**
 * kind -> the short label printed on the document pill.
 *
 * This mapping is now a real column: credit.facility_types.doc_kind, seeded in
 * 003_credit.sql from exactly this table. It stays here only as the fallback
 * used when the reference rows have not been fetched — the migration comment
 * calls out that kind and doc_kind are not derivable from one another.
 */
export const KIND_SHORT = {
  LG: 'BG',
  LGM: 'L/G',
  TL: 'T/L',
  AVAL: 'B/E',
  PN: 'P/N',
  ML: 'M/L',
  DLC: 'DLC',
  PNPOST: 'PN-post',
};

/** Tailwind classes per kind pill, replacing the .pill.LG/.TL/… CSS rules. */
export const KIND_PILL_CLASS = {
  LG: 'bg-info-bg text-info-fg dark:bg-brand-900/50 dark:text-info-dark',
  LGM: 'bg-info-bg text-info-fg dark:bg-brand-900/50 dark:text-info-dark',
  TL: 'bg-warn-bg text-warn-fg dark:bg-warn/20 dark:text-warn-dark',
  AVAL: 'bg-ok-bg text-ok-fg dark:bg-ok/20 dark:text-ok-dark',
  PN: 'bg-accent/10 text-accent dark:bg-accent-dark/15 dark:text-accent-dark',
  ML: 'bg-surface-sunken text-ink-subtle dark:bg-surface-dark-sunken dark:text-ink-dark-muted',
  DLC: 'bg-surface-sunken text-ink-subtle dark:bg-surface-dark-sunken dark:text-ink-dark-muted',
  PNPOST: 'bg-accent-violet/10 text-accent-violet dark:bg-accent-violet/20 dark:text-accent-violet',
};

/**
 * The three หนังสือค้ำประกัน lines (#1-3) that the dashboard folds into one BG box.
 * Facility numbers, not kinds — a facility carries facility_no.
 */
export const BG_PARTS = [1, 2, 3];

/**
 * #5 L/G วัสดุ, #9 DLC and #10 PN-post share the bank's B/E credit cap with
 * #6 AVAL, so the dashboard folds their limit and used into the B/E box.
 */
export const BE_FOLD_INTO = 6;
export const BE_FOLDED = [5, 9, 10];

/** Projects that never take part in the cash plan. */
export const PLAN_EXCLUDE = { HO: 1, LPB: 1 };

/* ------------------------------ cost categories --------------------------- */

/**
 * Fallback list, used only until GET /cost-categories answers. The live list is
 * credit.cost_categories, editable from Settings via PUT /cost-categories.
 */
export const COST_CATEGORY_DEFAULTS = [
  'ทรายถม',
  'หิน',
  'ปูน/คอนกรีต/ทรายหยาบ',
  'เหล็ก',
  'ค่าแรงผรม.รายย่อย',
  'ค่าแรง-ถมทราย',
  'ค่าแรง-VACUUM',
  'ค่าแรง-ปูยาง',
  'ค่าแรง-RAMP',
  'ค่าแรง-ดึงลวด',
  'ค่าแรง-สะพาน',
  'ค่าแรง-เสาเข็ม',
  'ค่าแรง-ไฟฟ้าแสงสว่าง',
  'ค่าขนส่ง',
  'น้ำมัน',
  'ค่าเครื่องจักร',
  'วัสดุสิ้นเปลือง',
  'อื่นๆ',
];

export const NO_CATEGORY = '(ไม่ระบุหมวด)';

// A distinct light colour per category so the cost summary can be scanned by
// eye. These are content colours keyed to Thai category names, not theme
// tokens, so they stay literal hex rather than moving into the Tailwind preset.
const CATEGORY_COLOR = {
  ทรายถม: '#E8C880',
  หิน: '#A8AEB8',
  คอนกรีต: '#94A8B9',
  ปูน: '#D9D2C5',
  'ปูน/คอนกรีต/ทรายหยาบ': '#C8B89A',
  'ปูน/คอนกรีต/ทราย': '#C8B89A',
  เหล็ก: '#6B7B91',
  'ค่าแรงผรม.รายย่อย': '#7FB069',
  'ค่าแรง-ถมทราย': '#B5C580',
  'ค่าแรง-VACUUM': '#82B59A',
  'ค่าแรง-ปูยาง': '#6B8E5C',
  'ค่าแรง-RAMP': '#A8C66C',
  'ค่าแรง-ดึงลวด': '#7AA590',
  'ค่าแรง-สะพาน': '#8BC8B5',
  'ค่าแรง-เสาเข็ม': '#5C8553',
  'ค่าแรง-ไฟฟ้าแสงสว่าง': '#C4D266',
  ค่าขนส่ง: '#6FC1E0',
  น้ำมัน: '#F2A878',
  ค่าเครื่องจักร: '#B59FD6',
  วัสดุสิ้นเปลือง: '#5EB8AE',
  อื่นๆ: '#C5CDD9',
  [NO_CATEGORY]: '#EBEEF2',
};

/** Categories whose swatch is dark enough to need white text. */
const DARK_BG = new Set(['เหล็ก', 'หิน', 'คอนกรีต', 'ค่าแรง-ปูยาง', 'ค่าแรง-เสาเข็ม']);

export function categoryColor(cat) {
  return CATEGORY_COLOR[cat] || '#C5CDD9';
}

export function categoryTextColor(cat) {
  return DARK_BG.has(cat) ? '#fff' : '#222';
}

/* ------------------------------ derived numbers --------------------------- */

/**
 * Interest accrued on an overdue authorised item.
 *
 * credit.facilities.interest is TEXT — free-form Thai like "MLR ต่อปี" or
 * "1.25 % ต่อปีเรียกเก็บทุก 3 เดือน". Only a leading number is usable as a rate;
 * anything else (MLR and friends) has no numeric value here and the UI must say
 * so rather than invent one. Hence the null return, not a 0.
 */
export function facRatePct(facilities, project, facilityNo) {
  const f = (facilities || []).find(
    (x) => x.project === project && String(x.facilityNo) === String(facilityNo)
  );
  if (!f) return null;
  const m = String(f.interest ?? '').match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) : null;
}

/** Remaining headroom on a facility. */
export function facAvail(facilities, project, facilityNo) {
  const f = (facilities || []).find(
    (x) => x.project === project && String(x.facilityNo) === String(facilityNo)
  );
  if (!f) return null;
  return Number(f.limit || 0) - Number(f.used || 0);
}
