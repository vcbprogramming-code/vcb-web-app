import { useEffect, useState } from 'react';
import { perfApi } from '../../lib/performance.js';
import { useToast } from '../../components/Toast.jsx';
import { Modal } from '../../components/ui/index.js';
import Spinner, { BusyLabel } from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';

/**
 * Manage the employee roster for one site — add / edit / activate. Employees are
 * what the Entry grid records against, so a site needs its roster set up before
 * HR can log work. Opened from the Entry screen.
 */
export default function EmployeesPanel({ siteKey, siteName, onClose, onChanged }) {
  const toast = useToast();
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ fullName: '', employeeCode: '', kind: 'operation' });
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState(null);
  const [dirty, setDirty] = useState(false);

  const load = () => perfApi.employees(siteKey).then((r) => setList(r.data)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [siteKey]);

  const add = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) { toast.error('กรุณากรอกชื่อพนักงาน'); return; }
    setBusy(true);
    try {
      await perfApi.createEmployee({ site: siteKey, fullName: form.fullName.trim(), employeeCode: form.employeeCode.trim() || null, kind: form.kind });
      setForm({ fullName: '', employeeCode: '', kind: form.kind });
      setDirty(true); toast.success('เพิ่มพนักงานแล้ว'); await load();
    } catch (e2) { toast.error(e2.message); } finally { setBusy(false); }
  };
  const toggleKind = async (emp) => {
    setRowBusy(emp.eid);
    try { await perfApi.updateEmployee(emp.eid, { kind: emp.kind === 'operation' ? 'support' : 'operation' }); setDirty(true); await load(); }
    catch (e) { toast.error(e.message); } finally { setRowBusy(null); }
  };
  const toggleActive = async (emp) => {
    setRowBusy(emp.eid);
    try { await perfApi.updateEmployee(emp.eid, { isActive: false }); setDirty(true); toast.success('ปิดใช้งานพนักงานแล้ว'); await load(); }
    catch (e) { toast.error(e.message); } finally { setRowBusy(null); }
  };

  const field = 'field';
  return (
    <Modal title={`จัดการพนักงาน · ${siteName || ''}`} onClose={() => { onClose(); if (dirty) onChanged?.(); }} size="2xl"
      footer={<button onClick={() => { onClose(); if (dirty) onChanged?.(); }} className="btn-primary">เสร็จสิ้น</button>}>
      {/* add form */}
      <form onSubmit={add} className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_120px_140px_auto]">
        <input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="ชื่อ-นามสกุล" className={field} />
        <input value={form.employeeCode} onChange={(e) => setForm((f) => ({ ...f, employeeCode: e.target.value }))} placeholder="รหัส (ถ้ามี)" className={field} />
        <select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))} className={field}>
          <option value="operation">สายปฏิบัติการ</option>
          <option value="support">สายสนับสนุน</option>
        </select>
        <button type="submit" disabled={busy} className="btn-primary"><BusyLabel busy={busy} busyText="กำลังเพิ่ม…"><Icon name="plus" className="h-4 w-4" /> เพิ่ม</BusyLabel></button>
      </form>

      {error ? <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        : !list ? <div className="flex justify-center py-10"><Spinner label="กำลังโหลด…" /></div>
        : list.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">ยังไม่มีพนักงานในไซต์นี้ — เพิ่มด้านบนได้เลย</p>
        : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="tbl min-w-[440px]">
              <thead><tr className="tbl-head"><th className="tbl-th">ชื่อ</th><th className="tbl-th">รหัส</th><th className="tbl-th">ประเภท</th><th className="tbl-th text-right">จัดการ</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((e) => (
                  <tr key={e.eid} className="tbl-row">
                    <td className="tbl-td font-medium text-slate-800">{e.name}</td>
                    <td className="tbl-td text-slate-500">{e.emp_id || '—'}</td>
                    <td className="tbl-td">
                      <button onClick={() => toggleKind(e)} disabled={rowBusy === e.eid} title="สลับประเภท" className={`chip disabled:opacity-50 ${e.kind === 'operation' ? 'bg-sky-50 text-sky-700' : 'bg-violet-50 text-violet-700'}`}>
                        {e.kind === 'operation' ? 'ปฏิบัติการ' : 'สนับสนุน'} ⇄
                      </button>
                    </td>
                    <td className="tbl-td text-right">
                      <button onClick={() => toggleActive(e)} disabled={rowBusy === e.eid} className="text-sm text-red-500 hover:underline disabled:opacity-50">
                        <BusyLabel busy={rowBusy === e.eid} busyText="…">ปิดใช้งาน</BusyLabel>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </Modal>
  );
}
