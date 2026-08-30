import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ememoApi,
  STATUS_META,
  formatThaiDate,
  formatThaiLongDate,
  formatThaiDateTime,
} from '../lib/ememo.js';
import Icon from '../components/Icon.jsx';
import { StatCard } from '../components/ui/index.js';

// the order + which statuses get their own headline card
const STATUS_ORDER = ['pending', 'approved', 'returned', 'rejected'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    ememoApi.stats().then((r) => setStats(r.data)).catch((e) => setError(e.message));
  }, []);

  const s = stats;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-3">
        <span className="hidden items-center gap-1.5 text-xs text-slate-400 sm:inline-flex">
          <Icon name="clock" className="h-4 w-4" /> อัปเดต: {formatThaiDateTime(new Date())}
        </span>
        <span className="chip bg-brand/10 text-brand">{formatThaiLongDate(new Date())}</span>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {!s ? (
        <div className="text-slate-400">กำลังโหลดภาพรวม…</div>
      ) : (
        <>
          {/* top stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="เอกสารทั้งหมด" value={s.total} icon="document" iconColor="bg-brand/10 text-brand" />
            <StatCard label="รับเข้าเดือนนี้" value={s.thisMonth} accent="text-blue-600" icon="calendar" iconColor="bg-blue-50 text-blue-600" />
            <StatCard label="รออนุมัติ" value={s.byStatus.pending || 0} accent="text-amber-600" icon="clock" iconColor="bg-amber-50 text-amber-600" />
            <StatCard label="อนุมัติแล้ว" value={s.byStatus.approved || 0} accent="text-emerald-600" icon="check" iconColor="bg-emerald-50 text-emerald-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            {/* LEFT (2 cols): status breakdown + by project */}
            <div className="lg:col-span-2 space-y-5">
              {/* status breakdown */}
              <div className="card">
                <h3 className="font-bold text-slate-800 mb-4">สถานะเอกสาร</h3>
                <div className="space-y-3">
                  {STATUS_ORDER.map((st) => {
                    const count = s.byStatus[st] || 0;
                    const pct = s.total ? Math.round((count / s.total) * 100) : 0;
                    const meta = STATUS_META[st];
                    return (
                      <div key={st}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-600">{meta.label}</span>
                          <span className="text-slate-400">{count} ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              st === 'pending' ? 'bg-amber-400'
                              : st === 'approved' ? 'bg-emerald-500'
                              : st === 'returned' ? 'bg-orange-400'
                              : 'bg-red-400'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* by project */}
              <div className="card">
                <h3 className="font-bold text-slate-800 mb-4">เอกสารแยกตามโครงการ</h3>
                <div className="flex flex-wrap gap-3">
                  {s.byProject.map((p) => (
                    <div key={p.code} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200">
                      <span className="px-2 py-0.5 rounded-md text-xs font-semibold text-white" style={{ backgroundColor: p.color || '#64748b' }}>{p.code}</span>
                      <span className="text-lg font-bold text-slate-800">{p.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* recent documents */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-800">เอกสารล่าสุด</h3>
                  <button onClick={() => navigate('/memos')} className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
                  ดูทั้งหมด <Icon name="arrowRight" className="h-4 w-4" />
                </button>
                </div>
                {s.recent.length === 0 ? (
                  <p className="text-sm text-slate-400">ยังไม่มีเอกสาร</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {s.recent.map((d) => (
                      <li key={d.id} onClick={() => navigate(`/memos/${d.id}`)}
                        className="flex items-center gap-3 py-3 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded-lg">
                        <span className="px-2 py-0.5 rounded-md text-xs font-semibold text-white shrink-0" style={{ backgroundColor: d.project_color || '#64748b' }}>{d.project_code}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-800 text-sm">{d.doc_number}</div>
                          <div className="text-slate-500 text-xs truncate">{d.subject}</div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${(STATUS_META[d.status] || STATUS_META.pending).chip}`}>
                          {(STATUS_META[d.status] || STATUS_META.pending).label}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* RIGHT: pending approval queue */}
            <div className="card">
              <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-800">
                <Icon name="inbox" className="h-5 w-5 text-amber-500" />
                รออนุมัติ ({s.byStatus.pending || 0})
              </h3>
              {s.pending.length === 0 ? (
                <p className="text-sm text-slate-400">ไม่มีเอกสารรออนุมัติ</p>
              ) : (
                <ul className="space-y-3">
                  {s.pending.map((d) => (
                    <li key={d.id} onClick={() => navigate(`/memos/${d.id}`)}
                      className="cursor-pointer rounded-xl border border-slate-100 hover:border-amber-300 hover:bg-amber-50 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-md text-xs font-semibold text-white" style={{ backgroundColor: d.project_color || '#64748b' }}>{d.project_code}</span>
                        <span className="text-xs text-slate-400">{formatThaiDate(d.date_received)}</span>
                      </div>
                      <div className="font-medium text-slate-800 text-sm">{d.doc_number}</div>
                      <div className="text-slate-500 text-xs line-clamp-2">{d.subject}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
