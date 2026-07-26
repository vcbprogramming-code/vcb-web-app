import { useEffect, useRef } from 'react'
import { MailIcon } from './icons'
import type { Dict } from './types'

const SUPPORT_EMAIL = 'c.chavananand@vcb-con.com'

interface HelpModalProps {
  open: boolean
  onClose: () => void
  dict: Dict
}

export default function HelpModal({ open, onClose, dict }: HelpModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = backdropRef.current
    if (!el) return
    if (open) el.setAttribute('open', '')
    else el.removeAttribute('open')
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

  return (
    <div className="modal-backdrop" ref={backdropRef} role="dialog" aria-modal="true" onClick={onBackdropClick}>
      <div className="modal">
        <h3>{dict.help_title}</h3>
        <p className="modal-sub">{dict.help_sub}</p>
        <div className="help-email-row">
          <MailIcon />
          <span>{SUPPORT_EMAIL}</span>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            {dict.help_close}
          </button>
          <a className="btn primary" href={`mailto:${SUPPORT_EMAIL}`}>
            {dict.help_send_email}
          </a>
        </div>
      </div>
    </div>
  )
}
