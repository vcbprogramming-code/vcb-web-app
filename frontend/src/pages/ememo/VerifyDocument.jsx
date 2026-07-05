import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ememoApi, STATUS_META, formatThaiDate, formatThaiDateTime } from '../../lib/ememo.js';
import Icon from '../../components/Icon.jsx';
import Spinner from '../../components/Spinner.jsx';

const AUDIT_ACTION_TH = {
  created: 'สร้างเอกสาร', edited: 'แก้ไขเอกสาร', submitted: 'ส่งเข้าสายอนุมัติ',
  approved: 'อนุมัติ', rejected: 'ไม่อนุมัติ', returned: 'ส่งกลับแก้ไข',
  cancelled: 'ยกเลิกเอกสาร', consulted: 'ขอความเห็น', forwarded: 'ส่งต่อ', resent: 'ส่งอนุมัติซ้ำ',
};
const STEP_ACTION_TH = { approved: 'อนุมัติ', rejected: 'ไม่อนุมัติ', returned: 'ส่งกลับแก้ไข', pending: 'รอพิจารณา' };

/**
 * Public document-authenticity page (#6). Opened by scanning the QR on a printed
 * or exported copy — NO login. Read-only proof that a document is genuine and
 * came from this system: its status, approval trail and audit log.
 */
export default function VerifyDocument() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    ememoApi.verifyDocument(token)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message));
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-2xl">
        {/* brand header */}
        <div className="mb-5 flex items-center justify-center gap-2.5 text-slate-800">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Icon name="document" className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold">VCB E-Memo · ตรวจสอบเอกสาร</span>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-white p-8 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
              <Icon name="x" className="h-6 w-6" />
            </span>
            <h2 className="text-lg font-bold text-slate-800">ตรวจสอบไม่สำเร็จ</h2>
            <p className="mt-1 text-sm text-slate-500">{error}</p>
            <p className="mt-2 text-xs text-slate-400">QR หรือลิงก์อาจไม่ถูกต้อง หรือเอกสารถูกลบออกจากระบบแล้ว</p>
          </div>
        ) : !data ? (
          <div className="flex justify-center py-16"><Spinner label="กำลังตรวจสอบ…" /></div>
        ) : (
          <Verified data={data} />
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          หน้านี้แสดงข้อมูลจากระบบ VCB E-Memo โดยตรง เพื่อยืนยันว่าเอกสารเป็นของจริง
        </p>
      </div>
    </div>
  );
}

function Verified({ data }) {
  const { document: doc, approval_steps: steps = [], audit = [] } = data;
  const status = STATUS_META[doc.status] || STATUS_META.pending;
  return (
    <div className="space-y-4">
      {/* authenticity banner */}
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Icon name="check" className="h-6 w-6" />
        </span>
        <div>
          <div className="font-bold text-emerald-800">เอกสารนี้มีอยู่จริงในระบบ</div>
          <div className="text-xs text-emerald-700">ออกจากระบบ VCB E-Memo · {doc.company_name || 'กลุ่มวิจิตรภัณฑ์ก่อสร้าง'}</div>
        </div>
      </div>

      {/* document identity */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-white">{doc.project_code}</span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.chip}`}>{status.label}</span>
        </div>
        <h1 className="text-xl font-bold text-slate-800">{doc.doc_number}</h1>
        <p className="text-slate-600">{doc.subject}</p>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-slate-100 pt-3 text-sm">
          <div><span className="text-slate-500">วันที่รับ:</span> <span className="font-medium text-slate-800">{formatThaiDate(doc.date_received)}</span></div>
          <div><span className="text-slate-500">แผนก:</span> <span className="font-medium text-slate-800">{doc.department}</span></div>
          {doc.doc_type_name && <div><span className="text-slate-500">ประเภท:</span> <span className="font-medium text-slate-800">{doc.doc_type_name}</span></div>}
          {doc.project_name && <div><span className="text-slate-500">โครงการ:</span> <span className="font-medium text-slate-800">{doc.project_name}</span></div>}
        </div>
      </div>

      {/* approval trail */}
      {steps.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 font-bold text-slate-800">การพิจารณา</h3>
          <ol className="space-y-2.5">
            {steps.map((s) => {
              const color = s.action === 'approved' ? 'text-emerald-600' : s.action === 'rejected' ? 'text-rose-600' : s.action === 'returned' ? 'text-orange-600' : 'text-slate-400';
              return (
                <li key={s.step_no} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">{s.step_no}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium text-slate-700">{s.approver_name || s.approver_email}</span>
                      <span className={`text-xs font-semibold ${color}`}>{STEP_ACTION_TH[s.action] || s.action}</span>
                      {s.acted_at && <span className="text-xs text-slate-400">{formatThaiDateTime(s.acted_at)}</span>}
                    </div>
                    {s.comment && <div className="mt-0.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">{s.comment}</div>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* audit trail */}
      {audit.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 flex items-center gap-1.5 font-bold text-slate-800">
            <Icon name="clock" className="h-4 w-4 text-slate-400" /> ประวัติการดำเนินการ (Audit Trail)
          </h3>
          <ol className="space-y-2">
            {audit.map((a, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-slate-700">{AUDIT_ACTION_TH[a.action] || a.action}</span>
                  {a.actor_label && <span className="text-slate-500">โดย {a.actor_label}</span>}
                  <span className="text-slate-400">{formatThaiDateTime(a.created_at)}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
