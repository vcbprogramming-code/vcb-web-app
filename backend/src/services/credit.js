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

/**
 * Build a facility view from a precomputed authorized-used amount.
 *
 * ยอดใช้ไปตามระบบจริง (getData ใน Code.js): ถ้ามีคนปักยอดไว้ (used_override)
 * ใช้ตัวเลขนั้นตรง ๆ ไม่งั้นคำนวณจากยอดตั้งต้น + รายการที่อนุมัติ แล้วตัดที่ศูนย์
 * — ตัดเฉพาะยอดที่คำนวณ ยอดที่ปักเองเชื่อตามที่กรอก
 */
/**
 * อัตราต่อปีเป็นตัวเลข จากข้อความอิสระที่คนกรอกไว้
 *
 * หนังสือวงเงินของธนาคารเขียนเงื่อนไขเป็นประโยค — "1.25 % ต่อปีเรียกเก็บทุก 3
 * เดือน" หรือ "MLR ต่อปี" ระบบจริงของลูกค้า (facRatePct) ดึงตัวเลขหน้า % ออกมา
 * ใช้ ถ้าไม่มีตัวเลขก็ไม่คำนวณดอกเบี้ยให้ แต่ต้องไม่พังและไม่เดาเป็นศูนย์ —
 * ศูนย์อ่านเหมือน "ไม่มีดอกเบี้ย" ซึ่งคนละเรื่องกับ "ระบุอัตราไม่ได้"
 *
 * คืน null เมื่อระบุอัตราไม่ได้ ตัวเลขในคอลัมน์เดิมเป็นตัวสำรองเมื่อไม่มีข้อความ
 */
export function ratePct(interestNote, interestRate) {
  const m = String(interestNote ?? '').match(/(\d+(\.\d+)?)\s*%/);
  if (m) return Number(m[1]);
  // ข้อความที่ไม่มีเลข % เลย = ระบุอัตราไม่ได้ (เช่น "MLR ต่อปี") อย่าไปหยิบ
  // ตัวเลขเก่ามาใช้แทน เพราะคนแก้ช่องข้อความก็เพื่อบอกว่ามันไม่ใช่ตัวเลขนั่นแหละ
  if (String(interestNote ?? '').trim()) return null;
  return interestRate != null && interestRate !== '' ? Number(interestRate) : null;
}

export function facilityView(f, authorizedUsed = 0) {
  const auto = Math.max(0, Number(f.used_baseline || 0) + Number(authorizedUsed || 0));
  const pinned = f.used_override != null;
  const used = pinned ? Number(f.used_override) : auto;
  const limit = Number(f.limit || 0);
  return {
    id: f.id, project_id: f.project_id, company: f.company, bank: f.bank,
    facility_no: f.facility_no, type: f.type, limit, used, available: limit - used,
    used_auto: auto, used_overridden: pinned,
    // หลอดและตัวเลขเปอร์เซ็นต์ของระบบจริงไม่เกิน 100 และวงเงินศูนย์ที่มีการใช้ = 100
    pct: limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : (used > 0 ? 100 : 0),
    interest_note: f.interest_note ?? null,
    // อัตราที่คำนวณได้จริง — null คือระบุอัตราไม่ได้ หน้าจอจะได้บอกตรง ๆ
    interest_pct: ratePct(f.interest_note, f.interest_rate),
    interest_rate: f.interest_rate != null ? Number(f.interest_rate) : null,
    fee_rate: f.fee_rate != null ? Number(f.fee_rate) : null,
    approved_date: f.approved_date, due_date: f.due_date, notes: f.notes, is_active: f.is_active,
  };
}

/**
 * รายการที่ยัง "ต้องจ่าย" สำหรับการ์ดครบกำหนด — ตรงกับหน้าแรกของระบบจริง:
 * ตัดเฉพาะที่ชำระแล้วกับยกเลิก (void) และนับเฉพาะยอดบวก รายการที่ยังรออนุมัติ
 * ก็นับด้วย เพราะเป็นตั๋วที่จะถึงกำหนดจ่ายเหมือนกัน
 */
export const isOutstanding = (status, amount) =>
  status !== 'ชำระแล้ว' && String(status).toLowerCase() !== 'void' && Number(amount) > 0;

/** ครบภายใน 7 วัน นับรวมวันนี้และวันที่ 7 — เป็นกลุ่มซ้อน ไม่แย่งกับเดือนนี้/เดือนหน้า */
export function isDueWithin7(dueDate, now = new Date()) {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const t7 = new Date(t0.getTime() + 7 * 86400000);
  return d >= t0 && d <= t7;
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
  return overdueInterestInfo(item, facilityRate, now).amount;
}

/**
 * ดอกเบี้ยเกินกำหนด พร้อมบอกว่าคำนวณไม่ได้เพราะอะไร
 *
 * `rateUnavailable` แยก "ไม่มีดอกเบี้ย" ออกจาก "ระบุอัตราไม่ได้" — วงเงินที่
 * หนังสือธนาคารเขียนว่า MLR ไม่มีตัวเลขให้คูณ ถ้าปัดเป็น ฿0 คนอ่านจะเข้าใจว่า
 * ไม่มีดอกเบี้ยค้าง ซึ่งผิดและเป็นเงินจริง
 */
export function overdueInterestInfo(item, facilityRate, now = new Date()) {
  const none = { amount: 0, days: 0, rate: null, rateUnavailable: false };
  if (!item.due_date) return none;
  const due = new Date(item.due_date);
  if (due >= now) return none;
  if (!AUTHORIZED_STATUSES.includes(item.status)) return none;
  if (!(Number(item.amount) > 0)) return none;
  const rate = item.interest_rate != null ? Number(item.interest_rate) : facilityRate;
  const days = Math.floor((now - due) / 86400000);
  if (rate == null || Number.isNaN(Number(rate))) return { ...none, days, rateUnavailable: true };
  return { amount: Number(item.amount || 0) * (Number(rate) / 100) * (days / 365), days, rate: Number(rate), rateUnavailable: false };
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
