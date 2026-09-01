// UI strings, project display names, and code→department maps — ported
// verbatim from _appsscript_live/index.html (I18N, PROJ_NAMES, TO_BY_CODE,
// CODE_LABEL). User data (subjects, project codes) is never translated.

export type Lang = 'en' | 'th'
export type Era = 'ce' | 'be'

export interface Strings {
  add_doc: string; search_placeholder: string; all_doc_types: string; all_statuses: string
  flt_pending: string; flt_commented: string; flt_approved: string; flt_rejected: string
  all_projects: string; date_received: string; date_short: string; last_7: string; last_30: string; last_month: string
  clear_filters: string; showing: string; empty: string; loading: string
  col_num: string; col_date: string; col_project: string; col_code: string
  col_document: string; col_status: string; col_open: string
  status_pending: string; status_approved: string; status_rejected: string; status_commented: string
  open_btn: string; dark_mode: string; light_mode: string; lang_menu: string
}

export const I18N: Record<Lang, Strings> = {
  en: {
    add_doc: '＋ Add Document',
    search_placeholder: '🔍  Search document',
    all_doc_types: 'All document types',
    all_statuses: 'All statuses',
    flt_pending: 'Pending', flt_commented: 'Comments', flt_approved: 'Approved', flt_rejected: 'Rejected',
    all_projects: 'All Projects',
    date_received: 'Date received:',
    date_short: 'Date',
    last_7: 'Last 7 days', last_30: 'Last 30 days', last_month: 'Last month',
    clear_filters: '✕ Clear all filters',
    showing: 'Showing {n} of {m} documents',
    empty: 'No documents match your filters.',
    loading: 'Loading documents…',
    col_num: '#', col_date: 'Date', col_project: 'Project', col_code: 'Code',
    col_document: 'Document', col_status: 'Status', col_open: 'Open',
    status_pending: '• Pending', status_approved: '✓ Approved',
    status_rejected: '✕ Rejected', status_commented: '💬 Comment',
    open_btn: 'Open ↗',
    dark_mode: 'Dark mode', light_mode: 'Light mode',
    lang_menu: 'Language · English',
  },
  th: {
    add_doc: '＋ เพิ่มเอกสาร',
    search_placeholder: '🔍  ค้นหาเอกสาร',
    all_doc_types: 'ประเภทเอกสารทั้งหมด',
    all_statuses: 'ทุกสถานะ',
    flt_pending: 'รอดำเนินการ', flt_commented: 'ความเห็น', flt_approved: 'อนุมัติแล้ว', flt_rejected: 'ไม่อนุมัติ',
    all_projects: 'ทุกโครงการ',
    date_received: 'วันที่รับเอกสาร:',
    date_short: 'วันที่',
    last_7: '7 วันล่าสุด', last_30: '30 วันล่าสุด', last_month: 'เดือนที่แล้ว',
    clear_filters: '✕ ล้างตัวกรองทั้งหมด',
    showing: 'แสดง {n} จาก {m} เอกสาร',
    empty: 'ไม่พบเอกสารตามตัวกรอง',
    loading: 'กำลังโหลดเอกสาร…',
    col_num: 'ลำดับ', col_date: 'วันที่', col_project: 'โครงการ', col_code: 'รหัส',
    col_document: 'เอกสาร', col_status: 'สถานะ', col_open: 'เปิด',
    status_pending: '• รอดำเนินการ', status_approved: '✓ อนุมัติแล้ว',
    status_rejected: '✕ ไม่อนุมัติ', status_commented: '💬 ความเห็น',
    open_btn: 'เปิด ↗',
    dark_mode: 'โหมดมืด', light_mode: 'โหมดสว่าง',
    lang_menu: 'ภาษา · ไทย',
  },
}

export const PROJ_NAMES: Record<string, string> = {
  BT1: 'โครงการบางเตย ตอน 1',
  VC: 'โครงการลาดหลุมแก้ว ตอน 3',
  VK2: 'โครงการบางเตย ตอน 2',
  CVE: 'ชวนา เอ็นจิเนียร์ริ่ง',
  LPB: 'โครงการหลวงพระบาง',
  BV: 'โครงการบางวัว ตอน 6',
  PN4: 'โครงการพุทธมณฑล ตอน 4',
  EP: 'โครงการบ้านแพ้ว ตอน 3',
  'V&K': 'โครงการพุทธมณฑล ตอน 3',
  UNCLASSIFIED: 'Unclassified',
}

// NOTE: the project palette lives in ONE place — the .BT1/.VK2/... badge
// classes in styles.css. Both the table badges and the project-picker
// chips render a `pb <class>` span, so there is no parallel JS colour map
// to keep in sync (an earlier PROJ_COLOR map existed only because a native
// <select>'s <option> can't carry a styled chip).

// Table badge CSS class for a project key. Stripping non-alphanumerics
// (the old approach) collapses "V&K" to "VK", colliding with the real
// "VK" project (VK2's doc-code prefix) — two different sites would then
// share one badge color. Give "V&K" its own distinct token instead of
// dropping the "&".
export function projBadgeClass(proj: string): string {
  if (proj === 'V&K') return 'VnK'
  return proj.replace(/[^A-Za-z0-9]/g, '')
}

// Default เรียน recipient per document code (updateTemplateUI / TO_BY_CODE).
export const TO_BY_CODE: Record<string, string> = {
  '01': 'ฝ่ายบริหาร',
  '02A': 'ผู้จัดการฝ่ายวิศวกรรม', '02B': 'ผู้จัดการฝ่ายวิศวกรรม',
  '02C': 'ผู้จัดการฝ่ายวิศวกรรม', '03': 'ผู้จัดการฝ่ายวิศวกรรม',
  '05': 'ฝ่ายการเงิน',
  '06': 'ฝ่ายพัสดุทรัพย์สิน', '07': 'ฝ่ายพัสดุทรัพย์สิน',
  '08': 'ฝ่ายทรัพยากรบุคคล',
  '09': 'ฝ่ายบัญชี',
}

// Labels in the document-type filter dropdown (TO_BY_CODE + 10).
export const CODE_LABEL: Record<string, string> = { ...TO_BY_CODE, '10': 'ขอหนังสือรับรอง' }

export function makeT(lang: Lang): (k: keyof Strings) => string {
  return (k) => I18N[lang][k] ?? I18N.en[k] ?? String(k)
}

// Pad a leading single-digit code back to two digits ("8" -> "08").
export function fmtCode(c: string | number | null | undefined): string {
  const s = String(c == null ? '' : c).trim()
  const m = s.match(/^(\d+)(.*)$/)
  if (m && m[1]!.length === 1) return '0' + m[1] + m[2]
  return s
}

// DD/MM/YYYY, shifting the year to the Buddhist era (พ.ศ.) when era==='be'.
export function formatDateByEra(dateStr: string, era: Era): string {
  const m = String(dateStr || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return dateStr
  const d = m[1]!.padStart(2, '0'), mo = m[2]!.padStart(2, '0'), y = parseInt(m[3]!, 10)
  const displayY = era === 'be' ? y + 543 : y
  return d + '/' + mo + '/' + displayY
}

export function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export const pad3 = (x: number | string): string => {
  let s = String(x)
  while (s.length < 3) s = '0' + s
  return s
}
