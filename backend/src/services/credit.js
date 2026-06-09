import {
  Facility,
  CreditLedger,
  CreditAudit,
} from '../models/index.js';
import { AUTHORIZED_STATUSES } from '../models/CreditLedger.js';

/**
 * Compute the "Used" amount for one facility: baseline + sum of authorized
 * ledger amounts (status = อนุมัติแล้ว). Settled/new/pending/void do not count.
 */
export async function usedForFacility(facilityId) {
  const rows = await CreditLedger.find({
    facilityId,
    status: { $in: AUTHORIZED_STATUSES },
  }).lean();
  return rows.reduce((s, r) => s + (r.amount || 0), 0);
}

/**
 * Sum of authorized ledger amounts per facility, for MANY facilities at once
 * (one aggregation instead of one query per facility). Returns a Map
 * facilityId(string) → authorized total.
 */
export async function authorizedUsedMap(facilityIds) {
  if (!facilityIds?.length) return new Map();
  const rows = await CreditLedger.aggregate([
    { $match: { facilityId: { $in: facilityIds }, status: { $in: AUTHORIZED_STATUSES } } },
    { $group: { _id: '$facilityId', total: { $sum: '$amount' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.total]));
}

/** Build a facility view from a precomputed authorized-used amount (no query). */
export function facilityViewWith(facility, authorizedUsed = 0) {
  const baseline = facility.usedBaseline || 0;
  const used = baseline + authorizedUsed;
  const limit = facility.limit || 0;
  return facilityShape(facility, used, limit);
}

/** Build a facility view with computed used/available (single facility). */
export async function facilityView(facility) {
  const baseline = facility.usedBaseline || 0;
  const used = baseline + (await usedForFacility(facility._id));
  const limit = facility.limit || 0;
  return facilityShape(facility, used, limit);
}

function facilityShape(facility, used, limit) {
  return {
    id: String(facility._id),
    project_id: String(facility.projectId),
    company: facility.company ?? null,
    bank: facility.bank ?? null,
    facility_no: facility.facilityNo ?? null,
    type: facility.type,
    limit,
    used,
    available: limit - used,
    pct: limit ? Math.round((used / limit) * 100) : 0,
    interest_rate: facility.interestRate ?? null,
    fee_rate: facility.feeRate ?? null,
    approved_date: facility.approvedDate ?? null,
    due_date: facility.dueDate ?? null,
    notes: facility.notes ?? null,
    is_active: facility.isActive,
  };
}

/** Which maturity bucket a date falls into. */
export function dueBucket(dueDate, now = new Date()) {
  if (!dueDate) return 'later';
  const d = new Date(dueDate);
  const startThis = new Date(now.getFullYear(), now.getMonth(), 1);
  const startNext = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startAfter = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  if (d < startThis) return 'overdue';
  if (d < startNext) return 'thisMonth';
  if (d < startAfter) return 'nextMonth';
  return 'later';
}

/**
 * Overdue interest for an authorized ledger item past its due date:
 * amount × rate% × days/365. rate falls back to the facility rate.
 */
export function overdueInterest(item, facilityRate, now = new Date()) {
  if (!item.dueDate) return 0;
  const due = new Date(item.dueDate);
  if (due >= now) return 0;
  if (!AUTHORIZED_STATUSES.includes(item.status)) return 0;
  const rate = item.interestRate ?? facilityRate ?? 0;
  const days = Math.floor((now - due) / 86400000);
  return (item.amount || 0) * (rate / 100) * (days / 365);
}

/** Write an audit row. NEVER throws — audit must not block the real write. */
export async function writeAudit({ actor, action, target, targetId, changes, note }) {
  try {
    await CreditAudit.create({
      actorId: actor?.id || null,
      actorLabel: actor?.full_name || actor?.email || null,
      action,
      target,
      targetId: targetId ? String(targetId) : null,
      changes: changes || null,
      note: note || null,
      createdAt: new Date(),
    });
  } catch (e) {
    console.error('audit write failed (non-fatal):', e.message);
  }
}

/** Field-level diff between two plain objects (before/after). */
export function diff(before, after, fields) {
  const out = {};
  for (const f of fields) {
    const b = before?.[f];
    const a = after?.[f];
    if (String(b ?? '') !== String(a ?? '')) out[f] = { before: b ?? null, after: a ?? null };
  }
  return Object.keys(out).length ? out : null;
}

export { Facility, CreditLedger };
