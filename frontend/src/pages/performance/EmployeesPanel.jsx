import { useEffect, useState, useCallback } from 'react';
import { performanceApi } from '../../lib/modules.js';
import { Modal } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';

export default function EmployeesPanel({ site, onClose, onChanged }) {
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ fullName: '', employeeCode: '', kind: 'operation', team: '' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const load = useCallback(() => {
    performanceApi.employees(site.id).then((r) => setEmployees(r.data)).catch((e) => setError(e.message));
  }, [site.id]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await performanceApi.addEmployee({ unitId: site.id, ...form });
      setForm({ fullName: '', employeeCode: '', kind: 'operation', team: '' });
      setAdding(false);
      load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggle = async (emp) => {
    try { await performanceApi.updateEmployee(emp.id, { isActive: !emp.is_active }); load(); onChanged?.(); }
    catch (e) { setError(e.message); }
  };

  return (
    <Modal
      title={`พนักงาน · ${site.name}`}
      onClose={onClose}
      size="2xl"
      footer={<button onClick={onClose} className="btn-outline">ปิด</button>}
    >
      {error && <div className="mb-3 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {!adding ? (
        <button onClick={() => setAdding(true)} className="btn-primary mb-3"><Icon name="plus" className="h-4 w-4" /> เพิ่มพนักงาน</button>
      ) : (
        <form onSubmit={submit} className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">ชื่อ-นามสกุล <span className="text-red-500">*</span></label>
            <input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} className="field" required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">รหัสพนักงาน</label>
            <input value={form.employeeCode} onChange={(e) => set('employeeCode', e.target.value)} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">ประเภท <span className="text-red-500">*</span></label>
            <select value={form.kind} onChange={(e) => set('kind', e.target.value)} className="field">
              <option value="operation">สายปฏิบัติการ (OT)</option>
              <option value="support">สายสนับสนุน (ไดอารี่)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">ทีม/ตำแหน่ง</label>
            <input value={form.team} onChange={(e) => set('team', e.target.value)} className="field" />
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="btn-outline">ยกเลิก</button>
            <button type="submit" className="btn-primary">เพิ่ม</button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="tbl">
          <thead>
            <tr className="tbl-head">
              <th className="tbl-th">ชื่อ</th>
              <th className="tbl-th">ประเภท</th>
              <th className="tbl-th">ทีม</th>
              <th className="tbl-th text-right">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((e) => (
              <tr key={e.id} className="tbl-row">
                <td className="tbl-td font-medium text-slate-800">{e.full_name}</td>
                <td className="tbl-td">
                  <span className={`chip ${e.kind === 'operation' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>
                    {e.kind === 'operation' ? 'ปฏิบัติการ' : 'สนับสนุน'}
                  </span>
                </td>
                <td className="tbl-td text-slate-500">{e.team || '—'}</td>
                <td className="tbl-td text-right">
                  <button onClick={() => toggle(e)} className={`text-sm hover:underline ${e.is_active ? 'text-slate-500' : 'text-emerald-600'}`}>
                    {e.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  </button>
                </td>
              </tr>
            ))}
            {employees.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">ยังไม่มีพนักงาน</td></tr>}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
