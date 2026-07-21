import type { Project, MeetingListItem, ProjectId } from '../types'
import { isInboxProject } from '../types'
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

  // Timeline mode replaces the list column entirely — the timeline itself
  // renders in the detail pane (see App.tsx); mirrors renderList()'s early
  // branch in JavaScript.html (listHead -> "Timeline", rangeFilter/cards cleared).
  if (activeProject === 'TIMELINE') {
    return (
      <section className="list">
        <div className="mobile-backbar">
          <button type="button" className="mobile-back-btn" data-back-to="projects">{tr('backProjects')}</button>
        </div>
        <div className="list-head">Timeline</div>
        <div className="range" />
        <div id="cards" />
      </section>
    )
  }

  const label = activeProject === 'ALL' ? tr('allMeetings') : (byId[activeProject]?.name ?? '')

  // "All meetings" is every tracked project's meetings — neither inbox
  // pseudo-project folds into the ALL aggregate, even though they happen to
  // share the same meetings array (mirrors the isInboxProject_ exclusion in
  // JavaScript.html's visibleMeetings/countInRange).
  const passesProjectFilter = (m: MeetingListItem): boolean =>
    activeProject === 'ALL' ? !isInboxProject(m.projectId) : m.projectId === activeProject

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
                {m.source === 'transkriptor' && <span className="badge fathom">▤ Transkriptor</span>}
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
