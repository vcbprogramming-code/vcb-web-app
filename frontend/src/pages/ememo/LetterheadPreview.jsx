import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

// A4 aspect ratio (height / width). Sheet width is measured at runtime so the page
// HEIGHT matches — a real A4-proportioned page with a blank bottom margin. Content
// that overflows one page spills onto the next sheet (mirrors the PDF, #7).
const A4_RATIO = 1.4142;

/**
 * Live A4 preview of the บันทึกข้อความ letter, mirroring the server PDF
 * (backend/src/services/letterhead.js) in layout + field order.
 *
 * Pagination: the content flows continuously on one A4-width sheet whose height is
 * rounded up to a whole number of A4 pages (so the last page always has a blank
 * bottom margin). Dashed page-break lines + "หน้า N" labels are overlaid at each
 * page boundary, so the user sees exactly where the PDF will break — without the
 * fragility of splitting the DOM across separate sheets.
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

  const frameRef = useRef(null);   // the A4-width frame (measures page width)
  const contentRef = useRef(null); // the flowing content column (measures its height)
  const [pageH, setPageH] = useState(0);
  const [contentH, setContentH] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      const w = frameRef.current?.clientWidth || 0;
      setPageH((prev) => (Math.abs(prev - w * A4_RATIO) > 0.5 ? w * A4_RATIO : prev));
      const h = contentRef.current?.scrollHeight || 0;
      setContentH((prev) => (Math.abs(prev - h) > 0.5 ? h : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (frameRef.current) ro.observe(frameRef.current);
    if (contentRef.current) ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, []);

  // page geometry: the sheet is padded top/bottom and rounded up to whole A4 pages,
  // so the final page always shows a blank bottom margin (never a cut-off box).
  const padY = pageH * 0.06;
  const padX = pageH * 0.056;
  // contentH is the padded content div's own height (includes its top/bottom pad)
  const pageCount = pageH > 0 ? Math.max(1, Math.ceil(contentH / pageH)) : 1;
  const sheetH = pageH > 0 ? pageCount * pageH : undefined;

  return (
    <div ref={frameRef} className="mx-auto w-full max-w-[820px]">
      {/* one continuous A4-width sheet, height rounded up to whole pages */}
      <div
        className="relative overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-slate-200"
        style={{ height: sheetH, minHeight: pageH ? undefined : 500 }}
      >
        {/* page-break guides + "หน้า N" labels overlaid at each A4 boundary */}
        {pageH > 0 && pageCount > 1 && Array.from({ length: pageCount - 1 }).map((_, i) => (
          <div key={i} className="pointer-events-none absolute inset-x-0" style={{ top: (i + 1) * pageH }}>
            <div className="border-t border-dashed border-slate-300" />
            <div className="absolute right-2 -top-4 text-[10px] text-slate-400">— สิ้นสุดหน้า {i + 1} —</div>
          </div>
        ))}

        {/* the letter content, flowing continuously on the sheet */}
        <div
          ref={contentRef}
          className="text-[13px] leading-relaxed text-slate-900"
          style={{ paddingTop: padY, paddingBottom: padY, paddingLeft: padX, paddingRight: padX }}
        >
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
          <div className="mt-2 border-t-2 border-[#1f2a44]" />
          <div className="mt-[2px] border-t border-[#1f2a44]" />

          <div className="mt-3 text-center text-[20px] font-bold tracking-wide">บันทึกข้อความ</div>

          <div className="mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-1 text-[13px]">
            <div><span className="font-bold">เลขที่</span> {doc.doc_number || '— เลือกโครงการและรหัสเอกสาร —'}</div>
            <div><span className="font-bold">วันที่</span> {formatThaiLongDate(doc.date_received || new Date())}</div>
          </div>
          <div className="mt-2 border-t border-slate-200" />

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

          {/* body — break-words so long unbroken strings still wrap (no overflow) */}
          <div className="mt-3 whitespace-pre-wrap break-words text-justify indent-10">
            {doc.body || <span className="text-slate-300">(เนื้อความของหนังสือจะแสดงที่นี่)</span>}
          </div>

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

          {showPreparer && (
            <div className="mt-6 text-[11px] text-slate-500">ผู้จัดทำ: {preparerName}</div>
          )}

          {doc.cc_recipients && (
            <div className="mt-4 border-t border-slate-200 pt-2 text-[11px] text-slate-500">
              สำเนาเรียน : {doc.cc_recipients}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, value, placeholder }) {
  return (
    <div className="flex gap-2">
      <div className="w-24 shrink-0 font-bold">{label}</div>
      <div className="min-w-0 flex-1 break-words">
        {value || <span className="text-slate-300">{placeholder}</span>}
      </div>
    </div>
  );
}
