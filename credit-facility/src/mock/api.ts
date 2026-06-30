// Typed mock backend — a faithful re-implementation of the Google Apps Script
// server (Code.js). It keeps an in-memory store seeded from Seed.js, mirrors
// every getData()/write/cash-plan/export contract, and is the data layer the
// google.script.run shim dispatches to. Behaviour (facility merge, status
// rules, overrides, caps, cash-plan persistence) matches Code.js exactly.

import * as XLSX from 'xlsx';
import { SEED_PROJECTS, SEED_FAC_TYPES, SEED_FACILITIES, SEED_TXNS } from './seed';
import type {
  AppData, Me, CashPlanPeriod, WriteResult, ExportResult,
  TransactionOut, RequestOut, CategoryCapOut, FacilityOut,
} from '../types';

// ---- identity (Code.js whoAmI). A demo VCB identity so manager-only flows and
//      write attribution work in the mock. ----
const MANAGERS = ['c.chavananand@vcb-con.com'];
const ME_EMAIL = 'c.chavananand@vcb-con.com';
function whoAmI(): Me {
  return { email: ME_EMAIL, isManager: MANAGERS.indexOf(ME_EMAIL) !== -1 };
}

// ---- internal sheet-row shapes (mirror SHEET_HEADERS column names) ----
interface TxnRow {
  ID: string; Date: Date | string; Project: string; FacilityNo: number | string;
  Kind: string; Ref: string; Description: string; StartDate: string; DueDate: string;
  Amount: number; Status: string; By: string; PaidDate: Date | string; Note: string;
  Source: string; DocFrom: string; DocTo: string; Updated: Date | string;
  CostCategory: string; Purpose: string; Beneficiary: string; RefDocFrom: string; RefDocTo: string;
}
interface RequestRow {
  ID: string; Date: Date | string; Project: string; Company: string; FacilityNo: number | string;
  Amount: number; Purpose: string; Beneficiary: string; Status: string; Requester: string;
  DecidedBy: string; DecidedAt: Date | string; Note: string; Maturity: string;
  LinkedTxn: string; Source: string; DocFrom: string; DocTo: string; Updated: Date | string;
}
interface LimitRow { Project: string; FacilityNo: number | string; Limit: number | string; UsedOverride: number | string; }
interface CapRow { Project: string; CostCategory: string; Cap: number | string; Note: string; Updated: Date | string; }

// ---- in-memory store ----
const txnRows: TxnRow[] = SEED_TXNS.map((t, i) => emptyTxnRow({
  ID: 'SEED-' + (i + 1), Date: new Date(), Project: t.project, FacilityNo: t.facilityNo,
  Kind: t.kind, Ref: t.ref, Description: t.desc, StartDate: t.start, DueDate: t.due,
  Amount: t.amount, Status: 'active', By: 'seed',
}));
const requestRows: RequestRow[] = [];
const limitRows: LimitRow[] = [];
const capRows: CapRow[] = [];
let costCategories: string[] = [];
const cashPlan: CashPlanPeriod[] = [];

let _idSeq = 0;
function uid(prefix: string): string { _idSeq += 1; return prefix + '-' + Date.now() + '-' + _idSeq; }

function emptyTxnRow(o: Partial<TxnRow>): TxnRow {
  return {
    ID: '', Date: '', Project: '', FacilityNo: '', Kind: '', Ref: '', Description: '',
    StartDate: '', DueDate: '', Amount: 0, Status: '', By: '', PaidDate: '', Note: '',
    Source: '', DocFrom: '', DocTo: '', Updated: '', CostCategory: '', Purpose: '',
    Beneficiary: '', RefDocFrom: '', RefDocTo: '', ...o,
  };
}

// ---- helpers (Code.js fmt_/docKind_) ----
function fmt_(v: Date | string | number | null | undefined): string {
  if (v instanceof Date) {
    const dd = ('0' + v.getDate()).slice(-2);
    const mm = ('0' + (v.getMonth() + 1)).slice(-2);
    return dd + '/' + mm + '/' + v.getFullYear();
  }
  return v == null ? '' : String(v);
}
function todayDMY(): string { return fmt_(new Date()); }

