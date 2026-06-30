import { useEffect, useRef, useState } from 'react'
import {
  unlockAdmin,
  getAnnouncementForEdit,
  saveAnnouncement,
  isAdminInitialized,
} from './mockBackend'
import type { Announcement } from './types'

const TOKEN_STORE_KEY = 'vcb_connect_admin_token'

type Step = 'unlock' | 'editor'
interface Msg {
  text: string
  cls: '' | 'err' | 'ok'
}
interface EditorForm {
  title: string
  body: string
  show: boolean
}

const getCachedToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_STORE_KEY) || null
  } catch {
    return null
  }
}
const setCachedToken = (t: string | null): void => {
  try {
    if (t) localStorage.setItem(TOKEN_STORE_KEY, t)
    else localStorage.removeItem(TOKEN_STORE_KEY)
  } catch {
    /* ignore */
  }
}

const errMsg = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback

interface AdminModalProps {
  open: boolean
  onClose: () => void
  onSaved: (saved: Announcement | null) => void
}

export default function AdminModal({ open, onClose, onSaved }: AdminModalProps) {
  const [step, setStep] = useState<Step>('unlock')
  const [adminInit, setAdminInit] = useState<boolean>(isAdminInitialized())
  const [pw, setPw] = useState('')
  const [unlockMsg, setUnlockMsg] = useState<Msg>({ text: '', cls: '' })
  const [editMsg, setEditMsg] = useState<Msg>({ text: '', cls: '' })
  const [busy, setBusy] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [form, setForm] = useState<EditorForm>({ title: '', body: '', show: true })
  const pwRef = useRef<HTMLInputElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  // Toggle the [open] attribute the verbatim CSS keys off of (.modal-backdrop[open]),
  // mirroring modal.setAttribute('open','') / removeAttribute('open') in index.html.
  useEffect(() => {
    const el = backdropRef.current
    if (!el) return
    if (open) el.setAttribute('open', '')
    else el.removeAttribute('open')
  }, [open])

  // When the modal opens, jump straight into the editor if we hold a token —
  // mirrors openModal()'s optimistic path in index.html.
  useEffect(() => {
    if (!open) return
    setUnlockMsg({ text: '', cls: '' })
    setEditMsg({ text: '', cls: '' })
    setConfirmClear(false)
    setPw('')
    setAdminInit(isAdminInitialized())

    const token = getCachedToken()
    if (token) {
      setStep('editor')
      loadEditor(token)
    } else {
      setStep('unlock')
      setTimeout(() => pwRef.current?.focus(), 50)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function fillEditor(ann: Announcement | null): void {
    setForm({
      title: ann?.title ?? '',
      body: ann?.body ?? '',
      show: ann ? !!ann.show : true,
    })
  }

  function loadEditor(token: string): void {
    setEditMsg({ text: 'Loading current announcement…', cls: '' })
    getAnnouncementForEdit(token)
      .then((ann) => {
        fillEditor(ann)
        setEditMsg({ text: '', cls: '' })
      })
      .catch((err: unknown) => {
        setCachedToken(null)
        setStep('unlock')
        setUnlockMsg({ text: errMsg(err, 'Session expired.'), cls: 'err' })
        setTimeout(() => pwRef.current?.focus(), 50)
      })
  }

  function submitUnlock(): void {
    if (!pw || pw.length < 6) {
      setUnlockMsg({ text: 'Password must be at least 6 characters.', cls: 'err' })
      return
    }
    setUnlockMsg({ text: 'Checking…', cls: '' })
    setBusy(true)
    unlockAdmin(pw)
      .then((token) => {
        setBusy(false)
        setAdminInit(true)
        setCachedToken(token)
        setUnlockMsg({ text: '', cls: '' })
        setStep('editor')
        loadEditor(token)
      })
      .catch((err: unknown) => {
        setBusy(false)
        setUnlockMsg({ text: errMsg(err, 'Could not unlock.'), cls: 'err' })
      })
  }

  function submitSave(): void {
    const token = getCachedToken()
    if (!token) {
      setStep('unlock')
      return
    }
    if (!form.title.trim() && !form.body.trim()) {
      setEditMsg({ text: 'Add at least a title or a message.', cls: 'err' })
      return
    }
    setBusy(true)
    setEditMsg({ text: 'Saving…', cls: '' })
    saveAnnouncement(token, { title: form.title, body: form.body, show: !!form.show })
      .then((saved) => {
        setBusy(false)
        setEditMsg({ text: 'Saved.', cls: 'ok' })
        onSaved(saved)
        setTimeout(onClose, 500)
      })
      .catch((err: unknown) => {
        setBusy(false)
        const m = errMsg(err, 'Could not save.')
        setEditMsg({ text: m, cls: 'err' })
        if (/session expired/i.test(m)) {
          setCachedToken(null)
          setTimeout(() => setStep('unlock'), 600)
        }
      })
  }

  function performClear(): void {
    const token = getCachedToken()
    if (!token) {
      setConfirmClear(false)
      setStep('unlock')
      return
    }
    setBusy(true)
    setEditMsg({ text: 'Clearing…', cls: '' })
    saveAnnouncement(token, null)
      .then(() => {
        setBusy(false)
        setEditMsg({ text: 'Cleared.', cls: 'ok' })
        onSaved(null)
        fillEditor(null)
        setForm((f) => ({ ...f, show: false }))
        setConfirmClear(false)
        setTimeout(onClose, 500)
      })
      .catch((err: unknown) => {
        setBusy(false)
        setEditMsg({ text: errMsg(err, 'Could not clear.'), cls: 'err' })
        setConfirmClear(false)
      })
  }

  // Esc to close — mirrors the document keydown handler in index.html.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      onClick={onBackdropClick}
    >
      <div className="modal">
        {step === 'unlock' ? (
          <div id="admin-unlock">
            <h3>{adminInit ? 'Admin · Unlock' : 'Admin · First-time setup'}</h3>
            <p className="modal-sub">
              {adminInit
                ? 'Enter the admin password to manage the announcement.'
                : "No admin password is set yet. Choose one now (min 6 characters) — you'll use it every time you edit the announcement."}
            </p>
            <label htmlFor="admin-password">Password</label>
            <input
              type="password"
              id="admin-password"
              ref={pwRef}
              autoComplete="current-password"
              placeholder="••••••••"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submitUnlock()
                }
              }}
            />
            <div className={`msg ${unlockMsg.cls}`}>{unlockMsg.text}</div>
            <div className="modal-actions">
              <button className="btn" onClick={onClose}>
                Cancel
              </button>
              <button className="btn primary" onClick={submitUnlock} disabled={busy}>
                Unlock
              </button>
            </div>
          </div>
        ) : (
          <div id="admin-editor">
            <h3>Announcement</h3>
            <p className="modal-sub">
              Shown to every visitor at the top of the portal. Leave empty and turn off "show" to
              hide.
            </p>

            <label htmlFor="f-title">Title</label>
            <input
              type="text"
              id="f-title"
              maxLength={120}
              placeholder="e.g. Maintenance window this Saturday"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />

            <label htmlFor="f-body">Message</label>
            <textarea
              id="f-body"
              maxLength={600}
              placeholder="Short message. Line breaks are preserved."
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />

            <div className="toggle-row">
              <input
                type="checkbox"
                id="f-show"
                checked={form.show}
                onChange={(e) => setForm((f) => ({ ...f, show: e.target.checked }))}
              />
              <label
                htmlFor="f-show"
                style={{
                  margin: 0,
                  letterSpacing: 0,
                  textTransform: 'none',
                  fontSize: 13,
                  color: 'var(--text)',
                }}
              >
                Show banner to visitors
              </label>
            </div>

            <div className={`msg ${editMsg.cls}`}>{editMsg.text}</div>

            {!confirmClear ? (
              <div className="modal-actions" id="edit-actions">
                <button className="btn ghost-danger" onClick={() => setConfirmClear(true)}>
                  Clear
                </button>
                <button className="btn" onClick={onClose}>
                  Close
                </button>
                <button className="btn primary" onClick={submitSave} disabled={busy}>
                  Save
                </button>
              </div>
            ) : (
              <div className="confirm-row" id="edit-confirm">
                <div className="confirm-q">
                  <strong>Remove the current announcement?</strong>
                  <br />
                  This hides the banner for everyone.
                </div>
                <button className="btn" onClick={() => setConfirmClear(false)}>
                  Cancel
                </button>
                <button className="btn danger" onClick={performClear} disabled={busy}>
                  Yes, clear
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
