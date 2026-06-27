import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ememoApi, APPROVAL_META, STATUS_META, formatThaiDate } from '../../lib/ememo.js';
import SignaturePad from '../../components/SignaturePad.jsx';
import Icon from '../../components/Icon.jsx';

// NOTE: these are declared at module level (NOT inside ApprovalAction) so they
// keep a stable identity across renders — otherwise the textarea loses focus on
// every keystroke and the signature canvas resets on every state change.
function Wrap({ children, wide }) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-start justify-center p-4 py-8">
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="rounded-t-2xl bg-gradient-to-br from-brand to-brand-light px-7 py-5 text-white">
          <div className="text-xs tracking-wide opacity-85">ระบบงานภายใน · วิจิตรภัณฑ์ก่อสร้าง</div>
          <div className="mt-0.5 text-lg font-bold">บันทึกข้อความขออนุมัติ</div>
        </div>
        <div className="rounded-b-2xl border border-t-0 border-slate-200 bg-white p-7 shadow-sm">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex gap-3 py-1.5">
      <div className="w-24 shrink-0 text-slate-500">{label}</div>
      <div className="flex-1 font-medium text-slate-800">{children}</div>
    </div>
  );
}

/**
 * Confirmation screen after the approver acts. Auto-redirects to the web app
 * after a short countdown, with an explicit button to go now.
 */
