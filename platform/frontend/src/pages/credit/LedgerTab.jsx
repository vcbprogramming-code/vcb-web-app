import { useEffect, useState, useCallback } from 'react';
import { creditApi, formatMoney } from '../../lib/modules.js';
import { formatThaiDate } from '../../lib/ememo.js';
import Icon from '../../components/Icon.jsx';

const STATUSES = ['คำขอใหม่', 'อยู่ระหว่างเสนออนุมัติ', 'อนุมัติแล้ว', 'ชำระแล้ว', 'void'];
const STATUS_CHIP = {
  'คำขอใหม่': 'bg-slate-100 text-slate-600',
  'อยู่ระหว่างเสนออนุมัติ': 'bg-amber-50 text-amber-700',
  'อนุมัติแล้ว': 'bg-blue-50 text-blue-700',
  'ชำระแล้ว': 'bg-emerald-50 text-emerald-700',
  'void': 'bg-slate-100 text-slate-400',
};

export default function LedgerTab({ projects, onChanged }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(() => {
    creditApi.ledger({ projectId, status }).then((r) => setRows(r.data)).catch((e) => setError(e.message));
  }, [projectId, status]);
  useEffect(() => { load(); }, [load]);

  const projName = Object.fromEntries(projects.map((p) => [p.id, p.name || p.code]));

  const settle = async (id) => {
    try { await creditApi.settleLedger(id); load(); onChanged?.(); }
    catch (e) { setError(e.message); }
  };
  const remove = async (id) => {
    if (!window.confirm('ลบรายการนี้?')) return;
    try { await creditApi.deleteLedger(id); load(); onChanged?.(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="field !w-auto">
          <option value="">ทุกโครงการ</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name || p.code}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="field !w-auto">
          <option value="">ทุกสถานะ</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      <div className="card !p-0 overflow-hidden">
        <table className="tbl">
          <thead>
            <tr className="tbl-head">
              <th className="tbl-th">โครงการ</th>
              <th className="tbl-th text-right">จำนวนเงิน</th>
              <th className="tbl-th">สถานะ</th>
              <th className="tbl-th">วันเริ่ม</th>
              <th className="tbl-th">ครบกำหนด</th>
              <th className="tbl-th">อ้างอิง</th>
              <th className="tbl-th text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">ยังไม่มีรายการสินเชื่อ</td></tr>
            ) : rows.map((l) => (
              <tr key={l.id} className="tbl-row">
                <td className="tbl-td text-slate-700">{projName[l.project_id] || '—'}</td>
                <td className="tbl-td text-right tabular-nums font-medium">{formatMoney(l.amount)}</td>
                <td className="tbl-td"><span className={`chip ${STATUS_CHIP[l.status] || 'bg-slate-100 text-slate-600'}`}>{l.status}</span></td>
                <td className="tbl-td text-slate-500">{l.start_date ? formatThaiDate(l.start_date) : '—'}</td>
                <td className="tbl-td text-slate-500">{l.due_date ? formatThaiDate(l.due_date) : '—'}</td>
                <td className="tbl-td text-slate-500">{l.ref || '—'}</td>
                <td className="tbl-td text-right whitespace-nowrap">
                  {l.status === 'อนุมัติแล้ว' && (
                    <button onClick={() => settle(l.id)} className="mr-2 text-sm text-emerald-600 hover:underline">ชำระแล้ว</button>
                  )}
                  <button onClick={() => remove(l.id)} className="text-slate-400 hover:text-red-600"><Icon name="trash" className="inline h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
