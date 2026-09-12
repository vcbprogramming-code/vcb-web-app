import { useEffect, useState, useCallback } from 'react';
import { creditApi, formatMoney } from '../../lib/modules.js';
import { formatThaiDate } from '../../lib/ememo.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { Modal } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

const STATUS_CHIP = {
  'อยู่ระหว่างเสนออนุมัติ': 'bg-amber-50 text-amber-700',
  'อนุมัติ': 'bg-emerald-50 text-emerald-700',
  'ไม่อนุมัติ': 'bg-red-50 text-red-700',
};

export default function RequestsPanel({ projects, onClose, onChanged }) {
  const t = useT();
  const { profile } = useAuth();
  const [requests, setRequests] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    facilityId: '', amount: '', startDate: '', termDays: '', dueDate: '', note: '',
    beneficiary: '', costCategory: '', refDocNo: '', refDocFrom: '', refDocTo: '',
    attachSource: '', attachFrom: '', attachTo: '',
  });
  // หมวดค่าใช้จ่ายที่เลือกตรงนี้จะติดไปกับรายการตอนอนุมัติ แล้วไปโผล่ที่หน้าสรุปค่าใช้จ่าย
  const [costCategories, setCostCategories] = useState([]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const load = useCallback(() => {
    creditApi.requests().then((r) => setRequests(r.data)).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    load();
    creditApi.facilities({}).then((r) => setFacilities(r.data)).catch(() => {});
    creditApi.costCategories().then((r) => setCostCategories(r.data || [])).catch(() => setCostCategories([]));
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
        startDate: form.startDate || null,
        termDays: form.termDays === '' ? null : Number(form.termDays),
        dueDate: form.dueDate || null,
        note: form.note || null,
        beneficiary: form.beneficiary || null,
        costCategory: form.costCategory || null,
        refDocNo: form.refDocNo || null,
        refDocFrom: form.refDocFrom || null,
        refDocTo: form.refDocTo || null,
        attachSource: form.attachSource || null,
        attachFrom: form.attachFrom || null,
        attachTo: form.attachTo || null,
      });
      setForm({ facilityId: '', amount: '', startDate: '', termDays: '', dueDate: '', note: '',
        beneficiary: '', costCategory: '', refDocNo: '', refDocFrom: '', refDocTo: '',
        attachSource: '', attachFrom: '', attachTo: '' });
      setAdding(false);
      load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const decide = async (id, decision) => {
    let note = null;
    if (decision === 'ไม่อนุมัติ') {
      note = window.prompt('เหตุผล (ถ้ามี)');
      if (note === null) return; // user cancelled the prompt — don't reject
    }
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
      title={t('คำขอใช้วงเงิน')}
      onClose={onClose}
      size="2xl"
      footer={<button onClick={onClose} className="btn-outline">{t('ปิด')}</button>}
    >
      {error && <div className="mb-3 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {!adding ? (
        <button onClick={() => setAdding(true)} className="btn-primary mb-3"><Icon name="plus" className="h-4 w-4" /> {t('ยื่นคำขอใหม่')}</button>
      ) : (
        <form onSubmit={submit} className="mb-4 space-y-3 rounded-xl border border-slate-200 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('วงเงิน')} <span className="text-red-500">*</span></label>
              <select value={form.facilityId} onChange={(e) => set('facilityId', e.target.value)} className="field" required>
                <option value="">{t('เลือกวงเงิน')}</option>
                {facilities.map((f) => <option key={f.id} value={f.id}>{facLabel(f.id)} {t('(เหลือ')} {formatMoney(f.available)})</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('จำนวนเงิน')} <span className="text-red-500">*</span></label>
              <input type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="field" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('วันที่เริ่ม')}</label>
              <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} className="field" />
            </div>
            <div>
              {/* ใส่จำนวนวันแล้วเว้นวันครบกำหนดไว้ ระบบคำนวณให้เอง */}
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('จำนวนวัน')}</label>
              <input type="number" value={form.termDays} onChange={(e) => set('termDays', e.target.value)} className="field" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('ครบกำหนด')}</label>
              <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className="field" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('ผู้รับผลประโยชน์')}</label>
              <input value={form.beneficiary} onChange={(e) => set('beneficiary', e.target.value)} className="field" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('หมวดค่าใช้จ่าย')}</label>
              <select value={form.costCategory} onChange={(e) => set('costCategory', e.target.value)} className="field">
                <option value="">{t('— ไม่ระบุ —')}</option>
                {costCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('เลขที่เอกสารอ้างอิง')}</label>
              <input value={form.refDocNo} onChange={(e) => set('refDocNo', e.target.value)} className="field" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('วันที่เอกสารอ้างอิง (ช่วง)')}</label>
              <div className="flex gap-2">
                <input type="date" value={form.refDocFrom} onChange={(e) => set('refDocFrom', e.target.value)} className="field" />
                <input type="date" value={form.refDocTo} onChange={(e) => set('refDocTo', e.target.value)} className="field" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('เอกสารแนบ (อีเมล / แหล่งที่มา)')}</label>
              <input value={form.attachSource} onChange={(e) => set('attachSource', e.target.value)} className="field" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('วันที่เอกสารแนบ (ช่วง)')}</label>
              <div className="flex gap-2">
                <input type="date" value={form.attachFrom} onChange={(e) => set('attachFrom', e.target.value)} className="field" />
                <input type="date" value={form.attachTo} onChange={(e) => set('attachTo', e.target.value)} className="field" />
              </div>
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('หมายเหตุ')}</label>
              <input value={form.note} onChange={(e) => set('note', e.target.value)} className="field" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="btn-outline">{t('ยกเลิก')}</button>
            <button type="submit" className="btn-primary">{t('ยื่นคำขอ')}</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {requests.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">{t('ยังไม่มีคำขอ')}</p>
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
                <button onClick={() => decide(r.id, 'อนุมัติ')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">{t('อนุมัติ')}</button>
                <button onClick={() => decide(r.id, 'ไม่อนุมัติ')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">{t('ไม่อนุมัติ')}</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
