import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = resolve(__dirname, '../../assets/fonts');
const FONT_REGULAR = resolve(FONT_DIR, 'Sarabun-Regular.ttf');
const FONT_BOLD = resolve(FONT_DIR, 'Sarabun-Bold.ttf');
const LOGO_PATH = resolve(__dirname, '../../assets/logo.png'); // optional

/** Format an ISO date as a Thai Buddhist-era long date: 25 พฤษภาคม 2569. */
function thaiLongDate(iso) {
  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
  ];
  const d = iso ? new Date(iso) : new Date();
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/**
 * Build an A4 official letter PDF matching Vichitbhan's real letterhead and
 * resolve to a Buffer.
 *
 * @param {object} doc    document row: doc_number, subject, recipient, body,
 *                        date_received, work_unit, enclosures[],
 *                        signer_name, signer_title, preparer_name
 * @param {object} letter embedded letterhead: companyName, companyNameEn,
 *                        address, logoUrl, phone, telex, fax,
 *                        signatoryName, signatoryTitle, closingLine
 */
export function generateLetterPdf(doc, letter = {}, opts = {}) {
  return new Promise((resolvePromise, reject) => {
    // bottom margin reserves room for the per-page QR strip (#7) so body text
    // auto-paginates above it instead of overlapping it. bufferPages lets us walk
    // every page at the end to stamp the QR (drawing inside a pageAdded handler
    // corrupts pdfkit's page state, so we stamp after all content is laid out).
    const pdf = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 74, left: 64, right: 56 }, bufferPages: true });
    const chunks = [];
    pdf.on('data', (c) => chunks.push(c));
    pdf.on('end', () => resolvePromise(Buffer.concat(chunks)));
    pdf.on('error', reject);

    pdf.registerFont('th', FONT_REGULAR);
    pdf.registerFont('th-bold', FONT_BOLD);

    const left = pdf.page.margins.left;
    const right = pdf.page.width - pdf.page.margins.right;
    const contentW = right - left;

    // ---- QR stamp on EVERY page (#7) — stamps the verification QR at the bottom
    // of every buffered page (incl. pages a long body flows onto). Called once at
    // the very end, after all content is laid out, so it never disturbs text flow.
    const stampQrAllPages = () => {
      if (!opts.qr?.buffer) return;
      const range = pdf.bufferedPageRange(); // { start, count }
      for (let i = range.start; i < range.start + range.count; i += 1) {
        pdf.switchToPage(i);
        const qrSize = 52;
        // sit inside the reserved bottom margin band (below the text region)
        const qrBottom = pdf.page.margins.bottom;
        const qrY = pdf.page.height - qrBottom + 14;
        // Drawing text near the page bottom makes pdfkit auto-add a page (the flow
        // sees no room), cascading into dozens of blank pages. Temporarily zero the
        // bottom margin so the absolute-positioned caption never triggers that.
        pdf.page.margins.bottom = 0;
        try {
          pdf.image(opts.qr.buffer, left, qrY, { fit: [qrSize, qrSize] });
          pdf.font('th').fontSize(6.5).fillColor('#94a3b8')
            .text('สแกนเพื่อตรวจสอบ', left + qrSize + 4, qrY + qrSize / 2 - 8, { width: 90, lineBreak: false });
          pdf.font('th').fontSize(6).fillColor('#cbd5e1')
            .text(doc.doc_number || '', left + qrSize + 4, qrY + qrSize / 2 + 1, { width: 90, lineBreak: false });
        } catch { /* ignore QR draw failure */ }
        pdf.page.margins.bottom = qrBottom;
      }
    };

    const INK = '#1a1a1a';
    const MUTED = '#5b6472';
    const RULE = '#1f2a44';

    // ---- Header: logo + company name (left) | contact block (right) ----
    const headerTop = pdf.y;
    // logo can be a Buffer (fetched from S3 by pdfDoc.js), else the bundled asset
    const logoSource = Buffer.isBuffer(letter.logoBuffer)
      ? letter.logoBuffer
      : (existsSync(LOGO_PATH) ? LOGO_PATH : null);
    const LOGO_SIZE = 58;
    const textX = logoSource ? left + LOGO_SIZE + 12 : left;

    // contact block (right) — drawn first so we know its width
    const contactW = 172;
    const contactX = right - contactW;
    pdf.font('th').fontSize(8.5).fillColor(MUTED);
    const contactLines = [
      ['โทร.', letter.phone],
      ['โทรสาร', letter.fax],
      ['เทเล็กซ์', letter.telex],
    ].filter(([, v]) => v);
    let cy = headerTop + 2;
    for (const [label, val] of contactLines) {
      pdf.text(`${label}`, contactX, cy, { width: 44, continued: false });
      pdf.text(String(val), contactX + 46, cy, { width: contactW - 46 });
      cy += 14;
    }

    // Measure the company-name text block height first so the logo can be
    // vertically centered against it (logo + text share a common center line).
    const nameW = contactX - textX - 12;
    const nameH = pdf.font('th-bold').fontSize(16).heightOfString(
      letter.companyName || 'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด', { width: nameW, lineBreak: false });
    const enH = letter.companyNameEn ? pdf.font('th').fontSize(10.5).heightOfString(letter.companyNameEn, { width: nameW, lineBreak: false }) + 1 : 0;
    const addrH = letter.address ? pdf.font('th').fontSize(8.5).heightOfString(letter.address, { width: nameW }) + 2 : 0;
    const textBlockH = nameH + enH + addrH;
    // the header row is as tall as the taller of logo / text block
    const rowH = Math.max(logoSource ? LOGO_SIZE : 0, textBlockH);
    const textTop = headerTop + (rowH - textBlockH) / 2;

    if (logoSource) {
      try {
        // center the logo vertically within the row
        pdf.image(logoSource, left, headerTop + (rowH - LOGO_SIZE) / 2, { fit: [LOGO_SIZE, LOGO_SIZE], align: 'center', valign: 'center' });
      } catch { /* ignore bad logo */ }
    }

    // company name (vertically centered against the logo)
    pdf.font('th-bold').fontSize(16).fillColor(INK)
      .text(letter.companyName || 'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด', textX, textTop, { width: nameW, lineBreak: false });
    if (letter.companyNameEn) {
      pdf.font('th').fontSize(10.5).fillColor(MUTED)
        .text(letter.companyNameEn, textX, pdf.y + 1, { width: nameW, lineBreak: false });
    }
    if (letter.address) {
      pdf.font('th').fontSize(8.5).fillColor(MUTED)
        .text(letter.address, textX, pdf.y + 2, { width: nameW });
    }

    // move below the tallest of: logo/text row, contact block
    const headerBottom = Math.max(headerTop + rowH + 4, pdf.y + 4, cy + 2);
    // double rule under the masthead — the classic official-letter look
    pdf.moveTo(left, headerBottom).lineTo(right, headerBottom).lineWidth(1.4).strokeColor(RULE).stroke();
    pdf.moveTo(left, headerBottom + 2.6).lineTo(right, headerBottom + 2.6).lineWidth(0.5).strokeColor(RULE).stroke();
    pdf.y = headerBottom + 14;

    // ---- บันทึกข้อความ — centered title ----
    pdf.font('th-bold').fontSize(22).fillColor(INK)
      .text('บันทึกข้อความ', left, pdf.y, { width: contentW, align: 'center', characterSpacing: 1 });
    pdf.moveDown(0.7);

    // ---- meta row: เลขที่เอกสาร (left) · วันที่ (right) ----
    pdf.font('th').fontSize(13).fillColor(INK);
    const metaY = pdf.y;
    pdf.font('th-bold').text('เลขที่', left, metaY, { continued: true })
      .font('th').text(`  ${doc.doc_number}`);
    pdf.font('th-bold').text('วันที่', left + contentW * 0.55, metaY, { width: contentW * 0.45, continued: true })
      .font('th').text(`  ${thaiLongDate(doc.date_received)}`, { width: contentW * 0.45 });
    pdf.y = Math.max(pdf.y, metaY + pdf.currentLineHeight());
    pdf.moveDown(0.5);

    // thin separator between the meta block and the subject/body
    pdf.moveTo(left, pdf.y).lineTo(right, pdf.y).lineWidth(0.5).strokeColor('#c8ced9').stroke();
    pdf.moveDown(0.6);

    // ---- เรื่อง / เรียน / อ้างถึง — aligned label column ----
    const labelW = 58;
    const valueX = left + labelW;
    const valueW = contentW - labelW;
    const fieldRow = (label, value) => {
      if (!value) return;
      const y = pdf.y;
      pdf.font('th-bold').fontSize(13.5).fillColor(INK).text(label, left, y, { width: labelW });
      pdf.font('th').fontSize(13.5).fillColor(INK).text(value, valueX, y, { width: valueW });
      pdf.y = Math.max(pdf.y, y + pdf.currentLineHeight());
      pdf.moveDown(0.35);
    };
    fieldRow('เรื่อง', doc.subject || '');
    fieldRow('เรียน', doc.recipient || letter.defaultRecipient);
    fieldRow('อ้างถึง', doc.reference);

    // ---- สิ่งที่ส่งมาด้วย (enclosures) ----
    const encl = Array.isArray(doc.enclosures) ? doc.enclosures : [];
    if (encl.length) {
      const y0 = pdf.y;
      pdf.font('th-bold').fontSize(13.5).fillColor(INK).text('สิ่งที่ส่งมาด้วย', left, y0, { width: labelW + 60 });
      let ey = y0;
      pdf.font('th').fontSize(13);
      encl.forEach((e, i) => {
        const name = `${i + 1}. ${e.name || ''}`;
        const qty = e.qty != null ? `จำนวน  ${e.qty}  ${e.unit || 'ชุด'}` : '';
        pdf.fillColor(INK).text(name, valueX + 60, ey, { width: valueW - 200, continued: false });
        if (qty) pdf.text(qty, right - 150, ey, { width: 150, align: 'right' });
        ey = pdf.y + 3;
      });
      pdf.y = Math.max(pdf.y, ey);
      pdf.moveDown(0.35);
    }
    pdf.moveDown(0.9);

    // ---- Body (auto-paginates onto extra pages when long) ----
    if (doc.body) {
      pdf.font('th').fontSize(13.5)
        .text(doc.body, left, pdf.y, { align: 'justify', lineGap: 5, indent: 48, width: contentW });
    }
    pdf.moveDown(1.2);

    // Keep the closing + signature block together: if it wouldn't fit in the
    // remaining space on this page, start a fresh page so it isn't orphaned or
    // split across the page break (matters once the body flows multi-page).
    const bottomLimit = pdf.page.height - pdf.page.margins.bottom;
    const sigBlockNeeded = 150; // closing + gap + name + title + preparer line
    if (pdf.y + sigBlockNeeded > bottomLimit) {
      pdf.addPage();
    }

    // ---- closing line, indented to the right area ----
    const closing = letter.closingLine || 'ขอแสดงความนับถือ';
    pdf.font('th').fontSize(13.5)
      .text(closing, left + contentW * 0.52, pdf.y, { width: contentW * 0.48, align: 'center' });

    const sigBlockX = left + contentW * 0.52;
    const sigBlockW = contentW * 0.48;
    const sigCenterX = sigBlockX + sigBlockW / 2;

    const SIG_BOX_H = 46;   // height reserved for the signature image / blank signing space
    const BLOCK_GAP = 14;   // breathing room between two signature blocks

    /**
     * Draw one signature block: optional caption, the signature image (or blank
     * signing space), the name in parentheses, then the job title. Blocks are spaced
     * apart so a reader can tell one signatory from the next at a glance.
     */
    const drawSignature = ({ image, name, title, caption }) => {
      if (caption) {
        pdf.font('th').fontSize(9.5).fillColor('#64748b')
          .text(caption, sigBlockX, pdf.y, { width: sigBlockW, align: 'center' });
        pdf.fillColor('#000');
      }
      const sigY = pdf.y + 2;
      let drew = false;
      if (image) {
        // `fit` keeps the image's own aspect ratio — width+height would squash a
        // signature that isn't exactly the box's proportions.
        try {
          pdf.image(image, sigCenterX - 55, sigY, { fit: [110, SIG_BOX_H - 6], align: 'center' });
          drew = true;
        } catch { /* ignore an unreadable image and leave blank signing space */ }
      }
      pdf.y = sigY + SIG_BOX_H;
      if (name) {
        pdf.font('th').fontSize(13.5).fillColor('#000')
          .text(`(${name})`, sigBlockX, pdf.y, { width: sigBlockW, align: 'center' });
      }
      if (title) {
        pdf.font('th').fontSize(12).fillColor('#334155')
          .text(title, sigBlockX, pdf.y, { width: sigBlockW, align: 'center' });
        pdf.fillColor('#000');
      }
    };

    // The SIGNER (ผู้ลงนาม) ALWAYS signs under "ขอแสดงความนับถือ" — they are the person
    // issuing the memo, so their block appears on every version. The project
    // signatory's configured signature is stamped automatically; the author's own
    // uploaded signature takes precedence. pdfDoc.js resolves doc.signer_name/title.
    const sigImage = opts.authorSignature
      || (Buffer.isBuffer(letter.signatureBuffer) ? letter.signatureBuffer : null);
    drawSignature({
      image: sigImage,
      name: doc.signer_name || letter.signatoryName,
      title: doc.signer_title || letter.signatoryTitle,
    });

    // The APPROVED version stamps each approver below the signer. They are captioned
    // and set off by a rule, so the issuer's signature is never mistaken for an
    // approval — previously every block looked identical and ran together.
    const signatures = Array.isArray(opts.signatures) ? opts.signatures : null;
    if (signatures && signatures.length) {
      // keep the whole approval group on one page rather than splitting a block
      const groupH = 18 + signatures.length * (SIG_BOX_H + 34 + BLOCK_GAP);
      const bottomLimit = pdf.page.height - pdf.page.margins.bottom - 60; // clear of the QR strip
      if (pdf.y + groupH > bottomLimit) pdf.addPage();

      pdf.y += BLOCK_GAP;
      const ruleY = pdf.y;
      pdf.moveTo(sigBlockX + 26, ruleY).lineTo(sigBlockX + sigBlockW - 26, ruleY)
        .lineWidth(0.5).strokeColor('#cbd5e1').stroke();
      pdf.y = ruleY + 10;

      signatures.forEach((s, i) => {
        drawSignature({
          image: s.image,
          name: s.name,
          title: s.title,
          caption: signatures.length > 1 ? `ผู้อนุมัติลำดับที่ ${i + 1}` : 'ผู้อนุมัติ',
        });
        if (i < signatures.length - 1) pdf.y += BLOCK_GAP;
      });
    }

    // ---- ผู้จัดทำ (preparer) line at the bottom-left — only when the preparer is
    // a different person from the signer, so the reader can see who prepared it.
    const preparer = doc.preparer_name;
    const signerShown = doc.signer_name || letter.signatoryName;
    if (preparer && preparer !== signerShown) {
      pdf.moveDown(1.5);
      pdf.font('th').fontSize(10.5).fillColor('#666')
        .text(`ผู้จัดทำ: ${preparer}`, left, pdf.y, { width: contentW });
    }

    // (verification QR is now stamped on EVERY page via stampQr/pageAdded — see top)

    // ---- ความเห็น / การพิจารณา box — moved to the LAST page (#7) ----
    // The client wants the body to flow naturally across 1–2 pages and this box to
    // appear at the END (not forced onto the foot of page 1, where it used to push
    // the content up). Shows any approver comments recorded, plus a checker/approver
    // signature row. Skipped when opts.commentBox === false (clean original).
    const commentSteps = Array.isArray(opts.auditSteps)
      ? opts.auditSteps.filter((s) => s.comment && s.comment.trim())
      : [];
    // Approvers now sign digitally (their signature blocks are stamped above), so the
    // box no longer carries blank "ลงชื่อ ..... ผู้ตรวจสอบ / ผู้อนุมัติ" slots for a wet
    // signature — that implied the memo still needed signing by hand. It now only
    // reports what the approvers actually wrote, and is skipped entirely when nobody
    // left a comment (an empty titled box says nothing).
    const wantCommentBox = opts.commentBox !== false && commentSteps.length > 0;
    if (wantCommentBox) {
      // measure the real wrapped height of each comment line first, so the box
      // rectangle is tall enough and long comments never spill outside its border.
      pdf.font('th').fontSize(10.5);
      const commentLines = commentSteps.map((s) => {
        const who = s.approver_name || s.approver_email || '';
        const textLine = `• ${who}: ${s.comment}`;
        const h = pdf.heightOfString(textLine, { width: contentW - 24 });
        return { text: textLine, h };
      });
      const commentsH = commentLines.reduce((sum, c) => sum + c.h + 3, 0);
      const headerH = 26;   // "ความเห็น / การพิจารณา" title band
      const boxNeed = headerH + commentsH + 18;

      const bottomLimit = pdf.page.height - pdf.page.margins.bottom - 60; // clear of the QR strip
      // start a fresh page only if the box won't fit in the remaining space
      if (pdf.y + boxNeed > bottomLimit) pdf.addPage();
      else pdf.y = pdf.y + 18;

      const boxTop = pdf.y;
      pdf.rect(left, boxTop, contentW, boxNeed - 8).lineWidth(0.6).strokeColor('#94a3b8').stroke();
      pdf.font('th-bold').fontSize(11).fillColor('#0f172a')
        .text('ความเห็น / การพิจารณา', left + 10, boxTop + 8, { width: contentW - 20 });

      let cy = boxTop + headerH;
      pdf.font('th').fontSize(10.5).fillColor('#334155');
      for (const c of commentLines) {
        pdf.text(c.text, left + 12, cy, { width: contentW - 24 });
        cy = pdf.y + 3;
      }
      pdf.y = boxTop + boxNeed;
    }

    // ---- "บันทึกการพิจารณา" page (approval trail) ----
    const trail = Array.isArray(opts.auditSteps) ? opts.auditSteps.filter((s) => s.action && s.action !== 'pending') : [];
    if (trail.length) {
      const actionTH = { approved: 'อนุมัติ', returned: 'ส่งกลับแก้ไข', rejected: 'ไม่อนุมัติ' };
      pdf.addPage();
      pdf.font('th-bold').fontSize(18).fillColor('#000')
        .text('บันทึกการพิจารณา', left, pdf.y, { width: contentW, align: 'center' });
      pdf.moveDown(0.4);
      pdf.font('th').fontSize(12).fillColor('#555')
        .text(`เลขที่เอกสาร ${doc.doc_number}  ·  เรื่อง ${doc.subject || ''}`, left, pdf.y, { width: contentW, align: 'center' });
      pdf.moveDown(1);

      trail.forEach((s, i) => {
        const acted = s.acted_at ? thaiLongDate(s.acted_at) : '';
        // card-ish row
        const top = pdf.y;
        pdf.font('th-bold').fontSize(13).fillColor('#000')
          .text(`${i + 1}. ${s.approver_name || s.approver_email || ''}`, left, top, { width: contentW - 120, continued: false });
        pdf.font('th').fontSize(12).fillColor(
          s.action === 'approved' ? '#16a34a' : s.action === 'rejected' ? '#dc2626' : '#ea580c'
        ).text(actionTH[s.action] || s.action, left + contentW - 120, top, { width: 120, align: 'right' });
        if (acted) {
          pdf.font('th').fontSize(10).fillColor('#888').text(acted, left, pdf.y, { width: contentW });
        }
        if (s.comment) {
          pdf.font('th').fontSize(11.5).fillColor('#333')
            .text(`เหตุผล/ความเห็น: ${s.comment}`, left + 14, pdf.y + 2, { width: contentW - 14 });
        }
        pdf.moveDown(0.8);
      });
    }

    // stamp the verification QR on every page now that all content is laid out (#7)
    stampQrAllPages();

    pdf.end();
  });
}
