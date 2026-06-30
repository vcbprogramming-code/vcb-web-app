import { useState } from 'react'
import type { YMonth } from './types'
import { BOOT } from './mock'
import { useSettings } from './settings'
import Dashboard from './Dashboard'
import Entry from './Entry'
import WorkIndex from './WorkIndex'
import SettingsPage from './SettingsPage'

// Demo "today" — the live app uses the real date; we pin it inside the sample
// month (May 2026) so the Overview shows a realistic mix of locked / editable /
// future days. Change here to explore other states.
export const TODAY = '2026-05-18'
const CUR0: YMonth = { y: 2026, m: 5 }

export function MonthNav({ cur, setCur }: { cur: YMonth; setCur: (c: YMonth) => void }) {
  const { mname, be } = useSettings()
  const prev = () => setCur(cur.m === 1 ? { y: cur.y - 1, m: 12 } : { y: cur.y, m: cur.m - 1 })
  const next = () => setCur(cur.m === 12 ? { y: cur.y + 1, m: 1 } : { y: cur.y, m: cur.m + 1 })
  return (
    <div className="mnav">
      <button className="mnav-b" onClick={prev} title="prev">‹</button>
      <span className="mnav-lbl">{mname(cur.m)} {be(cur.y)}</span>
      <button className="mnav-b" onClick={next} title="next">›</button>
    </div>
  )
}

type View = 'dashboard' | 'entry' | 'index' | 'settings'
type EntryMode = 'coverage' | 'week'

export default function App() {
  const { t } = useSettings()
  const [view, setView] = useState<View>('dashboard')
  const [cur, setCur] = useState<YMonth>(CUR0)
  const [entrySite, setEntrySite] = useState<string | null>(null)
  const [entryMode, setEntryMode] = useState<EntryMode>('coverage')

  const nav: [View, string][] = [
    ['dashboard', t('แดชบอร์ด')],
    ...(BOOT.canEntry ? [['entry', t('บันทึกงาน')] as [View, string]] : []),
    ...(BOOT.isAdmin ? [['index', t('ดัชนีงาน')] as [View, string]] : []),
    ...(BOOT.isAdmin ? [['settings', '⚙'] as [View, string]] : []),
  ]

  function openSite(siteKey: string, mode: EntryMode) {
    setEntrySite(siteKey)
    setEntryMode(mode)
    setView('entry')
  }

  return (
    <>
      <div className="topbar">
        <a className="brand" onClick={() => setView('dashboard')}>HR Work Log</a>
        <div className="brand-div" />
        <div className="brand-titles">
          <div className="brand-t1">ระบบบันทึกการทำงาน</div>
          <div className="brand-t2">Daily Work Log · React preview</div>
        </div>
        <nav>
          {nav.map(([id, label]) => (
            <a key={id} className={view === id ? 'on' : ''} onClick={() => setView(id)}>{label}</a>
          ))}
          <span className="who">{BOOT.email} · {BOOT.role}</span>
        </nav>
      </div>

      <div className="wrap">
        {view === 'dashboard' && <Dashboard cur={cur} setCur={setCur} openSite={openSite} />}
        {view === 'entry' && (
          <Entry cur={cur} setCur={setCur} site={entrySite} setSite={setEntrySite}
            mode={entryMode} setMode={setEntryMode} />
        )}
        {view === 'index' && <WorkIndex />}
        {view === 'settings' && <SettingsPage />}
      </div>
    </>
  )
}
