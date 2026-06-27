import { useEffect, useState, useCallback } from 'react';
import { creditApi, formatMoney } from '../../lib/modules.js';
import { Modal } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';

const TYPES = ['L/G (BG)', 'LGM (L/G)', 'T/L', 'B/E (AVAL)', 'P/N'];
const TYPE_CHIP = {
  'L/G (BG)': 'bg-pink-50 text-pink-700',
  'LGM (L/G)': 'bg-fuchsia-50 text-fuchsia-700',
  'T/L': 'bg-amber-50 text-amber-700',
  'B/E (AVAL)': 'bg-blue-50 text-blue-700',
  'P/N': 'bg-violet-50 text-violet-700',
};

function FacilityModal({ facility, projects, onClose, onSaved }) {
  const editing = Boolean(facility);
  const [form, setForm] = useState({
    projectId: facility?.project_id || projects[0]?.id || '',
    company: facility?.company || '',
    bank: facility?.bank || '',
    facilityNo: facility?.facility_no || '',
    type: facility?.type || TYPES[0],
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
        facilityNo: form.facilityNo || null,
        type: form.type,
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
      title={editing ? 'แก้ไขวงเงินสินเชื่อ' : 'เพิ่มวงเงินสินเชื่อ'}
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">โครงการ <span className="text-red-500">*</span></label>
            <select value={form.projectId} onChange={(e) => set('projectId', e.target.value)} className="field">
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name || p.code}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">ประเภทวงเงิน <span className="text-red-500">*</span></label>
            <select value={form.type} onChange={(e) => set('type', e.target.value)} className="field">
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">บริษัท</label>
            <input value={form.company} onChange={(e) => set('company', e.target.value)} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">ธนาคาร</label>
            <input value={form.bank} onChange={(e) => set('bank', e.target.value)} className="field" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">เลขที่วงเงิน</label>
            <input value={form.facilityNo} onChange={(e) => set('facilityNo', e.target.value)} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">อัตราดอกเบี้ย (%/ปี)</label>
            <input type="number" step="0.01" value={form.interestRate} onChange={(e) => set('interestRate', e.target.value)} className="field" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">วงเงินที่อนุมัติ <span className="text-red-500">*</span></label>
            <input type="number" value={form.limit} onChange={(e) => set('limit', e.target.value)} className="field" />
          </div>
          {!editing && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">ยอดใช้ไปเริ่มต้น (baseline)</label>
              <input type="number" value={form.usedBaseline} onChange={(e) => set('usedBaseline', e.target.value)} className="field" />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">วันครบกำหนด</label>
            <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className="field" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">หมายเหตุ</label>
          <input value={form.notes} onChange={(e) => set('notes', e.target.value)} className="field" />
        </div>
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
      </form>
    </Modal>
  );
}

function DrawdownModal({ facility, onClose, onSaved }) {
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
          <button onClick={onClose} className="btn-outline">ยกเลิก</button>
          <button onClick={submit} disabled={busy} className="btn-primary">{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">จำนวนเงิน <span className="text-red-500">*</span></label>
          <input type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="field" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">วันเริ่ม</label>
            <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">ครบกำหนด</label>
            <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className="field" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">อ้างอิง / หมายเหตุ</label>
          <input value={form.ref} onChange={(e) => set('ref', e.target.value)} className="field" placeholder="เลขที่เอกสาร / อ้างอิง" />
        </div>
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
      </form>
    </Modal>
  );
}

export default function FacilitiesTab({ projects, onChanged }) {
  const [facilities, setFacilities] = useState([]);
  const [error, setError] = useState(null);
  const [projectId, setProjectId] = useState('');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState(undefined); // undefined=closed, null=new, obj=edit
  const [drawdown, setDrawdown] = useState(null);

  const load = useCallback(() => {
    creditApi.facilities({ projectId, type, search }).then((r) => setFacilities(r.data)).catch((e) => setError(e.message));
  }, [projectId, type, search]);
  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const projName = Object.fromEntries(projects.map((p) => [p.id, p.name || p.code]));
  const refresh = () => { load(); onChanged?.(); setEdit(undefined); setDrawdown(null); };

  return (
    <div className="space-y-4">
      {/* filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="field !w-auto">
          <option value="">ทุกโครงการ</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name || p.code}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="field !w-auto">
          <option value="">ทุกประเภท</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="relative min-w-[200px] flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา ธนาคาร / เลขที่วงเงิน" className="field pl-9" />
        </div>
        <button onClick={() => setEdit(null)} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> เพิ่มวงเงิน</button>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      <div className="card !p-0 overflow-hidden">
        <table className="tbl">
          <thead>
            <tr className="tbl-head">
              <th className="tbl-th w-10">#</th>
              <th className="tbl-th">โครงการ</th>
              <th className="tbl-th">ประเภท</th>
              <th className="tbl-th text-right">วงเงิน</th>
              <th className="tbl-th text-right">ใช้ไป</th>
              <th className="tbl-th text-right">คงเหลือ</th>
              <th className="tbl-th w-40">การใช้</th>
              <th className="tbl-th text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {facilities.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400">ยังไม่มีวงเงินสินเชื่อ</td></tr>
            ) : facilities.map((f, i) => (
              <tr key={f.id} className="tbl-row">
                <td className="tbl-td text-slate-400">{i + 1}</td>
                <td className="tbl-td">
                  <div className="font-medium text-slate-800">{projName[f.project_id] || '—'}</div>
                  {f.bank && <div className="text-xs text-slate-400">{f.bank}</div>}
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
                  <button onClick={() => setDrawdown(f)} className="mr-2 text-sm text-brand hover:underline">เบิกใช้</button>
                  <button onClick={() => setEdit(f)} className="text-slate-400 hover:text-slate-700"><Icon name="edit" className="inline h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit !== undefined && (
        <FacilityModal facility={edit} projects={projects} onClose={() => setEdit(undefined)} onSaved={refresh} />
      )}
      {drawdown && (
        <DrawdownModal facility={drawdown} onClose={() => setDrawdown(null)} onSaved={refresh} />
      )}
    </div>
  );
}
