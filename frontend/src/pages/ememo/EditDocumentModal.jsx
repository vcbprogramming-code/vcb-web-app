import { useEffect, useState, useRef } from 'react';
import { ememoApi } from '../../lib/ememo.js';
import { Modal } from '../../components/ui/index.js';
import ReferencePicker from './ReferencePicker.jsx';
import CcPicker from './CcPicker.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * Edit a document's content (subject / recipient / body / remarks / type /
 * work-unit / date). The project, doc code and running number are immutable.
 */
export default function EditDocumentModal({ doc, onClose, onSaved }) {
  const t = useT();
  const [docTypes, setDocTypes] = useState([]);
  const [form, setForm] = useState({
    subject: doc.subject || '',
    recipient: doc.recipient || '',
    reference: doc.reference || '',
    referenceDocId: doc.reference_doc_id || '',
    cc: doc.cc_recipients || '',
    // account-backed สำเนาเรียน; the text field above is kept for what prints
    ccProfileIds: (doc.cc_people || []).map((p) => p.id),
    signerName: doc.signer_name || '',
    signerTitle: doc.signer_title || '',
    body: doc.body || '',
    remarks: doc.remarks || '',
    docTypeId: doc.doc_type_id || '',
    dateReceived: doc.date_received ? String(doc.date_received).slice(0, 10) : '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submittingRef = useRef(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    ememoApi.listDocumentTypes().then((r) => setDocTypes(r.data)).catch(() => {});
  }, []);

  const submit = async (e) => {
    if (e) e.preventDefault();
    // The footer "บันทึก" button lives outside the <form>, so the input's
    // `required` never fires — validate here and give a Thai field message.
    if (!form.subject.trim()) {
      setError('กรุณากรอกเรื่อง');
      return;
    }
    if (submittingRef.current) return; // guard rapid double-submit
    submittingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await ememoApi.updateDocument(doc.id, {
        subject: form.subject,
        recipient: form.recipient || null,
        reference: form.reference || null,
        referenceDocId: form.referenceDocId || null,
        cc: form.cc || null,
        ccProfileIds: form.ccProfileIds,
        signerName: form.signerName || null,
        signerTitle: form.signerTitle || null,
        body: form.body || null,
        remarks: form.remarks || null,
        docTypeId: form.docTypeId || null,
        dateReceived: form.dateReceived || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  };

  return (
    <Modal
      title={`แก้ไขเอกสาร · ${doc.doc_number}`}
      onClose={onClose}
      size="2xl"
      footer={
        <>
          <button onClick={onClose} className="btn-outline">{t('ยกเลิก')}</button>
          <button onClick={submit} disabled={busy} className="btn-primary">{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('เรื่อง')} <span className="text-red-500">*</span></label>
          <input value={form.subject} onChange={(e) => set('subject', e.target.value)} className="field" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('เรียน')}</label>
            <input value={form.recipient} onChange={(e) => set('recipient', e.target.value)} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('ประเภทเอกสาร')}</label>
            <select value={form.docTypeId} onChange={(e) => set('docTypeId', e.target.value)} className="field">
              <option value="">{t('— ไม่ระบุ —')}</option>
              {docTypes.map((dt) => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('วันที่รับ')}</label>
            <input type="date" value={form.dateReceived} onChange={(e) => set('dateReceived', e.target.value)} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('อ้างถึง')}</label>
            {/* #3: pick a real in-system document */}
            <ReferencePicker
              value={{ docId: form.referenceDocId, text: form.reference }}
              onChange={({ docId, text }) => setForm((f) => ({ ...f, referenceDocId: docId, reference: text }))}
              excludeId={doc.id}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('สำเนาเรียน / CC')}</label>
            <CcPicker value={form.ccProfileIds} onChange={(v) => set('ccProfileIds', v)} />
            <p className="mt-1 text-xs text-slate-400">{t('ใส่อีเมลได้ — จะส่ง “เพื่อทราบ” ให้ตอนส่งอนุมัติ (ไม่ต้องอนุมัติ)')}</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('ผู้ลงนาม (ผู้เซ็น)')}</label>
            <input value={form.signerName} onChange={(e) => set('signerName', e.target.value)} placeholder={t('เว้นว่าง = ผู้จัดทำเซ็นเอง')} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('ตำแหน่งผู้ลงนาม')}</label>
            <input value={form.signerTitle} onChange={(e) => set('signerTitle', e.target.value)} className="field" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('เนื้อความ')}</label>
          <textarea rows={5} value={form.body} onChange={(e) => set('body', e.target.value)} className="field" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('หมายเหตุ')}</label>
          <input value={form.remarks} onChange={(e) => set('remarks', e.target.value)} className="field" />
        </div>
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
      </form>
    </Modal>
  );
}
