import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/ememo.js';
import Icon from '../../components/Icon.jsx';

/**
 * Admin config: per-document-code default approver chain. When a code has
 * approvers set here, the create-document form auto-fills and locks them.
 */
export default function DocCodeApproversTab() {
  const [codes, setCodes] = useState([]);
  const [error, setError] = useState(null);
  const [editCode, setEditCode] = useState(null);   // code currently being edited
  const [rows, setRows] = useState([]);             // approver rows in the editor
  const [busy, setBusy] = useState(false);

  const load = () =>
    adminApi.listDocCodeApprovers().then((r) => setCodes(r.data)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const startEdit = (c) => {
    setError(null);
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
      load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const field = 'field';

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-slate-500">
        กำหนดสายอนุมัติประจำแต่ละรหัสเอกสาร — เมื่อผู้ใช้เลือกรหัสนี้ตอนสร้างเอกสาร ระบบจะเติมผู้อนุมัติให้อัตโนมัติและล็อกไว้
      </p>
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {codes.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">ยังไม่มีรหัสเอกสาร</p>
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
                    {count > 0 ? `ผู้อนุมัติ ${count} ลำดับ` : 'ยังไม่ได้กำหนดผู้อนุมัติ'}
                  </div>
                </div>
                {editCode !== c.code && (
                  <button onClick={() => startEdit(c)} className="shrink-0 text-sm font-medium text-blue-600 hover:underline">
                    {count > 0 ? 'แก้ไข' : 'กำหนด'}
                  </button>
                )}
              </div>

              {/* inline editor */}
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
