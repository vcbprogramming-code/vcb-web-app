// Typed mock data layer — mirrors the Google Apps Script server API shapes
// (api_bootstrap / api_adminSummary / api_siteMonth) so the React UI renders like
// the live app with deterministic sample data. Swap this module for real /exec
// fetch calls (same return types) to make the app fully functional.
import type {
  Activity, Category, Boot, Employee, DayInfo, Entries, CellValue,
  SiteMonth, AdminSummary, SiteSummary, TopItem, DayFill,
  LeaveRequest, LeaveType, LeaveTypeCode, LeaveRosterEntry, DecidedLeaveResult,
  SiteAdminRow,
} from './types'

export interface SiteMeta { key: string; name: string; company: string }

export const SITE_COLORS: Record<string, { c: string; tint: string }> = {
  bangtoei: { c: '#0d9488', tint: '#e6f5f3' },
  bangwua: { c: '#e76f51', tint: '#fdeee7' },
  phutthamonthon: { c: '#2563eb', tint: '#e6edfd' },
  sai5: { c: '#d97706', tint: '#fdefdb' },
  suphanburi: { c: '#7c3aed', tint: '#efe7fd' },
}
export function siteAccent(key: string | null): { c: string; tint: string } {
  return (key && SITE_COLORS[key]) || { c: '#1d4e89', tint: '#e6effb' }
}

export const SITES: SiteMeta[] = [
  { key: 'bangtoei', name: 'โครงการบางเตย-บ้านพร้าว', company: 'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด' },
  { key: 'bangwua', name: 'โครงการบางวัว', company: 'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด' },
  { key: 'phutthamonthon', name: 'โครงการพุทธมณฑล', company: 'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด' },
  { key: 'sai5', name: 'ศูนย์ซ่อมฯ สาย 5', company: 'บริษัท ชนา เอ็นจิเนียริ่ง จำกัด' },
  { key: 'suphanburi', name: 'โรงงานสุพรรณบุรี', company: 'บริษัท ชนา เอ็นจิเนียริ่ง จำกัด' },
]