function DoneScreen({ done }) {
  const [secs, setSecs] = useState(5);
  // the approval page lives on the frontend, so its own origin IS the web app
  const appUrl = window.location.origin;

  useEffect(() => {
    if (secs <= 0) {
      window.location.href = appUrl;
      return;
    }
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs, appUrl]);

  const m = APPROVAL_META[done.action];
  const ring = done.action === 'approved' ? 'bg-emerald-100 text-emerald-600'
    : done.action === 'returned' ? 'bg-orange-100 text-orange-600'
    : 'bg-red-100 text-red-600';
  const ic = done.action === 'approved' ? 'check' : done.action === 'returned' ? 'undo' : 'x';

  return (
    <Wrap>
      <div className="text-center space-y-3">
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${ring}`}>
          <Icon name={ic} className="h-7 w-7" strokeWidth={2.2} />
        </div>
        <h2 className="text-lg font-bold text-slate-800">บันทึกการ{m.label}เรียบร้อย</h2>
        <p className="text-slate-500 text-sm">
          สถานะเอกสารปัจจุบัน: <b>{(STATUS_META[done.documentStatus] || {}).label || done.documentStatus}</b>
          {done.advanced && ' — ส่งต่อให้ผู้อนุมัติลำดับถัดไปแล้ว'}
        </p>
        <div className="pt-2">
          <a
            href={appUrl}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-light"
          >
            <Icon name="arrowRight" className="h-4 w-4" /> เข้าสู่ระบบงานภายใน
          </a>
          <p className="mt-2 text-xs text-slate-400">กำลังนำท่านไปยังเว็บไซต์ใน {secs} วินาที…</p>
        </div>
      </div>
    </Wrap>
  );
}

/**
 * Public approval page reached from the email link: /approve/:token?action=...
 * No login required — the token is the credential. Shows the document, lets the
 * approver confirm approve / return / reject with an optional comment.
 */
export default function ApprovalAction() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const preselect = params.get('action');

  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [comment, setComment] = useState('');
  const [signature, setSignature] = useState(null);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  // forward / delegate
  const [showForward, setShowForward] = useState(false);
  const [fwdEmail, setFwdEmail] = useState('');
  const [fwdName, setFwdName] = useState('');
  const [forwarded, setForwarded] = useState(null);

  useEffect(() => {
    ememoApi.lookupApproval(token).then((r) => setInfo(r.data)).catch((e) => setError(e.message));
  }, [token]);

  const forward = async () => {
    if (!fwdEmail.trim()) {
      setError('กรุณาระบุอีเมลผู้ที่ต้องการส่งต่อ');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data } = await ememoApi.forwardApproval(token, fwdEmail.trim(), fwdName.trim() || undefined, comment.trim() || undefined);
      setForwarded(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const act = async (action) => {
    // require a signature only when approving
    if (action === 'approved' && !signature) {
      setError('กรุณาเซ็นลายเซ็นก่อนอนุมัติ');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data } = await ememoApi.actOnApproval(
        token,
        action,
        comment.trim() || undefined,
        action === 'approved' ? signature : undefined
      );
      setDone(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const openAttachment = async (attId) => {
    try {
      const url = await ememoApi.approvalAttachmentBlobUrl(token, attId);
      window.open(url, '_blank');
    } catch (e) {
      setError(e.message);
    }
  };

  if (error && !info) return <Wrap><p className="text-red-600">{error}</p></Wrap>;
  if (!info) return <Wrap><p className="text-slate-400">กำลังโหลด…</p></Wrap>;

  if (done) {
    return <DoneScreen done={done} />;
  }

  if (forwarded) {
    return (
      <Wrap>
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-tint text-brand">
            <Icon name="arrowRight" className="h-7 w-7" strokeWidth={2.2} />
          </div>
          <h2 className="text-lg font-bold text-slate-800">ส่งต่อเรียบร้อย</h2>
          <p className="text-sm text-slate-500">ส่งคำขออนุมัติต่อไปยัง <b className="text-slate-700">{forwarded.to}</b> แล้ว</p>
        </div>
      </Wrap>
    );
  }

  if (info.action !== 'pending' || info.expired) {
    return (
      <Wrap>
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Icon name="clock" className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">
            {info.expired ? 'ลิงก์หมดอายุแล้ว' : 'รายการนี้ถูกดำเนินการไปแล้ว'}
          </h2>
        </div>
      </Wrap>
    );
  }

  const enclosures = Array.isArray(info.enclosures) ? info.enclosures : [];
  const files = (info.attachments || []).filter((a) => a.kind !== 'generated_pdf' || a.version === 'original');

  return (
    <Wrap wide>
      <p className="mb-4 text-sm text-slate-500">เรียน <b className="text-slate-700">{info.approver_name || info.approver_email}</b> — มีเอกสารรอการพิจารณาอนุมัติจากท่าน</p>

      {/* full document detail */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white">{info.project_code}</span>
          <span className="text-base font-bold text-slate-800">{info.doc_number}</span>
        </div>
        <Field label="เรื่อง">{info.subject}</Field>
        {info.recipient && <Field label="เรียน">{info.recipient}</Field>}
        {info.doc_type_name && <Field label="ประเภท">{info.doc_type_name}</Field>}
        {info.department && <Field label="แผนก">{info.department}</Field>}
        {info.work_unit && <Field label="หน่วยงาน">{info.work_unit}</Field>}
        {info.date_received && <Field label="วันที่">{formatThaiDate(info.date_received)}</Field>}
        {enclosures.length > 0 && (
          <Field label="สิ่งที่ส่งมาด้วย">
            <span className="font-normal">{enclosures.map((e, i) => `${i + 1}. ${e.name}${e.qty != null ? ` (${e.qty} ${e.unit || 'ชุด'})` : ''}`).join('  ·  ')}</span>
          </Field>
        )}
        {info.body && (
          <div className="mt-2 border-t border-slate-200 pt-2">
            <div className="mb-1 text-slate-500">เนื้อความ</div>
            <div className="whitespace-pre-wrap font-normal text-slate-700">{info.body}</div>
          </div>
        )}
        {info.remarks && <Field label="หมายเหตุ"><span className="font-normal">{info.remarks}</span></Field>}
      </div>

      {/* attachments */}
      {files.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-sm font-medium text-slate-600">เอกสารแนบ</div>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {files.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-slate-700">
                  <Icon name={a.version === 'original' ? 'file' : 'paperclip'} className="h-4 w-4 text-slate-400" />
                  {a.file_name}{a.version === 'original' ? ' (หนังสือฉบับเต็ม)' : ''}
                </span>
                <button onClick={() => openAttachment(a.id)} className="inline-flex items-center gap-1 text-brand hover:underline">
                  <Icon name="eye" className="h-4 w-4" /> เปิดดู
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* approval form */}
      <div className="mt-6 border-t border-slate-200 pt-5">
        <h3 className="mb-3 font-bold text-slate-800">พิจารณาอนุมัติ</h3>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder="ความเห็น (ไม่บังคับ)"
          className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/25"
        />
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-600">ลายเซ็น (สำหรับการอนุมัติ)</label>
          <SignaturePad onChange={setSignature} />
        </div>

        {error && <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => act('approved')} disabled={busy}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 ${preselect === 'approved' ? 'ring-2 ring-emerald-300' : ''}`}>
            <Icon name="check" className="h-4 w-4" /> อนุมัติ</button>
          <button onClick={() => act('returned')} disabled={busy}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-3 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50 ${preselect === 'returned' ? 'ring-2 ring-orange-300' : ''}`}>
            <Icon name="undo" className="h-4 w-4" /> ส่งกลับแก้ไข</button>
          <button onClick={() => act('rejected')} disabled={busy}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 ${preselect === 'rejected' ? 'ring-2 ring-red-300' : ''}`}>
            <Icon name="x" className="h-4 w-4" /> ไม่อนุมัติ</button>
        </div>

        {/* forward / delegate */}
        <div className="mt-4 border-t border-slate-100 pt-4">
          {!showForward ? (
            <button onClick={() => { setShowForward(true); setError(null); }} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand">
              <Icon name="arrowRight" className="h-4 w-4" /> ส่งต่อให้ผู้อื่นพิจารณาแทน
            </button>
          ) : (
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="mb-2 text-sm font-semibold text-slate-700">ส่งต่อให้ผู้อื่น</div>
              <p className="mb-3 text-xs text-slate-400">มอบหมายให้บุคคลอื่นพิจารณาในลำดับนี้แทนท่าน — ระบบจะส่งอีเมลลิงก์อนุมัติไปให้</p>
              <div className="space-y-2">
                <input value={fwdName} onChange={(e) => setFwdName(e.target.value)} placeholder="ชื่อ (ไม่บังคับ)" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/25" />
                <input value={fwdEmail} onChange={(e) => setFwdEmail(e.target.value)} placeholder="อีเมลผู้รับ *" type="email" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/25" />
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => setShowForward(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-white">ยกเลิก</button>
                <button onClick={forward} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light disabled:opacity-50">
                  <Icon name="arrowRight" className="h-4 w-4" /> {busy ? 'กำลังส่ง…' : 'ส่งต่อ'}
                </button>
              </div>
            </div>
          )}
        </div>

        {info.token_expires_at && (
          <p className="mt-3 text-center text-xs text-slate-400">ลิงก์นี้หมดอายุ {formatThaiDate(info.token_expires_at)} · ใช้สำหรับเอกสารฉบับนี้เท่านั้น</p>
        )}
      </div>
    </Wrap>
  );
}
