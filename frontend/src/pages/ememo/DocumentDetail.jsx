import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ememoApi, STATUS_META, APPROVAL_META, formatThaiDate, formatThaiDateTime } from '../../lib/ememo.js';
import { compressImage } from '../../lib/imageCompress.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import SubmitApprovalModal from './SubmitApprovalModal.jsx';
import EditDocumentModal from './EditDocumentModal.jsx';
import ApprovalActionModal from './ApprovalActionModal.jsx';
import ConsultModal from './ConsultModal.jsx';
import AddDocumentModal from './AddDocumentModal.jsx';
import ReferenceModal from './ReferenceModal.jsx';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';

/** .xlsx attachment → previewable as a table (parsed server-side). */
const isSheet = (a) =>
  /spreadsheetml|officedocument\.spreadsheet/i.test(a.content_type || '') ||
  /\.xlsx$/i.test(a.file_name || '');

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
  email_failed: 'ส่งอีเมลแจ้งผู้อนุมัติไม่สำเร็จ',
};

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const composerRef = useRef(null);
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
  const [canceling, setCanceling] = useState(false); // ยกเลิกเอกสาร in flight
  const [attBusy, setAttBusy] = useState(null); // attachment id whose blob is being fetched (open/download)
  const [refPreviewId, setRefPreviewId] = useState(null); // อ้างถึง preview modal (#6)

  // is the logged-in user the current pending approver?
  const [myApproval, setMyApproval] = useState({ canApprove: false });
  const [approvalAction, setApprovalAction] = useState(null); // 'approved'|'returned'|'rejected' → opens the modal
  const [showConsult, setShowConsult] = useState(false);
  // after acting, a persistent "what happened + next" state so the approver gets
  // closure and a path to their next pending item (not just a fleeting toast).
  const [postAction, setPostAction] = useState(null); // { action, next: {id,doc_number}|null, count }

  const load = useCallback(() => {
    ememoApi.getDocument(id).then((r) => setDoc(r.data)).catch((e) => setError(e.message));
    ememoApi.myApproval(id).then((r) => setMyApproval(r.data)).catch(() => setMyApproval({ canApprove: false }));
  }, [id]);

  useEffect(load, [load]);

  // The combined "one file" PDF is built in the background (a few seconds after
  // create/edit), so a freshly-opened document may still show only the letter.
  // Auto-refetch until the combined file appears, so the user doesn't have to
  // refresh manually. `combinePending` = there are mergeable uploads but no
  // combined file yet.
  const combinePollRef = useRef(0);
  const combinePending = doc
    ? (doc.attachments || []).some((a) => a.kind === 'upload'
        && (/^(application\/pdf|image\/)/.test(a.content_type || '') || isSheet(a)))
      && !(doc.attachments || []).some((a) => a.kind === 'combined_pdf')
    : false;
  useEffect(() => {
    if (!doc) return undefined;
    if (!combinePending) { combinePollRef.current = 0; return undefined; }
    if (combinePollRef.current >= 6) return undefined; // give up after ~21s
    combinePollRef.current += 1;
    const t = setTimeout(load, 3500);
    return () => clearTimeout(t);
  }, [doc, combinePending, load]);

  // confirmed from ApprovalActionModal (comment already validated there)
  const confirmApproval = async (comment) => {
    const done = { approved: 'อนุมัติเอกสารเรียบร้อย', returned: 'ส่งกลับให้แก้ไขแล้ว', rejected: 'ไม่อนุมัติเอกสารแล้ว' };
    const acted = approvalAction;
    const res = await ememoApi.approveDocument(id, acted, comment);
    setApprovalAction(null);
    toast.success(done[acted] || 'ดำเนินการเรียบร้อย');
    // closure + next step: pull the caller's remaining awaiting-me queue
    try {
      const r = await ememoApi.awaitingMe();
      const next = (r.data?.items || []).find((x) => x.id !== id) || null;
      setPostAction({ action: acted, finalized: res?.data?.finalized, advanced: res?.data?.advanced, next, count: r.data?.count || 0 });
    } catch { setPostAction({ action: acted, next: null, count: 0 }); }
    load();
  };

  // confirmed from ConsultModal — ask someone for an opinion (not approval)
  const confirmConsult = async ({ email, name, question }) => {
    await ememoApi.consultDocument(id, email, name, question);
    setShowConsult(false);
    toast.success(`ส่งขอความเห็นถึง ${name || email} แล้ว`);
    load();
  };

  // The "เอกสาร" section shows ONLY the memo/letter itself (the approved/signed
  // version once approved, else the original) — NOT the combined file (client #8:
  // "แสดงแค่บันทึกข้อความก็พอ"). Extra uploaded PDFs/images appear as their own
  // labelled tabs (B3). Excel is download-only (client #7).
  const previewables = doc ? (() => {
    const letter =
      doc.attachments.find((a) => a.version === 'approved') ||
      doc.attachments.find((a) => a.version === 'original');
    const inlineKinds = doc.attachments.filter(
      (a) => (a.kind === 'upload') && /^(application\/pdf|image\/)/.test(a.content_type || '')
    );
    const list = [];
    if (letter) list.push({ id: letter.id, label: 'เอกสาร', isLetter: true, contentType: letter.content_type });
    // number the supplementary files so it's clear which is attachment #1, #2… (#2)
    inlineKinds.forEach((a, i) => list.push({ id: a.id, label: `ไฟล์แนบ #${i + 1}: ${a.file_name}`, isLetter: false, contentType: a.content_type, fileName: a.file_name }));
    return list;
  })() : [];

  // Uploads that can't be shown inline (Word, zip, csv…) AND all spreadsheets
  // (Excel is download-only per client #7 — rendering the table inline is
  // redundant with the attached file) — listed as downloads so nothing is hidden.
  const otherFiles = doc ? doc.attachments.filter(
    (a) => a.kind === 'upload' && (isSheet(a) || !/^(application\/pdf|image\/)/.test(a.content_type || ''))
  ) : [];
  const fmtSize = (b) => (b == null ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`);

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
    const ok = await confirm({ title: 'ยกเลิกเอกสาร', message: 'ยกเลิกเอกสารนี้?\nเอกสารจะไม่เดินในสายอนุมัติต่อ และกลับคืนไม่ได้', confirmLabel: 'ยกเลิกเอกสาร' });
    if (!ok) return;
    setCanceling(true);
    try { await ememoApi.cancelDocument(id); toast.success('ยกเลิกเอกสารแล้ว'); load(); }
    catch (e) { setError(e.message); toast.error(e.message); } finally { setCanceling(false); }
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
    // Open the tab synchronously inside the click gesture, THEN point it at the
    // blob once fetched — otherwise the post-await window.open is blocked by
    // popup blockers (Safari/Firefox) and the file silently never opens.
    const win = window.open('', '_blank');
    setAttBusy(attId);
    try {
      const url = await ememoApi.attachmentBlobUrl(id, attId);
      if (win) win.location = url; else window.open(url, '_blank');
      // revoke once the new tab has had time to load the blob (else it leaks for the session)
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) { if (win) win.close(); setError(e.message); toast.error(e.message); }
    finally { setAttBusy(null); }
  };

  // Download a non-previewable file (Excel/Word/…) keeping its real filename.
  const downloadAttachment = async (attId, fileName) => {
    setAttBusy(attId);
    try {
      const url = await ememoApi.attachmentBlobUrl(id, attId);
      const a = document.createElement('a');
      a.href = url; a.download = fileName || 'download';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) { setError(e.message); toast.error(e.message); }
    finally { setAttBusy(null); }
  };

  // post a message (+ optional attached file) to the conversation thread.
  // A file-only message is allowed (#7): when there's no text, use the file name
  // as the body so the thread bubble isn't blank (backend requires a body).
  const postMessage = async () => {
    if (!msgText.trim() && !msgFile) return;
    setPosting(true); setError(null);
    try {
      const body = msgText.trim() || `แนบไฟล์: ${msgFile.name}`;
      const { data } = await ememoApi.postMessage(id, body);
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
  // owner can still edit + (re)send: a rejected doc may be corrected & resubmitted (#11)
  const notSubmitted = ['draft', 'returned', 'rejected'].includes(doc.status);
  const isResubmit = ['returned', 'rejected'].includes(doc.status); // resubmission needs a reason
  const isPending = doc.status === 'pending';
  const me = profile?.full_name || user?.email || 'ฉัน';

  // consulted-user cue: is there an open "ขอความเห็น" addressed to me?
  const myEmail = (profile?.email || '').toLowerCase();
  const consultForMe = !myApproval.canApprove && (doc.messages || []).some(
    (m) => m.kind === 'consult' && (m.consult_email || '').toLowerCase() === myEmail
  );
  // owner-facing "why it came back" banner + reason
  const steps = doc.approval_steps || [];
  const lastDecision = [...steps].reverse().find((s) => s.action === 'returned' || s.action === 'rejected');
  const showOwnerReturnBanner = canManage && (doc.status === 'returned' || doc.status === 'rejected');
  // for the approve modal: who's next / is this the final step?
  const curIdx = steps.findIndex((s) => s.action === 'pending');
  const nextApproverName = curIdx >= 0 && steps[curIdx + 1] ? (steps[curIdx + 1].approver_name || steps[curIdx + 1].approver_email) : null;
  const isFinalStep = curIdx >= 0 && !steps[curIdx + 1];
  const scrollToComposer = () => { composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); composerRef.current?.querySelector('textarea')?.focus(); };

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/memos')} className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800">
        <Icon name="arrowLeft" className="h-4 w-4" /> กลับทะเบียนเอกสาร
      </button>

      {/* After acting: a concise closure card confirming the outcome (#12). */}
      {postAction && (
        <div className={`flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-4 ${postAction.action === 'approved' ? 'border-emerald-200 bg-emerald-50' : postAction.action === 'rejected' ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white ${postAction.action === 'approved' ? 'bg-emerald-500' : postAction.action === 'rejected' ? 'bg-rose-500' : 'bg-amber-500'}`}>
            <Icon name={postAction.action === 'approved' ? 'check' : postAction.action === 'rejected' ? 'x' : 'undo'} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-slate-900">
              {postAction.action === 'approved'
                ? (postAction.finalized ? 'อนุมัติเอกสารเรียบร้อยแล้ว' : 'บันทึกการอนุมัติของคุณแล้ว — ส่งต่อผู้อนุมัติลำดับถัดไป')
                : postAction.action === 'rejected' ? 'บันทึกการไม่อนุมัติเรียบร้อยแล้ว'
                : 'ส่งกลับให้ผู้จัดทำแก้ไขแล้ว'}
            </div>
            <p className="text-xs text-slate-600">ระบบบันทึกผลการพิจารณาของคุณเรียบร้อยแล้ว</p>
          </div>
          <button onClick={() => navigate('/memos')} className="btn-outline shrink-0">กลับทะเบียนเอกสาร</button>
        </div>
      )}

      {/* Owner cue when the document came back — surfaces the reason + edit path */}
      {showOwnerReturnBanner && !postAction && (
        <div className={`rounded-2xl border px-5 py-4 ${doc.status === 'returned' ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50'}`}>
          <div className="flex items-start gap-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white ${doc.status === 'returned' ? 'bg-amber-500' : 'bg-rose-500'}`}>
              <Icon name={doc.status === 'returned' ? 'undo' : 'x'} className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-slate-900">{doc.status === 'returned' ? 'เอกสารนี้ถูกส่งกลับให้แก้ไข' : 'เอกสารนี้ไม่ได้รับการอนุมัติ'}</div>
              {lastDecision?.comment
                ? <p className="mt-0.5 text-sm text-slate-700"><span className="text-slate-500">เหตุผล:</span> {lastDecision.comment}</p>
                : <p className="mt-0.5 text-xs text-slate-500">ไม่ได้ระบุเหตุผล</p>}
              {/* #11: a returned OR rejected doc can be corrected and re-submitted */}
              {notSubmitted && canManage && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button onClick={() => setShowEdit(true)} className="btn-outline !py-1.5 !text-sm"><Icon name="edit" className="h-4 w-4" /> แก้ไขเอกสาร</button>
                  <button onClick={() => setShowSubmit(true)} className="btn-primary !py-1.5 !text-sm"><Icon name="check" className="h-4 w-4" /> แก้ไขแล้วส่งพิจารณาอีกครั้ง</button>
                  <span className="text-xs text-slate-500">— ต้องระบุเหตุผลที่ส่งพิจารณาใหม่</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Consulted-user cue: you were asked for an opinion — reply below */}
      {consultForMe && !postAction && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-brand/30 bg-brand-tint px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
            <Icon name="chat" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-slate-900">คุณถูกขอความเห็นในเอกสารนี้</div>
            <p className="text-xs text-slate-600">ท่านไม่จำเป็นต้องอนุมัติ — เพียงอ่านเอกสารแล้วให้ความเห็นในช่องด้านล่าง</p>
          </div>
          <button onClick={scrollToComposer} className="btn-primary shrink-0"><Icon name="chat" className="h-4 w-4" /> ให้ความเห็น</button>
        </div>
      )}

      {/* Status banner for the current approver — informs, doesn't act. The
          actual action buttons live in the header card below (one place). */}
      {myApproval.canApprove && !postAction && (
        <div className="flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand-tint px-5 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
            <Icon name="check" className="h-5 w-5" />
          </span>
          <div>
            <div className="text-sm font-bold text-slate-900">เอกสารนี้รอการอนุมัติจากคุณ</div>
            <p className="text-xs text-slate-600">ตรวจเอกสารด้านล่าง แล้วเลือกดำเนินการที่ปุ่มด้านบน</p>
            {myApproval.hasSignature === false && (
              <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                <Icon name="warning" className="h-3.5 w-3.5" />
                คุณยังไม่ได้ตั้งค่าลายเซ็น —
                <button onClick={() => navigate('/profile')} className="underline hover:text-amber-800">ตั้งค่าลายเซ็นที่โปรไฟล์</button>
                เพื่อให้ลายเซ็นปรากฏบนเอกสารที่อนุมัติ
              </p>
            )}
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
                    onClick={() => setRefPreviewId(doc.reference_doc.id)}
                    className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
                    title="ดูตัวอย่างเอกสารที่อ้างถึง"
                  >
                    {doc.reference}
                    <Icon name="eye" className="h-3.5 w-3.5" />
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
            {/* APPROVER actions (#13 — ส่งกลับแก้ไข removed; ไม่อนุมัติ now covers
                "send back for edit"). Tooltips clarify each action's meaning. */}
            {myApproval.canApprove && (
              <>
                <button onClick={() => setShowConsult(true)} title="สอบถาม/ขอความเห็นจากผู้อื่นก่อนตัดสินใจ — ยังไม่ใช่การอนุมัติ" className="inline-flex items-center gap-2 rounded-xl border border-brand/40 px-4 py-2.5 text-sm font-medium text-brand transition hover:bg-brand-tint">
                  <Icon name="chat" className="h-4 w-4" /> ขอความเห็น
                </button>
                <button onClick={() => setApprovalAction('rejected')} title="ไม่อนุมัติเอกสาร และส่งกลับให้ผู้จัดทำแก้ไขเพื่อยื่นใหม่ (ต้องระบุเหตุผล)" className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700">
                  <Icon name="x" className="h-4 w-4" /> ไม่อนุมัติ
                </button>
                <button onClick={() => setApprovalAction('approved')} title="อนุมัติเอกสาร และส่งต่อผู้อนุมัติลำดับถัดไป (ถ้ามี)" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700">
                  <Icon name="check" className="h-5 w-5" /> อนุมัติ
                </button>
              </>
            )}

            {/* OWNER/ADMIN actions — scoped to status (#13 — ยกเลิก + สร้างจากใบนี้ removed) */}
            {canManage && notSubmitted && (
              <button onClick={() => setShowEdit(true)} disabled={busy} title="แก้ไขเนื้อหาเอกสารก่อนส่งอนุมัติ" className="btn-outline">
                <Icon name="edit" className="h-4 w-4" /> แก้ไข
              </button>
            )}
            {canManage && notSubmitted && (
              <button onClick={() => setShowSubmit(true)} title="ส่งเอกสารเข้าสายอนุมัติ (ผู้จัดการโครงการอนุมัติเป็นลำดับแรก)" className="btn-primary">
                <Icon name="check" className="h-4 w-4" /> ส่งอนุมัติ
              </button>
            )}

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
              {previewUrl ? (
                <button onClick={() => window.open(previewUrl, '_blank')} className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline">
                  <Icon name="eye" className="h-4 w-4" /> เปิดเต็มจอ
                </button>
              ) : null}
            </div>
            {/* mobile: the inline A4 preview is small — offer a prominent full-screen read */}
            {previewUrl && (
              <button onClick={() => window.open(previewUrl, '_blank')} className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white md:hidden">
                <Icon name="eye" className="h-4 w-4" /> เปิดเอกสารเต็มจอเพื่ออ่าน
              </button>
            )}
            {combinePending && (
              <div className="mb-2 flex items-center gap-1.5 px-2 text-xs text-slate-400">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
                กำลังรวมไฟล์แนบเข้าเอกสาร… (จะแสดงอัตโนมัติเมื่อเสร็จ)
              </div>
            )}
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
            {otherFiles.length > 0 && (
              <div className="mb-2 space-y-1 px-2">
                <div className="text-xs font-semibold text-slate-500">ไฟล์แนบอื่น ๆ (เปิด/ดาวน์โหลด)</div>
                {otherFiles.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => downloadAttachment(a.id, a.file_name)}
                    disabled={attBusy === a.id}
                    className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-brand hover:bg-brand-tint disabled:opacity-60"
                    title={`ดาวน์โหลด ${a.file_name}`}
                  >
                    <Icon name="paperclip" className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate">{a.file_name}</span>
                    {attBusy === a.id
                      ? <Spinner className="h-4 w-4 shrink-0" tone="inherit" label="กำลังเตรียม…" />
                      : <>
                          {a.size_bytes != null && <span className="shrink-0 text-xs text-slate-400">{fmtSize(a.size_bytes)}</span>}
                          <Icon name="download" className="h-4 w-4 shrink-0 text-brand" />
                        </>}
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

        {/* RIGHT: ONE unified timeline — lifecycle events + approval steps +
            messages, all in a single chronological thread (#4/#5). */}
        <div className="space-y-5 lg:col-span-2">
          <div className="card">
            <h3 className="mb-4 font-bold text-slate-800">บันทึกและการพิจารณา</h3>

            <Timeline doc={doc} openAttachment={openAttachment} />

            {/* composer */}
            <div ref={composerRef} className={`mt-4 rounded-xl border bg-slate-50 p-3 ${consultForMe ? 'border-brand/40 ring-2 ring-brand/15' : 'border-slate-200'}`}>
              {consultForMe && <div className="mb-1.5 text-xs font-semibold text-brand">ให้ความเห็นของคุณที่นี่</div>}
              <textarea
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                rows={2}
                placeholder={consultForMe ? 'พิมพ์ความเห็นของคุณ…' : 'เขียนข้อความ / บันทึก / สอบถาม…'}
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-500 hover:text-brand">
                  <Icon name="paperclip" className="h-4 w-4" />
                  {msgFile ? <span className="max-w-[160px] truncate">{msgFile.name}</span> : 'แนบไฟล์'}
                  <input type="file" className="hidden" onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) { setMsgFile(null); return; }
                    const { file } = await compressImage(f); // shrink images; other files untouched
                    setMsgFile(file);
                  }} />
                </label>
                <div className="flex items-center gap-2">
                  {msgFile && <button onClick={() => setMsgFile(null)} className="text-xs text-slate-400 hover:text-red-600">ลบไฟล์</button>}
                  <button onClick={postMessage} disabled={posting || (!msgText.trim() && !msgFile)} className="btn-primary px-3 py-1.5 text-xs">
                    {posting ? 'กำลังส่ง…' : consultForMe ? 'ส่งความเห็น' : 'ส่งข้อความ'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {dupData && (
        <AddDocumentModal
          projects={dupData.projects}
          docTypes={dupData.docTypes}
          initial={dupData.initial}
          onClose={() => setDupData(null)}
          onCreated={(newId, meta) => {
            setDupData(null);
            if (meta?.emailFailed) toast.error('สร้างเอกสารแล้ว แต่ส่งอีเมลแจ้งผู้อนุมัติไม่สำเร็จ — กรุณาแจ้งผู้อนุมัติด้วยตนเอง');
            else toast.success('สร้างเอกสารจากใบเดิมแล้ว');
            if (newId) navigate(`/memos/${newId}`);
          }}
        />
      )}

      {showSubmit && (
        <SubmitApprovalModal
          documentId={id}
          docCode={doc.doc_code}
          projectManager={doc.manager_email ? { name: doc.manager_name, email: doc.manager_email } : null}
          resubmit={isResubmit}
          onClose={() => setShowSubmit(false)}
          onSubmitted={(emailFailed) => { setShowSubmit(false); if (emailFailed) toast.error('ส่งเข้าสายอนุมัติแล้ว แต่ส่งอีเมลแจ้งผู้อนุมัติไม่สำเร็จ — กรุณาแจ้งผู้อนุมัติด้วยตนเอง'); else toast.success('ส่งเข้าสายอนุมัติแล้ว'); load(); }}
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
          warnNoSignature={approvalAction === 'approved' && myApproval.hasSignature === false}
          nextApproverName={nextApproverName}
          isFinalStep={isFinalStep}
          onClose={() => setApprovalAction(null)}
          onConfirm={confirmApproval}
        />
      )}

      {showConsult && (
        <ConsultModal onClose={() => setShowConsult(false)} onConfirm={confirmConsult} />
      )}

      {refPreviewId && (
        <ReferenceModal
          refId={refPreviewId}
          onClose={() => setRefPreviewId(null)}
          onOpenFull={(rid) => { setRefPreviewId(null); navigate(`/memos/${rid}`); }}
        />
      )}
    </div>
  );
}

// lifecycle audit actions shown inline in the timeline. approve/reject/return/
// consult are represented by their step/message rows, so they're excluded here to
// avoid duplicate entries.
const TIMELINE_LIFECYCLE = new Set(['created', 'submitted', 'edited', 'cancelled', 'resent', 'email_failed', 'forwarded']);

/**
 * ONE unified timeline (#4/#5): document-lifecycle audit events + approval-chain
 * steps + conversation messages, all in a single chronological thread joined by a
 * continuous connector line. Pending steps anchor at their queue position; acted
 * steps, audit events and messages sort by their timestamp.
 */
function Timeline({ doc, openAttachment }) {
  const steps = doc.approval_steps || [];
  const messages = doc.messages || [];
  const audit = doc.audit || [];
  const currentIdx = steps.findIndex((s) => s.action === 'pending');

  // build a unified, time-sorted event list
  const events = [];
  audit.forEach((a, i) => {
    if (!TIMELINE_LIFECYCLE.has(a.action)) return;
    events.push({ kind: 'audit', id: `a-${i}`, audit: a, at: a.created_at ? new Date(a.created_at).getTime() : 0 });
  });
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

  const truncate = (s) => (s && s.length > 40 ? `${s.slice(0, 40)}…` : s);

  return (
    <ol className="relative">
      {events.map((ev, idx) => {
        const last = idx === events.length - 1;
        // continuous connector line joining this node's dot to the next (#5)
        const connector = !last && <span className="absolute left-[13.5px] top-7 h-full w-px bg-slate-200" aria-hidden="true" />;

        if (ev.kind === 'audit') {
          const a = ev.audit;
          const changes = a.action === 'edited' && Array.isArray(a.detail?.changes) ? a.detail.changes : [];
          const warn = a.action === 'email_failed';
          return (
            <li key={ev.id} className="relative flex gap-3 pb-5 text-sm last:pb-0">
              {connector}
              <span className={`relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${warn ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                <Icon name={warn ? 'warning' : 'clock'} className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
                  <span className={`font-medium ${warn ? 'text-amber-600' : 'text-slate-600'}`}>{AUDIT_ACTION_TH[a.action] || a.action}</span>
                  {a.actor_label && <span className="text-slate-500">โดย {a.actor_label}</span>}
                  <span className="text-slate-400">{formatThaiDateTime(a.created_at)}</span>
                </div>
                {changes.length > 0 && (
                  <ul className="mt-1 space-y-0.5 border-l-2 border-slate-100 pl-2.5 text-xs">
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
        }

        if (ev.kind === 'step') {
          const s = ev.step;
          const m = APPROVAL_META[s.action] || APPROVAL_META.pending;
          const isDone = s.action !== 'pending';
          const isWaiting = s.action === 'pending' && !ev.isCurrent;
          const circle = isDone
            ? (s.action === 'approved' ? 'bg-emerald-500 text-white' : s.action === 'rejected' ? 'bg-rose-500 text-white' : 'bg-orange-500 text-white')
            : ev.isCurrent ? 'bg-brand text-white ring-4 ring-brand/15'
            : 'bg-slate-200 text-slate-500';
          const icon = s.action === 'approved' ? 'check' : s.action === 'rejected' ? 'x' : s.action === 'returned' ? 'undo' : null;
          return (
            <li key={ev.id} className="relative flex gap-3 pb-5 text-sm last:pb-0">
              {connector}
              <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${circle}`}>
                {icon ? <Icon name={icon} className="h-4 w-4" strokeWidth={2.4} /> : s.step_no}
              </span>
              <div className="min-w-0 flex-1">
                <div className={`flex flex-wrap items-center gap-2 font-medium ${isWaiting ? 'text-slate-400' : 'text-slate-800'}`}>
                  <span className="truncate">{s.approver_name || s.approver_email}</span>
                  {/* #10: mark the signer clearly as the project manager */}
                  {s.is_signer && <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[10px] font-semibold text-brand">ผู้จัดการโครงการ</span>}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${m.chip}`}>{isWaiting ? 'รอลำดับ' : ev.isCurrent ? 'กำลังพิจารณา' : m.label}</span>
                  {s.acted_at && <span className="text-[11px] text-slate-500">{formatThaiDateTime(s.acted_at)}</span>}
                </div>
                <div className="truncate text-xs text-slate-500">{s.approver_email}</div>
                {/* #9: once approved, show that their signature is now on the letter */}
                {s.action === 'approved' && s.has_signature && (
                  <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                    <Icon name="check" className="h-3.5 w-3.5" /> ลงลายเซ็นบนเอกสารแล้ว
                  </div>
                )}
                {s.comment && <div className="mt-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600">{s.comment}</div>}
              </div>
            </li>
          );
        }

        // message — 'consult' rows (ขอความเห็น) get a distinct blue accent
        const m = ev.msg;
        const isConsult = m.kind === 'consult';
        return (
          <li key={ev.id} className="relative flex gap-3 pb-5 text-sm last:pb-0">
            {connector}
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
