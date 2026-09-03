import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, type DocumentsByProject, type DocRow, type Status } from './api'
import { PROJ_NAMES, projBadgeClass, CODE_LABEL, fmtCode, formatDateByEra, type Strings } from './i18n'
import { useStore } from './store'
import SettingsModal from './components/SettingsModal'
import AddPanel from './components/AddPanel'
import ReviewModal from './components/ReviewModal'

export interface FlatRow extends DocRow { proj: string; iso: string; ts: number }

// Mobile-only short date label (d/m/yy, Buddhist-era 2-digit year) drawn
// over the native <input type=date>, which renders its own long
// locale-formatted text on iOS ("3 Jul BE 2569") that CSS can't restyle.
function shortDate(iso: string): string {
  if (!iso) return ''
  const p = iso.split('-')
  const y2 = String((Number(p[0]) + 543) % 100).padStart(2, '0')
  return `${Number(p[2])}/${Number(p[1])}/${y2}`
}

function parseRow(r: DocRow, proj: string): FlatRow {
  let iso = '', ts = 0
  const m = String(r.date || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) { iso = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`; ts = new Date(iso).getTime() }
  return { ...r, proj, iso, ts }
}

type SortKey = 'num' | 'iso' | 'proj' | 'code' | 'subject'
const SORT_KEYS: SortKey[] = ['num', 'iso', 'proj', 'code', 'subject']

export default function App() {
  const { t, lang, era, auth, signIn, dark } = useStore()

  // Where the portal is, and carry appearance and language to it so returning
  // does not flip either. Same rule as every other module: the deployment says
  // where the portal lives, defaulting to the root because on one domain the
  // portal IS the root.
  const portalHref = (() => {
    const base = (import.meta as any).env?.VITE_PORTAL_URL || '/'
    try {
      const u = new URL(base, window.location.origin)
      u.searchParams.set('theme', dark ? 'dark' : 'light')
      u.searchParams.set('lang', lang)
      return u.origin === window.location.origin ? u.pathname + u.search : u.toString()
    } catch { return base }
  })()

  const [raw, setRaw] = useState<DocumentsByProject>({})
  const [loading, setLoading] = useState(true)

  const [q, setQ] = useState('')
  const [dtf, setDtf] = useState('ALL')
  const [stf, setStf] = useState<'ALL' | Status>('ALL')
  const [af, setAf] = useState('ALL')
  const [pfmsOpen, setPfmsOpen] = useState(false)
  const [d1, setD1] = useState('')
  const [d2, setD2] = useState('')
  const [sortCol, setSortCol] = useState(-1)
  const [sortDir, setSortDir] = useState<1 | -1>(1)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [reviewDoc, setReviewDoc] = useState<FlatRow | null>(null)

  const reload = useCallback(async () => {
    const data = await api.getDocuments(auth?.token ?? '')
    setRaw(data)
    setLoading(false)
  }, [auth?.token])

  useEffect(() => { void reload() }, [reload])

  // Flatten + default sort: commented float to top, then newest-first.
  const allRows = useMemo<FlatRow[]>(() => {
    const out: FlatRow[] = []
    for (const [proj, rows] of Object.entries(raw)) rows.forEach((r) => out.push(parseRow(r, proj)))
    const rk = (r: FlatRow) => (r.status === 'commented' ? 0 : 1)
    out.sort((a, b) => rk(a) - rk(b) || b.ts - a.ts)
    out.forEach((r, i) => (r.num = i + 1))
    return out
  }, [raw])

  const sortedRows = useMemo<FlatRow[]>(() => {
    if (sortCol < 0) return allRows
    const key = SORT_KEYS[sortCol]!
    return allRows.slice().sort((a, b) => {
      let va: string | number = a[key] ?? '', vb: string | number = b[key] ?? ''
      if (key === 'code') { va = fmtCode(a.code); vb = fmtCode(b.code) }
      if (va < vb) return -1 * sortDir
      if (va > vb) return 1 * sortDir
      return 0
    })
  }, [allRows, sortCol, sortDir])

  const codes = useMemo(() => {
    const set = new Set(allRows.map((r) => fmtCode(r.code)).filter(Boolean))
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [allRows])

  const projList = useMemo(
    () => ['ALL', ...Object.keys(raw).filter((p) => (raw[p]?.length ?? 0) > 0)],
    [raw],
  )

  const visible = useMemo(() => {
    const query = q.toLowerCase().trim()
    const rows = sortedRows.filter((r) => {
      const projOk = af === 'ALL' || r.proj === af
      const dtOk = dtf === 'ALL' || fmtCode(r.code) === dtf
      const stOk = stf === 'ALL' || (r.status || 'pending') === stf
      const srch = [r.code, fmtCode(r.code), r.subject, r.desc, r.proj].join(' ').toLowerCase()
      const srchOk = !query || srch.includes(query)
      const d1Ok = !d1 || r.iso >= d1
      const d2Ok = !d2 || r.iso <= d2
      return projOk && dtOk && stOk && srchOk && d1Ok && d2Ok
    })
    return rows.map((r, i) => ({ row: r, dispNum: i + 1 }))
  }, [sortedRows, af, dtf, stf, q, d1, d2])

  const linked = allRows.filter((r) => r.url).length

  // Reset every filter back to the page's default state: search box, the
  // document-type / status / project pickers, both dates, and any active
  // column sort.
  const clearFilters = useCallback(() => {
    setQ('')
    setDtf('ALL')
    setStf('ALL')
    setAf('ALL')
    setPfmsOpen(false)
    setD1('')
    setD2('')
    setSortCol(-1)
    setSortDir(1)
  }, [])

  // Project picker popover: click outside closes it.
  const pfmsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!pfmsOpen) return
    const onClick = (e: MouseEvent) => {
      if (pfmsRef.current && !pfmsRef.current.contains(e.target as Node)) setPfmsOpen(false)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [pfmsOpen])

  const onSort = useCallback((col: number) => {
    setSortCol((prev) => {
      if (prev === col) { setSortDir((d) => (d === 1 ? -1 : 1)); return col }
      setSortDir(1); return col
    })
  }, [])

  const setQuick = (days: number | 'lm') => {
    const today = new Date()
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    if (days === 'lm') {
      setD1(iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)))
      setD2(iso(new Date(today.getFullYear(), today.getMonth(), 0)))
    } else {
      const from = new Date(today); from.setDate(from.getDate() - days)
      setD1(iso(from)); setD2(iso(today))
    }
  }

  const colClass = (c: number) => (sortCol === c ? (sortDir === 1 ? 'asc' : 'desc') : '')
  const cols: Array<[number, keyof Strings]> = [
    [0, 'col_num'], [1, 'col_date'], [2, 'col_project'], [3, 'col_code'], [4, 'col_document'],
  ]

  return (
    <>
      <header>
        <div className="brandwrap">
          <div className="brand-txt">
            {/* The brand is the way back to the portal, as in every other
                module, and it carries the current theme and language so the
                portal does not flip appearance on arrival. It was href="#"
                with preventDefault, so it went nowhere at all. */}
            <a className="brand-home" href={portalHref} title={lang === 'th' ? 'กลับสู่ VCB Connect' : 'Back to VCB Connect'}>
              <h1>VCB Group</h1>
            </a>
            <span className="brand-div"></span>
            <div className="brand-stack">
              <span className="brand-sub">Document Control · e-Memo</span>
              {/* One line, in the reader's language, and the company name in
                  the form the rest of VCB Connect uses. This showed the English
                  and Thai lines stacked together regardless of language. */}
              <span className="brand-th">
                {lang === 'th'
                  ? 'วิจิตรภัณฑ์ก่อสร้าง จำกัด · ติดตามสถานะเอกสารภายใน'
                  : 'Vichitbhan Construction co.,Ltd. · Internal document control'}
              </span>
            </div>
          </div>
        </div>
        <div className="hdr-right">
          <span id="hdr" dangerouslySetInnerHTML={{ __html: `${allRows.length} documents &nbsp;·&nbsp; ${linked} linked` }} />
          <button className="add-btn" onClick={() => setPanelOpen(true)}
            dangerouslySetInnerHTML={{ __html: t('add_doc').replace(/ /g, '&nbsp;') }} />
          <div className="st-wrap">
            {/* The same drawn gear the other modules use, not the "⚙"
                text glyph. A font character and an SVG never match: the glyph
                rendered at a different weight and shape, and its 13px side
                padding made the chip 43px wide against everyone else's 40px
                square. */}
            <button id="stTog" className="dm-btn" onClick={() => setSettingsOpen(true)} title="Settings" aria-label="Settings">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                   strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
          <span className="user-as" onClick={() => (auth ? setSettingsOpen(true) : signIn())} title="Sign in">
            <span className="email">{auth ? auth.email : 'Sign in'}</span>
            {auth && <span className="sep"> · </span>}
            {auth && <span className="role">{auth.manager ? 'manager' : 'staff'}</span>}
          </span>
        </div>
      </header>

      <div className="bar">
        <input id="srch" type="text" placeholder={t('search_placeholder')} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="divider"></div>
        <select className={'dtsel' + (dtf !== 'ALL' ? ' on' : '')} value={dtf} onChange={(e) => setDtf(e.target.value)} title="Filter by document type / code">
          <option value="ALL">{t('all_doc_types')}</option>
          {codes.map((c) => <option key={c} value={c}>{c + (CODE_LABEL[c] ? ' — ' + CODE_LABEL[c] : '')}</option>)}
        </select>
        <div className="divider"></div>
        <select className={'dtsel stsel' + (stf !== 'ALL' ? ' on' : '')} value={stf} onChange={(e) => setStf(e.target.value as 'ALL' | Status)} title="Filter by status">
          <option value="ALL">{t('all_statuses')}</option>
          <option value="pending">{t('flt_pending')}</option>
          <option value="commented">{t('flt_commented')}</option>
          <option value="approved">{t('flt_approved')}</option>
          <option value="rejected">{t('flt_rejected')}</option>
        </select>
        <div className="divider"></div>
        {/* Still SINGLE-select (one click to switch, no deselect step) — a
            custom button+popover rather than a native <select>, so each row
            can show the project's badge chip beside its full name. */}
        <div className="pfms" ref={pfmsRef}>
          <button
            type="button"
            className={'dtsel pfmsBtn' + (af !== 'ALL' ? ' on' : '')}
            onClick={(e) => { e.stopPropagation(); setPfmsOpen((o) => !o) }}
            title="Filter by project"
          >
            <span>{af === 'ALL' ? t('all_projects') : (PROJ_NAMES[af] || af)}</span>
            <span className="pfmsCaret">▾</span>
          </button>
          {pfmsOpen && (
            <div className="pfmsPanel">
              {projList.map((p, i) => (
                <div key={p}>
                  {i === 1 && <div className="pfmsDiv"></div>}
                  <div
                    className={'pfmsRow' + (p === af ? ' sel' : '')}
                    onClick={() => { setAf(p); setPfmsOpen(false) }}
                  >
                    <span>{p === 'ALL' ? t('all_projects') : (PROJ_NAMES[p] || p)}</span>
                    {p !== 'ALL' && <span className={'pb ' + projBadgeClass(p)}>{p}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="datebar">
        <span className="dwrap1">
          <input type="date" className="dfld" value={d1} onChange={(e) => setD1(e.target.value)} />
          <span className={'dlbl' + (d1 ? '' : ' dph')}>{d1 ? shortDate(d1) : t('date_short')}</span>
        </span>
        <span style={{ color: '#aaa', fontSize: 12 }}>→</span>
        <span className="dwrap1">
          <input type="date" className="dfld" value={d2} onChange={(e) => setD2(e.target.value)} />
          <span className={'dlbl' + (d2 ? '' : ' dph')}>{d2 ? shortDate(d2) : t('date_short')}</span>
        </span>
        <div className="divider"></div>
        <button className="qbtn" onClick={() => setQuick(7)}>{t('last_7')}</button>
        <button className="qbtn" onClick={() => setQuick(30)}>{t('last_30')}</button>
        <button className="qbtn" onClick={() => setQuick('lm')}>{t('last_month')}</button>
        <button className="clrbtn" onClick={clearFilters}>{t('clear_filters')}</button>
      </div>

      <div className="stat" id="stat">
        {t('showing').replace('{n}', String(visible.length)).replace('{m}', String(allRows.length))}
        {af !== 'ALL' ? `   ·   ${PROJ_NAMES[af] || af}` : ''}
      </div>

      {loading && (
        <div className="loadbox" style={{ display: 'flex' }}>
          <span className="spinner"></span>
          <span>กำลังโหลดเอกสาร · Loading documents…</span>
        </div>
      )}

      {!loading && (
        <div className="tw" id="tw">
          <table id="tbl" style={{ display: visible.length ? '' : 'none' }}>
            <thead>
              <tr>
                {cols.map(([i, k]) => (
                  <th key={i} onClick={() => onSort(i)} className={colClass(i)}>{t(k)}</th>
                ))}
                <th>{t('col_status')}</th>
                <th>{t('col_open')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ row: r, dispNum }) => {
                const stat = r.status || 'pending'
                const pjCls = projBadgeClass(r.proj)
                return (
                  <tr key={r.id}>
                    <td className="n">{dispNum}</td>
                    <td className="dt">{formatDateByEra(r.date, era)}</td>
                    <td className="pj"><span className={'pb ' + pjCls}>{r.proj}</span></td>
                    <td className="cd">{fmtCode(r.code) || <span className="nl">—</span>}</td>
                    <td className="sb">
                      <div className="ti">{r.subject}</div>
                      {r.desc && <div className="de">{r.desc}</div>}
                    </td>
                    <td className="stc"><span className={'stb st-' + stat}>{t(('status_' + stat) as keyof Strings)}</span></td>
                    <td className="rvc"><button className="rvbtn" onClick={() => setReviewDoc(r)}>{t('open_btn')}</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {visible.length === 0 && <div className="empty" id="em">{t('empty')}</div>}
        </div>
      )}

      <button className="fab" onClick={() => setPanelOpen(true)} title="Add Document" aria-label="Add Document">＋</button>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AddPanel open={panelOpen} onClose={() => setPanelOpen(false)} rows={allRows} onSubmitted={() => void reload()} />
      {reviewDoc && (
        <ReviewModal
          doc={reviewDoc}
          onClose={() => setReviewDoc(null)}
          onChanged={() => void reload()}
        />
      )}
    </>
  )
}
