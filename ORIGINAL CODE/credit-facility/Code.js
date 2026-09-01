/**
 * VCB Group – Credit Facility Management web app.
 * Tracks credit facilities (limit / used / available) and credit requests
 * across all projects, seeded from the project loan xlsx files.
 *
 * Single source of truth: one master Google Sheet (id in Script Property
 * MASTER_SHEET_ID), tabs: Facilities, Transactions, Requests.
 */

var APP_TITLE = 'VCB Credit Facility Manager';
// Users allowed to approve/reject requests. Add Workspace emails + redeploy.
var MANAGERS = ['c.chavananand@vcb-con.com'];

var SHEET_HEADERS = {
  Facilities:   ['Project', 'FacilityNo', 'Type', 'Limit', 'Used', 'Interest', 'Notes'],
  Transactions: ['ID', 'Date', 'Project', 'FacilityNo', 'Kind', 'Ref', 'Description', 'StartDate', 'DueDate', 'Amount', 'Status', 'By', 'PaidDate', 'Note', 'Source', 'DocFrom', 'DocTo', 'Updated', 'CostCategory', 'Purpose', 'Beneficiary', 'RefDocFrom', 'RefDocTo'],
  Requests:     ['ID', 'Date', 'Project', 'Company', 'FacilityNo', 'Amount', 'Purpose', 'Beneficiary', 'Status', 'Requester', 'DecidedBy', 'DecidedAt', 'Note', 'Maturity', 'LinkedTxn', 'Source', 'DocFrom', 'DocTo', 'Updated'],
  // UsedOverride is optional: blank = auto-calc Used from transactions
  // (default); a number = pin Used to exactly this value (manual override).
  Limits:       ['Project', 'FacilityNo', 'Limit', 'UsedOverride'],
  Audit:        ['Timestamp', 'User', 'Action', 'Target', 'TargetID', 'Changes', 'Note'],
  // Per-(Project, CostCategory) budget cap set by the user — derived from the
  // cashflow originally submitted to the bank when requesting the credit line.
  // Used to warn when in-flight requests are about to exhaust the category's budget.
  CategoryCaps: ['Project', 'CostCategory', 'Cap', 'Note', 'Updated'],
  // User-editable master list of cost categories. When empty the client falls
  // back to the built-in defaults. Order column drives display order.
  CostCategories: ['Name', 'Order', 'Updated'],
  // Monthly cash-plan: one row per (Project, Month, Period). PaidIds is a
  // JSON array of transaction IDs the user has elected to pay off this period.
  // ShowAllDue (boolean) toggles the income-period right-side panel between
  // AVAL-only (default) and all eligible items (P/N, etc.) for visibility.
  CashPlan:     ['ID', 'Project', 'Month', 'PeriodIdx', 'PeriodLabel', 'PeriodDate',
                 'PeriodType', 'Income', 'WorkRef', 'PaidIds', 'NewPNAmount', 'NewPNNote',
                 'Note', 'Deductions', 'IncomeBreak', 'AvalAmount', 'Updated', 'ShowAllDue',
                 // Variant: 'plan' = forecast cash plan, 'actual' = recorded real T-bar.
                 // Blank (old rows) is treated as 'plan'.
                 'Variant',
                 // ExtraRows: JSON array of free-form {label,amount} extra-income rows.
                 'ExtraRows']
};

// Idempotent migration: make sure every tab on an existing master sheet has
// all the columns SHEET_HEADERS now expects. New columns are appended at the
// end so existing data/positions are never disturbed (old rows get blanks).
function ensureSchema_(ss) {
  Object.keys(SHEET_HEADERS).forEach(function (tab) {
    var sh = ss.getSheetByName(tab);
    var want = SHEET_HEADERS[tab];
    if (!sh) {                         // tab added after this sheet was created
      sh = ss.insertSheet(tab);
      sh.appendRow(want);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, want.length).setFontWeight('bold');
      return;
    }
    var have = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
    want.forEach(function (col, idx) {
      if (have[idx] !== col) {
        sh.getRange(1, idx + 1).setValue(col);
      }
    });
  });
  return ss;
}

// The whole web app requires a Google sign-in (deployment access = "Anyone with
// Google Account"). There's no public/anonymous mode — every visitor is logged
// in, so doGet just serves the single-page UI.
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle(APP_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/* ---------- master sheet ---------- */

function getMaster_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('MASTER_SHEET_ID');
  if (id) {
    // An ID is already set. NEVER silently create a blank sheet on a transient
    // open failure — doing so on 2026-07-01 orphaned a month of data onto a fresh
    // seed. Fail LOUDLY instead, so the real sheet is never abandoned. A new sheet
    // is created ONLY on genuine first run (no ID stored yet).
    try {
      return ensureSchema_(SpreadsheetApp.openById(id));
    } catch (e) {
      throw new Error('ไม่สามารถเปิดชีตข้อมูลหลัก (MASTER_SHEET_ID=' + id + ') ได้ — '
        + 'ระบบจะไม่สร้างชีตเปล่าใหม่โดยอัตโนมัติเพื่อป้องกันข้อมูลหาย. '
        + 'โปรดลองใหม่ หรือตรวจสอบสิทธิ์การเข้าถึงชีต. (' + (e.message || e) + ')');
    }
  }
  return setupMaster_();
}

function setupMaster_() {
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.create('VCB Credit Facility Master');
  Object.keys(SHEET_HEADERS).forEach(function (tab) {
    var sh = ss.insertSheet(tab);
    sh.appendRow(SHEET_HEADERS[tab]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, SHEET_HEADERS[tab].length).setFontWeight('bold');
  });
  var def = ss.getSheetByName('Sheet1');
  if (def) ss.deleteSheet(def);

  // seed Facilities
  var fRows = SEED_FACILITIES.map(function (f) {
    return [f.project, f.facilityNo, f.type, f.limit, f.used || 0, f.interest, f.notes];
  });
  if (fRows.length) ss.getSheetByName('Facilities').getRange(2, 1, fRows.length, 7).setValues(fRows);

  // seed Transactions
  var now = new Date();
  var tRows = SEED_TXNS.map(function (t, i) {
    return ['SEED-' + (i + 1), now, t.project, t.facilityNo, t.kind, t.ref,
            t.desc, t.start, t.due, t.amount, 'active', 'seed'];
  });
  if (tRows.length) ss.getSheetByName('Transactions').getRange(2, 1, tRows.length, 12).setValues(tRows);

  props.setProperty('MASTER_SHEET_ID', ss.getId());
  moveMasterToFolder_(ss.getId());   // keep the DB out of My Drive root (best-effort)
  return ss;
}

