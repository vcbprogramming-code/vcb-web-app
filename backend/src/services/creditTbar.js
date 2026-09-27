/**
 * แผนการเงิน (T-bar) — เลขทุกตัวบนการ์ดคำนวณจากที่นี่
 *
 * ถอดมาจากระบบจริงของลูกค้า (credit-facility/index.html: planIncomeCalc,
 * renderPlanPeriodCard, planRefreshDeductionCells, planInterestBlock,
 * planTotalsForPeriods) และ Code.js (getCashPlan / saveCashPlanPeriod)
 *
 * หนึ่งเดือนของหนึ่งโครงการแบ่งเป็น "ส่วน" ได้ไม่เกิน 5 ส่วน แต่ละส่วนมีประเภท
 * และคำนวณต่างกัน:
 *
 * ① income — "ขอเบิก P/N" (ตารางซ้ายคือการขายลดตั๋วกับธนาคาร)
 *    โหมด work (ค่างาน):
 *      เพดาน 1 = ค่างานที่ส่ง × 80%            (ธนาคารให้ขายลดได้ไม่เกิน 80% ของค่างาน)
 *      หัก segment = ค่า segment CVE × 60%
 *      เหลือค่างวด (เพดาน 2) = ค่างาน − 60% segment
 *      ฐานที่ขายได้ = ค่างาน > 0 ? MIN(เพดาน 1, เพดาน 2) : 0
 *      จะคงเหลือ P/N ที่ขายได้ = ฐานที่ขายได้ − PN ที่ขายไว้ (เดือนก่อน, กรอกมือ)
 *      P/N RT = เงินประกันผลงาน × 80%
 *      รวม P/N ที่ขาย = จะคงเหลือ + P/N RT        → นี่คือ "รับ" ของส่วนนี้
 *    โหมด progress (Workdone):
 *      รวม P/N ที่ขาย = ผลงานที่ทำได้ × 50%       (ไม่มีรายการหัก)
 *
 * ② deduction — "รับเงินค่างาน + หักหนี้" (ห้าแถวหักตาม T-bar ของธนาคาร)
 *      หัก TL             = รับเงินค่างานสุทธิ × 15%     · auto แก้มือไม่ได้
 *      หัก ML             = รับเงินค่างานสุทธิ × 1.5%    · auto แก้มือไม่ได้
 *      หัก PN             = กรอกมือ — PN Work Done ของงวดก่อน
 *                           (ค่าเริ่มต้นเมื่อสร้างส่วน = รวม P/N ที่ขายของเดือนก่อน)
 *      หัก PN ขอเบิกใหม่  = auto — รวม P/N ที่ขายของส่วน income "ส่วนแรก" เดือนนี้
 *      หัก Segment CVE    = กรอกมือ
 *      คงเหลือ = รับเงินค่างานสุทธิ − ผลรวมห้าแถว
 *      "รับ" ของส่วนนี้ = รับเงินค่างานสุทธิ · "จ่าย" = ผลรวมห้าแถว + ตั๋วที่ส่วนนี้จ่าย
 *
 * ③ aval — "ขอออก Aval จัดสรร": "จ่าย" = ยอด Aval ที่ขอออก
 *
 * ดอกเบี้ย P/N ที่ต้องจ่าย (ตารางขวาของส่วน income):
 *      ดอกเบี้ย = ยอด P/N × จำนวนวัน × อัตราต่อปี ÷ 365   ปัดสองตำแหน่ง
 *      สองแถว: "P/N ที่ขายได้" (ยอด = จะคงเหลือ, วัน = daysNew) และ
 *               "P/N RT (เงินประกัน)" (ยอด = P/N RT, วัน = daysRT)
 *      อัตราเริ่มต้น 6.35%/ปี ตามชีต cashflow ของธนาคาร
 *      *** ตัวเลขนี้แสดงอย่างเดียว ไม่ถูกบวกเข้า "รวมจ่าย" — เหมือนระบบจริงของเขา
 *          (planInterestBlock แค่ render, secOut ไม่ได้บวกดอกเบี้ย) ***
 *
 * รวมรับ / รวมจ่าย / สุทธิงวดนี้:
 *      รับ ของทุกส่วนบวก "รายรับจากแหล่งอื่น" (extraRows) ของส่วนนั้นด้วยเสมอ
 *      สุทธิงวดนี้ = รับ − จ่าย ของส่วนนั้น
 *      รวมของโครงการ = ผลบวกของทุกส่วน
 *
 * จุดที่ "ไม่" ลอกตามเขาแบบตรงตัว (ตั้งใจ · เขียนไว้ให้รู้):
 *   ระบบจริงคิดยอดรวมท้ายการ์ดจาก tally ที่ตั้ง sectionOut ของส่วน income ไว้ 0
 *   (ดู renderPlanPeriodCard: sectionIn=c.totalPN แล้วไม่แตะ sectionOut) แต่แถบ
 *   สรุปใต้ส่วนเดียวกันใช้ secOut = ยอดตั๋วที่ส่วนนั้นจ่าย ผลคือ "รวมจ่าย" ท้าย
 *   การ์ดน้อยกว่าผลบวกของทุกส่วนที่แสดงอยู่ข้างบน ซึ่งเป็นเงินที่จ่ายออกจริง
 *   ของเราจึงให้ยอดรวมท้ายการ์ด = ผลบวกของแถบสรุปทุกส่วน ตรงกับที่คนอ่านเห็น
 */