// The curated VCB work index — extracted VERBATIM from VCB_WORK_TYPES in
// Code.gs (sourced from HR_Work_Type_Index_v27.xlsx). Every entry has a code;
// the live app treats a codeless index row as legacy clutter and drops it.
// Re-extract on sync rather than hand-editing.
export const ACTIVITIES: Activity[] = [
  { code: 'A-1', name: 'งานผูก-ตัด-ดัดเหล็ก', category: 'A · งานก่อสร้างและติดตั้ง', mapping: 'one-to-many', desc: 'Rebar Works' },
  { code: 'A-2', name: 'งานเทคอนกรีต', category: 'A · งานก่อสร้างและติดตั้ง', mapping: 'one-to-many', desc: 'Concrete Pouring' },
  { code: 'A-3', name: 'งานประกอบ / ถอดแบบหล่อ', category: 'A · งานก่อสร้างและติดตั้ง', mapping: 'one-to-many', desc: 'Formwork Assembly & Stripping' },
  { code: 'A-4', name: 'ปฏิบัติงานชุด Launching Gantry (LG)', category: 'A · งานก่อสร้างและติดตั้ง', mapping: 'one-to-many', desc: 'Launching Gantry Crew Operation' },
  { code: 'A-5', name: 'งานรื้อถอน / ทุบทำลาย', category: 'A · งานก่อสร้างและติดตั้ง', mapping: 'one-to-many', desc: 'Demolition Works' },
  { code: 'A-6', name: 'งานขุดดิน / ถมดิน', category: 'A · งานก่อสร้างและติดตั้ง', mapping: 'one-to-many', desc: 'Excavation & Earthfill' },
  { code: 'A-7', name: 'งานบดอัด / ปูพื้นทาง', category: 'A · งานก่อสร้างและติดตั้ง', mapping: 'one-to-many', desc: 'Compaction & Paving' },
  { code: 'A-8', name: 'งานติดตั้งท่อ / ระบบระบายน้ำ', category: 'A · งานก่อสร้างและติดตั้ง', mapping: 'one-to-many', desc: 'Pipe & Drainage System Installation' },
  { code: 'A-9', name: 'งานติดตั้งป้าย / ตีเส้นจราจร', category: 'A · งานก่อสร้างและติดตั้ง', mapping: 'one-to-many', desc: 'Traffic Sign & Road Marking Works' },
  { code: 'A-10', name: 'งานสำรวจ (กลางวัน)', category: 'A · งานก่อสร้างและติดตั้ง', mapping: 'one-to-many', desc: 'Survey – Day Shift' },
  { code: 'A-11', name: 'งานสำรวจ (กลางคืน)', category: 'A · งานก่อสร้างและติดตั้ง', mapping: 'one-to-many', desc: 'Survey – Night Shift' },
  { code: 'A-12', name: 'งานช่างเชื่อมหน้างาน (กลางวัน)', category: 'A · งานก่อสร้างและติดตั้ง', mapping: 'one-to-many', desc: 'Site Welding – Day Shift' },
  { code: 'A-13', name: 'งานช่างเชื่อมหน้างาน (กลางคืน)', category: 'A · งานก่อสร้างและติดตั้ง', mapping: 'one-to-many', desc: 'Site Welding – Night Shift' },
  { code: 'A-14', name: 'งานช่างไฟฟ้าหน้างาน', category: 'A · งานก่อสร้างและติดตั้ง', mapping: 'one-to-many', desc: 'Site Electrical Works' },
  { code: 'B-1', name: 'งานผลิต Segment (แท่นผลิต)', category: 'B · งานหล่อและผลิต Segment', mapping: 'one-to-one', fixed_cost: '7', desc: 'Segment Production – Casting Bed' },
  { code: 'B-2', name: 'งานดึงลวดอัดแรง (Pre-Tensioning)', category: 'B · งานหล่อและผลิต Segment', mapping: 'one-to-one', fixed_cost: '7', desc: 'Pre-Tensioning – Strand Stressing' },
  { code: 'B-3', name: 'งานถอดแบบ Segment', category: 'B · งานหล่อและผลิต Segment', mapping: 'one-to-one', fixed_cost: '7', desc: 'Segment Formwork Stripping' },
  { code: 'B-4', name: 'งาน QC / LAB คอนกรีต', category: 'B · งานหล่อและผลิต Segment', mapping: 'one-to-one', fixed_cost: '7', desc: 'Concrete QC & Laboratory Testing' },
  { code: 'B-5', name: 'งาน Gantry Crane (โรงงาน)', category: 'B · งานหล่อและผลิต Segment', mapping: 'one-to-one', fixed_cost: '7', desc: 'Gantry Crane – Factory' },
  { code: 'B-6', name: 'งาน Shuttle Lift (โรงงาน)', category: 'B · งานหล่อและผลิต Segment', mapping: 'one-to-one', fixed_cost: '7', desc: 'Shuttle Lift – Factory' },
  { code: 'C-1', name: 'ขับรถขุด', category: 'C · งานเครื่องจักรและยานพาหนะ', mapping: 'one-to-many', desc: 'Excavator Operation' },
  { code: 'C-2', name: 'ขับรถตัก / แทร็คเตอร์', category: 'C · งานเครื่องจักรและยานพาหนะ', mapping: 'one-to-many', desc: 'Wheel Loader / Tractor Operation' },
  { code: 'C-3', name: 'ขับรถบดสั่นสะเทือน / เกรดเดอร์', category: 'C · งานเครื่องจักรและยานพาหนะ', mapping: 'one-to-many', desc: 'Compactor / Grader Operation' },
  { code: 'C-4', name: 'ขับรถบรรทุก 10 ล้อ / Dump Truck', category: 'C · งานเครื่องจักรและยานพาหนะ', mapping: 'one-to-many', desc: 'Dump Truck Operation' },
  { code: 'C-5', name: 'ขับรถเฮี๊ยบ / เครน', category: 'C · งานเครื่องจักรและยานพาหนะ', mapping: 'one-to-many', desc: 'Boom Truck / Crane Operation' },
  { code: 'C-6', name: 'ขับรถบรรทุกน้ำ', category: 'C · งานเครื่องจักรและยานพาหนะ', mapping: 'one-to-many', desc: 'Water Truck Operation' },
  { code: 'C-7', name: 'ขับรถเทรลเลอร์', category: 'C · งานเครื่องจักรและยานพาหนะ', mapping: 'one-to-many', desc: 'Trailer Truck Operation' },
  { code: 'C-8', name: 'ขับรถบริการ / รับ-ส่งพนักงาน', category: 'C · งานเครื่องจักรและยานพาหนะ', mapping: 'one-to-many', desc: 'Service Vehicle Driver' },
  { code: 'C-9', name: 'เติมน้ำมัน / ออยเลอร์เครื่องจักร', category: 'C · งานเครื่องจักรและยานพาหนะ', mapping: 'one-to-many', desc: 'Fuel & Lubricant Service (Oiler)' },
  { code: 'D-1', name: 'ตรวจเช็ค / ซ่อมแซมเครื่องจักร', category: 'D · งานซ่อมบำรุง', mapping: 'one-to-one', fixed_cost: '18', desc: 'Equipment Inspection & Repair' },
  { code: 'D-2', name: 'ซ่อมบำรุงระบบไฟฟ้าเครื่องจักร', category: 'D · งานซ่อมบำรุง', mapping: 'one-to-one', fixed_cost: '18', desc: 'Equipment Electrical Repair' },
  { code: 'D-3', name: 'งานเชื่อมซ่อม (โรงซ่อม)', category: 'D · งานซ่อมบำรุง', mapping: 'one-to-one', fixed_cost: '18', desc: 'Welding & Fabrication – Workshop' },
  { code: 'D-4', name: 'งานปะยาง / เปลี่ยนยาง', category: 'D · งานซ่อมบำรุง', mapping: 'one-to-one', fixed_cost: '18', desc: 'Tyre Repair & Replacement' },
  { code: 'D-5', name: 'ซ่อมบำรุงแบบหล่อ Segment', category: 'D · งานซ่อมบำรุง', mapping: 'one-to-one', fixed_cost: '18', desc: 'Segment Formwork Repair' },
  { code: 'D-6', name: 'งานติดตั้ง / รื้อแพล้นท์คอนกรีต', category: 'D · งานซ่อมบำรุง', mapping: 'one-to-one', fixed_cost: '18', desc: 'Concrete Plant Setup / Dismantling' },
  { code: 'E-1', name: 'งาน Safety (กลางวัน)', category: 'E · งานความปลอดภัยและสนับสนุน', mapping: 'one-to-one', fixed_cost: '8', desc: 'Site Safety – Day Shift' },
  { code: 'E-2', name: 'งาน Safety (กลางคืน)', category: 'E · งานความปลอดภัยและสนับสนุน', mapping: 'one-to-one', fixed_cost: '8', desc: 'Site Safety – Night Shift' },
  { code: 'E-3', name: 'งาน จป.วิชาชีพ / HSE', category: 'E · งานความปลอดภัยและสนับสนุน', mapping: 'one-to-one', fixed_cost: '8', desc: 'Professional Safety Officer (HSE)' },
  { code: 'E-4', name: 'งานสำนักงาน DOH / ประสานงานราชการ', category: 'E · งานความปลอดภัยและสนับสนุน', mapping: 'one-to-one', fixed_cost: '8', desc: 'DOH Office / Government Liaison' },
  { code: 'E-5', name: 'งานธุรการ / สำนักงาน / จัดซื้อ', category: 'E · งานความปลอดภัยและสนับสนุน', mapping: 'one-to-one', fixed_cost: '8', desc: 'Administration / Office / Purchasing' },
  { code: 'E-6', name: 'งานทรัพย์สินและควบคุมคลังพัสดุ', category: 'E · งานความปลอดภัยและสนับสนุน', mapping: 'one-to-one', fixed_cost: '8', desc: 'Asset Management & Inventory Control' },
  { code: 'Z-1', name: 'Standby', category: 'Z · ไม่ปฏิบัติงาน', mapping: 'one-to-one', desc: 'Standby' },
  { code: 'Z-2', name: 'ลา', category: 'Z · ไม่ปฏิบัติงาน', mapping: 'one-to-one', desc: 'Leave' },
  { code: 'Z-3', name: 'ลาออก', category: 'Z · ไม่ปฏิบัติงาน', mapping: 'one-to-one', desc: 'Resignation' },
]

