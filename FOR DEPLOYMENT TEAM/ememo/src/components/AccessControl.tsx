import { useCallback, useEffect, useState } from 'react'
import { api, type AccessRules, type AccessConfigResult } from '../api'
import { useStore } from '../store'

// Admin-only access editor (#stAccessSection): per-code / per-project
// Confidential toggle + email allow-list. Mirrors loadAccessConfig /
// renderAccessConfig / saveAccessConfig.
export default function AccessControl() {
  const { auth } = useStore()
  const [open, setOpen] = useState(false)
  const [cfg, setCfg] = useState<AccessConfigResult | null>(null)
  const [rules, setRules] = useState<AccessRules | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setMsg('Loading…')
    const r = await api.getAccessConfig(auth?.token ?? '')
    setCfg(r)
    setRules(r.ok && r.rules ? structuredClone(r.rules) : { codes: {}, projects: {} })
    setMsg(r.ok ? '' : (r.error ?? 'Sign in as an admin to manage access.'))
  }, [auth?.token])

  useEffect(() => { if (open && !cfg) void load() }, [open, cfg, load])

  const isAdmin = !!cfg?.isAdmin
  const codeKeys = Object.keys(cfg?.codeLabels ?? {})
  const projectKeys = cfg?.projectKeys ?? []

  const ruleOf = (kind: 'codes' | 'projects', key: string) =>
    rules?.[kind][key] ?? { conf: false, allow: [] }

  const setConf = (kind: 'codes' | 'projects', key: string, conf: boolean) =>
    setRules((prev) => {
      const next: AccessRules = prev ? structuredClone(prev) : { codes: {}, projects: {} }
      const cur = next[kind][key] ?? { conf: false, allow: [] }
      next[kind][key] = { ...cur, conf }
      return next
    })

  const setAllow = (kind: 'codes' | 'projects', key: string, allowCsv: string) =>
    setRules((prev) => {
      const next: AccessRules = prev ? structuredClone(prev) : { codes: {}, projects: {} }
      const cur = next[kind][key] ?? { conf: false, allow: [] }
      next[kind][key] = { ...cur, allow: allowCsv.split(/[,\s]+/).filter(Boolean) }
      return next
    })

  const save = async () => {
    if (!rules) return
    setBusy(true); setMsg('Saving…')
    const r = await api.setAccessConfig(auth?.token ?? '', JSON.stringify(rules))
    setBusy(false)
    setMsg(r.ok ? '✓ Saved.' : (r.error ?? 'Could not save.'))
  }

  return (
    <div className="st-section" id="stAccessSection">
      <hr className="st-divider" style={{ margin: '0 0 14px' }} />
      <button type="button" className="acc-head" onClick={() => setOpen((o) => !o)}>
        <span className="st-sect-label" style={{ margin: 0 }}>สิทธิ์การเข้าถึง / ACCESS CONTROL</span>
        <span className="acc-caret" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="acc-panel" style={{ display: 'block' }}>
          <div className="st-sect-sub">Confidential items open only for the owner and the emails listed.</div>
          <div className="acc-body">
            {!isAdmin ? (
              <div style={{ color: '#8a90a2', fontSize: 13 }}>{msg || 'Sign in as an admin to manage access.'}</div>
            ) : (
              <>
                <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: '.6px', color: '#6b7280', margin: '6px 0' }}>BY DOCUMENT CODE</div>
                {codeKeys.map((c) => {
                  const r = ruleOf('codes', c)
                  return (
                    <div key={c} className="acc-row" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 150 }}>
                        <input type="checkbox" checked={r.conf} onChange={(e) => setConf('codes', c, e.target.checked)} />
                        <b>{c}</b> <span style={{ color: '#888' }}>{cfg?.codeLabels?.[c]}</span>
                      </label>
                      <input type="text" placeholder="allow emails (comma-separated)" defaultValue={r.allow.join(', ')}
                        disabled={!r.conf} onChange={(e) => setAllow('codes', c, e.target.value)}
                        style={{ flex: 1, minWidth: 200, padding: '6px 9px', border: '1.5px solid #e1e4ee', borderRadius: 7, fontSize: 12 }} />
                    </div>
                  )
                })}

                <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: '.6px', color: '#6b7280', margin: '16px 0 6px' }}>BY PROJECT</div>
                {projectKeys.map((p) => {
                  const r = ruleOf('projects', p)
                  return (
                    <div key={p} className="acc-row" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 150 }}>
                        <input type="checkbox" checked={r.conf} onChange={(e) => setConf('projects', p, e.target.checked)} />
                        <b>{p}</b>
                      </label>
                      <input type="text" placeholder="allow emails (comma-separated)" defaultValue={r.allow.join(', ')}
                        disabled={!r.conf} onChange={(e) => setAllow('projects', p, e.target.value)}
                        style={{ flex: 1, minWidth: 200, padding: '6px 9px', border: '1.5px solid #e1e4ee', borderRadius: 7, fontSize: 12 }} />
                    </div>
                  )
                })}
              </>
            )}
          </div>
          {isAdmin && (
            <div className="acc-actions" style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="acc-reload" onClick={() => void load()}>↻ Reload</button>
              <button className="acc-save" onClick={() => void save()} disabled={busy}>บันทึก · Save access</button>
            </div>
          )}
          <div className="acc-msg" style={{ marginTop: 8, fontSize: 12, color: '#137333' }}>{msg}</div>
        </div>
      )}
    </div>
  )
}
