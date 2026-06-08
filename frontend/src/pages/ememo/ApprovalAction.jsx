import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ememoApi, APPROVAL_META, STATUS_META } from '../../lib/ememo.js';
import SignaturePad from '../../components/SignaturePad.jsx';
import Icon from '../../components/Icon.jsx';

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

  useEffect(() => {
    ememoApi.lookupApproval(token).then((r) => setInfo(r.data)).catch((e) => setError(e.message));
  }, [token]);

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

  const Wrap = ({ children }) => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 w-full max-w-md p-8">{children}</div>
    </div>
  );

  if (error && !info) return <Wrap><p className="text-red-600">{error}</p></Wrap>;
  if (!info) return <Wrap><p className="text-slate-400">กำลังโหลด…</p></Wrap>;

  if (done) {
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

  return (
    <Wrap>
      <h2 className="text-lg font-bold text-slate-800 mb-1">พิจารณาอนุมัติเอกสาร</h2>
      <p className="text-sm text-slate-500 mb-4">เรียน {info.approver_name || info.approver_email}</p>

      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm space-y-1 mb-4">
        <div><span className="text-slate-500">เลขที่: </span><b>{info.doc_number}</b></div>
        <div><span className="text-slate-500">เรื่อง: </span>{info.subject}</div>
        {info.recipient && <div><span className="text-slate-500">เรียน: </span>{info.recipient}</div>}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="ความเห็น (ไม่บังคับ)"
        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />

      {/* signature — required to approve */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-600 mb-1">ลายเซ็น (สำหรับการอนุมัติ)</label>
        <SignaturePad onChange={setSignature} />
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-3">{error}</div>}

      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => act('approved')} disabled={busy}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 ${preselect === 'approved' ? 'ring-2 ring-emerald-300' : ''}`}>
          <Icon name="check" className="h-4 w-4" /> อนุมัติ</button>
        <button onClick={() => act('returned')} disabled={busy}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50 ${preselect === 'returned' ? 'ring-2 ring-orange-300' : ''}`}>
          <Icon name="undo" className="h-4 w-4" /> ส่งกลับ</button>
        <button onClick={() => act('rejected')} disabled={busy}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 ${preselect === 'rejected' ? 'ring-2 ring-red-300' : ''}`}>
          <Icon name="x" className="h-4 w-4" /> ไม่อนุมัติ</button>
      </div>
    </Wrap>
  );
}
