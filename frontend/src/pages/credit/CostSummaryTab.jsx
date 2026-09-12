import { useCallback, useEffect, useMemo, useState } from 'react';
import { creditApi, formatMoney } from '../../lib/modules.js';
import { useToast } from '../../components/Toast.jsx';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * สรุปค่าใช้จ่าย — เงินที่เบิกไปแล้วเทียบกับงบที่ตั้งไว้
 *
 * งบตั้งเป็นคู่ (โครงการ × หมวดค่าใช้จ่าย) เหมือนระบบที่ลูกค้าใช้อยู่ หมวดที่
 * ยังไม่ได้ตั้งงบไม่ถูกซ่อน เพราะเงินก้อนนั้นออกไปจริงและต้องกระทบยอดได้ —
 * หน้าจอบอกตรง ๆ ว่า "ยังไม่ได้ตั้งงบ" แทนที่จะเว้นว่าง
 */
export default function CostSummaryTab({ projects = [], canEdit }) {
  const t = useT();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [project, setProject] = useState('');
  const [editing, setEditing] = useState(null);   // { projectId, costCategory, cap, note }
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    creditApi.costSummary(project ? { projectId: project } : {})
      .then((r) => setData(r.data))
      .catch((e) => { toast.error(e.message); setData({ projects: [] }); });
  }, [project, toast]);
  useEffect(load, [load]);

  const rows = useMemo(() => data?.projects || [], [data]);

  const saveCap = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await creditApi.setCategoryCap({
        projectId: editing.projectId,
        costCategory: editing.costCategory,
        cap: Number(editing.cap) || 0,
        note: editing.note || null,
      });
      toast.success(t('บันทึกงบประมาณแล้ว'));
      setEditing(null);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  if (!data) return <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลด…')} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={project} onChange={(e) => setProject(e.target.value)} className="field !w-auto">
          <option value="">{t('ทุกโครงการ')}</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
        </select>
        {(data.overCount > 0 || data.noBudgetCount > 0) && (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            {data.overCount > 0 && (
              <span className="chip bg-red-50 text-red-700">
                <Icon name="warning" className="mr-1 inline h-3.5 w-3.5" />
                {data.overCount} {t('หมวดเกินงบ')}
              </span>
            )}
            {data.noBudgetCount > 0 && (
              <span className="chip bg-amber-50 text-amber-700">{data.noBudgetCount} {t('หมวดยังไม่ได้ตั้งงบ')}</span>
            )}
          </span>
        )}
      </div>

      {rows.length === 0 && (
        <div className="card py-12 text-center text-sm text-slate-500">
          {t('ยังไม่มีรายการใช้วงเงินที่ระบุหมวดค่าใช้จ่าย')}
        </div>
      )}

      {rows.map((g) => (
        <div key={g.project_id} className="card !p-0 overflow-x-auto">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3">
            <div>
              <div className="font-bold text-slate-800">{g.project_code}</div>
              <div className="text-xs text-slate-500">{g.project_name}</div>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
              {g.overCount > 0 && <span className="chip bg-red-50 text-red-700">{g.overCount} {t('เกินงบ')}</span>}
              {g.noBudgetCount > 0 && <span className="chip bg-amber-50 text-amber-700">{g.noBudgetCount} {t('ยังไม่ตั้งงบ')}</span>}
              <span className="tabular-nums text-slate-600">
                {g.pct != null ? `${g.pct}%` : '—'}{' · '}
                {formatMoney(g.spent)} / {g.cap > 0 ? formatMoney(g.cap) : t('ยังไม่ได้ตั้งงบ')}
              </span>
            </div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th className="tbl-th">{t('หมวดค่าใช้จ่าย')}</th>
                <th className="tbl-th w-24 text-right">{t('# รายการ')}</th>
                <th className="tbl-th w-36 text-right">{t('ใช้ไป')}</th>
                <th className="tbl-th w-36 text-right">{t('งบประมาณ')}</th>
                <th className="tbl-th w-20 text-right">{t('% ใช้')}</th>
                <th className="tbl-th w-36 text-right">{t('คงเหลือ')}</th>
                {canEdit && <th className="tbl-th w-20" />}
              </tr>
            </thead>
            <tbody>
              {g.lines.map((l) => (
                <tr key={l.cost_category} className="tbl-row">
                  <td className="tbl-td text-slate-800">
                    {l.cost_category}
                    {l.note && <div className="text-[11px] text-slate-400">{l.note}</div>}
                  </td>
                  <td className="tbl-td text-right tabular-nums text-slate-500">{l.items}</td>
                  <td className="tbl-td text-right tabular-nums">{formatMoney(l.spent)}</td>
                  <td className="tbl-td text-right tabular-nums text-slate-500">
                    {l.cap == null ? <span className="text-amber-700">— {t('ไม่ได้ตั้ง')}</span> : formatMoney(l.cap)}
                  </td>
                  <td className={`tbl-td text-right tabular-nums font-medium ${l.over ? 'text-red-600' : 'text-slate-600'}`}>
                    {l.pct == null ? '—' : `${l.pct}%`}
                  </td>
                  <td className={`tbl-td text-right tabular-nums ${l.remaining != null && l.remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {l.remaining == null ? '—' : formatMoney(l.remaining)}
                  </td>
                  {canEdit && (
                    <td className="tbl-td text-right">
                      <button
                        onClick={() => setEditing({ projectId: g.project_id, costCategory: l.cost_category,
                          cap: l.cap ?? '', note: l.note ?? '' })}
                        title={t('ตั้งงบประมาณ')} aria-label={t('ตั้งงบประมาณ')}
                        className="text-slate-400 hover:text-slate-700">
                        <Icon name="edit" className="inline h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="font-bold text-slate-800">{t('ตั้งงบประมาณ')}</h3>
            <p className="mt-1 text-sm text-slate-500">{editing.costCategory}</p>
            <label className="mt-4 block text-sm font-medium text-slate-600">{t('งบประมาณ (บาท)')}</label>
            <input type="number" value={editing.cap} className="field"
              onChange={(e) => setEditing((v) => ({ ...v, cap: e.target.value }))} />
            <label className="mt-3 block text-sm font-medium text-slate-600">{t('หมายเหตุ')}</label>
            <input value={editing.note} className="field"
              onChange={(e) => setEditing((v) => ({ ...v, note: e.target.value }))} />
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="btn-outline">{t('ยกเลิก')}</button>
              <button onClick={saveCap} disabled={busy} className="btn-primary">
                {busy ? t('กำลังบันทึก…') : t('บันทึก')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
