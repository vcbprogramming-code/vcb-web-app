import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { TO_BY_CODE, pad3 } from '../i18n'
import { useStore } from '../store'
import type { FlatRow } from '../App'
import type { LetterheadMeta } from '../api'

const PROJECTS = ['BT1', 'VC', 'VK2', 'CVE', 'LPB', 'BV', 'PN4', 'EP', 'V&K']
const CODES = ['01', '02A', '02B', '02C', '03', '05', '06', '08', '09', '10']

// Next running number for project+code — same regex as updateRunningNo().
function nextRunning(rows: FlatRow[], project: string, code: string): number {
  const sig = String(code).replace(/^0+/, '')
  const escd = sig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp('(?:^|[^0-9A-Za-z])0*' + escd + '[\\/\\-\\s]+0*(\\d{1,5})', 'gi')
  let max = -1
  for (const r of rows) {
    if (r.proj !== project) continue
    const hay = String(r.subject || '') + '  ' + String(r.ref || '')
    let m: RegExpExecArray | null
    re.lastIndex = 0
    while ((m = re.exec(hay)) !== null) {
      const n = parseInt(m[1]!, 10)
      if (!isNaN(n) && n > max) max = n
    }
  }
  return max
}

interface Props { open: boolean; onClose: () => void; rows: FlatRow[]; onSubmitted: () => void }

