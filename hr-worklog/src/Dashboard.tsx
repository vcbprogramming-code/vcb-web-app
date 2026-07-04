import { useState, useMemo } from 'react'
import type { YMonth, SiteSummary, TopItem, DashView } from './types'
import { adminSummary, siteAccent } from './mock'
import { useSettings } from './settings'
import { TODAY, MonthNav } from './App'

function isoMinus(iso: string, n: number): string { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
function isoPlus(iso: string, n: number): string { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

function MiniCal({ row, today, lockDays, accColor }: { row: SiteSummary; today: string; lockDays: number; accColor: string }) {
  const cutoff = isoMinus(today, lockDays), ahead = isoPlus(today, 1)
  return (
    <div className="mini-cal">
      {row.daysFilled.map((day) => {
        const full = day.total > 0 && day.filled >= day.total
        let bg: string, fg = '#fff'
        if (day.date === today) bg = accColor
        else if (day.weekend) { bg = '#fdf6ec'; fg = '#b9a47e' }
        else if (day.date > ahead) { bg = '#eef2f8'; fg = '#6b7785' }
        else if (day.date >= cutoff) bg = '#e8b500'
        else bg = full ? '#1f9d55' : '#e0533a'
        return (
          <div key={day.date} className="mc" title={`${day.date} · ${day.filled}/${day.total}`} style={{ background: bg, color: fg }}>
            <div className="mcd">{Number(day.date.slice(8, 10))}</div>
          </div>
        )
      })}
    </div>
  )
}

function TopList({ arr }: { arr: TopItem[] }) {
  const { t } = useSettings()
  const [expanded, setExpanded] = useState(false)
  const LIMIT = 5
  if (!arr.length) return <div className="hint" style={{ textAlign: 'center', padding: '1.2rem .5rem' }}>{t('ยังไม่มีบันทึกในเดือนนี้')}</div>
  return (
    <>
      <div className={'top-acts' + (expanded ? ' expanded' : '')}>
        {arr.map((a, i) => (
          <div key={i} className={'ta-row' + (i >= LIMIT ? ' ta-extra' : '')} title={`${a.name} — ${a.count} ${t('วันทำงาน')} (${a.pct}%)`}>
            <div className="ta-name">{a.name}</div>
            <div className="ta-num"><b>{a.count}</b> {t('วันทำงาน')} <span className="ta-pct">{a.pct}%</span></div>
            <div className="ta-bar"><i style={{ ['--w' as string]: Math.max(2, Math.min(100, a.pct)) + '%', background: 'var(--site)' }} /></div>
          </div>
        ))}
      </div>
      {arr.length > LIMIT && (
        <button className="ta-expand" onClick={() => setExpanded((e) => !e)}>
          {expanded ? t('ย่อ') + ' ▴' : `${t('ดูทั้งหมด')} (${arr.length}) ▾`}
        </button>
      )}
    </>
  )
}

function Ring({ pct, color }: { pct: number; color: string }) {
  const off = (169.65 - pct * 1.6965).toFixed(2)
  return (
    <div className="s-ring">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="27" fill="none" stroke="#e6ecf3" strokeWidth="7" />
        <circle cx="32" cy="32" r="27" fill="none" stroke={color} strokeWidth="7"
          strokeDasharray="169.65" strokeDashoffset={off} transform="rotate(-90 32 32)" strokeLinecap="round" />
      </svg>
      <span className="s-ring-pct" style={{ color }}>{pct}%</span>
    </div>
  )
}

function SiteCard({ r, today, lockDays, dashView, monthName, openSite }:
  { r: SiteSummary; today: string; lockDays: number; dashView: DashView; monthName: string; openSite: (k: string, m: 'coverage') => void }) {
  const { t } = useSettings()
  const acc = siteAccent(r.site_key)
  const started = r.support_started + r.operation_started
  const isTop = dashView === 'topact' || dashView === 'topcost'
  const topArr = dashView === 'topcost' ? r.topCostCodes : r.topActivities
  return (
    <div className="card s-card" style={{ ['--site' as string]: acc.c, ['--site-tint' as string]: acc.tint }}>
      <div className="s-bar" />
      <div className="s-body">
        <div className="s-head">
          <div>
            <h2 style={{ margin: 0, color: 'var(--site)' }}>{r.site_name}</h2>
            <div className="hint">{r.company}</div>
          </div>
          {isTop ? (
            <div className="s-stats-mini"><b style={{ color: 'var(--site)' }}>{r.entries}</b><span> {t('รายการ')}</span></div>
          ) : (
            <div className="s-ringwrap">
              <Ring pct={r.fillRate} color={acc.c} />
              <div className="s-ring-lbl">{t('บันทึกครบ')}<br /><b>{r.entries} / {r.fillRateDenom}</b> {t('ช่อง')}</div>
            </div>
          )}
        </div>

        {isTop ? <TopList arr={topArr} /> : (
          <>
            <div className="s-stats">
              <div><b>{r.n_emp}</b><span>{t('พนักงาน')}</span><div className="hint">{r.n_support} {t('สนับสนุน')} · {r.n_operation} {t('ปฏิบัติการ')}</div></div>
              <div><b>{r.entries}</b><span>{t('รายการใน')} {monthName}</span></div>
              <div><b>{started} / {r.n_emp}</b><span>{t('เริ่มบันทึกแล้ว')}</span><div className="hint">{t('พนักงานที่ลงอย่างน้อย 1 วัน')}</div></div>
            </div>
            <MiniCal row={r} today={today} lockDays={lockDays} accColor={acc.c} />
          </>
        )}

        <div className="s-cta">
          <button className="btn s-go" style={{ width: '100%', background: 'var(--site)' }}
            onClick={() => openSite(r.site_key, 'coverage')}>{t('เปิดบันทึก →')}</button>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard({ cur, setCur, openSite }:
  { cur: YMonth; setCur: (c: YMonth) => void; openSite: (k: string, m: 'coverage') => void }) {
  const { t, mname, be, dashDefault, hiddenSites } = useSettings()
  const [dashView, setDashView] = useState<DashView>(dashDefault)
  const data = useMemo(() => adminSummary(cur.y, cur.m, TODAY), [cur])
  const rows = data.rows.filter((r) => !hiddenSites.includes(r.site_key))

  const seg: [DashView, string][] = [['progress', t('ความคืบหน้า')], ['topact', t('กิจกรรมหลัก')], ['topcost', t('หมวดงานหลัก')]]

  return (
    <>
      <div className="card" style={{ padding: '.85rem 1.1rem' }}>
        <div className="statrow" style={{ alignItems: 'end', gap: '.9rem', marginBottom: 0 }}>
          <div>
            <h1 style={{ margin: 0 }}>{t('แดชบอร์ด')}</h1>
            <div className="sub" style={{ margin: 0 }}>{t('ภาพรวมการบันทึกการทำงานรายหน่วยงาน')} · {mname(cur.m)} {be(cur.y)}</div>
          </div>
          <div className="dash-mrow" style={{ marginLeft: 'auto' }}>
            <div className="fld">
              <label>{t('มุมมอง')}</label>
              <div className="viewseg">
                {seg.map(([v, l]) => (
                  <button key={v} className={dashView === v ? 'on' : ''} onClick={() => setDashView(v)}>{l}</button>
                ))}
              </div>
            </div>
            <div className="fld">
              <label>{t('เดือน')}</label>
              <MonthNav cur={cur} setCur={setCur} />
            </div>
            <div className="fld">
              <label>&nbsp;</label>
              <button className="btn xls-btn" title={t('ส่งออกสรุปวันทำงานรายหมวดงาน/กิจกรรม สำหรับเดือนนี้ (Excel)')}>⬇ {t('รายงานวันทำงาน')}</button>
            </div>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card empty-hero" style={{ textAlign: 'center', padding: '3rem 1.2rem' }}>
          <div style={{ fontSize: '2.4rem', lineHeight: 1, marginBottom: '.6rem' }}>🗓️</div>
          <h2 style={{ margin: 0 }}>{t('หน่วยงานทั้งหมดถูกซ่อนอยู่')}</h2>
          <p className="muted" style={{ margin: '.5rem auto 0', maxWidth: 520 }}>{t('เปิดหน่วยงานที่ต้องการได้ที่ ⚙ ตั้งค่า › หน่วยงานที่แสดง')}</p>
        </div>
      ) : (
        <div className="site-grid">
          {rows.map((r) => (
            <SiteCard key={r.site_key} r={r} today={data.today} lockDays={data.lockDays}
              dashView={dashView} monthName={mname(cur.m)} openSite={openSite} />
          ))}
        </div>
      )}
    </>
  )
}
