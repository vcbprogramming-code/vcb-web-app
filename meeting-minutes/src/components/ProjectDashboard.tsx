import { useEffect, useState } from 'react'
import type { Project, MeetingListItem } from '../types'
import type { Tr } from '../lib/i18n'
import { fmtDate, fmtTime } from '../lib/i18n'
import { summaryHtml } from '../lib/docRender'
import { fetchMeeting, getCached } from '../api/contentCache'
import { cssVar } from '../lib/ui'

interface Props {
  project: Project
  meetings: MeetingListItem[]
  onOpen: (id: string) => void
  tr: Tr
}

// Per-project panel: Exec Summary + action items of the most recent meeting.
// Mirrors renderProjectDashboard() + loadSummary().
export default function ProjectDashboard({ project, meetings, onOpen, tr }: Props) {
  const items = meetings
    .filter(m => m.projectId === project.id && m.kind !== 'overview')
    .slice()
    .sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1
      return (b.date || '0000-00-00').localeCompare(a.date || '0000-00-00')
    })
  const m = items[0]
  const [sum, setSum] = useState<string>('<div class="bmuted">Loading summary…</div>')

  useEffect(() => {
    if (!m) return
    let alive = true
    const cached = getCached(m.id)
    if (cached) { setSum(summaryHtml(cached.html, m.excerpt)); return }
    setSum('<div class="bmuted">Loading summary…</div>')
    fetchMeeting(m.id).then(full => { if (alive && full) setSum(summaryHtml(full.html, m.excerpt)) }).catch(() => { if (alive) setSum('') })
    return () => { alive = false }
  }, [m?.id, m?.excerpt])

  if (!m) {
    return <div className="placeholder"><div className="big">📄</div><div>No meetings yet for {project.name || 'this project'}.</div></div>
  }
  const titleIsDate = /25\d{2}/.test(m.title || '')
  return (
    <div className="dash-wrap">
      <div className="dash-head">
        <h2>
          <span className="dot" style={{ display: 'inline-block', width: 11, height: 11, borderRadius: '50%', background: project.color || '#888', verticalAlign: 'middle', marginRight: 7 }} />
          {project.name || ''} — {tr('latestMeetings')}
        </h2>
        <p>Executive summary and action items from the most recent meeting — click to read the full record.</p>
      </div>
      <div className="pbig-card" style={cssVar('--c', project.color || '#888')} onClick={(e) => { if ((e.target as HTMLElement).closest('a')) return; onOpen(m.id) }}>
        <div className="pbig-ttl">🗓 {fmtDate(m)}{fmtTime(m) ? ' · ' + fmtTime(m) : ''}
          {m.pinned && <>&nbsp;<span className="badge pin">★ Pinned</span></>}
          {m.hasFathom && <>&nbsp;<span className="badge fathom">▶ Fathom</span></>}
          {m.source === 'transkriptor' && <>&nbsp;<span className="badge fathom">▤ Transkriptor</span></>}
        </div>
        {!titleIsDate && <div className="pbig-sub">{m.title}</div>}
        <div className="pbig-body" dangerouslySetInnerHTML={{ __html: sum }} />
        <div className="dash-read">{tr('readMinutes')}</div>
      </div>
    </div>
  )
}
