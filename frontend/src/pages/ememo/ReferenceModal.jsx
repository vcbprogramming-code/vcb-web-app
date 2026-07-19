import { useEffect, useState } from 'react';
import { ememoApi, STATUS_META, formatThaiDate } from '../../lib/ememo.js';
import { Modal } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';
import Spinner from '../../components/Spinner.jsx';

/**
 * Preview the referenced ("อ้างถึง") document in a modal instead of navigating
 * away (client #6). Loads the doc's meta + its letter PDF inline, with a button
 * to open the full document if the user wants more.
 */
export default function ReferenceModal({ refId, onClose, onOpenFull }) {
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    ememoApi.getDocument(refId)
      .then((r) => { if (!cancelled) setDoc(r.data); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [refId]);

  // load the letter (approved > original) as an inline preview
  useEffect(() => {
    if (!doc) return;
    const letter = (doc.attachments || []).find((a) => a.version === 'approved')
      || (doc.attachments || []).find((a) => a.version === 'original');
    if (!letter) { setPreviewUrl(null); return; }
    let url; let cancelled = false;
    ememoApi.attachmentBlobUrl(doc.id, letter.id)
      .then((u) => { if (cancelled) { URL.revokeObjectURL(u); return; } url = u; setPreviewUrl(u); })
      .catch(() => !cancelled && setPreviewUrl(null));
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [doc]);

  const status = doc ? (STATUS_META[doc.status] || STATUS_META.pending) : null;

  return (
    <Modal
      title="เอกสารที่อ้างถึง"
      onClose={onClose}
      size="xl"
      footer={
        <>
          <button onClick={onClose} className="btn-outline">ปิด</button>
          <button onClick={() => onOpenFull(refId)} className="btn-primary">
            <Icon name="arrowRight" className="h-4 w-4" /> เปิดเอกสารเต็ม
          </button>
        </>
      }
    >
      {error ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : !doc ? (
        <div className="flex justify-center py-16"><Spinner label="กำลังโหลดเอกสารที่อ้างถึง…" /></div>
      ) : (
        <div className="space-y-4">
          {/* meta */}
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-md px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: doc.project_color || '#64748b' }}>{doc.project_code}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.chip}`}>{status.label}</span>
            </div>
            <h3 className="text-lg font-bold text-slate-800">{doc.doc_number}</h3>
            <p className="text-slate-600">{doc.subject}</p>
            <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
              <span>วันที่รับ: {formatThaiDate(doc.date_received)}</span>
              {doc.department && <span>แผนก: {doc.department}</span>}
              {doc.recipient && <span>เรียน: {doc.recipient}</span>}
            </div>
          </div>

          {/* letter preview */}
          {previewUrl ? (
            <iframe
              title="เอกสารที่อ้างถึง"
              src={`${previewUrl}#view=FitH`}
              className="h-[60vh] min-h-[420px] w-full rounded-xl border border-slate-200 bg-slate-50"
            />
          ) : (
            <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 text-center text-sm text-slate-400">
              <Icon name="file" className="h-8 w-8 text-slate-300" />
              ไม่มีไฟล์หนังสือให้แสดง — กด “เปิดเอกสารเต็ม” เพื่อดูรายละเอียด
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
