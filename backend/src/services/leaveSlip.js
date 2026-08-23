import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = resolve(__dirname, '../../assets/fonts');
const FONT_REGULAR = resolve(FONT_DIR, 'Sarabun-Regular.ttf');
const FONT_BOLD = resolve(FONT_DIR, 'Sarabun-Bold.ttf');
const LOGO_PATH = resolve(__dirname, '../../assets/logo.png');

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const thaiDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
};
const LEAVE_TH = {
  sick: 'ลาป่วย', personal: 'ลากิจ', vacation: 'ลาพักผ่อน',
  maternity: 'ลาคลอด', ordination: 'ลาบวช', other: 'อื่น ๆ',
};
const STATUS_TH = { pending: 'รออนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ', cancelled: 'ยกเลิกแล้ว' };

/**
 * ใบลา — the request as a sheet of paper someone can sign and file.
 *
 * A leave record lives in the system, but site offices still keep a paper file
 * and the person approving often wants something to hold. This prints what was
 * actually asked and decided; it is not a form to fill in by hand, so nothing
 * here is a blank rule waiting for a pen except the two signature lines that
 * genuinely need one.
 *
 * The layout follows the same discipline as the memo letterhead: one type scale,
 * labels on a fixed column so no value starts at a different x on any row, and
 * no wrapping inside a label — a label that wraps drops its row's baseline and
 * the whole grid stops reading as a grid.
 */