function docKind_(facilityNo: number | string): string {
  const t = SEED_FAC_TYPES.filter((x) => String(x.no) === String(facilityNo))[0];
  if (!t) return '';
  const map: Record<string, string> = { LG: 'BG', LGM: 'L/G', TL: 'T/L', AVAL: 'B/E', PN: 'P/N' };
  return map[t.kind] || t.kind;
}
function isAuthorized_(s: unknown): boolean {
  const str = String(s);
  return str === 'อนุมัติแล้ว' || str.toLowerCase() === 'active';
}

// ---- read: getData (mirrors Code.js getData) ----
function getData(): AppData {
  const limitOv: Record<string, number> = {};
  const usedOv: Record<string, number> = {};
  limitRows.forEach((r) => {
    const k = r.Project + '|' + r.FacilityNo;
    if (r.Project && r.FacilityNo !== '' && r.Limit !== '' && r.Limit != null) limitOv[k] = Number(r.Limit) || 0;
    if (r.Project && r.FacilityNo !== '' && r.UsedOverride !== '' && r.UsedOverride != null) usedOv[k] = Number(r.UsedOverride) || 0;
  });

  const delta: Record<string, number> = {};
  const key = (p: unknown, n: unknown): string => p + '|' + n;
  txnRows.forEach((t) => {
    const k = key(t.Project, t.FacilityNo);
    const paid = String(t.Status) === 'ชำระแล้ว';
    if (String(t.By) === 'seed') {
      if (paid) delta[k] = (delta[k] || 0) - (Number(t.Amount) || 0);
      return;
    }
    if (!isAuthorized_(t.Status)) return;
    delta[k] = (delta[k] || 0) + (Number(t.Amount) || 0);
  });

  const facOut: FacilityOut[] = SEED_FACILITIES.map((f) => {
    const ovk = f.project + '|' + f.facilityNo;
    const lim = (ovk in limitOv) ? limitOv[ovk] : (Number(f.limit) || 0);
    const hasUsedOv = (ovk in usedOv);
    let u: number;
    if (hasUsedOv) {
      u = usedOv[ovk];
    } else {
      u = (Number(f.used) || 0) + (delta[key(f.project, f.facilityNo)] || 0);
      if (u < 0) u = 0;
    }
    return {
      project: f.project, facilityNo: f.facilityNo, type: f.type,
      limit: lim, used: u, available: lim - u, usedOverridden: hasUsedOv,
      interest: f.interest, notes: f.notes,
    };
  });

  const caps: CategoryCapOut[] = capRows.filter((r) => r.Project && r.CostCategory).map((r) => ({
    project: r.Project, costCategory: r.CostCategory, cap: Number(r.Cap) || 0,
    note: r.Note || '', updated: fmt_(r.Updated),
  }));

  const transactions: TransactionOut[] = txnRows.map((t) => ({
    id: t.ID, date: fmt_(t.Date), project: t.Project, facilityNo: t.FacilityNo,
    kind: t.Kind, ref: t.Ref, desc: t.Description,
    start: fmt_(t.StartDate), due: fmt_(t.DueDate), maturity: fmt_(t.DueDate),
    amount: Number(t.Amount) || 0, status: t.Status, by: t.By,
    requester: t.By, paidDate: fmt_(t.PaidDate), note: t.Note || '',
    purpose: t.Purpose || t.Description || '',
    beneficiary: t.Beneficiary || '',
    source: t.Source || '',
    costCategory: t.CostCategory || '',
    refDocFrom: fmt_(t.RefDocFrom), refDocTo: fmt_(t.RefDocTo),
    docFrom: fmt_(t.DocFrom), docTo: fmt_(t.DocTo), updated: fmt_(t.Updated),
  }));

  const requests: RequestOut[] = requestRows.map((r) => ({
    id: r.ID, date: fmt_(r.Date), project: r.Project, company: r.Company,
    facilityNo: r.FacilityNo, amount: Number(r.Amount) || 0,
    purpose: r.Purpose, beneficiary: r.Beneficiary, status: r.Status,
    requester: r.Requester, decidedBy: r.DecidedBy, decidedAt: fmt_(r.DecidedAt),
    note: r.Note, maturity: fmt_(r.Maturity), linkedTxn: r.LinkedTxn || '',
    source: r.Source || '', docFrom: fmt_(r.DocFrom), docTo: fmt_(r.DocTo), updated: fmt_(r.Updated),
  }));

  return {
    me: whoAmI(),
    projects: SEED_PROJECTS,
    facTypes: SEED_FAC_TYPES,
    facilities: facOut,
    costCategories: costCategories.slice(),
    categoryCaps: caps,
    transactions,
    requests,
  };
}

