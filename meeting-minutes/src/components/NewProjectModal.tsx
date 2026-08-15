import { useEffect, useState } from 'react'
import type { CreatedProject } from '../types'
import { api, getToken } from '../api/client'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (p: CreatedProject) => void
  onBusy: (msg: string | null) => void
  onToast: (msg: string) => void
}

// Self-serve project creation — mirrors createProject() in Code.js and the
// "New project" modal in Index.html/JavaScript.html. In the real app this
// creates an actual Google Doc; here the mock just registers the definition
// (see mock.ts createProject) so the rest of the app treats it identically to
// the 5 hardcoded projects.
export default function NewProjectModal({ open, onClose, onCreated, onBusy, onToast }: Props) {
  const [name, setName] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [cadence, setCadence] = useState('Monthly')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(''); setNameEn(''); setCadence('Monthly')
  }, [open])

  if (!open) return null

  async function create(): Promise<void> {
    const trimmed = name.trim()
    if (!trimmed) { onToast('Project name is required'); return }
    setSaving(true); onBusy('Creating project…')
    try {
      const p = await api.createProject(trimmed, nameEn.trim(), cadence, getToken())
      onCreated(p)
    } catch (e) { onToast('Failed: ' + (e instanceof Error ? e.message : String(e))) }
    finally { setSaving(false); onBusy(null) }
  }

  return (
    <div className="modal-bg show" onClick={e => { if ((e.target as HTMLElement).classList.contains('modal-bg')) onClose() }}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <h3>New project</h3>
        <p className="subhead">Creates a new Google Doc for this project's meeting minutes, and adds it to the sidebar.</p>
        <div className="form">
          <div>
            <label>Project name (Thai or however you'll title it)</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. โครงการหลวงพระบาง" />
          </div>
          <div>
            <label>English name (used for sidebar subtitle + internal reference)</label>
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
          <button className="dbtn primary" disabled={saving} onClick={create}>Create project</button>
        </div>
      </div>
    </div>
  )
}
