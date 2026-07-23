import { useEffect, useRef, useState } from 'react'
import type { Project, MeetingFull, Theme } from '../types'
import { fmtDate, fmtTime, fmtThaiDate } from '../lib/i18n'
import { buildMeetingSrcdoc } from '../lib/docRender'
import { fetchMeeting, getCached, setCached } from '../api/contentCache'
import { api, getToken } from '../api/client'
import { applyMobileScale, isMobile, fileIconKind, fmtFileSize, fileToBase64 } from '../lib/ui'
import TagPickerModal from './TagPickerModal'
import { useConfirm } from './ConfirmPrompt'

const ATTACH_ACCEPT = '.pdf,.ppt,.pptx,.xls,.xlsx,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv'
const ATTACH_MAX_BYTES = 25 * 1024 * 1024

interface Props {
  id: string
  byId: Record<string, Project>
  projects: Project[]
  isAdmin: boolean
  onToast: (msg: string) => void
  onBusy: (msg: string | null) => void
  onEdit: (m: MeetingFull) => void
  onMutated: () => void
  execUrl: string
  /** Current theme — threaded down purely so this component re-renders (and
   *  recomputes srcdoc) on every theme toggle, not just on first meeting
   *  open. The A4 render is a separate iframe document baked into a static
   *  srcdoc string; without this the iframe's CSS was only ever generated
   *  once and a meeting opened in dark mode stayed dark forever even after
   *  switching back to light (2026-07-21 bug, mirrors applyTheme's
   *  re-render call in JavaScript.html). */
  theme: Theme
}

