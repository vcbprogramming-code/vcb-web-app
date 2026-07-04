import { useEffect, useState } from 'react';
import { ememoApi } from '../../lib/ememo.js';
import { Modal } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';

/**
 * "ขอความเห็น" — the current approver asks another in-system user for an opinion
 * (NOT an approval). Picks the person from the account list, writes a question,
 * and sends. onConfirm({ email, name, question }) does the API call.
 */
export default function ConsultModal({ onClose, onConfirm }) {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    ememoApi.listApprovers().then((r) => setUsers(r.data)).catch(() => setUsers([]));
  }, []);

  const submit = async () => {
    if (!email) { setError('กรุณาเลือกผู้ที่ต้องการขอความเห็น'); return; }
    setBusy(true); setError(null);
    try {
      const u = users.find((x) => x.email === email);
      await onConfirm({ email, name: u?.full_name, question: question.trim() || undefined });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title="ขอความเห็น"
      onClose={busy ? undefined : onClose}
      size="md"
      footer={
        <>
          <button onClick={onClose} disabled={busy} className="btn-outline">ยกเลิก</button>
          <button onClick={submit} disabled={busy} className="btn-primary">
            <Icon name="chat" className="h-4 w-4" /> {busy ? 'กำลังส่ง…' : 'ส่งขอความเห็น'}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand">
          <Icon name="chat" className="h-5 w-5" />
        </span>
        <p className="text-sm text-slate-600">
          ขอความเห็นประกอบการพิจารณาจากผู้ใช้ในระบบ — ระบบจะส่งอีเมลให้เข้ามาดูเอกสารและตอบในหน้านี้
          <b className="text-slate-700"> โดยไม่ต้องอนุมัติ</b> (ท่านยังเป็นผู้ตัดสิน)
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600">ขอความเห็นจาก <span className="text-red-500">*</span></label>
        <select value={email} onChange={(e) => setEmail(e.target.value)} className="field">
          <option value="">— เลือกผู้ใช้ —</option>
          {users.map((u) => (
            <option key={u.email} value={u.email}>{u.full_name} ({u.email})</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600">คำถาม / สิ่งที่ขอปรึกษา (ไม่บังคับ)</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          placeholder="เช่น รบกวนช่วยดูเรื่องราคาต่อหน่วยให้หน่อยครับ…"
          className="field"
        />
      </div>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    </Modal>
  );
}