// ---- write helpers ----
function insertTxn(t: Record<string, unknown>): string {
  const id = (t.id as string) || uid('TXN');
  txnRows.push(emptyTxnRow({
    ID: id, Date: new Date(), Project: String(t.project ?? ''), FacilityNo: (t.facilityNo as number | string) ?? '',
    Kind: String(t.kind ?? ''), Ref: String(t.ref ?? ''), Description: String(t.desc ?? ''),
    StartDate: String(t.start ?? ''), DueDate: String(t.due ?? ''), Amount: Number(t.amount) || 0,
    Status: String(t.status ?? 'อนุมัติแล้ว'), By: String(t.by ?? ''), Note: String(t.note ?? ''),
    Source: String(t.source ?? ''), DocFrom: String(t.docFrom ?? ''), DocTo: String(t.docTo ?? ''),
    CostCategory: String(t.costCategory ?? ''), Purpose: String(t.purpose ?? ''),
    Beneficiary: String(t.beneficiary ?? ''), RefDocFrom: String(t.refDocFrom ?? ''),
    RefDocTo: String(t.refDocTo ?? ''), Updated: new Date(),
  }));
  return id;
}

function addRequest(p: Record<string, unknown>): WriteResult {
  const me = whoAmI();
  const id = insertTxn({
    project: p.project, facilityNo: p.facilityNo, kind: docKind_(p.facilityNo as number | string),
    ref: p.ref || '',
    desc: (p.purpose || p.note || '') + (p.beneficiary ? ' | ' + p.beneficiary : ''),
    start: p.start || todayDMY(),
    due: p.maturity || '', amount: Number(p.amount) || 0,
    status: p.status || 'คำขอใหม่', by: me.email || (p.requester || ''),
    note: p.note || '', source: p.source || '', docFrom: p.docFrom || '', docTo: p.docTo || '',
    costCategory: p.costCategory || '',
  });
  return { ok: true, id };
}

function updateRequest(p: Record<string, unknown>): WriteResult {
  const row = txnRows.filter((r) => r.ID === p.id)[0];
  if (!row) return { ok: false, error: 'ไม่พบรายการ' };
  row.Project = String(p.project ?? '');
  row.FacilityNo = (p.facilityNo as number | string) ?? '';
  row.Kind = docKind_(p.facilityNo as number | string);
  row.Amount = Number(p.amount) || 0;
  if (p.ref !== undefined) row.Ref = String(p.ref || '');
  row.Description = String(p.purpose || p.note || '');
  row.Note = String(p.note || '');
  row.DueDate = String(p.maturity || '');
  if (p.start) row.StartDate = String(p.start);
  row.Source = String(p.source || '');
  row.DocFrom = String(p.docFrom || '');
  row.DocTo = String(p.docTo || '');
  if (p.costCategory !== undefined) row.CostCategory = String(p.costCategory || '');
  if (p.purpose !== undefined) row.Purpose = String(p.purpose || '');
  if (p.beneficiary !== undefined) row.Beneficiary = String(p.beneficiary || '');
  if (p.refDocFrom !== undefined) row.RefDocFrom = String(p.refDocFrom || '');
  if (p.refDocTo !== undefined) row.RefDocTo = String(p.refDocTo || '');
  row.Status = String(p.status || 'คำขอใหม่');
  row.Updated = new Date();
  return { ok: true };
}

function addTransaction(p: Record<string, unknown>): WriteResult {
  const me = whoAmI();
  const id = insertTxn({
    project: p.project, facilityNo: p.facilityNo,
    kind: p.kind || docKind_(p.facilityNo as number | string), ref: p.ref,
    desc: p.desc, start: p.start, due: p.due, amount: p.amount,
    status: 'อนุมัติแล้ว', by: me.email || '', note: p.note,
  });
  return { ok: true, id };
}

