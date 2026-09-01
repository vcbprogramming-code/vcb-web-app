// Ported verbatim from JavaScript.html (I18N strings + date/time formatters).
import type { Lang, MeetingListItem, MeetingFull } from '../types'

type Dict = Record<string, string>

// `satisfies`, NOT `: Record<Lang, Dict>`. The annotation widened every key
// to `string`, which made `keyof typeof I18N.en` collapse to `string` and
// left TrKey catching nothing. This way the shape is still checked — both
// languages present, all values strings — while the literal key union
// survives for TrKey below.
export const I18N = {
  en: {
    latestMeetings: 'Latest meetings', projects: 'Projects',
    allMeetings: 'All meetings', allMeetingsSub: 'ทุกการประชุม',
    newMeeting: '＋ New meeting',
    searchPlaceholder: 'Search meetings, decisions, people…', searchPlaceholderMobile: 'Search…',
    settings: 'Settings', signIn: '🔓 Sign in', signOut: 'Sign out',
    projectAccess: '🔐 Project access', readMinutes: 'Read minutes →',
    backProjects: '← Projects', backMeetings: '← Meetings',
    meetingsLabel: 'Meetings',
    signedInAs: 'Signed in as', display: 'การแสดงผล / DISPLAY',
    theme: 'โหมดสี / Theme', language: 'ภาษา / Language',
    readingSize: 'ขนาดตัวอักษร / Reading size',
    sizeSmall: 'เล็ก Small', sizeNormal: 'ปกติ Normal', sizeLarge: 'ใหญ่ Large',
    about: 'เกี่ยวกับ / ABOUT',
    build: 'Build', adminLabel: 'Admin', close: 'Close',
    records: 'record', recordsPlural: 'records', backToPortal: 'Back to VCB Connect home'
  },
  th: {
    latestMeetings: 'การประชุมล่าสุด', projects: 'โครงการ',
    allMeetings: 'ทุกการประชุม', allMeetingsSub: 'All meetings',
    newMeeting: '＋ เพิ่มการประชุม',
    searchPlaceholder: 'ค้นหาการประชุม, มติ, บุคคล…', searchPlaceholderMobile: 'ค้นหา…',
    settings: 'ตั้งค่า', signIn: '🔓 เข้าสู่ระบบ', signOut: 'ออกจากระบบ',
    projectAccess: '🔐 สิทธิ์โครงการ', readMinutes: 'อ่านบันทึก →',
    backProjects: '← โครงการ', backMeetings: '← การประชุม',
    meetingsLabel: 'การประชุม',
    signedInAs: 'เข้าสู่ระบบโดย', display: 'การแสดงผล / DISPLAY',
    theme: 'โหมดสี / Theme', language: 'ภาษา / Language',
    readingSize: 'ขนาดตัวอักษร / Reading size',
    sizeSmall: 'เล็ก Small', sizeNormal: 'ปกติ Normal', sizeLarge: 'ใหญ่ Large',
    about: 'เกี่ยวกับ / ABOUT',
    build: 'เวอร์ชั่น', adminLabel: 'ผู้ดูแล', close: 'ปิด',
    records: 'รายการ', recordsPlural: 'รายการ', backToPortal: 'กลับไปหน้าหลัก VCB Connect'
  }
} satisfies Record<Lang, Dict>

// Every key the app may ask for, derived from the English dictionary rather
// than hand-maintained — adding a string to I18N.en is all it takes. English
// is the source of truth because it is the fallback in makeTr: a key missing
// there cannot resolve for any language.
export type TrKey = keyof typeof I18N.en

export type Tr = (key: TrKey) => string
export function makeTr(lang: Lang): Tr {
  // The `|| key` fallback stays as a runtime safety net, but TrKey means a
  // typo is now a compile error rather than a button labelled with its own
  // key name.
  return (key) => (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const THAI_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

type DateLike = Pick<MeetingListItem | MeetingFull, 'date'> & Partial<{ kind: string; dateLabel: string; time: string }>

export function fmtThaiDate(m: DateLike): string {
  const p = String(m.date || '').split('-')
  if (p.length !== 3) return ''
  const y = +p[0], mo = +p[1], d = +p[2]
  if (!y || mo < 1 || mo > 12 || !d) return ''
  return 'วันที่ ' + d + ' ' + THAI_MONTHS_FULL[mo - 1] + ' ' + (y + 543)
}

export function fmtDate(m: DateLike): string {
  if (m.date) {
    const p = String(m.date).split('-')
    if (p.length === 3) {
      const y = +p[0], mo = +p[1], d = +p[2]
      if (y && mo >= 1 && mo <= 12 && d) return d + ' ' + MONTHS[mo - 1] + ' ' + (y + 543)
    }
  }
  if (m.kind === 'overview') return 'Overview'
  return String(m.dateLabel || '').replace(/\s*\d{1,2}\s*[:.]\s*\d{2}\s*(?:AM|PM|am|pm|น\.?)?\s*$/i, '').trim()
}

export function fmtTime(m: DateLike): string {
  const mm = String(m.time || '').match(/(\d{1,2}):(\d{2})/)
  return mm ? (mm[1].length < 2 ? '0' : '') + mm[0] + ' น.' : ''
}