export default function AddPanel({ open, onClose, rows, onSubmitted }: Props) {
  const { auth, signIn } = useStore()
  const [meta, setMeta] = useState<LetterheadMeta>({ projects: [], defaults: {} })
  const [project, setProject] = useState('')
  const [code, setCode] = useState('')
  const [date, setDate] = useState('')
  const [subject, setSubject] = useState('')
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [body, setBody] = useState('')
  const [typist, setTypist] = useState('')
  const [fileName, setFileName] = useState('')
  const [ok, setOk] = useState('')
  const [err, setErr] = useState<{ kind: 'e' | 'i'; html: string } | null>(null)
  const [busy, setBusy] = useState(false)

  // Nested overlays
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { void api.getLetterheadMeta().then(setMeta) }, [])

  // openPanel(): pre-fill Document Date with today (YYYY-MM-DD) each time the
  // panel opens, matching the GAS app.
  useEffect(() => { if (open) setDate(new Date().toISOString().slice(0, 10)) }, [open])

  const isLetterhead = meta.projects.includes(project)

  // updateTemplateUI: default เรียน by code, fall back to project default.
  useEffect(() => {
    if (isLetterhead) setTo(TO_BY_CODE[code] || meta.defaults[project] || '')
  }, [project, code, isLetterhead, meta])
  useEffect(() => {
    if (isLetterhead && !typist && auth) setTypist(auth.email)
  }, [isLetterhead, auth, typist])

  const running = useMemo(() => {
    if (!project || !code) return null
    if (!rows.length) return { loading: true, next: '', latest: '' }
    const max = nextRunning(rows, project, code)
    return max < 0
      ? { loading: false, next: '001', latest: '' }
      : { loading: false, next: pad3(max + 1), latest: pad3(max) }
  }, [project, code, rows])

  const reset = () => {
    setProject(''); setCode(''); setDate(''); setSubject(''); setTo(''); setCc('')
    setBody(''); setTypist(''); setFileName(''); setErr(null)
  }

  const needSignIn = (m: string) =>
    setErr({ kind: 'i', html: `🔐 ${m} <button class="btp" data-signin="1" style="margin-left:6px;padding:5px 12px;font-size:12px">Sign in with Google</button>` })

  const submit = async () => {
    setErr(null); setOk('')
    if (!auth) { needSignIn('Please sign in with Google to continue.'); return }
    if (!project || !code || !subject.trim()) { setErr({ kind: 'e', html: 'Project, Code and Subject are required.' }); return }
    if (isLetterhead && !body.trim()) { setErr({ kind: 'e', html: 'Type the letter body (it becomes the A4 letter).' }); return }
    setBusy(true)
    const docDate = date ? date.split('-').reverse().join('/') : ''
    const res = await api.submitDocument({
      authToken: auth.token, project, code, subject: subject.trim(), docDate,
      to, cc, typist, body, filename: fileName, fileBase64: '', mimeType: '',
    })
    if (!res.success) {
      setBusy(false)
      if (res.error === 'Session expired') needSignIn('Your session expired — please sign in again.')
      else setErr({ kind: 'e', html: res.error ?? 'Could not submit.' })
      return
    }
    // Defer the slow Doc/PDF creation, exactly like finalizeLetter.
    if (res.pending && res.token) {
      await api.finalizeLetter({
        authToken: auth.token, project, code, ref: res.ref ?? '', subject, to, cc, typist, body, docDate, token: res.token,
      })
    }
    setBusy(false)
    setOk(`✓ Document submitted${res.ref ? ` — ref ${res.ref}` : ''}. It now appears at the top as “Pending”.`)
    onSubmitted()
    reset()
    setTimeout(() => { setOk(''); onClose() }, 1500)
  }

  const openPreview = async () => {
    setErr(null)
    if (!isLetterhead) { setErr({ kind: 'e', html: 'Select a project that has a letter template.' }); return }
    if (!code) { setErr({ kind: 'e', html: 'Select a code first (it sets the ref number).' }); return }
    if (!body.trim()) { setErr({ kind: 'e', html: 'Type the letter body to preview it.' }); return }
    const docDate = date ? date.split('-').reverse().join('/') : ''
    const res = await api.previewLetter({ project, code, subject, to, cc, typist, body, docDate })
    if (!res.ok || !res.html) { setErr({ kind: 'e', html: res.error ?? 'Could not build preview.' }); return }
    setPreviewTitle('Preview — ' + (res.ref ?? ''))
    setPreviewHtml(res.html)
  }

  const onPanelClick = (e: React.MouseEvent) => {
    const tgt = e.target as HTMLElement
    if (tgt.dataset.signin) signIn()
  }

  return (
    <>
      <div className={'overlay' + (open ? ' show' : '')} onClick={onClose}></div>
      <div className={'panel' + (open ? ' show' : '')} onClick={onPanelClick}>
        <div className="ph">
          <h2>📎 Add Document Manually</h2>
          <button onClick={onClose} title="Close">✕</button>
        </div>
        <div className="pbody">
          {err && <div className={'al al-' + err.kind} style={{ display: 'block' }} dangerouslySetInnerHTML={{ __html: err.html }} />}
          {ok && <div className="al al-s" style={{ display: 'block' }}>{ok}</div>}

          {!auth ? (
            <div className="fr">
              <label>Sign in to submit</label>
              <button className="btp" onClick={() => signIn()} style={{ width: '100%', marginTop: 2 }}>🔐 Sign in with Google</button>
              <div className="hint">Your verified Google account will be recorded with the submission</div>
            </div>
          ) : (
            <div className="fr">
              <label>Submitting as</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="text" readOnly value={auth.email}
                  style={{ background: '#f0f7ec', color: '#1a6e2e', fontWeight: 600, borderColor: '#b7dfb8', flex: 1, cursor: 'default' }} />
              </div>
              <div className="hint">Verified via Google OAuth — cannot be changed without re-signing in</div>
            </div>
          )}

          <div className="fr2">
            <div className="fr" style={{ margin: 0 }}>
              <label>Project *</label>
              <select value={project} onChange={(e) => setProject(e.target.value)}>
                <option value="">— Select —</option>
                {PROJECTS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="fr" style={{ margin: 0 }}>
              <label>Code *</label>
              <select value={code} onChange={(e) => setCode(e.target.value)}>
                <option value="">— Select —</option>
                {CODES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {running && (
            running.loading ? (
              <div style={{ display: 'block', marginBottom: 14, padding: '10px 12px', borderRadius: 6, fontSize: 12, lineHeight: 1.5, background: '#fff4e5', border: '1px solid #ffd9a8', color: '#8a5a00' }}>
                ⚠️ Documents still loading — reopen in a moment, or assign the number manually.
              </div>
            ) : (
              <div style={{ display: 'block', marginBottom: 14, padding: '10px 12px', borderRadius: 6, fontSize: 12, lineHeight: 1.5, background: '#e6f4ea', border: '1px solid #bfe3c9', color: '#137333' }}>
                Next running number for <b>{project} / {code}</b>:{' '}
                <span style={{ fontSize: 15, fontWeight: 700 }}>{running.next}</span>&nbsp;
                <span style={{ opacity: .7 }}>{running.latest ? `(latest on file: ${running.latest})` : '(no earlier documents on file — this starts the series)'}</span>
              </div>
            )
          )}

          <div className="fr">
            <label>Document Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="fr">
            <label>Subject *</label>
            <input type="text" placeholder="e.g. ขออนุมัติ..." value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          {project && !isLetterhead && (
            <div style={{ display: 'block', marginBottom: 14, padding: '10px 12px', borderRadius: 6, fontSize: 12, lineHeight: 1.5, background: '#fff4e5', border: '1px solid #ffd9a8', color: '#8a5a00' }}>
              No letterhead template for <b>{project}</b> yet — please attach a file for this project.
            </div>
          )}

          {isLetterhead && (
            <>
              <div className="fr2" style={{ display: 'grid' }}>
                <div className="fr" style={{ margin: 0 }}>
                  <label>เรียน (Addressed to)</label>
                  <input type="text" placeholder="e.g. ผู้จัดการฝ่ายวิศวกรรม" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
                <div className="fr" style={{ margin: 0 }}>
                  <label>สำเนาเรียน / CC (optional)</label>
                  <input type="text" placeholder="e.g. ฝ่ายบัญชี, ฝ่ายบุคคล" value={cc} onChange={(e) => setCc(e.target.value)} />
                </div>
              </div>
              <div className="fr">
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Document body *</span>
                  <button type="button" onClick={() => setEditorOpen(true)}
                    style={{ padding: '3px 9px', background: '#fff', border: '1.5px solid #1a73e8', color: '#1a73e8', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>⤢ Write on the A4</button>
                </label>
                <textarea rows={7} placeholder="พิมพ์เนื้อความของเอกสารที่นี่… (ระบบจะสร้างหัวจดหมาย วันที่ เลขที่ และลายเซ็นให้อัตโนมัติ)"
                  value={body} onChange={(e) => setBody(e.target.value)} />
                <div className="hint">Only the body — the letterhead, date, ref number and signature are filled in automatically.</div>
              </div>
              <div className="fr">
                <label>ผู้พิมพ์ (Typed by)</label>
                <input type="text" placeholder="e.g. อรสา" value={typist} onChange={(e) => setTypist(e.target.value)} />
                <div className="hint">Shown at the bottom as “…/พิมพ์”. Defaults to your email — change it to the typist’s name.</div>
              </div>
            </>
          )}

          <div className="fr">
            <label>Attach supplementary file (optional)</label>
            <div className="hint" style={{ margin: '-2px 0 6px' }}>
              Extra supporting material attached <b>in addition to</b> the letter — it does not replace it.
            </div>
            <label className="dz" style={{ display: 'block' }}>
              <div className="dz-i">📄</div>
              <div className="dz-t">Click or drag file here</div>
              <div className="dz-s">PDF, Word, Excel, Image · max 7 MB</div>
              <input
                type="file"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) { setFileName(''); return }
                  // Ported from the original's file-picker handler — dropped
                  // in the port, so any size was silently accepted despite
                  // the "max 7 MB" hint still shown right above.
                  if (f.size > 7 * 1024 * 1024) {
                    setErr({ kind: 'e', html: 'File too large — max 7 MB.' })
                    e.target.value = ''
                    setFileName('')
                    return
                  }
                  setFileName(f.name)
                }}
              />
            </label>
            {fileName && (
              <div className="fc" style={{ display: 'flex' }}>
                <span className="fc-n">{fileName}</span>
                <span className="fc-x" onClick={() => setFileName('')} title="Remove">✕</span>
              </div>
            )}
          </div>
        </div>
        <div className="pf">
          <button className="btc" onClick={onClose}>Cancel</button>
          {isLetterhead && <button className="btc" onClick={() => void openPreview()}>👁 Preview</button>}
          <button className="btp" onClick={() => void submit()} disabled={busy}>{busy ? 'Submitting…' : 'Submit Document'}</button>
        </div>
      </div>

      {/* A4 letter preview (#pvWrap) */}
      {previewHtml && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.55)' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 48, background: '#1a1a2e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{previewTitle}</span>
            <button className="btc" onClick={() => setPreviewHtml(null)}>✕ Close</button>
          </div>
          <iframe title="preview" srcDoc={previewHtml} style={{ position: 'absolute', top: 48, left: 0, right: 0, bottom: 0, width: '100%', height: 'calc(100% - 48px)', border: 0, background: '#525659' }} />
        </div>
      )}

      {/* Write-on-A4 body editor (#bxWrap) — simplified to a focused textarea
          over the A4 backdrop; Apply copies text back into the body field. */}
      {editorOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(0,0,0,.55)' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 48, background: '#1a1a2e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>✍️ Write directly on the A4 — only the dashed area is editable</span>
            <span>
              <button className="btc" style={{ marginRight: 8, borderColor: '#34a853', color: '#34a853' }}
                onClick={() => { setBody(editorRef.current?.value ?? body); setEditorOpen(false) }}>✓ Apply &amp; close</button>
              <button className="btc" onClick={() => setEditorOpen(false)}>✕ Cancel</button>
            </span>
          </div>
          <div style={{ position: 'absolute', top: 48, left: 0, right: 0, bottom: 0, background: '#525659', overflow: 'auto', padding: 24 }}>
            <div style={{ width: '210mm', maxWidth: '100%', minHeight: '297mm', margin: '0 auto', background: '#fff', padding: '24mm 18mm', boxSizing: 'border-box', boxShadow: '0 0 12px rgba(0,0,0,.5)' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px solid #1a3a6b', paddingBottom: 10, marginBottom: 18, color: '#1a3a6b', fontWeight: 700 }}>{project || 'โครงการ'}</div>
              <textarea ref={editorRef} defaultValue={body}
                style={{ width: '100%', minHeight: '160mm', border: '1.5px dashed #1a73e8', borderRadius: 6, padding: 12, fontSize: 15, lineHeight: 2, fontFamily: 'inherit', resize: 'vertical' }} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
