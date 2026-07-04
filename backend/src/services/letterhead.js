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
    const pdf = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 64, right: 56 } });
    const chunks = [];
    pdf.on('data', (c) => chunks.push(c));
    pdf.on('end', () => resolvePromise(Buffer.concat(chunks)));
    pdf.on('error', reject);

    pdf.registerFont('th', FONT_REGULAR);
    pdf.registerFont('th-bold', FONT_BOLD);

    const left = pdf.page.margins.left;
    const right = pdf.page.width - pdf.page.margins.right;
    const contentW = right - left;

    // ---- Header: logo + company name (left) | contact block (right) ----
    const headerTop = pdf.y;
    let textX = left;
    if (letter.logoUrl && existsSync(letter.logoUrl)) {
      try {
        pdf.image(letter.logoUrl, left, headerTop, { width: 64, height: 64 });
        textX = left + 76;
      } catch { /* ignore bad logo */ }
    } else if (existsSync(LOGO_PATH)) {
      try {
        pdf.image(LOGO_PATH, left, headerTop, { width: 64, height: 64 });
        textX = left + 76;
      } catch { /* ignore */ }
    }

    // contact block (right) — drawn first so we know its width
    const contactW = 175;
    const contactX = right - contactW;
    pdf.font('th').fontSize(8.5).fillColor('#333');
    const contactLines = [
      ['โทรศัพท์', letter.phone],
      ['เทเล็กซ์', letter.telex],
      ['โทรสาร', letter.fax],
    ].filter(([, v]) => v);
    let cy = headerTop;
    for (const [label, val] of contactLines) {
      pdf.text(`${label} :`, contactX, cy, { width: 58, continued: false });
      pdf.text(String(val), contactX + 62, cy, { width: contactW - 62 });
      cy += 16;
    }

    // company name (between logo and contact block) — keep on a single line
    const nameW = contactX - textX - 10;
    pdf.font('th-bold').fontSize(16).fillColor('#000')
      .text(letter.companyName || 'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด', textX, headerTop + 8, { width: nameW, lineBreak: false });
    if (letter.companyNameEn) {
      pdf.font('th-bold').fontSize(13).fillColor('#000')
        .text(letter.companyNameEn, textX, pdf.y, { width: nameW, lineBreak: false });
    }
    // move below the tallest of: logo(64), company name block, contact block
    pdf.y = Math.max(headerTop + 70, pdf.y + 6, cy + 4);
    pdf.moveDown(0.3);

    // ---- บันทึกข้อความ — centered title ----
    pdf.font('th-bold').fontSize(20).fillColor('#000')
      .text('บันทึกข้อความ', left, pdf.y, { width: contentW, align: 'center' });
    pdf.moveDown(0.8);

    // ---- "ที่ <doc_number>" + date (right) ----
    pdf.font('th').fontSize(13.5).fillColor('#000');
    const rowY = pdf.y;
    pdf.text(`เอกสารเลขที่   ${doc.doc_number}`, left, rowY);
    pdf.moveDown(0.6);
    pdf.text(thaiLongDate(doc.date_received), left, pdf.y, { width: contentW, align: 'center' });
    pdf.moveDown(0.8);

    // ---- เรื่อง / เรียน ----
    const labelGap = 52;
    pdf.font('th').fontSize(13.5);
    pdf.text('เรื่อง', left, pdf.y, { continued: false });
    pdf.text(doc.subject || '', left + labelGap, pdf.y - pdf.currentLineHeight(), { width: contentW - labelGap });
    pdf.moveDown(0.4);

    const recipient = doc.recipient || letter.defaultRecipient;
    if (recipient) {
      pdf.text('เรียน', left, pdf.y);
      pdf.text(recipient, left + labelGap, pdf.y - pdf.currentLineHeight(), { width: contentW - labelGap });
      pdf.moveDown(0.4);
    }

    // ---- อ้างถึง (reference) ----
    if (doc.reference) {
      pdf.text('อ้างถึง', left, pdf.y);
      pdf.text(doc.reference, left + labelGap, pdf.y - pdf.currentLineHeight(), { width: contentW - labelGap });
      pdf.moveDown(0.4);
    }

    // ---- สิ่งที่ส่งมาด้วย (enclosures) ----
    const encl = Array.isArray(doc.enclosures) ? doc.enclosures : [];
    if (encl.length) {
      pdf.text('สิ่งที่ส่งมาด้วย', left, pdf.y);
      let ey = pdf.y - pdf.currentLineHeight();
      encl.forEach((e, i) => {
        const name = `${i + 1}.${e.name || ''}`;
        const qty = e.qty != null ? `จำนวน  ${e.qty}  ${e.unit || 'ชุด'}` : '';
        pdf.text(name, left + 110, ey, { width: 220, continued: false });
        if (qty) pdf.text(qty, left + 340, ey, { width: contentW - 340 - left + left });
        ey += pdf.currentLineHeight() + 4;
      });
      pdf.y = ey;
    }
    pdf.moveDown(1);

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

    /** Draw one signature block (image or blank line) + name + title. */
    const drawSignature = ({ image, name, title }) => {
      pdf.moveDown(0.3);
      const sigY = pdf.y;
      let drew = false;
      if (image) {
        // `image` is a Buffer (approver sig) or a local path
        try { pdf.image(image, sigCenterX - 45, sigY, { width: 90, height: 42 }); drew = true; } catch { /* ignore */ }
      }
      if (drew) pdf.y = sigY + 46; else pdf.moveDown(2.5);
      if (name) {
        pdf.font('th').fontSize(13.5)
          .text(`(${name})`, sigBlockX, pdf.y, { width: sigBlockW, align: 'center' });
      }
      if (title) {
        pdf.font('th').fontSize(13.5)
          .text(title, sigBlockX, pdf.y, { width: sigBlockW, align: 'center' });
      }
    };

    // Approved version passes `signatures` (one per approver, with image Buffer).
    // Otherwise fall back to the letterhead's default single signatory block.
    const signatures = Array.isArray(opts.signatures) ? opts.signatures : null;
    if (signatures && signatures.length) {
      signatures.forEach((s) => drawSignature({ image: s.image, name: s.name, title: s.title }));
    } else {
      // the author's uploaded signature image (Buffer) takes precedence; else the
      // letterhead's configured default signature image; else just the name text
      const sigImage = opts.authorSignature
        || (letter.signatureUrl && existsSync(letter.signatureUrl) ? letter.signatureUrl : null);
      // the signature block shows the SIGNER (ผู้เซ็น) — which may differ from the
      // preparer. pdfDoc.js already resolves doc.signer_name/title (falling back to
      // the author, then the letterhead's configured signatory).
      drawSignature({
        image: sigImage,
        name: doc.signer_name || letter.signatoryName,
        title: doc.signer_title || letter.signatoryTitle,
      });
    }

    // ---- ผู้จัดทำ (preparer) line at the bottom-left — only when the preparer is
    // a different person from the signer, so the reader can see who prepared it.
    const preparer = doc.preparer_name;
    const signerShown = (signatures && signatures.length)
      ? null
      : (doc.signer_name || letter.signatoryName);
    if (preparer && preparer !== signerShown) {
      pdf.moveDown(1.5);
      pdf.font('th').fontSize(10.5).fillColor('#666')
        .text(`ผู้จัดทำ: ${preparer}`, left, pdf.y, { width: contentW });
    }

    // ---- ความเห็น / การพิจารณา box at the BOTTOM of the first page ----
    // Mirrors the client's real memos where reviewers write their comment and
    // sign at the foot of page 1. Shows any approver comments already recorded,
    // plus a "ผู้ตรวจสอบ / ผู้อนุมัติ" signature row. Skipped when opts.commentBox
    // is explicitly false (e.g. a clean original with nothing to show yet).
    const commentSteps = Array.isArray(opts.auditSteps)
      ? opts.auditSteps.filter((s) => s.comment && s.comment.trim())
      : [];
    const wantCommentBox = opts.commentBox !== false;
    if (wantCommentBox) {
      // put the box near the page bottom; start a new page only if there's very
      // little room left so it never collides with the signature block
      const bottomLimit = pdf.page.height - pdf.page.margins.bottom;
      const boxNeed = 96 + commentSteps.length * 16;
      if (pdf.y + boxNeed > bottomLimit) pdf.addPage();
      else pdf.y = Math.max(pdf.y + 12, bottomLimit - boxNeed);

      const boxTop = pdf.y;
      pdf.rect(left, boxTop, contentW, boxNeed - 8).lineWidth(0.6).strokeColor('#94a3b8').stroke();
      pdf.font('th-bold').fontSize(11).fillColor('#0f172a')
        .text('ความเห็น / การพิจารณา', left + 10, boxTop + 8, { width: contentW - 20 });

      let cy = boxTop + 26;
      pdf.font('th').fontSize(10.5).fillColor('#334155');
      for (const s of commentSteps) {
        const who = s.approver_name || s.approver_email || '';
        pdf.text(`• ${who}: ${s.comment}`, left + 12, cy, { width: contentW - 24 });
        cy = pdf.y + 3;
      }

      // signature slots row (checker / approver)
      const slotY = boxTop + boxNeed - 40;
      const half = contentW / 2;
      pdf.font('th').fontSize(10).fillColor('#475569');
      pdf.text('ลงชื่อ ...........................................', left + 12, slotY, { width: half - 20 });
      pdf.text('ผู้ตรวจสอบ', left + 12, slotY + 15, { width: half - 20 });
      pdf.text('ลงชื่อ ...........................................', left + half, slotY, { width: half - 20 });
      pdf.text('ผู้อนุมัติ', left + half, slotY + 15, { width: half - 20 });
      pdf.y = slotY + 34;
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

    pdf.end();
  });
}