// Shared Drive folder that holds every VCB app database, so none of them
// clutter My Drive root (which mirrors to E:\ root via Drive-for-Desktop).
var APP_DATA_FOLDER = 'VCB App Data';

// Move the master sheet into APP_DATA_FOLDER. Best-effort: never throws (a
// placement hiccup must not break DB creation). Creates the folder if missing.
function moveMasterToFolder_(id) {
  try {
    var file = DriveApp.getFileById(id);
    var it = DriveApp.getFoldersByName(APP_DATA_FOLDER);
    var folder = it.hasNext() ? it.next() : DriveApp.createFolder(APP_DATA_FOLDER);
    file.moveTo(folder);
  } catch (e) { /* leave at root rather than fail */ }
}

// One-time editor helper: relocate the existing master sheet into
// "VCB App Data". Safe to run repeatedly. Returns the folder it now lives in.
function moveMasterToFolder() {
  var id = PropertiesService.getScriptProperties().getProperty('MASTER_SHEET_ID');
  if (!id) throw new Error('MASTER_SHEET_ID not set — open the app once to create the DB first.');
  moveMasterToFolder_(id);
  var ps = DriveApp.getFileById(id).getParents();
  return ps.hasNext() ? ps.next().getName() : '(root)';
}

/* ---------- identity ---------- */

function whoAmI() {
  var email = '';
  try { email = Session.getActiveUser().getEmail() || ''; } catch (e) {}
  return { email: email, isManager: MANAGERS.indexOf(email) !== -1 };
}

/* ---------- read ---------- */

function readTab_(ss, tab) {
  var sh = ss.getSheetByName(tab);
  var vals = sh.getDataRange().getValues();
  var head = vals.shift();
  return vals.filter(function (r) { return r.join('') !== ''; }).map(function (r) {
    var o = {}; head.forEach(function (h, i) { o[h] = r[i]; }); return o;
  });
}

// Kept from the 2026-07-01 recovery: peek inside a master-sheet copy (read-only).
// Used by recoverMaster() below. Returns row counts + how many txns carry a
// category, so we can tell which Drive copy holds the real work.
function peekSheet_(id) {
  try {
    var s = SpreadsheetApp.openById(id);
    function rows(tab) { var sh = s.getSheetByName(tab); return sh ? Math.max(0, sh.getLastRow() - 1) : -1; }
    var tsh = s.getSheetByName('Transactions'), tt = 0, wc = 0;
    if (tsh) {
      var vv = tsh.getDataRange().getValues(), hh = vv[0] || [], cci = hh.indexOf('CostCategory');
      tt = vv.length - 1;
      for (var i = 1; i < vv.length; i++) { if (cci >= 0 && String(vv[i][cci] || '').trim()) wc++; }
    }
    return { txns: tt, txnsWithCat: wc, caps: rows('CategoryCaps'), cats: rows('CostCategories'), cashplan: rows('CashPlan') };
  } catch (e) { return { error: (e.message || ('' + e)) }; }
}

// Recovery (kept as a safety net): repoint MASTER_SHEET_ID to the "VCB Credit
// Facility Master" copy that holds real work (category list + categorized txns)
// and was edited most recently. Only changes a pointer — never edits/deletes a
// sheet. Run from the Apps Script editor if the app ever lands on a blank sheet.
function recoverMaster() {
  var props = PropertiesService.getScriptProperties();
  var currentId = props.getProperty('MASTER_SHEET_ID');
  var best = null;
  var it = DriveApp.getFilesByName('VCB Credit Facility Master');
  while (it.hasNext()) {
    var f = it.next(), id = f.getId();
    if (id === currentId) continue;
    var pk = peekSheet_(id);
    if (pk.error || !(pk.cats > 0 && pk.txnsWithCat > 0)) continue;
    var score = f.getLastUpdated().getTime();
    if (!best || score > best.score) best = { id: id, score: score };
  }
  if (!best) return { ok: false, error: 'no candidate with real data found' };
  props.setProperty('MASTER_SHEET_ID', best.id);
  return { ok: true, chosenId: best.id };
}