export const CATEGORIES: Category[] = [
  { id: 1, code: '1', name: 'ค่าบริหารโครงการ', name_en: 'Project Administration' },
  { id: 2, code: '4', name: 'ความปลอดภัย', name_en: 'Safety & Security' },
  { id: 3, code: '5', name: 'งานสำนักงานทั่วไป', name_en: 'General Office Work' },
  { id: 4, code: '6', name: 'งานสำรวจ', name_en: 'Survey Works' },
  { id: 5, code: '7', name: 'งานดิน / ปรับพื้นที่', name_en: 'Earthworks' },
  { id: 6, code: '8', name: 'เครื่องจักรหนัก', name_en: 'Heavy Equipment' },
  { id: 7, code: '9', name: 'งานขนส่ง', name_en: 'Transportation' },
  { id: 8, code: '10', name: 'งานคอนกรีต', name_en: 'Concrete Works' },
  { id: 9, code: '11', name: 'งานผิวทาง', name_en: 'Pavement Works' },
  { id: 10, code: '12', name: 'งานระบบระบายน้ำ', name_en: 'Drainage Works' },
  { id: 11, code: '15', name: 'งานซ่อมบำรุง', name_en: 'Maintenance' },
  { id: 12, code: '20', name: 'ไม่ปฏิบัติงาน / ลา', name_en: 'Non-working / Leave' },
]

