// i18n — faithful port of the GAS t() + MNAME helpers, backed by the verbatim
// `T` dictionary extracted from Code.gs (i18n_data.ts).
import { T } from './i18n_data'
import type { Lang } from './types'

export const TH_M = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
export const EN_M = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
export const TH_DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
export const EN_DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// t(s) — returns the English translation when lang==='en' and one exists, else s.
export function translate(s: string, lang: Lang): string {
  if (!s) return s
  const rec = T[s]
  if (!rec || lang === 'th') return s
  return rec.en || s
}

export function monthName(m: number, lang: Lang): string {
  return (lang === 'en' ? EN_M : TH_M)[m] || ''
}
export function dow(d: number, lang: Lang): string {
  return (lang === 'en' ? EN_DOW : TH_DOW)[d] || ''
}
