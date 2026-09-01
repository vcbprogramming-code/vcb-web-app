// The rendered meeting document — the A4 page inside the iframe.
//
// ---------------------------------------------------------------------------
// WHY THIS IS NOT TAILWIND, AND MUST NOT BE.
// ---------------------------------------------------------------------------
// The iframe holds a SEPARATE HTML DOCUMENT built from a srcdoc string. It has
// no <link> to this app's stylesheet, no build step of its own, and its body is
// server HTML that an editor typed — there are no className attributes to put
// utilities on, and Tailwind's scanner cannot see markup that only exists at
// runtime anyway.
//
// More importantly this stylesheet is the PRINTED PAGE. The @page block below
// is what makes the on-screen preview and the exported PDF break at the same
// place; every archived export was produced by these exact values. Restating
// them as utilities would change them, and every meeting minute already filed
// would reflow. It stays literal CSS, byte for byte.
// ---------------------------------------------------------------------------

import { qrcode } from './vendor/qrcodeGenerator.js';
import { esc } from './minutes.js';

/** Headings the project-tab summary extractor looks for, Thai and English. */
export const SUMMARY_RE =
  /สรุปผู้บริหาร|บทสรุป|executive\s*summary|key\s*takeaway|ประเด็นสำคัญ/i;
export const ACTION_RE =
  /action\s*item|รายการที่ต้องดำเนินการ|รายการที่ต้องทำ|สิ่งที่ต้องทำ|สิ่งที่ต้องดำเนินการ|ขั้นตอนถัดไป|ขั้นตอนต่อไป|มอบหมายงาน|next\s*step/i;

/** The letterhead. A legal entity name — never translated, never a t() key. */
export const COMPANY_NAME = 'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด';

