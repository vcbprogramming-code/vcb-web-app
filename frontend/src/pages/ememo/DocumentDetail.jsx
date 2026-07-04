import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ememoApi, STATUS_META, APPROVAL_META, formatThaiDate } from '../../lib/ememo.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import SubmitApprovalModal from './SubmitApprovalModal.jsx';
import EditDocumentModal from './EditDocumentModal.jsx';
import Icon from '../../components/Icon.jsx';

function Row({ label, children }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <div className="w-28 shrink-0 text-slate-500">{label}</div>
      <div className="font-medium text-slate-800">{children}</div>
    </div>
  );
}

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewAttId, setPreviewAttId] = useState(null);

  // message composer
  const [msgText, setMsgText] = useState('');
  const [msgFile, setMsgFile] = useState(null);
  const [posting, setPosting] = useState(false);

  // is the logged-in user the current pending approver?
  const [myApproval, setMyApproval] = useState({ canApprove: false });
  const [actioning, setActioning] = useState(false);
  const [approveComment, setApproveComment] = useState('');

  const load = useCallback(() => {
    ememoApi.getDocument(id).then((r) => setDoc(r.data)).catch((e) => setError(e.message));
    ememoApi.myApproval(id).then((r) => setMyApproval(r.data)).catch(() => setMyApproval({ canApprove: false }));
  }, [id]);

  useEffect(load, [load]);

  // act on the current approval step (only shown to the current approver).
  // comment is optional on approve, REQUIRED on return/reject.
  const doApprove = async (action) => {
    const labels = { approved: 'อนุมัติ', returned: 'ส่งกลับแก้ไข', rejected: 'ไม่อนุมัติ' };
    const comment = approveComment.trim();
    if (action !== 'approved' && !comment) {
      setError(`กรุณาระบุเหตุผล/ความเห็นสำหรับ "${labels[action]}"`);
      return;
    }
    setActioning(true); setError(null);
    try {
      await ememoApi.approveDocument(id, action, comment || undefined);
      setApproveComment('');
      load();
    } catch (e) { setError(e.message); } finally { setActioning(false); }
  };

  const previewables = doc ? (() => {
    const combined = doc.attachments.find((a) => a.kind === 'combined_pdf');
    const letter =
      doc.attachments.find((a) => a.version === 'approved') ||
      doc.attachments.find((a) => a.version === 'original');
    const inlineKinds = doc.attachments.filter(
      (a) => (a.kind === 'upload') && /^(application\/pdf|image\/)/.test(a.content_type || '')
    );
    const list = [];
    if (combined) list.push({ id: combined.id, label: 'รวมเอกสาร (ไฟล์เดียว)', isLetter: true });
    if (letter) list.push({ id: letter.id, label: letter.version === 'approved' ? 'ฉบับอนุมัติ' : 'หนังสือ (ต้นฉบับ)', isLetter: true });
    for (const a of inlineKinds) list.push({ id: a.id, label: a.file_name, isLetter: false });
    return list;
  })() : [];

  const activePreviewId = (previewAttId && previewables.some((p) => p.id === previewAttId))
    ? previewAttId
    : previewables[0]?.id || null;

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
    try { await ememoApi.cancelDocument(id); load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
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

  const uploadFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try { await ememoApi.uploadAttachment(id, file); load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
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
    } catch (e) { setError(e.message); } finally { setPosting(false); }
  };

  if (error) return <div className="bg-red-50 text-red-700 rounded-xl px-4 py-3">{error}</div>;
  if (!doc) return <div className="text-slate-400">กำลังโหลด…</div>;

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

      {/* ★ APPROVER CALL-TO-ACTION — the whole point of this page for an approver.
          Big, unmissable, at the very top. Only for the current pending approver. */}
      {myApproval.canApprove && (
        <div className="rounded-2xl border-2 border-brand/40 bg-brand-tint p-5 shadow-sm ring-1 ring-brand/10">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow">
              <Icon name="check" className="h-6 w-6" />
            </span>
            <div>
              <div className="text-base font-bold text-slate-900">เอกสารนี้รอการอนุมัติจากคุณ</div>
              <p className="text-sm text-slate-600">ตรวจเอกสารด้านล่าง เขียนความเห็น (ถ้ามี) แล้วเลือกดำเนินการ</p>
            </div>
          </div>

          {/* inline comment — optional to approve, required to return/reject */}
          <textarea
            value={approveComment}
            onChange={(e) => setApproveComment(e.target.value)}
            rows={2}
            placeholder="ความเห็น / เหตุผล (บังคับเมื่อส่งกลับแก้ไข หรือ ไม่อนุมัติ)"
            className="mt-4 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button onClick={() => doApprove('returned')} disabled={actioning} className="inline-flex items-center gap-2 rounded-xl border border-orange-300 bg-white px-4 py-2.5 text-sm font-medium text-orange-600 transition hover:bg-orange-50 disabled:opacity-50">
              <Icon name="undo" className="h-4 w-4" /> ส่งกลับแก้ไข
            </button>
            <button onClick={() => doApprove('rejected')} disabled={actioning} className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50">
              <Icon name="x" className="h-4 w-4" /> ไม่อนุมัติ
            </button>
            <button onClick={() => doApprove('approved')} disabled={actioning} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50">
              <Icon name="check" className="h-5 w-5" /> {actioning ? 'กำลังบันทึก…' : 'อนุมัติเอกสาร'}
            </button>
          </div>
        </div>
      )}

      {/* header card — title + only the actions valid for THIS viewer & status */}
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-md px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: doc.project_color || '#64748b' }}>{doc.project_code}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.chip}`}>{status.label}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-800">{doc.doc_number}</h2>
            <p className="text-slate-600">{doc.subject}</p>
          </div>
          {/* owner/admin actions, scoped to status:
              · not submitted (ร่าง/ตีกลับ) → แก้ไข + ส่งอนุมัติ
              · รออนุมัติ → ยกเลิก เท่านั้น
              · อนุมัติแล้ว/ยกเลิก → ไม่มีปุ่ม (ดูอย่างเดียว) */}
          {canManage && (notSubmitted || isPending) && (
            <div className="flex flex-wrap justify-end gap-2">
              {notSubmitted && (
                <button onClick={() => setShowEdit(true)} disabled={busy} className="btn-outline">
                  <Icon name="edit" className="h-4 w-4" /> แก้ไข
                </button>
              )}
              {(notSubmitted || isPending) && (
                <button onClick={cancelDoc} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50">
                  <Icon name="x" className="h-4 w-4" /> ยกเลิก
                </button>
              )}
              {notSubmitted && (
                <button onClick={() => setShowSubmit(true)} className="btn-primary">
                  <Icon name="check" className="h-4 w-4" /> ส่งอนุมัติ
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-5">
        {/* LEFT: document preview */}
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

        {/* RIGHT: info + files + conversation */}
        <div className="space-y-5 lg:col-span-2">
          <div className="card">
            <h3 className="mb-3 font-bold text-slate-800">ข้อมูลเอกสาร</h3>
            <Row label="วันที่รับ">{formatThaiDate(doc.date_received)}</Row>
            {doc.recipient && <Row label="เรียน">{doc.recipient}</Row>}
            {doc.reference && <Row label="อ้างถึง">{doc.reference}</Row>}
            {doc.cc_recipients && <Row label="สำเนาเรียน">{doc.cc_recipients}</Row>}
            {doc.doc_type_name && <Row label="ประเภท">{doc.doc_type_name}</Row>}
            <Row label="แผนก">{doc.department}</Row>
            {Array.isArray(doc.enclosures) && doc.enclosures.length > 0 && (
              <Row label="สิ่งที่ส่งมาด้วย">
                <span className="font-normal">
                  {doc.enclosures.map((e, i) => `${i + 1}. ${e.name}${e.qty != null ? ` (${e.qty} ${e.unit || 'ชุด'})` : ''}`).join('  ·  ')}
                </span>
              </Row>
            )}
            {doc.body && <Row label="เนื้อความ"><span className="whitespace-pre-wrap font-normal">{doc.body}</span></Row>}
            {doc.remarks && <Row label="หมายเหตุ"><span className="font-normal">{doc.remarks}</span></Row>}
          </div>

          {/* files: original / approved / combined */}
          <div className="card">
            <h3 className="mb-3 font-bold text-slate-800">ไฟล์เอกสาร</h3>
            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Icon name="file" className="h-4 w-4 text-slate-400" /> ฉบับต้นฉบับ
                </div>
                {(() => {
                  const orig = doc.attachments.find((a) => a.version === 'original');
                  return orig
                    ? <button onClick={() => openAttachment(orig.id)} className="break-all text-sm text-brand hover:underline">{orig.file_name}</button>
                    : <p className="text-xs text-slate-400">ยังไม่มีไฟล์ — กด "แก้ไข" แล้วบันทึกเพื่อสร้าง</p>;
                })()}
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Icon name="signature" className="h-4 w-4 text-emerald-400" /> ฉบับอนุมัติ (มีลายเซ็น)
                </div>
                {(() => {
                  const appr = doc.attachments.find((a) => a.version === 'approved');
                  return appr
                    ? <button onClick={() => openAttachment(appr.id)} className="break-all text-sm text-emerald-300 hover:underline">{appr.file_name}</button>
                    : <p className="text-xs text-slate-400">จะถูกสร้างเมื่ออนุมัติครบทุกขั้น</p>;
                })()}
              </div>
              {/* combined "one file" — auto-generated when there are attachments */}
              {(() => {
                const comb = doc.attachments.find((a) => a.kind === 'combined_pdf');
                if (!comb) return null;
                return (
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <Icon name="layers" className="h-4 w-4 text-brand" /> รวมเอกสาร (บันทึก + ไฟล์แนบ ไฟล์เดียว)
                    </div>
                    <button onClick={() => openAttachment(comb.id)} className="break-all text-sm text-brand hover:underline">{comb.file_name}</button>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* supplementary files */}
          <div className="card">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">ไฟล์ประกอบ</h3>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50">
                <Icon name="plus" className="h-4 w-4" /> แนบไฟล์
                <input type="file" className="hidden" onChange={(e) => uploadFile(e.target.files?.[0])} disabled={busy} />
              </label>
            </div>
            {(() => {
              const supp = doc.attachments.filter((a) => a.kind === 'upload');
              return supp.length === 0 ? (
                <p className="text-sm text-slate-500">ยังไม่มีไฟล์ประกอบ</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {supp.map((a) => (
                    <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="flex items-center gap-2">
                        <Icon name="paperclip" className="h-4 w-4 text-slate-500" />
                        <button onClick={() => openAttachment(a.id)} className="text-brand hover:underline">{a.file_name}</button>
                      </span>
                      <span className="text-xs text-slate-500">{formatThaiDate(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>

          {/* ── Conversation: approval chain + messages merged as a timeline ── */}
          <div className="card">
            <h3 className="mb-4 font-bold text-slate-800">การสื่อสาร & การพิจารณา</h3>

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
          </div>
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
                  {s.acted_at && <span className="text-[11px] text-slate-500">{formatThaiDate(s.acted_at)}</span>}
                </div>
                <div className="truncate text-xs text-slate-500">{s.approver_email}</div>
                {s.comment && <div className="mt-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600">{s.comment}</div>}
              </div>
            </li>
          );
        }
        // message
        const m = ev.msg;
        return (
          <li key={ev.id} className="relative flex gap-3 text-sm">
            <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Icon name="chat" className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-800">{m.author_name || m.author_label || 'ผู้ใช้'}</span>
                <span className="text-[11px] text-slate-500">{formatThaiDate(m.created_at)}</span>
              </div>
              <div className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{m.body}</div>
              {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {m.attachments.map((a) => (
                    <button key={a.id} onClick={() => openAttachment(a.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-brand hover:bg-slate-50">
                      <Icon name="paperclip" className="h-3.5 w-3.5" /> <span className="max-w-[160px] truncate">{a.file_name}</span>
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
