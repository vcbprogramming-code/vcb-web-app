// Ported from JavaScript.html: rendered-meeting OVERRIDE_CSS + letterhead, and the
// project-tab Executive-Summary section extraction (with bullet/excerpt fallback).

export const SUMMARY_RE = /สรุปผู้บริหาร|บทสรุป|executive\s*summary|key\s*takeaway|ประเด็นสำคัญ/i
export const ACTION_RE = /action\s*item|รายการที่ต้องดำเนินการ|รายการที่ต้องทำ|สิ่งที่ต้องทำ|สิ่งที่ต้องดำเนินการ|ขั้นตอนถัดไป|ขั้นตอนต่อไป|มอบหมายงาน|next\s*step/i

export const COMPANY_NAME = 'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด'

export const OVERRIDE_CSS =
  "html,body{background:#fff;margin:0;}" +
  ".vcb-letterhead{font-size:21px;font-weight:700;color:#0b3d62;line-height:1.3;text-align:left;margin:0 0 4px;}" +
  ".vcb-letterdate{font-size:15px;color:#24486b;line-height:1.3;text-align:left;margin:0 0 12px;}" +
  ".ai-disclaimer{font-size:12.5px;color:#57606a;background:#f6f8fa;border:1px solid #d8dee4;border-radius:6px;padding:8px 12px;margin:0 0 16px;line-height:1.5;}" +
  "body{padding:48px 64px 64px;max-width:816px;margin:0 auto;}" +
  "body,p,span,td,th,li,h1,h2,h3,h4,a,div{font-family:'Sarabun','Noto Sans Thai',sans-serif !important;}" +
  "body{color:#1f2328;font-size:15px;line-height:1.55;}" +
  "h1{font-size:21px;color:#0b3d62;font-weight:700;margin:18px 0 10px;}" +
  "h2{font-size:17px;color:#0b3d62;font-weight:700;margin:14px 0 8px;}" +
  "h3{font-size:16px;color:#24486b;font-weight:700;margin:12px 0 6px;}" +
  "h4{font-size:15px;color:#24486b;font-weight:700;margin:10px 0 6px;}" +
  "p{margin:6px 0;}" +
  "img{max-width:100%;height:auto;}a{color:#1f6feb;}" +
  "table{border-collapse:collapse;width:100%;margin:14px 0;font-size:14px;}" +
  "td,th{border:1px solid #d8dee4;padding:7px 10px;vertical-align:top;}" +
  "th,tr:first-child td{background:#f1f5f9;font-weight:700;}" +
  "ul,ol{padding-left:22px;margin:6px 0;}li{margin:3px 0;}" +
  ".chip-file{display:inline-flex;align-items:center;gap:7px;border:1px solid #d8dee4;border-radius:8px;padding:4px 11px 4px 6px;margin:3px 7px 3px 0;text-decoration:none;color:#1f2328;background:#fff;font-size:13px;line-height:1.3;}" +
  ".chip-file:hover{border-color:#1f6feb;background:#f3f8ff;box-shadow:0 1px 4px rgba(27,31,36,.12);}" +
  ".chip-file .fi{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:18px;border-radius:3px;color:#fff;font-size:9px;font-weight:700;padding:0 3px;flex:none;}" +
  ".fi.xls{background:#1a7f37;}.fi.ppt{background:#d24726;}.fi.pdf{background:#cf222e;}.fi.doc{background:#1f6feb;}.fi.fld{background:#8b949e;}.fi.gen{background:#6e7781;}" +
  // The letterhead/date exist for PRINT/PDF output only — a printed page has
  // no app chrome (no "← Meetings" bar, no detail-bar title/date) to carry
  // that information, so the letterhead is the sole place it appears there.
  // On SCREEN, the outer detail-bar already shows the exact same title +
  // date right above this iframe — showing both was a genuine duplicate
  // header, worst on mobile where the extra block ate scarce vertical space
  // for zero new information (2026-07-21 fix). Hidden on screen, kept fully
  // intact for print via the @media screen/print split below.
  "@media screen{.vcb-letterhead,.vcb-letterdate{display:none;}}" +
  "@media print{a[href]:after{content:'';}.chip-file{border-color:#bbb;}}"

// Dark-mode variant of the A4 preview — wrapped entirely in @media screen so
// it can NEVER affect Print/PDF output (a printed page or exported PDF
// should always be white paper + black ink, never dark background). Only
// injected into the srcdoc when the app is in dark mode; the outer app
// chrome around the iframe already darkens via CSS — this is just the
// document INSIDE the iframe, a fully separate HTML document that doesn't
// inherit the outer page's theme class at all. Mirrors DARK_OVERRIDE_CSS in
// JavaScript.html.
export const DARK_OVERRIDE_CSS =
  "@media screen{" +
  "html,body{background:#161b22 !important;}" +
  "body{color:#c9d1d9 !important;}" +
  ".vcb-letterhead{color:#79c0ff !important;}" +
  ".vcb-letterdate{color:#8ab4e8 !important;}" +
  ".ai-disclaimer{color:#8b949e !important;background:#1c2128 !important;border-color:#30363d !important;}" +
  "h1,h2{color:#79c0ff !important;}h3,h4{color:#8ab4e8 !important;}" +
  "a{color:#58a6ff !important;}" +
  "td,th{border-color:#30363d !important;}" +
  "th,tr:first-child td{background:#1c2128 !important;}" +
  ".chip-file{border-color:#30363d !important;color:#c9d1d9 !important;background:#1c2128 !important;}" +
  ".chip-file:hover{border-color:#58a6ff !important;background:#161b22 !important;}" +
  "}"

