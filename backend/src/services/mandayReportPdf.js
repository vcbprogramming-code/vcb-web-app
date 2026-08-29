import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = resolve(__dirname, '../../assets/fonts');

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const thaiDate = (v) => {
  const d = new Date(v);
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
};
const money = (n) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * §8 the man-day report as a PDF.
 *
 * The Excel file is what finance takes away and totals; this is what gets
 * printed and put in front of a meeting. Same figures, same column order and
 * same headings as the screen — the criteria are explicit that they must match,
 * so both are built from the one row set the API already returned.
 */
export function buildMandayReportPdf({ title, groupLabel, meta, rows, totals }) {
  const pdf = new PDFDocument({ size: 'A4', margin: 42, layout: 'landscape' });
  pdf.registerFont('th', resolve(FONT_DIR, 'Sarabun-Regular.ttf'));
  pdf.registerFont('th-bold', resolve(FONT_DIR, 'Sarabun-Bold.ttf'));
  const chunks = [];
  pdf.on('data', (c) => chunks.push(c));
  const done = new Promise((res) => pdf.on('end', () => res(Buffer.concat(chunks))));

  const left = pdf.page.margins.left;
  const width = pdf.page.width - left - pdf.page.margins.right;

  pdf.font('th-bold').fontSize(17).fillColor('#0f172a').text(title, left, pdf.y);
  pdf.font('th').fontSize(11).fillColor('#475569').text(groupLabel, { width });
  pdf.moveDown(0.4);

  // §8 every report says what it covers, when it was taken, and by whom
  pdf.fontSize(9.5).fillColor('#64748b');
  pdf.text(`ช่วงข้อมูล ${thaiDate(meta.from)} ถึง ${thaiDate(meta.to)}`, { width });
  pdf.text(`ดึงข้อมูลเมื่อ ${new Date(meta.generatedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })} · โดย ${meta.generatedBy || '-'}`, { width });
  pdf.moveDown(0.6);

  const cols = [
    { key: 'key', label: 'รหัส', w: 110, align: 'left' },
    { key: 'label', label: 'รายการ', w: width - 110 - 120 - 100, align: 'left' },
    { key: 'manday', label: 'แรงงาน-วัน', w: 120, align: 'right' },
    { key: 'people', label: 'จำนวนคน', w: 100, align: 'right' },
  ];
  const rowH = 20;

  const header = () => {
    let x = left;
    pdf.rect(left, pdf.y, width, rowH).fill('#f1f5f9');
    pdf.fillColor('#0f172a').font('th-bold').fontSize(10);
    const y = pdf.y + 5;
    for (const c of cols) { pdf.text(c.label, x + 6, y, { width: c.w - 12, align: c.align }); x += c.w; }
    pdf.y += rowH;
  };
  header();

  pdf.font('th').fontSize(10).fillColor('#0f172a');
  for (const r of rows) {
    if (pdf.y + rowH > pdf.page.height - pdf.page.margins.bottom - 40) {
      pdf.addPage({ size: 'A4', margin: 42, layout: 'landscape' });
      header();
      pdf.font('th').fontSize(10).fillColor('#0f172a');
    }
    let x = left;
    const y = pdf.y + 4;
    for (const c of cols) {
      const v = c.key === 'manday' ? money(r.manday) : String(r[c.key] ?? '');
      pdf.text(v, x + 6, y, { width: c.w - 12, align: c.align, lineBreak: false });
      x += c.w;
    }
    pdf.moveTo(left, pdf.y + rowH - 1).lineTo(left + width, pdf.y + rowH - 1).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    pdf.y += rowH;
  }

  pdf.moveDown(0.3);
  pdf.font('th-bold').fontSize(11).fillColor('#0f172a')
    .text(`รวมทั้งสิ้น ${money(totals.manday)} แรงงาน-วัน · ${totals.people || 0} คน · ${rows.length} รายการ`, left, pdf.y, { width, align: 'right' });

  pdf.end();
  return done;
}
