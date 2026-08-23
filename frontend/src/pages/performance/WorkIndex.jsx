import { useEffect, useState } from 'react';
import { perfApi } from '../../lib/performance.js';
import { useToast } from '../../components/Toast.jsx';
import { Modal } from '../../components/ui/index.js';
import Spinner, { BusyLabel } from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

function ActivityModal({ item, onClose, onSaved }) {
  const t = useT();
  const editing = Boolean(item);
  const [f, setF] = useState({ code: item?.code || '', name: item?.name || '', category: item?.category || '', mapping: item?.mapping || 'one-to-many', fixedCost: item?.fixed_cost || '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setErr(null);
    if (!f.code.trim() || !f.name.trim() || !f.category.trim()) { setErr('กรุณากรอกรหัส ชื่อ และหมวดหมู่'); return; }
    setBusy(true);
    try {
      const body = { name: f.name.trim(), category: f.category.trim(), mapping: f.mapping, fixedCost: f.mapping === 'one-to-one' ? (f.fixedCost.trim() || null) : null };
      if (editing) await perfApi.updateActivity(item.code, body);
      else await perfApi.createActivity({ code: f.code.trim(), ...body });
      onSaved();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  const field = 'field';
  return (
    <Modal title={editing ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรม'} onClose={onClose} size="md"
      footer={<><button onClick={onClose} className="btn-outline">{t('ยกเลิก')}</button><button type="submit" form="act-form" disabled={busy} className="btn-primary"><BusyLabel busy={busy} busyText="กำลังบันทึก…">{t('บันทึก')}</BusyLabel></button></>}>
      <form id="act-form" onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm"><span className="mb-1 block font-medium text-slate-600">{t('รหัส *')}</span><input value={f.code} onChange={(e) => set('code', e.target.value)} disabled={editing} placeholder={t('เช่น A-1')} className={`${field} ${editing ? 'bg-slate-100' : ''}`} /></label>
          <label className="text-sm"><span className="mb-1 block font-medium text-slate-600">{t('หมวดหมู่ *')}</span><input value={f.category} onChange={(e) => set('category', e.target.value)} placeholder={t('A · งานสำนักงาน')} className={field} /></label>
        </div>
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">{t('ชื่อกิจกรรม *')}</span><input value={f.name} onChange={(e) => set('name', e.target.value)} className={field} /></label>
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">{t('การจับคู่หมวดต้นทุน')}</span>
          <select value={f.mapping} onChange={(e) => set('mapping', e.target.value)} className={field}>
            <option value="one-to-many">{t('เลือกหมวดต้นทุนเอง (2 ขั้นตอน)')}</option>
            <option value="one-to-one">{t('กำหนดหมวดต้นทุนอัตโนมัติ (ขั้นตอนเดียว)')}</option>
          </select>
        </label>
        {f.mapping === 'one-to-one' && (
          <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">{t('รหัสหมวดต้นทุนอัตโนมัติ')}</span><input value={f.fixedCost} onChange={(e) => set('fixedCost', e.target.value)} placeholder={t('เช่น 5')} className={field} /></label>
        )}
        {err && <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{err}</div>}
      </form>
    </Modal>
  );
}

function CategoryModal({ item, onClose, onSaved }) {
  const t = useT();
  const editing = Boolean(item);
  const [f, setF] = useState({ code: item?.code || '', name: item?.name || '', nameEn: item?.name_en || '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setErr(null);
    if (!f.code.trim() || !f.name.trim()) { setErr('กรุณากรอกรหัสและชื่อ'); return; }
    setBusy(true);
    try {
      const body = { name: f.name.trim(), nameEn: f.nameEn.trim() || null };
      if (editing) await perfApi.updateCostCategory(item.code, body);
      else await perfApi.createCostCategory({ code: f.code.trim(), ...body });
      onSaved();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  const field = 'field';
  return (
    <Modal title={editing ? 'แก้ไขหมวดต้นทุน' : 'เพิ่มหมวดต้นทุน'} onClose={onClose} size="md"
      footer={<><button onClick={onClose} className="btn-outline">{t('ยกเลิก')}</button><button type="submit" form="cat-form" disabled={busy} className="btn-primary"><BusyLabel busy={busy} busyText="กำลังบันทึก…">{t('บันทึก')}</BusyLabel></button></>}>
      <form id="cat-form" onSubmit={submit} className="space-y-3">
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">{t('รหัส *')}</span><input value={f.code} onChange={(e) => set('code', e.target.value)} disabled={editing} placeholder={t('เช่น 5')} className={`${field} ${editing ? 'bg-slate-100' : ''}`} /></label>
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">{t('ชื่อ (ไทย) *')}</span><input value={f.name} onChange={(e) => set('name', e.target.value)} className={field} /></label>
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">{t('ชื่อ (อังกฤษ)')}</span><input value={f.nameEn} onChange={(e) => set('nameEn', e.target.value)} className={field} /></label>
        {err && <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{err}</div>}
      </form>
    </Modal>
  );
}

export default function WorkIndex() {
  const t = useT();
  const toast = useToast();
  const [tab, setTab] = useState('activities');
  const [acts, setActs] = useState(null);
  const [cats, setCats] = useState(null);
  const [error, setError] = useState(null);
  const [editAct, setEditAct] = useState(undefined); // undefined=closed, null=new, obj=edit
  const [editCat, setEditCat] = useState(undefined);

  const load = () => {
    perfApi.activities().then((r) => setActs(r.data)).catch((e) => setError(e.message));
    perfApi.costCategories().then((r) => setCats(r.data)).catch((e) => setError(e.message));
  };
  useEffect(() => { load(); }, []);

  if (error) return <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!acts || !cats) return <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลด…')} /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {[['activities', `กิจกรรม (${acts.length})`], ['categories', `หมวดต้นทุน (${cats.length})`]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${tab === k ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{label}</button>
          ))}
        </div>
        <button onClick={() => (tab === 'activities' ? setEditAct(null) : setEditCat(null))} className="btn-primary ml-auto !py-1.5"><Icon name="plus" className="h-4 w-4" /> เพิ่ม{tab === 'activities' ? 'กิจกรรม' : 'หมวดต้นทุน'}</button>
      </div>

      <div className="card !p-0 overflow-x-auto">
        {tab === 'activities' ? (
          <table className="tbl min-w-[640px]">
            <thead><tr className="tbl-head"><th className="tbl-th">{t('รหัส')}</th><th className="tbl-th">{t('กิจกรรม')}</th><th className="tbl-th">{t('หมวดหมู่')}</th><th className="tbl-th">{t('การจับคู่')}</th><th className="tbl-th text-right">{t('จัดการ')}</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {acts.map((a) => (
                <tr key={a.code} className="tbl-row">
                  <td className="tbl-td"><span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-600">{a.code}</span></td>
                  <td className="tbl-td font-medium text-slate-800">{a.name}</td>
                  <td className="tbl-td text-slate-500">{a.category}</td>
                  <td className="tbl-td">
                    {a.mapping === 'one-to-one'
                      ? <span className="chip bg-emerald-50 text-emerald-700">อัตโนมัติ → {a.fixed_cost || '—'}</span>
                      : <span className="chip bg-amber-50 text-amber-700">{t('เลือกเอง')}</span>}
                  </td>
                  <td className="tbl-td text-right"><button onClick={() => setEditAct(a)} className="text-sm text-blue-600 hover:underline">{t('แก้ไข')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="tbl min-w-[480px]">
            <thead><tr className="tbl-head"><th className="tbl-th">{t('รหัส')}</th><th className="tbl-th">{t('ชื่อ (ไทย)')}</th><th className="tbl-th">English</th><th className="tbl-th text-right">{t('จัดการ')}</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {cats.map((c) => (
                <tr key={c.code} className="tbl-row">
                  <td className="tbl-td"><span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-600">{c.code}</span></td>
                  <td className="tbl-td font-medium text-slate-800">{c.name}</td>
                  <td className="tbl-td text-slate-500">{c.name_en || '—'}</td>
                  <td className="tbl-td text-right"><button onClick={() => setEditCat(c)} className="text-sm text-blue-600 hover:underline">{t('แก้ไข')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editAct !== undefined && <ActivityModal item={editAct} onClose={() => setEditAct(undefined)} onSaved={() => { setEditAct(undefined); toast.success(t('บันทึกกิจกรรมแล้ว')); load(); }} />}
      {editCat !== undefined && <CategoryModal item={editCat} onClose={() => setEditCat(undefined)} onSaved={() => { setEditCat(undefined); toast.success(t('บันทึกหมวดต้นทุนแล้ว')); load(); }} />}
    </div>
  );
}
