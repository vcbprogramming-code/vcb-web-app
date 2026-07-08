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

// A4 aspect ratio (height / width). Sheet width is measured at runtime → the page
// HEIGHT matches, giving true A4-proportioned pages.
const A4_RATIO = 1.4142;
const PAD_X = 0.056;   // side padding as a fraction of page height
const PAD_TOP = 0.06;  // top margin
const FOOTER = 0.10;   // blank footer band reserved at the bottom of EVERY page

/**
 * Live A4 preview of the บันทึกข้อความ letter, mirroring the server PDF
 * (backend/src/services/letterhead.js) in layout + field order.
 *
 * Real pagination: the letter is laid out once in a hidden measurer, then sliced
 * across N separate A4 sheets. Each sheet shows only its printable band (top
 * margin + usable height), leaving a blank FOOTER on every page. The signature
 * block (ขอแสดงความนับถือ + name + title) is never split — if it would straddle a
 * page break, a spacer pushes it whole onto the next page, like the PDF's
 * sigBlockNeeded guard.
 */
export default function LetterheadPreview({ letter = {}, doc = {}, company = null }) {
  const logoSrc = useCompanyLogo(company);
  const enclosures = Array.isArray(doc.enclosures) ? doc.enclosures : [];
  const recipient = doc.recipient || letter.default_recipient;
  const signerName = doc.signer_name || doc.author_name || letter.signatory_name;
  const signerTitle = doc.signer_title || doc.author_title || letter.signatory_title;
  const preparerName = doc.preparer_name || doc.author_name;
  const showPreparer = preparerName && preparerName !== signerName;

  const frameRef = useRef(null);    // A4-width frame (measures page width)
  const measureRef = useRef(null);  // hidden, spacer-free layout (stable measurement)
  const sigRef = useRef(null);      // signature block inside the measurer
  const bodyRef = useRef(null);     // body paragraph — read its line-height
  const [pageH, setPageH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [sigSpacer, setSigSpacer] = useState(0);
  const [usableH, setUsableH] = useState(0); // printable height per page, SNAPPED to line-height

  useLayoutEffect(() => {
    const measure = () => {
      const w = frameRef.current?.clientWidth || 0;
      const ph = w * A4_RATIO;
      if (ph) setPageH((prev) => (Math.abs(prev - ph) > 0.5 ? ph : prev));
      if (!ph || !measureRef.current) return;

      const rawUsable = ph - ph * PAD_TOP - ph * FOOTER; // printable height per page
      // Snap the usable height DOWN to a whole number of body lines so a page break
      // never bisects a line of text (the PDF breaks at line boundaries too).
      const lh = bodyRef.current
        ? parseFloat(getComputedStyle(bodyRef.current).lineHeight) || 20
        : 20;
      const usable = Math.max(lh, Math.floor(rawUsable / lh) * lh);
      setUsableH((prev) => (Math.abs(prev - usable) > 0.5 ? usable : prev));

      // sig block straddle check — measured on the SPACER-FREE layout so it can't
      // feed back on itself. `top` is relative to the printable origin.
      let spacer = 0;
      if (sigRef.current) {
        const cTop = measureRef.current.getBoundingClientRect().top + ph * PAD_TOP;
        const r = sigRef.current.getBoundingClientRect();
        const top = r.top - cTop;
        const startPage = Math.floor(top / usable);
        const endPage = Math.floor((top + r.height - 0.5) / usable);
        if (endPage > startPage && r.height <= usable) {
          // push the block's top to the next page's printable origin (+2 so its
          // first line clears the previous page's clip edge)
          spacer = (startPage + 1) * usable - top + 2;
        }
      }
      setSigSpacer((prev) => (Math.abs(prev - spacer) > 0.5 ? spacer : prev));

      // content height (spacer-free) + the spacer we will apply → drives page count
      const h = (measureRef.current.scrollHeight || 0) + spacer;
      setContentH((prev) => (Math.abs(prev - h) > 0.5 ? h : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (frameRef.current) ro.observe(frameRef.current);
    if (measureRef.current) ro.observe(measureRef.current);
    return () => ro.disconnect();
  }, []);

  const padTop = pageH * PAD_TOP;
  const padX = pageH * PAD_X;
  const footerH = pageH * FOOTER;
  const flowH = Math.max(0, contentH - padTop); // contentH includes one padTop
  const pageCount = (pageH > 0 && usableH > 0) ? Math.max(1, Math.ceil(flowH / usableH)) : 1;

  // The letter markup — rendered in the hidden measurer (withSigRef) and in each
  // visible page slice. `spacer` pushes the signature block down when needed.
  const Letter = ({ withSigRef, spacer }) => (
    <div style={{ paddingLeft: padX, paddingRight: padX }}>
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
                <div key={i}>{i + 1}. {e.name}{e.qty != null ? `  จำนวน ${e.qty} ${e.unit || 'ชุด'}` : ''}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* body — break-words so long unbroken strings still wrap (no overflow) */}
      <div ref={withSigRef ? bodyRef : undefined} className="mt-3 whitespace-pre-wrap break-words text-justify indent-10">
        {doc.body || <span className="text-slate-300">(เนื้อความของหนังสือจะแสดงที่นี่)</span>}
      </div>

      {/* closing + signature — kept whole (pushed to next page by `spacer`) */}
      <div ref={withSigRef ? sigRef : undefined} style={{ marginTop: 32 + (spacer || 0) }} className="flex justify-end">
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
  );

  return (
    <div ref={frameRef} className="mx-auto w-full max-w-[820px] space-y-4">
      {/* hidden measurer (spacer-free) — sizes the sig block + total height */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none fixed -left-[9999px] top-0 -z-10 text-[13px] leading-relaxed text-slate-900 opacity-0"
        style={{ width: pageH ? pageH / A4_RATIO : 500, paddingTop: padTop }}
      >
        <Letter withSigRef spacer={0} />
      </div>

      {/* visible A4 sheets — one per page, each showing its printable slice */}
      {pageH > 0 && Array.from({ length: pageCount }).map((_, p) => (
        <div
          key={p}
          className="relative w-full overflow-hidden rounded-lg bg-white text-[13px] leading-relaxed text-slate-900 shadow-lg ring-1 ring-slate-200"
          style={{ height: pageH }}
        >
          {/* top margin (blank) on EVERY page — genuine padding above the clip box */}
          <div style={{ height: padTop }} />
          {/* printable window: clips to exactly the usable band; content is shifted
              up so this page shows its slice, WITH the top margin preserved above */}
          <div style={{ height: usableH, overflow: 'hidden' }}>
            <div style={{ transform: `translateY(-${p * usableH}px)` }}>
              <Letter spacer={sigSpacer} />
            </div>
          </div>
          {/* blank footer band with a subtle page number */}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-center pb-2 text-[10px] text-slate-300" style={{ height: footerH }}>
            {pageCount > 1 && <span>หน้า {p + 1} / {pageCount}</span>}
          </div>
        </div>
      ))}
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
