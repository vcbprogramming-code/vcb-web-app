import { useEffect, useState, useCallback } from 'react';
import { creditApi, formatMoney } from '../../lib/modules.js';
import { formatThaiDate } from '../../lib/ememo.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { Modal } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';

const STATUS_CHIP = {
  'อยู่ระหว่างเสนออนุมัติ': 'bg-amber-50 text-amber-700',
  'อนุมัติ': 'bg-emerald-50 text-emerald-700',
  'ไม่อนุมัติ': 'bg-red-50 text-red-700',
};

export default function RequestsPanel({ projects, onClose, onChanged }) {
  const { profile } = useAuth();
  const [requests, setRequests] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ facilityId: '', amount: '', dueDate: '', note: '' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const load = useCallback(() => {
    creditApi.requests().then((r) => setRequests(r.data)).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    load();
    creditApi.facilities({}).then((r) => setFacilities(r.data)).catch(() => {});
  }, [load]);

  const projName = Object.fromEntries(projects.map((p) => [p.id, p.name || p.code]));
  const facLabel = (id) => {
    const f = facilities.find((x) => x.id === id);
    return f ? `${projName[f.project_id] || ''} · ${f.type}` : '—';
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await creditApi.addRequest({
        facilityId: form.facilityId,
        amount: Number(form.amount),
        dueDate: form.dueDate || null,
        note: form.note || null,
      });
      setForm({ facilityId: '', amount: '', dueDate: '', note: '' });
      setAdding(false);
      load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const decide = async (id, decision) => {
    const note = decision === 'ไม่อนุมัติ' ? window.prompt('เหตุผล (ถ้ามี)') : null;
    try {
      await creditApi.decideRequest(id, decision, note || undefined);
      load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const canDecide = profile?.role === 'admin' || profile?.role === 'executive';

  return (
    <Modal
      title="คำขอใช้วงเงิน"
      onClose={onClose}
      size="2xl"
      footer={<button onClick={onClose} className="btn-outline">ปิด</button>}
    >
      {error && <div className="mb-3 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {!adding ? (
        <button onClick={() => setAdding(true)} className="btn-primary mb-3"><Icon name="plus" className="h-4 w-4" /> ยื่นคำขอใหม่</button>
      ) : (
        <form onSubmit={submit} className="mb-4 space-y-3 rounded-xl border border-slate-200 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">วงเงิน <span className="text-red-500">*</span></label>
              <select value={form.facilityId} onChange={(e) => set('facilityId', e.target.value)} className="field" required>
                <option value="">เลือกวงเงิน</option>
                {facilities.map((f) => <option key={f.id} value={f.id}>{facLabel(f.id)} (เหลือ {formatMoney(f.available)})</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">จำนวนเงิน <span className="text-red-500">*</span></label>
              <input type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="field" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">ครบกำหนด</label>
              <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className="field" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">หมายเหตุ</label>
              <input value={form.note} onChange={(e) => set('note', e.target.value)} className="field" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="btn-outline">ยกเลิก</button>
            <button type="submit" className="btn-primary">ยื่นคำขอ</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {requests.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">ยังไม่มีคำขอ</p>
        ) : requests.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{formatMoney(r.amount)}</span>
                <span className={`chip ${STATUS_CHIP[r.status]}`}>{r.status}</span>
              </div>
              <div className="text-xs text-slate-400">
                {facLabel(r.facility_id)}{r.due_date ? ` · ครบกำหนด ${formatThaiDate(r.due_date)}` : ''}{r.note ? ` · ${r.note}` : ''}
              </div>
            </div>
            {r.status === 'อยู่ระหว่างเสนออนุมัติ' && canDecide && (
              <div className="flex shrink-0 gap-2">
                <button onClick={() => decide(r.id, 'อนุมัติ')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">อนุมัติ</button>
                <button onClick={() => decide(r.id, 'ไม่อนุมัติ')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">ไม่อนุมัติ</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
