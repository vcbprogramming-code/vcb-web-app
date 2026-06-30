// Typed mirror of the Google Apps Script API contracts (Code.js / Seed.js).
// These shapes match exactly what getData()/getCashPlan() return and what the
// write functions accept, so the mock backend stays contract-faithful.

export interface ProjectSeed {
  code: string;
  th: string;
  company: string;
}

export interface FacTypeSeed {
  no: number;
  code: string;
  th: string;
  en: string;
  kind: string;
}

export interface FacilitySeed {
  project: string;
  facilityNo: number;
  type: string;
  limit: number;
  used: number;
  interest: string;
  notes: string;
}

export interface TxnSeed {
  project: string;
  facilityNo: number;
  kind: string;
  ref: string;
  desc: string;
  start: string;
  due: string;
  amount: number;
}

// ----- getData() output -----

export interface Me {
  email: string;
  isManager: boolean;
}

export interface FacilityOut {
  project: string;
  facilityNo: number;
  type: string;
  limit: number;
  used: number;
  available: number;
  usedOverridden: boolean;
  interest: string;
  notes: string;
}

export interface TransactionOut {
  id: string;
  date: string;
  project: string;
  facilityNo: number | string;
  kind: string;
  ref: string;
  desc: string;
  start: string;
  due: string;
  maturity: string;
  amount: number;
  status: string;
  by: string;
  requester: string;
  paidDate: string;
  note: string;
  purpose: string;
  beneficiary: string;
  source: string;
  costCategory: string;
  refDocFrom: string;
  refDocTo: string;
  docFrom: string;
  docTo: string;
  updated: string;
}

export interface RequestOut {
  id: string;
  date: string;
  project: string;
  company: string;
  facilityNo: number | string;
  amount: number;
  purpose: string;
  beneficiary: string;
  status: string;
  requester: string;
  decidedBy: string;
  decidedAt: string;
  note: string;
  maturity: string;
  linkedTxn: string;
  source: string;
  docFrom: string;
  docTo: string;
  updated: string;
}

export interface CategoryCapOut {
  project: string;
  costCategory: string;
  cap: number;
  note: string;
  updated: string;
}

export interface AppData {
  me: Me;
  projects: ProjectSeed[];
  facTypes: FacTypeSeed[];
  facilities: FacilityOut[];
  costCategories: string[];
  categoryCaps: CategoryCapOut[];
  transactions: TransactionOut[];
  requests: RequestOut[];
}

// ----- cash plan -----

export interface IncomeRow {
  label: string;
  workValue: number;
  pnAmount: number;
  pnDays?: number;
  sub?: number;
  subDate?: string;
}

export interface DeductionRow {
  label: string;
  amount: number;
}

export interface CashPlanPeriod {
  id: string;
  project: string;
  month: string;
  periodIdx: number;
  periodLabel: string;
  periodDate: string;
  periodType: string;
  income: number;
  workRef: string;
  paidIds: string[];
  deductions: DeductionRow[] | null;
  incomeBreak: IncomeRow[] | null;
  avalAmount: number;
  newPNAmount: number;
  newPNNote: string;
  note: string;
  showAllDue: boolean;
  updated: string;
}

// ----- write results -----

export interface WriteResult {
  ok: boolean;
  id?: string;
  error?: string;
  count?: number;
}

export interface ExportResult {
  name: string;
  b64: string;
}

// The server-side function surface the client calls via google.script.run.
export interface GasApi {
  getData(): AppData;
  whoAmI(): Me;
  getCashPlan(project: string, month: string): CashPlanPeriod[];
  saveCashPlanPeriod(p: Partial<CashPlanPeriod>): WriteResult;
  deleteCashPlanPeriod(p: { id: string }): WriteResult;
  addRequest(p: Record<string, unknown>): WriteResult;
  updateRequest(p: Record<string, unknown>): WriteResult;
  addTransaction(p: Record<string, unknown>): WriteResult;
  setTxnStatus(p: { id: string; status: string }): WriteResult;
  settleTxn(p: { id: string }): WriteResult;
  deleteRequest(p: { id: string }): WriteResult;
  deleteTxn(p: { id: string }): WriteResult;
  setLimit(p: { project: string; facilityNo: number | string; limit: number }): WriteResult;
  setUsedOverride(p: { project: string; facilityNo: number | string; used: number | string }): WriteResult;
  setCategoryCap(p: { project: string; costCategory: string; cap: number | string; note?: string }): WriteResult;
  setCostCategories(p: { list: string[] }): WriteResult;
  decideRequest(p: { id: string; decision: string }): WriteResult;
  exportXlsx(q: Record<string, unknown>): ExportResult;
}
