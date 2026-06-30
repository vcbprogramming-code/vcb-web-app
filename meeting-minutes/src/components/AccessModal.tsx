import { useEffect, useState } from 'react'
import type { ProjectAccess } from '../types'
import { api, getToken } from '../api/client'

interface Props {
  open: boolean
  onClose: () => void
  onBusy: (msg: string | null) => void
  onToast: (msg: string) => void
}

// Mirrors the per-project access modal in Index.html + openAccess()/renderProjectAccess().
export default function AccessModal({ open, onClose, onBusy, onToast }: Props) {
  const [list, setList] = useState<ProjectAccess[] | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setList(null)
    api.getProjectAccess(getToken()).then(setList).catch(e => onToast('Failed: ' + (e instanceof Error ? e.message : String(e))))
  }, [open])

  if (!open) return null

  const run = (label: string, p: Promise<ProjectAccess[]>) => {
    onBusy(label)
    p.then(setList).catch(e => onToast('Failed: ' + (e instanceof Error ? e.message : String(e)))).finally(() => onBusy(null))
  }
  const toggleDomain = (id: string, checked: boolean) => run('Updating…', api.setProjectDomain(id, checked, getToken()))
  const addViewer = (id: string) => {
    const email = (drafts[id] || '').trim(); if (!email) return
    setDrafts(d => ({ ...d, [id]: '' }))
    run('Adding…', api.addProjectViewer(id, email, getToken()))
  }
  const removeViewer = (id: string, email: string) => run('Updating…', api.removeProjectViewer(id, email, getToken()))

  return (
    <div className="modal-bg show" onClick={e => { if ((e.target as HTMLElement).classList.contains('modal-bg')) onClose() }}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <h3>Project access</h3>
        <div className="ac-note" style={{ padding: '2px 20px 6px' }}>For each project: tick to allow all <b>@vcb-con.com</b> staff, and/or add specific email addresses (any email — gmail, hotmail, etc.). The dashboard tiles stay visible to everyone; this controls who can open the meetings.</div>
        <div className="form" style={{ gap: 8, maxHeight: 'calc(88vh - 150px)', overflow: 'auto', scrollbarGutter: 'stable' }}>
          {!list ? <div className="empty">Loading…</div> : list.map(p => (
            <div key={p.id} className="ac-proj">
              <div className="ac-proj-name"><span className="dot" style={{ background: p.color }} />{p.name}</div>
              <label className="ac-dom">
                <input type="checkbox" checked={p.domain} onChange={e => toggleDomain(p.id, e.target.checked)} /> Allow all @vcb-con.com staff
              </label>
              {p.emails.length > 0 && (
                <div className="ac-list">
                  {p.emails.map(em => (
                    <div key={em} className="ac-item"><span>{em}</span><button onClick={() => removeViewer(p.id, em)}>Remove</button></div>
                  ))}
                </div>
              )}
              <div className="ac-add">
                <input
                  type="email" placeholder="add email (any address)"
                  value={drafts[p.id] || ''}
                  onChange={e => setDrafts(d => ({ ...d, [p.id]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') addViewer(p.id) }}
                />
                <button className="dbtn primary" onClick={() => addViewer(p.id)}>Add</button>
              </div>
            </div>
          ))}
        </div>
        <div className="actions"><button className="dbtn" onClick={onClose}>Close</button></div>
      </div>
    </div>
  )
}
