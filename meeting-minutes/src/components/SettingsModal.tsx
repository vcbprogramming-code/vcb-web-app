import type { Lang, Theme, SessionState } from '../types'
import type { Tr } from '../lib/i18n'

interface Props {
  open: boolean
  onClose: () => void
  session: SessionState
  theme: Theme
  lang: Lang
  setTheme: (t: Theme) => void
  setLang: (l: Lang) => void
  onAccess: () => void
  tr: Tr
}

// Mirrors the Settings sheet in Index.html + openSettings(). The "🔄 Refresh
// now" button (manualRefresh()/backgroundAutoSync()) was removed 2026-07-19 —
// Docs stopped being the source of truth, so autoSync became a permanent
// server no-op and was later deleted entirely; see PORT_NOTES.md.
export default function SettingsModal({ open, onClose, session, theme, lang, setTheme, setLang, onAccess, tr }: Props) {
  if (!open) return null
  const dep = (session.execUrl || '').split('/s/')[1] || ''
  const depId = dep.split('/')[0] || ''
  const build = depId ? depId.slice(-10) : 'local-preview'

  return (
    <div className="modal-bg show" onClick={e => { if ((e.target as HTMLElement).classList.contains('modal-bg')) onClose() }}>
      <div className="modal">
        <h3>{tr('settings')}</h3>
        <div className="form">
          <div className="set-group">
            <div className="set-mini-label">{tr('signedInAs')}</div>
            <div className="set-who">{(session.user || 'Signed in with Google') + (session.isAdmin ? ' · admin' : '')}</div>
          </div>

          <div className="set-group">
            <div className="set-group-title">{tr('display')}</div>
            <div className="set-row-label">{tr('theme')}</div>
            <div className="set-segment" id="themeSeg">
              {([['light', '☀ สว่าง Light'], ['dark', '🌙 มืด Dark']] as [Theme, string][]).map(([v, lbl]) => (
                <button key={v} type="button" className={'set-seg-opt' + (theme === v ? ' active' : '')} onClick={() => setTheme(v)}>{lbl}</button>
              ))}
            </div>
            <div className="set-row-label" style={{ marginTop: 6 }}>{tr('language')}</div>
            <div className="set-segment" id="langSeg">
              {([['th', 'ไทย / TH'], ['en', 'English / EN']] as [Lang, string][]).map(([v, lbl]) => (
                <button key={v} type="button" className={'set-seg-opt' + (lang === v ? ' active' : '')} onClick={() => setLang(v)}>{lbl}</button>
              ))}
            </div>
          </div>

          {session.isAdmin && (
            <div className="set-actions-inline">
              <button className="dbtn" onClick={onAccess}>{tr('projectAccess')}</button>
            </div>
          )}

          <div className="set-group set-about">
            <div className="set-group-title">{tr('about')}</div>
            <div className="set-about-row"><span className="set-about-k">App</span><span className="set-about-v">VCB Meeting Minutes</span></div>
            <div className="set-about-row"><span className="set-about-k">{tr('build')}</span><span className="set-about-v">{build}</span></div>
            <div className="set-about-row"><span className="set-about-k">{tr('adminLabel')}</span><a className="set-about-v" href="mailto:c.chavananand@vcb-con.com">c.chavananand@vcb-con.com</a></div>
          </div>
        </div>
        <div className="actions"><button className="dbtn" onClick={onClose}>{tr('close')}</button></div>
      </div>
    </div>
  )
}
