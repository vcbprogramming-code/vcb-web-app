import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ememoApi, STATUS_META, formatThaiDate, formatThaiDateTime } from '../../lib/ememo.js';
import Icon from '../../components/Icon.jsx';
import Spinner from '../../components/Spinner.jsx';
import { useT } from '../../lib/i18n.jsx';

const STEP_ACTION_TH = { approved: 'อนุมัติ', rejected: 'ไม่อนุมัติ', returned: 'ส่งกลับแก้ไข', pending: 'รอพิจารณา' };

/**
 * Read-only copy of ONE document for a สำเนาเรียน (CC) recipient — opened from the
 * link in their notification email, with NO login and no account.
 *
 * Before this page the notice pointed at /memos/:id, which is behind the login
 * wall; accounts are provisioned by an admin only, so anyone copied in from
 * outside that list simply could not read what they were copied on. The token in
 * the URL is the authorisation, and it unlocks this document only.
 */
export default function SharedDocument() {
  const t = useT();
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    ememoApi.sharedDocument(token)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message));
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex items-center justify-center gap-2.5 text-slate-800">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Icon name="document" className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold">{t('VCB E-Memo · สำเนาเรียน')}</span>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-white p-8 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
              <Icon name="x" className="h-6 w-6" />
            </span>
            <h2 className="text-lg font-bold text-slate-800">{t('เปิดเอกสารไม่สำเร็จ')}</h2>
            <p className="mt-1 text-sm text-slate-500">{error}</p>
          </div>
        ) : !data ? (
          <div className="flex justify-center py-16"><Spinner label={t('กำลังเปิดเอกสาร…')} /></div>
        ) : (
          <Shared data={data} token={token} />
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          {t('หน้านี้เปิดจากลิงก์ในอีเมลสำเนาเรียน — แสดงเฉพาะเอกสารฉบับนี้เท่านั้น และเป็นการดูอย่างเดียว')}
        </p>
      </div>
    </div>
  );
}

function Shared({ data, token }) {
  const t = useT();
  const { document: doc, approval_steps: steps = [], has_file: hasFile, file_name: fileName, shared_with: sharedWith } = data;
  const status = STATUS_META[doc.status] || STATUS_META.pending;
  const approved = doc.status === 'approved';

  // The API refuses to be framed from another host, so the bytes are pulled in
  // and shown from a blob instead of pointing the iframe at the API URL.
  const [fileUrl, setFileUrl] = useState(null);
  const [fileError, setFileError] = useState(null);
  useEffect(() => {
    if (!hasFile) return undefined;
    let url = null;
    let alive = true;
    ememoApi.sharedFileBlobUrl(token)
      .then((u) => { if (alive) { url = u; setFileUrl(u); } else URL.revokeObjectURL(u); })
      .catch((e) => alive && setFileError(e.message));
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [token, hasFile]);

  return (
    <div className="space-y-4">
      {/* what this is, and — just as important — what the reader need NOT do */}
      <div className={`flex items-start gap-3 rounded-2xl border px-5 py-4 ${approved ? 'border-emerald-200 bg-emerald-50' : 'border-teal-200 bg-teal-50'}`}>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${approved ? 'bg-emerald-500' : 'bg-teal-600'}`}>
          <Icon name={approved ? 'check' : 'inbox'} className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <div className={`font-bold ${approved ? 'text-emerald-800' : 'text-teal-900'}`}>
            {approved
              ? 'เอกสารฉบับนี้ส่งสำเนาถึงท่าน และได้รับการอนุมัติครบทุกลำดับแล้ว'
              : 'เอกสารฉบับนี้ส่งสำเนาถึงท่านเพื่อทราบ'}
          </div>
          <div className={`text-xs ${approved ? 'text-emerald-700' : 'text-teal-800'}`}>
            ท่านไม่ต้องดำเนินการอนุมัติ {sharedWith ? `· ส่งถึง ${sharedWith}` : ''}
          </div>
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
        <div className="mt-3 grid gap-x-6 gap-y-1.5 border-t border-slate-100 pt-3 text-sm sm:grid-cols-2">
          <div><span className="text-slate-500">{t('วันที่:')}</span> <span className="font-medium text-slate-800">{formatThaiDate(doc.date_received)}</span></div>
          {doc.recipient && <div><span className="text-slate-500">{t('เรียน:')}</span> <span className="font-medium text-slate-800">{doc.recipient}</span></div>}
          {doc.department && <div><span className="text-slate-500">{t('แผนก:')}</span> <span className="font-medium text-slate-800">{doc.department}</span></div>}
          {doc.project_name && <div><span className="text-slate-500">{t('โครงการ:')}</span> <span className="font-medium text-slate-800">{doc.project_name}</span></div>}
          {doc.preparer_name && <div><span className="text-slate-500">{t('ผู้จัดทำ:')}</span> <span className="font-medium text-slate-800">{doc.preparer_name}</span></div>}
          {doc.company_name && <div><span className="text-slate-500">{t('บริษัท:')}</span> <span className="font-medium text-slate-800">{doc.company_name}</span></div>}
        </div>
      </div>

      {/* the letter itself */}
      {hasFile ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
            <h3 className="flex items-center gap-1.5 font-bold text-slate-800">
              <Icon name="document" className="h-4 w-4 text-slate-400" /> {t('หนังสือ')}
            </h3>
            <a
              href={fileUrl || undefined}
              download={fileName || `${doc.doc_number.replace(/\//g, '-')}.pdf`}
              aria-disabled={!fileUrl}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white transition ${
                fileUrl ? 'bg-brand hover:bg-brand-light' : 'pointer-events-none bg-slate-300'
              }`}
            >
              <Icon name="download" className="h-3.5 w-3.5" /> {t('เปิด / บันทึกไฟล์')}
            </a>
          </div>
          {fileError ? (
            <div className="px-5 py-8 text-center text-sm text-red-600">{t('เปิดไฟล์หนังสือไม่สำเร็จ —')} {fileError}</div>
          ) : fileUrl ? (
            <iframe src={fileUrl} title={doc.doc_number} className="h-[75vh] w-full bg-slate-100" />
          ) : (
            <div className="flex h-[40vh] items-center justify-center bg-slate-50"><Spinner label={t('กำลังโหลดหนังสือ…')} /></div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
          {t('ยังไม่มีไฟล์หนังสือสำหรับเอกสารฉบับนี้')}
        </div>
      )}

      {/* approval trail — status only; reasons and opinions stay internal */}
      {steps.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 font-bold text-slate-800">{t('สายอนุมัติ')}</h3>
          <ol className="space-y-2.5">
            {steps.map((s) => {
              const color = s.action === 'approved' ? 'text-emerald-600'
                : s.action === 'rejected' ? 'text-rose-600'
                : s.action === 'returned' ? 'text-orange-600' : 'text-slate-400';
              return (
                <li key={s.step_no} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">{s.step_no}</span>
                  <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                    <span className="font-medium text-slate-700">{s.approver_name}</span>
                    {s.is_signer && <span className="text-[11px] text-slate-400">{t('ผู้จัดการโครงการ / ผู้ลงนาม')}</span>}
                    <span className={`text-xs font-semibold ${color}`}>{STEP_ACTION_TH[s.action] || s.action}</span>
                    {s.acted_at && <span className="text-xs text-slate-400">{formatThaiDateTime(s.acted_at)}</span>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