// ---- deterministic pseudo-random so the sample data is stable across reloads ----
function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TH_FIRST = ['สมชาย', 'สมหญิง', 'ประเสริฐ', 'วิชัย', 'สุนทร', 'อนงค์', 'ปรีชา', 'มานพ',
  'สุภาพร', 'ธนากร', 'กิตติ', 'นภา', 'วีระ', 'จันทรา', 'พงษ์ศักดิ์', 'ศิริพร', 'อนุชา', 'รัตนา',
  'ชัยวัฒน์', 'พิมพ์ใจ', 'ทองดี', 'บุญมี', 'สมพงษ์', 'อรุณ']
const TH_LAST = ['ใจดี', 'รักงาน', 'มั่นคง', 'ศรีสุข', 'พงษ์พันธ์', 'แก้วมณี', 'ทองคำ', 'บุญเรือง',
  'สุขสันต์', 'วงศ์ใหญ่', 'จันทร์เพ็ญ', 'พูลสวัสดิ์', 'เกษมสุข', 'ดวงดี', 'ภักดี', 'อยู่เย็น']
const DEPARTMENTS = ['ธุรการ', 'พัสดุ', 'วิศวกร', 'โฟร์แมน', 'Safety', 'สำรวจ', 'ช่างเครื่อง', 'พนักงานขับรถ']
const POSITIONS = ['หัวหน้า', 'เจ้าหน้าที่', 'พนักงาน', 'ผู้ช่วย']
const SUP_DETAILS = [
  'ทำความสะอาดสำนักงาน/ทำความสะอาดห้องพักวิศวกร/ซัก-รีด',
  'จัดทำเอกสารเบิกจ่าย / บันทึกเข้าระบบ ERP',
  'รับ-ส่งเอกสาร / ติดต่อประสานงานหน่วยงานภายนอก',
  'ตรวจนับพัสดุ / จัดทำรายงานคลังสินค้า',
  'สรุปค่าใช้จ่ายประจำเดือนเสนอผู้จัดการโครงการ',
]

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function daysInMonth(year: number, month: number): DayInfo[] {
  const last = new Date(year, month, 0).getDate()
  const out: DayInfo[] = []
  for (let d = 1; d <= last; d++) {
    const dw = new Date(year, month - 1, d).getDay()
    out.push({ date: isoDate(year, month, d), dow: dw, weekend: dw === 0 }) // Sunday-only weekend
  }
  return out
}

/* Builds a cell's stored value, mirroring the GAS rule exactly:

     one-to-one WITH a fixed cost  -> "<code> / <fixedCost>"
     one-to-one WITHOUT one        -> "<code>"        (Z-1/Z-2/Z-3 are like this)
     one-to-many                   -> "<code> / <randomCategory>"

   The previous version asserted `a.fixed_cost!` on every one-to-one type, which
   was safe only while the sample data happened to give them all a fixed cost.
   The real index does not: the three Z codes (Standby / Leave / Resignation)
   are one-to-one with an empty fixed cost, so the assertion would have written
   "Z-2 / undefined" into cells. */
