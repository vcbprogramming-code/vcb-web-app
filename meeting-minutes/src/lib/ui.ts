// App-level helpers ported from JavaScript.html + Index.html head script:
// mobile detection / single-pane stack, theme + language DOM application,
// range-filter math, and the mobile iframe down-scaling.

import type { CSSProperties } from 'react'
import type { Lang, Theme, MeetingListItem } from '../types'

export type MobilePane = 'projects' | 'list' | 'detail'

// Typed CSS custom-property style (e.g. the project-color accent var --c).
export function cssVar(name: string, value: string): CSSProperties {
  return { [name]: value } as CSSProperties
}

export function isMobile(): boolean {
  return document.documentElement.classList.contains('is-mobile')
}

export function setMobilePane(pane: MobilePane): void {
  const h = document.documentElement
  h.classList.remove('mobile-pane-projects', 'mobile-pane-list', 'mobile-pane-detail')
  h.classList.add('mobile-pane-' + pane)
  try { window.scrollTo(0, 0) } catch { /* ignore */ }
}

export function applyThemeClass(theme: Theme): void {
  const html = document.documentElement
  html.classList.remove('theme-light', 'theme-dark')
  html.classList.add('theme-' + theme)
  try { localStorage.setItem('vcb_mm_theme', theme) } catch { /* ignore */ }
}

export function applyLangClass(lang: Lang): void {
  const html = document.documentElement
  html.classList.remove('lang-th', 'lang-en')
  html.classList.add('lang-' + lang)
  try { localStorage.setItem('vcb_mm_lang', lang) } catch { /* ignore */ }
}

export function currentTheme(): Theme {
  return document.documentElement.classList.contains('theme-dark') ? 'dark' : 'light'
}
export function currentLang(): Lang {
  return document.documentElement.classList.contains('lang-th') ? 'th' : 'en'
}

/* ---------- range filter ---------- */
export type Range = 'all' | 'week' | 'month'

function pad2(n: number): string { return (n < 10 ? '0' : '') + n }
function isoOf(d: Date): string { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) }

function rangeCutoff(range: Range): string | null {
  const now = new Date()
  if (range === 'week') {
    const d = new Date(now); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return isoOf(d)
  }
  if (range === 'month') return isoOf(new Date(now.getFullYear(), now.getMonth(), 1))
  return null
}

export function inRange(m: Pick<MeetingListItem, 'date'>, range: Range): boolean {
  if (range === 'all') return true
  if (!m.date) return false
  const cut = rangeCutoff(range)
  return cut == null ? true : m.date >= cut
}

/* ---------- mobile iframe scaling (applyMobileScale) ---------- */
export function applyMobileScale(frame: HTMLIFrameElement | null): void {
  if (!frame || !frame.contentWindow) return
  try {
    const doc = frame.contentWindow.document
    const bodyH = doc.body.scrollHeight
    const paper = frame.parentNode as HTMLElement | null
    const wrap = paper && (paper.parentNode as HTMLElement | null)
    if (!paper || !wrap) return
    const availW = wrap.clientWidth || window.innerWidth
    const virtualW = 860
    let scale = availW / virtualW
    if (scale > 1) scale = 1
    frame.style.width = virtualW + 'px'
    frame.style.height = bodyH + 'px'
    frame.style.border = '0'
    frame.style.transformOrigin = 'top left'
    frame.style.transform = 'scale(' + scale + ')'
    paper.style.width = (virtualW * scale) + 'px'
    paper.style.height = (bodyH * scale) + 'px'
  } catch { /* cross-origin or not ready */ }
}

export function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

/** Short label + CSS class for an attachment's file type. Mirrors
 *  fileIconHtml_ in JavaScript.html (same className/label pairs, same
 *  mime/name-based sniffing) — apply the returned className to a <span
 *  className={'fi ' + cls}>{label}</span> to match the GAS rendering exactly. */
export function fileIconKind(mime: string | undefined, name: string | undefined): { cls: string; label: string } {
  const t = ((mime || '') + ' ' + (name || '')).toLowerCase()
  if (/sheet|excel|\.xls|\.csv/.test(t)) return { cls: 'xls', label: 'X' }
  if (/presentation|powerpoint|\.ppt/.test(t)) return { cls: 'ppt', label: 'P' }
  if (/pdf/.test(t)) return { cls: 'pdf', label: 'PDF' }
  if (/document|word|\.doc/.test(t)) return { cls: 'doc', label: 'W' }
  if (/image\//.test(t)) return { cls: 'img', label: '🖼' }
  return { cls: 'gen', label: '▭' }
}

/** Mirrors fmtFileSize_ in JavaScript.html. */
export function fmtFileSize(bytes: number): string {
  const b = Number(bytes) || 0
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB'
  return (b / (1024 * 1024)).toFixed(1) + ' MB'
}

/** Reads a File as a base64 string (no data: prefix) for addAttachment's
 *  base64Data param. Mirrors the FileReader usage in JavaScript.html's
 *  attachFileInput.onchange. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.split(',')[1] || '')
    }
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}
