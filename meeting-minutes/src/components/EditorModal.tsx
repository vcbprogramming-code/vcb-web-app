import { useEffect, useRef, useState } from 'react'
import type { MeetingFull } from '../types'
import { api, getToken } from '../api/client'
import { setCached } from '../api/contentCache'

interface Props {
  meeting: MeetingFull | null   // non-null => open
  onClose: () => void
  onSaved: (id: string) => void
  onBusy: (msg: string | null) => void
  onToast: (msg: string) => void
}

// Mirrors the in-app content editor in Index.html + openEditor()/edSave().
// Uses contentEditable + document.execCommand exactly like the GAS original.
export default function EditorModal({ meeting, onClose, onSaved, onBusy, onToast }: Props) {
  const areaRef = useRef<HTMLDivElement>(null)
  const [writeDoc, setWriteDoc] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (meeting && areaRef.current) {
      areaRef.current.innerHTML = meeting.html || ''
      setWriteDoc(true)
      areaRef.current.focus()
    }
  }, [meeting])

  if (!meeting) return null

  const focusArea = () => areaRef.current?.focus()
  const cmd = (c: string) => { document.execCommand(c, false); focusArea() }
  const block = (b: string) => { document.execCommand('formatBlock', false, b); focusArea() }
  const link = () => { const u = window.prompt('Link URL:', 'https://'); if (u) document.execCommand('createLink', false, u); focusArea() }
  const unlink = () => { document.execCommand('unlink', false); focusArea() }
  const prevent = (e: React.MouseEvent) => e.preventDefault()

  async function save(): Promise<void> {
    const html = areaRef.current?.innerHTML ?? ''
    setSaving(true); onBusy(writeDoc ? 'Saving + updating Google Doc…' : 'Saving…')
    try {
      const res = await api.saveEdit(meeting!.id, html, writeDoc, getToken())
      setCached(meeting!.id, { ...meeting!, html })
      onSaved(meeting!.id)
      if (res.doc.attempted) onToast(res.doc.ok ? 'Saved · Google Doc updated' : 'Saved in app · Doc update failed (see version history)')
      else onToast('Saved')
    } catch (e) { onToast('Save failed: ' + (e instanceof Error ? e.message : String(e))) }
    finally { setSaving(false); onBusy(null) }
  }

  return (
    <div className="modal-bg show" onClick={e => { if ((e.target as HTMLElement).classList.contains('modal-bg')) onClose() }}>
      <div className="editor">
        <h3>Edit meeting <span id="edTitle">· {meeting.title}</span></h3>
        <div className="ed-toolbar">
          <button type="button" title="Bold" onMouseDown={prevent} onClick={() => cmd('bold')}><b>B</b></button>
          <button type="button" title="Italic" onMouseDown={prevent} onClick={() => cmd('italic')}><i>I</i></button>
          <button type="button" onMouseDown={prevent} onClick={() => block('H2')}>Heading</button>
          <button type="button" onMouseDown={prevent} onClick={() => block('H3')}>Subheading</button>
          <button type="button" onMouseDown={prevent} onClick={() => block('P')}>Normal</button>
          <button type="button" onMouseDown={prevent} onClick={() => cmd('insertUnorderedList')}>• List</button>
          <button type="button" onMouseDown={prevent} onClick={() => cmd('insertOrderedList')}>1. List</button>
          <button type="button" onMouseDown={prevent} onClick={link}>🔗 Link</button>
          <button type="button" onMouseDown={prevent} onClick={unlink}>Unlink</button>
        </div>
        <div className="ed-area" ref={areaRef} contentEditable suppressContentEditableWarning />
        <div className="actions">
          <label className="ed-doc"><input type="checkbox" checked={writeDoc} onChange={e => setWriteDoc(e.target.checked)} /> Also update the source Google&nbsp;Doc <span className="hint">(version history can undo)</span></label>
          <button className="dbtn" onClick={onClose}>Cancel</button>
          <button className="dbtn primary" disabled={saving} onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