function composite(a: Activity, rnd: () => number = Math.random): string {
  if (a.mapping === 'one-to-one') {
    return a.fixed_cost ? `${a.code} / ${a.fixed_cost}` : a.code
  }
  return `${a.code} / ${CATEGORIES[3 + Math.floor(rnd() * (CATEGORIES.length - 4))].code}`
}

const _siteCache: Record<string, SiteMonth> = {}
export function siteMonth(siteKey: string, year: number, month: number, today: string): SiteMonth {
  const ck = `${siteKey}|${year}|${month}`
  const cached = _siteCache[ck]
  if (cached) return cached

  const seed = [...siteKey].reduce((a, c) => a + c.charCodeAt(0), 0) + year * 13 + month * 7
  const rnd = mulberry32(seed)
  const days = daysInMonth(year, month)

  const nOp = 5 + Math.floor(rnd() * 6)
  const nSup = 3 + Math.floor(rnd() * 4)
  const employees: Employee[] = []
  let id = 1
  const mkEmp = (kind: Employee['kind']): Employee => {
    const name = `${TH_FIRST[Math.floor(rnd() * TH_FIRST.length)]} ${TH_LAST[Math.floor(rnd() * TH_LAST.length)]}`
    const dept = kind === 'operation'
      ? DEPARTMENTS[3 + Math.floor(rnd() * 5)]
      : DEPARTMENTS[Math.floor(rnd() * 3)]
    return {
      eid: `${siteKey}-${id++}`, name,
      emp_id: 'E' + String(1000 + Math.floor(rnd() * 8999)),
      department: dept, position: POSITIONS[Math.floor(rnd() * POSITIONS.length)], kind,
      away: [], movedIn: '', movedInFrom: '', movedOut: '', movedOutTo: '',
    }
  }
  for (let i = 0; i < nOp; i++) employees.push(mkEmp('operation'))
  for (let i = 0; i < nSup; i++) employees.push(mkEmp('support'))
  employees.sort((a, b) => (a.kind !== b.kind ? (a.kind === 'operation' ? -1 : 1) : a.name.localeCompare(b.name, 'th')))

  // one mid-month transfer for flavour
  if (employees.length > 4) {
    const mv = employees[employees.length - 1]
    const cut = isoDate(year, month, 16)
    mv.movedIn = cut
    mv.movedInFrom = 'โครงการบางวัว'
    mv.away = days.filter((d) => d.date < cut).map((d) => d.date)
  }

  const opActs = ACTIVITIES.filter((a) => /^[B-E]/.test(a.code))
  const entries: Entries = {}
  employees.forEach((e) => {
    const by: Record<string, CellValue> = {}
    const awaySet = new Set(e.away)
    days.forEach((day) => {
      if (awaySet.has(day.date)) return
      if (day.weekend) return
      if (day.date > today) return
      if (rnd() < 0.12) return // ~12% genuinely missing
      // ~4% of days are approved leave, written by the request workflow rather
      // than typed. Z-2 is the leave work code; the '[LV]' note is what makes
      // the grid show the provenance marker — the cell value alone is
      // indistinguishable from a hand-typed Z-2.
      if (rnd() < 0.04) {
        const lt = LEAVE_TYPES[Math.floor(rnd() * LEAVE_TYPES.length)]
        const note = `[LV] ${lt.th} · LV202608${String(10 + Math.floor(rnd() * 9))}000000-0${Math.floor(rnd() * 90) + 10}`
        by[day.date] = e.kind === 'operation' ? { team: 'Z-2', note } : { detail: 'Z-2', note }
        return
      }
      if (e.kind === 'operation') {
        const a = opActs[Math.floor(rnd() * opActs.length)]
        const cell: CellValue = { team: composite(a, rnd) }
        if (rnd() < 0.18) cell.pm = composite(opActs[Math.floor(rnd() * opActs.length)], rnd)
        by[day.date] = cell
      } else {
        by[day.date] = { detail: SUP_DETAILS[Math.floor(rnd() * SUP_DETAILS.length)] }
      }
    })
    entries[e.eid] = by
  })

  const teams: Activity[] = ACTIVITIES.map((a) => ({ ...a, sites: '', desc: '' }))
  const costs = CATEGORIES.map((c) => ({ code: c.code, name: c.name }))

  const result: SiteMonth = { ok: true, days, employees, entries, teams, costs, today, lockDays: 3, edits: {} }
  _siteCache[ck] = result
  return result
}

