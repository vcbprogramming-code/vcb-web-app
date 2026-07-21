// Unified activity + version timeline — mirrors #ehBg/#ehList/#ehClose in
// Index.html + openEditHistory()/renderEditHistory() in JavaScript.html.
// "View Original" is always shown, pinned above the activity list (finds the
// oldest snapshot directly via getOriginalContent, independent of any single
// audit entry's data). Per-entry "View" additionally appears on entries that
// recorded their own pre-edit versionSeq.
//
// create_* entries (create_meeting/create_project/…) are filtered out of the
// activity list — they're the same originating event the pinned "Original"
// row above already represents (with a guaranteed-correct timestamp);
// repeating it below reads as if something were created after a later edit.
// The "Original" row's subtitle shows the real creation timestamp
// (`Created <when>`) when EH_MEETING.createdAt is available, falling back to
// the generic "The first saved version of this meeting" label otherwise.
import { useEffect, useState } from 'react'
import type { AuditEntry, MeetingFull } from '../types'

interface Props {
  meeting: MeetingFull | null // non-null => open
  fetchHistory: (meetingId: string) => Promise<AuditEntry[]>
  onClose: () => void
  onViewOriginal: (meetingId: string) => void
  onViewVersion: (meetingId: string, seq: string) => void
}

export default function EditHistoryModal({ meeting, fetchHistory, onClose, onViewOriginal, onViewVersion }: Props) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!meeting) { setEntries(null); setErr(''); return }
    let alive = true
    setEntries(null); setErr('')
    fetchHistory(meeting.id).then(list => { if (alive) setEntries(list) })
      .catch(e => { if (alive) setErr(e instanceof Error ? e.message : String(e)) })
    return () => { alive = false }
  }, [meeting, fetchHistory])

  if (!meeting) return null

  // create_meeting/create_project etc. duplicate the pinned "Original" row.
  const activity = (entries || []).filter(e => e.action.indexOf('create_') !== 0)
  const createdWhen = meeting.createdAt ? new Date(meeting.createdAt).toLocaleString() : ''

  return (
    <div className="modal-bg show" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <h3>Edit history</h3>
        <div className="form" style={{ gap: 0, maxHeight: 'calc(80vh - 130px)', overflow: 'auto' }}>
          {err ? <div className="empty">Failed: {err}</div> : entries === null ? <div className="empty">Loading…</div> : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 0 13px', borderBottom: '2px solid var(--line)', marginBottom: 4, fontSize: 13 }}>
                <span>
                  <b>Original</b><br />
                  <span style={{ color: 'var(--ink-faint)', fontSize: 11.5 }}>
                    {createdWhen ? 'Created ' + createdWhen : 'The first saved version of this meeting'}
                  </span>
                </span>
                <button type="button" className="dbtn primary" onClick={() => onViewOriginal(meeting.id)}>View Original</button>
              </div>
              {activity.length ? activity.map((e, i) => {
                const when = new Date(e.when).toLocaleString()
                const seq = e.details && e.details.versionSeq
                const canView = seq !== undefined && seq !== null
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
                    <span>
                      <b>{e.action}</b> · {e.who}<br />
                      <span style={{ color: 'var(--ink-faint)', fontSize: 11.5 }}>{when}</span>
                    </span>
                    {canView && (
                      <button type="button" className="dbtn" title="See what it looked like before this edit"
                        onClick={() => onViewVersion(meeting.id, String(seq))}>View</button>
                    )}
                  </div>
                )
              }) : <div className="empty" style={{ padding: '8px 0' }}>No activity recorded yet.</div>}
            </>
          )}
        </div>
        <div className="actions"><button className="dbtn" onClick={onClose}>Close</button></div>
      </div>
    </div>
  )
}
