// Timeline view — mirrors renderTimeline()/renderTimelineHorizontal()/
// renderTimelineCalendar() in JavaScript.html. Two view modes toggled by pill
// buttons in the header: "Horizontal" (one lane per project, meetings plotted
// as dots along a shared date axis with month tick marks and dashed vertical
// gridlines) and "Calendar" (a full 12-month year grid, 4 columns x 3 rows,
// each mini-month showing day cells with small colored dots for meetings that
// day, today highlighted). Per-project toggle chips show/hide a project's
// dots in both views. Both view modes share one fixed-height layout shell so
// the header row never shifts between modes. Meetings without kind==='overview',
// without a real date, or belonging to either inbox pseudo-project are excluded.
import { useMemo, useState } from 'react'
import type { Project, MeetingListItem, ProjectId } from '../types'
import { isInboxProject } from '../types'

interface Props {
  projects: Project[]
  meetings: MeetingListItem[]
  byId: Record<string, Project>
  loaded: boolean
  onOpen: (id: string) => void
}

type TlMode = 'horizontal' | 'calendar'

// Icon glyphs read verbatim out of renderTimeline() in JavaScript.html.
const ICON_BARS = (
  <svg viewBox="0 0 20 20" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 16V9" /><path d="M10 16V4" /><path d="M16 16v-6" />
  </svg>
)
const ICON_CAL = (
  <svg viewBox="0 0 20 20" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <rect x={3} y={4.5} width={14} height={12} rx={1.8} /><path d="M3 8.5h14" /><path d="M6.5 3v3" /><path d="M13.5 3v3" />
  </svg>
)

function pad2(n: number): string { return (n < 10 ? '0' : '') + n }
function isoOf(d: Date): string { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) }

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function Timeline({ projects, meetings, byId, loaded, onOpen }: Props) {
  const [mode, setMode] = useState<TlMode>('horizontal')
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [hidden, setHidden] = useState<Record<ProjectId, boolean>>({})

  const trackedProjects = useMemo(() => projects.filter(p => !isInboxProject(p.id)), [projects])

  // Real, dated meetings only — no Overview rows (undated), no inbox
  // duplicates (a tagged recording's inbox copy would double-plot it
  // alongside its project copy since both share the same date).
  const timelineMeetings = useMemo(() => meetings.filter(m =>
    m.kind !== 'overview' && !isInboxProject(m.projectId) && m.date && !hidden[m.projectId]
  ), [meetings, hidden])

  if (!loaded) {
    return <div className="placeholder"><div className="spin" style={{ borderColor: '#ccc', borderTopColor: '#0b3d62' }} /><div>Loading…</div></div>
  }

  function toggleProject(pid: ProjectId): void {
    setHidden(h => { const next = { ...h }; if (next[pid]) delete next[pid]; else next[pid] = true; return next })
  }

  return (
    <div className="tl-wrap">
      <div className="tl-head">
        <h2>{ICON_CAL} Timeline</h2>
        {mode === 'calendar' && (
          <div className="tl-year-nav">
            <button type="button" className="dbtn" onClick={() => setYear(y => y - 1)}>{'← '}</button>
            <b>{year}</b>
            <button type="button" className="dbtn" onClick={() => setYear(y => y + 1)}>{' →'}</button>
          </div>
        )}
        <div className="tl-mode-switch">
          <button type="button" className={mode === 'horizontal' ? 'active' : ''} onClick={() => setMode('horizontal')}>{ICON_BARS} Horizontal</button>
          <button type="button" className={mode === 'calendar' ? 'active' : ''} onClick={() => setMode('calendar')}>{ICON_CAL} Calendar</button>
        </div>
      </div>
      <div className="tl-toggles">
        {trackedProjects.map(p => {
          const off = !!hidden[p.id]
          return (
            <button key={p.id} type="button" className={'tl-toggle' + (off ? ' off' : '')} style={{ ['--c' as string]: p.color }} onClick={() => toggleProject(p.id)}>
              <span className="dot" style={{ background: off ? '#ccc' : p.color }} />{p.name}
            </button>
          )
        })}
      </div>
      <div id="tlBody">
        {mode === 'horizontal'
          ? <TimelineHorizontal projects={trackedProjects} meetings={timelineMeetings} hidden={hidden} onOpen={onOpen} />
          : <TimelineCalendar meetings={timelineMeetings} byId={byId} year={year} onOpen={onOpen} />}
      </div>
    </div>
  )
}