function getData() {
  var ss = getMaster_();
  // Facilities baseline comes from SEED_FACILITIES (part of the deployed code —
  // always present and current). The sheet is used only for what users enter:
  // Transactions and Requests. This means the app is always ready after a
  // deploy; updating figures is just: edit Seed.js -> push -> redeploy.
  // (No seeding step, no resetMaster/adminPatchCVE, ever.)
  var txns = readTab_(ss, 'Transactions');
  var requests = readTab_(ss, 'Requests');
  // User-set credit-limit overrides (bank changed the cap). Keyed project|no.
  // Same Limits tab also carries optional UsedOverride: when set, it pins
  // Used to that value instead of computing it from the txn ledger — for
  // cases where the auto-calc doesn't reflect reality (off-system entries,
  // year-end true-ups, bank corrections).
  var limitOv = {}, usedOv = {};
  readTab_(ss, 'Limits').forEach(function (r) {
    var k = r.Project + '|' + r.FacilityNo;
    if (r.Project && r.FacilityNo !== '' && r.Limit !== '' && r.Limit != null)
      limitOv[k] = Number(r.Limit) || 0;
    if (r.Project && r.FacilityNo !== '' && r.UsedOverride !== '' && r.UsedOverride != null)
      usedOv[k] = Number(r.UsedOverride) || 0;
  });

  // Single merged ledger. An item counts toward "used" ONLY when its status is
  // อนุมัติแล้ว (authorized). คำขอใหม่ / อยู่ระหว่างเสนออนุมัติ are logged but
  // do not consume the line. ชำระแล้ว (settled) releases it; void is ignored.
  // Seeded rows (By='seed') are baked into the SEED_FACILITIES baseline, so
  // they are not re-summed — except when settled, which releases them.
  function isAuthorized_(s) {
    s = String(s);
    return s === 'อนุมัติแล้ว' || s.toLowerCase() === 'active';
  }
  var delta = {};
  function key(p, n) { return p + '|' + n; }
  txns.forEach(function (t) {
    var k = key(t.Project, t.FacilityNo);
    var paid = String(t.Status) === 'ชำระแล้ว';
    if (String(t.By) === 'seed') {
      if (paid) delta[k] = (delta[k] || 0) - (Number(t.Amount) || 0);
      return;
    }
    if (!isAuthorized_(t.Status)) return; // pending / paid / void don't count
    delta[k] = (delta[k] || 0) + (Number(t.Amount) || 0);
  });

  var facOut = SEED_FACILITIES.map(function (f) {
    var ovk = f.project + '|' + f.facilityNo;
    var lim = (ovk in limitOv) ? limitOv[ovk] : (Number(f.limit) || 0);
    var hasUsedOv = (ovk in usedOv);
    var u;
    if (hasUsedOv) {
      u = usedOv[ovk];                    // pinned: trust the user's number exactly
    } else {
      u = (Number(f.used) || 0) + (delta[key(f.project, f.facilityNo)] || 0);
      if (u < 0) u = 0;                   // only clamp the auto-calc
    }
    return {
      project: f.project, facilityNo: f.facilityNo, type: f.type,
      limit: lim, used: u, available: lim - u,
      usedOverridden: hasUsedOv,
      interest: f.interest, notes: f.notes
    };
  });

  // User-managed master list of cost categories (Settings → หมวดค่าใช้จ่าย).
  // Empty list = client falls back to built-in defaults.
  var catList = [];
  try {
    catList = readTab_(ss, 'CostCategories')
      .filter(function (r) { return String(r.Name || '').trim(); })
      .sort(function (a, b) { return (Number(a.Order) || 0) - (Number(b.Order) || 0); })
      .map(function (r) { return String(r.Name).trim(); });
  } catch (e) { catList = []; }

  // Per-category budget caps (Project × CostCategory → cap amount + note).
  var caps = [];
  try {
    caps = readTab_(ss, 'CategoryCaps').filter(function (r) {
      return r.Project && r.CostCategory;
    }).map(function (r) {
      return {
        project: r.Project,
        costCategory: r.CostCategory,
        cap: Number(r.Cap) || 0,
        note: r.Note || '',
        updated: fmt_(r.Updated)
      };
    });
  } catch (e) { caps = []; }

  return {
    me: whoAmI(),
    projects: SEED_PROJECTS,
    facTypes: SEED_FAC_TYPES,
    facilities: facOut,
    costCategories: catList,
    categoryCaps: caps,
    transactions: txns.map(function (t) {
      return {
        id: t.ID, date: fmt_(t.Date), project: t.Project, facilityNo: t.FacilityNo,
        kind: t.Kind, ref: t.Ref, desc: t.Description,
        start: fmt_(t.StartDate), due: fmt_(t.DueDate), maturity: fmt_(t.DueDate),
        amount: Number(t.Amount) || 0, status: t.Status, by: t.By,
        requester: t.By, paidDate: fmt_(t.PaidDate), note: t.Note || '',
        purpose: t.Purpose || t.Description || '',
        beneficiary: t.Beneficiary || '',
        source: t.Source || '',
        costCategory: t.CostCategory || '',
        refDocFrom: fmt_(t.RefDocFrom), refDocTo: fmt_(t.RefDocTo),
        docFrom: fmt_(t.DocFrom), docTo: fmt_(t.DocTo), updated: fmt_(t.Updated)
      };
    }),
    requests: requests.map(function (r) {
      return {
        id: r.ID, date: fmt_(r.Date), project: r.Project, company: r.Company,
        facilityNo: r.FacilityNo, amount: Number(r.Amount) || 0,
        purpose: r.Purpose, beneficiary: r.Beneficiary, status: r.Status,
        requester: r.Requester, decidedBy: r.DecidedBy,
        decidedAt: fmt_(r.DecidedAt), note: r.Note,
        maturity: fmt_(r.Maturity), linkedTxn: r.LinkedTxn || '',
        source: r.Source || '', docFrom: fmt_(r.DocFrom), docTo: fmt_(r.DocTo),
        updated: fmt_(r.Updated)
      };
    })
  };
}

function fmt_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, 'Asia/Bangkok', 'dd/MM/yyyy');
  }
  return v == null ? '' : String(v);
}

/* ---------- write ---------- */

// Append a row keyed by SHEET_HEADERS so it stays correct regardless of how
// many columns the sheet has (migration-safe).
function appendByHeader_(sh, tab, obj) {
  sh.appendRow(SHEET_HEADERS[tab].map(function (h) { return (h in obj) ? obj[h] : ''; }));
}

// Serialize all writes so two users can't race each other.
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);
  try { return fn(); } finally { try { lock.releaseLock(); } catch (e) {} }
}

// Append an audit entry. `changes` may be a string or an object {field:[old,new]}.
function audit_(ss, action, target, targetId, changes, note) {
  try {
    var me = whoAmI();
    appendByHeader_(ss.getSheetByName('Audit'), 'Audit', {
      Timestamp: new Date(),
      User: me.email || '',
      Action: action,
      Target: target,
      TargetID: targetId || '',
      Changes: (changes && typeof changes === 'object') ? JSON.stringify(changes) : (changes || ''),
      Note: note || ''
    });
  } catch (e) { /* audit failure must never block the actual write */ }
}

// Snapshot a sheet row by ID, return as {field:value} for diffing.
function snapshotRow_(sh, id) {
  var vals = sh.getDataRange().getValues();
  var head = vals[0], cId = head.indexOf('ID');
  if (cId < 0) return null;
  for (var i = 1; i < vals.length; i++) {
    if (vals[i][cId] === id) {
      var o = {}; head.forEach(function (h, k) { o[h] = vals[i][k]; }); return o;
    }
  }
  return null;
}

