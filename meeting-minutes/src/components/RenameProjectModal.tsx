import { useEffect, useState } from 'react'
import type { Project } from '../types'
import { api, getToken } from '../api/client'

interface Props {
  open: boolean
  project: Project | null
  onClose: () => void
  onRenamed: () => void
  onBusy: (msg: string | null) => void
  onToast: (msg: string) => void
}

// Renames/edits any project — including the original 5 hardcoded ones — via
// renameProject. Mirrors the rename modal (rpBg) in Index.html/JavaScript.html.
export default function RenameProjectModal({ open, project, onClose, onRenamed, onBusy, onToast }: Props) {
  const [name, setName] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [cadence, setCadence] = useState('Monthly')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !project) return
    setName(project.name || ''); setNameEn(project.nameEn || ''); setCadence(project.cadence || 'Monthly')
  }, [open, project])

  if (!open || !project) return null

  async function save(): Promise<void> {
    const trimmed = name.trim()
    if (!trimmed) { onToast('Project name is required'); return }
    setSaving(true); onBusy('Saving…')
    try {
      await api.renameProject(project!.id, { name: trimmed, nameEn: nameEn.trim(), cadence }, getToken())
      onRenamed(); onToast('Renamed')
    } catch (e) { onToast('Failed: ' + (e instanceof Error ? e.message : String(e))) }
    finally { setSaving(false); onBusy(null) }
  }

  return (
    <div className="modal-bg show" onClick={e => { if ((e.target as HTMLElement).classList.contains('modal-bg')) onClose() }}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <h3>Rename project</h3>
        <div className="form">
          <div>
            <label>Project name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. โครงการหลวงพระบาง" />
          </div>
          <div>
            <label>English name</label>
            <input value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="e.g. Luang Prabang Project" />
          </div>
          <div>
            <label>Cadence</label>
            <select value={cadence} onChange={e => setCadence(e.target.value)}>
              <option>Monthly</option>
              <option>Quarterly</option>
              <option>As needed</option>
            </select>
          </div>
        </div>
        <div className="actions">
          <button className="dbtn" onClick={onClose}>Cancel</button>
          <button className="dbtn primary" disabled={saving} onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