export const OVERRIDE_CSS =
  'html,body{background:#fff;margin:0;}' +
  '.vcb-letterhead{font-size:21px;font-weight:700;color:#0b3d62;line-height:1.3;text-align:left;margin:0 0 4px;}' +
  '.vcb-letterdate{font-size:15px;color:#24486b;line-height:1.3;text-align:left;margin:0 0 12px;}' +
  '.ai-disclaimer{font-size:12.5px;color:#57606a;background:#f6f8fa;border:1px solid #d8dee4;border-radius:6px;padding:8px 12px;margin:0 0 16px;line-height:1.5;}' +
  // ALL page geometry lives on @page below — the only place both pagination
  // engines agree to read it from. body contributes nothing. Side padding here
  // was applied by Paged.js INSIDE its own page margin (a 64px narrower column
  // on screen, re-wrapping every paragraph); max-width:816px was a US-Letter
  // width contradicting an A4 page; and padding-bottom was reserved by Paged.js
  // on EVERY page but applied by Chrome only after the last element, drifting
  // the final break. See PAGINATION.md.
  'body{padding:0;max-width:none;margin:0;}' +
  // PAGE SIZE MUST BE EXPLICIT. Without `size`, Paged.js (the on-screen
  // preview) and Chrome's print engine pick DIFFERENT paper — Chrome uses
  // whatever the print dialog's destination is set to — and every page break
  // drifts. A4 is 18mm taller than Letter, so an A4 print fits ~68px more per
  // page and items slide a page earlier than the screen showed. Left/right
  // margins are stated too: without them Paged.js applied its own default side
  // margin while Chrome applied none.
  '@page{size:A4;margin:2.7cm 17mm 2cm;}' +
  // Fragmentation stated explicitly rather than left to each engine's default:
  // a heading is never stranded from its text, no paragraph splits leaving
  // fewer than 3 lines, and rows never tear.
  'h1,h2,h3,h4{break-after:avoid;page-break-after:avoid;break-inside:avoid;page-break-inside:avoid;}' +
  'p,li{orphans:3;widows:3;}' +
  'tr,img,li{break-inside:avoid;page-break-inside:avoid;}' +
  "body,p,span,td,th,li,h1,h2,h3,h4,a,div{font-family:'Sarabun','Noto Sans Thai',sans-serif !important;}" +
  'body{color:#1f2328;font-size:15px;line-height:1.55;}' +
  'h1{font-size:21px;color:#0b3d62;font-weight:700;margin:18px 0 10px;}' +
  'h2{font-size:17px;color:#0b3d62;font-weight:700;margin:14px 0 8px;}' +
  'h3{font-size:16px;color:#24486b;font-weight:700;margin:12px 0 6px;}' +
  'h4{font-size:15px;color:#24486b;font-weight:700;margin:10px 0 6px;}' +
  // Same row spacing as list rows, so a line keeps its height whether it is a
  // paragraph or a list item.
  'p{margin:0;padding:4px 0;}' +
  'img{max-width:100%;height:auto;}a{color:#1f6feb;}' +
  'table{border-collapse:collapse;width:100%;margin:14px 0;font-size:14px;}' +
  'td,th{border:1px solid #d8dee4;padding:7px 10px;vertical-align:top;}' +
  'th,tr:first-child td{background:#f1f5f9;font-weight:700;}' +
  // Row height must not depend on nesting: the container contributes nothing
  // vertically and each row owns its spacing (padding, which does not collapse).
  'ul,ol{margin:0;padding-left:26px;}li{margin:0;padding:4px 0;}' +
  // The tick is a REAL list marker (list-style-type), not ::marker content or a
  // ::before glyph — both of those failed to render portably. See PAGINATION.md.
  "li.tick-list{list-style-type:'✓  ';}li.tick-list::marker{color:#1a7f37;font-weight:700;}" +
  '.chip-file{display:inline-flex;align-items:center;gap:7px;border:1px solid #d8dee4;border-radius:8px;padding:4px 11px 4px 6px;margin:3px 7px 3px 0;text-decoration:none;color:#1f2328;background:#fff;font-size:13px;line-height:1.3;}' +
  '.chip-file:hover{border-color:#1f6feb;background:#f3f8ff;box-shadow:0 1px 4px rgba(27,31,36,.12);}' +
  '.chip-file .fi{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:18px;border-radius:3px;color:#fff;font-size:9px;font-weight:700;padding:0 3px;flex:none;}' +
  '.fi.xls{background:#1a7f37;}.fi.ppt{background:#d24726;}.fi.pdf{background:#cf222e;}.fi.doc{background:#1f6feb;}.fi.fld{background:#8b949e;}.fi.gen{background:#6e7781;}' +
  "@media print{a[href]:after{content:'';}.chip-file{border-color:#bbb;}}";

// Dark-mode variant of the A4 preview — wrapped entirely in @media screen so it
// can NEVER affect print output. A printed page is always white paper and black
// ink. Injected only when the app is dark; the iframe is a separate document
// and inherits nothing from the outer page's theme class.
export const DARK_OVERRIDE_CSS =
  '@media screen{' +
  'html,body{background:#161b22 !important;}' +
  'body{color:#c9d1d9 !important;}' +
  '.vcb-letterhead{color:#79c0ff !important;}' +
  '.vcb-letterdate{color:#8ab4e8 !important;}' +
  '.ai-disclaimer{color:#8b949e !important;background:#1c2128 !important;border-color:#30363d !important;}' +
  'h1,h2{color:#79c0ff !important;}h3,h4{color:#8ab4e8 !important;}' +
  'a{color:#58a6ff !important;}' +
  'td,th{border-color:#30363d !important;}' +
  'th,tr:first-child td{background:#1c2128 !important;}' +
  '.chip-file{border-color:#30363d !important;color:#c9d1d9 !important;background:#1c2128 !important;}' +
  '.chip-file:hover{border-color:#58a6ff !important;background:#161b22 !important;}' +
  '}';

/**
 * The AI-summary disclaimer, in both languages.
 *
 * DISPLAY ONLY. Injected at render time into the srcdoc, NEVER written into the
 * stored HTML. If it were part of stored content it would leak into `excerpt`
 * (the API takes the first 200 characters of the body) and into the server-side
 * search (which greps the stored body), matching every AI-sourced meeting on the
 * word "summary" and burying the real excerpt under fixed boilerplate.
 *
 * It is built from t() rather than hardcoded English because it appears on a
 * document a Thai reader reads — the original shipped English-only into a Thai
 * page.
 */
