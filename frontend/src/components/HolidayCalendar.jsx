import { useEffect, useMemo, useState } from 'react';
import { holidaysForYear } from '../lib/portal.js';
import Icon from './Icon.jsx';

// Thai public-holiday month calendar (ported from the client's portal): month
// grid with prev/next nav, weekend/holiday/today highlighting, a legend, and a
// "next upcoming holiday" callout computed from the real today (not the viewed
// month). Fixed-date holidays only — see lib/portal.js.

const DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

function buildCells(year, month) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });
  while (cells.length % 7 !== 0) cells.push({ day: null });
  return cells;
}

/** Next holiday on/after today. `daysAway` is the loop index — comparing a
 *  midnight probe against a time-of-day `now` would be off by one all afternoon. */
function findNextHoliday(from) {
  const y = from.getFullYear();
  const maps = { [y]: holidaysForYear(y), [y + 1]: holidaysForYear(y + 1) }; // hoisted out of the loop
  const probe = new Date(y, from.getMonth(), from.getDate());
  for (let i = 0; i < 366; i++) {
    const py = probe.getFullYear();
    const name = (maps[py] || (maps[py] = holidaysForYear(py)))[keyOf(py, probe.getMonth(), probe.getDate())];
    if (name) {
      const crossesYear = py !== y;
      return {
        name,
        daysAway: i,
        date: `${probe.getDate()}/${probe.getMonth() + 1}${crossesYear ? `/${py + 543}` : ''}`,
      };
    }
    probe.setDate(probe.getDate() + 1);
  }
  return null;
}

export default function HolidayCalendar() {
  const [view, setView] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  // re-evaluate "today" every minute so the today-highlight and the countdown
  // don't go stale on a dashboard left open past midnight
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => {
      setToday((prev) => { const n = new Date(); return n.toDateString() === prev.toDateString() ? prev : n; });
    }, 60000);
    return () => clearInterval(t);
  }, []);

  const year = view.getFullYear();
  const month = view.getMonth();
  const holidays = useMemo(() => holidaysForYear(year), [year]);
  const monthLabel = useMemo(() => view.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }), [view]);
  const nextHoliday = useMemo(() => findNextHoliday(today), [today]);

  const cells = buildCells(year, month);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Icon name="calendar" className="h-4 w-4 text-brand" /> ปฏิทินวันหยุด
        </h3>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="เดือนก่อนหน้า" onClick={() => setView(new Date(year, month - 1, 1))}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700">
            <Icon name="arrowLeft" className="h-4 w-4" />
          </button>
          <span className="min-w-[92px] text-center text-xs font-medium text-slate-500">{monthLabel}</span>
          <button type="button" aria-label="เดือนถัดไป" onClick={() => setView(new Date(year, month + 1, 1))}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700">
            <Icon name="arrowRight" className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]">
        {DOW.map((d, i) => (
          <div key={i} className={`py-1 font-semibold ${i === 0 || i === 6 ? 'text-rose-500' : 'text-slate-500'}`}>{d}</div>
        ))}
        {cells.map((c, i) => {
          if (c.day == null) return <div key={i} />;
          const dow = new Date(year, month, c.day).getDay();
          const name = holidays[keyOf(year, month, c.day)];
          const isWeekend = dow === 0 || dow === 6;
          const isToday = year === today.getFullYear() && month === today.getMonth() && c.day === today.getDate();
          let cls = 'relative mx-auto flex h-7 w-7 items-center justify-center rounded-lg ';
          if (isToday) cls += 'bg-brand text-white font-bold';
          else if (name) cls += 'bg-rose-50 font-semibold text-rose-600';
          else if (isWeekend) cls += 'text-rose-400';
          else cls += 'text-slate-600';
          return (
            <div key={i} className="py-0.5" title={name || undefined}>
              <div className={cls}>
                {c.day}
                {/* centred under the digit; also shown on today (white so it reads on the brand fill) */}
                {name && (
                  <span className={`absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${isToday ? 'bg-[#ffffff]' : 'bg-rose-500'}`} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> วันหยุด</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-300" /> เสาร์-อาทิตย์</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand" /> วันนี้</span>
      </div>

      {nextHoliday && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
          <span className="min-w-0 text-slate-600">วันหยุดถัดไป: <b>{nextHoliday.name}</b> ({nextHoliday.date})</span>
          <span className="shrink-0 font-semibold text-brand">{nextHoliday.daysAway === 0 ? 'วันนี้' : `อีก ${nextHoliday.daysAway} วัน`}</span>
        </div>
      )}
    </div>
  );
}
