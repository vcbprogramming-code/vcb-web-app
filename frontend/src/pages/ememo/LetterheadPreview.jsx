import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatThaiLongDate, ememoApi } from '../../lib/ememo.js';

/** Resolve the header logo: the selected company's logo (auth-gated blob) if it
 *  has one, else the bundled default asset. */
function useCompanyLogo(company) {
  const [src, setSrc] = useState('/logo.png');
  useEffect(() => {
    let url;
    let cancelled = false;
    if (company?.id && company?.logo_url) {
      ememoApi.companyLogoUrl(company.id)
        .then((u) => {
          // company changed before this resolved → drop the now-stale logo, don't leak it
          if (cancelled) { URL.revokeObjectURL(u); return; }
          url = u; setSrc(u);
        })
        .catch(() => { if (!cancelled) setSrc('/logo.png'); });
    } else {
      setSrc('/logo.png');
    }
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
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
  const [usableH, setUsableH] = useState(0);   // printable height per page
  const [offsets, setOffsets] = useState([0]); // flow-Y where each page's slice starts

  useLayoutEffect(() => {
    const measure = () => {
      const w = frameRef.current?.clientWidth || 0;
      const ph = w * A4_RATIO;
      if (ph) setPageH((prev) => (Math.abs(prev - ph) > 0.5 ? ph : prev));
      if (!ph || !measureRef.current) return;

      const usable = ph - ph * PAD_TOP - ph * FOOTER; // printable height per page
      setUsableH((prev) => (Math.abs(prev - usable) > 0.5 ? usable : prev));
      const origin = measureRef.current.getBoundingClientRect().top + ph * PAD_TOP;

      // sig block straddle check — measured on the SPACER-FREE layout.
      let spacer = 0;
      if (sigRef.current) {
        const r = sigRef.current.getBoundingClientRect();
        const top = r.top - origin;
        const startPage = Math.floor(top / usable);
        const endPage = Math.floor((top + r.height - 0.5) / usable);
        if (endPage > startPage && r.height <= usable) {
          spacer = (startPage + 1) * usable - top + 2;
        }
      }
      setSigSpacer((prev) => (Math.abs(prev - spacer) > 0.5 ? spacer : prev));

      // Collect candidate break positions = the bottom Y (flow coords, spacer-free)
      // of every text line in the body, plus the body line height, so a page can end
      // at a line gap and never slice through a line. The body is the only long
      // multi-line element.
      const breaks = [];
      let lineH = 20;
      if (bodyRef.current) {
        const range = document.createRange();
        range.selectNodeContents(bodyRef.current);
        for (const rect of range.getClientRects()) {
          breaks.push(rect.bottom - origin);
          if (rect.height > lineH) lineH = rect.height;
        }
        range.detach?.();
      }
      // total flow height (spacer-free letter) + the spacer that pushes the sig block
      const totalH = (measureRef.current.scrollHeight || 0) - ph * PAD_TOP + spacer;

      // Walk pages. Each page fills DOWN TO the printable edge (start+usable) so that
      // trailing blocks (e.g. the signature) stay on the page while space remains —
      // we only pull the break back to the last clean line gap when a BODY line would
      // actually be sliced at that edge. (The sig block never gets sliced: the spacer
      // above pushes it whole to the next page when it would straddle.)
      const offs = [0];
      let start = 0;
      let guard = 0;
      while (start + usable < totalH && guard < 60) {
        const limit = start + usable;
        let brk = 0;          // last body line-bottom at/under the edge
        let bisects = false;  // does a body line straddle the edge?
        for (const b of breaks) {
          if (b > start + 1 && b <= limit) brk = b;
          if (b > limit + 0.5 && b - lineH < limit - 0.5) bisects = true;
        }
        const next = bisects && brk > start ? brk : limit;
        offs.push(next);
        start = next;
        guard += 1;
      }
      setOffsets((prev) => (prev.length !== offs.length || prev.some((v, i) => Math.abs(v - offs[i]) > 0.5) ? offs : prev));
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
  const pageCount = offsets.length;

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
          {/* printable window: clips to this page's slice [offsets[p] … offsets[p+1]],
              which ends at a line gap so no line is bisected and pages don't overlap.
              Slice height = next offset − this offset (usableH for the last page). */}
          <div style={{ height: (p + 1 < offsets.length ? offsets[p + 1] - offsets[p] : usableH), overflow: 'hidden' }}>
            <div style={{ transform: `translateY(-${offsets[p] || 0}px)` }}>
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
