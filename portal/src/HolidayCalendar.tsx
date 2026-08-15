import { useEffect, useMemo, useState } from 'react'
import { getHolidays } from './mockBackend'
import type { Dict, HolidaysByDate, Lang } from './types'

// Ported verbatim from the GAS portal's "holiday calendar" IIFE in index.html:
// month grid with prev/next nav, weekend/holiday/today highlighting, a
// legend, and a "next upcoming holiday" callout computed from real today
// (not the viewed month). Holiday lookups are cached per year, same as the
// GAS client's `holidayCache`.

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}
function dateKey(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`
}

type Cell = { day: number; outside: boolean }

function buildCells(year: number, month: number): Cell[] {
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()
  const cells: Cell[] = []
  for (let i = 0; i < firstDow; i++) cells.push({ day: daysInPrevMonth - firstDow + 1 + i, outside: true })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, outside: false })
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - (firstDow + daysInMonth) + 1, outside: true })
  return cells
}

export default function HolidayCalendar({ dict, lang }: { dict: Dict; lang: Lang }) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const [holidayCache, setHolidayCache] = useState<Record<number, HolidaysByDate>>({})

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const holidays = holidayCache[year]

  useEffect(() => {
    if (holidays) return
    setHolidayCache((prev) => ({ ...prev, [year]: getHolidays(year) }))
  }, [year, holidays])

  const holidayName = (h: { name_en: string; name_th: string }) => (lang === 'th' ? h.name_th : h.name_en)

  const monthLabel = useMemo(() => {
    const locale = lang === 'th' ? 'th-TH' : 'en-US'
    return viewDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  }, [viewDate, lang])

  const dowNames = dict.cal_dow.split(',')

  const nextHoliday = useMemo(() => {
    if (!holidays) return null
    const today = new Date()
    const probe = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    for (let i = 0; i < 366; i++) {
      const probeYear = probe.getFullYear()
      const probeHolidays = holidayCache[probeYear] ?? (probeYear === year ? holidays : null)
      if (probeHolidays) {
        const key = dateKey(probeYear, probe.getMonth(), probe.getDate())
        const h = probeHolidays[key]
        if (h) {
          const daysAway = Math.round((probe.getTime() - today.getTime()) / 86400000)
          return { name: holidayName(h), daysAway, date: `${probe.getDate()}/${probe.getMonth() + 1}` }
        }
      }
      probe.setDate(probe.getDate() + 1)
    }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holidays, holidayCache, year, lang])

  if (!holidays) {
    return (
      <div className="card panel reveal" id="calendar-panel">
        <div className="panel-head">
          <h3>{dict.panel_calendar}</h3>
        </div>
      </div>
    )
  }

  const today = new Date()
  const cells = buildCells(year, month)

  return (
    <div className="card panel reveal" id="calendar-panel">
      <div className="panel-head">
        <h3>{dict.panel_calendar}</h3>
        <div className="month-nav">
          <button
            type="button"
            className="cal-prev"
            aria-label="Previous month"
            onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          >
            &#8249;
          </button>
          <span style={{ fontSize: 9.5, color: 'var(--text-dim)', minWidth: 58, textAlign: 'center', display: 'inline-block' }}>
            {monthLabel}
          </span>
          <button
            type="button"
            className="cal-next"
            aria-label="Next month"
            onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          >
            &#8250;
          </button>
        </div>
      </div>

      <div className="cal-grid">
        {dowNames.map((d, i) => (
          <div className="cal-dow" key={i}>
            {d}
          </div>
        ))}
        {cells.map((c, i) => {
          if (c.outside) {
            return (
              <div className="cal-day is-outside" key={i}>
                {c.day}
              </div>
            )
          }
          const dow = new Date(year, month, c.day).getDay()
          const key = dateKey(year, month, c.day)
          const h = holidays[key]
          const isWeekend = dow === 0 || dow === 6
          const isToday = year === today.getFullYear() && month === today.getMonth() && c.day === today.getDate()
          let cls = 'cal-day'
          if (isWeekend) cls += ' is-weekend'
          if (h) cls += ' is-holiday'
          if (isToday) cls += ' is-today'
          return (
            <div className={cls} key={i} title={h ? holidayName(h) : undefined}>
              {c.day}
              {h && <span className="dot"></span>}
            </div>
          )
        })}
      </div>

      <div className="cal-legend">
        <div className="cal-legend-item">
          <span className="cal-legend-swatch holiday"></span>
          {dict.cal_legend_holiday}
        </div>
        <div className="cal-legend-item">
          <span className="cal-legend-swatch weekend"></span>
          {dict.cal_legend_weekend}
        </div>
        <div className="cal-legend-item">
          <span className="cal-legend-swatch today"></span>
          {dict.cal_legend_today}
        </div>
      </div>

      {nextHoliday && (
        <div className="cal-next-holiday">
          <span>
            {dict.cal_next_holiday.replace('{name}', nextHoliday.name).replace('{date}', nextHoliday.date)}
          </span>
          <span className="days">
            {nextHoliday.daysAway === 0 ? dict.cal_today : dict.cal_days_away.replace('{n}', String(nextHoliday.daysAway))}
          </span>
        </div>
      )}
    </div>
  )
}