export function adminSummary(year: number, month: number, today: string): AdminSummary {
  const rows: SiteSummary[] = SITES.map((s) => {
    const d = siteMonth(s.key, year, month, today)
    const n_support = d.employees.filter((e) => e.kind !== 'operation').length
    const n_operation = d.employees.filter((e) => e.kind === 'operation').length

    let entriesCount = 0, fillDenom = 0, fillFilled = 0
    const supStarted = new Set<string>(), opStarted = new Set<string>()
    const actCount: Record<string, number> = {}, costCount: Record<string, number> = {}

    const daysFilled: DayFill[] = d.days.map((day) => {
      let total = 0, filled = 0
      d.employees.forEach((e) => {
        if (e.away.indexOf(day.date) >= 0) return
        if (day.weekend) return
        total++
        const v = (d.entries[e.eid] || {})[day.date]
        if (v && (v.team || v.detail || v.pm)) {
          filled++; entriesCount++
          ;(e.kind === 'operation' ? opStarted : supStarted).add(e.eid)
          const slots = [v.team || v.detail, v.pm].filter(Boolean) as string[]
          const w = slots.length === 2 ? 0.5 : 1
          slots.forEach((sv) => {
            const aCode = sv.split(' / ')[0].trim()
            const cCode = sv.split(' / ')[1]
            const act = ACTIVITIES.find((a) => a.code === aCode)
            if (act) actCount[act.name] = (actCount[act.name] || 0) + w
            if (cCode) {
              const cat = CATEGORIES.find((c) => c.code === cCode.trim())
              if (cat) costCount[cat.name] = (costCount[cat.name] || 0) + w
            }
          })
        }
      })
      if (day.date <= today && !day.weekend) { fillDenom += total; fillFilled += filled }
      return { date: day.date, weekend: day.weekend, total, filled }
    })

    const toTop = (obj: Record<string, number>): TopItem[] => {
      const tot = Object.values(obj).reduce((a, b) => a + b, 0) || 1
      return Object.entries(obj)
        .map(([name, count]) => ({ name, count: Math.round(count * 10) / 10, pct: Math.round((count / tot) * 100) }))
        .sort((a, b) => b.count - a.count)
    }

    return {
      site_key: s.key, site_name: s.name, company: s.company,
      n_emp: d.employees.length, n_support, n_operation,
      support_started: supStarted.size, operation_started: opStarted.size,
      entries: entriesCount,
      fillRate: fillDenom ? Math.round((fillFilled / fillDenom) * 100) : 0,
      fillRateDenom: fillDenom,
      daysFilled,
      topActivities: toTop(actCount),
      topCostCodes: toTop(costCount),
    }
  })
  return { ok: true, rows, today, lockDays: 3 }
}

export const BOOT: Boot = {
  ok: true, email: '(guest)', role: 'admin', isAdmin: true, canEntry: true,
  sites: SITES.map((s) => ({ key: s.key, name: s.name })),
}

/* ---------------------------------------------------------------------------
   Leave requests — mock layer

   Mirrors api_myLeaveRequests / api_pendingLeaveRequests /
   api_decidedLeaveRequests. Kept in module-level state so the preview behaves
   like the real thing: approving a request moves it out of the queue and into
   the decision history instead of just disappearing.
--------------------------------------------------------------------------- */

export const LEAVE_TYPES: LeaveType[] = [
  { code: 'sick', th: 'ลาป่วย' },
  { code: 'personal', th: 'ลากิจ' },
  { code: 'vacation', th: 'ลาพักผ่อน' },
  { code: 'maternity', th: 'ลาคลอด' },
  { code: 'ordination', th: 'ลาบวช' },
  { code: 'other', th: 'อื่นๆ' },
]

