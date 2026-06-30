import { useEffect, useState } from 'react'
import type { Project, MeetingFull, SaveMeetingInput } from '../types'
import { api, getToken } from '../api/client'
import { esc } from '../lib/ui'

interface Props {
  open: boolean
  meeting: MeetingFull | null   // null => New
  projects: Project[]
  onClose: () => void
  onSaved: (id: string) => void
  onDeleted: () => void
  onBusy: (msg: string | null) => void
  onToast: (msg: string) => void
}

// Mirrors the New/Edit meeting modal in Index.html + openModal()/m_save/m_delete.
export default function MeetingModal({ open, meeting, projects, onClose, onSaved, onDeleted, onBusy, onToast }: Props) {
  const [projectId, setProjectId] = useState('')
  const [title, setTitle] = useState('')
  const [dateLabel, setDateLabel] = useState('')
  const [time, setTime] = useState('')
  const [html, setHtml] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setProjectId(meeting ? meeting.projectId : (projects[0]?.id ?? ''))
    setTitle(meeting ? meeting.title : '')
    setDateLabel(meeting ? (meeting.dateLabel || '') : '')
    setTime(meeting ? (meeting.time || '') : '')
    setHtml(meeting ? (meeting.html || '') : '')
  }, [open, meeting, projects])

  if (!open) return null

  async function save(): Promise<void> {
    const raw = html.trim()
    const built = /<[a-z][\s\S]*>/i.test(raw)
      ? raw
      : raw.split(/\n{2,}/).map(para => '<p>' + esc(para).replace(/\n/g, '<br>') + '</p>').join('')
    const obj: SaveMeetingInput = {
      id: meeting?.id, projectId, title: title || 'Untitled', dateLabel, time, html: built
    }
    setSaving(true); onBusy('Saving…')
    try {
      const id = await api.saveMeeting(obj, getToken())
      onSaved(id); onToast('Saved')
    } catch (e) { onToast('Save failed: ' + (e instanceof Error ? e.message : String(e))) }
    finally { setSaving(false); onBusy(null) }
  }

  async function del(): Promise<void> {
    if (!meeting) return
    if (!window.confirm('Delete this meeting? This cannot be undone.')) return
    onBusy('Deleting…')
    try {
      await api.deleteMeeting(meeting.id, getToken())
      onDeleted(); onToast('Deleted')
    } catch (e) { onToast('Failed: ' + (e instanceof Error ? e.message : String(e))) }
    finally { onBusy(null) }
  }

  return (
    <div className="modal-bg show" onClick={e => { if ((e.target as HTMLElement).classList.contains('modal-bg')) onClose() }}>
      <div className="modal">
        <h3>{meeting ? 'Edit meeting' : 'New meeting'}</h3>
        <div className="form">
          <div>
            <label>Project</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Monthly review — financials" />
          </div>
          <div className="row2">
            <div><label>Date (e.g. 21/05/2569 or 21 May 2569)</label><input value={dateLabel} onChange={e => setDateLabel(e.target.value)} placeholder="dd/mm/2569" /></div>
            <div><label>Time</label><input value={time} onChange={e => setTime(e.target.value)} placeholder="10:00AM" /></div>
          </div>
          <div>
            <label>Content (plain text or HTML — headings, bullets, links all welcome)</label>
            <textarea value={html} onChange={e => setHtml(e.target.value)} placeholder="Paste or type the minutes here…" />
          </div>
        </div>
        <div className="actions">
          {meeting && <button className="dbtn danger" style={{ marginRight: 'auto' }} onClick={del}>Delete</button>}
          <button className="dbtn" onClick={onClose}>Cancel</button>
          <button className="dbtn primary" disabled={saving} onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
