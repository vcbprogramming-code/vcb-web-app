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

  const [previewUrl, setPreviewUrl] = useState(null);

  const load = useCallback(() => {
    ememoApi.getDocument(id).then((r) => setDoc(r.data)).catch((e) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  // Inline preview: load the generated letterhead PDF (approved version if it
  // exists, else the original) into an object URL for the embedded viewer.
  useEffect(() => {
    if (!doc) return;
    const pdf =
      doc.attachments.find((a) => a.version === 'approved') ||
      doc.attachments.find((a) => a.version === 'original');
    if (!pdf) {
      setPreviewUrl(null);
      return;
    }
    let url;
    let cancelled = false;
    ememoApi
      .attachmentBlobUrl(id, pdf.id)
      .then((u) => {
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        url = u;
        setPreviewUrl(u);
      })
      .catch(() => !cancelled && setPreviewUrl(null));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc, id]);

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
    setError(null);
    try {
      await ememoApi.generatePdf(id);
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

      {/* two-column layout: big document (left) · all info (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
        {/* LEFT: the document itself, large */}
        <div className="lg:col-span-3 lg:sticky lg:top-20">
          <div className="card !p-3">
            <div className="mb-2 flex items-center justify-between px-2 pt-1">
              <h3 className="font-bold text-slate-800">ตัวอย่างเอกสาร</h3>
              {previewUrl && (
                <button onClick={() => window.open(previewUrl, '_blank')} className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline">
                  <Icon name="eye" className="h-4 w-4" /> เปิดเต็มจอ
                </button>
              )}
            </div>
            {previewUrl ? (
              <iframe
                title="ตัวอย่างเอกสาร"
                src={previewUrl}
                className="h-[calc(100vh-220px)] min-h-[560px] w-full rounded-xl border border-slate-200 bg-slate-50"
              />
            ) : (
              <div className="flex h-[560px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 text-center">
                <Icon name="file" className="h-10 w-10 text-slate-300" />
                <p className="text-sm text-slate-400">ยังไม่มีไฟล์หนังสือสำหรับเอกสารนี้</p>
                <button onClick={generatePdf} disabled={busy} className="btn-primary">
                  <Icon name="file" className="h-4 w-4" /> {busy ? 'กำลังสร้าง…' : 'สร้างไฟล์หนังสือ'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: all information stacked */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card">
            <h3 className="font-bold text-slate-800 mb-3">ข้อมูลเอกสาร</h3>
            <Row label="วันที่รับ">{formatThaiDate(doc.date_received)}</Row>
            {doc.recipient && <Row label="เรียน">{doc.recipient}</Row>}
            {doc.reference && <Row label="อ้างถึง">{doc.reference}</Row>}
            {doc.cc_recipients && <Row label="สำเนาเรียน">{doc.cc_recipients}</Row>}
            {doc.doc_type_name && <Row label="ประเภท">{doc.doc_type_name}</Row>}
            <Row label="แผนก">{doc.department}</Row>            {Array.isArray(doc.enclosures) && doc.enclosures.length > 0 && (
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
            <h3 className="font-bold text-slate-800 mb-3">ไฟล์เอกสาร</h3>
            <div className="grid grid-cols-1 gap-3">
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
                    <p className="text-xs text-slate-400">ยังไม่มีไฟล์ — กด "แก้ไข" แล้วบันทึกเพื่อสร้าง</p>
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

          {/* approval chain */}
          {doc.approval_steps.length > 0 && (
            <div className="card">
              <h3 className="font-bold text-slate-800 mb-3">สายอนุมัติ (ตามลำดับ)</h3>
              <ol className="relative space-y-1">
                {(() => {
                  // the current step = first one still pending (the live queue position)
                  const currentIdx = doc.approval_steps.findIndex((s) => s.action === 'pending');
                  return doc.approval_steps.map((s, i) => {
                    const m = APPROVAL_META[s.action] || APPROVAL_META.pending;
                    const isCurrent = i === currentIdx;
                    const isDone = s.action !== 'pending';
                    const isWaiting = s.action === 'pending' && !isCurrent;
                    const last = i === doc.approval_steps.length - 1;

                    const circle = isDone
                      ? (s.action === 'approved' ? 'bg-emerald-500 text-white' : s.action === 'rejected' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white')
                      : isCurrent ? 'bg-brand text-white ring-4 ring-brand/15'
                      : 'bg-slate-100 text-slate-400';
                    const icon = s.action === 'approved' ? 'check' : s.action === 'rejected' ? 'x' : s.action === 'returned' ? 'undo' : null;

                    return (
                      <li key={s.id} className="relative flex gap-3 pb-4 text-sm last:pb-0">
                        {/* connector line */}
                        {!last && <span className="absolute left-[13px] top-7 h-full w-px bg-slate-200" />}
                        <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${circle}`}>
                          {icon ? <Icon name={icon} className="h-4 w-4" strokeWidth={2.4} /> : s.step_no}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className={`flex items-center gap-2 font-medium ${isWaiting ? 'text-slate-400' : 'text-slate-800'}`}>
                            <span className="truncate">{s.approver_name || s.approver_email}</span>
                            {isCurrent && <span className="shrink-0 rounded-full bg-brand-tint px-2 py-0.5 text-[10px] font-semibold text-brand">กำลังพิจารณา</span>}
                          </div>
                          <div className="truncate text-xs text-slate-400">{s.approver_email}{s.comment ? ` · ${s.comment}` : ''}</div>
                        </div>
                        <span className={`h-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${m.chip}`}>{isWaiting ? 'รอลำดับ' : m.label}</span>
                      </li>
                    );
                  });
                })()}
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
          docCode={doc.doc_code}
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
