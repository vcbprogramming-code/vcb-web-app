import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = resolve(__dirname, '../../assets/fonts');
const FONT_REGULAR = resolve(FONT_DIR, 'Sarabun-Regular.ttf');
const FONT_BOLD = resolve(FONT_DIR, 'Sarabun-Bold.ttf');

/**
 * Parse an .xlsx Buffer into plain rows for previewing/rendering. Output is
 * capped so a huge workbook can't blow up the response/PDF.
 * @returns {Promise<{sheets: {name:string, rows:string[][]}[], truncated:boolean}>}
 */
export async function parseXlsxToSheets(buffer, { maxRows = 300, maxCols = 60 } = {}) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  let truncated = false;
  const sheets = [];
  wb.eachSheet((ws) => {
    const rows = [];
    let r = 0;
    ws.eachRow({ includeEmpty: true }, (row) => {
      if (r >= maxRows) { truncated = true; return; }
      const cells = [];
      let c = 0;
      row.eachCell({ includeEmpty: true }, (cell) => {
        if (c >= maxCols) { truncated = true; return; }
        let v = cell.text;
        if (v == null) {
          const raw = cell.value;
          v = raw == null ? '' : (typeof raw === 'object' ? (raw.result ?? raw.text ?? '') : raw);
        }
        cells.push(String(v));
        c += 1;
      });
      rows.push(cells);
      r += 1;
    });
    sheets.push({ name: ws.name, rows });
  });
  return { sheets, truncated };
}

/**
 * Render parsed spreadsheet rows as landscape-A4 table page(s) and resolve to a
 * PDF Buffer (Thai font). Used to fold an Excel attachment into the combined
 * document PDF as readable table pages. Basic table only — no colours/charts.
 */
export function renderSheetTablePdf(sheets, { title = 'ไฟล์แนบ (ตาราง)', truncated = false } = {}) {
  return new Promise((resolvePromise, reject) => {
    const pdf = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: 40, bottom: 40, left: 40, right: 40 } });
    const chunks = [];
    pdf.on('data', (c) => chunks.push(c));
    pdf.on('end', () => resolvePromise(Buffer.concat(chunks)));
    pdf.on('error', reject);
    pdf.registerFont('th', FONT_REGULAR);
    pdf.registerFont('th-bold', FONT_BOLD);

    const left = pdf.page.margins.left;
    const usableW = pdf.page.width - pdf.page.margins.left - pdf.page.margins.right;
    const pageBottom = pdf.page.height - pdf.page.margins.bottom;
    const MIN_COL_W = 46;
    const ROW_H = 18;

    const list = sheets.length ? sheets : [{ name: 'Sheet1', rows: [] }];

    list.forEach((sheet, si) => {
      if (si > 0) pdf.addPage();
      const rows = sheet.rows || [];
      const rawCols = rows.reduce((m, r) => Math.max(m, r.length), 0) || 1;
      let colCount = rawCols;
      let colW = usableW / colCount;
      let colsTruncated = false;
      if (colW < MIN_COL_W) {
        colCount = Math.max(1, Math.floor(usableW / MIN_COL_W));
        colW = usableW / colCount;
        colsTruncated = colCount < rawCols;
      }
      const tableW = colCount * colW;

      let y = 0;
      const drawTitle = () => {
        pdf.font('th-bold').fontSize(13).fillColor('#1f2a44')
          .text(`${title} — ${sheet.name}`, left, pdf.page.margins.top, { width: usableW, lineBreak: false });
        y = pdf.page.margins.top + 22;
      };
      const drawRow = (cells, isHeader) => {
        if (isHeader) pdf.rect(left, y, tableW, ROW_H).fill('#eef2f7');
        pdf.lineWidth(0.4).strokeColor('#cbd5e1');
        for (let c = 0; c < colCount; c += 1) pdf.rect(left + c * colW, y, colW, ROW_H).stroke();
        pdf.font(isHeader ? 'th-bold' : 'th').fontSize(8.5).fillColor('#1f2a44');
        for (let c = 0; c < colCount; c += 1) {
          const txt = cells[c] != null ? String(cells[c]) : '';
          pdf.text(txt, left + c * colW + 3, y + 5, { width: colW - 6, height: ROW_H - 7, lineBreak: false, ellipsis: true });
        }
        y += ROW_H;
      };

      drawTitle();
      if (rows.length === 0) {
        pdf.font('th').fontSize(9).fillColor('#94a3b8').text('(ไม่มีข้อมูลในชีตนี้)', left, y, { lineBreak: false });
        return;
      }
      const header = rows[0];
      drawRow(header, true);
      for (let r = 1; r < rows.length; r += 1) {
        if (y + ROW_H > pageBottom) { pdf.addPage(); drawTitle(); drawRow(header, true); }
        drawRow(rows[r], false);
      }
      if (colsTruncated || truncated) {
        if (y + 14 > pageBottom) { pdf.addPage(); drawTitle(); }
        const note = colsTruncated
          ? `* แสดง ${colCount} จาก ${rawCols} คอลัมน์แรก — ดาวน์โหลดไฟล์เพื่อดูทั้งหมด`
          : '* แสดงเพียงบางส่วน — ดาวน์โหลดไฟล์เพื่อดูทั้งหมด';
        pdf.font('th').fontSize(7.5).fillColor('#b45309').text(note, left, y + 4, { width: usableW, lineBreak: false });
      }
    });

    pdf.end();
  });
}
