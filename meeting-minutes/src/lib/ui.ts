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
