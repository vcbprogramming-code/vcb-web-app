// Typed models mirroring the Google Apps Script server return shapes
// (api_bootstrap / api_siteMonth / api_adminSummary). The mock layer in mock.ts
// produces exactly these; a real backend (GAS /exec) must too.

export type Lang = 'th' | 'en'
export type Theme = 'light' | 'dark' | 'auto'
export type YearFmt = 'be' | 'ce'
export type CellNames = 'code' | 'name'
export type DashView = 'progress' | 'topact' | 'topcost'
export type EmpKind = 'support' | 'operation'
export type Mapping = 'one-to-one' | 'one-to-many'

export interface SiteRef { key: string; name: string }

// api_bootstrap
export interface Boot {
  ok: boolean
  email: string
  role: string
  isAdmin: boolean
  canEntry: boolean
  sites: SiteRef[]
}

// Master Work Index — Activity (ดัชนีงาน › กิจกรรม). Shape used both as the picker
// vocab (api_siteMonth.teams) and the index admin table.
export interface Activity {
  code: string
  name: string
  desc?: string
  category: string
  sites?: string
  mapping: Mapping
  fixed_cost?: string
}

// Master Work Index — Work Category (หมวดงาน, the 2nd layer / ERP cost codes).
export interface Category {
  id: number
  code: string
  name: string
  name_en: string
}

// api_siteMonth.costs — the picker's 2nd-step vocab.
export interface Cost { code: string; name: string }

export interface DayInfo { date: string; dow: number; weekend: boolean }

export interface Employee {
  eid: string
  name: string
  emp_id: string
  department: string
  position: string
  kind: EmpKind
  away: string[]
  movedIn: string
  movedInFrom: string
  movedOut: string
  movedOutTo: string
}

// One filled cell. Stored value is a composite code like "A-1 / 5".
// op cells use `team`, support cells use `detail`; `pm` is the optional 2nd task.
export interface CellValue { team?: string; detail?: string; pm?: string }
export type Entries = Record<string, Record<string, CellValue>>

export interface RetroEdit { ms: number; date: string; by: string }

// api_siteMonth
export interface SiteMonth {
  ok: boolean
  days: DayInfo[]
  employees: Employee[]
  entries: Entries
  teams: Activity[]
  costs: Cost[]
  today: string
  lockDays: number
  edits: Record<string, RetroEdit>
}

export interface TopItem { name: string; count: number; pct: number }
export interface DayFill { date: string; weekend: boolean; total: number; filled: number }

// api_adminSummary row (one per site)
export interface SiteSummary {
  site_key: string
  site_name: string
  company: string
  n_emp: number
  n_support: number
  n_operation: number
  support_started: number
  operation_started: number
  entries: number
  fillRate: number
  fillRateDenom: number
  daysFilled: DayFill[]
  topActivities: TopItem[]
  topCostCodes: TopItem[]
}

export interface AdminSummary {
  ok: boolean
  rows: SiteSummary[]
  today: string
  lockDays: number
}

export interface YMonth { y: number; m: number }
