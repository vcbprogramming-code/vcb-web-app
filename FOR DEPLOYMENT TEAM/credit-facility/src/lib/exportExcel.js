// Excel export, built in the browser with SheetJS.
//
// The Apps Script version built the file server-side (a temporary Sheet, then a
// Drive export) because Apps Script could. Here it is client-side over data the
// browser already holds, so the export costs no round trip and honours exactly
// the filters currently on screen — which is what "export what I am looking at"
// means to the person clicking.
//
// ExcelJS is the stack's server-side choice (TECH_STACK.md, for PDF/Excel
// generation in api/); this is the client, and xlsx was already the module's
// dependency for this same job, so it is kept rather than adding a second
// spreadsheet library to the bundle.

import { money } from './format.js';
import { attachText, kindShort, projTh } from './lookups.js';

/**
 * Write one workbook with a sheet per dataset.
 *
 * Amounts go in as NUMBERS, not the formatted strings the table shows: an
 * exported sheet is opened to be summed and filtered, and "฿1,234" is text
 * Excel cannot add up.
 *
 * xlsx is imported dynamically because it is by far the largest thing this app
 * would otherwise ship — several hundred kB that only matters to the person who
 * clicks Export. Loading it on demand keeps it out of the first paint for
 * everyone who never does.
 */
export async function exportWorkbook({ facilities, transactions, requests, projects, facTypes, filename }) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const facRows = (facilities || []).map((f) => ({
    Project: f.project,
    ProjectName: projTh(projects, f.project),
    FacilityNo: f.facilityNo,
    Kind: kindShort(facTypes, f.facilityNo),
    Type: f.type || '',
    Limit: Number(f.limit) || 0,
    Used: Number(f.used) || 0,
    Available: Number(f.available ?? (Number(f.limit) || 0) - (Number(f.used) || 0)),
    UsedOverridden: f.usedOverridden ? 'Y' : '',
    Interest: f.interest || '',
    Notes: f.notes || '',
  }));

  const txnRows = (transactions || []).map((r) => ({
    ID: r.id,
    Date: r.date || '',
    Project: r.project,
    ProjectName: projTh(projects, r.project),
    FacilityNo: r.facilityNo,
    Kind: kindShort(facTypes, r.facilityNo),
    Ref: r.ref || '',
    Description: r.desc || '',
    Beneficiary: r.beneficiary || '',
    CostCategory: r.costCategory || '',
    Start: r.start || '',
    Due: r.due || '',
    Amount: Number(r.amount) || 0,
    Status: r.status || '',
    PaidDate: r.paidDate || '',
    Attachment: attachText(r),
    By: r.by || '',
    Note: r.note || '',
  }));

  const reqRows = (requests || []).map((r) => ({
    ID: r.id,
    Date: r.date || '',
    Project: r.project,
    Company: r.company || '',
    FacilityNo: r.facilityNo,
    Kind: kindShort(facTypes, r.facilityNo),
    Amount: Number(r.amount) || 0,
    Purpose: r.purpose || '',
    Beneficiary: r.beneficiary || '',
    Maturity: r.maturity || '',
    Status: r.status || '',
    Requester: r.requester || '',
    DecidedBy: r.decidedBy || '',
    DecidedAt: r.decidedAt || '',
    LinkedTxn: r.linkedTxn || '',
    Note: r.note || '',
  }));

  if (facRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(facRows), 'Facilities');
  if (txnRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txnRows), 'Transactions');
  if (reqRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reqRows), 'Requests');

  // An empty workbook throws in SheetJS; give it one sheet saying so.
  if (!wb.SheetNames.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['No data']]), 'Empty');
  }

  XLSX.writeFile(wb, filename || defaultName());
  return { sheets: wb.SheetNames.length, rows: facRows.length + txnRows.length + reqRows.length };
}

function defaultName() {
  const n = new Date();
  const p = (v) => String(v).padStart(2, '0');
  return `credit-facility-${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}.xlsx`;
}

export { money };