// Diff two row snapshots → {field:[before,after], …} (only changed fields).
function diffRow_(before, after) {
  var d = {};
  Object.keys(after).forEach(function (k) {
    var b = before ? before[k] : '';
    if (b instanceof Date) b = Utilities.formatDate(b, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm');
    var a = after[k];
    if (a instanceof Date) a = Utilities.formatDate(a, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm');
    if (String(b) !== String(a)) d[k] = [b === undefined ? '' : b, a === undefined ? '' : a];
  });
  return d;
}

// Document-type label for a facility number (L/G, T/L, B/E, P/N).
function docKind_(facilityNo) {
  var t = SEED_FAC_TYPES.filter(function (x) { return String(x.no) === String(facilityNo); })[0];
  if (!t) return '';
  return ({ LG: 'BG', LGM: 'L/G', TL: 'T/L', AVAL: 'B/E', PN: 'P/N' })[t.kind] || t.kind;
}

function insertTxn_(ss, t) {
  var id = t.id || ('TXN-' + new Date().getTime());
  appendByHeader_(ss.getSheetByName('Transactions'), 'Transactions', {
    ID: id, Date: new Date(), Project: t.project, FacilityNo: t.facilityNo,
    Kind: t.kind || '', Ref: t.ref || '', Description: t.desc || '',
    StartDate: t.start || '', DueDate: t.due || '', Amount: Number(t.amount) || 0,
    Status: t.status || 'อนุมัติแล้ว', By: t.by || '', Note: t.note || '',
    Source: t.source || '', DocFrom: t.docFrom || '', DocTo: t.docTo || '',
    CostCategory: t.costCategory || '',
    Purpose: t.purpose || '', Beneficiary: t.beneficiary || '',
    RefDocFrom: t.refDocFrom || '', RefDocTo: t.refDocTo || '',
    Updated: new Date()
  });
  return id;
}

// Merged model: a "request" IS a transaction row. New items default to
// คำขอใหม่ (pending — not counted) until status becomes อนุมัติแล้ว.
function addRequest(p) {
  return withLock_(function () {
    var ss = getMaster_();
    var me = whoAmI();
    var id = insertTxn_(ss, {
      project: p.project, facilityNo: p.facilityNo, kind: docKind_(p.facilityNo),
      ref: p.ref || '',
      desc: (p.purpose || p.note || '') + (p.beneficiary ? ' | ' + p.beneficiary : ''),
      start: p.start || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy'),
      due: p.maturity || '', amount: Number(p.amount) || 0,
      status: p.status || 'คำขอใหม่', by: me.email || (p.requester || ''),
      note: p.note || '', source: p.source || '', docFrom: p.docFrom || '', docTo: p.docTo || '',
      costCategory: p.costCategory || ''
    });
    audit_(ss, 'add', 'Transactions', id, {
      project: ['', p.project], facilityNo: ['', p.facilityNo],
      amount: ['', Number(p.amount) || 0], status: ['', p.status || 'คำขอใหม่']
    });
    return { ok: true, id: id };
  });
}

/** Edit an existing ledger item (transaction). */
function updateRequest(p) {
  return withLock_(function () {
    var ss = getMaster_();
    var sh = ss.getSheetByName('Transactions');
    var before = snapshotRow_(sh, p.id);
    if (!before) return { ok: false, error: 'ไม่พบรายการ' };
    var vals = sh.getDataRange().getValues();
    var head = vals[0];
    function c(n) { return head.indexOf(n); }
    var cId = c('ID');
    for (var i = 1; i < vals.length; i++) {
      if (vals[i][cId] !== p.id) continue;
      var set = function (name, val) { var k = c(name); if (k >= 0) sh.getRange(i + 1, k + 1).setValue(val); };
      set('Project', p.project); set('FacilityNo', p.facilityNo);
      set('Kind', docKind_(p.facilityNo)); set('Amount', Number(p.amount) || 0);
      if (p.ref !== undefined) set('Ref', p.ref || '');
      set('Description', (p.purpose || p.note || '')); set('Note', p.note || '');
      set('DueDate', p.maturity || ''); if (p.start) set('StartDate', p.start);
      set('Source', p.source || ''); set('DocFrom', p.docFrom || ''); set('DocTo', p.docTo || '');
      if (p.costCategory !== undefined) set('CostCategory', p.costCategory || '');
      if (p.purpose !== undefined)     set('Purpose', p.purpose || '');
      if (p.beneficiary !== undefined) set('Beneficiary', p.beneficiary || '');
      if (p.refDocFrom !== undefined)  set('RefDocFrom', p.refDocFrom || '');
      if (p.refDocTo !== undefined)    set('RefDocTo', p.refDocTo || '');
      set('Status', p.status || 'คำขอใหม่'); set('Updated', new Date());
      SpreadsheetApp.flush();
      var after = snapshotRow_(sh, p.id);
      audit_(ss, 'edit', 'Transactions', p.id, diffRow_(before, after));
      return { ok: true };
    }
    return { ok: false, error: 'ไม่พบรายการ' };
  });
}

/** Manually pin a facility's Used amount, overriding the auto-calc from txns.
 *  Pass `used` as a number to pin; pass '' / null / undefined to clear the
 *  override and revert to auto-calculation. Upsert into the same Limits row
 *  used by setLimit(). */
function setUsedOverride(p) {
  return withLock_(function () {
    var ss = getMaster_();
    var sh = ss.getSheetByName('Limits');
    var vals = sh.getDataRange().getValues();
    var head = vals[0];
    var cP = head.indexOf('Project'), cF = head.indexOf('FacilityNo'), cU = head.indexOf('UsedOverride');
    if (cU < 0) return { ok: false, error: 'UsedOverride column missing — re-open the app once to migrate the sheet' };
    var raw = p && p.used;
    var hasVal = !(raw === '' || raw === null || raw === undefined) && !isNaN(Number(raw));
    var newU = hasVal ? Number(raw) : '';
    var tid = p.project + '|' + p.facilityNo;
    for (var i = 1; i < vals.length; i++) {
      if (String(vals[i][cP]) === String(p.project) &&
          String(vals[i][cF]) === String(p.facilityNo)) {
        var old = vals[i][cU];
        sh.getRange(i + 1, cU + 1).setValue(newU);
        audit_(ss, hasVal ? 'usedoverride' : 'usedclear', 'Limits', tid, { UsedOverride: [old, newU] });
        return { ok: true };
      }
    }
    appendByHeader_(sh, 'Limits', {
      Project: p.project, FacilityNo: p.facilityNo, Limit: '', UsedOverride: newU
    });
    audit_(ss, hasVal ? 'usedoverride' : 'usedclear', 'Limits', tid, { UsedOverride: ['', newU] });
    return { ok: true };
  });
}

/** Set/override a facility's credit limit (bank changed the cap). Upsert. */
function setLimit(p) {
  return withLock_(function () {
    var ss = getMaster_();
    var sh = ss.getSheetByName('Limits');
    var vals = sh.getDataRange().getValues();
    var head = vals[0];
    var cP = head.indexOf('Project'), cF = head.indexOf('FacilityNo'), cL = head.indexOf('Limit');
    var newLim = Number(p.limit) || 0;
    var tid = p.project + '|' + p.facilityNo;
    for (var i = 1; i < vals.length; i++) {
      if (String(vals[i][cP]) === String(p.project) &&
          String(vals[i][cF]) === String(p.facilityNo)) {
        var old = Number(vals[i][cL]) || 0;
        sh.getRange(i + 1, cL + 1).setValue(newLim);
        audit_(ss, 'limit', 'Limits', tid, { Limit: [old, newLim] });
        return { ok: true };
      }
    }
    appendByHeader_(sh, 'Limits', {
      Project: p.project, FacilityNo: p.facilityNo, Limit: newLim
    });
    audit_(ss, 'limit', 'Limits', tid, { Limit: ['', newLim] });
    return { ok: true };
  });
}

/** Quick status change (e.g. authorize a pending item). */
function setTxnStatus(p) {
  return withLock_(function () {
    var ss = getMaster_();
    var sh = ss.getSheetByName('Transactions');
    var vals = sh.getDataRange().getValues();
    var head = vals[0];
    var cId = head.indexOf('ID'), cSt = head.indexOf('Status'), cUp = head.indexOf('Updated');
    for (var i = 1; i < vals.length; i++) {
      if (vals[i][cId] === p.id) {
        var oldSt = String(vals[i][cSt] || '');
        sh.getRange(i + 1, cSt + 1).setValue(p.status);
        if (cUp >= 0) sh.getRange(i + 1, cUp + 1).setValue(new Date());
        audit_(ss, p.status === 'อนุมัติแล้ว' ? 'authorize' : 'status',
          'Transactions', p.id, { Status: [oldSt, p.status] });
        return { ok: true };
      }
    }
    return { ok: false, error: 'ไม่พบรายการ' };
  });
}

/** Delete a ledger item (transaction). */
function deleteRequest(p) {
  return withLock_(function () {
    var ss = getMaster_();
    var sh = ss.getSheetByName('Transactions');
    var before = snapshotRow_(sh, p.id);
    if (!before) return { ok: false, error: 'ไม่พบรายการ' };
    var vals = sh.getDataRange().getValues();
    var cId = vals[0].indexOf('ID');
    for (var i = 1; i < vals.length; i++) {
      if (vals[i][cId] === p.id) {
        sh.deleteRow(i + 1);
        audit_(ss, 'delete', 'Transactions', p.id, before);
        return { ok: true };
      }
    }
    return { ok: false, error: 'ไม่พบรายการ' };
  });
}
function deleteTxn(p) { return deleteRequest(p); }

// Quick-add: a direct credit-usage entry is authorized straight away.
function addTransaction(p) {
  return withLock_(function () {
    var ss = getMaster_();
    var me = whoAmI();
    var id = insertTxn_(ss, {
      project: p.project, facilityNo: p.facilityNo,
      kind: p.kind || docKind_(p.facilityNo), ref: p.ref,
      desc: p.desc, start: p.start, due: p.due, amount: p.amount,
      status: 'อนุมัติแล้ว', by: me.email || '', note: p.note
    });
    audit_(ss, 'add', 'Transactions', id, {
      project: ['', p.project], facilityNo: ['', p.facilityNo],
      amount: ['', Number(p.amount) || 0], status: ['', 'อนุมัติแล้ว']
    }, 'quick-add');
    return { ok: true, id: id };
  });
}

/** Settle (pay off) an outstanding transaction: closes the document so it
 *  releases the line (used drops) and stops accruing overdue interest. */
function settleTxn(p) {
  return withLock_(function () {
    var ss = getMaster_();
    var sh = ss.getSheetByName('Transactions');
    var vals = sh.getDataRange().getValues();
    var head = vals[0];
    var cId = head.indexOf('ID'), cSt = head.indexOf('Status'),
        cAmt = head.indexOf('Amount'), cPd = head.indexOf('PaidDate');
    for (var i = 1; i < vals.length; i++) {
      if (vals[i][cId] === p.id) {
        if (String(vals[i][cSt]) === 'ชำระแล้ว') return { ok: false, error: 'รายการนี้ชำระแล้ว' };
        if ((Number(vals[i][cAmt]) || 0) <= 0) return { ok: false, error: 'รายการนี้ไม่ใช่ยอดค้างชำระ' };
        var oldSt = String(vals[i][cSt] || '');
        sh.getRange(i + 1, cSt + 1).setValue('ชำระแล้ว');
        if (cPd >= 0) sh.getRange(i + 1, cPd + 1).setValue(new Date());
        audit_(ss, 'settle', 'Transactions', p.id, { Status: [oldSt, 'ชำระแล้ว'] });
        return { ok: true };
      }
    }
    return { ok: false, error: 'ไม่พบรายการ' };
  });
}

function decideRequest(p) {
  var me = whoAmI();
  if (!me.isManager) return { ok: false, error: 'เฉพาะผู้บริหารเท่านั้นที่อนุมัติได้' };
  var ss = getMaster_();
  var sh = ss.getSheetByName('Requests');
  var vals = sh.getDataRange().getValues();
  var head = vals[0];
  var cId = head.indexOf('ID'), cSt = head.indexOf('Status'),
      cBy = head.indexOf('DecidedBy'), cAt = head.indexOf('DecidedAt'),
      cP = head.indexOf('Project'), cF = head.indexOf('FacilityNo'),
      cAmt = head.indexOf('Amount'), cPur = head.indexOf('Purpose'),
      cBen = head.indexOf('Beneficiary'), cMat = head.indexOf('Maturity'),
      cLink = head.indexOf('LinkedTxn');
  for (var i = 1; i < vals.length; i++) {
    if (vals[i][cId] === p.id) {
      var cur = String(vals[i][cSt]);
      if (cur === 'อนุมัติ' || cur === 'ไม่อนุมัติ') {
        return { ok: false, error: 'รายการนี้ถูกตัดสินแล้ว' };
      }
      sh.getRange(i + 1, cSt + 1).setValue(p.decision);
      sh.getRange(i + 1, cBy + 1).setValue(me.email);
      sh.getRange(i + 1, cAt + 1).setValue(new Date());
      // On approval the request instantly becomes a live, dated credit-usage
      // entry — no need to re-key it in บันทึกการใช้วงเงิน. It is linked back
      // to the request so "used" is never double-counted.
      if (p.decision === 'อนุมัติ' && cLink >= 0 && !String(vals[i][cLink] || '')) {
        var ben = cBen >= 0 ? String(vals[i][cBen] || '') : '';
        var txnId = insertTxn_(ss, {
          project: vals[i][cP], facilityNo: vals[i][cF],
          kind: docKind_(vals[i][cF]), ref: p.id,
          desc: String(vals[i][cPur] || '') + (ben ? ' — ' + ben : ''),
          start: Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy'),
          due: cMat >= 0 ? fmt_(vals[i][cMat]) : '',
          amount: Number(vals[i][cAmt]) || 0,
          status: 'active', by: 'request:' + p.id
        });
        sh.getRange(i + 1, cLink + 1).setValue(txnId);
      }
      return { ok: true };
    }
  }
  return { ok: false, error: 'ไม่พบรายการ' };
}

/* ---------- Excel export ---------- */

function projCompany_(D, code) {
  var p = D.projects.filter(function (x) { return x.code === code; })[0];
  if (!p) return '';
  return String(p.company || '').replace(/^บริษัท\s*/, '').replace(/\s*จำกัด\s*/g, ' ').trim();
}
function facTypeName_(D, no) {
  var t = D.facTypes.filter(function (x) { return String(x.no) === String(no); })[0];
  return t ? t.th : ('#' + no);
}
function parseDue_(s) {
  if (s == null || s === '') return null;
  var m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}
function overdueInterestVal_(D, t) {
  var s = String(t.status);
  if (!(s === 'อนุมัติแล้ว' || s.toLowerCase() === 'active')) return ''; // only authorized accrues
  var amt = Number(t.amount) || 0;
  if (amt <= 0) return '';
  var d = parseDue_(t.due); if (!d) return '';
  var n = new Date(), t0 = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  var days = Math.floor((t0 - d) / 864e5);
  if (days <= 0) return '';
  var f = D.facilities.filter(function (x) {
    return x.project === t.project && String(x.facilityNo) === String(t.facilityNo);
  })[0];
  var m = f && f.interest ? String(f.interest).match(/(\d+(?:\.\d+)?)\s*%/) : null;
  if (!m) return 'ระบุอัตราไม่ได้';
  return amt * parseFloat(m[1]) / 100 * days / 365;
}

// Same due-window bucketing as the client, for filtered exports.
function dueBucket_(s) {
  var d = parseDue_(s); if (!d) return '';
  var n = new Date(), tY = n.getFullYear(), tM = n.getMonth();
  var dY = d.getFullYear(), dM = d.getMonth();
  if (dY < tY || (dY === tY && dM < tM) ||
      (dY === tY && dM === tM && d < new Date(tY, tM, n.getDate()))) return 'overdue';
  if (dY === tY && dM === tM) return 'this';
  var nx = new Date(tY, tM + 1, 1);
  if (dY === nx.getFullYear() && dM === nx.getMonth()) return 'next';
  return 'later';
}
// Mirrors the client's isDueWithin7 for server-side export filtering.
function isDueWithin7_(s) {
  var d = parseDue_(s); if (!d) return false;
  var n = new Date();
  var t0 = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  var t7 = new Date(t0.getTime() + 7 * 86400000);
  return d >= t0 && d <= t7;
}

/** Build an .xlsx of the three tables and return it as base64 for download.
 *  Honours the same filters the user has applied on screen (q = {p,t,s,d,qq}). */
function exportXlsx(q) {
  q = q || {};
  var qq = String(q.qq || '').toLowerCase();
  function inc(s) { return !qq || String(s || '').toLowerCase().indexOf(qq) >= 0; }
  var D = getData();
  var tmp = SpreadsheetApp.create('cf-export-' + new Date().getTime());
  // Keep the temp file inside the master's parent folder (not Drive root).
  try {
    var ps = DriveApp.getFileById(getMaster_().getId()).getParents();
    if (ps.hasNext()) DriveApp.getFileById(tmp.getId()).moveTo(ps.next());
  } catch (e) { /* moveTo may fail in older runtimes — file is still trashed below */ }

  var fac = tmp.insertSheet('วงเงินสินเชื่อ');
  fac.appendRow(['โครงการ', 'บริษัท', 'ประเภท', 'วงเงิน', 'ใช้ไป', 'คงเหลือ', '% ใช้ไป']);
  D.facilities.filter(function (x) {
    return (!q.p || x.project === q.p) && (!q.t || String(x.facilityNo) === String(q.t))
      && inc(facTypeName_(D, x.facilityNo) + x.project);
  }).forEach(function (x) {
    var pct = x.limit > 0 ? Math.min(100, Math.round(x.used / x.limit * 100)) : 0;
    fac.appendRow([x.project, projCompany_(D, x.project), docKind_(x.facilityNo),
      x.limit, x.used, x.available, pct + '%']);
  });

  var txn = tmp.insertSheet('รายการสินเชื่อ');
  txn.appendRow(['วันที่', 'บริษัท', 'โครงการ', 'ประเภท', 'รายละเอียด', 'จำนวนเงิน',
    'เริ่ม', 'ครบ', 'ดอกเบี้ยเกินกำหนด', 'สถานะ', 'เอกสารแนบ']);
  D.transactions.filter(function (x) {
    return (!q.p || x.project === q.p) && (!q.t || String(x.facilityNo) === String(q.t))
      && (!q.s || x.status === q.s)
      && (!q.d || (q.d === '7d' ? isDueWithin7_(x.due) : dueBucket_(x.due) === q.d))
      && inc((x.ref || '') + (x.desc || '') + (x.kind || '') + (x.source || ''));
  }).forEach(function (x) {
    var att = (x.source || '') + (x.docFrom ? ((x.source ? ' | ' : '') + x.docFrom + (x.docTo ? '–' + x.docTo : '')) : '');
    txn.appendRow([x.date, projCompany_(D, x.project), x.project, docKind_(x.facilityNo),
      x.desc, x.amount, x.start, x.due, overdueInterestVal_(D, x), x.status, att || '-']);
  });
  var def = tmp.getSheetByName('Sheet1'); if (def) tmp.deleteSheet(def);
  SpreadsheetApp.flush();
  var id = tmp.getId();
  try {
    var url = 'https://docs.google.com/spreadsheets/d/' + id + '/export?format=xlsx';
    var blob = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
    }).getBlob();
    var b64 = Utilities.base64Encode(blob.getBytes());
  } finally {
    DriveApp.getFileById(id).setTrashed(true); // never leave the temp file behind
  }
  return {
    name: 'CreditFacility_' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmm') + '.xlsx',
    b64: b64
  };
}

