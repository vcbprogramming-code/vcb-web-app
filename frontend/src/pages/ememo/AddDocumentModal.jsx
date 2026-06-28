import { useEffect, useState } from 'react';
import { ememoApi, adminApi } from '../../lib/ememo.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import Icon from '../../components/Icon.jsx';
import LetterheadPreview from './LetterheadPreview.jsx';

export default function AddDocumentModal({ projects, docTypes, onClose, onCreated }) {
  const { profile, user } = useAuth();
  const authorName = profile?.full_name || user?.email || '';
  const [projectId, setProjectId] = useState('');
  const [docCode, setDocCode] = useState('');
  const [docCodes, setDocCodes] = useState([]);
  const [docTypeId, setDocTypeId] = useState('');
  const [subject, setSubject] = useState('');
  const [recipient, setRecipient] = useState('');
  const [reference, setReference] = useState('');
  const [cc, setCc] = useState('');
  const [enclName, setEnclName] = useState('');
  const [enclQty, setEnclQty] = useState('');
  const [body, setBody] = useState('');
  const [remarks, setRemarks] = useState('');
  const [dateReceived, setDateReceived] = useState(() => new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [sigMode, setSigMode] = useState('text'); // 'text' = พิมพ์ชื่อ · 'image' = อัปโหลดลายเซ็น
  const [sigFile, setSigFile] = useState(null);
  const [sigPreviewUrl, setSigPreviewUrl] = useState(null); // local object URL for preview
  const [approvers, setApprovers] = useState([{ name: '', email: '' }]);
  const [approversLocked, setApproversLocked] = useState(false); // true when filled from doc-code config
  const [letter, setLetter] = useState({}); // selected project's letterhead, for live preview
  const [step, setStep] = useState(1); // wizard step: 1 ข้อมูล · 2 เนื้อหา · 3 ผู้อนุมัติ

  const [preview, setPreview] = useState(null); // { docNumber, department, runNo }
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [createdDocId, setCreatedDocId] = useState(null); // resume target if a later step fails

  // load the configured doc-code → department options once
  useEffect(() => {
    ememoApi.listDocCodes().then((r) => setDocCodes(r.data)).catch(() => setDocCodes([]));
  }, []);

  // load the project's letterhead so the live A4 preview renders the real header
  useEffect(() => {
    if (!projectId) {
      setLetter({});
      return;
    }
    let cancelled = false;
    adminApi
      .getLetterhead(projectId)
      .then((r) => !cancelled && setLetter(r.data || {}))
      .catch(() => !cancelled && setLetter({}));
    return () => { cancelled = true; };
  }, [projectId]);

  // live-preview the auto doc number when project + code are both set
  useEffect(() => {
    if (!projectId || !docCode) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const t = setTimeout(() => {
      ememoApi
        .nextNumber(projectId, docCode)
        .then((res) => !cancelled && setPreview(res.data))
        .catch(() => !cancelled && setPreview(null))
        .finally(() => !cancelled && setPreviewLoading(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [projectId, docCode]);

  const MAX_BYTES = 7 * 1024 * 1024;
  const pickFile = (f) => {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError('ไฟล์ใหญ่เกิน 7 MB');
      return;
    }
    setError(null);
    setFile(f);
  };

  const pickSignature = (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('ลายเซ็นต้องเป็นไฟล์รูปภาพ'); return; }
    if (f.size > 2 * 1024 * 1024) { setError('รูปลายเซ็นใหญ่เกิน 2 MB'); return; }
    setError(null);
    setSigFile(f);
    setSigPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(f); });
  };

  const updateApprover = (i, key, value) =>
    setApprovers((prev) => prev.map((a, idx) => (idx === i ? { ...a, [key]: value } : a)));
  const addApprover = () => setApprovers((prev) => [...prev, { name: '', email: '' }]);
  const removeApprover = (i) => setApprovers((prev) => prev.filter((_, idx) => idx !== i));

  const STEPS = ['ข้อมูลเอกสาร', 'เนื้อหา & ไฟล์แนบ', 'ผู้อนุมัติ & ยืนยัน'];

  const goNext = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setError(null);
    if (step === 1) {
      if (!projectId || !docCode || !subject.trim()) {
        setError('กรุณาเลือกโครงการ รหัสเอกสาร และระบุเรื่อง');
        return;
      }
    }
    setStep((s) => Math.min(3, s + 1));
  };
  const goBack = () => { setError(null); setStep((s) => Math.max(1, s - 1)); };

  const submit = async (e) => {
    e.preventDefault();
    // only the last step may actually submit — guards against Enter / stray
    // submit events advancing past the wizard and closing the modal early
    if (step !== 3) {
      goNext();
      return;
    }
    setError(null);
    if (!projectId || !docCode || !subject.trim()) {
      setError('กรุณาเลือกโครงการ รหัสเอกสาร และระบุเรื่อง');
      setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      // resume an already-created doc if a previous attempt failed after create —
      // avoids creating a duplicate (and burning a running number) on retry
      let doc = createdDocId ? { id: createdDocId } : null;
      if (!doc) {
        // upload the author signature image first (if chosen), to get its storage key
        let authorSignatureUrl;
        if (sigMode === 'image' && sigFile) {
          const { data } = await ememoApi.uploadSignature(sigFile);
          authorSignatureUrl = data.key;
        }
        const res = await ememoApi.createDocument({
          projectId,
          docCode,
          subject: subject.trim(),
          recipient: recipient.trim() || undefined,
          reference: reference.trim() || undefined,
          cc: cc.trim() || undefined,
          authorSignatureUrl,
          enclosures: enclName.trim()
            ? [{ name: enclName.trim(), qty: enclQty ? Number(enclQty) : undefined, unit: 'ชุด' }]
            : undefined,
          body: body.trim() || undefined,
          remarks: remarks.trim() || undefined,
          docTypeId: docTypeId || undefined,
          dateReceived,
        });
        doc = res.data;
        setCreatedDocId(doc.id);
      }

      // upload the supplementary file (if any) — streamed into GridFS via the API
      if (file) {
        await ememoApi.uploadAttachment(doc.id, file);
      }

      // always generate the letterhead PDF right away so the document is ready
      // to view/print without a manual step (it can be regenerated after edits)
      await ememoApi.generatePdf(doc.id).catch(() => {});

      // if approvers were given, send for approval right away
      const cleanedApprovers = approvers
        .map((a) => ({ name: a.name.trim() || undefined, email: a.email.trim() }))
        .filter((a) => a.email);
      if (cleanedApprovers.length > 0) {
        await ememoApi.submitForApproval(doc.id, cleanedApprovers);
      }

      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const field = 'field';

  // shape the live-preview doc from current form state
  const previewDoc = {
    doc_number: preview?.docNumber,
    date_received: dateReceived,
    subject,
    recipient,
    reference,
    cc_recipients: cc,
    enclosures: enclName.trim()
      ? [{ name: enclName.trim(), qty: enclQty ? Number(enclQty) : undefined, unit: 'ชุด' }]
      : [],
    body,
    author_name: authorName,
    author_title: profile?.job_title || undefined,
    signature_image_url: sigMode === 'image' ? sigPreviewUrl : null,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold text-slate-800">เพิ่มเอกสารใหม่</h3>
            {/* stepper */}
            <div className="hidden items-center gap-1.5 sm:flex">
              {STEPS.map((label, i) => {
                const n = i + 1;
                const stState = n === step ? 'active' : n < step ? 'done' : 'todo';
                return (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      stState === 'active' ? 'bg-brand text-white'
                      : stState === 'done' ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-400'}`}>
                      {stState === 'done' ? <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.5} /> : n}
                    </span>
                    <span className={`text-xs ${n === step ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>{label}</span>
                    {n < 3 && <span className="mx-1 h-px w-4 bg-slate-200" />}
                  </div>
                );
              })}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700"><Icon name="x" className="h-5 w-5" /></button>
        </div>

        {/* split view: form (left) · live A4 preview (right) */}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <form onSubmit={submit} className="space-y-4 overflow-auto p-6">
          {step === 1 && (<>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">โครงการ <span className="text-red-500">*</span></label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={field}>
                <option value="">— เลือกโครงการ —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name && p.name !== p.code ? `${p.code} — ${p.name}` : p.code}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">รหัสเอกสาร <span className="text-red-500">*</span></label>
              <select
                value={docCode}
                onChange={(e) => {
                  const code = e.target.value;
                  setDocCode(code);
                  const c = docCodes.find((x) => x.code === code);
                  // auto-fill เรียน from the code's recipient title (if not edited)
                  if (c?.recipient_title && !recipient.trim()) setRecipient(c.recipient_title);
                  // auto-fill + lock approvers from the code's configured chain
                  const cfg = Array.isArray(c?.default_approvers) ? c.default_approvers : [];
                  if (cfg.length) {
                    setApprovers(cfg.map((a) => ({ name: a.name || '', email: a.email || '' })));
                    setApproversLocked(true);
                  } else {
                    // switching to a code with no config: clear any previously-locked rows
                    if (approversLocked) setApprovers([{ name: '', email: '' }]);
                    setApproversLocked(false);
                  }
                }}
                className={field}
              >
                <option value="">— เลือกรหัส —</option>
                {docCodes.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} — {c.recipient_title || c.department}</option>
                ))}
              </select>
            </div>
          </div>

          {/* live doc-number preview */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm">
            <span className="text-slate-500">เลขที่เอกสาร (อัตโนมัติ): </span>
            {previewLoading ? (
              <span className="text-slate-400">กำลังคำนวณ…</span>
            ) : preview ? (
              <span className="font-semibold text-slate-800">{preview.docNumber}</span>
            ) : (
              <span className="text-slate-400">เลือกโครงการและรหัสเอกสารเพื่อดูเลขที่</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">ประเภทเอกสาร</label>
              <select value={docTypeId} onChange={(e) => setDocTypeId(e.target.value)} className={field}>
                <option value="">— ไม่ระบุ —</option>
                {docTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">วันที่เอกสาร</label>
              <input type="date" value={dateReceived} onChange={(e) => setDateReceived(e.target.value)} className={field} />
            </div>
          </div>

          {/* fields ordered to match the real memo: เรื่อง → เรียน → อ้างถึง → สำเนาเรียน → สิ่งที่ส่งมาด้วย */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">เรื่อง <span className="text-red-500">*</span></label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="เช่น ขออนุมัติ…" className={field} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">เรียน (ผู้รับ)</label>
            <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="เช่น ผู้จัดการฝ่ายวิศวกรรม" className={field} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">อ้างถึง (ไม่บังคับ)</label>
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="เช่น BV/วิศวะ/02A/018 ลว. 26 มิ.ย. 69" className={field} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">สำเนาเรียน / CC (ไม่บังคับ)</label>
              <input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="เช่น ฝ่ายบัญชี, ฝ่ายบุคคล" className={field} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">สิ่งที่ส่งมาด้วย (ไม่บังคับ)</label>
            <div className="flex gap-2">
              <input value={enclName} onChange={(e) => setEnclName(e.target.value)} placeholder="เช่น สรุปปริมาณ" className={`${field} flex-1`} />
              <input value={enclQty} onChange={(e) => setEnclQty(e.target.value)} placeholder="จำนวน" type="number" min="0" className={`${field} w-28`} />
              <span className="self-center text-sm text-slate-500">ชุด</span>
            </div>
          </div>
          </>)}

          {step === 2 && (<>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">เนื้อความ</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder="รายละเอียดเนื้อความ (จะแสดงในหนังสือฝั่งขวา)" className={field} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">หมายเหตุ</label>
            <input value={remarks} onChange={(e) => setRemarks(e.target.value)} className={field} />
          </div>

          {/* supplementary file upload */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              แนบไฟล์เพิ่มเติม (ไม่บังคับ)
            </label>
            <p className="text-xs text-slate-400 mb-2">เอกสารประกอบ — แนบเพิ่มเติมจากตัวหนังสือ ไม่ได้แทนที่กัน</p>
            {file ? (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  <Icon name="paperclip" className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="truncate text-slate-700">{file.name}</span>
                  <span className="text-slate-400 text-xs shrink-0">({(file.size / 1024).toFixed(0)} KB)</span>
                </span>
                <button type="button" onClick={() => setFile(null)} className="text-red-500 hover:underline text-sm shrink-0">ลบ</button>
              </div>
            ) : (
              <label
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed py-8 cursor-pointer transition-colors ${
                  dragOver ? 'border-brand bg-brand/5' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <Icon name="download" className="h-7 w-7 text-slate-400" />
                <span className="text-sm text-slate-600">คลิกหรือลากไฟล์มาวางที่นี่</span>
                <span className="text-xs text-slate-400">PDF, Word, Excel, รูปภาพ · สูงสุด 7 MB</span>
                <input type="file" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
              </label>
            )}
          </div>

          {/* signature: typed name or uploaded image */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">ลายเซ็น (ใต้ขอแสดงความนับถือ)</label>
            <div className="mb-2 inline-flex rounded-xl border border-slate-200 p-0.5 text-sm">
              <button type="button" onClick={() => setSigMode('text')}
                className={`rounded-lg px-3 py-1.5 font-medium transition ${sigMode === 'text' ? 'bg-brand text-white' : 'text-slate-600'}`}>
                พิมพ์ชื่อ
              </button>
              <button type="button" onClick={() => setSigMode('image')}
                className={`rounded-lg px-3 py-1.5 font-medium transition ${sigMode === 'image' ? 'bg-brand text-white' : 'text-slate-600'}`}>
                อัปโหลดลายเซ็น
              </button>
            </div>
            {sigMode === 'text' ? (
              <p className="text-xs text-slate-400">ระบบจะแสดงชื่อผู้จัดทำ <b className="text-slate-600">({authorName})</b> เป็นตัวพิมพ์</p>
            ) : sigFile ? (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <img src={sigPreviewUrl} alt="ลายเซ็น" className="h-12 w-auto object-contain" />
                <span className="flex-1 truncate text-sm text-slate-600">{sigFile.name}</span>
                <button type="button" onClick={() => { setSigFile(null); setSigPreviewUrl((o) => { if (o) URL.revokeObjectURL(o); return null; }); }} className="text-sm text-red-500 hover:underline">ลบ</button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 py-5 hover:border-slate-300">
                <Icon name="signature" className="h-6 w-6 text-slate-400" />
                <span className="text-sm text-slate-600">คลิกเพื่ออัปโหลดรูปลายเซ็น</span>
                <span className="text-xs text-slate-400">PNG/JPG พื้นหลังโปร่งใสจะดูดีที่สุด · สูงสุด 2 MB</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => pickSignature(e.target.files?.[0])} />
              </label>
            )}
          </div>
          </>)}

          {step === 3 && (<>
          {/* approvers — optional, OR auto-filled+locked from the doc-code config */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-600">ผู้อนุมัติ {approversLocked ? '' : '(ไม่บังคับ)'}</label>
              {approversLocked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2.5 py-0.5 text-[11px] font-medium text-brand">
                  <Icon name="check" className="h-3 w-3" /> กำหนดจากรหัสเอกสาร
                </span>
              )}
            </div>
            <p className="mb-3 text-xs text-slate-400">
              {approversLocked
                ? 'สายอนุมัติถูกกำหนดไว้ตามรหัสเอกสารนี้ (แก้ไขได้ที่ ตั้งค่าระบบ → รหัสเอกสาร)'
                : 'ระบุผู้อนุมัติตามลำดับขั้น — เมื่อบันทึก ระบบจะสร้างหนังสือและส่งอีเมลขออนุมัติให้ทีละคนตามลำดับ หากเว้นว่างไว้ เอกสารจะถูกบันทึกอย่างเดียว'}
            </p>
            <div className="space-y-2">
              {approvers.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-center font-semibold text-slate-400">{i + 1}</span>
                  <input value={a.name} onChange={(e) => updateApprover(i, 'name', e.target.value)} placeholder="ชื่อ (ไม่บังคับ)" className={`${field} w-32 ${approversLocked ? 'bg-slate-100' : ''}`} readOnly={approversLocked} />
                  <input value={a.email} onChange={(e) => updateApprover(i, 'email', e.target.value)} placeholder="อีเมล" type="email" className={`${field} flex-1 ${approversLocked ? 'bg-slate-100' : ''}`} readOnly={approversLocked} />
                  {!approversLocked && approvers.length > 1 && (
                    <button type="button" onClick={() => removeApprover(i)} className="px-1 text-slate-400 hover:text-red-600"><Icon name="x" className="h-4 w-4" /></button>
                  )}
                </div>
              ))}
            </div>
            {!approversLocked && (
              <button type="button" onClick={addApprover} className="mt-2 text-sm font-medium text-blue-600 hover:underline">+ เพิ่มผู้อนุมัติ</button>
            )}
          </div>
          </>)}

          {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

          {/* wizard nav */}
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={step === 1 ? onClose : goBack} className="btn-outline">
              {step === 1 ? 'ยกเลิก' : '← ก่อนหน้า'}
            </button>
            {step < 3 ? (
              <button key="next" type="button" onClick={goNext} className="btn-primary">ถัดไป →</button>
            ) : (
              <button key="submit" type="submit" disabled={submitting} className="btn-primary">
                {submitting
                  ? 'กำลังบันทึก…'
                  : approvers.some((a) => a.email.trim())
                    ? 'บันทึกและส่งอนุมัติ'
                    : 'บันทึกเอกสาร'}
              </button>
            )}
          </div>
        </form>

        {/* RIGHT: live A4 letterhead preview */}
        <div className="hidden min-h-0 overflow-auto border-l border-slate-200 bg-slate-100 p-6 lg:block">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Icon name="file" className="h-4 w-4" /> ตัวอย่างหนังสือ
          </div>
          <LetterheadPreview letter={letter} doc={previewDoc} />
        </div>
        </div>
      </div>
    </div>
  );
}
