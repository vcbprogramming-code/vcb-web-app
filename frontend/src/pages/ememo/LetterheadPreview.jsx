import { useEffect, useState } from 'react';
import { formatThaiLongDate, ememoApi } from '../../lib/ememo.js';

/** Resolve the header logo: the selected company's logo (auth-gated blob) if it
 *  has one, else the bundled default asset. */
function useCompanyLogo(company) {
  const [src, setSrc] = useState('/logo.png');
  useEffect(() => {
    let url;
    if (company?.id && company?.logo_url) {
      ememoApi.companyLogoUrl(company.id)
        .then((u) => { url = u; setSrc(u); })
        .catch(() => setSrc('/logo.png'));
    } else {
      setSrc('/logo.png');
    }
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [company?.id, company?.logo_url]);
  return src;
}

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
export default function LetterheadPreview({ letter = {}, doc = {}, company = null }) {
  const logoSrc = useCompanyLogo(company);
  const enclosures = Array.isArray(doc.enclosures) ? doc.enclosures : [];
  const recipient = doc.recipient || letter.default_recipient;
  // signature block shows the SIGNER (falls back to the preparer/author, then the
  // letterhead's default signatory); the preparer line only appears when different.
  const signerName = doc.signer_name || doc.author_name || letter.signatory_name;
  const signerTitle = doc.signer_title || doc.author_title || letter.signatory_title;
  const preparerName = doc.preparer_name || doc.author_name;
  const showPreparer = preparerName && preparerName !== signerName;

  return (
    <div className="mx-auto w-full max-w-[820px]">
      {/* A4-ish sheet */}
      <div className="aspect-[1/1.414] w-full overflow-hidden rounded-lg bg-white px-[8%] py-[6%] text-[13px] leading-relaxed text-slate-900 shadow-lg ring-1 ring-slate-200">
        {/* header: logo + company name (left) + contact (right) */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logoSrc} alt="" className="h-14 w-14 shrink-0 object-contain" />
            <div className="min-w-0">
              <div className="whitespace-nowrap text-[16px] font-bold leading-tight text-slate-900">
                {letter.company_name || 'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด'}
              </div>
              {letter.company_name_en && (
                <div className="whitespace-nowrap text-[11px] leading-tight text-slate-500">{letter.company_name_en}</div>
              )}
              {letter.address && <div className="mt-0.5 text-[10px] text-slate-500">{letter.address}</div>}
            </div>
          </div>
          <div className="shrink-0 text-right text-[9px] text-slate-500">
            {letter.phone && <div>โทร. {letter.phone}</div>}
            {letter.fax && <div>โทรสาร {letter.fax}</div>}
            {letter.telex && <div>เทเล็กซ์ {letter.telex}</div>}
          </div>
        </div>
        {/* double rule under the masthead — official-letter look */}
        <div className="mt-2 border-t-2 border-[#1f2a44]" />
        <div className="mt-[2px] border-t border-[#1f2a44]" />

        {/* บันทึกข้อความ — title */}
        <div className="mt-3 text-center text-[20px] font-bold tracking-wide">บันทึกข้อความ</div>

        {/* meta row: เลขที่ (left) · วันที่ (right) */}
        <div className="mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-1 text-[13px]">
          <div><span className="font-bold">เลขที่</span> {doc.doc_number || '— เลือกโครงการและรหัสเอกสาร —'}</div>
          <div><span className="font-bold">วันที่</span> {formatThaiLongDate(doc.date_received || new Date())}</div>
        </div>
        <div className="mt-2 border-t border-slate-200" />

        {/* เรื่อง / เรียน / อ้างถึง / สิ่งที่ส่งมาด้วย */}
        <div className="mt-3 space-y-1">
          <FieldRow label="เรื่อง" value={doc.subject} placeholder="(ระบุเรื่อง)" />
          {recipient && <FieldRow label="เรียน" value={recipient} />}
          {doc.reference && <FieldRow label="อ้างถึง" value={doc.reference} />}
          {enclosures.length > 0 && (
            <div className="flex gap-2">
              <div className="w-24 shrink-0 font-bold">สิ่งที่ส่งมาด้วย</div>
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
            <div className={doc.signature_image_url ? 'mt-1' : ''}>({signerName || '...........................'})</div>
            {signerTitle && <div>{signerTitle}</div>}
          </div>
        </div>

        {/* ผู้จัดทำ (preparer) — only when different from the signer */}
        {showPreparer && (
          <div className="mt-6 text-[11px] text-slate-500">ผู้จัดทำ: {preparerName}</div>
        )}

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
      <div className="w-24 shrink-0 font-bold">{label}</div>
      <div className="min-w-0 flex-1">
        {value || <span className="text-slate-300">{placeholder}</span>}
      </div>
    </div>
  );
}
