import { useEffect, useMemo, useState } from 'react'
import type { LeaveRequest, LeaveRosterEntry, LeaveStatus, LeaveTypeCode } from './types'
import {
  BOOT, SITES, LEAVE_TYPES, rosterForLeave, myLeaveRequests, pendingLeaveRequests,
  decidedLeaveRequests, requestLeave, decideLeaveRequest, cancelLeaveRequest,
} from './mock'
import { useSettings } from './settings'

/* ---------------------------------------------------------------------------
   Requests hub ("คำขอ") — mirrors renderRequestsHub() in Code.gs.

   Layout: a submit form on the left, and one card on the right holding three
   sibling tabs (My Requests / Pending Approval / Decision History). They are
   the same tickets seen from different angles, so they share one tab strip
   rather than being stacked as separate cards.
--------------------------------------------------------------------------- */

/* Leave dates are STORED as ISO yyyy-MM-dd — sortable and unambiguous — but
   Thai users read day-first, so every date shown to a person goes through
   here. Two-digit year because the full one wastes width in a range. */
function fmtDate(iso: string): string {
  if (!iso || iso.length < 10) return iso
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`
}
/* A from–to pair as one compact string. Same month and year collapses to
   "17–18/08/26"; crossing a boundary prints both halves in full. */
function fmtRange(from: string, to: string): string {
  if (!from) return ''
  if (!to || from === to) return fmtDate(from)
  if (from.slice(0, 7) === to.slice(0, 7)) return `${from.slice(8, 10)}–${fmtDate(to)}`
  return `${fmtDate(from)} – ${fmtDate(to)}`
}
function dayCount(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`), b = new Date(`${to}T00:00:00`)
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1
}
// Approvers are recorded by email; the local part identifies them at a glance.
function shortBy(v: string): string {
  const at = v.indexOf('@')
  return at > 0 ? v.slice(0, at) : v
}

function StatusBadge({ status }: { status: LeaveStatus }) {
  const { t } = useSettings()
  const label = status === 'approved' ? t('อนุมัติแล้ว')
    : status === 'rejected' ? t('ไม่อนุมัติ') : t('รอดำเนินการ')
  return <span className={`lv-badge-chip ${status}`}>{label}</span>
}

interface TicketOpts {
  showName?: boolean
  showSite?: boolean
  showActions?: boolean
  showCancel?: boolean
  showDecided?: boolean
}

/* One ticket row. Every cell is emitted on every row — the reason included,
   even when empty — because a skipped cell would shift the rest into the wrong
   grid track and break the column alignment down the list. */
function Ticket({ r, opts, busy, onApprove, onReject, onCancel }: {
  r: LeaveRequest
  opts: TicketOpts
  busy: boolean
  onApprove?: () => void
  onReject?: () => void
  onCancel?: () => void
}) {
  const { t } = useSettings()
  const site = SITES.find((s) => s.key === r.site_key)
  const typeLabel = LEAVE_TYPES.find((x) => x.code === r.leave_type)
  return (
    <div className={`lv-ticket ${r.status}${busy ? ' lv-busy' : ''}`}>
      {opts.showName && <div className="lv-who" title={r.emp_name}>{r.emp_name}</div>}
      {opts.showName && <div className="lv-site">{site ? site.name : r.site_key}</div>}
      <div className="lv-when">{fmtRange(r.from_date, r.to_date)}</div>
      <div className="lv-days">{dayCount(r.from_date, r.to_date)} {t('วัน')}</div>
      <div className="lv-type">{typeLabel ? t(typeLabel.th) : t('ไม่ระบุ')}</div>
      <div className="lv-why" title={r.reason}>{r.reason}</div>
      <div className="lv-side">
        <span className="lv-badge">
          <StatusBadge status={r.status} />
          {opts.showDecided && r.decided_by && (
            <span className="lv-by" title={`${r.decided_by} · ${r.decided_at}`}>
              {shortBy(r.decided_by)} · {fmtDate(r.decided_at.slice(0, 10))}
            </span>
          )}
        </span>
        <div className="lv-acts">
          {opts.showActions && (
            <>
              <button className="btn" disabled={busy} onClick={onApprove}>{t('อนุมัติ')}</button>
              <button className="btn sec" disabled={busy} onClick={onReject}>{t('ไม่อนุมัติ')}</button>
            </>
          )}
          {/* Cancel exists only while the request is still pending — once
              decided the row is a record, not a draft. */}
          {opts.showCancel && r.status === 'pending' && (
            <button className="btn sec lv-del" disabled={busy} onClick={onCancel}
              title={t('ยกเลิกคำขอ')}>✕</button>
          )}
        </div>
      </div>
    </div>
  )
}

function TicketHead({ withName }: { withName: boolean }) {
  const { t } = useSettings()
  return (
    <div className="lv-ticket lv-head">
      {withName && <div>{t('ชื่อพนักงาน')}</div>}
      {withName && <div>{t('หน่วยงาน')}</div>}
      <div>{t('ช่วงวันที่ลา')}</div>
      <div className="lv-days">{t('วัน')}</div>
      <div>{t('ประเภทการลา')}</div>
      <div>{t('เหตุผล')}</div>
      <div className="lv-side">{t('สถานะ')}</div>
    </div>
  )
}

