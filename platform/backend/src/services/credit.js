import { query, queryOne } from '../config/db.js';

export const AUTHORIZED_STATUSES = ['อนุมัติแล้ว'];

/** Authorized-used total per facility, for many facilities at once. Map(id→sum). */
export async function authorizedUsedMap(facilityIds) {
  if (!facilityIds?.length) return new Map();
  const { rows } = await query(
    `select facility_id, coalesce(sum(amount),0)::float8 total
       from credit_ledger where status = 'อนุมัติแล้ว' and facility_id = any($1)
      group by facility_id`,
    [facilityIds]
  );
  return new Map(rows.map((r) => [r.facility_id, r.total]));
}

/** Build a facility view from a precomputed authorized-used amount. */
export function facilityView(f, authorizedUsed = 0) {
  const used = Number(f.used_baseline || 0) + Number(authorizedUsed || 0);
  const limit = Number(f.limit || 0);
  return {
    id: f.id, project_id: f.project_id, company: f.company, bank: f.bank,
    facility_no: f.facility_no, type: f.type, limit, used, available: limit - used,
    pct: limit ? Math.round((used / limit) * 100) : 0,
    interest_rate: f.interest_rate != null ? Number(f.interest_rate) : null,
    fee_rate: f.fee_rate != null ? Number(f.fee_rate) : null,
    approved_date: f.approved_date, due_date: f.due_date, notes: f.notes, is_active: f.is_active,
  };
}

/** Maturity bucket for a due date. */
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

/** Overdue interest for an authorized item past due: amount × rate% × days/365. */
export function overdueInterest(item, facilityRate, now = new Date()) {
  if (!item.due_date) return 0;
  const due = new Date(item.due_date);
  if (due >= now) return 0;
  if (!AUTHORIZED_STATUSES.includes(item.status)) return 0;
  const rate = item.interest_rate ?? facilityRate ?? 0;
  const days = Math.floor((now - due) / 86400000);
  return Number(item.amount || 0) * (Number(rate) / 100) * (days / 365);
}

/** Write an audit row. NEVER throws — audit must not block the real write. */
export async function writeAudit({ actor, action, target, targetId, changes, note }) {
  try {
    await query(
      `insert into credit_audit (actor_id, actor_label, action, target, target_id, changes, note)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [actor?.id || null, actor?.full_name || actor?.email || null, action, target,
       targetId != null ? String(targetId) : null, changes ? JSON.stringify(changes) : null, note || null]
    );
  } catch (e) {
    console.error('audit write failed (non-fatal):', e.message);
  }
}

/** Field diff between two row objects. */
export function diff(before, after, fields) {
  const out = {};
  for (const f of fields) {
    const b = before?.[f];
    const a = after?.[f];
    if (String(b ?? '') !== String(a ?? '')) out[f] = { before: b ?? null, after: a ?? null };
  }
  return Object.keys(out).length ? out : null;
}
