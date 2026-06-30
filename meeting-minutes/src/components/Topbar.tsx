import type { SessionState } from '../types'
import type { Tr } from '../lib/i18n'
import { isMobile } from '../lib/ui'

interface Props {
  session: SessionState
  query: string
  onQuery: (q: string) => void
  onSettings: () => void
  tr: Tr
}

// Mirrors the topbar in Index.html + initHeader().
export default function Topbar({ session, query, onQuery, onSettings, tr }: Props) {
  const placeholder = isMobile() ? tr('searchPlaceholderMobile') : tr('searchPlaceholder')
  const who = (session.user || '') + (session.isAdmin ? ' · admin' : '')
  return (
    <header className="topbar">
      <div className="brandwrap">
        <div className="brand-txt">
          <h1 className="brand-h1"><a className="brand-link" href="#" onClick={e => e.preventDefault()} title={tr('backToPortal')}>VCB Group</a></h1>
          <span className="brand-div" />
          <div className="brand-stack">
            <span className="brand-sub">{session.appDisplayTitle || 'Meeting Minutes'}</span>
            <span className="brand-th">{session.subtitle}</span>
          </div>
        </div>
        <button className="settings-btn" type="button" title="Settings" aria-label="Settings" onClick={onSettings}>⚙</button>
      </div>
      <div className="hdr-right">
        <div className="search">
          <span>🔎</span>
          <input type="text" placeholder={placeholder} autoComplete="off" value={query} onChange={e => onQuery(e.target.value)} />
        </div>
        <button className="tbtn settings-btn-d" type="button" title="Settings" aria-label="Settings" onClick={onSettings}>⚙</button>
        <span className="who">{who}</span>
      </div>
    </header>
  )
}
