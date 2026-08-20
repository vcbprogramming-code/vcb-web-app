// Editor sign-in. Mirrors openEditorSignIn() in JavaScript.html.
//
// WHY THE APP HAS ITS OWN LOGIN: the live deployment is ANYONE_ANONYMOUS +
// USER_DEPLOYING, so Google never tells the server who a visitor is
// (Session.getActiveUser().getEmail() is empty for everyone but the owner).
// EDITOR_EMAILS cannot be matched against anything on its own — which is why
// the ✎ Edit button is shown to EVERYONE and identity is demanded only when
// someone actually tries to edit.
//
// Two steps in one dialog: sign in, and — when an admin created the account and
// chose the PIN — immediately choose a personal one, so the admin stops knowing
// it. A session created with the SHARED team PIN is never asked to change it;
// that would lock out everyone else holding it.
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { EditorSession } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  /** Called once sign-in is fully complete (including any forced PIN change). */
  onSignedIn: (s: EditorSession) => void
  onToast: (msg: string) => void
  onBusy: (msg: string | null) => void
}

export default function EditorSignInModal({ open, onClose, onSignedIn, onToast, onBusy }: Props) {
  const [mode, setMode] = useState<'login' | 'change'>('login')
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [err, setErr] = useState('')
  const [session, setSession] = useState<EditorSession | null>(null)

  // Reset every time the dialog opens, so a previous attempt never leaks into
  // the next one.
  useEffect(() => {
    if (!open) return
    setMode('login'); setEmail(''); setPin(''); setPin2(''); setErr(''); setSession(null)
  }, [open])

  if (!open) return null

  const submit = (): void => {
    setErr('')
    if (mode === 'login') {
      const e = email.trim()
      if (!e || !pin) { setErr('Enter your email and PIN.'); return }
      onBusy('Signing in…')
      api.editorLogin(e, pin.trim()).then(s => {
        onBusy(null)
        setSession(s)
        if (s.mustChange) {
          // Signed in on an admin-chosen PIN — make them pick their own before
          // going through.
          setMode('change'); setPin(''); setPin2('')
          return
        }
        onToast('Signed in as ' + s.user)
        onSignedIn(s)
        onClose()
      }).catch((e2: unknown) => {
        onBusy(null)
        setErr(e2 instanceof Error ? e2.message : String(e2))
        setPin('')
      })
      return
    }

    // mode === 'change'
    if (!/^\d{4}$/.test(pin.trim())) { setErr('PIN must be exactly 4 digits.'); return }
    if (pin.trim() !== pin2.trim()) { setErr('The two PINs do not match.'); return }
    // The mock has no changeEditorPassword endpoint (identity there is a URL
    // flag, not a credential), so this step just completes locally. The GAS app
    // calls changeEditorPassword here — see JavaScript.html.
    if (session) {
      onToast('Signed in as ' + session.user)
      onSignedIn({ ...session, mustChange: false })
    }
    onClose()
  }

  const onKey = (ev: React.KeyboardEvent): void => {
    if (ev.key === 'Enter') submit()
    if (ev.key === 'Escape') onClose()
  }

  const changing = mode === 'change'
  return (
    <div className="modal-bg show" onClick={ev => { if (ev.target === ev.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 420 }} onKeyDown={onKey}>
        <h3>{changing ? 'Choose your PIN' : 'Sign in to edit'}</h3>
        <div className="form">
          <div>
            <label>Work email</label>
            <input
              type="email" autoComplete="username" placeholder="you@vcb-con.com"
              value={email} disabled={changing}
              onChange={ev => setEmail(ev.target.value)} autoFocus={!changing}
            />
          </div>
          <div>
            <label>{changing ? 'New PIN (4 digits)' : 'PIN'}</label>
            <input
              type="password" inputMode="numeric" autoComplete={changing ? 'new-password' : 'current-password'}
              placeholder={changing ? '4 digits' : 'Your PIN'}
              value={pin} onChange={ev => setPin(ev.target.value)} autoFocus={changing}
            />
          </div>
          {changing && (
            <div>
              <label>Confirm new PIN</label>
              <input type="password" inputMode="numeric" autoComplete="new-password"
                placeholder="Re-type it" value={pin2} onChange={ev => setPin2(ev.target.value)} />
            </div>
          )}
          {err && <div style={{ fontSize: 13, color: '#cf222e', lineHeight: 1.45 }}>{err}</div>}
          <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', lineHeight: 1.45 }}>
            {changing
              ? 'This replaces the PIN an admin gave you. Only you will know it.'
              : 'No PIN yet? Ask an admin to set one for you.'}
          </div>
        </div>
        <div className="actions">
          <button className="dbtn" onClick={onClose}>Cancel</button>
          <button className="dbtn primary" onClick={submit}>{changing ? 'Save PIN' : 'Sign in'}</button>
        </div>
      </div>
    </div>
  )
}