export function aiDisclaimerHtml(t) {
  return `<p class="ai-disclaimer"><b>${esc(t('doc.aiTitle'))}</b> ${esc(t('doc.aiBody'))}</p>`;
}

/**
 * Anti-tampering QR stamp for print/PDF — lives in the @page top-right MARGIN
 * BOX, sized via the SOURCE SVG's own intrinsic width/height XML attributes,
 * NOT any CSS override. Three other approaches were tried and confirmed broken
 * against REAL Chrome print preview (headless page.pdf() alone falsely passed
 * more than one of them):
 *   1) position:fixed — a fixed element's visible top edge is always pinned at
 *      the content-box boundary in Chromium's print engine; no `top` offset can
 *      move it into the page's blank margin.
 *   2) @page{@top-right{content:url(...);width:...;height:...}} — real Chrome
 *      ignored the CSS width/height entirely and rendered the QR at a huge,
 *      uncropped size overrunning the page.
 *   3) html{background-image} — a root-element background paints ONCE for the
 *      whole document, not per physical page; page 2+ came back blank.
 * This 4th variant was verified working on every page.
 *
 * One static QR per meeting (keyed on id, not on content or version), so
 * re-printing after an edit reuses the same code. It encodes the same live
 * share link the Share button copies — scanning a printed page opens the
 * current, authoritative version on the web app.
 */
export function verifyQrDataUri(link) {
  if (!link) return '';
  const qr = qrcode(0, 'M');
  qr.addData(link);
  qr.make();
  let svg = qr.createSvgTag({ cellSize: 4, margin: 4 });
  // createSvgTag emits width/height sized to the actual module count (which
  // varies with URL length) alongside a viewBox of the same size. Force the
  // OUTER width/height to a fixed 60x60 — margin-box images render at the
  // source SVG's intrinsic size — while leaving viewBox alone so the pattern
  // still scales to fit whatever its native module count is.
  svg = svg.replace(/width="[\d.]+px" height="[\d.]+px"/, 'width="60" height="60"');
  try {
    // btoa is Latin-1 only; the SVG is ASCII, but encode defensively.
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  } catch {
    return '';
  }
}

/**
 * padding-top nudges the image down within the margin box — confirmed working
 * in real Chrome print preview, unlike a width/height override on this same
 * rule, which Chrome ignores.
 */
export function buildQrPageCss(dataUri) {
  if (!dataUri) return '';
  return `@page{@top-right{content:url("${dataUri}");padding-top:38px;}}`;
}

/* ------------------------ project-tab summary extraction ------------------ */

function concise(input) {
  let t = (input || '').replace(/\s+/g, ' ').trim();
  const parts = t.split(/\s[|｜]\s|：\s?|:\s/);
  if (parts.length > 1) {
    const detail = parts.slice(1).join(' · ').trim();
    if (detail.length >= 12) t = detail;
  }
  if (t.length > 140) t = `${t.slice(0, 138).replace(/\s+\S*$/, '').trim()}…`;
  return t;
}

export function bulletsFromHtml(html, max = 4) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  const out = [];
  const seen = Object.create(null);
  const push = (raw) => {
    const t = concise(raw);
    const key = t.slice(0, 24);
    if (t.length < 6 || seen[key]) return;
    seen[key] = 1;
    out.push(t);
  };
  const lis = div.querySelectorAll('li');
  for (let i = 0; i < lis.length && out.length < max; i++) push(lis[i].textContent || '');
  if (!out.length) {
    const ps = div.querySelectorAll('p, h2, h3');
    for (let j = 0; j < ps.length && out.length < max; j++) {
      if ((ps[j].textContent || '').trim().length >= 24) push(ps[j].textContent || '');
    }
  }
  return out;
}

function headingRank(node) {
  if (!node || node.nodeType !== 1) return 0;
  return /^H[1-6]$/.test(node.tagName) ? +node.tagName.charAt(1) : 0;
}