export function buildLeaveSlip(row, { company = 'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด' } = {}) {
  // The site records its company as "วิจิตรภัณฑ์ก่อสร้าง จำกัด" — fine as a label
  // in a dropdown, wrong at the head of a formal slip. Add the prefix for print
  // rather than editing the client's own data to suit one document.
  const orgName = /^บริษัท|^ห้าง|^บมจ/.test(company.trim()) ? company.trim() : `บริษัท ${company.trim()}`;
  const pdf = new PDFDocument({ size: 'A4', margins: { top: 48, bottom: 48, left: 56, right: 56 } });
  pdf.registerFont('th', FONT_REGULAR);
  pdf.registerFont('th-bold', FONT_BOLD);

  const left = pdf.page.margins.left;
  const contentW = pdf.page.width - left - pdf.page.margins.right;
  const LABEL_W = 96;          // wide enough that no label in this form wraps
  const GAP = 10;
  const colW = (contentW - 28) / 2;

  // ── หัวกระดาษ ────────────────────────────────────────────────────────────
  let y = pdf.y;
  if (existsSync(LOGO_PATH)) {
    try { pdf.image(LOGO_PATH, left, y - 2, { fit: [40, 40] }); } catch { /* optional */ }
  }
  pdf.font('th-bold').fontSize(15).fillColor('#000')
    .text(orgName, left + 50, y, { width: contentW - 50 });
  pdf.font('th').fontSize(10.5).fillColor('#444')
    .text('บันทึกการทำงานรายวัน · ใบลา', left + 50, pdf.y, { width: contentW - 50 });
  pdf.moveDown(0.8);
  pdf.moveTo(left, pdf.y).lineTo(left + contentW, pdf.y).lineWidth(1).strokeColor('#000').stroke();
  pdf.moveDown(0.9);

  pdf.font('th-bold').fontSize(18).fillColor('#000')
    .text('ใบลา', left, pdf.y, { width: contentW, align: 'center' });
  pdf.moveDown(0.8);

  // ── เลขที่ / วันที่ยื่น ──────────────────────────────────────────────────
  const shortId = String(row.id).slice(0, 8).toUpperCase();
  y = pdf.y;
  pdf.font('th').fontSize(10.5).fillColor('#444')
    .text(`เลขที่  ${shortId}`, left, y, { width: colW });
  pdf.text(`วันที่ยื่นคำขอ  ${thaiDate(row.requested_at)}`, left + colW + 28, y, { width: colW, align: 'right' });
  pdf.moveDown(1.1);

  // ── ตารางข้อมูล ──────────────────────────────────────────────────────────
  /** One label/value row. Values sit on a rule so the sheet still reads as a
   *  form when a field is empty, rather than leaving a gap with nothing in it. */
  const field = (label, value, { half = false, x = left, width = contentW } = {}) => {
    const top = pdf.y;
    pdf.font('th').fontSize(10.5).fillColor('#555')
      .text(label, x, top, { width: LABEL_W, lineBreak: false });
    const vx = x + LABEL_W + GAP;
    const vw = width - LABEL_W - GAP;
    pdf.fillColor('#000').font('th-bold')
      .text(value || '—', vx, top, { width: vw, lineBreak: !half, ellipsis: half });
    const bottom = Math.max(pdf.y, top + 15);
    pdf.moveTo(vx, bottom - 2).lineTo(x + width, bottom - 2)
      .lineWidth(0.5).strokeColor('#c8ccd4').stroke();
    return bottom;
  };
  const pairRow = (l1, v1, l2, v2) => {
    const top = pdf.y;
    const b1 = field(l1, v1, { half: true, x: left, width: colW });
    pdf.y = top;
    const b2 = field(l2, v2, { half: true, x: left + colW + 28, width: colW });
    pdf.y = Math.max(b1, b2) + 8;
  };

  pairRow('ชื่อพนักงาน', row.employee_name, 'รหัสพนักงาน', row.employee_code);
  pairRow('ตำแหน่ง', row.position || '', 'หน่วยงาน', row.site_name || '');

  const days = row.days || 0;
  pairRow('ประเภทการลา', LEAVE_TH[row.leave_type] || row.leave_type, 'จำนวนวัน', days ? `${days} วัน` : '');
  pdf.y = field('ช่วงวันที่ลา', `${thaiDate(row.from_date)}  ถึง  ${thaiDate(row.to_date)}`) + 8;
  pdf.y = field('เหตุผล', row.reason || '') + 8;

  // ── ผลการพิจารณา ────────────────────────────────────────────────────────
  pdf.moveDown(0.6);
  pdf.font('th-bold').fontSize(11.5).fillColor('#000').text('ผลการพิจารณา', left, pdf.y);
  pdf.moveDown(0.4);
  pairRow('สถานะ', STATUS_TH[row.status] || row.status,
    'วันที่ตัดสิน', row.decided_at ? thaiDate(row.decided_at) : '');
  pairRow('ผู้พิจารณา', row.decided_by_name || '', 'ผู้บันทึกคำขอ', row.requested_by_name || '');
  if (row.decide_note) pdf.y = field('หมายเหตุ', row.decide_note) + 8;

  // ── ลงชื่อ ───────────────────────────────────────────────────────────────
  // Two equal columns so both rules end at the same x — a signature block whose
  // lines are different lengths reads as an accident.
  pdf.moveDown(2.2);
  const sigTop = pdf.y;
  const sig = (title, name, x) => {
    pdf.moveTo(x, sigTop + 26).lineTo(x + colW, sigTop + 26).lineWidth(0.5).strokeColor('#666').stroke();
    pdf.font('th').fontSize(10.5).fillColor('#000')
      .text(name ? `(${name})` : '(                              )', x, sigTop + 32, { width: colW, align: 'center' });
    pdf.fillColor('#555').text(title, x, pdf.y + 1, { width: colW, align: 'center' });
  };
  sig('ผู้ขอลา', row.employee_name, left);
  pdf.y = sigTop;
  sig('ผู้อนุมัติ', row.decided_by_name, left + colW + 28);

  // ── ท้ายกระดาษ ───────────────────────────────────────────────────────────
  const footY = pdf.page.height - pdf.page.margins.bottom - 12;
  pdf.font('th').fontSize(9).fillColor('#888')
    .text(`เอกสารนี้พิมพ์จากระบบบันทึกการทำงานรายวัน · ${thaiDate(new Date())}`,
      left, footY, { width: contentW, align: 'center' });

  pdf.end();
  return pdf;
}