function TimelineHorizontal({ projects, meetings, hidden, onOpen }: {
  projects: Project[]; meetings: MeetingListItem[]; hidden: Record<ProjectId, boolean>; onOpen: (id: string) => void
}) {
  if (!meetings.length) return <div className="empty">No dated meetings match the current project filter.</div>

  const dates = meetings.map(m => m.date).sort()
  const minD = new Date(dates[0]), maxD = new Date(dates[dates.length - 1])
  // Pad both ends by ~3% of the span so dots at the very edges aren't clipped.
  const spanMs = Math.max(1, maxD.getTime() - minD.getTime())
  const padMs = spanMs * 0.03
  const startMs = minD.getTime() - padMs, endMs = maxD.getTime() + padMs
  const totalMs = endMs - startMs
  const pct = (dateStr: string) => ((new Date(dateStr).getTime() - startMs) / totalMs) * 100

  const byProject: Record<string, MeetingListItem[]> = {}
  meetings.forEach(m => { (byProject[m.projectId] = byProject[m.projectId] || []).push(m) })

  const lanes = projects.filter(p => !hidden[p.id] && byProject[p.id]?.length)
  const ticks: { left: number; label: string }[] = []
  const cursor = new Date(minD.getFullYear(), minD.getMonth(), 1)
  while (cursor <= maxD) {
    const p2 = pct(cursor.toISOString().slice(0, 10))
    if (p2 >= 0 && p2 <= 100) ticks.push({ left: p2, label: MONTH_ABBR[cursor.getMonth()] + ' \'' + String(cursor.getFullYear()).slice(-2) })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return (
    <div className="tl-horizontal">
      <div className="tl-lanes-area">
        {lanes.length ? lanes.map(p => {
          const pts = byProject[p.id].slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''))
          return (
            <div key={p.id} className="tl-lane">
              <div className="tl-lane-label"><span className="dot" style={{ background: p.color }} />{p.name} <small>({pts.length})</small></div>
              <div className="tl-lane-track">
                {pts.map(m => (
                  <div key={m.id} className="tl-dot" style={{ left: pct(m.date).toFixed(2) + '%', ['--c' as string]: p.color }}
                    title={m.title + ' — ' + m.dateLabel} onClick={() => onOpen(m.id)} />
                ))}
              </div>
            </div>
          )
        }) : <div className="empty">No visible projects have dated meetings.</div>}
        <div className="tl-gridlines">
          {ticks.map((t, i) => <div key={i} className="tl-gridline" style={{ left: t.left.toFixed(2) + '%' }} />)}
        </div>
      </div>
      <div className="tl-axis">
        {ticks.map((t, i) => <div key={i} className="tl-tick" style={{ left: t.left.toFixed(2) + '%' }}>{t.label}</div>)}
      </div>
    </div>
  )
}

function TimelineCalendar({ meetings, byId, year, onOpen }: {
  meetings: MeetingListItem[]; byId: Record<string, Project>; year: number; onOpen: (id: string) => void
}) {
  const byDate: Record<string, MeetingListItem[]> = {}
  meetings.forEach(m => { (byDate[m.date] = byDate[m.date] || []).push(m) })
  const todayIso = isoOf(new Date())

  return (
    <div className="tl-year-grid">
      {MONTH_FULL.map((name, mo) => {
        const firstDow = new Date(year, mo, 1).getDay()
        const daysInMonth = new Date(year, mo + 1, 0).getDate()
        const cells: React.ReactNode[] = []
        for (let i = 0; i < firstDow; i++) cells.push(<div key={'e' + i} className="tl-year-day tl-year-day-empty" />)
        for (let d = 1; d <= daysInMonth; d++) {
          const iso = year + '-' + pad2(mo + 1) + '-' + pad2(d)
          const dayMeetings = byDate[iso] || []
          const isToday = iso === todayIso
          const cls = 'tl-year-day' + (isToday ? ' tl-year-day-today' : '') + (dayMeetings.length ? ' tl-year-day-has-meetings' : '')
          const titleAttr = dayMeetings.length ? dayMeetings.map(m => m.title).join(', ') : undefined
          const click = dayMeetings.length ? () => onOpen(dayMeetings[0].id) : undefined
          cells.push(
            <div key={d} className={cls} title={titleAttr} onClick={click}>
              {d}
              {dayMeetings.length > 0 && (
                <div className="tl-year-day-dots">
                  {dayMeetings.slice(0, 3).map((m, i) => (
                    <span key={i} style={{ background: (byId[m.projectId] || { color: '#888' }).color }} />
                  ))}
                </div>
              )}
            </div>
          )
        }
        return (
          <div key={mo} className="tl-year-month">
            <div className="tl-year-month-name">{name}</div>
            <div className="tl-year-dow">{DOW_LABELS.map((l, i) => <div key={i}>{l}</div>)}</div>
            <div className="tl-year-grid-days">{cells}</div>
          </div>
        )
      })}
    </div>
  )
}