/** Everything under the first heading matching `re`, up to the next peer heading. */
function sectionHtml(root, re) {
  const els = root.children;
  for (let i = 0; i < els.length; i++) {
    const r = headingRank(els[i]);
    if (!r || !re.test((els[i].textContent || '').replace(/\s+/g, ' '))) continue;
    const wrap = document.createElement('div');
    for (let j = i + 1; j < els.length; j++) {
      const ej = els[j];
      const rj = headingRank(ej);
      if (rj && rj <= r) break;
      if (!(ej.textContent || '').trim() && !ej.querySelector('img,table,hr')) continue;
      wrap.appendChild(ej.cloneNode(true));
    }
    // Strip the source's own styling so the extract inherits .doc-body instead
    // of carrying a Doc's inline fonts into the app's card.
    wrap.querySelectorAll('*').forEach((e) => {
      ['style', 'class', 'id', 'width', 'height', 'align', 'dir'].forEach((a) =>
        e.removeAttribute(a)
      );
    });
    return wrap.innerHTML.trim();
  }
  return '';
}

/**
 * The project-tab summary block: the Executive Summary section if the document
 * has one, else the first few bullets, else the excerpt.
 *
 * Returns an HTML string rendered through dangerouslySetInnerHTML and styled by
 * `.doc-body` in index.css — the only place in the app that does that.
 */
export function summaryHtml(html, excerpt, t) {
  const root = document.createElement('div');
  root.innerHTML = html || '';
  const summary = sectionHtml(root, SUMMARY_RE);
  if (summary) {
    return `<div class="seclabel">📌 ${esc(t('doc.execSummary'))}</div><div class="secbody">${summary}</div>`;
  }
  const bl = bulletsFromHtml(html, 4);
  if (bl.length) {
    return `<ul class="dash-bullets">${bl.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`;
  }
  return `<div class="bmuted">${esc(concise(excerpt) || t('doc.openToRead'))}</div>`;
}

/* ------------------------------ srcdoc builders --------------------------- */

/* ---------------- Real page preview, via Paged.js ------------------------
   The browser fragments a document into pages only while printing, and does not
   expose the result to JavaScript — there is no way to ask "where does page 2
   begin?". Computing it by hand is an approximation: it misses the engine's
   widow/orphan control and the rule that a heading is never stranded, so a
   heading sat on page 1 on screen but page 2 in the PDF.

   Paged.js reads the same @page rules the printer uses and lays the document
   out into real page elements, so the boundaries on screen are the boundaries
   the PDF will have. It runs ONLY in the preview; printing uses
   buildMeetingSrcdocForPrint below, which has no Paged.js at all, so PDF output
   is byte-for-byte what it was before. See PAGINATION.md. */
export const PAGED_PREVIEW_JS =
  '<script src="https://unpkg.com/pagedjs@0.4.3/dist/paged.polyfill.js"><\/script>';

/* Chrome around the paginated preview. Every rule needs `html` for extra
   specificity AND !important, because Paged.js injects its own stylesheet at
   runtime — after this one — and its rules would otherwise win. Without these
   the pages render as one continuous white column, exactly as if pagination
   never ran. */
export const PAGED_PREVIEW_CSS =
  '<style>@media screen{' +
  'html body{background:#eef1f4 !important;}' +
  'html .pagedjs_pages{display:flex !important;flex-direction:column !important;' +
  'align-items:center !important;gap:22px !important;padding:22px 0 !important;}' +
  'html .pagedjs_page{background:#fff !important;position:relative !important;' +
  'box-shadow:0 2px 10px rgba(0,0,0,.18) !important;}' +
  '}<\/style>';

/**
 * Build the iframe srcdoc for a rendered meeting.
 *
 * opts:
 *   isDark        inject DARK_OVERRIDE_CSS — must be re-evaluated on every
 *                 theme toggle, not once when the meeting first opens
 *   aiDisclaimer  prepend the disclaimer banner (caller gates on isAiSourced)
 *   t             the translator, for the disclaimer and the empty-body line
 *   pdfTitle      becomes <title>, which is the browser's default "Save as PDF"
 *                 filename when printing this iframe. This works only because
 *                 the iframe is a plain same-origin frame in a standalone SPA;
 *                 the same fix was tried and reverted in the Apps Script source,
 *                 where the IFRAME sandbox nests it below a document client code
 *                 cannot reach.
 *   pdfDate       "d.m.yy" BE, appended to that filename so exports are
 *                 distinguishable in a folder — every one was otherwise named
 *                 just "VCB Meeting Minutes"
 *   shareLink     the permalink the anti-tampering QR encodes; omit for no QR
 *   forPrint      omit Paged.js and the preview chrome
 */
