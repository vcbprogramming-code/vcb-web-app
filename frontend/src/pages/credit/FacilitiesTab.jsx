import { useEffect, useState, useCallback } from 'react';
import { creditApi, formatMoney } from '../../lib/modules.js';
import { Modal } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

// ป้ายสีตามป้ายสั้นบนเอกสาร (doc_kind) ของทะเบียนประเภทวงเงิน
const TYPE_CHIP = {
  BG: 'bg-pink-50 text-pink-700',
  'L/G': 'bg-fuchsia-50 text-fuchsia-700',
  'T/L': 'bg-amber-50 text-amber-700',
  'B/E': 'bg-blue-50 text-blue-700',
  'P/N': 'bg-violet-50 text-violet-700',
  'M/L': 'bg-teal-50 text-teal-700',
  DLC: 'bg-sky-50 text-sky-700',
  'PN-post': 'bg-indigo-50 text-indigo-700',
};

function FacilityModal({ facility, projects, types, onClose, onSaved }) {
  const t = useT();
  const editing = Boolean(facility);
  const [form, setForm] = useState({
    projectId: facility?.project_id || projects[0]?.id || '',
    company: facility?.company || '',
    bank: facility?.bank || '',
    // ประเภทวงเงินคือเลขในทะเบียน ไม่ใช่ข้อความที่พิมพ์เอง — เลขนี้เป็นตัวบอกว่า
    // วงเงินก้อนนี้ไปรวมอยู่กล่องไหนบนหน้าภาพรวม
    facilityNo: facility?.facility_no ?? (types[0]?.no ?? 1),
    limit: facility?.limit ?? '',
    usedBaseline: facility ? '' : '',
    interestRate: facility?.interest_rate ?? '',
    dueDate: facility?.due_date ? String(facility.due_date).slice(0, 10) : '',
    notes: facility?.notes || '',
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
        company: form.company || null,
        bank: form.bank || null,
        facilityNo: Number(form.facilityNo),
        limit: Number(form.limit) || 0,
        interestRate: form.interestRate === '' ? null : Number(form.interestRate),
        dueDate: form.dueDate || null,
        notes: form.notes || null,
      };
      if (!editing && form.usedBaseline !== '') body.usedBaseline = Number(form.usedBaseline);
      if (editing) await creditApi.updateFacility(facility.id, body);
      else await creditApi.addFacility(body);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={editing ? t('แก้ไขวงเงินสินเชื่อ') : t('เพิ่มวงเงินสินเชื่อ')}
      onClose={onClose}
      size="2xl"
      footer={
        <>
          <button onClick={onClose} className="btn-outline">{t('ยกเลิก')}</button>
          <button onClick={submit} disabled={busy} className="btn-primary">{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('โครงการ')} <span className="text-red-500">*</span></label>
            <select value={form.projectId} onChange={(e) => set('projectId', e.target.value)} className="field">
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name || p.code}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('ประเภทวงเงิน')} <span className="text-red-500">*</span></label>
            <select value={form.facilityNo} onChange={(e) => set('facilityNo', e.target.value)} className="field">
              {types.map((ty) => (
                <option key={ty.no} value={ty.no}>{ty.no}. {ty.name_th}</option>
              ))}
            </select>
            {/* วงเงินหลายประเภทใช้ก้อนเดียวกับธนาคาร — บอกไว้ตรงนี้ ไม่ให้ไปเซอร์ไพรส์
                ตอนเห็นยอดรวมบนหน้าภาพรวม */}
            {(() => {
              const cur = types.find((x) => String(x.no) === String(form.facilityNo));
              if (!cur || cur.foldsInto === cur.no) return null;
              const box = types.find((x) => x.no === cur.foldsInto);
              return <p className="mt-1 text-xs text-amber-700">{t('ใช้วงเงินร่วมกับ')} {box?.doc_kind} — {t('หน้าภาพรวมจะรวมยอดไว้ในกล่องเดียวกัน')}</p>;
            })()}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('บริษัท')}</label>
            <input value={form.company} onChange={(e) => set('company', e.target.value)} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('ธนาคาร')}</label>
            <input value={form.bank} onChange={(e) => set('bank', e.target.value)} className="field" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('เลขที่สัญญา / อ้างอิงธนาคาร')}</label>
            <input value={form.notes} onChange={(e) => set('notes', e.target.value)} className="field"
              placeholder={t('เช่น เลขที่วงเงินตามหนังสือธนาคาร')} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('อัตราดอกเบี้ย (%/ปี)')}</label>
            <input type="number" step="0.01" value={form.interestRate} onChange={(e) => set('interestRate', e.target.value)} className="field" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('วงเงินที่อนุมัติ')} <span className="text-red-500">*</span></label>
            <input type="number" value={form.limit} onChange={(e) => set('limit', e.target.value)} className="field" />
          </div>
          {!editing && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">{t('ยอดใช้ไปเริ่มต้น (baseline)')}</label>
              <input type="number" value={form.usedBaseline} onChange={(e) => set('usedBaseline', e.target.value)} className="field" />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('วันครบกำหนด')}</label>
            <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className="field" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('หมายเหตุ')}</label>
          <input value={form.notes} onChange={(e) => set('notes', e.target.value)} className="field" />
        </div>
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
      </form>
    </Modal>
  );
}

