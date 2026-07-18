import type { Project, MeetingListItem } from '../types'
import { FATHOM_INBOX_ID } from '../types'
import type { Tr } from '../lib/i18n'
import { fmtDate, fmtTime } from '../lib/i18n'
import { cssVar } from '../lib/ui'

interface Props {
  projects: Project[]
  meetings: MeetingListItem[]
  onOpen: (id: string) => void
  tr: Tr
}

// ALL-projects dashboard: the latest meeting per project. Mirrors renderDashboard().
// Fathom Inbox never gets a card here — it's a standalone review queue, not
// one of the tracked projects (mirrors the S.projects.filter exclusion in
// JavaScript.html's renderDashboard()).
export default function Dashboard({ projects, meetings, onOpen, tr }: Props) {
  const by: Record<string, MeetingListItem> = {}
  meetings.forEach(m => {
    if (m.kind === 'overview') return
    const cur = by[m.projectId]
    if (!cur || (m.date || '') > (cur.date || '')) by[m.projectId] = m
  })
  const cards = projects.filter(p => p.id !== FATHOM_INBOX_ID)
    .map(p => ({ p, m: by[p.id] })).filter((x): x is { p: Project; m: MeetingListItem } => !!x.m)

  return (
    <div className="dash-wrap">
      <div className="dash-head">
        <h2>{tr('latestMeetings')}</h2>
        <p>The most recent minutes from each project — click any card to read the full record.</p>
      </div>
      <div className="dash-grid">
        {cards.length ? cards.map(({ p, m }) => (
          <div key={m.id} className="dash-card" style={cssVar('--c', p.color)} onClick={() => onOpen(m.id)}>
            <div className="dash-proj"><span className="dot" style={{ background: p.color }} />{p.name}</div>
            <div className="dash-date">🗓 {fmtDate(m)}{fmtTime(m) ? ' · ' + fmtTime(m) : ''}
              {m.hasFathom && <>&nbsp;<span className="badge fathom">▶ Fathom</span></>}
            </div>
            <div className="dash-ttl">{m.title}</div>
            <div className="dash-ex">{m.excerpt || ''}</div>
            <div className="dash-read">{tr('readMinutes')}</div>
          </div>
        )) : <div className="empty">No meetings to show yet.</div>}
      </div>
    </div>
  )
}
