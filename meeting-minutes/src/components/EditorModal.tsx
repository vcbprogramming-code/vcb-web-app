import { useEffect, useRef, useState } from 'react'
import type { AuditEntry, MeetingFull } from '../types'
import { api, getToken } from '../api/client'
import { setCached } from '../api/contentCache'
import { useConfirm, usePrompt } from './ConfirmPrompt'
import EditHistoryModal from './EditHistoryModal'
import VersionPreviewModal from './VersionPreviewModal'

interface Props {
  meeting: MeetingFull | null   // non-null => open
  projectName?: string
  onClose: () => void
  onSaved: (id: string) => void
  onDeleted: () => void
  onBusy: (msg: string | null) => void
  onToast: (msg: string) => void
}

// Mirrors the in-app content editor in Index.html (#edBg) + openEditor()/
// closeEditor()/edSave/edDelete/edCancel in JavaScript.html. Uses
// contentEditable + document.execCommand exactly like the GAS original.
//
// Docs are no longer the source of truth (2026-07-19) — every meeting is
// edited directly here regardless of where its content originally came from.
// The old "Also update the source Google Doc" checkbox + writeToDoc param are
// gone; there is nothing left to write back to.
export default function EditorModal({ meeting, projectName, onClose, onSaved, onDeleted, onBusy, onToast }: Props) {
  const areaRef = useRef<HTMLDivElement>(null)
  const [title, setTitle] = useState('')
  const [dateLabel, setDateLabel] = useState('')
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)
  const snapshotRef = useRef<string | null>(null)
  const { confirm, node: confirmNode } = useConfirm()
  const { prompt, node: promptNode } = usePrompt()
  const [historyMeeting, setHistoryMeeting] = useState<MeetingFull | null>(null)
  const [previewRequest, setPreviewRequest] = useState<{ meetingId: string; seq: string } | null>(null)

  function snapshot(): string {
    return title + '' + dateLabel + '' + time + '' + (areaRef.current?.innerHTML ?? '')
  }

  useEffect(() => {
    if (meeting && areaRef.current) {
      areaRef.current.innerHTML = meeting.html || ''
      setTitle(meeting.title || '')
      setDateLabel(meeting.dateLabel || '')
      setTime(meeting.time || '')
      areaRef.current.focus()
      // Snapshot after the DOM/state above has been applied this tick.
      queueMicrotask(() => { snapshotRef.current = snapshot() })
    } else {
      snapshotRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting])

  if (!meeting) return null

  const focusArea = () => areaRef.current?.focus()
  const cmd = (c: string) => { document.execCommand(c, false); focusArea() }
  const prevent = (e: React.MouseEvent) => e.preventDefault()

  async function addLink(): Promise<void> {
    // Selection is lost once the dialog steals focus, so it must be captured
    // now and restored before execCommand runs.
    const sel = window.getSelection()
    const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null
    const u = await prompt('Link URL', { title: 'Add a link', placeholder: 'https://', okLabel: 'Add' })
    if (!u) { focusArea(); return }
    if (range && sel) { sel.removeAllRanges(); sel.addRange(range) }
    document.execCommand('createLink', false, u)
    focusArea()
  }
  const unlink = () => { document.execCommand('unlink', false); focusArea() }

  async function handleCancel(): Promise<void> {
    if (snapshotRef.current !== null && snapshot() !== snapshotRef.current) {
      const ok = await confirm('Anything you typed will be lost.', { title: 'Discard unsaved changes?', okLabel: 'Discard' })
      if (ok) onClose()
    } else {
      onClose()
    }
  }

  async function save(): Promise<void> {
    const html = areaRef.current?.innerHTML ?? ''
    const meta = { title: title.trim(), dateLabel: dateLabel.trim(), time: time.trim() }
    setSaving(true); onBusy('Saving…')
    try {
      await api.saveEdit(meeting!.id, html, getToken(), meta)
      setCached(meeting!.id, { ...meeting!, html, title: meta.title || meeting!.title, dateLabel: meta.dateLabel || meeting!.dateLabel, time: meta.time })
      onSaved(meeting!.id)
      onToast('Saved')
    } catch (e) { onToast('Save failed: ' + (e instanceof Error ? e.message : String(e))) }
    finally { setSaving(false); onBusy(null) }
  }

  async function handleDelete(): Promise<void> {
    const ok = await confirm('This cannot be undone.', { title: 'Delete this meeting?', okLabel: 'Delete' })
    if (!ok) return
    onBusy('Deleting…')
    try {
      await api.deleteMeeting(meeting!.id, getToken())
      onDeleted()
      onToast('Deleted')
    } catch (e) { onToast('Failed: ' + (e instanceof Error ? e.message : String(e))) }
    finally { onBusy(null) }
  }

  const fetchHistory = (id: string): Promise<AuditEntry[]> => api.getAuditHistory(id, getToken())

  return (
    <>
      <div className="modal-bg show" /* backdrop click no longer closes this editor — an accidental
           click outside the modal must never silently discard an in-progress edit */>
        <div className="editor">
          <h3>Edit meeting</h3>
          <div className="ed-meta">
            <div>
              <label>Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Meeting title" />
            </div>
            <div>
              <label>Date</label>
              <input value={dateLabel} onChange={e => setDateLabel(e.target.value)} placeholder="e.g. 21 May 2569 or 21-05-2569" />
            </div>
            <div>
              <label>Time</label>
              <input value={time} onChange={e => setTime(e.target.value)} placeholder="e.g. 10:00" />
            </div>
          </div>
          <div className="ed-toolbar">
            <span className="ed-group">
              <button type="button" title="Bold" onMouseDown={prevent} onClick={() => cmd('bold')}><b>B</b></button>
              <button type="button" title="Italic" onMouseDown={prevent} onClick={() => cmd('italic')}><i>I</i></button>
            </span>
            <span className="ed-sep" />
            <span className="ed-group">
              <button type="button" title="Bullet list" onMouseDown={prevent} onClick={() => cmd('insertUnorderedList')}>• List</button>
              <button type="button" title="Numbered list" onMouseDown={prevent} onClick={() => cmd('insertOrderedList')}>1. List</button>
            </span>
            <span className="ed-sep" />
            <span className="ed-group">
              <button type="button" title="Add a hyperlink" onMouseDown={prevent} onClick={addLink}>🔗 Link</button>
              <button type="button" title="Remove hyperlink" onMouseDown={prevent} onClick={unlink}>Unlink</button>
            </span>
          </div>
          <div className="ed-area" ref={areaRef} contentEditable suppressContentEditableWarning />
          <div className="actions">
            <button className="dbtn" style={{ marginRight: 'auto' }} title="See who edited this and when" onClick={() => setHistoryMeeting(meeting)}>🕘 Edit history</button>
            <button className="dbtn danger" onClick={handleDelete}>🗑 Delete meeting</button>
            <button className="dbtn" onClick={handleCancel}>Cancel</button>
            <button className="dbtn primary" disabled={saving} onClick={save}>Save</button>
          </div>
        </div>
      </div>

      <EditHistoryModal
        meeting={historyMeeting}
        fetchHistory={fetchHistory}
        onClose={() => setHistoryMeeting(null)}
        onViewOriginal={(id) => setPreviewRequest({ meetingId: id, seq: 'current-original' })}
        onViewVersion={(id, seq) => setPreviewRequest({ meetingId: id, seq })}
      />
      <VersionPreviewModal
        request={previewRequest}
        meeting={historyMeeting}
        projectName={projectName || ''}
        fetchHtml={(id, seq) => seq === 'current-original' ? api.getOriginalContent(id, getToken()) : api.getVersionContent(id, seq, getToken())}
        onClose={() => setPreviewRequest(null)}
      />
      {confirmNode}
      {promptNode}
    </>
  )
}
