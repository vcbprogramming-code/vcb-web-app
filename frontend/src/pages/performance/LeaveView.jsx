import { useCallback, useEffect, useMemo, useState } from 'react';
import { perfApi } from '../../lib/performance.js';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * ระบบลางาน — ask, wait, be told.
 *
 * Three views of the same queue, because three different people come here: the
 * person who filed it wants to know where it got to, the supervisor wants the
 * ones still waiting on them, and both want to look back at what was decided.
 */
const STATUS = {
  pending:   { label: 'รออนุมัติ',  chip: 'bg-amber-50 text-amber-700' },
  approved:  { label: 'อนุมัติแล้ว', chip: 'bg-emerald-50 text-emerald-700' },
  rejected:  { label: 'ไม่อนุมัติ',  chip: 'bg-rose-50 text-rose-700' },
  cancelled: { label: 'ยกเลิกแล้ว',  chip: 'bg-slate-100 text-slate-500' },
};
const thDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear() + 543}`;
};

function Row({ r, children }) {
  const t = useT();
  const st = STATUS[r.status] || STATUS.pending;
  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-slate-100 px-4 py-3 last:border-0">
      <div className="min-w-[180px] flex-1">
        <div className="font-medium text-slate-800">{r.employee_name}</div>
        <div className="text-xs text-slate-500">{r.site_name || '—'}{r.employee_code ? ` · ${r.employee_code}` : ''}</div>
      </div>
      <div className="min-w-[150px]">
        <div className="text-sm text-slate-800">{thDate(r.from_date)} – {thDate(r.to_date)}</div>
        <div className="text-xs text-slate-500">{r.days} {t('วัน ·')} {r.leave_type_th}</div>
      </div>
      <div className="min-w-[160px] flex-1">
        {r.reason
          ? <div className="text-sm text-slate-600">{r.reason}</div>
          : <div className="text-sm text-slate-400">{t('— ไม่ได้ระบุเหตุผล')}</div>}
        {r.decided_by_name && (
          <div className="mt-0.5 text-xs text-slate-500">
            {st.label}โดย {r.decided_by_name} · {thDate(r.decided_at)}
            {r.decide_note ? ` — ${r.decide_note}` : ''}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`chip ${st.chip}`}>{st.label}</span>
        {children}
      </div>
    </div>
  );
}

export default function LeaveView({ employees, canEntry, onChanged }) {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const [types, setTypes] = useState([]);
  const [mine, setMine] = useState(null);
  const [pending, setPending] = useState(null);
  const [decided, setDecided] = useState(null);
  const [canDecide, setCanDecide] = useState(false);
  const [tab, setTab] = useState('mine');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ employeeId: '', leaveType: 'sick', from: '', to: '', reason: '' });
  const [error, setError] = useState(null);

  const load = useCallback(() => Promise.all([
    perfApi.leaveTypes(), perfApi.myLeave(), perfApi.pendingLeave(), perfApi.decidedLeave(),
  ]).then(([t, m, p, d]) => {
    setTypes(t.types || []);
    setMine(m.rows || []);
    setPending(p.rows || []);
    setCanDecide(Boolean(p.canDecide));
    setDecided(d.rows || []);
  }).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const days = useMemo(() => {
    if (!form.from || !form.to) return 0;
    const a = new Date(form.from); const b = new Date(form.to);
    return b < a ? 0 : Math.round((b - a) / 86400000) + 1;
  }, [form.from, form.to]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.employeeId) { setError('กรุณาเลือกชื่อพนักงาน'); return; }
    if (!form.from || !form.to) { setError('กรุณาระบุช่วงวันที่ลา'); return; }
    if (form.to < form.from) { setError('วันสิ้นสุดต้องไม่ก่อนวันเริ่มลา'); return; }
    setBusy(true);
    try {
      await perfApi.requestLeave(form);
      toast.success(t('ส่งคำขอลาแล้ว รอการอนุมัติ'));
      setForm({ employeeId: '', leaveType: 'sick', from: '', to: '', reason: '' });
      await load();
      setTab('mine');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const decide = async (r, approve) => {
    const ok = await confirm({
      title: approve ? 'อนุมัติการลา' : 'ไม่อนุมัติการลา',
      message: `${r.employee_name} · ${thDate(r.from_date)} – ${thDate(r.to_date)} (${r.days} วัน)`
        + (approve ? '\nวันเหล่านี้จะถูกบันทึกเป็นวันลาในตารางงานให้อัตโนมัติ' : ''),
      confirmLabel: approve ? 'อนุมัติ' : 'ไม่อนุมัติ', danger: !approve,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await perfApi.decideLeave(r.id, approve);
      toast.success(approve ? 'อนุมัติแล้ว' : 'บันทึกว่าไม่อนุมัติแล้ว');
      await load();
      onChanged?.();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const cancel = async (r) => {
    const ok = await confirm({ title: t('ยกเลิกคำขอลา'), message: t('ยกเลิกคำขอนี้?'), confirmLabel: t('ยกเลิกคำขอ'), danger: true });
    if (!ok) return;
    setBusy(true);
    try { await perfApi.cancelLeave(r.id); toast.success(t('ยกเลิกคำขอแล้ว')); await load(); }
    catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  // A site office still keeps a paper file, and the person approving often wants
  // something to hold. Open it in a tab rather than downloading: people read it
  // and print from there, and a forced download makes that two steps.
  const openSlip = async (r) => {
    try {
      const url = await perfApi.leaveSlipUrl(r.id);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { toast.error(e.message); }
  };

  if (!mine || !pending || !decided) return <div className="flex justify-center py-12"><Spinner label={t('กำลังโหลดคำขอลา…')} /></div>;

  const TABS = [
    { key: 'mine', label: t('คำขอของฉัน'), n: mine.length },
    ...(canDecide ? [{ key: 'pending', label: t('รออนุมัติ'), n: pending.length, hot: pending.length > 0 }] : []),
    ...(canDecide ? [{ key: 'decided', label: t('ประวัติการพิจารณา'), n: decided.length }] : []),
  ];
  const list = tab === 'mine' ? mine : tab === 'pending' ? pending : decided;

  return (
    <div className="space-y-4">
      {canEntry && (
        <form onSubmit={submit} className="card space-y-3">
          <h3 className="text-sm font-bold text-slate-800">{t('ขอลาใหม่')}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">{t('ชื่อพนักงาน')} <span className="text-red-500">*</span></label>
              <select value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} className="field">
                <option value="">{t('— เลือกพนักงาน —')}</option>
                {employees.map((e) => <option key={e.eid} value={e.eid}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">{t('ประเภทการลา')}</label>
              <select value={form.leaveType} onChange={(e) => setForm((f) => ({ ...f, leaveType: e.target.value }))} className="field">
                {types.map((t) => <option key={t.code} value={t.code}>{t.th}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">{t('วันที่เริ่มลา')} <span className="text-red-500">*</span></label>
              <input type="date" value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))} className="field" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">{t('วันที่สิ้นสุด')} <span className="text-red-500">*</span></label>
              <input type="date" value={form.to} onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))} className="field" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('เหตุผล (ถ้ามี)')}</label>
            <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder={t('เช่น ไปโรงพยาบาล')} className="field" />
          </div>
          {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy} className="btn-primary">{busy ? 'กำลังส่ง…' : 'ส่งคำขอลา'}</button>
            {days > 0 && <span className="text-sm text-slate-500">{t('รวม')} {days} {t('วัน')}</span>}
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === t.key ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {t.label}
            <span className={`ml-1.5 rounded-full px-1.5 text-xs ${t.hot ? 'bg-amber-400 font-bold text-[#0f172a]' : 'text-slate-400'}`}>{t.n}</span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white">
        {list.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            {tab === 'mine' ? 'ยังไม่มีคำขอลาของท่าน'
              : tab === 'pending' ? 'ไม่มีคำขอรออนุมัติ' : 'ยังไม่มีประวัติการพิจารณา'}
          </p>
        ) : list.map((r) => (
          <Row key={r.id} r={r}>
            {tab === 'pending' && (
              <>
                <button onClick={() => decide(r, true)} disabled={busy}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{t('อนุมัติ')}</button>
                <button onClick={() => decide(r, false)} disabled={busy}
                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">{t('ไม่อนุมัติ')}</button>
              </>
            )}
            <button onClick={() => openSlip(r)} title={t('เปิดใบลาเพื่อพิมพ์')}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <Icon name="file" className="h-4 w-4" /> {t('ใบลา')}
            </button>
            {tab === 'mine' && r.status === 'pending' && (
              <button onClick={() => cancel(r)} disabled={busy}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">{t('ยกเลิกคำขอ')}</button>
            )}
          </Row>
        ))}
      </div>

      {!canDecide && (
        <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <Icon name="clock" className="h-3.5 w-3.5" />
          {t('คำขอของท่านจะถูกส่งไปยังหัวหน้าที่ผู้ดูแลระบบกำหนดไว้')}
        </p>
      )}
    </div>
  );
}