function setTxnStatus(p: { id: string; status: string }): WriteResult {
  const row = txnRows.filter((r) => r.ID === p.id)[0];
  if (!row) return { ok: false, error: 'ไม่พบรายการ' };
  row.Status = p.status;
  row.Updated = new Date();
  return { ok: true };
}

function settleTxn(p: { id: string }): WriteResult {
  const row = txnRows.filter((r) => r.ID === p.id)[0];
  if (!row) return { ok: false, error: 'ไม่พบรายการ' };
  if (String(row.Status) === 'ชำระแล้ว') return { ok: false, error: 'รายการนี้ชำระแล้ว' };
  if ((Number(row.Amount) || 0) <= 0) return { ok: false, error: 'รายการนี้ไม่ใช่ยอดค้างชำระ' };
  row.Status = 'ชำระแล้ว';
  row.PaidDate = new Date();
  return { ok: true };
}

function deleteRequest(p: { id: string }): WriteResult {
  const idx = txnRows.findIndex((r) => r.ID === p.id);
  if (idx < 0) return { ok: false, error: 'ไม่พบรายการ' };
  txnRows.splice(idx, 1);
  return { ok: true };
}

function setUsedOverride(p: { project: string; facilityNo: number | string; used: number | string }): WriteResult {
  const raw = p && p.used;
  const hasVal = !(raw === '' || raw === null || raw === undefined) && !isNaN(Number(raw));
  const newU: number | string = hasVal ? Number(raw) : '';
  const row = limitRows.filter((r) => String(r.Project) === String(p.project) && String(r.FacilityNo) === String(p.facilityNo))[0];
  if (row) { row.UsedOverride = newU; return { ok: true }; }
  limitRows.push({ Project: p.project, FacilityNo: p.facilityNo, Limit: '', UsedOverride: newU });
  return { ok: true };
}

function setLimit(p: { project: string; facilityNo: number | string; limit: number }): WriteResult {
  const newLim = Number(p.limit) || 0;
  const row = limitRows.filter((r) => String(r.Project) === String(p.project) && String(r.FacilityNo) === String(p.facilityNo))[0];
  if (row) { row.Limit = newLim; return { ok: true }; }
  limitRows.push({ Project: p.project, FacilityNo: p.facilityNo, Limit: newLim, UsedOverride: '' });
  return { ok: true };
}

function setCategoryCap(p: { project: string; costCategory: string; cap: number | string; note?: string }): WriteResult {
  if (!p || !p.project || !p.costCategory) return { ok: false, error: 'project / costCategory ที่ส่งมาว่างเปล่า' };
  const raw = p.cap;
  const hasVal = !(raw === '' || raw === null || raw === undefined) && !isNaN(Number(raw));
  const newCap: number | string = hasVal ? Number(raw) : '';
  const row = capRows.filter((r) => String(r.Project) === String(p.project) && String(r.CostCategory) === String(p.costCategory))[0];
  if (row) {
    row.Cap = newCap;
    if (p.note !== undefined) row.Note = p.note || '';
    row.Updated = new Date();
    return { ok: true };
  }
  if (!hasVal) return { ok: true };
  capRows.push({ Project: p.project, CostCategory: p.costCategory, Cap: newCap, Note: p.note || '', Updated: new Date() });
  return { ok: true };
}

function setCostCategories(p: { list: string[] }): WriteResult {
  const list = (p && Array.isArray(p.list)) ? p.list : [];
  const seen: Record<string, number> = {};
  const clean: string[] = [];
  list.forEach((raw) => {
    const s = String(raw || '').trim();
    if (!s || seen[s]) return;
    seen[s] = 1;
    clean.push(s);
  });
  costCategories = clean;
  return { ok: true, count: clean.length };
}

