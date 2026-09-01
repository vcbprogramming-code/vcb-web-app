// Excel import and export, via ExcelJS.
//
// The Buddhist-era trap lives here. HR's source workbooks label months in the
// Thai calendar — a sheet named 2569-08 is Gregorian 2026-08, not 2569. The
// offset is 543 years. Getting this wrong does not throw; it silently files a
// year of work under the wrong date, which is only noticed when a report is
// 543 years out. Use the helpers below rather than parsing years by hand.

import ExcelJS from 'exceljs';

const BE_OFFSET = 543;

/** Buddhist era → Gregorian. 2569 → 2026. */
export function beToGregorian(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return NaN;
  // Anything past 2400 is unambiguously BE; a plain 2026 is already Gregorian.
  return y > 2400 ? y - BE_OFFSET : y;
}

/** Gregorian → Buddhist era, for display back to Thai users. */
export function gregorianToBe(year) {
  const y = Number(year);
  return Number.isFinite(y) ? (y > 2400 ? y : y + BE_OFFSET) : NaN;
}

/**
 * Parse a sheet/tab name like "2569-08" or "2569/8" into { year, month },
 * with the year already converted to Gregorian. Returns null if it is not a
 * month tab — plenty of sheets are named other things.
 */
export function parseMonthTab(name) {
  const m = String(name || '').match(/(\d{4})[-/_.](\d{1,2})/);
  if (!m) return null;
  const year = beToGregorian(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { year, month };
}

/**
 * Build a workbook from rows.
 *
 * columns: [{ key, header, width }]
 */
export async function toWorkbook(sheets) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'VCB Connect';
  wb.created = new Date();

  for (const { name, columns, rows } of sheets) {
    const ws = wb.addWorksheet(name);
    ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 18 }));

    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F3864' },
    };
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    for (const row of rows) ws.addRow(row);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/**
 * Read a workbook into { sheetName: [ {header: value} ] }.
 *
 * Blank cells come back as null, never ''. In HR that distinction is load
 * bearing: an empty cell means no entry that day, while an empty string would
 * look like a recorded entry with no content and be counted as a manday.
 */
export async function fromWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const out = {};
  wb.eachSheet((ws) => {
    const headers = [];
    ws.getRow(1).eachCell((cell, col) => {
      headers[col] = String(cell.value ?? '').trim();
    });

    const rows = [];
    ws.eachRow((row, i) => {
      if (i === 1) return;
      const obj = {};
      let any = false;
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        const key = headers[col];
        if (!key) return;
        const v = cell.value;
        const empty = v === null || v === undefined || v === '';
        obj[key] = empty ? null : typeof v === 'object' && 'text' in v ? v.text : v;
        if (!empty) any = true;
      });
      if (any) rows.push(obj);
    });

    out[ws.name] = rows;
  });

  return out;
}

export default { toWorkbook, fromWorkbook, parseMonthTab, beToGregorian, gregorianToBe };