/* ---------- monthly cash plan ---------- */

/** Read CashPlan rows for one variant ('plan' | 'actual'; default 'plan').
 *  Small sheet, OK to read the whole tab. */
// Normalize a Month cell to 'YYYY-MM'. Google Sheets may auto-coerce a value like
// "2026-05" into a Date, which then breaks a plain string compare — this handles both.
function ymOf_(v) {
  if (v instanceof Date) return v.getFullYear() + '-' + ('0' + (v.getMonth() + 1)).slice(-2);
  return String(v == null ? '' : v).trim();
}
function getCashPlan(project, month, variant) {
  variant = variant || 'plan';
  var ss = getMaster_();
  var rows = readTab_(ss, 'CashPlan');
  return rows
    .filter(function (r) {
      return (!project || r.Project === project) && (!month || ymOf_(r.Month) === month)
        && ((r.Variant || 'plan') === variant);
    })
    .map(function (r) {
      var paid = [], deds = null, inc = null, extra = [];
      try { paid = r.PaidIds ? JSON.parse(r.PaidIds) : []; } catch (e) {}
      try { deds = r.Deductions ? JSON.parse(r.Deductions) : null; } catch (e) {}
      try { inc = r.IncomeBreak ? JSON.parse(r.IncomeBreak) : null; } catch (e) {}
      try { extra = r.ExtraRows ? JSON.parse(r.ExtraRows) : []; } catch (e) {}
      return {
        id: r.ID, project: r.Project, month: ymOf_(r.Month),
        periodIdx: Number(r.PeriodIdx) || 0,
        periodLabel: r.PeriodLabel || '', periodDate: fmt_(r.PeriodDate),
        periodType: r.PeriodType || 'mixed',
        income: Number(r.Income) || 0, workRef: r.WorkRef || '',
        paidIds: paid, deductions: deds, incomeBreak: inc,
        avalAmount: Number(r.AvalAmount) || 0,
        newPNAmount: Number(r.NewPNAmount) || 0,
        newPNNote: r.NewPNNote || '', note: r.Note || '',
        showAllDue: r.ShowAllDue === true || r.ShowAllDue === 'TRUE' || r.ShowAllDue === 'true',
        variant: r.Variant || 'plan',
        extraRows: extra,
        updated: fmt_(r.Updated)
      };
    })
    .sort(function (a, b) { return a.periodIdx - b.periodIdx; });
}

