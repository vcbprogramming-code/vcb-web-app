/**
 * แผนการเงิน (T-bar) — สูตรฝั่งหน้าจอ
 *
 * ฝาแฝดของ backend/src/services/creditTbar.js ที่นั่นคือฉบับจริงที่บันทึกลงฐาน
 * และสร้างไฟล์ Excel ที่นี่คิดซ้ำระหว่างพิมพ์เพื่อให้ตัวเลขขยับทันมือโดยไม่ต้อง
 * ถามเซิร์ฟเวอร์ทุกตัวอักษร — แก้สูตรที่ไฟล์ใดต้องแก้อีกไฟล์ด้วย และชุดทดสอบ
 * credit-tbar.mjs / credit-tbar.ui.mjs เทียบเลขสองฝั่งไว้ให้จับได้ถ้าหลุด
 *
 * กลไกโดยย่อ (ถอดจาก index.html ของระบบจริง: planIncomeCalc ·
 * renderPlanPeriodCard · planRefreshDeductionCells · planInterestBlock):
 *
 *   ส่วน income "ขอเบิก P/N"
 *     โหมด ค่างาน (work):  เพดาน 1 = ค่างาน × 80% · หัก segment = segment × 60%
 *       เหลือค่างวด = ค่างาน − 60% segment · ฐานที่ขายได้ = MIN(เพดาน 1, เหลือค่างวด)
 *       จะคงเหลือ P/N ที่ขายได้ = ฐาน − PN ที่ขายไว้ (เดือนก่อน)
 *       P/N RT = เงินประกัน × 80% · รวม P/N ที่ขาย = จะคงเหลือ + P/N RT
 *     โหมด Workdone (progress): รวม P/N ที่ขาย = ผลงานที่ทำได้ × 50%
 *
 *   ส่วน deduction "รับเงินค่างาน + หักหนี้"
 *     หัก TL = รับเงินค่างานสุทธิ × 15% (auto) · หัก ML = × 1.5% (auto)
 *     หัก PN = กรอกมือ (PN Work Done ของงวดก่อน)
 *     หัก PN ขอเบิกใหม่ = รวม P/N ที่ขายของส่วน income ส่วนแรกเดือนนี้ (auto)
 *     หัก Segment CVE = กรอกมือ · คงเหลือ = รับเงินค่างานสุทธิ − ผลรวมห้าแถว
 *
 *   ส่วน aval "ขอออก Aval จัดสรร": จ่าย = ยอด Aval
 *
 *   ดอกเบี้ย P/N ที่ต้องจ่าย = ยอด P/N × วัน × อัตราต่อปี ÷ 365 (แสดงอย่างเดียว
 *   ไม่ถูกบวกเข้ารวมจ่าย เหมือนระบบจริงของเขา)
 *
 * หมายเหตุชื่อคีย์: API ส่งห้าแถวหักมาในคีย์ `deductions` (ฝั่งฐานข้อมูลคือ
 * คอลัมน์ deductions_json) ที่นี่จึงอ่าน p.deductions ไม่ใช่ p.deductions_json
 */

export const MAX_PERIODS = 5;
export const DEFAULT_PN_RATE = 0.0635;
export const TL_RATE = 0.15;
export const ML_RATE = 0.015;

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

export const defaultIncome = (kind = 'work') => ({
  kind: kind === 'progress' ? 'progress' : 'work',
  work: 0, segment: 0, pnSold: 0, rt: 0, daysNew: 90, daysRT: 90,
});

export function incomeObj(period) {
  const o = period && period.income_break;
  if (o && !Array.isArray(o) && typeof o === 'object' && Object.keys(o).length) {
    return { ...defaultIncome(o.kind), ...o };
  }
  return defaultIncome();
}
export const incomeKind = (period) => (incomeObj(period).kind === 'progress' ? 'progress' : 'work');

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

const dedList = (p) => ((Array.isArray(p.deductions) && p.deductions.length) ? p.deductions : defaultDeductions());

/** รวม P/N ที่ขายของส่วน income "ส่วนแรก" — ตัวที่ป้อน "หัก PN ขอเบิกใหม่" */
export function pnSoldThisMonth(periods) {
  const inc = (periods || []).filter((p) => p.period_type === 'income')
    .slice().sort((a, b) => (a.period_idx || 0) - (b.period_idx || 0))[0];
  return inc ? incomeCalc(inc).totalPN : 0;
}
/** รวม P/N ที่ขายของ "ทุก" ส่วน income — เกณฑ์ของหน้าผลต่าง ตามซอร์สของเขา */
export function pnSoldFrom(periods) {
  return (periods || []).reduce((s, p) => s + (p.period_type === 'income' ? incomeCalc(p).totalPN : 0), 0);
}