type QTab = 'mine' | 'pending' | 'history'
type HistFilter = 'all' | 'approved' | 'rejected'

export default function Requests() {
  const { t } = useSettings()

  // form state
  const [site, setSite] = useState('')
  const [eid, setEid] = useState('')
  const [roster, setRoster] = useState<LeaveRosterEntry[]>([])
  const [leaveType, setLeaveType] = useState<LeaveTypeCode>('sick')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const [flash, setFlash] = useState('')

  // list state
  const [tab, setTab] = useState<QTab>('mine')
  const [histFilter, setHistFilter] = useState<HistFilter>('all')
  const [busyId, setBusyId] = useState('')
  const [tick, setTick] = useState(0)   // bumped after every write to re-read the mock

  useEffect(() => {
    setRoster(site ? rosterForLeave(site) : [])
    setEid('')
  }, [site])

  const mine = useMemo(() => (eid ? myLeaveRequests(eid) : []), [eid, tick])
  const pending = useMemo(() => pendingLeaveRequests(), [tick])
  const decided = useMemo(() => decidedLeaveRequests(200), [tick])
  const histRows = useMemo(
    () => decided.rows.filter((r) => (histFilter === 'all' ? true : r.status === histFilter)),
    [decided, histFilter],
  )

  function submit() {
    if (!eid) return setFlash(t('กรุณาเลือกชื่อพนักงาน'))
    if (!from || !to) return setFlash(t('กรุณาระบุช่วงวันที่'))
    if (to < from) return setFlash(t('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม'))
    const res = requestLeave(eid, from, to, reason.trim(), leaveType)
    if (res.ok) {
      setFlash(t('ส่งคำขอลาแล้ว รอการอนุมัติ'))
      setFrom(''); setTo(''); setReason('')
      setTick((n) => n + 1)
    } else setFlash(t('ส่งคำขอไม่สำเร็จ'))
  }

  /* The row stays busy until the list re-renders. Releasing it as soon as the
     write returns would leave a decided row looking clickable again for a
     moment — the bug this mirrors from the live app. */
  function decide(id: string, approve: boolean) {
    setBusyId(id)
    const res = decideLeaveRequest(id, approve)
    if (!res.ok) { setBusyId(''); setFlash(t('ดำเนินการไม่สำเร็จ')); return }
    setFlash(approve ? t('อนุมัติแล้ว') : t('ไม่อนุมัติแล้ว'))
    setTick((n) => n + 1)
    setBusyId('')
  }
  function cancel(id: string) {
    setBusyId(id)
    const res = cancelLeaveRequest(id, eid)
    if (!res.ok) { setBusyId(''); setFlash(t('ยกเลิกไม่สำเร็จ')); return }
    setFlash(t('ยกเลิกคำขอแล้ว'))
    setTick((n) => n + 1)
    setBusyId('')
  }

  const nApproved = decided.rows.filter((r) => r.status === 'approved').length
  const nRejected = decided.rows.filter((r) => r.status === 'rejected').length

  return (
    <>
      <div className="card" style={{ padding: '.85rem 1.1rem' }}>
        <h1 style={{ margin: 0 }}>{t('คำขอ')}</h1>
        <div className="sub" style={{ margin: '.1rem 0 0' }}>
          {t('ขอลาและติดตามสถานะคำขอของคุณ')}
        </div>
      </div>

      {flash && <div className="flash ok" style={{ display: 'block' }}>{flash}</div>}

      <div className="req-grid">
        <div className="card">
          <h2 style={{ margin: '0 0 .3rem' }}>{t('ขอลาใหม่')}</h2>
          <div className="fld">
            <label>{t('หน่วยงาน')}</label>
            <select value={site} onChange={(e) => setSite(e.target.value)}>
              <option value="">{t('— เลือกหน่วยงาน —')}</option>
              {/* Closed projects are not offered: a leave request is new work
                  against a project. They stay on the dashboard regardless. */}
              {BOOT.sites.map((s) => (
                <option key={s.key} value={s.key}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="fld" style={{ marginTop: '.5rem' }}>
            <label>{t('ชื่อพนักงาน')}</label>
            <select value={eid} disabled={!site} onChange={(e) => setEid(e.target.value)}>
              <option value="">{site ? t('— เลือกชื่อ —') : t('— เลือกหน่วยงานก่อน —')}</option>
              {roster.map((r) => <option key={r.eid} value={r.eid}>{r.name}</option>)}
            </select>
          </div>
          <div className="fld" style={{ marginTop: '.5rem' }}>
            <label>{t('ประเภทการลา')}</label>
            <select value={leaveType} onChange={(e) => setLeaveType(e.target.value as LeaveTypeCode)}>
              {LEAVE_TYPES.map((x) => <option key={x.code} value={x.code}>{t(x.th)}</option>)}
            </select>
          </div>
          <div className="fld" style={{ marginTop: '.5rem' }}>
            <label>{t('วันที่เริ่มลา')}</label>
            <input type="date" value={from} onChange={(e) => {
              setFrom(e.target.value)
              // Single-day leave is the common case, so End follows Start.
              if (!to || to < e.target.value) setTo(e.target.value)
            }} />
          </div>
          <div className="fld" style={{ marginTop: '.5rem' }}>
            <label>{t('วันที่สิ้นสุด')}</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {/* The native date inputs render in the browser's locale, often
              mm/dd/yyyy, and HTML gives no way to override that — so this hint
              is what confirms the dates actually picked. */}
          <div className="hint" style={{ marginTop: '.15rem', minHeight: '1em' }}>
            {from && to && to >= from ? `${fmtRange(from, to)} · ${dayCount(from, to)} ${t('วัน')}` : ''}
          </div>
          <div className="fld" style={{ marginTop: '.5rem' }}>
            <label>{t('เหตุผล (ถ้ามี)')}</label>
            <input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)}
              placeholder={t('เช่น ลาป่วย ลากิจ ลาพักผ่อน')} />
          </div>
          <button className="btn" style={{ marginTop: '.7rem', width: '100%' }} onClick={submit}>
            {t('ส่งคำขอลา')}
          </button>
        </div>

        <div>
          <div className="card">
            <div className="idx-tabs" id="lvQTabs" style={{ marginBottom: '.6rem' }}>
              <button className={`idx-tab${tab === 'mine' ? ' on' : ''}`} onClick={() => setTab('mine')}>
                {t('คำขอของฉัน')}{mine.length > 0 && <span className="qcount">{mine.length}</span>}
              </button>
              {BOOT.canEntry && (
                <>
                  <button className={`idx-tab${tab === 'pending' ? ' on' : ''}`} onClick={() => setTab('pending')}>
                    {t('รออนุมัติ')}{pending.length > 0 && <span className="qcount">{pending.length}</span>}
                  </button>
                  <button className={`idx-tab${tab === 'history' ? ' on' : ''}`} onClick={() => setTab('history')}>
                    {t('ประวัติการพิจารณา')}{decided.total > 0 && <span className="qcount">{decided.total}</span>}
                  </button>
                </>
              )}
            </div>

            {tab === 'mine' && (
              !eid ? <p className="muted">{t('เลือกหน่วยงานและชื่อทางด้านซ้ายเพื่อดูคำขอของคุณ')}</p>
              : !mine.length ? <p className="muted">{t('ยังไม่มีคำขอลา')}</p>
              : <div className="lv-list lv-mine">
                  <TicketHead withName={false} />
                  {mine.map((r) => (
                    <Ticket key={r.id} r={r} opts={{ showCancel: true }} busy={busyId === r.id}
                      onCancel={() => cancel(r.id)} />
                  ))}
                </div>
            )}

            {tab === 'pending' && BOOT.canEntry && (
              <>
                <div className="hint" style={{ marginBottom: '.4rem' }}>
                  {t('ทุกหน่วยงานในสิทธิ์ของคุณ')}
                </div>
                {!pending.length ? <p className="muted">{t('ไม่มีคำขอลาที่รอดำเนินการ')}</p>
                : <div className="lv-list">
                    <TicketHead withName />
                    {pending.map((r) => (
                      <Ticket key={r.id} r={r} opts={{ showName: true, showSite: true, showActions: true }}
                        busy={busyId === r.id}
                        onApprove={() => decide(r.id, true)} onReject={() => decide(r.id, false)} />
                    ))}
                  </div>}
              </>
            )}

            {tab === 'history' && BOOT.canEntry && (
              <>
                <div className="seg" style={{ marginBottom: '.5rem' }}>
                  {(['all', 'approved', 'rejected'] as HistFilter[]).map((f) => (
                    <button key={f} className={histFilter === f ? 'on' : ''} onClick={() => setHistFilter(f)}>
                      {f === 'all' ? t('ทั้งหมด') : f === 'approved' ? t('อนุมัติแล้ว') : t('ไม่อนุมัติ')}
                    </button>
                  ))}
                </div>
                {!histRows.length ? <p className="muted">{t('ยังไม่มีประวัติการพิจารณา')}</p>
                : <>
                    <div className="hint" style={{ marginBottom: '.4rem' }}>
                      {t('อนุมัติแล้ว')} {nApproved} · {t('ไม่อนุมัติ')} {nRejected}
                      {/* Say plainly when the server capped the list, so a
                          partial history never reads as the whole record. */}
                      {decided.total > decided.rows.length &&
                        <b> · {t('แสดง')} {decided.rows.length}/{decided.total}</b>}
                    </div>
                    <div className="lv-list">
                      <TicketHead withName />
                      {histRows.map((r) => (
                        <Ticket key={r.id} r={r} busy={false}
                          opts={{ showName: true, showSite: true, showDecided: true }} />
                      ))}
                    </div>
                  </>}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
