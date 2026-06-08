import { useEffect, useState } from 'react';
import { ememoApi } from '../../lib/ememo.js';
import Icon from '../../components/Icon.jsx';

export default function AddDocumentModal({ projects, docTypes, onClose, onCreated }) {
  const [projectId, setProjectId] = useState('');
  const [docCode, setDocCode] = useState('');
  const [docCodes, setDocCodes] = useState([]);
  const [docTypeId, setDocTypeId] = useState('');
  const [subject, setSubject] = useState('');
  const [recipient, setRecipient] = useState('');
  const [workUnit, setWorkUnit] = useState('');
  const [enclName, setEnclName] = useState('');
  const [enclQty, setEnclQty] = useState('');
  const [body, setBody] = useState('');
  const [remarks, setRemarks] = useState('');
  const [dateReceived, setDateReceived] = useState(() => new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const [preview, setPreview] = useState(null); // { docNumber, department, runNo }
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // load the configured doc-code → department options once
  useEffect(() => {
    ememoApi.listDocCodes().then((r) => setDocCodes(r.data)).catch(() => setDocCodes([]));
  }, []);

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

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!projectId || !docCode || !subject.trim()) {
      setError('กรุณาเลือกโครงการ รหัสเอกสาร และระบุเรื่อง');
      return;
    }
    setSubmitting(true);
    try {
      const { data: doc } = await ememoApi.createDocument({
        projectId,
        docCode,
        subject: subject.trim(),
        recipient: recipient.trim() || undefined,
        workUnit: workUnit.trim() || undefined,
        enclosures: enclName.trim()
          ? [{ name: enclName.trim(), qty: enclQty ? Number(enclQty) : undefined, unit: 'ชุด' }]
          : undefined,
        body: body.trim() || undefined,
        remarks: remarks.trim() || undefined,
        docTypeId: docTypeId || undefined,
        dateReceived,
      });

      // upload the supplementary file (if any) to S3 via a presigned PUT
      if (file) {
        const { data: up } = await ememoApi.attachmentUploadUrl(
          doc.id,
          file.name,
          file.type || 'application/octet-stream'
        );
        const put = await fetch(up.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!put.ok) throw new Error('อัปโหลดไฟล์แนบไม่สำเร็จ');
        await ememoApi.confirmAttachment(doc.id, {
          storageKey: up.storageKey,
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        });
      }

      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const field = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold text-slate-800">เพิ่มเอกสารใหม่</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><Icon name="x" className="h-5 w-5" /></button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">โครงการ *</label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={field}>
                <option value="">— เลือกโครงการ —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">รหัสเอกสาร *</label>
              <select
                value={docCode}
                onChange={(e) => {
                  const code = e.target.value;
                  setDocCode(code);
                  // auto-fill เรียน from the code's recipient title (if not edited)
                  const c = docCodes.find((x) => x.code === code);
                  if (c?.recipient_title && !recipient.trim()) setRecipient(c.recipient_title);
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

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">หน่วยงาน</label>
            <input value={workUnit} onChange={(e) => setWorkUnit(e.target.value)} placeholder="เช่น บางเตย" className={field} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">สิ่งที่ส่งมาด้วย (ไม่บังคับ)</label>
            <div className="flex gap-2">
              <input value={enclName} onChange={(e) => setEnclName(e.target.value)} placeholder="เช่น สรุปปริมาณ" className={`${field} flex-1`} />
              <input value={enclQty} onChange={(e) => setEnclQty(e.target.value)} placeholder="จำนวน" type="number" min="0" className={`${field} w-28`} />
              <span className="self-center text-sm text-slate-500">ชุด</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">เรียน (ผู้รับ)</label>
            <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="เช่น ผู้จัดการฝ่ายวิศวกรรม" className={field} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">เรื่อง *</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="เช่น ขออนุมัติ…" className={field} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">เนื้อความ</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="รายละเอียดเนื้อความ (ใช้สำหรับสร้างหนังสือในขั้นถัดไป)" className={field} />
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
                  dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <Icon name="download" className="h-7 w-7 text-slate-400" />
                <span className="text-sm text-slate-600">คลิกหรือลากไฟล์มาวางที่นี่</span>
                <span className="text-xs text-slate-400">PDF, Word, Excel, รูปภาพ · สูงสุด 7 MB</span>
                <input type="file" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
              </label>
            )}
          </div>

          {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">ยกเลิก</button>
            <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50">
              {submitting ? 'กำลังบันทึก…' : 'บันทึกเอกสาร'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
