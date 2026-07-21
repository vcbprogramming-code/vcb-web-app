// Read-only version content preview — mirrors #vpBg/#vpBody/#vpPrint in
// Index.html + openOriginalPreview()/openVersionPreview()/renderVersionPreviewHtml()
// in JavaScript.html. Renders inside its own iframe (not a sibling element) so
// the Print button's contentWindow.print() call actually prints just the body.
import { useEffect, useRef, useState } from 'react'
import type { MeetingFull } from '../types'
import { OVERRIDE_CSS } from '../lib/docRender'
import { fmtDate, fmtTime } from '../lib/i18n'

interface Props {
  /** null when closed. When set, fetches and shows this version's HTML. */
  request: { meetingId: string; seq: string | 'current' } | null
  meeting: MeetingFull | null // for the header (title/date/project) — body-only edits mean this is accurate even for "original"
  projectName: string
  fetchHtml: (meetingId: string, seq: string) => Promise<string>
  onClose: () => void
}

function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

export default function VersionPreviewModal({ request, meeting, projectName, fetchHtml, onClose }: Props) {
  const [html, setHtml] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!request) { setHtml(null); setErr(''); return }
    let alive = true
    setHtml(null); setErr('')
    fetchHtml(request.meetingId, request.seq).then(h => { if (alive) setHtml(h) })
      .catch(e => { if (alive) setErr(e instanceof Error ? e.message : String(e)) })
    return () => { alive = false }
  }, [request, fetchHtml])

  if (!request) return null

  const header = meeting ? (
    '<div style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #d8dee4;">' +
    '<div style="font-size:19px;font-weight:700;color:#0b3d62;">' + esc(meeting.title || '') + '</div>' +
    '<div style="font-size:13px;color:#57606a;margin-top:3px;">' + esc(projectName || '') + ' · ' + esc(fmtDate(meeting)) + (fmtTime(meeting) ? ' · ' + esc(fmtTime(meeting)) : '') + '</div>' +
    '</div>'
  ) : ''

  const srcDoc = html == null ? undefined : (
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">' +
    '<style>' + OVERRIDE_CSS + '</style></head><body>' + header + (html || '<p>(empty)</p>') + '</body></html>'
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
            : html == null ? <div className="empty">Loading…</div>
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
