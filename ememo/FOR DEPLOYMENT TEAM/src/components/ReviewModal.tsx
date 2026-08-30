import { useEffect, useMemo, useRef, useState } from 'react'
import { api, type ReviewResult, type Department, type ReviewEntry } from '../api'
import { PROJ_NAMES, fmtCode, pad3 } from '../i18n'
import { useStore } from '../store'
import { useConfirm } from './AckDialog'
import type { FlatRow } from '../App'

type Pending = 'comment' | 'approve' | 'reject' | 'reopen' | null

const STATUS_LABEL: Record<string, string> = { pending: '• Pending', commented: '💬 Comment', approved: '✓ Approved', rejected: '✕ Rejected' }
const STATUS_COLOR: Record<string, string> = { approved: '#137333', rejected: '#c5221f', commented: '#1a56c4', pending: '#8a5a00' }
const ACTION_LABEL: Record<string, string> = {
  comment: '💬 Comment', approve: '✓ Approved', reject: '✕ Rejected', reopen: '↺ Reopened / revision requested', delete: '🗑 Deleted', mango: '↗ Mango ERP',
}

interface Props { doc: FlatRow; onClose: () => void; onChanged: () => void }

export default function ReviewModal({ doc, onClose, onChanged }: Props) {
  const { auth, signIn } = useStore()
  const [review, setReview] = useState<ReviewResult | null>(null)
  const [depts, setDepts] = useState<Department[]>([])
  const [pending, setPending] = useState<Pending>(null)
  const [note, setNote] = useState('')
  const [mode, setMode] = useState<'type' | 'draw'>('type')
  const [cc, setCc] = useState<Record<string, boolean>>({})
  const [ccEmail, setCcEmail] = useState('')
  const [msg, setMsg] = useState<{ text: string; kind: 'busy' | 'err' | '' }>({ text: '', kind: '' })
  const [busy, setBusy] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inkedRef = useRef(false)
  const { confirm, dialog } = useConfirm()

  const isMgr = !!auth?.manager
  const status = review?.status ?? 'pending'
  const locked = !!review?.locked
  const mangoSent = useMemo(() => (review?.entries ?? []).some((e) => e.action === 'mango'), [review])

  const load = async () => { setReview(await api.getReview(doc.id)) }
  useEffect(() => { void load(); void api.getDepartments().then(setDepts); setPending(null); setNote('') /* eslint-disable-next-line */ }, [doc.id])

  const refLabel = useMemo(() => {
    const c = fmtCode(doc.code)
    return c ? `${doc.proj}-${c}` : doc.proj
  }, [doc])

  const arm = (kind: Exclude<Pending, null>) => { setPending(kind); setNote(''); setMsg({ text: '', kind: '' }) }

  const ccArgs = () => ({
    ccDepts: Object.keys(cc).filter((k) => cc[k]).join(','),
    ccEmails: ccEmail.trim(),
  })

  const inkData = (): string => {
    if (mode !== 'draw' || !inkedRef.current || !canvasRef.current) return ''
    try { return canvasRef.current.toDataURL('image/png') } catch { return '' }
  }

  const submit = async () => {
    if (!auth || !pending) return
    setBusy(true); setMsg({ text: 'Saving…', kind: 'busy' })
    const base = { authToken: auth.token, docId: doc.id, project: doc.proj, text: note, ink: inkData(), ...ccArgs() }
    let res: ReviewResult
    if (pending === 'comment') res = await api.addReviewComment(base)
    else if (pending === 'reopen') res = await api.reopenDocument(base)
    else res = await api.submitDecision({ ...base, decision: pending })
    setBusy(false)
    if (!res.ok) { setMsg({ text: '⚠️ ' + (res.error ?? 'Error'), kind: 'err' }); return }
    setReview(res); setPending(null); setNote(''); setCc({}); setCcEmail(''); inkedRef.current = false
    setMsg({ text: '', kind: '' })
    onChanged()
  }

  const sendMango = async () => {
    if (!auth) return
    setBusy(true)
    const r = await api.sendToMangoERP({ authToken: auth.token, docId: doc.id, project: doc.proj })
    setBusy(false)
    setMsg({ text: r.ok ? (r.message ?? '✓ Sent to Mango ERP') : ('⚠️ ' + (r.error ?? 'Error')), kind: r.ok ? 'busy' : 'err' })
    if (r.ok) void load()
  }

  const del = async () => {
    if (!auth) return
    const okGo = await confirm({ title: 'Delete document?', message: `Permanently remove “${doc.subject}” and its discussion. This cannot be undone.`, okLabel: '🗑 Delete', danger: true })
    if (!okGo) return
    setBusy(true)
    const r = await api.deleteDocument({ authToken: auth.token, docId: doc.id, project: doc.proj })
    setBusy(false)
    if (r.ok) { onChanged(); onClose() }
    else setMsg({ text: '⚠️ ' + (r.error ?? 'Error'), kind: 'err' })
  }

  const deleteOwnLast = async () => {
    if (!auth) return
    const okGo = await confirm({ title: 'Remove your last entry?', message: 'This deletes your most recent comment on this document.', okLabel: '× Delete', danger: true })
    if (!okGo) return
    const r = await api.deleteOwnLastEntry(auth.token, doc.id)
    if (r.ok) { setReview(r); onChanged() }
  }

  // Canvas drawing (Type/Draw composer mode).
  useEffect(() => {
    if (mode !== 'draw' || !pending) return
    const c = canvasRef.current
    if (!c) return
    c.width = c.offsetWidth; c.height = 190
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a3a6b'
    let drawing = false
    const pos = (e: PointerEvent) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
    const down = (e: PointerEvent) => { drawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y) }
    const move = (e: PointerEvent) => { if (!drawing) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); inkedRef.current = true }
    const up = () => { drawing = false }
    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [mode, pending])

  const canConfirm = pending === 'approve' || pending === 'reject' || pending === 'reopen' || (pending === 'comment' && (note.trim() !== '' || inkedRef.current))
  const confirmLabel = pending === 'approve' ? '✓ Confirm approval' : pending === 'reject' ? '✕ Confirm rejection'
    : pending === 'reopen' ? '↺ Confirm reopen' : 'Post comment'
  const confirmColor = pending === 'approve' ? '#34a853' : pending === 'reject' ? '#ea4335' : pending === 'reopen' ? '#8a5a00' : '#1a73e8'

  const entries = (review?.entries ?? []).filter((e) => e.action !== 'mango')
  const myEmail = (auth?.email ?? '').toLowerCase()
  const lastIdx = entries.length - 1

  const renderEntry = (en: ReviewEntry, i: number) => {
    let text = String(en.text || ''), ccPart = ''
    const cpos = text.indexOf('␟CC␟')
    if (cpos >= 0) { ccPart = text.slice(cpos + 4); text = text.slice(0, cpos) }
    let inkImg = '', noteText = text
    if (text.indexOf('INK:') === 0) {
      const nl = text.indexOf('\n')
      inkImg = nl >= 0 ? text.slice(4, nl) : text.slice(4)
      noteText = nl >= 0 ? text.slice(nl + 1) : ''
    }
    const canDelete = i === lastIdx && myEmail && en.email.toLowerCase() === myEmail && en.action === 'comment' && !locked
    return (
      <li key={i}>
        <div className={'rvc1 ' + en.action}>
          <div className="meta">
            <span className="act">{ACTION_LABEL[en.action] ?? en.action}</span> · {en.email} · {en.time}
            {canDelete && <button className="rvCmtDel" style={{ marginLeft: 8 }} onClick={() => void deleteOwnLast()} title="Remove your last entry">× Delete</button>}
          </div>
          {inkImg && <img src={inkImg} alt="ink" style={{ maxWidth: '100%', border: '1px solid #e0e0e0', borderRadius: 4, background: '#fff' }} />}
          {noteText && <div className="tx">{noteText}</div>}
          {ccPart && <div style={{ fontSize: 12, color: '#8a5a00', background: '#fff4e5', border: '1px solid #ffd9a8', borderRadius: 5, padding: '3px 8px', marginTop: 5, display: 'inline-block' }}>🔔 CC: {ccPart}</div>}
        </div>
      </li>
    )
  }

  return (
    <div id="rvWrap" style={{ display: 'block' }}>
      <div className="rvbox">
        <div className="rvhd">
          <h3 id="rvTitle">{doc.subject}</h3>
          <span>
            <button id="rvClose" className="btc" onClick={onClose}>✕ Close</button>
            {isMgr && <button id="rvDel" className="btc" style={{ marginRight: 8, borderColor: '#c5221f', color: '#c5221f' }} onClick={() => void del()} title="Delete document">🗑 Delete</button>}
          </span>
        </div>

        <div className="rvbody">
          <div className="rvstack">
            <div className="rvpage">
              <h4>{PROJ_NAMES[doc.proj] || doc.proj}</h4>
              <div className="sub">เลขที่อ้างอิง · Ref. {refLabel}/{pad3(doc.num)} &nbsp;·&nbsp; วันที่ {doc.date}</div>
              <p style={{ margin: '10px 0' }}><b>เรียน</b> ผู้จัดการโครงการ</p>
              <p style={{ margin: '10px 0' }}><b>เรื่อง</b> {doc.subject}</p>
              <p style={{ margin: '16px 0', lineHeight: 1.9, textAlign: 'justify' }}>
                ตามที่โครงการได้ดำเนินการในส่วนงานที่เกี่ยวข้องนั้น บัดนี้ทางหน่วยงานขอเรียนเสนอรายละเอียดตามเอกสาร
                “{doc.subject}” เพื่อโปรดพิจารณาดำเนินการในส่วนที่เกี่ยวข้องต่อไป {doc.desc ? `(${doc.desc})` : ''}
              </p>
              <p style={{ margin: '24px 0 4px' }}>จึงเรียนมาเพื่อโปรดพิจารณา</p>
              <p style={{ margin: '40px 0 0', textAlign: 'right' }}>ขอแสดงความนับถือ</p>
              <p style={{ margin: '36px 0 0', textAlign: 'right' }}>(ผู้จัดการโครงการ {doc.proj})</p>
            </div>

            <div className="rvst" style={{ background: STATUS_COLOR[status] }}>
              Status: <span style={{ color: '#fff' }}>{STATUS_LABEL[status]}</span>
            </div>

            <div className="rvpage">
              <h4>ความเห็น / Comments</h4>
              <div className="sub">บันทึกความเห็นและการพิจารณา · numbered, with room for many reviewers</div>
              {entries.length === 0
                ? <div style={{ color: '#999', fontSize: 14, padding: '14px 0' }}>ยังไม่มีความเห็น — No comments yet.</div>
                : <ol className="rvol" start={1}>{entries.map(renderEntry)}</ol>}
            </div>
          </div>
        </div>

        <div className="rvft" id="rvFoot">
          {!auth ? (
            <div id="rvSignIn" style={{ display: 'block', textAlign: 'center' }}>
              <button className="rvb cm" onClick={() => signIn()}>🔐 Sign in with Google to comment / decide</button>
            </div>
          ) : locked && !isMgr ? (
            <div className="rvlock" style={{ display: 'block' }}>This document is {status} — locked. The discussion above stays visible.</div>
          ) : (
            <div id="rvForm" className={pending ? 'armed' : ''} style={{ display: 'block' }}>
              <div id="rvStep1">
                <div className="rvacts">
                  {!locked && <button className={'rvb cm' + (pending === 'comment' ? ' sel' : '')} onClick={() => arm('comment')}>💬 Comment</button>}
                  {!locked && isMgr && <button className={'rvb ap' + (pending === 'approve' ? ' sel' : '')} onClick={() => arm('approve')}>✓ Approve</button>}
                  {!locked && isMgr && <button className={'rvb rj' + (pending === 'reject' ? ' sel' : '')} onClick={() => arm('reject')}>✕ Reject</button>}
                  {locked && isMgr && <button className={'rvb' + (pending === 'reopen' ? ' sel' : '')} style={{ background: '#8a5a00', color: '#fff' }} onClick={() => arm('reopen')}>↺ Reopen / Request revision</button>}
                  {isMgr && status === 'approved' && <button className="rvb" style={{ background: mangoSent ? '#137333' : '#1a73e8', color: '#fff' }} disabled={busy} onClick={() => void sendMango()}>{mangoSent ? '✓ In Mango ERP' : '↗ Send to Mango ERP'}</button>}
                </div>
              </div>

              <div id="rvStep2">
                <div id="rvModeRow" style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                  <button type="button" id="rvModeType" className="rvb" style={{ padding: '4px 10px', fontSize: 12, background: mode === 'type' ? '#1a73e8' : '#eee', color: mode === 'type' ? '#fff' : '#333' }} onClick={() => setMode('type')}>⌨ Type</button>
                  <button type="button" id="rvModeDraw" className="rvb" style={{ padding: '4px 10px', fontSize: 12, background: mode === 'draw' ? '#1a73e8' : '#eee', color: mode === 'draw' ? '#fff' : '#333' }} onClick={() => setMode('draw')}>✍️ Draw / Apple Pencil</button>
                  {mode === 'draw' && <button type="button" className="rvb" style={{ padding: '4px 10px', fontSize: 12, background: '#fff', color: '#c5221f', border: '1.5px solid #c5221f' }} onClick={() => { const c = canvasRef.current; const ctx = c?.getContext('2d'); if (c && ctx) ctx.clearRect(0, 0, c.width, c.height); inkedRef.current = false }}>Clear</button>}
                </div>
                <div className="rvcompose">
                  <div className="rvcleft">
                    {mode === 'type'
                      ? <textarea id="rvText" value={note} onChange={(e) => setNote(e.target.value)} placeholder={pending ? 'Add your note…' : 'Choose an action above to add your note…'} />
                      : <canvas ref={canvasRef} style={{ width: '100%', border: '1.5px dashed #1a73e8', borderRadius: 6, touchAction: 'none', cursor: 'crosshair' }} />}
                  </div>
                  <div id="rvCcWrap">
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '.4px', marginBottom: 5 }}>🔔 ALSO NOTIFY <span style={{ fontWeight: 400, color: '#9aa0b2' }}>(optional CC)</span></div>
                    <div id="rvCcDepts" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {depts.map((d) => (
                        <button key={d.key} type="button" className={'ccchip' + (cc[d.key] ? ' on' : '')} onClick={() => setCc((p) => ({ ...p, [d.key]: !p[d.key] }))}>{d.label}</button>
                      ))}
                    </div>
                    <input type="text" value={ccEmail} onChange={(e) => setCcEmail(e.target.value)} placeholder="…or type email(s)" style={{ width: '100%', marginTop: 7, padding: '7px 10px', border: '1.5px solid #e1e4ee', borderRadius: 8, fontSize: 12, boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div className="rvacts">
                  <button className="rvb" id="rvConfirm" disabled={!canConfirm || busy} style={canConfirm ? { background: confirmColor, color: '#fff' } : undefined} onClick={() => void submit()}>{pending ? confirmLabel : 'Confirm'}</button>
                  <span id="rvConfirmHint">Nothing is sent until you confirm.</span>
                  <span id="rvWho">{`Signed in as ${auth.email}${isMgr ? ' (manager)' : ''}`}</span>
                </div>
              </div>
              {msg.text && <span className="rvmsg" id="rvMsg" style={{ display: 'block', marginTop: 8, color: msg.kind === 'err' ? '#c5221f' : '#555' }}>{msg.text}</span>}
            </div>
          )}
        </div>
      </div>
      {dialog}
    </div>
  )
}
