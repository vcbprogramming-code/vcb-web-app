import type { Project, MeetingListItem } from '../types'
import { isInboxProject } from '../types'
import type { Tr } from '../lib/i18n'
import { fmtDate, fmtTime } from '../lib/i18n'
import { cssVar } from '../lib/ui'

interface Props {
  meetings: MeetingListItem[]
  byId: Record<string, Project>
  isAdmin: boolean
  loaded: boolean
  onOpen: (id: string) => void
  tr: Tr
}

// Compact "latest 2" strip shown at the top of the mobile projects pane
// (hidden on desktop via CSS). Mirrors renderMobileLatest(). Both inbox
// pseudo-projects are excluded — same standalone-queue rule as Dashboard/MeetingList.
export default function MobileLatest({ meetings, byId, isAdmin, loaded, onOpen, tr }: Props) {
  const latest = meetings
    .filter(m => m.kind !== 'overview' && !isInboxProject(m.projectId) && (isAdmin || m.visible !== false))
    .slice()
    .sort((a, b) => (b.date || '0000-00-00').localeCompare(a.date || '0000-00-00'))
    .slice(0, 2)

  // Before the first meetings fetch resolves, show inert placeholder tiles at
  // the same size as real ones instead of nothing — otherwise the project
  // list below sits flush at the top and then gets shoved down the instant
  // real tiles pop in, right as a user's thumb lands on what had been a
  // project row a moment earlier.
  if (!loaded && latest.length === 0) {
    return (
      <div className="mobile-latest">
        <div className="ml-label">{tr('latestMeetings')}</div>
        <div className="ml-item ml-skeleton" />
        <div className="ml-item ml-skeleton" />
      </div>
    )
  }

  return (
    <div className="mobile-latest">
      {latest.length > 0 && <div className="ml-label">{tr('latestMeetings')}</div>}
      {latest.map(m => {
        const p = byId[m.projectId] || ({} as Project)
        return (
          <div key={m.id} className="ml-item" style={cssVar('--c', p.color || '#888')} onClick={() => onOpen(m.id)}>
            <div className="ml-proj">{p.name || ''}</div>
            <div className="ml-date">🗓 {fmtDate(m)}{fmtTime(m) ? ' · ' + fmtTime(m) : ''}</div>
            <div className="ml-ttl">{m.title}</div>
            <div className="ml-ex">{m.excerpt || ''}</div>
            <div className="ml-read">{tr('readMinutes')}</div>
          </div>
        )
      })}
    </div>
  )
}