export const MAX_PERIODS = 5;
export const DEFAULT_PN_RATE = 0.0635;
export const TL_RATE = 0.15;
export const ML_RATE = 0.015;
export const PERIOD_TYPES = ['income', 'deduction', 'aval', 'mixed'];

/** ปัดสองตำแหน่งแบบเดียวกับ Math.round(x*100)/100 ของเขา */
export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => Number(v) || 0;

/** ห้าแถวหักที่ทุกส่วน deduction เริ่มต้นด้วย — ลำดับและคำตาม T-bar ของธนาคาร */
export const defaultDeductions = () => ([
  { label: 'หัก TL', amount: 0 },
  { label: 'หัก ML', amount: 0 },
  { label: 'หัก PN', amount: 0 },
  { label: 'หัก PN ขอเบิกใหม่', amount: 0 },
  { label: 'หัก Segment CVE', amount: 0 },
]);

/** ค่าตั้งต้นของตารางซ้ายส่วน income — daysNew/daysRT คือจำนวนวันของตั๋วแต่ละใบ */
export const defaultIncome = (kind = 'work') => ({
  kind: kind === 'progress' ? 'progress' : 'work',
  work: 0, segment: 0, pnSold: 0, rt: 0, daysNew: 90, daysRT: 90,
});

/** แถวเก่าที่เก็บ incomeBreak เป็น array (โครงเดิมก่อนเขาออกแบบใหม่) ถือว่าว่าง */
export function incomeObj(period) {
  const o = period && period.income_break;
  if (o && !Array.isArray(o) && typeof o === 'object') return { ...defaultIncome(o.kind), ...o };
  return defaultIncome();
}
export const incomeKind = (period) => (incomeObj(period).kind === 'progress' ? 'progress' : 'work');

/** คำนวณตารางซ้ายของส่วน income ทั้งตาราง — คืนทุกช่องที่หน้าจอแสดง */
export function incomeCalc(period) {
  const o = incomeObj(period);
  const work = num(o.work);
  const daysNew = o.daysNew == null ? 90 : num(o.daysNew);
  const daysRT = o.daysRT == null ? 90 : num(o.daysRT);
  if (o.kind === 'progress') {
    const tp = work * 0.5;
    return { kind: 'progress', work, seg: 0, pnSold: 0, rt: 0, ceil1: 0, seg60: 0, remain: 0,
      sellBase: tp, newPN: tp, rtPN: 0, totalPN: tp, daysNew, daysRT };
  }
  const seg = num(o.segment); const pnSold = num(o.pnSold); const rt = num(o.rt);
  const ceil1 = work * 0.8; const seg60 = seg * 0.6; const remain = work - seg60;
  const sellBase = work > 0 ? Math.min(ceil1, remain) : 0;
  const newPN = sellBase - pnSold; const rtPN = rt * 0.8; const totalPN = newPN + rtPN;
  return { kind: 'work', work, seg, pnSold, rt, ceil1, seg60, remain,
    sellBase, newPN, rtPN, totalPN, daysNew, daysRT };
}

