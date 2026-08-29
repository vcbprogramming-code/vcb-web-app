import { useCallback, useEffect, useState } from 'react';
import { perfApi } from '../../lib/performance.js';
import { useToast } from '../../components/Toast.jsx';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * รายงานและการตรวจสอบ — §7 manpower, §8 reports, §9 the trail, §10 what is due.
 *
 * All four read the same rows, so they sit on one screen: the figure, where it
 * came from, and who last touched it are the three questions that get asked
 * together when a number looks wrong.
 */
const GROUPS = [
  ['project', 'รายโครงการ'], ['team', 'รายทีม'],
  ['worktype', 'รายประเภทงาน'], ['employee', 'รายพนักงาน'],
];
const iso = (d) => d.toISOString().slice(0, 10);

export default function ReportsView({ site }) {
  const t = useT();
  const toast = useToast();
  const today = new Date();
  const [from, setFrom] = useState(() => iso(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(() => iso(today));
  const [groupBy, setGroupBy] = useState('project');
  const [manpower, setManpower] = useState(null);
  const [report, setReport] = useState(null);
  const [audit, setAudit] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setBusy(true);
    Promise.all([
      perfApi.manpower({ from, to, site }),
      perfApi.mandayReport({ from, to, groupBy }),
      perfApi.workAudit({ site, from, to }),
      perfApi.alerts(),
    ]).then(([m, r, a, al]) => {
      setManpower(m.data); setReport(r.data); setAudit(a.data || []); setAlerts(al.data || []);
    }).catch((e) => toast.error(e.message)).finally(() => setBusy(false));
  }, [from, to, groupBy, site, toast]);
  useEffect(load, [load]);

  const downloadPdf = async () => {
    try {
      const url = await perfApi.mandayPdfUrl({ from, to, groupBy });
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { toast.error(e.message); }
  };

  const download = async () => {
    try {
      const url = await perfApi.monthlyReportUrl(from.slice(0, 7));
      const a = document.createElement('a');
      a.href = url; a.download = `manday-${from.slice(0, 7)}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { toast.error(e.message); }
  };

  const Bar = ({ rows, unit }) => (
    <div className="space-y-1.5">
      {rows.length === 0 && <p className="py-4 text-center text-sm text-slate-400">{t('ไม่มีข้อมูลในช่วงที่เลือก')}</p>}
      {rows.slice(0, 8).map((r, i) => {
        const max = Math.max(...rows.map((x) => Number(x.manday) || 0), 1);
        const pct = Math.round(((Number(r.manday) || 0) / max) * 100);
        return (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-40 shrink-0 truncate text-slate-600" title={r.label || r.site_name || r.team || r.work_type}>
              {r.label || r.site_name || r.team || r.work_type || r.status}
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
            </span>
            <span className="w-16 shrink-0 text-right font-medium tabular-nums text-slate-800">
              {(Number(r.manday) || 0).toFixed(2)}
            </span>
            <span className="w-10 shrink-0 text-xs text-slate-400">{unit}</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      {alerts.length > 0 && (
        <div className="card-sm border-l-4 border-amber-400">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
            <Icon name="bell" className="h-4 w-4 text-amber-500" /> {t('รายการที่ต้องดำเนินการ')} ({alerts.length})
          </h3>
          <ul className="space-y-1 text-sm text-slate-600">
            {alerts.slice(0, 8).map((a, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${a.kind === 'due-soon' ? 'bg-amber-400' : 'bg-rose-400'}`} />
                {a.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card-sm flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">{t('ตั้งแต่')}</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field !w-auto" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">{t('ถึง')}</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="field !w-auto" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">{t('มุมมองรายงาน')}</label>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="field !w-auto">
            {GROUPS.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
          </select>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={downloadPdf} className="btn-outline">
            <Icon name="document" className="h-4 w-4" /> {t('รายงานนี้เป็น PDF')}
          </button>
          <button onClick={download} className="btn-outline">
            <Icon name="download" className="h-4 w-4" /> {t('รายงานเดือนนี้ ทุกโครงการ (Excel)')}
          </button>
        </div>
      </div>

      {busy && !manpower ? <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลด…')} /></div> : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="card-sm">
              <div className="text-xs font-semibold text-slate-500">{t('รวมแรงงาน-วัน')}</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {(manpower?.total?.manday || 0).toFixed(2)}
              </div>
            </div>
            <div className="card-sm">
              <div className="text-xs font-semibold text-slate-500">{t('จำนวนคนที่มีบันทึก')}</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{manpower?.total?.people || 0}</div>
            </div>
            <div className="card-sm">
              <div className="text-xs font-semibold text-slate-500">{t('จำนวนรายการ')}</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{manpower?.total?.rows || 0}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card">
              <h3 className="mb-3 font-bold text-slate-800">{t('กำลังคนรายโครงการ')}</h3>
              <Bar rows={manpower?.byProject || []} unit={t('วัน')} />
            </div>
            <div className="card">
              <h3 className="mb-3 font-bold text-slate-800">{t('สัดส่วนตามประเภทงาน')}</h3>
              <Bar rows={manpower?.byWorkType || []} unit={t('วัน')} />
            </div>
            <div className="card">
              <h3 className="mb-3 font-bold text-slate-800">{t('กำลังคนรายทีม')}</h3>
              <Bar rows={manpower?.byTeam || []} unit={t('วัน')} />
            </div>
            <div className="card">
              <h3 className="mb-3 font-bold text-slate-800">{t('แยกตามสถานะการทำงาน')}</h3>
              <Bar rows={manpower?.byStatus || []} unit={t('วัน')} />
            </div>
          </div>

          <div className="card overflow-hidden !p-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3">
              <h3 className="font-bold text-slate-800">{t('รายงานแรงงาน-วัน')} · {t(GROUPS.find(([k]) => k === groupBy)?.[1] || '')}</h3>
              {report?.meta && (
                <p className="text-xs text-slate-400">
                  {t('ช่วงข้อมูล')} {report.meta.from} – {report.meta.to} ·{' '}
                  {t('ดึงเมื่อ')} {new Date(report.meta.generatedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })} ·{' '}
                  {t('โดย')} {report.meta.generatedBy}
                </p>
              )}
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th className="tbl-th">{t('รหัส')}</th>
                  <th className="tbl-th">{t('รายการ')}</th>
                  <th className="tbl-th text-right">{t('แรงงาน-วัน')}</th>
                  <th className="tbl-th text-right">{t('จำนวนคน')}</th>
                </tr>
              </thead>
              <tbody>
                {(report?.rows || []).length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">{t('ไม่มีข้อมูลในช่วงที่เลือก')}</td></tr>
                )}
                {(report?.rows || []).map((r, i) => (
                  <tr key={i} className="tbl-row">
                    <td className="tbl-td text-slate-500">{r.key || '—'}</td>
                    <td className="tbl-td text-slate-800">{r.label}</td>
                    <td className="tbl-td text-right font-medium tabular-nums">{Number(r.manday || 0).toFixed(2)}</td>
                    <td className="tbl-td text-right tabular-nums text-slate-500">{r.people}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card overflow-hidden !p-0">
            <h3 className="px-5 py-3 font-bold text-slate-800">{t('ประวัติการแก้ไข (Audit Trail)')}</h3>
            <div className="max-h-[420px] overflow-y-auto">
              <table className="tbl">
                <thead className="sticky top-0 bg-white">
                  <tr>
                    <th className="tbl-th">{t('เวลา')}</th>
                    <th className="tbl-th">{t('ผู้ดำเนินการ')}</th>
                    <th className="tbl-th">{t('การกระทำ')}</th>
                    <th className="tbl-th">{t('วันที่ข้อมูล')}</th>
                    <th className="tbl-th">{t('ค่าเดิม → ค่าใหม่')}</th>
                    <th className="tbl-th">{t('เหตุผล')}</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">{t('ยังไม่มีประวัติในช่วงที่เลือก')}</td></tr>
                  )}
                  {audit.map((a) => (
                    <tr key={a.id} className="tbl-row align-top">
                      <td className="tbl-td whitespace-nowrap text-xs text-slate-500">
                        {new Date(a.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
                      </td>
                      <td className="tbl-td text-slate-700">{a.actor_label || '—'}</td>
                      <td className="tbl-td"><span className="chip bg-slate-100 text-slate-600">{t(a.action)}</span></td>
                      <td className="tbl-td whitespace-nowrap text-slate-500">{a.ymd ? String(a.ymd).slice(0, 10) : '—'}</td>
                      <td className="tbl-td max-w-[280px] text-xs text-slate-500">
                        <span className="line-through opacity-60">{a.before_val ? JSON.stringify(a.before_val) : '—'}</span>
                        {' → '}
                        <span>{a.after_val ? JSON.stringify(a.after_val) : '—'}</span>
                      </td>
                      <td className="tbl-td text-xs text-slate-600">{a.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