/** Create or update one period row in the cash plan. */
function saveCashPlanPeriod(p) {
  return withLock_(function () {
    var ss = getMaster_();
    var sh = ss.getSheetByName('CashPlan');
    var vals = sh.getDataRange().getValues();
    var head = vals[0], cId = head.indexOf('ID');
    var paidJson = JSON.stringify(p.paidIds || []);
    var dedsJson = JSON.stringify(p.deductions || []);
    var incJson  = JSON.stringify(p.incomeBreak || []);
    var fields = {
      ID: p.id || ('PL-' + new Date().getTime()),
      Project: p.project, Month: p.month, PeriodIdx: Number(p.periodIdx) || 0,
      PeriodLabel: p.periodLabel || '', PeriodDate: p.periodDate || '',
      PeriodType: p.periodType || 'mixed',
      Income: Number(p.income) || 0, WorkRef: p.workRef || '',
      PaidIds: paidJson, NewPNAmount: Number(p.newPNAmount) || 0,
      NewPNNote: p.newPNNote || '', Note: p.note || '',
      Deductions: dedsJson, IncomeBreak: incJson,
      AvalAmount: Number(p.avalAmount) || 0, Updated: new Date(),
      ShowAllDue: !!p.showAllDue, Variant: p.variant || 'plan',
      ExtraRows: JSON.stringify(p.extraRows || [])
    };
    // Upsert by ID if provided, otherwise append.
    if (p.id) {
      for (var i = 1; i < vals.length; i++) {
        if (vals[i][cId] === p.id) {
          // Write the WHOLE row in one setValues call. The old per-field loop did
          // ~20 separate setValue round-trips to Sheets, which made every
          // keystroke-save crawl. Columns not in `fields` keep their value.
          var rowArr = head.map(function (h, j) { return (h in fields) ? fields[h] : vals[i][j]; });
          sh.getRange(i + 1, 1, 1, head.length).setValues([rowArr]);
          audit_(ss, 'edit', 'CashPlan', p.id, { period: ['', p.periodIdx], income: ['', fields.Income] });
          return { ok: true, id: p.id };
        }
      }
    }
    appendByHeader_(sh, 'CashPlan', fields);
    audit_(ss, 'add', 'CashPlan', fields.ID,
      { project: ['', p.project], month: ['', p.month], periodIdx: ['', p.periodIdx] });
    return { ok: true, id: fields.ID };
  });
}