export function buildMeetingSrcdoc(html, css, thaiDate, opts = {}) {
  const t = opts.t || ((k) => k);
  const docHtml = html || `<p>${esc(t('doc.noContent'))}</p>`;

  // A document that already opens with the company name does not get a second
  // letterhead stacked above it.
  const leadsWithCompany =
    String(docHtml).replace(/<[^>]*>/g, ' ').slice(0, 220).indexOf('วิจิตรภัณฑ์ก่อสร้าง') !== -1;
  const letterhead = leadsWithCompany
    ? ''
    : `<div class="vcb-letterhead">${COMPANY_NAME}</div>` +
      (thaiDate ? `<div class="vcb-letterdate">${esc(thaiDate)}</div>` : '');

  const disclaimer = opts.aiDisclaimer ? aiDisclaimerHtml(t) : '';

  // Stripped of characters invalid in a Windows/macOS filename (\ / : * ? " < >
  // |) so the browser does not silently mangle or reject the suggested name.
  const pdfBase = (opts.pdfTitle || 'Meeting').replace(/[\\/:*?"<>|]/g, '').trim() || 'Meeting';
  const pdfTitle = opts.pdfDate ? `${pdfBase} ${opts.pdfDate}` : pdfBase;

  const qrPageCss = opts.shareLink ? buildQrPageCss(verifyQrDataUri(opts.shareLink)) : '';

  const head =
    '<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank">' +
    `<title>${esc(pdfTitle)}</title>` +
    '<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">' +
    `<style>${css || ''}</style><style>${OVERRIDE_CSS}</style>` +
    (opts.isDark ? `<style>${DARK_OVERRIDE_CSS}</style>` : '') +
    (qrPageCss ? `<style>${qrPageCss}</style>` : '') +
    '</head>';

  const body = letterhead + disclaimer + docHtml;

  return opts.forPrint
    ? `${head}<body>${body}</body></html>`
    : `${head}<body>${body}${PAGED_PREVIEW_JS}${PAGED_PREVIEW_CSS}</body></html>`;
}

/**
 * The document exactly as it has always been produced — no Paged.js, no preview
 * chrome. Printing MUST use this: Paged.js has already split the preview into
 * page elements, so handing that to the print engine would paginate an
 * already-paginated document.
 */
export function buildMeetingSrcdocForPrint(html, css, thaiDate, opts = {}) {
  return buildMeetingSrcdoc(html, css, thaiDate, { ...opts, forPrint: true });
}

/**
 * The srcdoc for a read-only version preview. Simpler than the live render: no
 * Paged.js (it is a modal, not a page preview) and a header block naming the
 * snapshot's own title/date rather than the meeting's current ones.
 */
export function buildVersionSrcdoc({ html, title, projectName, dateLabel, time, isDark, aiDisclaimer, t }) {
  const tr = t || ((k) => k);
  const header =
    '<div style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #d8dee4;">' +
    `<div style="font-size:19px;font-weight:700;color:#0b3d62;">${esc(title)}</div>` +
    `<div style="font-size:13px;color:#57606a;margin-top:3px;">${esc(projectName || '')} · ${esc(dateLabel)}${time ? ` · ${esc(time)}` : ''}</div>` +
    '</div>';
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">' +
    `<style>${OVERRIDE_CSS}</style>` +
    (isDark ? `<style>${DARK_OVERRIDE_CSS}</style>` : '') +
    '</head><body>' +
    header +
    (aiDisclaimer ? aiDisclaimerHtml(tr) : '') +
    (html || `<p>${esc(tr('doc.empty'))}</p>`) +
    '</body></html>'
  );
}
