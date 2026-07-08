import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ememoApi, STATUS_META, APPROVAL_META, formatThaiDate, formatThaiDateTime } from '../../lib/ememo.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import SubmitApprovalModal from './SubmitApprovalModal.jsx';
import EditDocumentModal from './EditDocumentModal.jsx';
import ApprovalActionModal from './ApprovalActionModal.jsx';
import ConsultModal from './ConsultModal.jsx';
import AddDocumentModal from './AddDocumentModal.jsx';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';

/** One compact metadata item (icon + label + value), used in the header card. */
function MetaItem({ icon, label, children, className = '' }) {
  return (
    <div className={`flex min-w-0 items-start gap-2 ${className}`}>
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0 break-words">
        <span className="text-slate-500">{label}: </span>
        <span className="font-medium text-slate-800">{children}</span>
      </div>
    </div>
  );
}

// Thai labels for the audit_log action codes (system activity trail).
const AUDIT_ACTION_TH = {
  created: 'สร้างเอกสาร',
  edited: 'แก้ไขเอกสาร',
  submitted: 'ส่งเข้าสายอนุมัติ',
  approved: 'อนุมัติ',
  rejected: 'ไม่อนุมัติ',
  returned: 'ส่งกลับแก้ไข',
  cancelled: 'ยกเลิกเอกสาร',
  consulted: 'ขอความเห็น',
  forwarded: 'ส่งต่อ',
  resent: 'ส่งอนุมัติซ้ำ',
};

