import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ememoApi, STATUS_META, APPROVAL_META, formatThaiDate } from '../../lib/ememo.js';
import SubmitApprovalModal from './SubmitApprovalModal.jsx';
import EditDocumentModal from './EditDocumentModal.jsx';
import Icon from '../../components/Icon.jsx';

function Row({ label, children }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <div className="w-28 shrink-0 text-slate-500">{label}</div>
      <div className="text-slate-800 font-medium">{children}</div>
    </div>
  );
}

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const load = useCallback(() => {
    ememoApi.getDocument(id).then((r) => setDoc(r.data)).catch((e) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  const cancelDoc = async () => {
    if (!window.confirm('ยกเลิกเอกสารนี้? (กลับคืนไม่ได้)')) return;
    setBusy(true);
    try {
      await ememoApi.cancelDocument(id);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const resendApproval = async () => {
    setBusy(true);
    try {
      const { data } = await ememoApi.resendApproval(id);
      window.alert(`ส่งอีเมลอนุมัติซ้ำไปที่ ${data.to} แล้ว`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const generatePdf = async () => {
    setBusy(true);
    try {
      const { data } = await ememoApi.generatePdf(id);
      // open the freshly generated PDF via the streaming download endpoint
      const url = await ememoApi.attachmentBlobUrl(id, data.id);
      window.open(url, '_blank');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const openAttachment = async (attId) => {
    try {
      const url = await ememoApi.attachmentBlobUrl(id, attId);
      window.open(url, '_blank');
    } catch (e) {
      setError(e.message);
    }
  };

  const uploadFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      await ememoApi.uploadAttachment(id, file);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="bg-red-50 text-red-700 rounded-xl px-4 py-3">{error}</div>;
  if (!doc) return <div className="text-slate-400">กำลังโหลด…</div>;

  const status = STATUS_META[doc.status] || STATUS_META.pending;
  const editable = ['draft', 'pending', 'returned'].includes(doc.status);
  const canSubmit = editable;
  const canCancel = doc.status !== 'approved' && doc.status !== 'cancelled';
  const hasPendingStep = (doc.approval_steps || []).some((s) => s.action === 'pending');
  const canResend = doc.status === 'pending' && hasPendingStep;

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/memos')} className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800">
        <Icon name="arrowLeft" className="h-4 w-4" /> กลับทะเบียนเอกสาร
      </button>

      {/* header card (full width) */}
      <div className="card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-1 rounded-md text-xs font-semibold text-white" style={{ backgroundColor: doc.project_color || '#64748b' }}>{doc.project_code}</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${status.chip}`}>{status.label}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-800">{doc.doc_number}</h2>
            <p className="text-slate-600">{doc.subject}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {editable && (
              <button onClick={() => setShowEdit(true)} disabled={busy} className="btn-outline">
                <Icon name="edit" className="h-4 w-4" /> แก้ไข
              </button>
            )}
            <button onClick={generatePdf} disabled={busy} className="btn-outline">
              <Icon name="file" className="h-4 w-4" /> สร้าง PDF หนังสือ
            </button>
            {canResend && (
              <button onClick={resendApproval} disabled={busy} className="btn-outline">
                <Icon name="undo" className="h-4 w-4" /> ส่งเมลซ้ำ
              </button>
            )}
            {canCancel && (
              <button onClick={cancelDoc} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50">
                <Icon name="x" className="h-4 w-4" /> ยกเลิก
              </button>
            )}
            {canSubmit && (
              <button onClick={() => setShowSubmit(true)} className="btn-primary">
                <Icon name="check" className="h-4 w-4" /> ส่งอนุมัติ
              </button>
            )}
          </div>
        </div>
      </div>

      {/* two-column layout fills the page */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* LEFT: document info + attachments (wider) */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card">
            <h3 className="font-bold text-slate-800 mb-3">ข้อมูลเอกสาร</h3>
            <Row label="วันที่รับ">{formatThaiDate(doc.date_received)}</Row>
            {doc.recipient && <Row label="เรียน">{doc.recipient}</Row>}
            {doc.doc_type_name && <Row label="ประเภท">{doc.doc_type_name}</Row>}
            <Row label="แผนก">{doc.department}</Row>
            {doc.work_unit && <Row label="หน่วยงาน">{doc.work_unit}</Row>}
            {Array.isArray(doc.enclosures) && doc.enclosures.length > 0 && (
              <Row label="สิ่งที่ส่งมาด้วย">
                <span className="font-normal">
                  {doc.enclosures.map((e, i) =>
                    `${i + 1}. ${e.name}${e.qty != null ? ` (${e.qty} ${e.unit || 'ชุด'})` : ''}`
                  ).join('  ·  ')}
                </span>
              </Row>
            )}
            {doc.body && <Row label="เนื้อความ"><span className="font-normal whitespace-pre-wrap">{doc.body}</span></Row>}
            {doc.remarks && <Row label="หมายเหตุ"><span className="font-normal">{doc.remarks}</span></Row>}
          </div>

          {/* document versions: original + approved */}
          <div className="card">
            <h3 className="font-bold text-slate-800 mb-3">เอกสาร</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* ฉบับต้นฉบับ */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Icon name="file" className="h-4 w-4 text-slate-500" /> ฉบับต้นฉบับ
                </div>
                {(() => {
                  const orig = doc.attachments.find((a) => a.version === 'original');
                  return orig ? (
                    <button onClick={() => openAttachment(orig.id)} className="text-blue-600 hover:underline text-sm break-all">{orig.file_name}</button>
                  ) : (
                    <p className="text-xs text-slate-400">ยังไม่มี — กด "สร้าง PDF หนังสือ" ด้านบน</p>
                  );
                })()}
              </div>
              {/* ฉบับอนุมัติ (มีลายเซ็น) */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Icon name="signature" className="h-4 w-4 text-emerald-600" /> ฉบับอนุมัติ (มีลายเซ็น)
                </div>
                {(() => {
                  const appr = doc.attachments.find((a) => a.version === 'approved');
                  return appr ? (
                    <button onClick={() => openAttachment(appr.id)} className="text-emerald-600 hover:underline text-sm break-all">{appr.file_name}</button>
                  ) : (
                    <p className="text-xs text-slate-400">จะถูกสร้างเมื่ออนุมัติครบทุกขั้น</p>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* supplementary files (เอกสารประกอบ) */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800">ไฟล์ประกอบ</h3>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm transition hover:bg-slate-50">
                <Icon name="plus" className="h-4 w-4" /> แนบไฟล์
                <input type="file" className="hidden" onChange={(e) => uploadFile(e.target.files?.[0])} disabled={busy} />
              </label>
            </div>
            {(() => {
              const supp = doc.attachments.filter((a) => a.kind === 'upload');
              return supp.length === 0 ? (
                <p className="text-sm text-slate-400">ยังไม่มีไฟล์ประกอบ</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {supp.map((a) => (
                    <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="flex items-center gap-2">
                        <Icon name="paperclip" className="h-4 w-4 text-slate-400" />
                        <button onClick={() => openAttachment(a.id)} className="text-brand hover:underline">{a.file_name}</button>
                      </span>
                      <span className="text-slate-400 text-xs">{formatThaiDate(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        </div>

        {/* RIGHT: approval chain + audit trail */}
        <div className="space-y-5">
          {doc.approval_steps.length > 0 && (
            <div className="card">
              <h3 className="font-bold text-slate-800 mb-3">สายอนุมัติ</h3>
              <ol className="space-y-3">
                {doc.approval_steps.map((s) => {
                  const m = APPROVAL_META[s.action] || APPROVAL_META.pending;
                  return (
                    <li key={s.id} className="flex items-center gap-3 text-sm">
                      <span className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-semibold text-slate-600">{s.step_no}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-800 truncate">{s.approver_name || s.approver_email}</div>
                        <div className="text-slate-400 text-xs truncate">{s.approver_email}{s.comment ? ` · ${s.comment}` : ''}</div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${m.chip}`}>{m.label}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {doc.audit?.length > 0 && (
            <div className="card">
              <h3 className="font-bold text-slate-800 mb-3">ประวัติการดำเนินการ (Audit Trail)</h3>
              <ul className="space-y-3 text-sm">
                {doc.audit.map((a, i) => (
                  <li key={i} className="flex flex-col">
                    <span className="font-medium text-slate-700">{a.action}</span>
                    <span className="text-slate-500 text-xs">{a.actor_label} · {formatThaiDate(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {showSubmit && (
        <SubmitApprovalModal
          documentId={id}
          onClose={() => setShowSubmit(false)}
          onSubmitted={() => { setShowSubmit(false); load(); }}
        />
      )}

      {showEdit && (
        <EditDocumentModal
          doc={doc}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load(); }}
        />
      )}
    </div>
  );
}