/**
 * รวม P/N ที่ขายของ "ส่วน income ส่วนแรก" ในเดือนนั้น — ตัวที่ป้อน
 * "หัก PN ขอเบิกใหม่" ของส่วน deduction (planPnSoldThisMonth ของเขา)
 */
export function pnSoldThisMonth(periods) {
  const inc = (periods || []).filter((p) => p.period_type === 'income')
    .sort((a, b) => (a.period_idx || 0) - (b.period_idx || 0))[0];
  return inc ? incomeCalc(inc).totalPN : 0;
}

/**
 * รวม P/N ที่ขายของ "ทุก" ส่วน income (planPnSoldFrom ของเขา) — ใช้เฉพาะหน้า
 * ผลต่าง ซึ่งเขาคิดคนละแบบกับการ์ด ตั้งใจเก็บความต่างนี้ไว้ตามซอร์สของเขา
 */
export function pnSoldFrom(periods) {
  return (periods || []).reduce((s, p) => s + (p.period_type === 'income' ? incomeCalc(p).totalPN : 0), 0);
}

/**
 * ห้าแถวหักพร้อมยอดที่คำนวณแล้ว — TL/ML/PN-ขอเบิกใหม่ เป็น auto ที่เหลือกรอกมือ
 * เทียบชื่อแถวด้วย indexOf เหมือนเขา เพราะแถวถูกอ้างด้วย "คำในป้าย" ไม่ใช่ลำดับ
 */
export function deductionRows(period, pnSold) {
  const income = num(period.income);
  const rows = (Array.isArray(period.deductions_json) && period.deductions_json.length)
    ? period.deductions_json : defaultDeductions();
  return rows.map((d) => {
    const label = String(d.label || '');
    if (label.indexOf('TL') >= 0) return { label, amount: r2(income * TL_RATE), auto: true };
    if (label.indexOf('ML') >= 0) return { label, amount: r2(income * ML_RATE), auto: true };
    if (label.indexOf('ขอเบิกใหม่') >= 0) return { label, amount: num(pnSold), auto: true };
    return { label, amount: num(d.amount), auto: false };
  });
}

export const extraTotal = (period) =>
  (Array.isArray(period.extra_rows) ? period.extra_rows : []).reduce((s, r) => s + num(r.amount), 0);

/** ตารางดอกเบี้ย P/N ที่ต้องจ่าย — แสดงอย่างเดียว ไม่บวกเข้ารวมจ่าย */
export function interestRows(period, rate = DEFAULT_PN_RATE) {
  if (period.period_type !== 'income') return { rows: [], total: 0, rate };
  const c = incomeCalc(period);
  const items = [];
  if (c.newPN > 0) items.push({ label: 'P/N ที่ขายได้', amount: c.newPN, days: c.daysNew, field: 'daysNew' });
  if (c.rtPN > 0) items.push({ label: 'P/N RT (เงินประกัน)', amount: c.rtPN, days: c.daysRT, field: 'daysRT' });
  const rows = items.map((it) => ({ ...it, interest: r2((it.amount * it.days * rate) / 365) }));
  return { rows, total: r2(rows.reduce((s, r) => s + r.interest, 0)), rate };
}

/**
 * ยอดของ "หนึ่งส่วน" — รับ / จ่าย / สุทธิ พร้อมรายละเอียดที่หน้าจอต้องใช้
 * @param amountById  Map|object  id ตั๋ว → จำนวนเงิน (สำหรับตั๋วที่ส่วนนี้จ่าย)
 * @param pnSold      รวม P/N ที่ขายของส่วน income ส่วนแรกเดือนนั้น
 */