/** Full system activity log for the document (always expanded). */
function AuditTrail({ entries }) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) return null;
  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-500">
        <Icon name="clock" className="h-4 w-4" /> ประวัติการดำเนินการ (Audit Trail)
      </h4>
      <ol className="space-y-2">
        {list.map((a, i) => {
          // `edited` entries carry a before→after change list in detail.changes
          const changes = a.action === 'edited' && Array.isArray(a.detail?.changes) ? a.detail.changes : [];
          const truncate = (s) => (s && s.length > 40 ? `${s.slice(0, 40)}…` : s);
          return (
            <li key={i} className="flex items-start gap-2.5 text-xs">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-slate-700">{AUDIT_ACTION_TH[a.action] || a.action}</span>
                  {a.actor_label && <span className="text-slate-500">โดย {a.actor_label}</span>}
                  <span className="text-slate-400">{formatThaiDateTime(a.created_at)}</span>
                </div>
                {changes.length > 0 && (
                  <ul className="mt-1 space-y-0.5 border-l-2 border-slate-100 pl-2.5">
                    {changes.map((c, j) => (
                      <li key={j} className="text-slate-500">
                        <span className="font-medium text-slate-600">{c.label}:</span>{' '}
                        {c.from
                          ? <><span className="text-rose-500 line-through">{truncate(c.from)}</span> <span className="text-slate-400">→</span> <span className="text-emerald-600">{truncate(c.to) || '(ว่าง)'}</span></>
                          : <span className="text-emerald-600">{truncate(c.to) || '(ว่าง)'}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const toast = useToast();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  // "สร้างจากใบนี้" (duplicate) — loads reference data, then opens AddDocumentModal
  const [dupData, setDupData] = useState(null); // { projects, docTypes, initial }
  const [dupLoading, setDupLoading] = useState(false);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewAttId, setPreviewAttId] = useState(null);

  // message composer
  const [msgText, setMsgText] = useState('');
  const [msgFile, setMsgFile] = useState(null);
  const [posting, setPosting] = useState(false);

  // is the logged-in user the current pending approver?
  const [myApproval, setMyApproval] = useState({ canApprove: false });
  const [approvalAction, setApprovalAction] = useState(null); // 'approved'|'returned'|'rejected' → opens the modal
  const [showConsult, setShowConsult] = useState(false);

  const load = useCallback(() => {
    ememoApi.getDocument(id).then((r) => setDoc(r.data)).catch((e) => setError(e.message));
    ememoApi.myApproval(id).then((r) => setMyApproval(r.data)).catch(() => setMyApproval({ canApprove: false }));
  }, [id]);

  useEffect(load, [load]);

  // confirmed from ApprovalActionModal (comment already validated there)
  const confirmApproval = async (comment) => {
    const done = { approved: 'อนุมัติเอกสารเรียบร้อย', returned: 'ส่งกลับให้แก้ไขแล้ว', rejected: 'ไม่อนุมัติเอกสารแล้ว' };
    await ememoApi.approveDocument(id, approvalAction, comment);
    setApprovalAction(null);
    toast.success(done[approvalAction] || 'ดำเนินการเรียบร้อย');
    load();
  };

  // confirmed from ConsultModal — ask someone for an opinion (not approval)
  const confirmConsult = async ({ email, name, question }) => {
    await ememoApi.consultDocument(id, email, name, question);
    setShowConsult(false);
    toast.success(`ส่งขอความเห็นถึง ${name || email} แล้ว`);
    load();
  };

  // ONE document to show (B2): the combined file if attachments were merged in,
  // else the letter itself (the approved/signed version once approved). Extra
  // uploaded files appear as their own labelled tabs (B3).
  const previewables = doc ? (() => {
    const combined = doc.attachments.find((a) => a.kind === 'combined_pdf');
    const letter =
      doc.attachments.find((a) => a.version === 'approved') ||
      doc.attachments.find((a) => a.version === 'original');
    const primary = combined || letter;
    const inlineKinds = doc.attachments.filter(
      (a) => (a.kind === 'upload') && /^(application\/pdf|image\/)/.test(a.content_type || '')
    );
    const list = [];
    if (primary) list.push({ id: primary.id, label: 'เอกสาร', isLetter: true, contentType: primary.content_type });
    // number the supplementary files so it's clear which is attachment #1, #2… (#2)
    inlineKinds.forEach((a, i) => list.push({ id: a.id, label: `ไฟล์แนบ #${i + 1}: ${a.file_name}`, isLetter: false, contentType: a.content_type }));
    return list;
  })() : [];

  const activePreviewId = (previewAttId && previewables.some((p) => p.id === previewAttId))
    ? previewAttId
    : previewables[0]?.id || null;
  const activePreview = previewables.find((p) => p.id === activePreviewId) || null;
  const activeIsImage = /^image\//.test(activePreview?.contentType || '');

  useEffect(() => {
    if (!activePreviewId) { setPreviewUrl(null); return; }
    let url; let cancelled = false;
    ememoApi.attachmentBlobUrl(id, activePreviewId)
      .then((u) => { if (cancelled) { URL.revokeObjectURL(u); return; } url = u; setPreviewUrl(u); })
      .catch(() => !cancelled && setPreviewUrl(null));
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [activePreviewId, id]);

  const cancelDoc = async () => {
    if (!window.confirm('ยกเลิกเอกสารนี้? (กลับคืนไม่ได้)')) return;
    setBusy(true);
    try { await ememoApi.cancelDocument(id); toast.success('ยกเลิกเอกสารแล้ว'); load(); }
    catch (e) { setError(e.message); toast.error(e.message); } finally { setBusy(false); }
  };

  // "สร้างจากใบนี้" — copy all fields + uploaded attachments into a new draft.
  // Loads projects/doc-types (AddDocumentModal needs them), then opens the modal
  // prefilled. Running number, status, signatures and history are NOT copied.
  const duplicateDoc = async () => {
    setDupLoading(true); setError(null);
    try {
      const [p, t] = await Promise.all([ememoApi.listProjects(), ememoApi.listDocumentTypes()]);
      const copyAttachments = (doc.attachments || []).filter((a) => a.kind === 'upload');
      setDupData({
        projects: p.data,
        docTypes: t.data,
        initial: {
          project_id: doc.project_id, company_id: doc.company_id, doc_code: doc.doc_code,
          doc_type_id: doc.doc_type_id, subject: doc.subject, recipient: doc.recipient,
          reference: doc.reference, reference_doc_id: doc.reference_doc_id, cc_recipients: doc.cc_recipients, body: doc.body,
          remarks: doc.remarks, signer_name: doc.signer_name, signer_title: doc.signer_title,
          enclosures: doc.enclosures, sourceId: id, copyAttachments,
        },
      });
    } catch (e) { setError(e.message); toast.error(e.message); }
    finally { setDupLoading(false); }
  };

  // fallback: (re)generate the letter PDF if one somehow doesn't exist yet.
  // Normally the PDF + combined file are produced automatically on create/edit.
  const generatePdf = async () => {
    setBusy(true); setError(null);
    try { await ememoApi.generatePdf(id); load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const openAttachment = async (attId) => {
    try { const url = await ememoApi.attachmentBlobUrl(id, attId); window.open(url, '_blank'); }
    catch (e) { setError(e.message); }
  };

  // post a message (+ optional attached file) to the conversation thread
  const postMessage = async () => {
    if (!msgText.trim()) return;
    setPosting(true); setError(null);
    try {
      const { data } = await ememoApi.postMessage(id, msgText.trim());
      if (msgFile) await ememoApi.attachMessageFile(id, data.id, msgFile);
      setMsgText(''); setMsgFile(null);
      load();
    } catch (e) { setError(e.message); toast.error(e.message); } finally { setPosting(false); }
  };

  if (error) return <div className="bg-red-50 text-red-700 rounded-xl px-4 py-3">{error}</div>;
  if (!doc) return <div className="flex justify-center py-16"><Spinner label="กำลังโหลด…" /></div>;

  const status = STATUS_META[doc.status] || STATUS_META.pending;
  // journey-aware permissions: only the owner (or admin) manages the document,
  // and only actions valid for the current status are shown.
  const isOwner = doc.created_by && doc.created_by === profile?.id;
  const isAdmin = profile?.role === 'admin';
  const canManage = isOwner || isAdmin;
  const notSubmitted = ['draft', 'returned'].includes(doc.status); // owner can still edit + send
  const isPending = doc.status === 'pending';
  const me = profile?.full_name || user?.email || 'ฉัน';

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/memos')} className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800">
        <Icon name="arrowLeft" className="h-4 w-4" /> กลับทะเบียนเอกสาร
      </button>

      {/* Status banner for the current approver — informs, doesn't act. The
          actual action buttons live in the header card below (one place). */}
      {myApproval.canApprove && (
        <div className="flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand-tint px-5 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
            <Icon name="check" className="h-5 w-5" />
          </span>
          <div>
            <div className="text-sm font-bold text-slate-900">เอกสารนี้รอการอนุมัติจากคุณ</div>
            <p className="text-xs text-slate-600">ตรวจเอกสารด้านล่าง แล้วเลือกดำเนินการที่ปุ่มมุมขวาบน</p>
          </div>
        </div>
      )}

      {/* header card — title (left) · meta (middle) · actions (right), all top-aligned */}
      <div className={`card ${myApproval.canApprove ? 'ring-2 ring-brand/20' : ''}`}>
        <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
          {/* LEFT: identity */}
          <div className="min-w-[240px]">
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-md px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: doc.project_color || '#64748b' }}>{doc.project_code}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.chip}`}>{status.label}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-800">{doc.doc_number}</h2>
            <p className="text-slate-600">{doc.subject}</p>
          </div>

          {/* MIDDLE: document meta — always level with the title (independent of actions) */}
          <div className="grid min-w-[240px] flex-1 grid-cols-1 gap-x-6 gap-y-1.5 pt-0.5 text-sm sm:grid-cols-2">
            <MetaItem icon="calendar" label="วันที่รับ">{formatThaiDate(doc.date_received)}</MetaItem>
            <MetaItem icon="building" label="แผนก">{doc.department}</MetaItem>
            {doc.recipient && <MetaItem icon="inbox" label="เรียน">{doc.recipient}</MetaItem>}
            {doc.doc_type_name && <MetaItem icon="layers" label="ประเภท">{doc.doc_type_name}</MetaItem>}
            {doc.reference && (
              <MetaItem icon="file" label="อ้างถึง">
                {doc.reference_doc ? (
                  <button
                    onClick={() => navigate(`/memos/${doc.reference_doc.id}`)}
                    className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
                    title="เปิดเอกสารที่อ้างถึง"
                  >
                    {doc.reference}
                    <Icon name="arrowRight" className="h-3.5 w-3.5" />
                  </button>
                ) : doc.reference}
              </MetaItem>
            )}
            {doc.cc_recipients && <MetaItem icon="people" label="สำเนาเรียน">{doc.cc_recipients}</MetaItem>}
            {Array.isArray(doc.enclosures) && doc.enclosures.length > 0 && (
              <MetaItem icon="paperclip" label="สิ่งที่ส่งมาด้วย" className="sm:col-span-2">
                {doc.enclosures.map((e, i) => `${i + 1}. ${e.name}${e.qty != null ? ` (${e.qty} ${e.unit || 'ชุด'})` : ''}`).join('  ·  ')}
              </MetaItem>
            )}
            {doc.remarks && <MetaItem icon="edit" label="หมายเหตุ" className="sm:col-span-2">{doc.remarks}</MetaItem>}
          </div>

          {/* RIGHT: actions (only when there are any, so the row doesn't get skewed) */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* APPROVER actions — solid, semantic colors; click opens a confirm/reason modal */}
            {myApproval.canApprove && (
              <>
                <button onClick={() => setShowConsult(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-light">
                  <Icon name="chat" className="h-4 w-4" /> ขอความเห็น
                </button>
                <button onClick={() => setApprovalAction('rejected')} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700">
                  <Icon name="x" className="h-4 w-4" /> ไม่อนุมัติ
                </button>
                <button onClick={() => setApprovalAction('approved')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700">
                  <Icon name="check" className="h-5 w-5" /> อนุมัติ
                </button>
              </>
            )}

            {/* OWNER/ADMIN actions — scoped to status */}
            {canManage && notSubmitted && (
              <button onClick={() => setShowEdit(true)} disabled={busy} className="btn-outline">
                <Icon name="edit" className="h-4 w-4" /> แก้ไข
              </button>
            )}
            {canManage && (notSubmitted || isPending) && (
              <button onClick={cancelDoc} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50">
                <Icon name="x" className="h-4 w-4" /> ยกเลิก
              </button>
            )}
            {canManage && notSubmitted && (
              <button onClick={() => setShowSubmit(true)} className="btn-primary">
                <Icon name="check" className="h-4 w-4" /> ส่งอนุมัติ
              </button>
            )}

            {/* create a new document from this one (copy fields + attachments) */}
            <button onClick={duplicateDoc} disabled={dupLoading} className="btn-outline">
              <Icon name="layers" className="h-4 w-4" /> {dupLoading ? 'กำลังเตรียม…' : 'สร้างจากใบนี้'}
            </button>

            {/* public verification page (same as scanning the PDF's QR) */}
            {doc.verify_token && (
              <a href={`/verify/${doc.verify_token}`} target="_blank" rel="noreferrer" className="btn-outline">
                <Icon name="eye" className="h-4 w-4" /> ตรวจสอบ (QR)
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-5">
        {/* LEFT: document preview */}
        <div className="lg:col-span-3 lg:sticky lg:top-20">
          <div className="card !p-3">
            <div className="mb-2 flex items-center justify-between px-2 pt-1">
              <h3 className="font-bold text-slate-800">เอกสาร</h3>
              {previewUrl && (
                <button onClick={() => window.open(previewUrl, '_blank')} className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline">
                  <Icon name="eye" className="h-4 w-4" /> เปิดเต็มจอ
                </button>
              )}
            </div>
            {previewables.length > 1 && (
              <div className="mb-2 flex flex-wrap gap-1.5 px-2">
                {previewables.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPreviewAttId(p.id)}
                    className={`inline-flex max-w-[220px] items-center gap-1.5 truncate rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      p.id === activePreviewId ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    title={p.label}
                  >
                    <Icon name={p.isLetter ? 'file' : 'paperclip'} className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{p.label}</span>
                  </button>
                ))}
              </div>
            )}
            {previewUrl ? (
              activeIsImage ? (
                // images: fit to the panel width so they don't open zoomed-in (#1)
                <div className="h-[calc(100vh-220px)] min-h-[560px] w-full overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <img src={previewUrl} alt="ไฟล์แนบ" className="mx-auto h-auto max-w-full" />
                </div>
              ) : (
                <iframe
                  title="เอกสาร"
                  // #view=FitH tells the PDF viewer to fit page width (no over-zoom) (#1)
                  src={`${previewUrl}#view=FitH`}
                  className="h-[calc(100vh-220px)] min-h-[560px] w-full rounded-xl border border-slate-200 bg-slate-50"
                />
              )
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

        {/* RIGHT: conversation + audit trail (info moved into the header card) */}
        <div className="space-y-5 lg:col-span-2">
          {/* ── บันทึก: approval chain + messages merged as a timeline ── */}
          <div className="card">
            <h3 className="mb-4 font-bold text-slate-800">บันทึก</h3>

            <Timeline doc={doc} openAttachment={openAttachment} />

            {/* composer */}
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <textarea
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                rows={2}
                placeholder="เขียนข้อความ / บันทึก / สอบถาม…"
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-500 hover:text-brand">
                  <Icon name="paperclip" className="h-4 w-4" />
                  {msgFile ? <span className="max-w-[160px] truncate">{msgFile.name}</span> : 'แนบไฟล์'}
                  <input type="file" className="hidden" onChange={(e) => setMsgFile(e.target.files?.[0] || null)} />
                </label>
                <div className="flex items-center gap-2">
                  {msgFile && <button onClick={() => setMsgFile(null)} className="text-xs text-slate-400 hover:text-red-600">ลบไฟล์</button>}
                  <button onClick={postMessage} disabled={posting || !msgText.trim()} className="btn-primary px-3 py-1.5 text-xs">
                    {posting ? 'กำลังส่ง…' : 'ส่งข้อความ'}
                  </button>
                </div>
              </div>
            </div>

            {/* Audit Trail — full system activity log, always expanded */}
            <AuditTrail entries={doc.audit} />
          </div>
        </div>
      </div>

      {dupData && (
        <AddDocumentModal
          projects={dupData.projects}
          docTypes={dupData.docTypes}
          initial={dupData.initial}
          onClose={() => setDupData(null)}
          onCreated={(newId) => {
            setDupData(null);
            toast.success('สร้างเอกสารจากใบเดิมแล้ว');
            if (newId) navigate(`/memos/${newId}`);
          }}
        />
      )}

      {showSubmit && (
        <SubmitApprovalModal
          documentId={id}
          docCode={doc.doc_code}
          onClose={() => setShowSubmit(false)}
          onSubmitted={() => { setShowSubmit(false); toast.success('ส่งเข้าสายอนุมัติแล้ว'); load(); }}
        />
      )}

      {showEdit && (
        <EditDocumentModal
          doc={doc}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); toast.success('บันทึกการแก้ไขแล้ว'); load(); }}
        />
      )}

      {approvalAction && (
        <ApprovalActionModal
          action={approvalAction}
          onClose={() => setApprovalAction(null)}
          onConfirm={confirmApproval}
        />
      )}

      {showConsult && (
        <ConsultModal onClose={() => setShowConsult(false)} onConfirm={confirmConsult} />
      )}
    </div>
  );
}

/**
 * Merged timeline: approval-chain steps + conversation messages, ordered by time.
 * Approval steps that are still pending anchor at their queue position; acted
 * steps and messages sort by their timestamp.
 */
function Timeline({ doc, openAttachment }) {
  const steps = doc.approval_steps || [];
  const messages = doc.messages || [];
  const currentIdx = steps.findIndex((s) => s.action === 'pending');

  // build a unified, time-sorted event list
  const events = [];
  steps.forEach((s, i) => {
    events.push({
      kind: 'step', id: `s-${s.id}`, step: s, i,
      isCurrent: i === currentIdx,
      at: s.acted_at ? new Date(s.acted_at).getTime() : Number.MAX_SAFE_INTEGER - (steps.length - i),
    });
  });
  messages.forEach((m) => {
    events.push({ kind: 'msg', id: `m-${m.id}`, msg: m, at: m.created_at ? new Date(m.created_at).getTime() : 0 });
  });
  events.sort((a, b) => a.at - b.at);

  if (events.length === 0) {
    return <p className="text-sm text-slate-500">ยังไม่มีการพิจารณาหรือข้อความ — เริ่มการสนทนาด้านล่างได้เลย</p>;
  }

  return (
    <ol className="relative space-y-4">
      {events.map((ev) => {
        if (ev.kind === 'step') {
          const s = ev.step;
          const m = APPROVAL_META[s.action] || APPROVAL_META.pending;
          const isDone = s.action !== 'pending';
          const isWaiting = s.action === 'pending' && !ev.isCurrent;
          const circle = isDone
            ? (s.action === 'approved' ? 'bg-emerald-500 text-white' : s.action === 'rejected' ? 'bg-rose-500 text-white' : 'bg-orange-500 text-white')
            : ev.isCurrent ? 'bg-brand text-white ring-4 ring-brand/15'
            : 'bg-white/10 text-slate-500';
          const icon = s.action === 'approved' ? 'check' : s.action === 'rejected' ? 'x' : s.action === 'returned' ? 'undo' : null;
          return (
            <li key={ev.id} className="relative flex gap-3 text-sm">
              <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${circle}`}>
                {icon ? <Icon name={icon} className="h-4 w-4" strokeWidth={2.4} /> : s.step_no}
              </span>
              <div className="min-w-0 flex-1">
                <div className={`flex flex-wrap items-center gap-2 font-medium ${isWaiting ? 'text-slate-400' : 'text-slate-800'}`}>
                  <span className="truncate">{s.approver_name || s.approver_email}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${m.chip}`}>{isWaiting ? 'รอลำดับ' : ev.isCurrent ? 'กำลังพิจารณา' : m.label}</span>
                  {s.acted_at && <span className="text-[11px] text-slate-500">{formatThaiDateTime(s.acted_at)}</span>}
                </div>
                <div className="truncate text-xs text-slate-500">{s.approver_email}</div>
                {s.comment && <div className="mt-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600">{s.comment}</div>}
              </div>
            </li>
          );
        }
        // message — 'consult' rows (ขอความเห็น) get a distinct blue accent
        const m = ev.msg;
        const isConsult = m.kind === 'consult';
        return (
          <li key={ev.id} className="relative flex gap-3 text-sm">
            <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isConsult ? 'bg-brand-tint text-brand' : 'bg-slate-100 text-slate-500'}`}>
              <Icon name="chat" className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-800">{m.author_name || m.author_label || 'ผู้ใช้'}</span>
                {isConsult && <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[10px] font-semibold text-brand">ขอความเห็น</span>}
                <span className="text-[11px] text-slate-500">{formatThaiDateTime(m.created_at)}</span>
              </div>
              <div className={`mt-1 whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${isConsult ? 'border border-brand-border bg-brand-tint text-slate-700' : 'bg-slate-100 text-slate-700'}`}>{m.body}</div>
              {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {m.attachments.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => openAttachment(a.id)}
                      className="flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
                    >
                      <Icon name="eye" className="h-3.5 w-3.5 shrink-0" />
                      <span className="max-w-[220px] truncate">เปิดดูเอกสาร: {a.file_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