/** Delete a period row. */
function deleteCashPlanPeriod(p) {
  return withLock_(function () {
    var ss = getMaster_();
    var sh = ss.getSheetByName('CashPlan');
    var vals = sh.getDataRange().getValues();
    var cId = vals[0].indexOf('ID');
    for (var i = 1; i < vals.length; i++) {
      if (vals[i][cId] === p.id) {
        sh.deleteRow(i + 1);
        audit_(ss, 'delete', 'CashPlan', p.id, {});
        return { ok: true };
      }
    }
    return { ok: false, error: 'ไม่พบรายการ' };
  });
}

/** Set/clear a budget cap for one (Project, CostCategory) pair. Upserts into
 *  CategoryCaps. Pass cap='' (or null) to clear and remove the cap. */
function setCategoryCap(p) {
  try {
    return withLock_(function () {
      if (!p || !p.project || !p.costCategory) {
        return { ok: false, error: 'project / costCategory ที่ส่งมาว่างเปล่า' };
      }
      var ss = getMaster_();
      var sh = ss.getSheetByName('CategoryCaps');
      // Fallback: ensureSchema_ should have created the tab, but if it didn't
      // (Drive sync lag, permission glitch), create it here so we never return
      // a null-deref to the client.
      if (!sh) {
        sh = ss.insertSheet('CategoryCaps');
        sh.appendRow(SHEET_HEADERS.CategoryCaps);
        sh.setFrozenRows(1);
        sh.getRange(1, 1, 1, SHEET_HEADERS.CategoryCaps.length).setFontWeight('bold');
      }
      var vals = sh.getDataRange().getValues();
      var head = vals[0];
      var cP = head.indexOf('Project'), cC = head.indexOf('CostCategory'),
          cV = head.indexOf('Cap'), cN = head.indexOf('Note'), cU = head.indexOf('Updated');
      if (cP < 0 || cC < 0 || cV < 0) {
        return { ok: false, error: 'CategoryCaps schema เพี้ยน — ลองรีโหลดหน้าและลองใหม่' };
      }
      var raw = p.cap;
      var hasVal = !(raw === '' || raw === null || raw === undefined) && !isNaN(Number(raw));
      var newCap = hasVal ? Number(raw) : '';
      var tid = p.project + '|' + p.costCategory;
      for (var i = 1; i < vals.length; i++) {
        if (String(vals[i][cP]) === String(p.project) &&
            String(vals[i][cC]) === String(p.costCategory)) {
          var old = vals[i][cV];
          sh.getRange(i + 1, cV + 1).setValue(newCap);
          if (cN >= 0 && p.note !== undefined) sh.getRange(i + 1, cN + 1).setValue(p.note || '');
          if (cU >= 0) sh.getRange(i + 1, cU + 1).setValue(new Date());
          audit_(ss, hasVal ? 'capset' : 'capclear', 'CategoryCaps', tid, { Cap: [old, newCap] });
          return { ok: true };
        }
      }
      if (!hasVal) return { ok: true };   // nothing to clear if it doesn't exist yet
      appendByHeader_(sh, 'CategoryCaps', {
        Project: p.project, CostCategory: p.costCategory, Cap: newCap,
        Note: p.note || '', Updated: new Date()
      });
      audit_(ss, 'capset', 'CategoryCaps', tid, { Cap: ['', newCap] });
      return { ok: true };
    });
  } catch (e) {
    return { ok: false, error: 'setCategoryCap: ' + (e && e.message ? e.message : String(e)) };
  }
}

