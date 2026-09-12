import { useCallback, useEffect, useState } from 'react';
import { creditApi, formatMoney } from '../../lib/modules.js';
import { useToast } from '../../components/Toast.jsx';
import Spinner from '../../components/Spinner.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * ผลต่าง (แผน vs จริง)
 *
 * แผนการเงินกับหักค่างานตามจริงเป็นข้อมูลชุดเดียวกันคนละฉบับ หน้านี้จับคู่ตาม
 * โครงการ-เดือน-ช่วง แล้วลบกันทีละช่อง ช่องที่จ่ายจริงมากกว่าแผนขึ้นสีแดง
 * เพราะนั่นคือเงินที่ต้องหามาเพิ่ม ไม่ใช่แค่ตัวเลขที่คลาดจากกัน
 */
const Cell = ({ v, invert }) => {
  const bad = invert ? v.diff > 0 : v.diff < 0;
  return (
    <td className="tbl-td text-right tabular-nums">
      <div className="text-slate-800">{formatMoney(v.actual)}</div>
      <div className="text-[11px] text-slate-400">{formatMoney(v.plan)}</div>
      {v.diff !== 0 && (
        <div className={`text-[11px] font-medium ${bad ? 'text-red-600' : 'text-emerald-600'}`}>
          {v.diff > 0 ? '+' : ''}{formatMoney(v.diff)}
        </div>
      )}
    </td>
  );
};

export default function VarianceTab({ projects = [] }) {
  const t = useT();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [project, setProject] = useState('');

  const load = useCallback(() => {
    creditApi.cashPlanVariance(project ? { projectId: project } : {})
      .then((r) => setRows(r.data || []))
      .catch((e) => { toast.error(e.message); setRows([]); });
  }, [project, toast]);
  useEffect(load, [load]);

  const nameOf = (id) => {
    const p = projects.find((x) => x.id === id);
    return p ? `${p.code}` : '—';
  };

  if (!rows) return <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลด…')} /></div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={project} onChange={(e) => setProject(e.target.value)} className="field !w-auto">
          <option value="">{t('ทุกโครงการ')}</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
        </select>
        <p className="text-xs text-slate-500">
          {t('แต่ละช่องอ่านจากบนลงล่าง: ยอดจริง · ยอดตามแผน · ผลต่าง')}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="card py-12 text-center text-sm text-slate-500">
          {t('ยังไม่มีแผนการเงินหรือยอดจริงในช่วงที่เลือก')}
        </div>
      ) : (
        <div className="card !p-0 overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th className="tbl-th w-24">{t('โครงการ')}</th>
                <th className="tbl-th w-24">{t('เดือน')}</th>
                <th className="tbl-th w-20">{t('ช่วง')}</th>
                <th className="tbl-th text-right">{t('รับเงินค่างาน')}</th>
                <th className="tbl-th text-right">{t('P/N ขอเบิกใหม่')}</th>
                <th className="tbl-th text-right">{t('หักหนี้')}</th>
                <th className="tbl-th text-right">{t('คงเหลือสุทธิ')}</th>
                <th className="tbl-th w-28">{t('ความครบถ้วน')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.project_id}-${r.month}-${r.period}`} className="tbl-row">
                  <td className="tbl-td font-medium text-slate-700">{nameOf(r.project_id)}</td>
                  <td className="tbl-td whitespace-nowrap text-slate-600">{r.month}</td>
                  <td className="tbl-td text-slate-500">{r.period}</td>
                  <Cell v={r.income} />
                  <Cell v={r.new_pn} />
                  <Cell v={r.deductions} invert />
                  <Cell v={r.available} />
                  <td className="tbl-td text-xs">
                    {r.has_plan && r.has_actual
                      ? <span className="chip bg-emerald-50 text-emerald-700">{t('มีทั้งสองฉบับ')}</span>
                      : r.has_plan
                        ? <span className="chip bg-amber-50 text-amber-700">{t('ยังไม่ลงยอดจริง')}</span>
                        : <span className="chip bg-slate-100 text-slate-500">{t('ไม่มีแผน')}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
