import { useEffect, useState } from 'react';
import { ememoApi } from '../../lib/ememo.js';
import { Modal } from '../../components/ui/index.js';

/**
 * Edit a document's content (subject / recipient / body / remarks / type /
 * work-unit / date). The project, doc code and running number are immutable.
 */
export default function EditDocumentModal({ doc, onClose, onSaved }) {
  const [docTypes, setDocTypes] = useState([]);
  const [form, setForm] = useState({
    subject: doc.subject || '',
    recipient: doc.recipient || '',
    reference: doc.reference || '',
    cc: doc.cc_recipients || '',
    body: doc.body || '',
    remarks: doc.remarks || '',
    workUnit: doc.work_unit || '',
    docTypeId: doc.doc_type_id || '',
    dateReceived: doc.date_received ? String(doc.date_received).slice(0, 10) : '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    ememoApi.listDocumentTypes().then((r) => setDocTypes(r.data)).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await ememoApi.updateDocument(doc.id, {
        subject: form.subject,
        recipient: form.recipient || null,
        reference: form.reference || null,
        cc: form.cc || null,
        body: form.body || null,
        remarks: form.remarks || null,
        workUnit: form.workUnit || null,
        docTypeId: form.docTypeId || null,
        dateReceived: form.dateReceived || undefined,
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
      title={`แก้ไขเอกสาร · ${doc.doc_number}`}
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
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">เรื่อง <span className="text-red-500">*</span></label>
          <input value={form.subject} onChange={(e) => set('subject', e.target.value)} className="field" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">เรียน</label>
            <input value={form.recipient} onChange={(e) => set('recipient', e.target.value)} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">ประเภทเอกสาร</label>
            <select value={form.docTypeId} onChange={(e) => set('docTypeId', e.target.value)} className="field">
              <option value="">— ไม่ระบุ —</option>
              {docTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">หน่วยงาน</label>
            <input value={form.workUnit} onChange={(e) => set('workUnit', e.target.value)} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">วันที่รับ</label>
            <input type="date" value={form.dateReceived} onChange={(e) => set('dateReceived', e.target.value)} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">อ้างถึง</label>
            <input value={form.reference} onChange={(e) => set('reference', e.target.value)} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">สำเนาเรียน / CC</label>
            <input value={form.cc} onChange={(e) => set('cc', e.target.value)} className="field" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">เนื้อความ</label>
          <textarea rows={5} value={form.body} onChange={(e) => set('body', e.target.value)} className="field" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">หมายเหตุ</label>
          <input value={form.remarks} onChange={(e) => set('remarks', e.target.value)} className="field" />
        </div>
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
      </form>
    </Modal>
  );
}