/** Replace the entire CostCategories master list with the user-provided array.
 *  Each entry becomes one row (Name, Order, Updated). Used by the Settings
 *  modal's textarea editor — the client sends the full list every save. */
function setCostCategories(p) {
  try {
    return withLock_(function () {
      var ss = getMaster_();
      var sh = ss.getSheetByName('CostCategories');
      if (!sh) {
        sh = ss.insertSheet('CostCategories');
        sh.appendRow(SHEET_HEADERS.CostCategories);
        sh.setFrozenRows(1);
        sh.getRange(1, 1, 1, SHEET_HEADERS.CostCategories.length).setFontWeight('bold');
      }
      var list = (p && Array.isArray(p.list)) ? p.list : [];
      // De-dup + trim, preserve user order.
      var seen = {}, clean = [];
      list.forEach(function (raw) {
        var s = String(raw || '').trim();
        if (!s) return;
        if (seen[s]) return;
        seen[s] = 1;
        clean.push(s);
      });
      // Wipe existing data rows, write fresh ones.
      var last = sh.getLastRow();
      if (last > 1) sh.deleteRows(2, last - 1);
      if (clean.length) {
        var rows = clean.map(function (name, i) { return [name, i + 1, new Date()]; });
        sh.getRange(2, 1, rows.length, 3).setValues(rows);
      }
      audit_(ss, 'edit', 'CostCategories', '*', { count: ['', clean.length] });
      return { ok: true, count: clean.length };
    });
  } catch (e) {
    return { ok: false, error: 'setCostCategories: ' + (e && e.message ? e.message : String(e)) };
  }
}

/** One-shot migration: for legacy Transactions rows where Description holds a
 *  company name ("บริษัท ...", "หจก. ...", "กิจการร่วมค้า ...") and Beneficiary
 *  is still empty, move Description → Beneficiary so the field shows up correctly
 *  in the วัตถุประสงค์ / ผู้รับผลประโยชน์ split. Also clears Note when it duplicates
 *  the same company string (a side-effect of an earlier reqFormFill fallback).
 *
 *  Safe to run multiple times — already-migrated rows skip because Beneficiary
 *  is no longer empty. Run from Apps Script editor (no args) and look at the
 *  return value: {ok, moved, notesCleaned, scanned, skipped}. */
function migrateBeneficiary() {
  var ss = getMaster_();
  var sh = ss.getSheetByName('Transactions');
  var vals = sh.getDataRange().getValues();
  var head = vals[0];
  var cD = head.indexOf('Description'),
      cB = head.indexOf('Beneficiary'),
      cP = head.indexOf('Purpose'),
      cN = head.indexOf('Note');
  if (cD < 0 || cB < 0) return { ok: false, error: 'Description / Beneficiary column missing — open the app once to migrate the schema first' };
  var companyRe = /^(บริษัท|หจก\.?|ห้างหุ้นส่วน|กิจการร่วมค้า)/;
  var moved = 0, notesCleaned = 0, scanned = 0, skipped = 0;
  for (var i = 1; i < vals.length; i++) {
    scanned++;
    var desc = String(vals[i][cD] || '').trim();
    var ben  = String(vals[i][cB] || '').trim();
    if (!desc) { skipped++; continue; }
    if (ben)   { skipped++; continue; }  // already populated, leave alone
    if (!companyRe.test(desc)) { skipped++; continue; }
    sh.getRange(i + 1, cB + 1).setValue(desc);   // Description → Beneficiary
    sh.getRange(i + 1, cD + 1).setValue('');     // clear Description
    if (cN >= 0 && String(vals[i][cN] || '').trim() === desc) {
      sh.getRange(i + 1, cN + 1).setValue('');   // clean dup Note
      notesCleaned++;
    }
    moved++;
  }
  return { ok: true, scanned: scanned, moved: moved, notesCleaned: notesCleaned, skipped: skipped };
}

/**
 * REMOVED 2026-09-01 — this function abandoned the live database.
 *
 * It deleted MASTER_SHEET_ID and called setupMaster_(), which creates a new
 * spreadsheet and writes its id back over the pointer. getMaster_()'s guard
 * could not stop it: that guard treats "no id stored" as a genuine first run,
 * and deleting the property first made the test pass by construction.
 *
 * The real database was never touched — the app simply stopped looking at it,
 * which is indistinguishable from data loss to everyone using it. HR Work Log
 * lost its database twice this way before the same pattern was removed there,
 * and this sat in the editor's function dropdown one row from bindMaster(),
 * which is what someone reaches for when something is already wrong.
 *
 * To rebuild a master sheet deliberately: create the spreadsheet by hand, then
 * bindMaster('<its id>') below. Two steps, both explicit, neither reachable by
 * a mis-click.
 *
 * See ARCHITECTURE_STANDARD.md rule 2, "Never silently reseed".
 */

/** Admin helper: returns the master sheet URL (also forces creation). */
function masterUrl() {
  return getMaster_().getUrl();
}

/** Admin: bind this script to a specific master sheet by ID — the dual of
 *  resetMaster(). Use after a project recovery where setupMaster_() silently
 *  created a junk sheet because MASTER_SHEET_ID wasn't set. Returns the URL
 *  of the now-bound sheet so you can sanity-check you hit the right one. */
function bindMaster(id) {
  if (!id) throw new Error('bindMaster: id is required');
  PropertiesService.getScriptProperties().setProperty('MASTER_SHEET_ID', String(id));
  return getMaster_().getUrl();
}

