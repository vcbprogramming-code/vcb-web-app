import { useEffect, useState } from 'react';
import { ememoApi, adminApi } from '../../lib/ememo.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import Icon from '../../components/Icon.jsx';
import LetterheadPreview from './LetterheadPreview.jsx';
import ReferencePicker from './ReferencePicker.jsx';

export default function AddDocumentModal({ projects, docTypes, onClose, onCreated, initial = null }) {
  const { profile, user } = useAuth();
  const authorName = profile?.full_name || user?.email || '';
  // when duplicating ("สร้างจากใบเดิม"), `initial` prefills the form fields
  const [projectId, setProjectId] = useState(initial?.project_id || '');
  const [companyId, setCompanyId] = useState(initial?.company_id || '');
  const [companies, setCompanies] = useState([]);
  const [docCode, setDocCode] = useState(initial?.doc_code || '');
  const [docCodes, setDocCodes] = useState([]);
  const [docTypeId, setDocTypeId] = useState(initial?.doc_type_id || '');
  const [subject, setSubject] = useState(initial?.subject || '');
  const [recipient, setRecipient] = useState(initial?.recipient || '');
  const [reference, setReference] = useState(initial?.reference || '');
  const [referenceDocId, setReferenceDocId] = useState(initial?.reference_doc_id || '');
  const [cc, setCc] = useState(initial?.cc_recipients || '');
  // สิ่งที่ส่งมาด้วย — multiple rows { name, qty }
  const [enclosures, setEnclosures] = useState(
    Array.isArray(initial?.enclosures) && initial.enclosures.length
      ? initial.enclosures.map((e) => ({ name: e.name || '', qty: e.qty != null ? String(e.qty) : '' }))
      : [{ name: '', qty: '' }]
  );
  const setEncl = (i, key, val) => setEnclosures((prev) => prev.map((e, idx) => (idx === i ? { ...e, [key]: val } : e)));
  const addEncl = () => setEnclosures((prev) => [...prev, { name: '', qty: '' }]);
  const removeEncl = (i) => setEnclosures((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  // rows with a name → the payload shape the API/preview expect
  const enclList = enclosures
    .filter((e) => e.name.trim())
    .map((e) => ({ name: e.name.trim(), qty: e.qty ? Number(e.qty) : undefined, unit: 'ชุด' }));
  const [body, setBody] = useState(initial?.body || '');
  const [remarks, setRemarks] = useState(initial?.remarks || '');
  // signer (ผู้เซ็น) — may differ from the preparer (the logged-in author). Blank
  // = the preparer signs; typing a name here makes someone else the signer.
  const [signerName, setSignerName] = useState(initial?.signer_name || '');
  const [signerTitle, setSignerTitle] = useState(initial?.signer_title || '');
  const [dateReceived, setDateReceived] = useState(() => new Date().toISOString().slice(0, 10));
  const [files, setFiles] = useState([]); // supplementary attachments (multiple)
  const [dragOver, setDragOver] = useState(false);
  const [approvers, setApprovers] = useState([{ name: '', email: '' }]);
  const [approversLocked, setApproversLocked] = useState(false); // true when filled from doc-code config
  const [letter, setLetter] = useState({}); // selected project's letterhead, for live preview
  const [step, setStep] = useState(1); // wizard step: 1 ข้อมูล · 2 เนื้อหา · 3 ผู้อนุมัติ

  const [preview, setPreview] = useState(null); // { docNumber, department, runNo }
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [createdDocId, setCreatedDocId] = useState(null); // resume target if a later step fails

  const [copyingFiles, setCopyingFiles] = useState(false);

  // load the configured doc-code → department options once
  useEffect(() => {
    ememoApi.listDocCodes().then((r) => setDocCodes(r.data)).catch(() => setDocCodes([]));
  }, []);

  // when duplicating, copy the source doc's uploaded attachments into `files`
  // (fetch each as a blob → File so they re-upload like freshly-picked files)
  useEffect(() => {
    const src = Array.isArray(initial?.copyAttachments) ? initial.copyAttachments : [];
    if (!initial?.sourceId || src.length === 0) return;
    let cancelled = false;
    setCopyingFiles(true);
    (async () => {
      const collected = [];
      for (const a of src) {
        try {
          const url = await ememoApi.attachmentBlobUrl(initial.sourceId, a.id);
          const blob = await fetch(url).then((r) => r.blob());
          URL.revokeObjectURL(url);
          collected.push(new File([blob], a.file_name || 'attachment', { type: blob.type || a.content_type }));
        } catch { /* skip a file that fails to copy */ }
      }
      if (!cancelled) setFiles((prev) => [...prev, ...collected]);
      if (!cancelled) setCopyingFiles(false);
    })();
    return () => { cancelled = true; };
  }, [initial]);

  // load companies (บริษัท/ตรา) and pre-select the default (main company)
  useEffect(() => {
    ememoApi.listCompanies()
      .then((r) => {
        const list = r.data || [];
        setCompanies(list);
        const def = list.find((c) => c.is_default) || list[0];
        if (def) setCompanyId((cur) => cur || def.id);
      })
      .catch(() => setCompanies([]));
  }, []);

  // load the project's letterhead so the live A4 preview renders the real header.
  // The letterhead's signatory IS the project manager — the required signer under
  // "ขอแสดงความนับถือ" (#5). Auto-fill the signer from it so the clerk can't
  // choose someone else; the preparer only drafts, the manager signs.
  useEffect(() => {
    if (!projectId) {
      setLetter({});
      setSignerName('');
      setSignerTitle('');
      return;
    }
    let cancelled = false;
    adminApi
      .getLetterhead(projectId)
      .then((r) => {
        if (cancelled) return;
        const lh = r.data || {};
        setLetter(lh);
        setSignerName(lh.signatory_name || '');
        setSignerTitle(lh.signatory_title || '');
        // the project's bound company is a DEFAULT (#6): pre-select it so the
        // header matches the project, but the clerk can still switch it — the
        // client asked to stop the hard Auto-lock (some projects don't want it).
        if (lh.company_id) setCompanyId(lh.company_id);
        // auto-route approval to the project manager (#3): if the project has a
        // designated manager account and no approver is picked yet, prefill it.
        if (lh.manager_email) {
          setApprovers((prev) => (prev.some((a) => a.email.trim())
            ? prev
            : [{ name: lh.signatory_name || '', email: lh.manager_email }]));
        }
      })
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
  // add one or more files (from picker or drop); reject oversized ones + dedupe
  const pickFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    const tooBig = incoming.filter((f) => f.size > MAX_BYTES);
    const ok = incoming.filter((f) => f.size <= MAX_BYTES);
    setError(tooBig.length ? `ไฟล์ใหญ่เกิน 7 MB: ${tooBig.map((f) => f.name).join(', ')}` : null);
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      return [...prev, ...ok.filter((f) => !seen.has(`${f.name}:${f.size}`))];
    });
  };
  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

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
        const res = await ememoApi.createDocument({
          projectId,
          companyId: companyId || undefined,
          docCode,
          subject: subject.trim(),
          recipient: recipient.trim() || undefined,
          reference: reference.trim() || undefined,
          referenceDocId: referenceDocId || undefined,
          cc: cc.trim() || undefined,
          signerName: signerName.trim() || undefined,
          signerTitle: signerTitle.trim() || undefined,
          enclosures: enclList.length ? enclList : undefined,
          body: body.trim() || undefined,
          remarks: remarks.trim() || undefined,
          docTypeId: docTypeId || undefined,
          dateReceived,
        });
        doc = res.data;
        setCreatedDocId(doc.id);
      }

      // upload each supplementary file (streamed into storage via the API)
      for (const f of files) {
        await ememoApi.uploadAttachment(doc.id, f);
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

      onCreated(doc.id);
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
    enclosures: enclList,
    body,
    // signature block shows the signer (falls back to the preparer/author)
    signer_name: signerName.trim() || authorName,
    signer_title: signerTitle.trim() || profile?.job_title || undefined,
    preparer_name: authorName,
    signature_image_url: null, // clerk can't paste a signature at create time (#4)
  };

  // the selected company overrides the letterhead identity (name/logo/contact),
  // so the live preview matches what the generated PDF will show.
  const company = companies.find((c) => c.id === companyId) || null;
  const previewLetter = company
    ? {
      ...letter,
      company_name: company.name || letter.company_name,
      company_name_en: company.name_en || letter.company_name_en,
      address: company.address || letter.address,
      phone: company.phone || letter.phone,
      telex: company.telex || letter.telex,
      fax: company.fax || letter.fax,
    }
    : letter;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold text-slate-800">{initial ? 'สร้างเอกสารจากใบเดิม' : 'เพิ่มเอกสารใหม่'}</h3>
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
          {companies.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">บริษัท / ตราหัวจดหมาย</label>
              {/* The project's bound company is only a DEFAULT now (#6) — the clerk
                  can still switch the header if a document needs a different brand.
                  (Previously this was hard-locked; the client asked to drop Auto-lock.) */}
              <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={field}>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.is_default ? ' (ค่าเริ่มต้น)' : ''}</option>
                ))}
              </select>
              {letter?.company_id && (
                <p className="mt-1 text-[11px] text-slate-400">ค่าเริ่มต้นของโครงการนี้ถูกเลือกให้แล้ว — เปลี่ยนได้หากต้องการ</p>
              )}
            </div>
          )}
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
              {/* #3: reference must be a real in-system document (search & pick) */}
              <ReferencePicker
                value={{ docId: referenceDocId, text: reference }}
                onChange={({ docId, text }) => { setReferenceDocId(docId); setReference(text); }}
                excludeId={initial?.sourceId}
              />
              <p className="mt-1 text-xs text-slate-400">เลือกจากเอกสารที่มีอยู่ในระบบ (กดแล้วลิงก์ไปเอกสารตัวจริงได้) · เอกสารอื่นที่ไม่มีในระบบให้แนบเป็นไฟล์แทน</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">สำเนาเรียน / CC (ไม่บังคับ)</label>
              <input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="เช่น ฝ่ายบัญชี, somchai@vcb.co.th" className={field} />
              <p className="mt-1 text-xs text-slate-400">ถ้าใส่อีเมล ระบบจะส่ง “เพื่อทราบ/ปรึกษา” ให้ตอนส่งอนุมัติ (ผู้รับสำเนาไม่ต้องอนุมัติ)</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">สิ่งที่ส่งมาด้วย (ไม่บังคับ)</label>
            <div className="space-y-2">
              {enclosures.map((e, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-sm text-slate-400">{i + 1}.</span>
                  <input value={e.name} onChange={(ev) => setEncl(i, 'name', ev.target.value)} placeholder="เช่น สรุปปริมาณ" className={`${field} flex-1`} />
                  <input value={e.qty} onChange={(ev) => setEncl(i, 'qty', ev.target.value)} placeholder="จำนวน" type="number" min="0" className={`${field} w-24`} />
                  <span className="self-center text-sm text-slate-500">ชุด</span>
                  {enclosures.length > 1 && (
                    <button type="button" onClick={() => removeEncl(i)} className="px-1 text-slate-400 hover:text-red-600"><Icon name="x" className="h-4 w-4" /></button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addEncl} className="mt-2 text-sm font-medium text-blue-600 hover:underline">+ เพิ่มรายการ</button>
          </div>
          </>)}

          {step === 2 && (<>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">เนื้อความ</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder="รายละเอียดเนื้อความ (จะแสดงในหนังสือฝั่งขวา)" className={field} />
          </div>

          {/* supplementary file upload — multiple files allowed */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              แนบไฟล์เพิ่มเติม (ไม่บังคับ)
            </label>
            <p className="text-xs text-slate-400 mb-2">เอกสารประกอบ — แนบได้หลายไฟล์ เพิ่มเติมจากตัวหนังสือ ไม่ได้แทนที่กัน</p>

            {copyingFiles && (
              <div className="mb-2 flex items-center gap-2 rounded-xl border border-brand-border bg-brand-tint px-4 py-2.5 text-sm text-brand">
                <Icon name="paperclip" className="h-4 w-4" /> กำลังคัดลอกไฟล์แนบจากใบเดิม…
              </div>
            )}

            {files.length > 0 && (
              <ul className="mb-2 space-y-2">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon name="paperclip" className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="truncate text-slate-700">{f.name}</span>
                      <span className="shrink-0 text-xs text-slate-400">({(f.size / 1024).toFixed(0)} KB)</span>
                    </span>
                    <button type="button" onClick={() => removeFile(i)} className="shrink-0 text-sm text-red-500 hover:underline">ลบ</button>
                  </li>
                ))}
              </ul>
            )}

            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFiles(e.dataTransfer.files); }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed py-6 transition-colors ${
                dragOver ? 'border-brand bg-brand/5' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Icon name="download" className="h-6 w-6 text-slate-400" />
              <span className="text-sm text-slate-600">{files.length ? 'เพิ่มไฟล์อีก' : 'คลิกหรือลากไฟล์มาวางที่นี่'}</span>
              <span className="text-xs text-slate-400">PDF, Word, Excel, รูปภาพ · เลือกได้หลายไฟล์ · สูงสุด 7 MB/ไฟล์</span>
              <input type="file" multiple className="hidden" onChange={(e) => { pickFiles(e.target.files); e.target.value = ''; }} />
            </label>
          </div>

          {/* signer (ผู้ลงนาม) = the PROJECT MANAGER, auto-filled from the project's
              letterhead (#5). Read-only: the clerk (preparer) can't pick someone
              else — they only draft; the manager signs under "ขอแสดงความนับถือ". */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <label className="block text-sm font-medium text-slate-600 mb-1">ผู้ลงนาม (ใต้ขอแสดงความนับถือ)</label>
            {signerName ? (
              <>
                <p className="mb-2 text-xs text-slate-400">
                  ผู้ลงนามคือ <b className="text-slate-600">ผู้จัดการโครงการ</b> ของโครงการที่เลือก (กำหนดอัตโนมัติ) ·
                  ผู้จัดทำ <b className="text-slate-600">({authorName})</b> เป็นเพียงผู้ร่างเอกสาร
                </p>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <Icon name="user" className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="text-sm font-medium text-slate-800">{signerName}</span>
                  {signerTitle && <span className="text-sm text-slate-500">· {signerTitle}</span>}
                </div>
              </>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {projectId
                    ? 'โครงการนี้ยังไม่ได้ตั้งชื่อผู้จัดการโครงการ (ผู้ลงนาม) — ตั้งได้ที่ ตั้งค่า E-Memo → โครงการ → ผู้ลงนาม'
                    : 'เลือกโครงการก่อน ระบบจะกำหนดผู้ลงนาม (ผู้จัดการโครงการ) ให้อัตโนมัติ'}
                </span>
              </div>
            )}
          </div>

          {/* NOTE (#4): the preparer (clerk) can NOT paste an approver's signature
              here. The signature is applied by the real signer/approver when they
              sign in-app — so no signature-image upload at create time. */}
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
          <LetterheadPreview letter={previewLetter} doc={previewDoc} company={company} />
        </div>
        </div>
      </div>
    </div>
  );
}
