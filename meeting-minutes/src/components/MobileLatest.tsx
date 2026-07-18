import type { Project, MeetingListItem } from '../types'
import { FATHOM_INBOX_ID } from '../types'
import type { Tr } from '../lib/i18n'
import { fmtDate, fmtTime } from '../lib/i18n'
import { cssVar } from '../lib/ui'

interface Props {
  meetings: MeetingListItem[]
  byId: Record<string, Project>
  isAdmin: boolean
  onOpen: (id: string) => void
  tr: Tr
}

// Compact "latest 2" strip shown at the top of the mobile projects pane
// (hidden on desktop via CSS). Mirrors renderMobileLatest(). Fathom Inbox is
// excluded — same standalone-queue rule as Dashboard/MeetingList.
export default function MobileLatest({ meetings, byId, isAdmin, onOpen, tr }: Props) {
  const latest = meetings
    .filter(m => m.kind !== 'overview' && m.projectId !== FATHOM_INBOX_ID && (isAdmin || m.visible !== false))
    .slice()
    .sort((a, b) => (b.date || '0000-00-00').localeCompare(a.date || '0000-00-00'))
    .slice(0, 2)

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