function decideRequest(p: { id: string; decision: string }): WriteResult {
  const me = whoAmI();
  if (!me.isManager) return { ok: false, error: 'เฉพาะผู้บริหารเท่านั้นที่อนุมัติได้' };
  const row = requestRows.filter((r) => r.ID === p.id)[0];
  if (!row) return { ok: false, error: 'ไม่พบรายการ' };
  const cur = String(row.Status);
  if (cur === 'อนุมัติ' || cur === 'ไม่อนุมัติ') return { ok: false, error: 'รายการนี้ถูกตัดสินแล้ว' };
  row.Status = p.decision;
  row.DecidedBy = me.email;
  row.DecidedAt = new Date();
  if (p.decision === 'อนุมัติ' && !String(row.LinkedTxn || '')) {
    const ben = String(row.Beneficiary || '');
    const txnId = insertTxn({
      project: row.Project, facilityNo: row.FacilityNo, kind: docKind_(row.FacilityNo),
      ref: p.id, desc: String(row.Purpose || '') + (ben ? ' — ' + ben : ''),
      start: todayDMY(), due: fmt_(row.Maturity), amount: Number(row.Amount) || 0,
      status: 'active', by: 'request:' + p.id,
    });
    row.LinkedTxn = txnId;
  }
  return { ok: true };
}

// ---- cash plan ----
function getCashPlan(project: string, month: string): CashPlanPeriod[] {
  return cashPlan
    .filter((r) => (!project || r.project === project) && (!month || r.month === month))
    .map((r) => ({ ...r }))
    .sort((a, b) => a.periodIdx - b.periodIdx);
}

function saveCashPlanPeriod(p: Partial<CashPlanPeriod>): WriteResult {
  const fields: CashPlanPeriod = {
    id: p.id || uid('PL'),
    project: p.project || '', month: p.month || '', periodIdx: Number(p.periodIdx) || 0,
    periodLabel: p.periodLabel || '', periodDate: p.periodDate || '',
    periodType: p.periodType || 'mixed', income: Number(p.income) || 0, workRef: p.workRef || '',
    paidIds: p.paidIds || [], deductions: p.deductions || [], incomeBreak: p.incomeBreak || [],
    avalAmount: Number(p.avalAmount) || 0, newPNAmount: Number(p.newPNAmount) || 0,
    newPNNote: p.newPNNote || '', note: p.note || '',
    showAllDue: !!p.showAllDue, updated: fmt_(new Date()),
  };
  if (p.id) {
    const idx = cashPlan.findIndex((r) => r.id === p.id);
    if (idx >= 0) { cashPlan[idx] = fields; return { ok: true, id: p.id }; }
  }
  cashPlan.push(fields);
  return { ok: true, id: fields.id };
}

function deleteCashPlanPeriod(p: { id: string }): WriteResult {
  const idx = cashPlan.findIndex((r) => r.id === p.id);
  if (idx < 0) return { ok: false, error: 'ไม่พบรายการ' };
  cashPlan.splice(idx, 1);
  return { ok: true };
}

// ---- Excel export (mirrors Code.js exportXlsx: 2 sheets, same columns/filters) ----
function projCompany_(D: AppData, code: string): string {
  const p = D.projects.filter((x) => x.code === code)[0];
  if (!p) return '';
  const m = String(p.th || '').match(/\(([^)]+)\)/);
  return (m ? m[1].trim() : 'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด')
    .replace(/^บริษัท\s*/, '').replace(/\s*จำกัด\s*$/, '').trim();
}
function facTypeName_(D: AppData, no: number | string): string {
  const t = D.facTypes.filter((x) => String(x.no) === String(no))[0];
  return t ? t.th : ('#' + no);
}
function parseDue_(s: string): Date | null {
  if (s == null || s === '') return null;
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}
function overdueInterestVal_(D: AppData, t: TransactionOut): number | string {
  const s = String(t.status);
  if (!(s === 'อนุมัติแล้ว' || s.toLowerCase() === 'active')) return '';
  const amt = Number(t.amount) || 0;
  if (amt <= 0) return '';
  const d = parseDue_(t.due); if (!d) return '';
  const n = new Date(), t0 = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  const days = Math.floor((t0.getTime() - d.getTime()) / 864e5);
  if (days <= 0) return '';
  const f = D.facilities.filter((x) => x.project === t.project && String(x.facilityNo) === String(t.facilityNo))[0];
  const m = f && f.interest ? String(f.interest).match(/(\d+(?:\.\d+)?)\s*%/) : null;
  if (!m) return 'ระบุอัตราไม่ได้';
  return amt * parseFloat(m[1]) / 100 * days / 365;
}
function dueBucket_(s: string): string {
  const d = parseDue_(s); if (!d) return '';
  const n = new Date(), tY = n.getFullYear(), tM = n.getMonth();
  const dY = d.getFullYear(), dM = d.getMonth();
  if (dY < tY || (dY === tY && dM < tM) ||
    (dY === tY && dM === tM && d < new Date(tY, tM, n.getDate()))) return 'overdue';
  if (dY === tY && dM === tM) return 'this';
  const nx = new Date(tY, tM + 1, 1);
  if (dY === nx.getFullYear() && dM === nx.getMonth()) return 'next';
  return 'later';
}
function isDueWithin7_(s: string): boolean {
  const d = parseDue_(s); if (!d) return false;
  const n = new Date();
  const t0 = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  const t7 = new Date(t0.getTime() + 7 * 86400000);
  return d >= t0 && d <= t7;
}

