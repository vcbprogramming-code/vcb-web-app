import { useEffect, useState } from 'react'
import type { EditorAccount, ProjectAccess, ProjectId, SharedPinStatus } from '../types'
import { api, getToken } from '../api/client'

interface Props {
  open: boolean
  onClose: () => void
  onBusy: (msg: string | null) => void
  onToast: (msg: string) => void
}

// Mirrors the per-project access page in Index.html + openAccess()/renderProjectAccess().
//
// This is a full-page workspace, not a dialog. Naming the people who may see
// each project means many projects x many addresses, and the old centred modal
// gave that a cramped scroll box floating over a dimmed app.
export default function AccessModal({ open, onClose, onBusy, onToast }: Props) {
  const [list, setList] = useState<ProjectAccess[] | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  // Editor ACCOUNTS, not just emails: an editor who is allow-listed but has no
  // PIN still cannot sign in, and showing only the email hid that entirely.
  const [editors, setEditors] = useState<EditorAccount[] | null>(null)
  const [shared, setShared] = useState<SharedPinStatus | null>(null)
  const [sharedShown, setSharedShown] = useState(false)
  const [editorDraft, setEditorDraft] = useState('')
  const [tab, setTab] = useState<'projects' | 'editors'>('projects')
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (!open) return
    setList(null)
    setEditors(null)
    setShared(null)
    setTab('projects')
    setFilter('')
    // Re-hide a revealed PIN whenever the panel is reopened, so it is never
    // left on screen from a previous visit.
    setSharedShown(false)
    api.getProjectAccess(getToken()).then(setList).catch(e => onToast('Failed: ' + (e instanceof Error ? e.message : String(e))))
    api.getEditorAccounts(getToken()).then(setEditors).catch(e => onToast('Failed: ' + (e instanceof Error ? e.message : String(e))))
    api.getSharedPinStatus(getToken(), false).then(setShared).catch(() => setShared({ enabled: false, setAt: '' }))
  }, [open])

  // The page owns the viewport while it is up, so the app behind it must not
  // scroll. Cleanup runs on close and on unmount alike.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Esc closes the page, unless a text field has something typed in it — there
  // it clears the field instead of throwing away the screen.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const t = e.target as HTMLElement | null
      if (t && t.tagName === 'INPUT' && (t as HTMLInputElement).value) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const run = (label: string, p: Promise<ProjectAccess[]>) => {
    onBusy(label)
    p.then(setList).catch(e => onToast('Failed: ' + (e instanceof Error ? e.message : String(e)))).finally(() => onBusy(null))
  }

  const togglePublic = (p: ProjectAccess) => {
    const willBePublic = !p.isPublic
    if (willBePublic && !window.confirm(
      'Publish every meeting in this project? Anyone with the app link will be able to read them — any email domain, no sign-in required — '
      + 'and meetings added to this project later will be published too. Locking again will not re-hide meetings that were already published.'
    )) return
    run(willBePublic ? 'Unlocking…' : 'Locking…', api.setProjectPublic(p.id, willBePublic, getToken()))
  }

  // One or many: the server splits on commas/semicolons/whitespace and rejects
  // the whole batch if any entry is malformed, so a typo is reported rather
  // than half-saved.
  const addViewers = (id: ProjectId) => {
    const text = (drafts[id] || '').trim(); if (!text) return
    onBusy('Adding…')
    api.addProjectViewers(id, text, getToken())
      .then(l => { setList(l); setDrafts(d => ({ ...d, [id]: '' })); onToast('Access updated.') })
      .catch(e => onToast('Could not add: ' + (e instanceof Error ? e.message : String(e))))
      .finally(() => onBusy(null))
  }
  const removeViewer = (id: ProjectId, email: string) => run('Removing…', api.removeProjectViewer(id, email, getToken()))

  // Several projects usually share an audience, and retyping the same five
  // addresses per project is how lists end up quietly disagreeing.
  const copyViewers = (from: ProjectAccess) => {
    const targets = (list || []).filter(p => p.id !== from.id && !p.isPublic)
    if (!targets.length) { onToast('No other locked project to copy to.'); return }
    const ans = window.prompt(
      'Copy this list to which projects? Enter the numbers, separated by commas:\n\n'
      + targets.map((p, i) => `${i + 1}. ${p.name}`).join('\n')
    )
    if (ans == null || !ans.trim()) return
    const picked = ans.split(/[\s,;]+/).filter(Boolean)
      .map(n => { const i = parseInt(n, 10); return (i >= 1 && i <= targets.length) ? targets[i - 1].id : null })
      .filter((x): x is ProjectId => x != null)
    if (!picked.length) { onToast('No valid project number in that answer.'); return }
    onBusy('Copying…')
    api.copyProjectViewers(from.id, picked, getToken())
      .then(l => { setList(l); onToast(`Copied to ${picked.length} project${picked.length === 1 ? '' : 's'}.`) })
      .catch(e => onToast('Failed: ' + (e instanceof Error ? e.message : String(e))))
      .finally(() => onBusy(null))
  }

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

  // The filter matches the project name AND every address on it, so "what can
  // nattapong@ see?" is one search rather than a scan of every card.
  const q = filter.trim().toLowerCase()
  const shown = (list || []).filter(p =>
    !q || `${p.name} ${p.nameEn} ${p.emails.join(' ')}`.toLowerCase().includes(q))

  // Locked with nobody named means admins and editors only — legitimate, but
  // easy to arrive at by accident and confusing to diagnose from outside.
  const bare = (list || []).filter(p => !p.isPublic && !p.emails.length)

  return (
    <div className="ac-page show">
      <header className="ac-page-top">
        <div className="ac-page-titles">
          <h2>Project access</h2>
          <p>Who may open each project, and who may edit.</p>
        </div>
        <div className="ac-page-tools">
          <div className="ac-search">
            <span>🔎</span>
            <input
              type="text" placeholder="Filter projects or emails…" autoComplete="off"
              value={filter} onChange={e => setFilter(e.target.value)}
            />
          </div>
          <button className="dbtn" onClick={onClose}>Close</button>
        </div>
      </header>

      <nav className="ac-tabs">
        <button type="button" className={'ac-tab' + (tab === 'projects' ? ' is-on' : '')} onClick={() => setTab('projects')}>Projects</button>
        <button type="button" className={'ac-tab' + (tab === 'editors' ? ' is-on' : '')} onClick={() => setTab('editors')}>Editors &amp; PIN</button>
      </nav>

      <div className="ac-page-body">
        {tab === 'projects' && (
          <section className="ac-pane is-on">
            {bare.length > 0 && (
              <div className="ac-bare">
                <b>{bare.length} locked project{bare.length === 1 ? '' : 's'} with nobody named</b> — only admins and
                editors can see {bare.length === 1 ? 'it' : 'them'} right now. Add the people who should have access,
                or set {bare.length === 1 ? 'it' : 'them'} back to Public.
              </div>
            )}
            <div className="ac-legend">
              <p><b>🔓 Public</b> — readable by anyone who opens the app link, no sign-in, any email domain.</p>
              <p><b>🔒 Locked</b> — readable only by admins, editors, and the people you name below it. Everyone else,
                including other <span className="ac-mono">@vcb-con.com</span> staff, sees nothing of it.</p>
              <p className="ac-legend-tip">Add several at once by pasting a list — commas, semicolons, spaces or new lines all work.</p>
            </div>

            {!list ? <div className="empty">Loading…</div> : (
              <>
                <div className="ac-projects-grid">
                  {shown.map(p => (
                    <div key={p.id} className={'ac-proj' + (p.isPublic ? ' is-public' : '')}>
                      <div className="ac-proj-head">
                        <div className="ac-proj-name">
                          <span className="dot" style={{ background: p.color }} />
                          <span className="ac-proj-label">{p.name}</span>
                        </div>
                        <button
                          type="button"
                          className={'ac-lock-btn' + (p.isPublic ? ' unlocked' : '')}
                          onClick={() => togglePublic(p)}
                        >
                          {p.isPublic ? '🔓 Public' : '🔒 Locked'}
                        </button>
                      </div>

                      {p.isPublic ? (
                        // A guest list on a public project would be a control
                        // that does nothing; say so instead of showing a dead input.
                        <div className="ac-public-note">
                          Open to everyone — no sign-in needed, so there is no guest list to keep. Lock it to choose
                          exactly who may see it{p.emails.length
                            ? `, and the ${p.emails.length} ${p.emails.length === 1 ? 'person' : 'people'} already named here will apply again.`
                            : '.'}
                        </div>
                      ) : (
                        <div className="ac-proj-people">
                          <div className="ac-proj-people-h">
                            <span className="ac-proj-people-t">
                              Who can see it{p.emails.length ? ` (${p.emails.length})` : ''}
                            </span>
                            {p.emails.length > 0 && (
                              <button type="button" className="ac-proj-copy" onClick={() => copyViewers(p)}>Copy to…</button>
                            )}
                          </div>

                          {p.emails.length ? (
                            <div className="ac-chips">
                              {p.emails.map(em => (
                                <span key={em} className="ac-chip">
                                  <span className="ac-chip-mail">{em}</span>
                                  <button type="button" title={'Remove ' + em} onClick={() => removeViewer(p.id, em)}>×</button>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="ac-chips-empty">Nobody named yet — only admins and editors can see this project.</div>
                          )}

                          <div className="ac-proj-add">
                            <input
                              type="text" placeholder="email, or paste several" autoComplete="off"
                              value={drafts[p.id] || ''}
                              onChange={e => setDrafts(d => ({ ...d, [p.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addViewers(p.id) } }}
                            />
                            <button type="button" className="dbtn primary" onClick={() => addViewers(p.id)}>Add</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {!shown.length && <div className="empty" style={{ padding: '26px 2px' }}>No project matches that filter.</div>}
              </>
            )}
          </section>
        )}

        {tab === 'editors' && (
          <section className="ac-pane is-on">
            <div className="ac-cols">
              <section className="ac-section">
                <div className="ac-section-title">Editors</div>
                <div className="ac-note">
                  Editors can edit meeting content, add/remove attachments, create/delete meetings, and file
                  Fathom/Transkriptor recordings into projects. They can read every project, including locked ones.
                  They cannot manage access, projects, or hidden/pinned status.
                </div>
                <div className="ac-list">
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
                <div className="ac-add">
                  <input
                    type="email" placeholder="add editor email"
                    value={editorDraft}
                    onChange={e => setEditorDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addEditor() }}
                  />
                  <button className="dbtn primary" onClick={addEditor}>Add</button>
                </div>
              </section>

              {/* Optional shared team PIN — one number for a small group of trusted
                  people, instead of an account each. The email must STILL be on the
                  list above, so this is a convenience, not a skeleton key. */}
              <section className="ac-section">
                <div className="ac-section-title">
                  Shared team PIN <span style={{ fontWeight: 400, color: 'var(--ink-faint)', fontSize: 12, textTransform: 'none', letterSpacing: 0 }}>— optional</span>
                </div>
                <div className="ac-note">
                  One PIN any editor may use, instead of giving each person their own. Handy for a small group of
                  trusted people. The email must still be on the list, so this alone grants nothing — but everyone
                  using it looks the same in the edit history, and changing it changes it for all of them.
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
              </section>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
