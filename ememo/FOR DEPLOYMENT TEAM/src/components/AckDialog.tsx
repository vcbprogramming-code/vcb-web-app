// Styled in-app confirm (#ackWrap) — the GAS app deliberately uses this
// instead of native window.confirm(). Promise-based via the useConfirm hook.
import { useCallback, useState } from 'react'

export interface AckOptions { title?: string; message: string; okLabel?: string; cancelLabel?: string; danger?: boolean }
interface AckState extends AckOptions { resolve: (v: boolean) => void }

export function useConfirm() {
  const [state, setState] = useState<AckState | null>(null)
  const confirm = useCallback((opts: AckOptions) => new Promise<boolean>((resolve) => setState({ ...opts, resolve })), [])
  const done = (v: boolean) => { state?.resolve(v); setState(null) }

  const dialog = state ? (
    <div className="ackWrap show" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) done(false) }}>
      <div className="ackBox">
        <h3>{state.title ?? 'Confirm'}</h3>
        <div className="msg">{state.message}</div>
        <div className="ackActs">
          <button className="ackBtn ackBtnSec" type="button" onClick={() => done(false)}>{state.cancelLabel ?? 'Cancel'}</button>
          <button className={'ackBtn ackBtnPri' + (state.danger ? ' danger' : '')} type="button" onClick={() => done(true)}>{state.okLabel ?? 'OK'}</button>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, dialog }
}
