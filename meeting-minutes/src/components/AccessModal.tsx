import { useEffect, useState } from 'react'
import type { EditorAccount, ProjectAccess, SharedPinStatus } from '../types'
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
  // Editor ACCOUNTS, not just emails: an editor who is allow-listed but has no
  // PIN still cannot sign in, and showing only the email hid that entirely.
  const [editors, setEditors] = useState<EditorAccount[] | null>(null)
  const [shared, setShared] = useState<SharedPinStatus | null>(null)
  const [sharedShown, setSharedShown] = useState(false)
  const [editorDraft, setEditorDraft] = useState('')

  useEffect(() => {
    if (!open) return
    setList(null)
    setEditors(null)
    setShared(null)
    // Re-hide a revealed PIN whenever the panel is reopened, so it is never
    // left on screen from a previous visit.
    setSharedShown(false)
    api.getProjectAccess(getToken()).then(setList).catch(e => onToast('Failed: ' + (e instanceof Error ? e.message : String(e))))
    api.getEditorAccounts(getToken()).then(setEditors).catch(e => onToast('Failed: ' + (e instanceof Error ? e.message : String(e))))
    api.getSharedPinStatus(getToken(), false).then(setShared).catch(() => setShared({ enabled: false, setAt: '' }))
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

  // addEditor/removeEditor return the plain email list, but the panel now shows
  // richer ACCOUNT rows (who can actually sign in), so re-read those after any
  // mutation rather than trusting the returned shape.
  const reloadEditors = (): Promise<void> =>
    api.getEditorAccounts(getToken()).then(setEditors).catch(() => { /* leave as-is */ })
  const runEditors = (label: string, p: Promise<unknown>) => {
    onBusy(label)
    p.then(reloadEditors).catch(e => onToast('Failed: ' + (e instanceof Error ? e.message : String(e)))).finally(() => onBusy(null))
  }
  const addEditor = () => {
    const email = editorDraft.trim(); if (!email) return
    setEditorDraft('')
    runEditors('Adding…', api.addEditor(email, getToken()))
  }
  const removeEditor = (email: string) => runEditors('Updating…', api.removeEditor(email, getToken()))

  // A PIN an ADMIN chose. The employee is forced to replace it on first
  // sign-in, so the admin stops knowing it.
  const setPinFor = (email: string) => {
    const pin = window.prompt('New PIN for ' + email + ' (4 digits)')
    if (pin == null) return
    if (!/^\d{4}$/.test(pin.trim())) { onToast('PIN must be exactly 4 digits.'); return }
    onBusy('Saving…')
    api.setEditorPassword(email, pin.trim(), getToken())
      .then(reloadEditors)
      .then(() => onToast('PIN set for ' + email + ' — they must change it on first sign-in.'))
      // Surface the real reason: a silent failure here is what once made this
      // look like "I set it but it still says no PIN".
      .catch(e => onToast('Could not set PIN: ' + (e instanceof Error ? e.message : String(e))))
      .finally(() => onBusy(null))
  }

  // The optional SHARED team PIN — one number several trusted editors may use.
  // Unlike a personal PIN it is stored recoverably, because its whole purpose
  // is to be told to people; a personal PIN is one-way hashed and can never be
  // read back, only replaced.
  const reloadShared = (reveal: boolean): Promise<void> =>
    api.getSharedPinStatus(getToken(), reveal).then(setShared).catch(() => { /* leave as-is */ })
  const toggleShared = () => {
    const next = !sharedShown
    setSharedShown(next)
    onBusy(next ? 'Loading…' : 'Hiding…')
    reloadShared(next).finally(() => onBusy(null))
  }
  const setSharedPin = () => {
    const pin = window.prompt('Shared PIN for the team (4 digits)')
    if (pin == null) return
    if (!/^\d{4}$/.test(pin.trim())) { onToast('PIN must be exactly 4 digits.'); return }
    onBusy('Saving…')
    api.setSharedEditorPin(pin.trim(), getToken())
      .then(() => { setSharedShown(true); return reloadShared(true) })
      .then(() => onToast('Shared PIN set. Any editor on the list can now use it.'))
      .catch(e => onToast('Could not set the shared PIN: ' + (e instanceof Error ? e.message : String(e))))
      .finally(() => onBusy(null))
  }
  const clearSharedPin = () => {
    if (!window.confirm('Turn off the shared PIN? Anyone relying on it will need their own PIN.')) return
    onBusy('Updating…')
    api.clearSharedEditorPin(getToken())
      .then(() => { setSharedShown(false); return reloadShared(false) })
      .then(() => onToast('Shared PIN turned off.'))
      .catch(e => onToast('Failed: ' + (e instanceof Error ? e.message : String(e))))
      .finally(() => onBusy(null))
  }

  return (
    <div className="modal-bg show" onClick={e => { if ((e.target as HTMLElement).classList.contains('modal-bg')) onClose() }}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <h3>Project access</h3>

        <div className="ac-note" style={{ padding: '2px 20px 6px' }}>Editors can edit meeting content, add/remove attachments, create/delete meetings, and file Fathom/Transkriptor recordings into projects. They cannot manage access, projects, or hidden/pinned status.</div>
        <div className="ac-list" style={{ marginBottom: 14, padding: '0 20px' }}>
          {!editors ? <div className="empty">Loading…</div> : (editors.length ? editors.map(a => (
            <div key={a.email} className="ac-item">
              <span>
                {a.email}
                {/* Being on the list is only half of it — without a PIN they
                    still cannot sign in. Surfacing that is what stops an
                    allow-listed employee being silently stranded. */}
                {a.hasPassword
                  ? (a.mustChange
                      ? <span className="ac-badge warn">must change</span>
                      : <span className="ac-badge ok">can sign in</span>)
                  : <span className="ac-badge bad">no PIN</span>}
              </span>
              <span style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setPinFor(a.email)}>{a.hasPassword ? 'Reset PIN' : 'Set PIN'}</button>
                <button onClick={() => removeEditor(a.email)}>Remove</button>
              </span>
            </div>
          )) : <div className="empty" style={{ padding: '4px 0' }}>No editors yet.</div>)}
        </div>
        <div className="ac-add" style={{ padding: '0 20px' }}>
          <input
            type="email" placeholder="add editor email"
            value={editorDraft}
            onChange={e => setEditorDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addEditor() }}
          />
          <button className="dbtn primary" onClick={addEditor}>Add</button>
        </div>

        {/* Optional shared team PIN — one number for a small group of trusted
            people, instead of an account each. The email must STILL be on the
            list above, so this is a convenience, not a skeleton key. */}
        <div className="ac-shared" style={{ margin: '14px 20px 0' }}>
          <div className="ac-section-title" style={{ marginTop: 2 }}>
            Shared team PIN <span style={{ fontWeight: 400, color: 'var(--ink-faint)', fontSize: 12 }}>— optional</span>
          </div>
          <div className="ac-note" style={{ padding: '2px 0 6px' }}>
            One PIN any editor above may use, instead of giving each person their own. The email must still be on the list,
            so this alone grants nothing — but everyone using it looks the same in the edit history, and changing it changes
            it for all of them.
          </div>
          <div className="ac-shared-row">
            {shared?.enabled && sharedShown
              ? <span className="ac-shared-value">{shared.pin || ''}</span>
              : <span className="ac-shared-state">{shared?.enabled ? 'Set — hidden' : 'Not set'}</span>}
            <span style={{ flex: 1 }} />
            {shared?.enabled && <button className="dbtn" onClick={toggleShared}>{sharedShown ? 'Hide' : 'Show'}</button>}
            <button className="dbtn" onClick={setSharedPin}>{shared?.enabled ? 'Change PIN' : 'Set PIN'}</button>
            {shared?.enabled && <button className="dbtn" onClick={clearSharedPin}>Turn off</button>}
          </div>
        </div>

        <div className="ac-note" style={{ padding: '18px 20px 6px' }}>For each project: tick to allow all <b>@vcb-con.com</b> staff, and/or add specific email addresses (any email — gmail, hotmail, etc.). The dashboard tiles stay visible to everyone; this controls who can open the meetings.</div>
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