// AI-generated-summary disclaimer banner — DISPLAY ONLY. Injected purely at
// render time into a srcdoc string (see buildMeetingSrcdoc below and its
// callers), NEVER written into the stored meeting HTML/mock row. If this
// were part of stored content it would leak into excerpt
// (stripTags(html).slice(0,200) — always the first 200 chars of the body)
// and into searchMeetings (which greps the stored body directly), matching
// every AI-sourced meeting on words like "summary"/"AI-Generated" and
// burying the real excerpt under fixed boilerplate. Mirrors the exact
// banner markup/copy in JavaScript.html's renderDetail()/
// renderVersionPreviewHtml(). Callers gate this on
// `m.source === 'fathom' || m.source === 'transkriptor'`.
export const AI_DISCLAIMER_HTML =
  '<p class="ai-disclaimer"><b>AI-Generated Summary:</b> This summary was generated automatically and may contain errors. Please focus on the main discussion points and verify important details where necessary.</p>'

function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

function concise(input: string): string {
  let t = (input || '').replace(/\s+/g, ' ').trim()
  const parts = t.split(/\s[|｜]\s|：\s?|:\s/)
  if (parts.length > 1) {
    const detail = parts.slice(1).join(' · ').trim()
    if (detail.length >= 12) t = detail
  }
  if (t.length > 140) t = t.slice(0, 138).replace(/\s+\S*$/, '').trim() + '…'
  return t
}

export function bulletsFromHtml(html: string, max = 4): string[] {
  const div = document.createElement('div')
  div.innerHTML = html || ''
  const out: string[] = []
  const seen: Record<string, number> = {}
  function push(raw: string): void {
    const t = concise(raw)
    const key = t.slice(0, 24)
    if (t.length < 6 || seen[key]) return
    seen[key] = 1; out.push(t)
  }
  const lis = div.querySelectorAll('li')
  for (let i = 0; i < lis.length && out.length < max; i++) push(lis[i].textContent || '')
  if (!out.length) {
    const ps = div.querySelectorAll('p, h2, h3')
    for (let j = 0; j < ps.length && out.length < max; j++) {
      if ((ps[j].textContent || '').trim().length >= 24) push(ps[j].textContent || '')
    }
  }
  return out
}

function headingRank(node: Element): number {
  if (!node || node.nodeType !== 1) return 0
  return /^H[1-6]$/.test(node.tagName) ? +node.tagName.charAt(1) : 0
}

function sectionHtml(root: HTMLElement, re: RegExp): string {
  const els = root.children
  for (let i = 0; i < els.length; i++) {
    const r = headingRank(els[i])
    if (!r || !re.test((els[i].textContent || '').replace(/\s+/g, ' '))) continue
    const wrap = document.createElement('div')
    for (let j = i + 1; j < els.length; j++) {
      const ej = els[j], rj = headingRank(ej)
      if (rj && rj <= r) break
      if (!(ej.textContent || '').trim() && !ej.querySelector('img,table,hr')) continue
      wrap.appendChild(ej.cloneNode(true))
    }
    wrap.querySelectorAll('*').forEach(e => {
      ['style', 'class', 'id', 'width', 'height', 'align', 'dir'].forEach(a => e.removeAttribute(a))
    })
    return wrap.innerHTML.trim()
  }
  return ''
}

// Build the project-tab summary block (Exec Summary section, else bullets, else excerpt).
export function summaryHtml(html: string, excerpt: string): string {
  const root = document.createElement('div')
  root.innerHTML = html || ''
  const summary = sectionHtml(root, SUMMARY_RE)
  if (summary) return '<div class="seclabel">📌 บทสรุปผู้บริหาร · Executive Summary</div><div class="secbody">' + summary + '</div>'
  const bl = bulletsFromHtml(html, 4)
  return bl.length
    ? '<ul class="dash-bullets">' + bl.map(b => '<li>' + esc(b) + '</li>').join('') + '</ul>'
    : '<div class="bmuted">' + esc(concise(excerpt) || 'Open to read the full minutes.') + '</div>'
}

/** Options for buildMeetingSrcdoc — isDark injects DARK_OVERRIDE_CSS (must be
 *  re-evaluated on every theme toggle, not just once when the meeting first
 *  opens — see MeetingDetail.tsx). aiDisclaimer prepends AI_DISCLAIMER_HTML,
 *  display-only, gated by the caller on m.source === 'fathom' || 'transkriptor'. */
export interface SrcdocOpts {
  isDark?: boolean
  aiDisclaimer?: boolean
}

// Build the iframe srcdoc for a rendered meeting (letterhead + OVERRIDE_CSS
// [+ DARK_OVERRIDE_CSS] [+ AI disclaimer banner]).
export function buildMeetingSrcdoc(html: string, css: string, thaiDate: string, opts: SrcdocOpts = {}): string {
  const docHtml = html || '<p>(no content)</p>'
  const leadsWithCompany = String(docHtml).replace(/<[^>]*>/g, ' ').slice(0, 220).indexOf('วิจิตรภัณฑ์ก่อสร้าง') !== -1
  const letterhead = leadsWithCompany ? '' :
    '<div class="vcb-letterhead">' + COMPANY_NAME + '</div>' +
    (thaiDate ? '<div class="vcb-letterdate">' + esc(thaiDate) + '</div>' : '')
  const aiDisclaimer = opts.aiDisclaimer ? AI_DISCLAIMER_HTML : ''
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank">' +
    '<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">' +
    '<style>' + (css || '') + '</style><style>' + OVERRIDE_CSS + '</style>' +
    (opts.isDark ? '<style>' + DARK_OVERRIDE_CSS + '</style>' : '') + '</head>' +
    '<body>' + letterhead + aiDisclaimer + docHtml + '</body></html>'
}
