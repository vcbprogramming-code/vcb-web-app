import { useEffect, useState } from 'react';
import { performanceApi } from '../../lib/modules.js';

const CELL = {
  filled: 'bg-emerald-400',
  missed: 'bg-red-300',
  leave: 'bg-amber-300',
  off: 'bg-slate-100',
  future: 'bg-slate-50',
};
const LEGEND = [
  ['filled', 'บันทึกแล้ว', 'bg-emerald-400'],
  ['missed', 'ขาด', 'bg-red-300'],
  ['leave', 'ลา', 'bg-amber-300'],
  ['off', 'พัก/วันหยุด', 'bg-slate-200'],
  ['future', 'ยังไม่ถึง', 'bg-slate-50 border border-slate-200'],
];

function pctColor(pct) {
  if (pct == null) return 'text-slate-300';
  if (pct >= 80) return 'text-emerald-600';
  if (pct >= 40) return 'text-amber-600';
  return 'text-red-600';
}

export default function CoverageView({ siteId, month }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    performanceApi.coverage(siteId, month).then((r) => setData(r.data)).catch((e) => setError(e.message));
  }, [siteId, month]);

  if (error) return <div className="bg-red-50 text-red-700 rounded-xl px-4 py-3">{error}</div>;
  if (!data) return <div className="text-slate-400">กำลังโหลด…</div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        {LEGEND.map(([k, label, cls]) => (
          <span key={k} className="inline-flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${cls}`} /> {label}</span>
        ))}
      </div>
      <div className="card !p-0 overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="tbl-head">
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left min-w-[160px]">พนักงาน</th>
              {data.days.map((d) => (
                <th key={d.ymd} className="px-1 py-1 text-center text-[10px] font-semibold text-slate-400">{Number(d.ymd.slice(-2))}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.employee.id} className="border-t border-slate-50">
                <td className="sticky left-0 z-10 bg-white px-3 py-1.5 border-r border-slate-100">
                  <div className="truncate text-sm font-medium text-slate-700">{r.employee.full_name}</div>
                </td>
                {r.cells.map((c) => (
                  <td key={c.ymd} className="px-0.5 py-1">
                    <div className={`mx-auto h-4 w-4 rounded-sm ${CELL[c.status] || 'bg-slate-50'}`} title={`${c.ymd} · ${c.status}`} />
                  </td>
                ))}
              </tr>
            ))}
            {/* per-day % row */}
            <tr className="border-t-2 border-slate-200 bg-slate-50">
              <td className="sticky left-0 z-10 bg-slate-50 px-3 py-1.5 text-right text-xs font-semibold text-slate-500 border-r border-slate-100">% ครบถ้วน</td>
              {data.days.map((d) => (
                <td key={d.ymd} className={`px-0.5 py-1 text-center text-[10px] font-bold ${pctColor(d.pct)}`}>
                  {d.pct == null ? '–' : d.pct}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
