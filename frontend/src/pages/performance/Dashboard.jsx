import { useEffect, useState } from 'react';
import { perfApi, perfPrefs } from '../../lib/performance.js';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

const dnum = (iso) => Number(iso.slice(8, 10));
const dow = (iso) => new Date(iso + 'T00:00:00').getDay();

function Ring({ pct, color }) {
  const r = 26, c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <svg width="66" height="66" viewBox="0 0 66 66" className="shrink-0">
      <circle cx="33" cy="33" r={r} fill="none" stroke="#e8edf3" strokeWidth="7" />
      <circle cx="33" cy="33" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 33 33)" />
      <text x="33" y="37" textAnchor="middle" className="fill-slate-800 text-[14px] font-extrabold">{pct}%</text>
    </svg>
  );
}

// compact month calendar coloured by daily fill (green full · amber partial · red
// missing · cream weekend · gray future/not-due)
function MiniCal({ daysFilled, today }) {
  if (!daysFilled?.length) return null;
  const first = daysFilled[0].date;
  const lead = dow(first); // blanks before day 1
  return (
    <div className="grid grid-cols-7 gap-[3px]">
      {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((h) => <div key={h} className="text-center text-[8px] text-slate-300">{h}</div>)}
      {Array.from({ length: lead }).map((_, i) => <div key={`b${i}`} />)}
      {daysFilled.map((day) => {
        const future = day.date > today;
        let bg = '#eef2f8', fg = '#9aa5b4';
        if (day.weekend) { bg = '#fdf0d4'; fg = '#a9895a'; }
        else if (future) { bg = '#eef2f8'; fg = '#c2cad6'; }
        else if (day.total === 0) { bg = '#eef2f8'; }
        else if (day.filled >= day.total) { bg = '#1f9d55'; fg = '#fff'; }
        else if (day.filled > 0) { bg = '#e8b500'; fg = '#5a4500'; }
        else { bg = '#e0533a'; fg = '#fff'; }
        return (
          <div key={day.date} title={`${day.date} · ${day.filled}/${day.total}`}
            className={`flex h-5 items-center justify-center rounded-[3px] text-[8px] font-semibold ${day.date === today ? 'ring-1 ring-brand' : ''}`}
            style={{ background: bg, color: fg }}>
            {dnum(day.date)}
          </div>
        );
      })}
    </div>
  );
}

function TopList({ items }) {
  const t = useT();
  const [all, setAll] = useState(false);
  if (!items?.length) return <p className="py-3 text-center text-xs text-slate-400">{t('ยังไม่มีข้อมูล')}</p>;
  const shown = all ? items : items.slice(0, 5);
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-1.5">
      {shown.map((it, i) => (
        <div key={i} className="text-xs">
          <div className="mb-0.5 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-slate-700">{it.name}</span>
            <span className="shrink-0 font-semibold text-slate-500">{it.count} <span className="text-slate-300">({it.pct}%)</span></span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round((it.count / max) * 100)}%` }} />
          </div>
        </div>
      ))}
      {items.length > 5 && (
        <button onClick={() => setAll((v) => !v)} className="pt-0.5 text-[11px] text-brand hover:underline">
          {all ? t('ย่อ', null, 'list') : t('ดูทั้งหมด ({n})', { n: items.length })}
        </button>
      )}
    </div>
  );
}

const MODES = [['progress', 'ความคืบหน้า'], ['topact', 'กิจกรรมหลัก'], ['topcost', 'หมวดงานหลัก']];

export default function Dashboard({ cur, onOpenSite }) {
  const t = useT();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('progress');

  useEffect(() => {
    let cancelled = false;
    setData(null); setError(null);
    perfApi.adminSummary(cur.y, cur.m)
      .then((r) => !cancelled && setData(r))
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [cur.y, cur.m]);

  if (error) return <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!data) return <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลดภาพรวม…')} /></div>;
  const hidden = new Set(perfPrefs.get().hiddenSites);
  const rows = (data.rows || []).filter((r) => !hidden.has(r.site_key));

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
        {MODES.map(([k, label]) => (
          <button key={k} onClick={() => setMode(k)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${mode === k ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            {t(label)}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card py-10 text-center">
          <h3 className="font-bold text-slate-700">{t('ยังไม่มีไซต์งานในขอบเขตของคุณ')}</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            {t('โมดูลนี้แสดงข้อมูลตามไซต์งานที่ท่านดูแล — ขอให้ผู้ดูแลระบบผูกไซต์งานให้ท่านที่ ตั้งค่า → ผู้ใช้และสังกัดโครงการ แล้วกลับมาที่หน้านี้อีกครั้ง')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((s) => {
            const color = s.color || '#2563eb';
            const started = s.support_started + s.operation_started;
            return (
              <div key={s.site_key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="h-1.5" style={{ backgroundColor: color }} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-bold text-slate-800" style={{ color }}>{s.site_name}</h3>
                      <p className="truncate text-xs text-slate-400">{s.company || ''}</p>
                    </div>
                    <Ring pct={s.fillRate} color={color} />
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div><div className="text-base font-bold text-slate-900">{s.n_emp}</div><div className="text-[10px] text-slate-400">{t('พนักงาน')}</div></div>
                    <div><div className="text-base font-bold text-slate-900">{s.entries}</div><div className="text-[10px] text-slate-400">{t('บันทึก')}</div></div>
                    <div><div className="text-base font-bold text-slate-900">{started}/{s.n_emp}</div><div className="text-[10px] text-slate-400">{t('เริ่มบันทึก')}</div></div>
                  </div>
                  <div className="mt-1 text-center text-[10px] text-slate-400">{s.n_operation} {t('ปฏิบัติการ ·')} {s.n_support} {t('สนับสนุน')}</div>

                  <div className="mt-3">
                    {mode === 'progress' && <MiniCal daysFilled={s.daysFilled} today={data.today} />}
                    {mode === 'topact' && <TopList items={s.topActivities} />}
                    {mode === 'topcost' && <TopList items={s.topCostCodes} />}
                  </div>

                  <button onClick={() => onOpenSite?.(s.site_key)}
                    className="mt-3 w-full rounded-xl py-2 text-sm font-semibold text-white transition hover:opacity-90" style={{ backgroundColor: color }}>
                    {t('เปิดบันทึก')} <Icon name="arrowRight" className="inline h-4 w-4 align-[-3px]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
