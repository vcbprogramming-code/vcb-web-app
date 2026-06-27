import { useEffect, useState, useCallback } from 'react';
import { creditApi, formatMoney } from '../../lib/modules.js';
import { Modal } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';

function CashPlanModal({ row, projects, defaultMonth, onClose, onSaved }) {
  const editing = Boolean(row);
  const [form, setForm] = useState({
    projectId: row?.project_id || projects[0]?.id || '',
    month: row?.month || defaultMonth,
    period: row?.period || '1',
    income: row?.income ?? '',
    newPN: row?.new_pn ?? '',
    deductions: row?.deductions ?? '',
    available: row?.available ?? '',
    incomeBreakdown: row?.income_breakdown || '',
    note: row?.note || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        projectId: form.projectId,
        month: form.month,
        period: form.period,
        income: Number(form.income) || 0,
        newPN: Number(form.newPN) || 0,
        deductions: Number(form.deductions) || 0,
        available: Number(form.available) || 0,
        incomeBreakdown: form.incomeBreakdown || null,
        note: form.note || null,
      };
      if (editing) await creditApi.updateCashPlan(row.id, body);
      else await creditApi.addCashPlan(body);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={editing ? 'แก้ไขแผนกระแสเงินสด' : 'เพิ่มงวดแผนกระแสเงินสด'}
      onClose={onClose}
      size="2xl"
      footer={
        <>
          <button onClick={onClose} className="btn-outline">ยกเลิก</button>
          <button onClick={submit} disabled={busy} className="btn-primary">{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">โครงการ <span className="text-red-500">*</span></label>
            <select value={form.projectId} onChange={(e) => set('projectId', e.target.value)} className="field">
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name || p.code}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">เดือน <span className="text-red-500">*</span></label>
            <input type="month" value={form.month} onChange={(e) => set('month', e.target.value)} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">งวด</label>
            <input value={form.period} onChange={(e) => set('period', e.target.value)} className="field" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">รายรับ</label>
            <input type="number" value={form.income} onChange={(e) => set('income', e.target.value)} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">ตั๋ว P/N ใหม่</label>
            <input type="number" value={form.newPN} onChange={(e) => set('newPN', e.target.value)} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">รายการหัก</label>
            <input type="number" value={form.deductions} onChange={(e) => set('deductions', e.target.value)} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">คงเหลือใช้ได้</label>
            <input type="number" value={form.available} onChange={(e) => set('available', e.target.value)} className="field" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">รายละเอียดรายรับ</label>
          <input value={form.incomeBreakdown} onChange={(e) => set('incomeBreakdown', e.target.value)} className="field" />
        </div>
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
      </form>
    </Modal>
  );
}

export default function CashPlanTab({ projects, onChanged }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [projectId, setProjectId] = useState('');
  const [month, setMonth] = useState('');
  const [edit, setEdit] = useState(undefined);
  const defaultMonth = new Date().toISOString().slice(0, 7);

  const load = useCallback(() => {
    creditApi.cashPlan({ projectId, month }).then((r) => setRows(r.data)).catch((e) => setError(e.message));
  }, [projectId, month]);
  useEffect(() => { load(); }, [load]);

  const projName = Object.fromEntries(projects.map((p) => [p.id, p.name || p.code]));
  const refresh = () => { load(); onChanged?.(); setEdit(undefined); };
  const remove = async (id) => {
    if (!window.confirm('ลบงวดนี้?')) return;
    try { await creditApi.deleteCashPlan(id); load(); } catch (e) { setError(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="field !w-auto">
          <option value="">ทุกโครงการ</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name || p.code}</option>)}
        </select>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="field !w-auto" />
        <button onClick={() => setEdit(null)} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> เพิ่มงวด</button>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      <div className="card !p-0 overflow-hidden">
        <table className="tbl">
          <thead>
            <tr className="tbl-head">
              <th className="tbl-th">โครงการ</th>
              <th className="tbl-th">เดือน/งวด</th>
              <th className="tbl-th text-right">รายรับ</th>
              <th className="tbl-th text-right">P/N ใหม่</th>
              <th className="tbl-th text-right">หัก</th>
              <th className="tbl-th text-right">คงเหลือ</th>
              <th className="tbl-th text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">ยังไม่มีแผนกระแสเงินสด</td></tr>
            ) : rows.map((c) => (
              <tr key={c.id} className="tbl-row">
                <td className="tbl-td text-slate-700">{projName[c.project_id] || '—'}</td>
                <td className="tbl-td text-slate-500">{c.month} · งวด {c.period}</td>
                <td className="tbl-td text-right tabular-nums">{formatMoney(c.income)}</td>
                <td className="tbl-td text-right tabular-nums">{formatMoney(c.new_pn)}</td>
                <td className="tbl-td text-right tabular-nums text-red-600">{formatMoney(c.deductions)}</td>
                <td className="tbl-td text-right tabular-nums font-medium text-emerald-600">{formatMoney(c.available)}</td>
                <td className="tbl-td text-right whitespace-nowrap">
                  <button onClick={() => setEdit(c)} className="mr-2 text-slate-400 hover:text-slate-700"><Icon name="edit" className="inline h-4 w-4" /></button>
                  <button onClick={() => remove(c.id)} className="text-slate-400 hover:text-red-600"><Icon name="trash" className="inline h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit !== undefined && (
        <CashPlanModal row={edit} projects={projects} defaultMonth={defaultMonth} onClose={() => setEdit(undefined)} onSaved={refresh} />
      )}
    </div>
  );
}