// Mirrors openMeeting() + renderDetail().
export default function MeetingDetail({ id, byId, projects, isAdmin, onToast, onBusy, onEdit, onMutated, execUrl, theme }: Props) {
  const [m, setM] = useState<MeetingFull | null>(getCached(id) ?? null)
  const [loading, setLoading] = useState(!getCached(id))
  const [err, setErr] = useState('')
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { confirm, node: confirmNode } = useConfirm()

  useEffect(() => {
    let alive = true
    const cached = getCached(id)
    if (cached) { setM(cached); setLoading(false); return }
    setLoading(true); setErr(''); setM(null)
    fetchMeeting(id).then(full => {
      if (!alive) return
      setM(full); setLoading(false)
    }).catch(e => { if (alive) { setErr(e instanceof Error ? e.message : String(e)); setLoading(false) } })
    return () => { alive = false }
  }, [id])

  function onFrameLoad(): void {
    const frame = frameRef.current
    if (!frame) return
    try {
      if (isMobile()) {
        applyMobileScale(frame)
        setTimeout(() => applyMobileScale(frame), 600)
        const d = frame.contentWindow?.document
        if (d?.fonts?.ready) d.fonts.ready.then(() => applyMobileScale(frame))
      } else {
        const h = frame.contentWindow!.document.body.scrollHeight
        frame.style.height = (h + 48) + 'px'
      }
    } catch { frame.style.height = '1400px' }
  }

  async function togglePin(): Promise<void> {
    if (!m) return
    onBusy('Updating…')
    try {
      const now = await api.togglePin(m.id, getToken())
      const next = { ...m, pinned: now }; setCached(m.id, next); setM(next); onMutated()
      onToast(now ? 'Pinned' : 'Unpinned')
    } catch (e) { onToast('Failed: ' + (e instanceof Error ? e.message : String(e))) } finally { onBusy(null) }
  }
  async function toggleVisibility(): Promise<void> {
    if (!m) return
    onBusy(m.visible ? 'Hiding from staff…' : 'Publishing to staff…')
    try {
      const now = await api.setVisibility(m.id, !m.visible, getToken())
      const next = { ...m, visible: now }; setCached(m.id, next); setM(next); onMutated()
      onToast(now ? 'Now visible to all staff' : 'Hidden from staff')
    } catch (e) { onToast('Failed: ' + (e instanceof Error ? e.message : String(e))) } finally { onBusy(null) }
  }
  // Re-fetches from the server right before opening the editor, rather than
  // trusting the locally-cached `m` — that cache is populated once when the
  // meeting is first opened and never invalidated afterward. If a
  // Fathom/Transkriptor force-refresh (or anyone else's edit) landed on the
  // server AFTER this detail pane was first loaded, editing from the stale
  // cached copy would show old content and silently overwrite the server's
  // newer version on save (confirmed bug 2026-07-21 — mirrors d_editapp's
  // onclick handler in JavaScript.html).
  async function openEditFresh(): Promise<void> {
    if (!m) return
    onBusy('Loading…')
    try {
      const fresh = await api.getMeeting(m.id, getToken())
      if (fresh) setCached(m.id, fresh)
      onEdit(fresh || m)
    } catch (e) { onToast('Failed to load latest content: ' + (e instanceof Error ? e.message : String(e))) }
    finally { onBusy(null) }
  }
  function share(): void {
    const base = (execUrl || '').split('?')[0]
    const link = base ? base + '?meeting=' + encodeURIComponent(m!.id) : m!.id
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link).then(() => onToast('Share link copied to clipboard'), () => window.prompt('Copy this link to share:', link))
    } else window.prompt('Copy this link to share:', link)
  }
  // Removes just ONE project's tag, leaving any other tags on the recording
  // intact — never a single ambiguous "untag everything" action. Mirrors the
  // per-chip ✕ button in JavaScript.html's renderDetail().
  async function untagOne(projectId: string): Promise<void> {
    if (!m) return
    const target = byId[projectId]
    onBusy('Removing from ' + (target?.name || projectId) + '…')
    try {
      const list = await api.untagFathomMeeting(m.id, projectId, getToken())
      const next = { ...m, taggedProjectIds: list }; setCached(m.id, next); setM(next); onMutated()
      onToast('Removed from ' + (target?.name || projectId) + ' — still in Fathom Inbox')
    } catch (e) { onToast('Failed: ' + (e instanceof Error ? e.message : String(e))) } finally { onBusy(null) }
  }
  function onTagged(projectName: string): void {
    // Re-fetch so taggedProjectIds reflects the server's authoritative list.
    fetchMeeting(id).then(full => { setM(full); onMutated() })
    onToast('Now also showing in ' + projectName)
  }
  function print(): void {
    const f = frameRef.current
    try { f!.contentWindow!.focus(); f!.contentWindow!.print() } catch { window.print() }
  }
  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !m) return
    if (file.size > ATTACH_MAX_BYTES) { onToast('File too large (max 25MB)'); return }
    onBusy('Uploading ' + file.name + '…')
    try {
      const base64 = await fileToBase64(file)
      const attachments = await api.addAttachment(m.id, file.name, file.type || 'application/octet-stream', base64, getToken())
      const next = { ...m, attachments }; setCached(m.id, next); setM(next); onMutated()
      onToast('Attached ' + file.name)
    } catch (e2) { onToast('Failed: ' + (e2 instanceof Error ? e2.message : String(e2))) } finally { onBusy(null) }
  }
  async function removeAttachment(fileId: string): Promise<void> {
    if (!m) return
    const ok = await confirm('This cannot be undone.', { title: 'Remove this attachment?', okLabel: 'Remove' })
    if (!ok) return
    onBusy('Removing attachment…')
    try {
      const attachments = await api.removeAttachment(m.id, fileId, getToken())
      const next = { ...m, attachments }; setCached(m.id, next); setM(next); onMutated()
      onToast('Attachment removed')
    } catch (e) { onToast('Failed: ' + (e instanceof Error ? e.message : String(e))) } finally { onBusy(null) }
  }

  if (loading) return <div className="placeholder"><div className="spin" style={{ borderColor: '#ccc', borderTopColor: '#0b3d62' }} /><div>Loading…</div></div>
  if (err) return <div className="placeholder">Error: {err}</div>
  if (!m) { return <div className="placeholder"><div className="big">📄</div><div>Select a meeting on the left to read the full minutes.</div></div> }

  const p = byId[m.projectId] || ({} as Project)
  const editable = isAdmin && m.source !== 'doc-import'
  const srcdoc = buildMeetingSrcdoc(m.html, m.css, fmtThaiDate(m), {
    isDark: theme === 'dark',
    aiDisclaimer: m.source === 'fathom' || m.source === 'transkriptor',
    pdfTitle: m.title,
    execUrl,
    meetingId: m.id
  })

  return (
    <>
      <div className="detail-bar">
        <h2>{m.title}</h2>
        {isAdmin && <button className={'dbtn' + (m.visible ? '' : ' danger')} id="d_vis" onClick={toggleVisibility}>{m.visible ? '👁 Visible to staff' : '🚫 Hidden'}</button>}
        {isAdmin && <button className="dbtn" id="d_pin" title="Pin" onClick={togglePin}>{m.pinned ? <>★ <span className="blbl">Pinned</span></> : <>☆ <span className="blbl">Pin</span></>}</button>}
        {isAdmin && (m.source === 'fathom' || m.source === 'transkriptor') && (
          <button className="dbtn primary" id="d_file" title="Also show this in a project" onClick={() => setTagPickerOpen(true)}>📂 File into project…</button>
        )}
        {m.fathomUrl && <a className="dbtn" id="d_recording" href={m.fathomUrl} target="_blank" rel="noreferrer">▶ Recording</a>}
        {editable && <button className="dbtn primary" id="d_editapp" onClick={openEditFresh}>✎ Edit here</button>}
        {isAdmin && m.docUrl && <a className="dbtn" id="d_docedit" href={m.docUrl} target="_blank" rel="noreferrer">Open in Google Docs</a>}
        <button className="dbtn" id="d_share" title="Share link" onClick={share}>🔗 <span className="blbl">Share link</span></button>
        <button className="dbtn" id="d_print" onClick={print}>🖨 Print / PDF</button>
        <div className="sub">{p.name || ''} · {fmtDate(m)}{fmtTime(m) ? ' · ' + fmtTime(m) : ''}</div>
      </div>

      {m.attendees.length > 0 && (
        <div className="attendees">
          <span className="atl">Attendees · {m.attendees.length}</span>
          {m.attendees.map(e => {
            const name = e.split('@')[0].replace(/[._]/g, ' ')
            return (
              <a key={e} className="chip" href={'mailto:' + e} title={e}>
                <span className="av">{e.charAt(0).toUpperCase()}</span>
                <span className="cm"><b>{name}</b><small>{e}</small></span>
              </a>
            )
          })}
        </div>
      )}

      {isAdmin && (m.source === 'fathom' || m.source === 'transkriptor') && m.taggedProjectIds.length > 0 && (
        <div className="attendees tag-chips">
          <span className="atl">Also tagged into</span>
          {m.taggedProjectIds.map(pid => {
            const tp = byId[pid] || ({ name: pid, color: '#888' } as Project)
            return (
              <span key={pid} className="chip tagchip" style={{ ['--c' as string]: tp.color }}>
                <span className="cm"><b>{tp.name}</b></span>
                <button type="button" className="chip-x" title={'Remove from ' + tp.name} onClick={() => untagOne(pid)}>✕</button>
              </span>
            )
          })}
        </div>
      )}

      {(m.attachments.length > 0 || isAdmin) && (
        <div className="attendees">
          <span className="atl">Attachments{m.attachments.length ? ' · ' + m.attachments.length : ''}</span>
          {m.attachments.map(a => {
            const { cls, label } = fileIconKind(a.mimeType, a.name)
            return (
              <span key={a.fileId} className="chip attachchip">
                <a href={a.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit' }}>
                  <span className={'fi ' + cls}>{label}</span>
                  <span className="cm"><b>{a.name}</b><small>{fmtFileSize(a.size)}</small></span>
                </a>
                {isAdmin && <button type="button" className="chip-x" title="Remove attachment" onClick={() => removeAttachment(a.fileId)}>✕</button>}
              </span>
            )
          })}
          {isAdmin && <button type="button" className="attach-upload-btn" onClick={() => fileInputRef.current?.click()}>＋ Attach file</button>}
        </div>
      )}

      <div className="frame-wrap">
        <div className="paper">
          <iframe className="render" id="renderFrame" ref={frameRef} srcDoc={srcdoc} onLoad={onFrameLoad} title="meeting" />
        </div>
      </div>
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept={ATTACH_ACCEPT} onChange={onFilePicked} />

      <TagPickerModal
        open={tagPickerOpen} meeting={m} projects={projects}
        onClose={() => setTagPickerOpen(false)} onTagged={onTagged} onBusy={onBusy} onToast={onToast}
      />
      {confirmNode}
    </>
  )
}
