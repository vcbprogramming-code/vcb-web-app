import { useEffect, useState } from 'react';
import { ememoApi } from '../../lib/ememo.js';
import Icon from '../../components/Icon.jsx';

export default function SubmitApprovalModal({ documentId, docCode, onClose, onSubmitted }) {
  const [approvers, setApprovers] = useState([{ name: '', email: '' }]);
  const [locked, setLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // prefill + lock the approver chain from the doc-code config (same as create)
  useEffect(() => {
    if (!docCode) return;
    ememoApi.listDocCodes().then((r) => {
      const cfg = r.data.find((c) => c.code === docCode)?.default_approvers;
      if (Array.isArray(cfg) && cfg.length) {
        setApprovers(cfg.map((a) => ({ name: a.name || '', email: a.email || '' })));
        setLocked(true);
      }
    }).catch(() => {});
  }, [docCode]);

  const update = (i, field, value) =>
    setApprovers((prev) => prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)));
  const add = () => setApprovers((prev) => [...prev, { name: '', email: '' }]);
  const remove = (i) => setApprovers((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const cleaned = approvers
      .map((a) => ({ name: a.name.trim() || undefined, email: a.email.trim() }))
      .filter((a) => a.email);
    if (cleaned.length === 0) {
      setError('กรุณาระบุอีเมลผู้อนุมัติอย่างน้อย 1 คน');
      return;
    }
    setSubmitting(true);
    try {
      await ememoApi.submitForApproval(documentId, cleaned);
      onSubmitted();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const field = 'field';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">ส่งเอกสารเข้าสายอนุมัติ</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><Icon name="x" className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <p className="text-sm text-slate-500">
            {locked
              ? 'สายอนุมัติถูกกำหนดไว้ตามรหัสเอกสารนี้ (แก้ไขได้ที่ ตั้งค่าระบบ → ผู้อนุมัติตามรหัส)'
              : 'ระบุผู้อนุมัติตามลำดับขั้น — ระบบจะส่งอีเมลพร้อมลิงก์อนุมัติให้ทีละคนตามลำดับ'}
          </p>

          <div className="space-y-2">
            {approvers.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 text-center text-slate-400 font-semibold">{i + 1}</span>
                <input value={a.name} onChange={(e) => update(i, 'name', e.target.value)} placeholder="ชื่อ (ไม่บังคับ)" className={`${field} w-32 ${locked ? 'bg-slate-100' : ''}`} readOnly={locked} />
                <input value={a.email} onChange={(e) => update(i, 'email', e.target.value)} placeholder="อีเมล *" type="email" className={`${field} flex-1 ${locked ? 'bg-slate-100' : ''}`} readOnly={locked} />
                {!locked && approvers.length > 1 && (
                  <button type="button" onClick={() => remove(i)} className="text-slate-400 hover:text-red-600 px-1"><Icon name="x" className="h-4 w-4" /></button>
                )}
              </div>
            ))}
          </div>
          {!locked && <button type="button" onClick={add} className="text-sm text-blue-600 hover:underline">+ เพิ่มผู้อนุมัติ</button>}

          {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline">ยกเลิก</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'กำลังส่ง…' : 'ส่งอนุมัติ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
