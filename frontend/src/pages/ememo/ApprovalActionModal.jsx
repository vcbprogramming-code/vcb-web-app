import { useState } from 'react';
import { Modal } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';

/**
 * Confirmation modal for an approval decision.
 *   action = 'approved' → confirm + optional comment
 *   action = 'returned' | 'rejected' → REQUIRED reason
 * Calls onConfirm(comment) and closes on success.
 */
const META = {
  approved: {
    title: 'อนุมัติเอกสาร',
    desc: 'ยืนยันการอนุมัติเอกสารนี้ — เมื่ออนุมัติแล้วจะดำเนินการขั้นต่อไปทันที',
    label: 'ความเห็นเพิ่มเติม (ไม่บังคับ)',
    confirm: 'ยืนยันการอนุมัติ',
    required: false,
    btn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    icon: 'check', iconBg: 'bg-emerald-50 text-emerald-600',
  },
  returned: {
    title: 'ส่งกลับแก้ไข',
    desc: 'ส่งเอกสารกลับให้ผู้จัดทำแก้ไข โปรดระบุสิ่งที่ต้องแก้',
    label: 'เหตุผล / สิ่งที่ต้องแก้ไข',
    confirm: 'ยืนยันส่งกลับแก้ไข',
    required: true,
    btn: 'bg-amber-500 hover:bg-amber-600 text-white',
    icon: 'undo', iconBg: 'bg-amber-50 text-amber-600',
  },
  rejected: {
    title: 'ไม่อนุมัติเอกสาร',
    desc: 'ปฏิเสธเอกสารนี้ (สิ้นสุดการพิจารณา) โปรดระบุเหตุผล',
    label: 'เหตุผลที่ไม่อนุมัติ',
    confirm: 'ยืนยันไม่อนุมัติ',
    required: true,
    btn: 'bg-red-600 hover:bg-red-700 text-white',
    icon: 'x', iconBg: 'bg-red-50 text-red-600',
  },
};

export default function ApprovalActionModal({ action, onClose, onConfirm, warnNoSignature = false }) {
  const m = META[action] || META.approved;
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (m.required && !comment.trim()) {
      setError('กรุณาระบุเหตุผล/ความเห็น');
      return;
    }
    setBusy(true); setError(null);
    try {
      await onConfirm(comment.trim() || undefined);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={m.title}
      onClose={busy ? undefined : onClose}
      size="md"
      footer={
        <>
          <button onClick={onClose} disabled={busy} className="btn-outline">ยกเลิก</button>
          <button onClick={submit} disabled={busy} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${m.btn}`}>
            <Icon name={m.icon} className="h-4 w-4" /> {busy ? 'กำลังบันทึก…' : m.confirm}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${m.iconBg}`}>
          <Icon name={m.icon} className="h-5 w-5" />
        </span>
        <p className="text-sm text-slate-600">{m.desc}</p>
      </div>

      {warnNoSignature && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>คุณยังไม่ได้ตั้งค่าลายเซ็น หากอนุมัติตอนนี้ เอกสารจะไม่มีรูปลายเซ็นของคุณ — แนะนำให้ตั้งค่าลายเซ็นที่หน้า “โปรไฟล์ของฉัน” ก่อน</span>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600">
          {m.label}{m.required && <span className="text-red-500"> *</span>}
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          autoFocus
          placeholder={m.required ? 'ระบุเหตุผล…' : 'พิมพ์ความเห็น (ถ้ามี)…'}
          className="field"
        />
      </div>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    </Modal>
  );
}