export function sectionTotals(period, { amountById = {}, pnSold = 0 } = {}) {
  const get = (id) => (amountById instanceof Map ? num(amountById.get(id)) : num(amountById[id]));
  const paidIds = Array.isArray(period.paid_ids) ? period.paid_ids : [];
  const paidSum = paidIds.reduce((s, id) => s + get(id), 0);
  const extra = extraTotal(period);
  const type = period.period_type || 'mixed';
  if (type === 'income') {
    const c = incomeCalc(period);
    return { type, cashIn: c.totalPN + extra, cashOut: paidSum, net: c.totalPN + extra - paidSum,
      paidSum, extra, dedSum: 0, balance: 0, calc: c };
  }
  if (type === 'deduction') {
    const income = num(period.income);
    const rows = deductionRows(period, pnSold);
    const dedSum = rows.reduce((s, d) => s + num(d.amount), 0);
    return { type, cashIn: income + extra, cashOut: dedSum + paidSum, net: income + extra - dedSum - paidSum,
      paidSum, extra, dedSum, balance: income - dedSum, rows };
  }
  if (type === 'aval') {
    const av = num(period.aval_amount);
    return { type, cashIn: extra, cashOut: av, net: extra - av, paidSum, extra, dedSum: 0, balance: 0 };
  }
  return { type, cashIn: extra, cashOut: paidSum, net: extra - paidSum, paidSum, extra, dedSum: 0, balance: 0 };
}

/** ยอดรวมของโครงการหนึ่งในเดือนหนึ่ง = ผลบวกของแถบสรุปทุกส่วน */
export function projectTotals(periods, { amountById = {} } = {}) {
  const pnSold = pnSoldThisMonth(periods);
  let cashIn = 0; let cashOut = 0;
  for (const p of periods || []) {
    const s = sectionTotals(p, { amountById, pnSold });
    cashIn += s.cashIn; cashOut += s.cashOut;
  }
  return { cashIn, cashOut, net: cashIn - cashOut };
}

/**
 * รับเงิน / หักจ่าย / คงเหลือสุทธิ ของหน้าผลต่าง (planTotalsForPeriods ของเขา)
 *
 * คนละสูตรกับการ์ดโดยตั้งใจ ตามซอร์สของเขา:
 *   รับเงิน  = ผลรวม "ค่างานที่ส่ง" ของทุกส่วน income (ไม่ใช่ P/N ที่ขาย)
 *   หักจ่าย  = ห้าแถวหักของส่วน deduction + ตั๋วที่ส่วน deduction จ่าย + ยอด Aval
 *              โดย "หัก PN ขอเบิกใหม่" ใช้ผลรวม P/N ของ "ทุก" ส่วน income
 */
export function varianceTotals(periods, { amountById = {} } = {}) {
  const get = (id) => (amountById instanceof Map ? num(amountById.get(id)) : num(amountById[id]));
  const pnSold = pnSoldFrom(periods);
  let received = 0; let deducted = 0;
  for (const p of periods || []) {
    const type = p.period_type || 'mixed';
    if (type === 'income') {
      received += incomeCalc(p).work;
    } else if (type === 'deduction') {
      const income = num(p.income);
      const rows = (Array.isArray(p.deductions_json) && p.deductions_json.length)
        ? p.deductions_json : defaultDeductions();
      for (const d of rows) {
        const label = String(d.label || '');
        if (label.indexOf('TL') >= 0) deducted += r2(income * TL_RATE);
        else if (label.indexOf('ML') >= 0) deducted += r2(income * ML_RATE);
        else if (label.indexOf('ขอเบิกใหม่') >= 0) deducted += pnSold;
        else deducted += num(d.amount);
      }
      (Array.isArray(p.paid_ids) ? p.paid_ids : []).forEach((id) => { deducted += get(id); });
    } else if (type === 'aval') {
      deducted += num(p.aval_amount);
    }
  }
  return { received, deducted, net: received - deducted };
}

/**
 * สามส่วนที่ระบบจริงสร้างให้เมื่อ "เพิ่มโครงการ" เข้าแผน —
 * รับค่างาน+หักหนี้ · ขอเบิก P/N ค่างาน · ขอเบิก P/N Workdone
 * ลำดับตามชีต cashflow ที่ยื่นธนาคาร (รับ+หักก่อน แล้วค่อยวางแผนขาย P/N งวดถัดไป)
 */
export const NEW_PROJECT_SECTIONS = ['deduction', 'income', 'income'];
