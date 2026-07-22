// Read-only version content preview — mirrors #vpBg/#vpBody/#vpPrint in
// Index.html + openOriginalPreview()/openVersionPreview()/renderVersionPreviewHtml()
// in JavaScript.html. Renders inside its own iframe (not a sibling element) so
// the Print button's contentWindow.print() call actually prints just the body.
//
// 2026-07-22: getOriginalContent/getVersionContent now return
// { html, title, dateLabel, time } instead of a bare HTML string — the
// header below uses THAT title/dateLabel/time (what the meeting actually
// looked like at the moment of the snapshot), not the live `meeting` prop's
// current values, fixing a bug where renaming a meeting made its own
// "Original"/past-version previews show the new name. Falls back to the
// live `meeting` prop only when the snapshot's title is '' (pre-fix
// snapshot that never captured metadata) — same fallback Code.js documents.
import { useEffect, useRef, useState } from 'react'
import type { MeetingFull, VersionContent } from '../types'
import { OVERRIDE_CSS, DARK_OVERRIDE_CSS, AI_DISCLAIMER_HTML } from '../lib/docRender'
import { currentTheme } from '../lib/ui'

interface Props {
  /** null when closed. When set, fetches and shows this version's HTML. */
  request: { meetingId: string; seq: string | 'current' } | null
  meeting: MeetingFull | null // fallback header source + project name — see file note above
  projectName: string
  fetchHtml: (meetingId: string, seq: string) => Promise<VersionContent>
  onClose: () => void
}

function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

export default function VersionPreviewModal({ request, meeting, projectName, fetchHtml, onClose }: Props) {
  const [content, setContent] = useState<VersionContent | null>(null)
  const [err, setErr] = useState('')
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!request) { setContent(null); setErr(''); return }
    let alive = true
    setContent(null); setErr('')
    fetchHtml(request.meetingId, request.seq).then(c => { if (alive) setContent(c) })
      .catch(e => { if (alive) setErr(e instanceof Error ? e.message : String(e)) })
    return () => { alive = false }
  }, [request, fetchHtml])

  if (!request) return null

  // title/dateLabel/time as captured with THIS snapshot; '' means a pre-fix
  // snapshot with no captured metadata, so fall back to the live meeting.
  const title = content?.title || meeting?.title || ''
  const dateLabel = content?.dateLabel || meeting?.dateLabel || ''
  const time = content?.time || meeting?.time || ''
  const header =
    '<div style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #d8dee4;">' +
    '<div style="font-size:19px;font-weight:700;color:#0b3d62;">' + esc(title) + '</div>' +
    '<div style="font-size:13px;color:#57606a;margin-top:3px;">' + esc(projectName || '') + ' · ' + esc(dateLabel) + (time ? ' · ' + esc(time) : '') + '</div>' +
    '</div>'

  // AI-summary disclaimer — display-only, same as the live A4 render (see
  // MeetingDetail.tsx / docRender.ts). Gated on the live meeting's source
  // since versions don't carry their own source field.
  const aiDisclaimer = meeting && (meeting.source === 'fathom' || meeting.source === 'transkriptor') ? AI_DISCLAIMER_HTML : ''
  const isDark = currentTheme() === 'dark'

  const srcDoc = content == null ? undefined : (
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">' +
    '<style>' + OVERRIDE_CSS + '</style>' + (isDark ? '<style>' + DARK_OVERRIDE_CSS + '</style>' : '') +
    '</head><body>' + header + aiDisclaimer + (content.html || '<p>(empty)</p>') + '</body></html>'
  )

  function print(): void {
    const f = frameRef.current
    try { f!.contentWindow!.focus(); f!.contentWindow!.print() } catch { window.print() }
  }

  return (
    <div className="modal-bg show" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 900, width: '92vw', height: '85vh', display: 'flex', flexDirection: 'column' }}>
        <h3>Version preview <span style={{ fontWeight: 400, color: 'var(--ink-faint)', fontSize: 12.5 }}>(read-only)</span></h3>
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {err ? <div className="empty">Failed: {err}</div>
            : content == null ? <div className="empty">Loading…</div>
            : <iframe ref={frameRef} srcDoc={srcDoc} style={{ width: '100%', height: '75vh', border: 0, display: 'block' }} title="version preview" />}
        </div>
        <div className="actions">
          <button className="dbtn" style={{ marginRight: 'auto' }} onClick={print}>🖨 Print / PDF</button>
          <button className="dbtn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