// Ids are strings and look like the server's: Sheets keeps only 15 significant
// digits, so a 16-digit numeric id silently lost its last digit.
let leaveSeq = 1
function newLeaveId(): string {
  return 'LV2026081914' + String(3000 + leaveSeq++).padStart(4, '0') + '-047'
}

let LEAVE_ROWS: LeaveRequest[] = [
  {
    id: 'LV20260817231200-101', eid: '1', site_key: 'bangtoei',
    emp_name: 'นางประกอบแก้ว บุตรสืบสาย',
    from_date: '2026-08-18', to_date: '2026-08-19', reason: 'ป่วย',
    status: 'pending', requested_at: '2026-08-17 23:12',
    decided_by: '', decided_at: '', leave_type: 'sick',
  },
  {
    id: 'LV20260817231500-102', eid: '2', site_key: 'bangwua',
    emp_name: 'น.ส.จิตย์ใจ ศรีบุญเรือง',
    from_date: '2026-08-12', to_date: '2026-08-18', reason: 'ไปงานบวชลูก',
    status: 'pending', requested_at: '2026-08-17 23:15',
    decided_by: '', decided_at: '', leave_type: 'ordination',
  },
  {
    id: 'LV20260816104100-103', eid: '1', site_key: 'bangtoei',
    emp_name: 'นางประกอบแก้ว บุตรสืบสาย',
    from_date: '2026-08-20', to_date: '2026-08-21', reason: 'ลาพักผ่อน',
    status: 'approved', requested_at: '2026-08-15 09:02',
    decided_by: 'hr@vcb-con.com', decided_at: '2026-08-16 10:41', leave_type: 'vacation',
  },
  {
    id: 'LV20260816090500-104', eid: '3', site_key: 'bangtoei',
    emp_name: 'นางรัตนาภรณ์ ทุมวรรณ',
    from_date: '2026-08-13', to_date: '2026-08-15', reason: '',
    status: 'rejected', requested_at: '2026-08-12 16:20',
    decided_by: '(guest)', decided_at: '2026-08-16 09:05', leave_type: 'personal',
  },
]