function exportXlsx(q: Record<string, unknown>): ExportResult {
  q = q || {};
  const qq = String(q.qq || '').toLowerCase();
  const inc = (s: unknown): boolean => !qq || String(s || '').toLowerCase().indexOf(qq) >= 0;
  const D = getData();
  const wb = XLSX.utils.book_new();

  const facAoa: (string | number)[][] = [['โครงการ', 'บริษัท', 'ประเภท', 'วงเงิน', 'ใช้ไป', 'คงเหลือ', '% ใช้ไป']];
  D.facilities.filter((x) =>
    (!q.p || x.project === q.p) && (!q.t || String(x.facilityNo) === String(q.t)) &&
    inc(facTypeName_(D, x.facilityNo) + x.project),
  ).forEach((x) => {
    const pct = x.limit > 0 ? Math.min(100, Math.round(x.used / x.limit * 100)) : 0;
    facAoa.push([x.project, projCompany_(D, x.project), docKind_(x.facilityNo), x.limit, x.used, x.available, pct + '%']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(facAoa), 'วงเงินสินเชื่อ');

  const txnAoa: (string | number)[][] = [['วันที่', 'บริษัท', 'โครงการ', 'ประเภท', 'รายละเอียด', 'จำนวนเงิน',
    'เริ่ม', 'ครบ', 'ดอกเบี้ยเกินกำหนด', 'สถานะ', 'เอกสารแนบ']];
  D.transactions.filter((x) =>
    (!q.p || x.project === q.p) && (!q.t || String(x.facilityNo) === String(q.t)) &&
    (!q.s || x.status === q.s) &&
    (!q.d || (q.d === '7d' ? isDueWithin7_(x.due) : dueBucket_(x.due) === q.d)) &&
    inc((x.ref || '') + (x.desc || '') + (x.kind || '') + (x.source || '')),
  ).forEach((x) => {
    const att = (x.source || '') + (x.docFrom ? ((x.source ? ' | ' : '') + x.docFrom + (x.docTo ? '–' + x.docTo : '')) : '');
    txnAoa.push([x.date, projCompany_(D, x.project), x.project, docKind_(x.facilityNo),
      x.desc, x.amount, x.start, x.due, overdueInterestVal_(D, x), x.status, att || '-']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(txnAoa), 'รายการสินเชื่อ');

  const b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' }) as string;
  const n = new Date();
  const stamp = n.getFullYear() + ('0' + (n.getMonth() + 1)).slice(-2) + ('0' + n.getDate()).slice(-2)
    + '_' + ('0' + n.getHours()).slice(-2) + ('0' + n.getMinutes()).slice(-2);
  return { name: 'CreditFacility_' + stamp + '.xlsx', b64 };
}

// ---- the dispatch surface (matches GasApi / google.script.run methods) ----
export const mockApi = {
  getData, whoAmI, getCashPlan, saveCashPlanPeriod, deleteCashPlanPeriod,
  addRequest, updateRequest, addTransaction, setTxnStatus, settleTxn,
  deleteRequest, deleteTxn: deleteRequest, setLimit, setUsedOverride,
  setCategoryCap, setCostCategories, decideRequest, exportXlsx,
};

export type MockApi = typeof mockApi;
