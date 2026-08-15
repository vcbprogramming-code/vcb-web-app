// Styled replacements for window.confirm()/window.prompt(), driven by
// useConfirm()/usePrompt() promise-returning hooks — mirrors confirmDialog()/
// promptDialog() in JavaScript.html (#cfBg/#cfTitle/#cfMsg/#cfCancel/#cfOk and
// #ipBg/#ipTitle/#ipLabel/#ipInput/#ipCancel/#ipOk in Index.html). Supports
// Escape-to-cancel, Enter-to-confirm (prompt only), and backdrop-click-to-cancel.
import { useCallback, useEffect, useRef, useState } from 'react'

export interface ConfirmOpts {
  title?: string
  okLabel?: string
  /** Danger (red, solid) button style unless explicitly set to false — mirrors
   *  cfOk's className toggle in JavaScript.html (opts.danger === false -> primary). */
  danger?: boolean
}
export interface PromptOpts {
  title?: string
  okLabel?: string
  placeholder?: string
  value?: string
}

interface ConfirmState { message: string; opts: ConfirmOpts; resolve: (v: boolean) => void }
interface PromptState { label: string; opts: PromptOpts; resolve: (v: string | null) => void }

// Returns a function that opens the confirm dialog and resolves true/false —
// same call shape as the GAS confirmDialog(message, opts) helper.
export function useConfirm(): {
  confirm: (message: string, opts?: ConfirmOpts) => Promise<boolean>
  node: React.ReactNode
} {
  const [state, setState] = useState<ConfirmState | null>(null)
  const confirm = useCallback((message: string, opts: ConfirmOpts = {}) => {
    return new Promise<boolean>(resolve => setState({ message, opts, resolve }))
  }, [])
  const cleanup = (result: boolean) => {
    if (state) state.resolve(result)
    setState(null)
  }
  useEffect(() => {
    if (!state) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cleanup(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const node = state ? (
    <div className="modal-bg show" onClick={e => { if (e.target === e.currentTarget) cleanup(false) }}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <h3>{state.opts.title || 'Are you sure?'}</h3>
        <p className="subhead" style={{ paddingBottom: 16 }}>{state.message}</p>
        <div className="actions">
          <button className="dbtn" onClick={() => cleanup(false)}>Cancel</button>
          <button className={'dbtn ' + (state.opts.danger === false ? 'primary' : 'danger-solid')} onClick={() => cleanup(true)}>
            {state.opts.okLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, node }
}

// Returns a function that opens the single-input prompt dialog and resolves
// the entered string, or null if cancelled — same call shape as the GAS
// promptDialog(label, opts) helper.
export function usePrompt(): {
  prompt: (label: string, opts?: PromptOpts) => Promise<string | null>
  node: React.ReactNode
} {
  const [state, setState] = useState<PromptState | null>(null)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const prompt = useCallback((label: string, opts: PromptOpts = {}) => {
    setValue(opts.value || '')
    return new Promise<string | null>(resolve => setState({ label, opts, resolve }))
  }, [])
  const cleanup = (result: string | null) => {
    if (state) state.resolve(result)
    setState(null)
  }
  useEffect(() => {
    if (!state) return
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cleanup(null)
      if (e.key === 'Enter') cleanup(inputRef.current?.value ?? value)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const node = state ? (
    <div className="modal-bg show" onClick={e => { if (e.target === e.currentTarget) cleanup(null) }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <h3>{state.opts.title || 'Enter a value'}</h3>
        <div className="form">
          <div>
            <label>{state.label}</label>
            <input
              ref={inputRef}
              value={value}
              placeholder={state.opts.placeholder || ''}
              onChange={e => setValue(e.target.value)}
            />
          </div>
        </div>
        <div className="actions">
          <button className="dbtn" onClick={() => cleanup(null)}>Cancel</button>
          <button className="dbtn primary" onClick={() => cleanup(value)}>{state.opts.okLabel || 'OK'}</button>
        </div>
      </div>
    </div>
  ) : null

  return { prompt, node }
}
