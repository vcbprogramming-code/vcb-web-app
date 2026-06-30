import type { Project, MeetingListItem, ProjectId } from '../types'
import type { Tr } from '../lib/i18n'
import MobileLatest from './MobileLatest'

interface Props {
  projects: Project[]
  meetings: MeetingListItem[]
  byId: Record<string, Project>
  isAdmin: boolean
  active: ProjectId
  onPick: (id: ProjectId) => void
  onOpen: (id: string) => void
  onNew: () => void
  tr: Tr
}

interface Row { id: ProjectId; name: string; nameEn: string; color: string; count: number }

export default function Sidebar({ projects, meetings, byId, isAdmin, active, onPick, onOpen, onNew, tr }: Props) {
  const total = projects.reduce((a, p) => a + p.count, 0)
  const rows: Row[] = [
    { id: 'ALL', name: tr('allMeetings'), nameEn: tr('allMeetingsSub'), color: '#0b3d62', count: total },
    ...projects.map(p => ({ id: p.id, name: p.name, nameEn: p.nameEn, color: p.color, count: p.count }))
  ]
  return (
    <aside className="sidebar">
      <MobileLatest meetings={meetings} byId={byId} isAdmin={isAdmin} onOpen={onOpen} tr={tr} />
      <div className="side-label">{tr('projects')}</div>
      <div>
        {rows.map(p => (
          <div key={p.id} className={'proj' + (active === p.id ? ' active' : '')} data-id={p.id} onClick={() => onPick(p.id)}>
            <span className="dot" style={{ background: p.color }} />
            <span className="pn"><b>{p.name}</b><small>{p.nameEn || ''}</small></span>
            <span className="cnt">{p.count}</span>
          </div>
        ))}
      </div>
      {isAdmin && <button className="newbtn" onClick={onNew}>{tr('newMeeting')}</button>}
    </aside>
  )
}
