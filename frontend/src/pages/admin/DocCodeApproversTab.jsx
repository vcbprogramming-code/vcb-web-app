import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/ememo.js';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import Icon from '../../components/Icon.jsx';
import { BusyLabel } from '../../components/Spinner.jsx';

/**
 * Admin config: document codes. Each code can be added / edited (department +
 * recipient title) / deleted, and has a default approver chain. When a code has
 * approvers set, the create-document form auto-fills and locks them.
 */
export default function DocCodeApproversTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editCode, setEditCode] = useState(null);   // code whose approvers are being edited
  const [rows, setRows] = useState([]);             // approver rows in the editor
  const [busy, setBusy] = useState(false);
  const [delCode, setDelCode] = useState(null);     // code whose row-delete is in flight

  // add / edit the code itself (code + department + recipient title)
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ code: '', department: '', recipientTitle: '' });
  const [editMeta, setEditMeta] = useState(null);   // code whose meta is being edited
  const [metaForm, setMetaForm] = useState({ department: '', recipientTitle: '' });

  const load = () => { setLoading(true); return adminApi.listDocCodeApprovers().then((r) => setCodes(r.data)).catch((e) => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  // ---- approver chain editor ----
  const startEdit = (c) => {
    setError(null);
    setEditMeta(null);
    setEditCode(c.code);
    const existing = Array.isArray(c.default_approvers) ? c.default_approvers : [];
    setRows(existing.length ? existing.map((a) => ({ name: a.name || '', email: a.email || '' })) : [{ name: '', email: '' }]);
  };
  const updateRow = (i, key, val) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const addRow = () => setRows((p) => [...p, { name: '', email: '' }]);
  const removeRow = (i) => setRows((p) => p.filter((_, idx) => idx !== i));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const cleaned = rows
        .map((r) => ({ name: r.name.trim() || undefined, email: r.email.trim() }))
        .filter((r) => r.email);
      await adminApi.saveDocCodeApprovers(editCode, cleaned);
      setEditCode(null);
      toast.success('บันทึกสายอนุมัติแล้ว');
      load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  // ---- add a new code ----
  const createCode = async () => {
    if (!addForm.code.trim() || !addForm.department.trim()) {
      setError('กรุณาระบุรหัสและชื่อแผนก/ตำแหน่ง');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await adminApi.createDocCode({
        code: addForm.code.trim(),
        department: addForm.department.trim(),
        recipientTitle: addForm.recipientTitle.trim() || undefined,
      });
      setShowAdd(false);
      setAddForm({ code: '', department: '', recipientTitle: '' });
      toast.success('เพิ่มรหัสเอกสารแล้ว');
      load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  // ---- edit code meta (department + recipient title) ----
  const startEditMeta = (c) => {
    setError(null);
    setEditCode(null);
    setEditMeta(c.code);
    setMetaForm({ department: c.department || '', recipientTitle: c.recipient_title || '' });
  };
  const saveMeta = async () => {
    if (!metaForm.department.trim()) { setError('กรุณาระบุชื่อแผนก/ตำแหน่ง'); return; }
    setBusy(true);
    setError(null);
    try {
      await adminApi.updateDocCode(editMeta, {
        department: metaForm.department.trim(),
        recipientTitle: metaForm.recipientTitle.trim() || undefined,
      });
      setEditMeta(null);
      toast.success('บันทึกรหัสเอกสารแล้ว');
      load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  // ---- delete a code ----
  const removeCode = async (code) => {
    const ok = await confirm({ title: 'ลบรหัสเอกสาร', message: `ลบรหัสเอกสาร "${code}"?\n(ลบไม่ได้ถ้ามีเอกสารใช้รหัสนี้อยู่)`, confirmLabel: 'ลบรหัส' });
    if (!ok) return;
    setDelCode(code);
    setError(null);
    try {
      await adminApi.deleteDocCode(code);
      toast.success('ลบรหัสเอกสารแล้ว');
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setDelCode(null); }
  };

  const field = 'field';

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-500">
          จัดการรหัสเอกสาร — เพิ่ม / แก้ไข / ลบ และกำหนดสายอนุมัติประจำแต่ละรหัส เมื่อผู้ใช้เลือกรหัสตอนสร้างเอกสาร ระบบจะเติมผู้อนุมัติให้อัตโนมัติและล็อกไว้
        </p>
        {!showAdd && (
          <button onClick={() => { setShowAdd(true); setError(null); }} className="btn-primary shrink-0 !py-2 !text-sm">
            <Icon name="plus" className="h-4 w-4" /> เพิ่มรหัสเอกสาร
          </button>
        )}
      </div>
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* add-code form */}
      {showAdd && (
        <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">รหัส <span className="text-red-500">*</span></label>
              <input value={addForm.code} onChange={(e) => setAddForm((f) => ({ ...f, code: e.target.value }))} placeholder="เช่น 08" className={field} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-500">แผนก / ชื่อย่อ <span className="text-red-500">*</span></label>
              <input value={addForm.department} onChange={(e) => setAddForm((f) => ({ ...f, department: e.target.value }))} placeholder="เช่น ฝ่ายการเงิน" className={field} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">ตำแหน่งผู้รับ (เรียน) — ไม่บังคับ</label>
            <input value={addForm.recipientTitle} onChange={(e) => setAddForm((f) => ({ ...f, recipientTitle: e.target.value }))} placeholder="เช่น ผู้จัดการฝ่ายการเงิน" className={field} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowAdd(false); setError(null); }} className="btn-outline !py-1.5 !text-sm">ยกเลิก</button>
            <button onClick={createCode} disabled={busy} className="btn-primary !py-1.5 !text-sm">{busy ? 'กำลังเพิ่ม…' : 'เพิ่มรหัส'}</button>
          </div>
        </div>
      )}

      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {loading ? (
          <p className="p-5 text-sm text-slate-400">กำลังโหลด…</p>
        ) : codes.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">ยังไม่มีรหัสเอกสาร — กด “เพิ่มรหัสเอกสาร” เพื่อเริ่ม</p>
        ) : codes.map((c) => {
          const count = Array.isArray(c.default_approvers) ? c.default_approvers.length : 0;
          return (
            <div key={c.code} className="px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">{c.code}</span>
                    <span className="text-sm font-medium text-slate-800">{c.recipient_title || c.department}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    แผนก: {c.department}{' · '}
                    {count > 0 ? `ผู้อนุมัติ ${count} ลำดับ` : 'ยังไม่ได้กำหนดผู้อนุมัติ'}
                  </div>
                </div>
                {editCode !== c.code && editMeta !== c.code && (
                  <div className="flex shrink-0 items-center gap-3">
                    <button onClick={() => startEdit(c)} disabled={delCode === c.code} className="text-sm font-medium text-blue-600 hover:underline disabled:opacity-50">
                      {count > 0 ? 'ผู้อนุมัติ' : 'กำหนดผู้อนุมัติ'}
                    </button>
                    <button onClick={() => startEditMeta(c)} disabled={delCode === c.code} className="text-sm font-medium text-slate-500 hover:underline disabled:opacity-50">แก้รหัส</button>
                    <button onClick={() => removeCode(c.code)} disabled={delCode === c.code} className="text-sm font-medium text-red-500 hover:underline disabled:opacity-50">
                      <BusyLabel busy={delCode === c.code} busyText="กำลังลบ…">ลบ</BusyLabel>
                    </button>
                  </div>
                )}
              </div>

              {/* meta editor (department + recipient title) */}
              {editMeta === c.code && (
                <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">แผนก / ชื่อย่อ <span className="text-red-500">*</span></label>
                    <input value={metaForm.department} onChange={(e) => setMetaForm((f) => ({ ...f, department: e.target.value }))} className={field} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">ตำแหน่งผู้รับ (เรียน)</label>
                    <input value={metaForm.recipientTitle} onChange={(e) => setMetaForm((f) => ({ ...f, recipientTitle: e.target.value }))} className={field} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditMeta(null)} className="btn-outline !py-1.5 !text-sm">ยกเลิก</button>
                    <button onClick={saveMeta} disabled={busy} className="btn-primary !py-1.5 !text-sm">{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
                  </div>
                </div>
              )}

              {/* approver chain editor */}
              {editCode === c.code && (
                <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
                  {rows.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-center text-sm font-semibold text-slate-400">{i + 1}</span>
                      <input value={r.name} onChange={(e) => updateRow(i, 'name', e.target.value)} placeholder="ชื่อ (ไม่บังคับ)" className={`${field} w-36`} />
                      <input value={r.email} onChange={(e) => updateRow(i, 'email', e.target.value)} placeholder="อีเมล" type="email" className={`${field} flex-1`} />
                      {rows.length > 1 && (
                        <button onClick={() => removeRow(i)} className="px-1 text-slate-400 hover:text-red-600"><Icon name="x" className="h-4 w-4" /></button>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1">
                    <button onClick={addRow} className="text-sm font-medium text-blue-600 hover:underline">+ เพิ่มผู้อนุมัติ</button>
                    <div className="flex gap-2">
                      <button onClick={() => setEditCode(null)} className="btn-outline !py-1.5 !text-sm">ยกเลิก</button>
                      <button onClick={save} disabled={busy} className="btn-primary !py-1.5 !text-sm">{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