// The roster comes from siteMonth(), which is where this mock builds employees.
// Any month works — the roster does not vary by month here.
function rosterOf(siteKey: string): Employee[] {
  if (!siteKey) return []
  return siteMonth(siteKey, 2026, 5, '2026-05-18').employees
}
export function rosterForLeave(siteKey: string): LeaveRosterEntry[] {
  const site = SITES.find((s) => s.key === siteKey)
  return rosterOf(siteKey)
    .map((e) => ({
      eid: e.eid, name: e.name, kind: e.kind, emp_id: e.emp_id,
      position: e.position, department: e.department,
      company: site ? site.company : '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'))
}
// Which site an employee belongs to — needed because the request form only
// sends an eid, exactly like the live app.
function siteOfEid(eid: string): SiteMeta | undefined {
  return SITES.find((s) => rosterOf(s.key).some((e) => e.eid === eid))
}

export function myLeaveRequests(eid: string): LeaveRequest[] {
  return LEAVE_ROWS.filter((r) => r.eid === eid)
    .slice()
    .sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
}

export function pendingLeaveRequests(): LeaveRequest[] {
  return LEAVE_ROWS.filter((r) => r.status === 'pending')
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export function decidedLeaveRequests(limit = 200): DecidedLeaveResult {
  const all = LEAVE_ROWS.filter((r) => r.status !== 'pending')
    .slice()
    // Undated rows sort LAST, not by id: ids start with "LV", which compares
    // above any "2026-…" timestamp and would float them up as if newest.
    .sort((a, b) => {
      const x = a.decided_at, y = b.decided_at
      if (!x && !y) return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
      if (!x) return 1
      if (!y) return -1
      return x < y ? 1 : x > y ? -1 : 0
    })
  const rows = all.slice(0, limit)
  return { rows, total: all.length, shown: rows.length }
}

export function requestLeave(
  eid: string, from: string, to: string, reason: string, leaveType: LeaveTypeCode,
): { ok: true; id: string } | { ok: false; error: string } {
  const site = siteOfEid(eid)
  const emp = site ? rosterForLeave(site.key).find((e) => e.eid === eid) : undefined
  if (!emp) return { ok: false, error: 'NOT_FOUND' }
  if (to < from) return { ok: false, error: 'BAD_RANGE' }
  const id = newLeaveId()
  LEAVE_ROWS = LEAVE_ROWS.concat({
    id, eid, site_key: site ? site.key : '', emp_name: emp.name,
    from_date: from, to_date: to, reason, status: 'pending',
    requested_at: '2026-08-19 19:30', decided_by: '', decided_at: '',
    leave_type: leaveType,
  })
  return { ok: true, id }
}

export function decideLeaveRequest(id: string, approve: boolean): { ok: boolean; error?: string } {
  const row = LEAVE_ROWS.find((r) => r.id === id)
  if (!row) return { ok: false, error: 'NOT_FOUND' }
  if (row.status !== 'pending') return { ok: false, error: 'ALREADY_DECIDED' }
  LEAVE_ROWS = LEAVE_ROWS.map((r) =>
    r.id === id
      ? { ...r, status: approve ? 'approved' : 'rejected',
          decided_by: '(guest)', decided_at: '2026-08-19 19:30' }
      : r,
  )
  return { ok: true }
}

// Cancel is the requester's own escape hatch and only exists while pending —
// once decided the row is a record, not a draft.
export function cancelLeaveRequest(id: string, eid: string): { ok: boolean; error?: string } {
  const row = LEAVE_ROWS.find((r) => r.id === id)
  if (!row) return { ok: false, error: 'NOT_FOUND' }
  if (row.eid !== eid) return { ok: false, error: 'FORBIDDEN' }
  if (row.status !== 'pending') return { ok: false, error: 'ALREADY_DECIDED' }
  LEAVE_ROWS = LEAVE_ROWS.filter((r) => r.id !== id)
  return { ok: true }
}

/* Projects administration (api_adminListSites / api_addSite / api_setSiteActive).

   Sites gained an `active` flag: a closed project stops being offered for NEW
   work but keeps its dashboard history. Blank/absent counts as ACTIVE, so rows
   written before the column existed keep working. */
let SITE_ACTIVE: Record<string, boolean> = {}
let EXTRA_SITES: SiteMeta[] = []

export function allSitesAdmin(): SiteAdminRow[] {
  return SITES.concat(EXTRA_SITES).map((s) => ({
    key: s.key, name: s.name, company: s.company,
    active: SITE_ACTIVE[s.key] !== false,
    // Employee count, so closing a project can warn how many people are still
    // assigned. It warns rather than blocks: projects routinely end before HR
    // moves staff.
    emps: rosterOf(s.key).length,
  }))
}
export function siteIsOpen(key: string): boolean { return SITE_ACTIVE[key] !== false }

export function setSiteActive(key: string, active: boolean): { ok: boolean } {
  SITE_ACTIVE = { ...SITE_ACTIVE, [key]: active }
  return { ok: true }
}

export function addSite(name: string, company: string):
  { ok: true; key: string } | { ok: false; error: string } {
  const nm = name.trim()
  if (!nm) return { ok: false, error: 'MISSING_NAME' }
  const all = SITES.concat(EXTRA_SITES)
  if (all.some((s) => s.name.trim() === nm)) return { ok: false, error: 'DUPLICATE' }
  // The key is DERIVED, never typed: it is a permanent internal id (wide-tab
  // suffix, Users.site_key), so it must be ASCII and unique. Thai names yield
  // no ASCII, so they fall back to a stable hash of the name rather than
  // site2/site3, which would say nothing when read in the sheet.
  let base = nm.toLowerCase().replace(/[^a-z0-9]+/g, '')
  if (!base) {
    let h = 0
    for (let i = 0; i < nm.length; i++) h = (h * 31 + nm.charCodeAt(i)) % 1000000
    base = 'site' + h
  }
  const taken = new Set(all.map((s) => s.key))
  let key = base, n = 2
  while (taken.has(key)) key = base + n++
  EXTRA_SITES = EXTRA_SITES.concat({ key, name: nm, company: company.trim() })
  return { ok: true, key }
}
