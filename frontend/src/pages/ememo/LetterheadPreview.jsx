import { formatThaiLongDate } from '../../lib/ememo.js';

/**
 * Live HTML/CSS mirror of the server-side A4 letterhead (backend/src/services/
 * letterhead.js). Used for the split-view create screen so the user sees the
 * บันทึกข้อความ update as they type. Not pixel-perfect with the PDF, but the
 * same layout and field order so there are no surprises after generation.
 *
 * Props:
 *   letter   project_letterhead row (company_name, company_name_en, address,
 *            phone, fax, telex, signatory_name, signatory_title, closing_line)
 *   doc      { doc_number, date_received, subject, recipient, reference,
 *             cc_recipients, work_unit, enclosures[], body }
 */
export default function LetterheadPreview({ letter = {}, doc = {} }) {
  const enclosures = Array.isArray(doc.enclosures) ? doc.enclosures : [];
  const recipient = doc.recipient || letter.default_recipient;

  return (
    <div className="mx-auto w-full max-w-[820px]">
      {/* A4-ish sheet */}
      <div className="aspect-[1/1.414] w-full overflow-hidden rounded-lg bg-white px-[8%] py-[6%] text-[13px] leading-relaxed text-slate-900 shadow-lg ring-1 ring-slate-200">
        {/* header: logo + company name (left) + contact (right) */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-300 pb-3">
          <div className="flex min-w-0 items-start gap-3">
            <img src="/logo.png" alt="" className="h-14 w-14 shrink-0 object-contain" />
            <div className="min-w-0">
              <div className="whitespace-nowrap text-[15px] font-bold leading-tight">
                {letter.company_name || 'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด'}
              </div>
              {letter.company_name_en && (
                <div className="whitespace-nowrap text-[12px] font-bold leading-tight">{letter.company_name_en}</div>
              )}
              {/* work unit right under the company name, no prefix */}
              {doc.work_unit && <div className="text-[11px] leading-tight">{doc.work_unit}</div>}
              {letter.address && <div className="mt-0.5 text-[10px] text-slate-500">{letter.address}</div>}
            </div>
          </div>
          <div className="shrink-0 text-right text-[9px] text-slate-500">
            {letter.phone && <div>โทรศัพท์ : {letter.phone}</div>}
            {letter.telex && <div>เทเล็กซ์ : {letter.telex}</div>}
            {letter.fax && <div>โทรสาร : {letter.fax}</div>}
          </div>
        </div>

        {/* บันทึกข้อความ — title */}
        <div className="mt-3 text-center text-[19px] font-bold">บันทึกข้อความ</div>

        {/* doc number + date */}
        <div className="mt-3">
          <div>เอกสารเลขที่ {doc.doc_number || '— เลือกโครงการและรหัสเอกสาร —'}</div>
          <div className="mt-1 text-center">{formatThaiLongDate(doc.date_received || new Date())}</div>
        </div>

        {/* เรื่อง / เรียน / อ้างถึง / สิ่งที่ส่งมาด้วย */}
        <div className="mt-3 space-y-1">
          <FieldRow label="เรื่อง" value={doc.subject} placeholder="(ระบุเรื่อง)" />
          {recipient && <FieldRow label="เรียน" value={recipient} />}
          {doc.reference && <FieldRow label="อ้างถึง" value={doc.reference} />}
          {enclosures.length > 0 && (
            <div className="flex gap-2">
              <div className="w-24 shrink-0">สิ่งที่ส่งมาด้วย</div>
              <div className="min-w-0">
                {enclosures.map((e, i) => (
                  <div key={i}>
                    {i + 1}. {e.name}
                    {e.qty != null ? `  จำนวน ${e.qty} ${e.unit || 'ชุด'}` : ''}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* body */}
        <div className="mt-3 min-h-[120px] whitespace-pre-wrap text-justify indent-10">
          {doc.body || <span className="text-slate-300">(เนื้อความของหนังสือจะแสดงที่นี่)</span>}
        </div>

        {/* closing + signature — right-aligned block, all lines centered together */}
        <div className="mt-8 flex justify-end">
          <div className="w-1/2 text-center leading-relaxed">
            <div>{letter.closing_line || 'ขอแสดงความนับถือ'}</div>
            {doc.signature_image_url ? (
              <img src={doc.signature_image_url} alt="ลายเซ็น" className="mx-auto mt-2 h-12 w-auto object-contain" />
            ) : (
              <div className="mt-12" />
            )}
            <div className={doc.signature_image_url ? 'mt-1' : ''}>({doc.author_name || letter.signatory_name || '...........................'})</div>
            {(doc.author_title || letter.signatory_title) && <div>{doc.author_title || letter.signatory_title}</div>}
          </div>
        </div>

        {/* สำเนาเรียน / CC — footer note */}
        {doc.cc_recipients && (
          <div className="mt-4 border-t border-slate-200 pt-2 text-[11px] text-slate-500">
            สำเนาเรียน : {doc.cc_recipients}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldRow({ label, value, placeholder }) {
  return (
    <div className="flex gap-2">
      <div className="w-24 shrink-0">{label}</div>
      <div className="min-w-0 flex-1">
        {value || <span className="text-slate-300">{placeholder}</span>}
      </div>
    </div>
  );
}