function DrawdownModal({ facility, onClose, onSaved }) {
  const t = useT();
  const [form, setForm] = useState({ amount: '', startDate: '', dueDate: '', ref: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await creditApi.addLedger({
        facilityId: facility.id,
        amount: Number(form.amount),
        status: 'อนุมัติแล้ว',
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        ref: form.ref || null,
        note: form.note || null,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`บันทึกการใช้วงเงิน · ${facility.type}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-outline">{t('ยกเลิก')}</button>
          <button onClick={submit} disabled={busy} className="btn-primary">{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('จำนวนเงิน')} <span className="text-red-500">*</span></label>
          <input type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="field" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('วันเริ่ม')}</label>
            <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('ครบกำหนด')}</label>
            <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className="field" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('อ้างอิง / หมายเหตุ')}</label>
          <input value={form.ref} onChange={(e) => set('ref', e.target.value)} className="field" placeholder={t('เลขที่เอกสาร / อ้างอิง')} />
        </div>
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
      </form>
    </Modal>
  );
}

export default function FacilitiesTab({ projects, onChanged, openNew = 0 }) {
  // ทะเบียนประเภทวงเงินโหลดครั้งเดียว — ใช้ทั้งช่องเลือก ตัวกรอง และป้ายกำกับ
  const [types, setTypes] = useState([]);
  useEffect(() => { creditApi.facilityTypes().then((r) => setTypes(r.data || [])).catch(() => setTypes([])); }, []);
  const t = useT();
  const [facilities, setFacilities] = useState([]);
  const [error, setError] = useState(null);
  const [projectId, setProjectId] = useState('');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => { if (openNew) setEdit(null); }, [openNew]);
  const [edit, setEdit] = useState(undefined); // undefined=closed, null=new, obj=edit
  const [drawdown, setDrawdown] = useState(null);

  const load = useCallback(() => {
    creditApi.facilities({ projectId, type, search }).then((r) => setFacilities(r.data)).catch((e) => setError(e.message));
  }, [projectId, type, search]);
  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const projName = Object.fromEntries(projects.map((p) => [p.id, p.name || p.code]));
  const refresh = () => { load(); onChanged?.(); setEdit(undefined); setDrawdown(null); };

  return (
    <div className="space-y-4">
      {/* filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="field !w-auto">
          <option value="">{t('ทุกโครงการ')}</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name || p.code}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="field !w-auto">
          <option value="">{t('ทุกประเภท')}</option>
          {/* กรองด้วยกล่องที่พับรวมแล้ว — เลือก B/E ต้องได้ทุกวงเงินที่ใช้ก้อนนั้นร่วมกัน */}
          {[...new Set(types.map((x) => x.doc_kind))].map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <div className="relative min-w-[200px] flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('ค้นหา ธนาคาร / เลขที่วงเงิน')} className="field pl-9" />
        </div>
        <button onClick={() => setEdit(null)} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> {t('เพิ่มวงเงิน')}</button>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      <div className="card !p-0 overflow-hidden">
        <table className="tbl">
          <thead>
            <tr className="tbl-head">
              <th className="tbl-th w-10">#</th>
              <th className="tbl-th">{t('โครงการ')}</th>
              <th className="tbl-th">{t('ประเภท')}</th>
              <th className="tbl-th text-right">{t('วงเงิน')}</th>
              <th className="tbl-th text-right">{t('ใช้ไป')}</th>
              <th className="tbl-th text-right">{t('คงเหลือ')}</th>
              <th className="tbl-th w-40">{t('การใช้')}</th>
              <th className="tbl-th text-right">{t('จัดการ')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {facilities.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400">{t('ยังไม่มีวงเงินสินเชื่อ')}</td></tr>
            ) : facilities.map((f, i) => (
              <tr key={f.id} className="tbl-row">
                <td className="tbl-td text-slate-400">{i + 1}</td>
                <td className="tbl-td">
                  <div className="font-medium text-slate-800">{projName[f.project_id] || '—'}</div>
                  {/* the bank's own facility number is how finance and the bank
                      refer to the same line — it has to be readable here, not
                      only inside the edit form. */}
                  {(f.bank || f.facility_no) && (
                    <div className="text-xs text-slate-400">
                      {[f.bank, f.facility_no].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {f.company && <div className="text-xs text-slate-400">{f.company}</div>}
                </td>
                <td className="tbl-td"><span className={`chip ${TYPE_CHIP[f.type] || 'bg-slate-100 text-slate-600'}`}>{f.type}</span></td>
                <td className="tbl-td text-right tabular-nums">{formatMoney(f.limit)}</td>
                <td className="tbl-td text-right tabular-nums">{formatMoney(f.used)}</td>
                <td className={`tbl-td text-right tabular-nums font-medium ${f.available <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatMoney(f.available)}</td>
                <td className="tbl-td">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${f.pct >= 90 ? 'bg-red-500' : f.pct >= 70 ? 'bg-amber-400' : 'bg-brand'}`} style={{ width: `${Math.min(100, f.pct)}%` }} />
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400">{f.pct}%</div>
                </td>
                <td className="tbl-td text-right whitespace-nowrap">
                  <button onClick={() => setDrawdown(f)} className="mr-2 text-sm text-brand hover:underline">{t('เบิกใช้')}</button>
                  <button onClick={() => setEdit(f)} className="text-slate-400 hover:text-slate-700"><Icon name="edit" className="inline h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit !== undefined && (
        <FacilityModal facility={edit} projects={projects} types={types} onClose={() => setEdit(undefined)} onSaved={refresh} />
      )}
      {drawdown && (
        <DrawdownModal facility={drawdown} onClose={() => setDrawdown(null)} onSaved={refresh} />
      )}
    </div>
  );
}
