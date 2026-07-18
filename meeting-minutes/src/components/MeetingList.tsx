import type { Project, MeetingListItem, ProjectId } from '../types'
import { FATHOM_INBOX_ID } from '../types'
import type { Tr } from '../lib/i18n'
import { fmtDate, fmtTime } from '../lib/i18n'
import { inRange, type Range } from '../lib/ui'

interface Props {
  meetings: MeetingListItem[]
  byId: Record<string, Project>
  isAdmin: boolean
  activeProject: ProjectId
  activeId: string | null
  query: string
  /** ids matched by the debounced full-content server search for the current
   *  query (see searchMeetings) — merged into the instant client-side filter
   *  so a term buried past the excerpt still surfaces a result. */
  searchMatchIds: Set<string> | null
  range: Range
  loaded: boolean
  onRange: (r: Range) => void
  onOpen: (id: string) => void
  tr: Tr
}

const RANGE_LABELS: Record<Range, string> = { all: 'All', week: 'This week', month: 'This month' }

export default function MeetingList(props: Props) {
  const { meetings, byId, isAdmin, activeProject, activeId, query, searchMatchIds, range, loaded, onRange, onOpen, tr } = props
  const label = activeProject === 'ALL' ? tr('allMeetings') : (byId[activeProject]?.name ?? '')

  // "All meetings" is every tracked project's meetings — Fathom Inbox is a
  // standalone review queue and never folds into the ALL aggregate, even
  // though it happens to share the same meetings array (mirrors the
  // FATHOM_INBOX_ID exclusion in JavaScript.html's visibleMeetings/countInRange).
  const passesProjectFilter = (m: MeetingListItem): boolean =>
    activeProject === 'ALL' ? m.projectId !== FATHOM_INBOX_ID : m.projectId === activeProject

  const countInRange = (r: Range): number =>
    meetings.filter(m => passesProjectFilter(m) && inRange(m, r)).length

  const q = query.trim().toLowerCase()
  const items = meetings.filter(m => {
    if (!passesProjectFilter(m)) return false
    if (!inRange(m, range)) return false
    if (q) {
      const hay = (m.title + ' ' + (m.dateLabel || '') + ' ' + (m.excerpt || '') + ' ' + m.attendees.join(' ')).toLowerCase()
      const searchMatch = searchMatchIds?.has(m.id) ?? false
      if (hay.indexOf(q) === -1 && !searchMatch) return false
    }
    return true
  }).sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1
    const ova = a.kind === 'overview' ? 1 : 0, ovb = b.kind === 'overview' ? 1 : 0
    if (ova !== ovb) return ova - ovb
    return (b.date || '0000-00-00').localeCompare(a.date || '0000-00-00')
  })

  const recWord = items.length === 1 ? tr('records') : tr('recordsPlural')
  const showLoader = !loaded && !items.length

  return (
    <section className="list">
      <div className="mobile-backbar">
        <button type="button" className="mobile-back-btn" data-back-to="projects">{tr('backProjects')}</button>
      </div>
      <div className="list-head">{showLoader ? label : `${label} · ${items.length} ${recWord}`}</div>
      <div className="range">
        {(['all', 'week', 'month'] as Range[]).map(r => (
          <button key={r} className={range === r ? 'active' : ''} onClick={() => onRange(r)}>
            {RANGE_LABELS[r]} <span className="n">{countInRange(r)}</span>
          </button>
        ))}
      </div>
      <div id="cards">
        {showLoader ? (
          <div className="empty"><span className="spin" style={{ borderColor: '#ccc', borderTopColor: '#0b3d62' }} /><br /><br />Loading…</div>
        ) : !items.length ? (
          <div className="empty">No meetings match.</div>
        ) : items.map(m => {
          const p = byId[m.projectId] || ({ color: '#888' } as Project)
          const hidden = isAdmin && !m.visible
          return (
            <div key={m.id} className={'card' + (m.id === activeId ? ' active' : '') + (hidden ? ' ishidden' : '')} onClick={() => onOpen(m.id)}>
              <div className="meta">
                <span className="dot" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                <span className="date">{fmtDate(m)}{fmtTime(m) ? ' · ' + fmtTime(m) : ''}</span>
                {hidden && <span className="badge hiddenb">🚫 Hidden</span>}
                {m.pinned && <span className="badge pin">★ Pinned</span>}
                {m.kind === 'overview' && <span className="badge overview">Overview</span>}
                {m.hasFathom && <span className="badge fathom">▶ Fathom</span>}
                {(m.source === 'manual' || m.source === 'fathom') && <span className="badge manual">{m.source}</span>}
              </div>
              <div className="ttl">{m.title}</div>
              <div className="ex">{m.excerpt || ''}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