/** ห้าแถวหักพร้อมยอดที่คำนวณแล้ว — auto = แก้มือไม่ได้ */
export function deductionRows(period, pnSold) {
  const income = num(period.income);
  return dedList(period).map((d) => {
    const label = String(d.label || '');
    if (label.indexOf('TL') >= 0) return { label, amount: r2(income * TL_RATE), auto: true };
    if (label.indexOf('ML') >= 0) return { label, amount: r2(income * ML_RATE), auto: true };
    if (label.indexOf('ขอเบิกใหม่') >= 0) return { label, amount: num(pnSold), auto: true };
    return { label, amount: num(d.amount), auto: false };
  });
}

export const extraTotal = (period) =>
  (Array.isArray(period.extra_rows) ? period.extra_rows : []).reduce((s, r) => s + num(r.amount), 0);

export function interestRows(period, rate = DEFAULT_PN_RATE) {
  if (period.period_type !== 'income') return { rows: [], total: 0, rate };
  const c = incomeCalc(period);
  const items = [];
  if (c.newPN > 0) items.push({ label: 'P/N ที่ขายได้', amount: c.newPN, days: c.daysNew, field: 'daysNew' });
  if (c.rtPN > 0) items.push({ label: 'P/N RT (เงินประกัน)', amount: c.rtPN, days: c.daysRT, field: 'daysRT' });
  const rows = items.map((it) => ({ ...it, interest: r2((it.amount * it.days * rate) / 365) }));
  return { rows, total: r2(rows.reduce((s, x) => s + x.interest, 0)), rate };
}

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

/** ยอดรวมของโครงการ = ผลบวกของแถบสรุปทุกส่วน (ดูหมายเหตุในไฟล์ฝั่ง backend) */
export function projectTotals(periods, { amountById = {} } = {}) {
  const pnSold = pnSoldThisMonth(periods);
  let cashIn = 0; let cashOut = 0;
  for (const p of periods || []) {
    const s = sectionTotals(p, { amountById, pnSold });
    cashIn += s.cashIn; cashOut += s.cashOut;
  }
  return { cashIn, cashOut, net: cashIn - cashOut };
}

// ── ป้ายและตัวเลือกบนหน้าจอ ────────────────────────────────────────────────

export const TYPE_LABEL = {
  income: 'ขอเบิก P/N',
  deduction: 'รับเงินค่างาน + หักหนี้',
  aval: 'ขอออก Aval จัดสรร',
  mixed: 'งวดผสม',
};

/** ป้ายหัวส่วน — ส่วน P/N บอกโหมดต่อท้าย (ค่างาน / Workdone) เหมือนของเขา */
export function sectionTitle(period) {
  if (period.period_type === 'income') {
    return `${TYPE_LABEL.income} ${incomeKind(period) === 'progress' ? 'Workdone' : 'ค่างาน'}`;
  }
  return TYPE_LABEL[period.period_type] || TYPE_LABEL.mixed;
}

/**
 * เลข "งวดที่" ที่เอาไปเติมในป้ายแถว — จากเลขที่ผู้ใช้พิมพ์ ถ้าไม่ได้พิมพ์ก็ใช้
 * ลำดับของส่วน income นั้น (planIncomeGuadNo ของเขา)
 */
export function guadNo(period, periods) {
  const typed = String(period.period_label || '').match(/\d+/);
  if (typed) return typed[0];
  const incomes = (periods || []).filter((p) => p.period_type === 'income')
    .slice().sort((a, b) => (a.period_idx || 0) - (b.period_idx || 0));
  const ord = incomes.findIndex((p) => p.id === period.id) + 1;
  return ord > 0 ? String(ord) : String(period.period_idx || '');
}

/** 13 เดือน: ย้อนหลัง 6 · เดือนนี้ · ล่วงหน้า 6 — ป้ายเป็น เดือน/พ.ศ. สองหลัก */
export function monthOptions(now = new Date()) {
  const out = [];
  for (let i = -6; i <= 6; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    out.push({ value: `${d.getFullYear()}-${mm}`, label: `${mm}/${String(d.getFullYear() + 543).slice(-2)}` });
  }
  return out;
}

export const thisMonth = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

export function prevMonthOf(month) {
  const [y, m] = String(month).split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** ตัวเลือกประเภทส่วนของปุ่ม "＋ เพิ่มส่วน" — คำอธิบายตาม planPickType ของเขา */
export const PERIOD_TYPE_CHOICES = [
  { value: 'income', label: 'ขอเบิก P/N', hint: 'เบิก P/N เข้าโครงการ จากค่างาน/เงินประกัน/ผลงานแล้วเสร็จ' },
  { value: 'deduction', label: 'รับเงินค่างาน + หักหนี้', hint: 'รับชำระค่างาน หักด้วย TL / ML / PN / Segment' },
  { value: 'aval', label: 'ขอออก Aval จัดสรร', hint: 'ออก Aval (B/E) จ่ายผู้ขาย/วัสดุ' },
];

/** ตั๋วที่ครบกำหนดในเดือนที่เลือก (planEligibleItems) */
export const dueThisMonth = (items, month) =>
  (items || []).filter((t) => String(t.due || '').slice(0, 7) === month);
