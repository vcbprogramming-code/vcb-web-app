import { useEffect, useRef, useState } from 'react'
import { APPS } from './data'
import { sendIssueReport } from './mockBackend'
import type { Dict } from './types'

interface HelpModalProps {
  open: boolean
  onClose: () => void
  dict: Dict
}

interface Msg {
  text: string
  cls: '' | 'err' | 'ok'
}

const errMsg = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback

export default function HelpModal({ open, onClose, dict }: HelpModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const [area, setArea] = useState('')
  const [message, setMessage] = useState('')
  const [msg, setMsg] = useState<Msg>({ text: '', cls: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const el = backdropRef.current
    if (!el) return
    if (open) el.setAttribute('open', '')
    else el.removeAttribute('open')
  }, [open])

  useEffect(() => {
    if (!open) return
    setArea('')
    setMessage('')
    setMsg({ text: '', cls: '' })
  }, [open])

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

  function submit(): void {
    if (!area) {
      setMsg({ text: dict.help_area_label, cls: 'err' })
      return
    }
    if (!message.trim()) {
      setMsg({ text: dict.help_message_label, cls: 'err' })
      return
    }
    setBusy(true)
    setMsg({ text: '', cls: '' })
    sendIssueReport({ area, message })
      .then(() => {
        setBusy(false)
        setMsg({ text: 'Sent.', cls: 'ok' })
        setTimeout(onClose, 500)
      })
      .catch((err: unknown) => {
        setBusy(false)
        setMsg({ text: errMsg(err, 'Could not send.'), cls: 'err' })
      })
  }

  return (
    <div className="modal-backdrop" ref={backdropRef} role="dialog" aria-modal="true" onClick={onBackdropClick}>
      <div className="modal">
        <h3>{dict.help_title}</h3>
        <p className="modal-sub">{dict.help_sub}</p>

        <label htmlFor="help-area">{dict.help_area_label}</label>
        <select id="help-area" value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">{dict.help_area_placeholder}</option>
          {APPS.map((a) => (
            <option key={a.key} value={a.key}>
              {dict.apps[a.key]?.name ?? a.name}
            </option>
          ))}
          <option value="other">{dict.help_area_other}</option>
        </select>

        <label htmlFor="help-message">{dict.help_message_label}</label>
        <textarea
          id="help-message"
          maxLength={2000}
          placeholder={dict.help_message_placeholder}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <div className={`msg ${msg.cls}`}>{msg.text}</div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            {dict.help_close}
          </button>
          <button className="btn primary" onClick={submit} disabled={busy}>
            {dict.help_send}
          </button>
        </div>
      </div>
    </div>
  )
}
