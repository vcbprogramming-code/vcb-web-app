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
  isEditor: boolean
  userEmail: string
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
export default function MeetingDetail({ id, byId, projects, isAdmin, isEditor, userEmail, onToast, onBusy, onEdit, onMutated, execUrl, theme }: Props) {
  const [m, setM] = useState<MeetingFull | null>(getCached(id) ?? null)
  const [loading, setLoading] = useState(!getCached(id))
  const [err, setErr] = useState('')
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [commentPosting, setCommentPosting] = useState(false)
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
  async function postComment(): Promise<void> {
    if (!m) return
    const text = commentDraft.trim()
    if (!text) return
    setCommentPosting(true)
    try {
      const comments = await api.addComment(m.id, text, getToken())
      const next = { ...m, comments }; setCached(m.id, next); setM(next)
      setCommentDraft('')
    } catch (e) { onToast('Failed: ' + (e instanceof Error ? e.message : String(e))) } finally { setCommentPosting(false) }
  }
  async function deleteComment(commentId: string): Promise<void> {
    if (!m) return
    const ok = await confirm('This cannot be undone.', { title: 'Delete this comment?', okLabel: 'Delete' })
    if (!ok) return
    onBusy('Deleting…')
    try {
      const comments = await api.removeComment(m.id, commentId, getToken())
      const next = { ...m, comments }; setCached(m.id, next); setM(next)
    } catch (e) { onToast('Failed: ' + (e instanceof Error ? e.message : String(e))) } finally { onBusy(null) }
  }
  function fmtCommentTime(iso: string): string {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) +
      ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return <div className="placeholder"><div className="spin" style={{ borderColor: '#ccc', borderTopColor: '#0b3d62' }} /><div>Loading…</div></div>
  if (err) return <div className="placeholder">Error: {err}</div>
  if (!m) { return <div className="placeholder"><div className="big">📄</div><div>Select a meeting on the left to read the full minutes.</div></div> }

  const p = byId[m.projectId] || ({} as Project)
  const canEdit = isAdmin || isEditor
  const editable = canEdit && m.source !== 'doc-import'
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
        {canEdit && (m.source === 'fathom' || m.source === 'transkriptor') && (
          <button className="dbtn primary" id="d_file" title="Also show this in a project" onClick={() => setTagPickerOpen(true)}>📂 File into project…</button>
        )}
        {m.fathomUrl && <a className="dbtn" id="d_recording" href={m.fathomUrl} target="_blank" rel="noreferrer">▶ Recording</a>}
        {editable && <button className="dbtn primary" id="d_editapp" onClick={openEditFresh}>✎ Edit here</button>}
        <button className={'dbtn' + (commentsOpen ? ' active' : '')} id="d_comments" title="Comments" onClick={() => setCommentsOpen(v => !v)}>💬 <span className="blbl">Comments</span></button>
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

      {canEdit && (m.source === 'fathom' || m.source === 'transkriptor') && m.taggedProjectIds.length > 0 && (
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

      {(m.attachments.length > 0 || canEdit) && (
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
                {canEdit && <button type="button" className="chip-x" title="Remove attachment" onClick={() => removeAttachment(a.fileId)}>✕</button>}
              </span>
            )
          })}
          {canEdit && <button type="button" className="attach-upload-btn" onClick={() => fileInputRef.current?.click()}>＋ Attach file</button>}
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

      {commentsOpen && (
        <>
          <div className="comments-backdrop" onClick={() => setCommentsOpen(false)} />
          <aside className="comments-panel">
            <div className="comments-panel-head">
              <h3>Comments</h3>
              <button className="ibtn" title="Close" onClick={() => setCommentsOpen(false)}>✕</button>
            </div>
            <div className="comments-panel-body">
              {m.comments.length === 0 && <div className="comments-empty">No comments yet.</div>}
              {m.comments.map(c => {
                const mine = isAdmin || c.author === userEmail
                return (
                  <div className="comment-row" key={c.id}>
                    <div className="comment-meta"><b>{c.author || '(unknown)'}</b><span>{fmtCommentTime(c.createdAt)}</span></div>
                    <div className="comment-text">{c.text}</div>
                    {mine && <button type="button" className="comment-del" title="Delete comment" onClick={() => deleteComment(c.id)}>✕</button>}
                  </div>
                )
              })}
            </div>
            <div className="comments-panel-foot">
              <textarea
                placeholder="Write a comment…" maxLength={4000} rows={2}
                value={commentDraft} onChange={e => setCommentDraft(e.target.value)}
              />
              <button className="dbtn primary" disabled={commentPosting || !commentDraft.trim()} onClick={postComment}>Post</button>
            </div>
          </aside>
        </>
      )}
    </>
  )
}
