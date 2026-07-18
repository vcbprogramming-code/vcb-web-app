import { useEffect, useState } from 'react';
import { ememoApi } from '../../lib/ememo.js';
import Icon from '../../components/Icon.jsx';

export default function SubmitApprovalModal({ documentId, docCode, projectManager, onClose, onSubmitted }) {
  const [approvers, setApprovers] = useState([{ name: '', email: '' }]); // higher approvers only
  const [locked, setLocked] = useState(false);
  const [users, setUsers] = useState([]); // system accounts, for the picker
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // ผู้จัดการโครงการ / ผู้ลงนาม = first approver (signs under ขอแสดงความนับถือ)
  const [pmEmail, setPmEmail] = useState(projectManager?.email || '');
  const [pmName, setPmName] = useState(projectManager?.name || '');
  const pmConfigured = Boolean(projectManager?.email);

  // load the accounts that can be picked (must have a system account)
  useEffect(() => {
    ememoApi.listApprovers().then((r) => setUsers(r.data)).catch(() => setUsers([]));
  }, []);
  useEffect(() => { setPmEmail(projectManager?.email || ''); setPmName(projectManager?.name || ''); }, [projectManager?.email, projectManager?.name]);

  // prefill + lock the HIGHER approvers from the doc-code config (PM is separate).
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

  // pick a user by email → fill name+email for that row
  const pick = (i, email) => {
    const u = users.find((x) => x.email === email);
    setApprovers((prev) => prev.map((a, idx) => (idx === i ? { name: u?.full_name || '', email } : a)));
  };
  const add = () => setApprovers((prev) => [...prev, { name: '', email: '' }]);
  const remove = (i) => setApprovers((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!pmEmail.trim()) {
      setError('กรุณาเลือกผู้จัดการโครงการ (ผู้ลงนาม) — เอกสารต้องผ่าน ผจก. อนุมัติก่อน');
      return;
    }
    const pmKey = pmEmail.trim().toLowerCase();
    const execs = approvers
      .map((a) => ({ name: a.name.trim() || undefined, email: a.email.trim() }))
      .filter((a) => a.email && a.email.toLowerCase() !== pmKey);
    const finalApprovers = [{ name: pmName.trim() || undefined, email: pmEmail.trim(), isSigner: true }, ...execs];
    setSubmitting(true);
    try {
      const res = await ememoApi.submitForApproval(documentId, finalApprovers);
      onSubmitted(res?.data?.emailSent === false);
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
            ผู้จัดการโครงการ (ผู้ลงนาม) อนุมัติเป็นลำดับแรก แล้วส่งต่อผู้อนุมัติที่สูงกว่าทีละคน — ระบบส่งอีเมลให้เข้ามาอนุมัติในเว็บ (ทุกคนต้องมีบัญชีในระบบ)
          </p>

          {/* PM = signer / first approver */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <label className="mb-1 block text-sm font-medium text-slate-600">ผู้จัดการโครงการ / ผู้ลงนาม (อนุมัติลำดับแรก) <span className="text-red-500">*</span></label>
            {pmConfigured ? (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <Icon name="user" className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="font-medium text-slate-800">{pmName || pmEmail}</span>
                <span className="ml-auto text-[11px] text-slate-400">กำหนดจากโครงการ</span>
              </div>
            ) : (
              <select value={pmEmail} onChange={(e) => { const u = users.find((x) => x.email === e.target.value); setPmEmail(e.target.value); setPmName(u?.full_name || ''); }} className={field}>
                <option value="">— เลือกผู้จัดการโครงการ (ผู้ลงนาม) —</option>
                {users.map((u) => (<option key={u.email} value={u.email}>{u.full_name} ({u.email})</option>))}
              </select>
            )}
          </div>

          <label className="block text-sm font-medium text-slate-600">ผู้อนุมัติที่สูงกว่า (ลำดับถัดจากผู้จัดการโครงการ){locked ? '' : ' — ไม่บังคับ'}</label>
          <div className="space-y-2">
            {approvers.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 text-center text-slate-400 font-semibold">{i + 1}</span>
                {locked ? (
                  <input value={a.name ? `${a.name} (${a.email})` : a.email} className={`${field} flex-1 bg-slate-100`} readOnly />
                ) : (
                  <select value={a.email} onChange={(e) => pick(i, e.target.value)} className={`${field} flex-1`}>
                    <option value="">— เลือกผู้อนุมัติ —</option>
                    {users.map((u) => (
                      <option key={u.email} value={u.email}>{u.full_name} ({u.email})</option>
                    ))}
                  </select>
                )}
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
