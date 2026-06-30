import React, { useState, useMemo, useEffect } from 'react'
import type { YMonth, SiteMonth, Entries, CellValue, CellNames } from './types'
import { siteMonth, siteAccent, BOOT, ACTIVITIES, CATEGORIES } from './mock'
import { useSettings } from './settings'
import { TODAY, MonthNav } from './App'
import Picker from './Picker'

function isoMinus(iso: string, n: number): string { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
function isoPlus(iso: string, n: number): string { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

const ACT_BY_CODE = Object.fromEntries(ACTIVITIES.map((a) => [a.code, a.name]))
const CAT_BY_CODE = Object.fromEntries(CATEGORIES.map((c) => [c.code, c.name]))

function cellTitle(v: string): string {
  if (!v) return ''
  const [a, c] = v.split(' / ')
  const an = ACT_BY_CODE[a?.trim()] || ''
  const cn = c ? (CAT_BY_CODE[c.trim()] || '') : ''
  return (a + (an ? ' · ' + an : '')) + (c ? '   →   ' + c + (cn ? ' · ' + cn : '') : '')
}
// Display per the "การแสดงในตารางสัปดาห์" setting: the code (default) or the name.
function cellDisplay(v: string, mode: CellNames): string {
  if (!v) return ''
  if (mode === 'code') return v
  const a = v.split(' / ')[0]?.trim()
  return ACT_BY_CODE[a] || v
}
function ccodes(am: string, pm: string): string[] {
  const a = String(am || '').trim().split(' / ').join('/')
  const p = String(pm || '').trim().split(' / ').join('/')
  if (a && p && a !== p) return [a, p]
  return [a || p]
}

type Focus = { eid: string; date: string } | null
type PickerState = { eid: string; date: string; field: keyof CellValue; anchor: HTMLElement } | null

function Coverage({ d, today, lockDays, jump }:
  { d: SiteMonth; today: string; lockDays: number; jump: (eid: string, date: string) => void }) {
  const { t, dow } = useSettings()
  const cutoff = isoMinus(today, lockDays), ahead = isoPlus(today, 1)
  const perDay: Record<string, { f: number; t: number }> = {}
  d.days.forEach((day) => { perDay[day.date] = { f: 0, t: 0 } })
  d.employees.forEach((e) => {
    const aw = new Set(e.away)
    d.days.forEach((day) => {
      if (aw.has(day.date)) return
      perDay[day.date].t++
      const v = (d.entries[e.eid] || {})[day.date] || {}
      if (v.team || v.detail || v.pm) perDay[day.date].f++
    })
  })

  return (
    <div id="eGrid">
      <div className="cov-days">
        <div className="cov-days-row">
          {d.days.map((day) => {
            const s = perDay[day.date], pct = s.t ? Math.round((s.f / s.t) * 100) : 0
            const isToday = day.date === today, isWk = day.weekend
            const isFut = day.date > ahead, isEdit = day.date >= cutoff && day.date <= ahead
            let bg: string, fg = '#fff', ptxt = pct + '%'
            if (isToday) bg = '#1d4e89'
            else if (isWk) { bg = '#fdf0d4'; fg = '#6b5232'; ptxt = t('พัก') }
            else if (isFut) { bg = '#eef2f8'; fg = '#9aa5b4'; ptxt = '—' }
            else if (isEdit) { bg = '#e8b500'; fg = '#5a4500' }
            else if (pct >= 100) bg = '#1f9d55'
            else bg = '#e0533a'
            return (
              <div key={day.date} className="cov-day" style={{ background: bg, color: fg }}>
                <div className="d">{Number(day.date.slice(8, 10))}</div>
                <div className="x">{dow(day.dow)}</div>
                <div className="p">{ptxt}</div>
              </div>
            )
          })}
        </div>
        <div className="hint" style={{ marginTop: '.35rem' }}>
          {t('เหลือง = ยังแก้ไขได้ (ย้อนหลัง')} {lockDays} {t('วัน ถึงพรุ่งนี้) · เขียว = บันทึกครบ 100% (ล็อกแล้ว) · แดง = ขาด/ไม่ครบ · เทา = ยังไม่ถึงกำหนด · พัก = วันหยุด')}
        </div>
      </div>

      <div className="gridwrap">
        <table className="mgrid covgrid">
          <thead>
            <tr>
              <th className="emp-col">{t('พนักงาน')} <span className="hint" style={{ fontWeight: 500 }}>({d.employees.length})</span></th>
              {d.days.map((day) => (
                <th key={day.date} className={'cov-th ' + (day.weekend ? 'weekend' : '') + (day.date === today ? ' today' : '')}>
                  {Number(day.date.slice(8, 10))}<span className="dow">{dow(day.dow)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.employees.map((e) => {
              const op = e.kind === 'operation', by = d.entries[e.eid] || {}
              const awaySet = new Set(e.away)
              return (
                <tr key={e.eid}>
                  <td className="emp-col">
                    <span className={'kpill ' + (op ? 'op' : 'sup')}>{op ? 'OP' : 'SUP'}</span>
                    {e.name}
                    <div className="sub">{e.emp_id}{e.department ? ' · ' + e.department : ''}</div>
                  </td>
                  {d.days.map((day) => {
                    if (awaySet.has(day.date))
                      return <td key={day.date} className="cov-cell" style={{ cursor: 'default' }}><div className="ccell" style={{ background: '#e7ebf1' }}>—</div></td>
                    const v = by[day.date] || {}
                    const amv = v.team || v.detail || '', pmv = v.pm || ''
                    const has = !!(amv || pmv)
                    const future = day.date > ahead, locked = day.date < cutoff
                    const editable = !future && !locked
                    let status: string, bg: string, inner: string[] | string | null = null
                    if (future) { status = 'future'; bg = '#eef2f8' }
                    else if (day.weekend) { status = 'weekend'; bg = '#fdf0d4'; inner = t('พัก') }
                    else if (editable) { status = 'editable'; bg = '#e8b500'; inner = has ? ccodes(amv, pmv) : null }
                    else if (has) { status = 'ok'; bg = '#1f9d55'; inner = ccodes(amv, pmv) }
                    else { status = 'miss'; bg = '#e0533a' }
                    const codesCls = (status === 'ok' || (status === 'editable' && has)) ? ' codes' : ''
                    const tip = day.date + (has ? ' · ' + cellTitle(amv) : '')
                    const clickable = has || editable
                    return (
                      <td key={day.date} className="cov-cell" title={tip}
                        style={{ cursor: clickable ? 'pointer' : 'default' }}
                        onClick={() => { if (clickable) jump(e.eid, day.date) }}>
                        <div className={'ccell' + (day.date === today ? ' today' : '') + codesCls} style={{ background: bg }}>
                          {Array.isArray(inner) ? inner.map((c, i) => <span key={i} className="cc">{c}</span>) : inner}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: '.7rem' }}>
        <span className="hint">{t('คลิกเซลล์เพื่อกระโดดไปแก้พนักงาน/วันนั้นในมุมมองสัปดาห์ · 🔦 เลือกรหัสด้านบนเพื่อเน้นทุกเซลล์ของงานนั้น')}</span>
      </div>
    </div>
  )
}

function Weekly({ d, today, lockDays, weekStart, focus, openPicker }:
  { d: SiteMonth; today: string; lockDays: number; weekStart: number; focus: Focus; openPicker: (eid: string, date: string, field: keyof CellValue, anchor: HTMLElement) => void }) {
  const { t, dow, cellNames } = useSettings()
  const cutoff = isoMinus(today, lockDays), ahead = isoPlus(today, 1)
  const start = Math.min(Math.max(0, weekStart), Math.max(0, d.days.length - 1))
  const count = Math.min(7, d.days.length - start)
  const visible = d.days.slice(start, start + count)

  function Slot({ val, field, isSecond, weekend, locked, onOpen }:
    { val: string; field: keyof CellValue; isSecond: boolean; weekend: boolean; locked: boolean; onOpen: (field: keyof CellValue, anchor: HTMLElement) => void }) {
    const ph = isSecond ? t('+ งานที่ 2') : (weekend ? t('วันหยุด') : '')
    return (
      <div className={'shift ' + (isSecond ? 'second' : 'primary')}>
        <div className={'cval' + (val ? '' : ' empty') + (!isSecond && !val && !weekend ? ' pe' : '')}
          tabIndex={locked ? undefined : 0}
          title={val ? cellTitle(val) : undefined}
          data-ph={!val && ph ? ph : undefined}
          onClick={locked ? undefined : (ev) => onOpen(field, ev.currentTarget)}>
          {cellDisplay(val, cellNames)}
        </div>
      </div>
    )
  }

  return (
    <div id="eGrid">
      <div className="gridwrap">
        <table className="mgrid">
          <thead>
            <tr>
              <th className="emp-col">{t('พนักงาน')} <span className="hint" style={{ fontWeight: 500 }}>({d.employees.length})</span></th>
              {visible.map((day) => (
                <th key={day.date} className={(day.weekend ? 'weekend' : '') + (day.date === today ? ' today' : '')}>
                  {Number(day.date.slice(8, 10))}<span className="dow">{dow(day.dow)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.employees.map((e) => {
              const op = e.kind === 'operation'
              const primaryField: keyof CellValue = op ? 'team' : 'detail'
              const awaySet = new Set(e.away)
              return (
                <tr key={e.eid} className={focus && focus.eid === e.eid ? 'rowfocus' : ''}>
                  <td className="emp-col">
                    <span className={'kpill ' + (op ? 'op' : 'sup')}>{op ? 'OP' : 'SUP'}</span>
                    <span className="emp-acts"><button className="emp-act mig" title={t('ย้ายหน่วยงาน')}>⇄</button></span>
                    {e.name}
                    <div className="sub">{e.emp_id}{e.department ? ' · ' + e.department : ''}{e.position ? ' · ' + e.position : ''}</div>
                    {e.movedIn && <div className="migsub">→ {e.movedInFrom}</div>}
                  </td>
                  {visible.map((day) => {
                    if (awaySet.has(day.date))
                      return <td key={day.date} className="cell away" />
                    const v = (d.entries[e.eid] || {})[day.date] || {}
                    const amVal = op ? (v.team || '') : (v.detail || '')
                    const locked = day.date < cutoff || day.date > ahead
                    const cls = 'cell ' + (day.weekend ? 'weekend ' : '') + (day.date === today ? 'today ' : '') + (locked ? 'locked ' : '') + (day.date > ahead ? 'future ' : '')
                    const isFocus = !!focus && focus.eid === e.eid && focus.date === day.date
                    const onOpen = (field: keyof CellValue, anchor: HTMLElement) => openPicker(e.eid, day.date, field, anchor)
                    return (
                      <td key={day.date} className={cls.trim() + (isFocus ? ' cellfocus' : '')}>
                        <Slot val={amVal} field={primaryField} isSecond={false} weekend={day.weekend} locked={locked} onOpen={onOpen} />
                        <Slot val={v.pm || ''} field="pm" isSecond={true} weekend={day.weekend} locked={locked} onOpen={onOpen} />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: '.6rem', marginTop: '.7rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn sec">{t('+ เพิ่มพนักงาน')}</button>
        <span className="hint">{t('คลิกที่ช่องเพื่อเลือกกิจกรรม → หมวดงาน')} · {t('เซลล์ที่เกิน')} {lockDays} {t('วันจะล็อกอัตโนมัติ')} · 1 {t('วันทำงาน')}</span>
      </div>
    </div>
  )
}

export default function Entry({ cur, setCur, site, setSite, mode, setMode }:
  { cur: YMonth; setCur: (c: YMonth) => void; site: string | null; setSite: (s: string | null) => void; mode: 'coverage' | 'week'; setMode: (m: 'coverage' | 'week') => void }) {
  const { t, mname, be } = useSettings()
  const [weekStart, setWeekStart] = useState(0)
  const [focus, setFocus] = useState<Focus>(null)
  const [entries, setEntries] = useState<Entries>({})
  const [picker, setPicker] = useState<PickerState>(null)
  const [flash, setFlash] = useState('')
  const flashTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sites = BOOT.sites

  const base = useMemo<SiteMonth | null>(() => (site ? siteMonth(site, cur.y, cur.m, TODAY) : null), [site, cur])
  const acc = siteAccent(site)

  useEffect(() => {
    setEntries(base ? structuredClone(base.entries) : {})
    setWeekStart(0)
  }, [base])

  const d: SiteMonth | null = base ? { ...base, entries } : null

  function setCell(eid: string, date: string, field: keyof CellValue, value: string) {
    setEntries((prev) => {
      const next = { ...prev }
      const row = { ...(next[eid] || {}) }
      const cell: CellValue = { ...(row[date] || {}) }
      if (value) cell[field] = value; else delete cell[field]
      if (Object.keys(cell).length) row[date] = cell; else delete row[date]
      next[eid] = row
      return next
    })
    setFlash(value ? t('บันทึกแล้ว') + ' ✓' : t('ล้างเซลล์'))
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(''), 1400)
  }

  function jump(eid: string, date: string) {
    if (!d) return
    const idx = d.days.findIndex((x) => x.date === date)
    if (idx < 0) return
    setWeekStart(Math.floor(idx / 7) * 7)
    setFocus({ eid, date })
    setMode('week')
  }

  function openPicker(eid: string, date: string, field: keyof CellValue, anchor: HTMLElement) {
    setPicker({ eid, date, field, anchor })
  }

  return (
    <>
      <div className="card" style={{ padding: '.85rem 1.1rem' }}>
        <div className="statrow" style={{ alignItems: 'end', marginBottom: 0, gap: '.9rem' }}>
          <div className="fld" style={{ minWidth: 260, flex: '1 1 auto' }}>
            <label>{t('หน่วยงาน')}</label>
            <select value={site || ''} onChange={(e) => setSite(e.target.value || null)}>
              <option value="">— {t('เลือกหน่วยงาน')} —</option>
              {sites.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          </div>
          <div className="fld" style={{ maxWidth: 230 }}>
            <label>{t('เดือน')}</label>
            <MonthNav cur={cur} setCur={setCur} />
          </div>
          <div className="fld">
            <label>{t('มุมมอง')}</label>
            <div className="seg">
              <button className={mode === 'coverage' ? 'on' : ''} onClick={() => setMode('coverage')}>{t('ภาพรวม')}</button>
              <button className={mode === 'week' ? 'on' : ''} onClick={() => setMode('week')}>{t('รายอาทิตย์')}</button>
            </div>
          </div>
          {site && (
            <div className="fld">
              <label>&nbsp;</label>
              <button className="btn xls-btn" style={{ background: acc.c }}>⬇ Excel</button>
            </div>
          )}
        </div>
      </div>

      {flash && <div className="flash ok" style={{ display: 'block' }}>{flash}</div>}

      {!site || !d ? (
        <div className="card"><p className="muted">{t('เลือกหน่วยงาน')}</p></div>
      ) : !d.employees.length ? (
        <div className="card"><p className="muted">{t('ยังไม่มีพนักงานในหน่วยงานนี้')}</p></div>
      ) : (
        <div className="card" style={{ ['--site' as string]: acc.c } as React.CSSProperties}>
          {mode === 'week' && (
            <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '.6rem' }}>
              <button className="btn sec" disabled={weekStart <= 0} onClick={() => setWeekStart((s) => Math.max(0, s - 7))}>‹ {t('สัปดาห์ก่อน')}</button>
              <span className="hint">
                {(() => {
                  const s = Math.min(weekStart, d.days.length - 1)
                  const c = Math.min(7, d.days.length - s)
                  return `${Number(d.days[s].date.slice(8, 10))}–${Number(d.days[s + c - 1].date.slice(8, 10))} ${mname(cur.m)} ${be(cur.y)}`
                })()}
              </span>
              <button className="btn sec" disabled={weekStart + 7 >= d.days.length} onClick={() => setWeekStart((s) => s + 7)}>{t('สัปดาห์ถัดไป')} ›</button>
            </div>
          )}
          {mode === 'coverage'
            ? <Coverage d={d} today={d.today} lockDays={d.lockDays} jump={jump} />
            : <Weekly d={d} today={d.today} lockDays={d.lockDays} weekStart={weekStart} focus={focus} openPicker={openPicker} />}
        </div>
      )}

      {picker && (
        <Picker anchor={picker.anchor} activities={ACTIVITIES} categories={CATEGORIES}
          onApply={(value) => { setCell(picker.eid, picker.date, picker.field, value); setPicker(null) }}
          onClose={() => setPicker(null)} />
      )}
    </>
  )
}
