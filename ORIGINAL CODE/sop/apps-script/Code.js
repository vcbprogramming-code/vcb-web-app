/**
 * Code.gs — server entry for the VCB-MANGO ERP SOP web app.
 *
 * The web app is the single source of truth — all edits happen here
 * (editScenario/createScenario/createReport/swapScenarioPositions), which
 * write into the Google Doc (SOP_DOC_ID) as a one-way backup/mirror. Parsed
 * content is cached in CacheService (fast) + PropertiesService (durable,
 * chunked), and every mutation also drops a timestamped JSON snapshot into
 * a Drive folder (see backupToDrive_) as an independent recovery point.
 *
 * The Doc is NOT read back into the app automatically or on a schedule —
 * editing the Doc directly no longer has any effect on what the app shows.
 * There is no sync-from-Doc entry point anymore (removed along with the old
 * auto-sync trigger); refreshFromDoc_() below is strictly a write-then-
 * re-read-your-own-write helper for the admin mutation functions.
 */
var SOP_DOC_ID = '1emolyExkvNIIEAp-8jWqM3laDF_H6c0v8qVuwHheJxo';
var CHAPTER_MODULE = {'1':'SE','2':'BD','3':'OF','4':'PO','5':'IC','6':'AP','7':'AR','8':'PM','9':'FA','10':'GL'};
/** Reverse of CHAPTER_MODULE — used by createScenario() to write a "บทที่ N"
 * reference the parser can read the module back out of (see parseDoc_'s chMatch). */
var MODULE_CHAPTER = {'SE':'1','BD':'2','OF':'3','PO':'4','IC':'5','AP':'6','AR':'7','PM':'8','FA':'9','GL':'10'};
var DEFAULT_META = {
  title: 'VCB-MANGO ERP Standard Operating Procedure',
  subtitle: 'ระเบียบปฏิบัติมาตรฐาน · กลุ่มวิจิตรภัณฑ์ก่อสร้าง',
  manual: 'VCB-MANGO ERP Manual 14.3.68'
};
/** Stand-in "created" date for cases written before dateAdded existed — the
 * SOP's own stated effective month. Not a real per-case date; see createScenario(). */
var BACKFILL_DATE = '1 เมษายน 2569';

/** Allow-list of emails that can edit. Add more here when needed. */
var ADMIN_EMAILS = ['c.chavananand@vcb-con.com'];

/* ---------- Drive folders: ADDRESS BY ID, NEVER BY NAME, NEVER CREATE ----------
 *
 * The SOP flow-diagram PDFs live HERE and nowhere else:
 *   E:\WORK\05 SYSTEMS\01 MANGO ERP\07 Diagrams   (local source of truth)
 *   https://drive.google.com/drive/folders/1ZEG3lkQxdkC7Ix5J-yWPbKPiLaVBxukL
 *
 * This script must NEVER call DriveApp.createFolder(). A previous version
 * looked a folder up by name and created one when it missed, which produced a
 * stray duplicate ("SOP Diagrams") in the owner's Drive that had to be deleted
 * by hand. Look folders up by the IDs below; if an ID stops resolving, fix the
 * ID — do not add a fallback that creates anything.
 */
var DIAGRAMS_FOLDER_ID = '1ZEG3lkQxdkC7Ix5J-yWPbKPiLaVBxukL';

/** Drive folder for point-in-time JSON snapshots — see backupToDrive_(), which
 * is currently unused. Empty means "no backup folder configured": the helper
 * refuses to run rather than creating one. Paste an existing folder's ID here
 * to re-enable it. */
var BACKUP_FOLDER_ID = '';

/** SOP flow-diagram PDFs (Drive) keyed by case displayNo — used by the one-time
 * /exec?attachdiagrams=1 endpoint. Files live in the shared "07 Diagrams"
 * folder, which is already set to "anyone with the link" so the thumbnails
 * render for every viewer, not just admins. */
var DIAGRAM_MAP_ = {
  "PO-1": [
    {
      "label": "SOP-01 · PO Decrement",
      "url": "https://drive.google.com/file/d/1xPP1G4drq-DZENWeSIVYR85WkcN42V9l/view"
    }
  ],
  "PO-2": [
    {
      "label": "SOP-02 · Blanket PO",
      "url": "https://drive.google.com/file/d/1zhRk6JcxxAhFKoKuvylmgK_etJXGKVsr/view"
    }
  ],
  "PO-3": [
    {
      "label": "SOP-03 · PO Invoice Price Mismatch",
      "url": "https://drive.google.com/file/d/1ZyacfOPbC4rOoAmx9x2TFsIy7Fyy7o83/view"
    }
  ],
  "OF-1": [
    {
      "label": "SOP-04 · OF Type Selection",
      "url": "https://drive.google.com/file/d/18jb941tRmGmGKOsxDuoA7eW7S_W0whjT/view"
    }
  ],
  "OF-2": [
    {
      "label": "SOP-05 · Petty Cash",
      "url": "https://drive.google.com/file/d/1iAKDEQ1QBuyqYyStRJMEVt7CMRU8xhnm/view"
    }
  ],
  "AP-4": [
    {
      "label": "SOP-06 · Advance Vendor Credit",
      "url": "https://drive.google.com/file/d/1wy8lqZcA4KwKr5sF4U1KJHuLd6qzbcC5/view"
    }
  ],
  "IC-4": [
    {
      "label": "SOP-07a · Inter Company Stock Shared Tank",
      "url": "https://drive.google.com/file/d/1I9Mr1WqFElDbM86DSyjUF3Eh4EKVECxv/view"
    },
    {
      "label": "SOP-07b · Inter Company Stock Lot Sale",
      "url": "https://drive.google.com/file/d/14DBJtAOsVBZPHocYo62lMFXhKXMSYk1G/view"
    }
  ],
  "IC-3": [
    {
      "label": "SOP-09 · IC Balance Adjustment",
      "url": "https://drive.google.com/file/d/1b9KWZ1u63ioFcJf-wQxMM_kCX9jXqZAe/view"
    }
  ],
  "FA-1": [
    {
      "label": "SOP-10 · Fixed Asset Transfer",
      "url": "https://drive.google.com/file/d/11MqcK2v-0Azva_ZgnWGXTdDo2pJi8cov/view"
    }
  ],
  "PM-1": [
    {
      "label": "SOP-11 · Plan Forecast Other",
      "url": "https://drive.google.com/file/d/1aezTmVTfOnVwEb9G0B5US2WBrtfQS_EF/view"
    }
  ],
  "FA-2": [
    {
      "label": "SOP-12 · Machine Overhaul",
      "url": "https://drive.google.com/file/d/1Wr94EmfPsuslrsOaPsvLOt6mcuGBbtBk/view"
    }
  ],
  "AP-1": [
    {
      "label": "SOP-13 · Internal Bank Transfer",
      "url": "https://drive.google.com/file/d/1t24uUn6_Kml0rCQTQpV57vfun7VKDWLq/view"
    }
  ],
  "AP-2": [
    {
      "label": "SOP-14 · Beneficiary Matching",
      "url": "https://drive.google.com/file/d/1gm8ya14IPoyN9VIOGOw2xKYOEOhl1mN6/view"
    }
  ],
  "GL-1": [
    {
      "label": "SOP-15 · Aval PN Accounting",
      "url": "https://drive.google.com/file/d/1T7v0ZKrainUTbRaI1RyT39Tqh06SHlZA/view"
    }
  ],
  "AP-3": [
    {
      "label": "SOP-16 · Pre Clear AP Late Tax Invoice",
      "url": "https://drive.google.com/file/d/1YdWJckcx_tyxnr68ef1Me9dU3GVUn0uV/view"
    }
  ],
  "BD-1": [
    {
      "label": "SOP-17 · Budget Import Control",
      "url": "https://drive.google.com/file/d/1H7tHAe22DPy_Ye_sQ2bvak0nYSDdc44B/view"
    }
  ],
  "OF-5": [
    {
      "label": "SOP-18 · Progress Submit",
      "url": "https://drive.google.com/file/d/10s2ZJ-FvflMqOHT54KINB_caVoPxL5Dv/view"
    }
  ],
  "SE-2": [
    {
      "label": "SOP-19 · PR OF Loop Assignment",
      "url": "https://drive.google.com/file/d/1Jzkr9WnBO9RM0RQE3Vs7nlk1Q4Nqun71/view"
    }
  ],
  "OF-4": [
    {
      "label": "SOP-20 · Advance Clearance Asset Repair",
      "url": "https://drive.google.com/file/d/1ds7tzQ8lxV75ksV5hWHcGttf5gwOgR32/view"
    }
  ],
  "IC-1": [
    {
      "label": "SOP-21 · Warehouse Area Setup",
      "url": "https://drive.google.com/file/d/1F9Gq4Vl8gx2idH_jc80kRf53UOaqSV4Q/view"
    }
  ],
  "AP-5": [
    {
      "label": "SOP-22 · Urgent Payment Control",
      "url": "https://drive.google.com/file/d/1_iHbdNK4GtmtlivLPAmybnNbh8oOzYqT/view"
    }
  ],
  "FA-3": [
    {
      "label": "SOP-23 · JV Maintenance History",
      "url": "https://drive.google.com/file/d/1MI3AVcFh-HUOlJs_8v3a3RW6JZ63M2vr/view"
    }
  ],
  "GL-2": [
    {
      "label": "SOP-24 · Allocate Expense",
      "url": "https://drive.google.com/file/d/1yvCH_6onJ_cu74jfAzORHS7ObHdgadkZ/view"
    }
  ],
  "IC-5": [
    {
      "label": "SOP-25 · Material Issuance Subcontractor",
      "url": "https://drive.google.com/file/d/1Hm_6tLaVpSyXr8vwUjObtxRGq4xWgmjn/view"
    }
  ],
  "SE-1": [
    {
      "label": "SOP-26 · Project Naming Convention",
      "url": "https://drive.google.com/file/d/1n8ISdRs36dr0gvoBo6vXWdvzr6wz6sS5/view"
    }
  ],
  "PM-2": [
    {
      "label": "SOP-27 · Profit Centre Bookkeeping",
      "url": "https://drive.google.com/file/d/1UHKd7IpkG-GF-jpJuYzbmkdnlCkHL5bt/view"
    }
  ],
  "PM-3": [
    {
      "label": "SOP-28 · Bank Account Management",
      "url": "https://drive.google.com/file/d/1_W4xFgoxe8cXRvhf1q2sa6pxUWZKShAJ/view"
    }
  ],
  "SE-3": [
    {
      "label": "SOP-29 · User Rights Template",
      "url": "https://drive.google.com/file/d/12nbKemU4K4_1RADfc4cQizTcka6wmzfM/view"
    }
  ],
  "OF-3": [
    {
      "label": "SOP-30 · Payment Expense Request Revision",
      "url": "https://drive.google.com/file/d/1FVMCh9xMM_8G6DSBYH1QDw0RRs7pz94t/view"
    }
  ],
  "IC-2": [
    {
      "label": "SOP-31 · Unit of Measure Control",
      "url": "https://drive.google.com/file/d/1K3lBYbSSSvuoRKcr_kQFvV5tZSg_z4l9/view"
    }
  ]
};

/** True only if the request is from a signed-in admin email. */
function isAdmin_() {
  var email = '';
  try { email = (Session.getActiveUser().getEmail() || '').toLowerCase(); } catch (e) {}
  if (!email) return false;
  return ADMIN_EMAILS.some(function (a) { return a.toLowerCase() === email; });
}

function doGet(e) {
  // Debug endpoint: /exec?inspect=N dumps the solution-cell structure for
  // scenario N as plain text. Useful for diagnosing parsing/nesting issues
  // without needing the Apps Script editor.
  if (e && e.parameter && e.parameter.inspect) {
    var no = parseInt(e.parameter.inspect, 10);
    var dump = '';
    try { dump = inspectScenarioStructure(no); }
    catch (err) { dump = 'ERROR: ' + (err && err.message ? err.message : err); }
    return ContentService.createTextOutput(dump).setMimeType(ContentService.MimeType.PLAIN_TEXT);
  }

  // One-time migration endpoint: /exec?migrate=1 (admin only) writes literal
  // "N. " numbers onto every existing top-level step — see renumberAllSteps_.
  // Safe to hit more than once: rows already carrying a literal number are
  // detected and skipped, so re-running is a no-op.
  if (e && e.parameter && e.parameter.migrate) {
    var result = '';
    try { result = JSON.stringify(renumberAllSteps_()); }
    catch (err2) { result = 'ERROR: ' + (err2 && err2.message ? err2.message : err2); }
    return ContentService.createTextOutput(result).setMimeType(ContentService.MimeType.PLAIN_TEXT);
  }

  // Recovery/diagnostic endpoint: /exec?recache=1 drops the cached copy and
  // the chunked Properties copy, then re-parses the Doc from scratch. Use when
  // the app is serving content that no longer matches the Doc (a save that
  // landed in the Doc but didn't surface in the app). Reports what it found so
  // the two can be compared without opening the Doc.
  if (e && e.parameter && e.parameter.recache) {
    var out = '';
    try {
      cacheClear_();
      var pr = PropertiesService.getScriptProperties();
      var oldN = parseInt(pr.getProperty('sopChunks') || '0', 10);
      for (var ci = 0; ci < oldN; ci++) pr.deleteProperty('sop_' + ci);
      pr.deleteProperty('sopChunks');
      var fresh = refreshFromDoc_();
      out = 'Re-parsed from Doc OK\nscenarios=' + fresh.scenarios.length +
            '\nreports=' + (fresh.reports || []).length +
            '\nupdatedAt=' + fresh.meta.updatedAt;
    } catch (err3) { out = 'ERROR: ' + (err3 && err3.message ? err3.message : err3); }
    return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.PLAIN_TEXT);
  }

  // Export: /exec?dump=1 returns the full parsed payload as JSON — the same
  // shape as data/sop.json. Lets that repo fixture be regenerated from live
  // content instead of drifting further from it. Read-only.
  if (e && e.parameter && e.parameter.dump) {
    var outD = '';
    try { outD = JSON.stringify(getSopData()); }
    catch (errD) { outD = JSON.stringify({ error: String(errD && errD.message ? errD.message : errD) }); }
    return ContentService.createTextOutput(outD).setMimeType(ContentService.MimeType.JSON);
  }

  // Diagnostic: /exec?cases=1 lists every case as "no|displayNo|titleEN|titleTH"
  // plus its current attachment count. Read-only; used to map external files to
  // cases without having to trust a stale local export.
  if (e && e.parameter && e.parameter.cases) {
    var outC = '';
    try {
      var dc = getSopData();
      outC = (dc.scenarios || []).map(function (s) {
        return s.no + '|' + (s.displayNo || '') + '|' + (s.titleEN || '') + '|' +
               (s.titleTH || '') + '|att=' + ((s.attachments || []).length);
      }).join('\n');
    } catch (errC) { outC = 'ERROR: ' + (errC && errC.message ? errC.message : errC); }
    return ContentService.createTextOutput(outC).setMimeType(ContentService.MimeType.PLAIN_TEXT);
  }

  // One-time bulk attach: /exec?attachdiagrams=1 (admin only) wires the SOP
  // flow-diagram PDFs in Drive to their matching cases. Idempotent — a case
  // that already has the URL is skipped, so re-running is a no-op.
  if (e && e.parameter && e.parameter.attachdiagrams) {
    var outA = '';
    try { outA = JSON.stringify(bulkAttachByDisplayNo(DIAGRAM_MAP_, e.parameter.replace === '1'), null, 1); }
    catch (errA) { outA = 'ERROR: ' + (errA && errA.message ? errA.message : errA); }
    return ContentService.createTextOutput(outA).setMimeType(ContentService.MimeType.PLAIN_TEXT);
  }

  /* getSopData() throws when the Doc will not open and neither the cache nor
     the chunked Script Properties can serve a copy. Unguarded, that throw
     escaped doGet and the visitor got Apps Script's raw error page.

     The cache usually masks a dead Doc, which makes this worse rather than
     better: the app keeps working until a cache expiry, then dies with nothing
     connecting the failure to its cause.

     Falling back to an empty document renders the real app — sidebar, topbar,
     search, the Process Flows (which ship in the source, not the Doc) — with
     no cases in it. That is the truth of the situation, and it is what the
     other apps do. `degraded` lets the client say why. */
  var data;
  try {
    data = getSopData();
  } catch (errData) {
    console.warn('SOP document unavailable, rendering empty: ' + (errData && errData.message));
    data = { meta: {}, scenarios: [], reports: [] };
    data.meta.degraded = true;
    data.meta.degradedError = (errData && errData.message) ? errData.message : String(errData);
  }
  if (!data.meta) data.meta = {};
  // Inject session info so the client knows whether to show edit UI
  data.meta.isAdmin = isAdmin_();
  try { data.meta.userEmail = Session.getActiveUser().getEmail() || ''; } catch (e2) { data.meta.userEmail = ''; }
  // The deployed /exec URL — the client can't reliably read this itself
  // (it runs inside Apps Script's sandboxed iframe, so location.href is the
  // sandbox's own URL, not the shareable one) — needed to build "share this
  // case" links. See ?case=N handling below.
  data.meta.appUrl = ScriptApp.getService().getUrl();
  // Deep link: /exec?case=N opens straight to that scenario. Validated
  // against the parsed data so a stale/bad N just falls back to normal.
  if (e && e.parameter && e.parameter.case) {
    var wantCase = parseInt(e.parameter.case, 10);
    if (!isNaN(wantCase) && data.scenarios.some(function (s) { return s.no === wantCase; })) {
      data.meta.initialCase = wantCase;
    }
  }
  // Deep link: /exec?flow=ID opens straight to that process flow (e.g.
  // 'BD-1.0'). SOP_FLOWS lives client-side only (static data baked into
  // index.html, not parsed from the Doc), so unlike ?case=N above there's
  // nothing to validate against here — the client's openInitialCase()
  // falls back to the normal placeholder if the id doesn't match anything.
  if (e && e.parameter && e.parameter.flow) {
    data.meta.initialFlow = String(e.parameter.flow);
  }
  var json = JSON.stringify(data).replace(/<\/script>/g, '<\\/script>');
  var t = HtmlService.createTemplateFromFile('index');
  t.bootstrap = json;
  return t.evaluate()
    .setTitle('VCB Standard Operating Procedure')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Fast read path: Cache → Properties → fresh parse. */
/* ---------- Cache helpers ----------
 * CacheService caps a single value at 100 KB and throws "Argument too large:
 * value" past it — which is a HARD failure in the save path, not a degraded
 * cache: the throw propagates out of refreshFromDoc_() and aborts the whole
 * mutation. The payload crossed that line once per-case attachments were added
 * (102,167 bytes against a 102,400 limit — 233 bytes of headroom), so every
 * save that added a line failed. Chunked the same way PropertiesService already
 * is, with the chunk count under its own key. */
var CACHE_CHUNK_ = 90000;   // safely under the 100KB/value cap
var CACHE_TTL_ = 21600;

function cachePut_(json) {
  var cache = CacheService.getScriptCache();
  var n = Math.ceil(json.length / CACHE_CHUNK_);
  var batch = { sopChunks: String(n) };
  for (var i = 0; i < n; i++) batch['sop_' + i] = json.slice(i * CACHE_CHUNK_, (i + 1) * CACHE_CHUNK_);
  cache.putAll(batch, CACHE_TTL_);
}

function cacheGet_() {
  var cache = CacheService.getScriptCache();
  var n = parseInt(cache.get('sopChunks') || '0', 10);
  if (!n) return null;
  var keys = [];
  for (var i = 0; i < n; i++) keys.push('sop_' + i);
  var got = cache.getAll(keys);
  var s = '';
  for (var j = 0; j < n; j++) {
    var part = got['sop_' + j];
    if (part == null) return null;      // partial expiry — treat as a miss
    s += part;
  }
  return s || null;
}

function cacheClear_() {
  var cache = CacheService.getScriptCache();
  var n = parseInt(cache.get('sopChunks') || '0', 10);
  var keys = ['sopData', 'sopChunks'];
  for (var i = 0; i < n; i++) keys.push('sop_' + i);
  try { cache.removeAll(keys); } catch (e) {}
}

function getSopData() {
  var cached = cacheGet_();
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }
  var stored = loadFromProps_();
  if (stored) {
    try {
      var obj = JSON.parse(stored);
      cachePut_(stored);
      return obj;
    } catch (e) {}
  }
  return refreshFromDoc_();
}

/**
 * Returns the same payload as doGet's bootstrap (data + isAdmin + userEmail).
 * Called from the client after save / sync to refresh in-memory data without
 * reloading the sandboxed iframe (which goes white because Apps Script iframe
 * URLs are single-use).
 */
function getSopDataForClient() {
  var data = getSopData();
  data.meta.isAdmin = isAdmin_();
  try { data.meta.userEmail = Session.getActiveUser().getEmail() || ''; } catch (e) { data.meta.userEmail = ''; }
  data.meta.appUrl = ScriptApp.getService().getUrl();
  return data;
}

function refreshFromDoc_() {
  // Apps Script buffers Document writes — they are not guaranteed to be visible
  // to a subsequent DocumentApp.openById() read until the script ends or the
  // pending changes are explicitly flushed. Every mutation here is
  // write-then-immediately-re-parse, so without this the parse below can read
  // the PRE-edit document and cache it: the save really lands in the Doc, but
  // the app keeps showing the old content until some later refresh.
  DocumentApp.openById(SOP_DOC_ID).saveAndClose();
  var data = parseDoc_();
  if (!data.scenarios || data.scenarios.length < 5) {
    throw new Error('Parser returned too few scenarios (' + (data.scenarios || []).length + '). Refusing to overwrite cache.');
  }
  data.meta.updatedAt = new Date().toISOString();
  var json = JSON.stringify(data);
  cachePut_(json);
  saveToProps_(json);
  // backupToDrive_ is intentionally NOT called here. The Drive scope was never
  // authorized for the deployed web app, so this call failed on every save —
  // silently, via its own catch — and left the google.script.run request
  // hanging so the client's failure handler never fired: saves span forever
  // with no error. The Doc itself remains the backup of record.
  return data;
}

/**
 * Point-in-time snapshot helper — CURRENTLY UNUSED (see refreshFromDoc_).
 *
 * NEVER CREATE A DRIVE FOLDER FROM THIS SCRIPT. An earlier version called
 * DriveApp.createFolder() when it couldn't find one by name, which silently
 * produced a stray duplicate folder in the owner's Drive. Folders are now
 * addressed by hard-coded ID only (DIAGRAMS_FOLDER_ID / BACKUP_FOLDER_ID
 * above): if the ID doesn't resolve, this throws and does nothing rather than
 * inventing a folder. Re-enabling snapshots means setting BACKUP_FOLDER_ID to
 * a folder that already exists — not restoring the create-on-miss behaviour.
 */
function backupToDrive_(json) {
  if (!BACKUP_FOLDER_ID) {
    throw new Error('backupToDrive_: BACKUP_FOLDER_ID is not set. Create the folder ' +
                    'manually in Drive and paste its ID — this script must never create one.');
  }
  try {
    var folder = DriveApp.getFolderById(BACKUP_FOLDER_ID);   // throws if missing; never creates
    var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', "yyyy-MM-dd'T'HH-mm-ss");
    folder.createFile('sop-backup-' + stamp + '.json', json, MimeType.PLAIN_TEXT);
  } catch (e) {
    // Swallow — this is a best-effort safety net, not the primary write path.
  }
}

/* ---------- Persistence helpers (PropertiesService values are capped at 9 KB each, so we chunk) ---------- */

function saveToProps_(json) {
  var props = PropertiesService.getScriptProperties();
  var oldN = parseInt(props.getProperty('sopChunks') || '0', 10);
  for (var i = 0; i < oldN; i++) props.deleteProperty('sop_' + i);
  var size = 8000;
  var n = Math.ceil(json.length / size);
  var batch = { sopChunks: String(n) };
  for (var j = 0; j < n; j++) batch['sop_' + j] = json.slice(j * size, (j + 1) * size);
  props.setProperties(batch);
}

function loadFromProps_() {
  var props = PropertiesService.getScriptProperties();
  var n = parseInt(props.getProperty('sopChunks') || '0', 10);
  if (!n) return null;
  var s = '';
  for (var i = 0; i < n; i++) s += props.getProperty('sop_' + i) || '';
  return s || null;
}

/* ---------- Doc parser ---------- */

function parseDoc_() {
  var doc = DocumentApp.openById(SOP_DOC_ID);
  var body = doc.getBody();
  var bodyText = body.getText();

  var meta = {
    title: DEFAULT_META.title,
    subtitle: DEFAULT_META.subtitle,
    manual: DEFAULT_META.manual,
    version: '', effective: '', scope: '',
    purpose: '', notes: []
  };
  var scenarios = [];
  var reports = [];

  body.getTables().forEach(function (t) {
    var rows = t.getNumRows();
    if (rows < 1) return;
    var cols0 = t.getRow(0).getNumCells();

    if (cols0 === 2 && rows <= 4) {
      // Header doc-info table (key/value pairs)
      for (var r = 0; r < rows; r++) {
        var row = t.getRow(r);
        for (var c = 0; c < row.getNumCells(); c++) {
          parseMetaKv_(row.getCell(c).getText().trim(), meta);
        }
      }
    } else if (cols0 === 4 && rows >= 2) {
      // Scenario table (No | Scenario | Problem | Solution)
      var no = 0;
      for (var r2 = 1; r2 < rows; r2++) {
        var row2 = t.getRow(r2);
        if (row2.getNumCells() < 4) continue;
        var titleText = row2.getCell(1).getText().trim();
        var probText = row2.getCell(2).getText().trim();
        var solCell = row2.getCell(3);
        if (!titleText && !probText) continue;
        no++;

        var rawTitle = titleText.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean).join(' ')
          .replace(/^##\s*/, '').replace(/\s+/g, ' ').trim();
        var titleEN = '';
        var titleTH = rawTitle;
        var enMatch = rawTitle.match(/\(([^()]+)\)\s*$/);
        if (enMatch) {
          titleEN = enMatch[1].trim();
          titleTH = rawTitle.slice(0, enMatch.index).trim();
        }

        var parsed = parseSolutionCell_(solCell);
        var module = '';
        var chMatch = (parsed.ref || '').match(/บทที่\s*(\d+)/);
        if (chMatch) module = CHAPTER_MODULE[chMatch[1]] || '';

        scenarios.push({
          no: no,
          module: module,
          titleTH: titleTH,
          titleEN: titleEN,
          when: probText || '-',
          steps: parsed.steps,
          ref: parsed.ref || '',
          note: parsed.note || '',
          // Cases written before this field existed have no real recorded creation
          // date — BACKFILL_DATE is a single stand-in (SOP's stated effective
          // month) used only when the Doc doesn't carry its own "วันที่เพิ่ม:" line.
          dateAdded: parsed.dateAdded || BACKFILL_DATE,
          // Modules this case ALSO belongs to, beyond its primary `module` (which
          // still drives its number, color, and main chapter ref). Purely additive
          // for sidebar filtering — see assignDisplayNo_ and the list-filter checks.
          // Drop any tag matching the case's own module (e.g. a hand-edited Doc
          // line), mirroring the filter createScenario/editScenario apply on write.
          extraModules: (parsed.extraModules || []).filter(function (m) { return m && m !== module; }),
          attachments: parsed.attachments || []
        });
      }
    } else if (cols0 === 3 && rows >= 2) {
      // Reports table (Case | Scenario | Directions)
      for (var r3 = 1; r3 < rows; r3++) {
        var row3 = t.getRow(r3);
        if (row3.getNumCells() < 3) continue;
        var c0 = row3.getCell(0).getText().trim();
        var c1 = row3.getCell(1).getText().trim();
        var c2 = row3.getCell(2).getText().trim();
        var caseN = parseInt(c0, 10);
        if (isNaN(caseN)) continue;
        reports.push({
          case: caseN,
          scenario: c1.replace(/\s+/g, ' ').trim(),
          path: c2.replace(/\\>/g, '>').replace(/\s+/g, ' ').trim()
        });
      }
    }
  });

  // Purpose paragraph (first paragraph after the heading)
  var pIdx = bodyText.indexOf('วัตถุประสงค์และขอบเขต');
  if (pIdx >= 0) {
    var after = bodyText.slice(pIdx);
    var pm = after.match(/วัตถุประสงค์และขอบเขต[^\n]*\n+([\s\S]+?)\n\s*\n/);
    if (pm) meta.purpose = pm[1].replace(/\s+/g, ' ').trim();
  }

  // Notes bullets at the bottom
  var nIdx = bodyText.indexOf('หมายเหตุ (Notes)');
  if (nIdx >= 0) {
    bodyText.slice(nIdx).split(/\r?\n/).forEach(function (line) {
      var t2 = line.trim();
      if (/^[–-]\s+/.test(t2)) {
        meta.notes.push(t2.replace(/^[–-]\s+/, '').replace(/\*+/g, '').trim());
      }
    });
  }

  assignDisplayNo_(scenarios);
  return { meta: meta, scenarios: scenarios, reports: reports };
}

/**
 * Assigns each scenario a per-module display label ("PO-1", "IC-3", …) —
 * restarts at 1 within each module, counted in Doc order. `no` stays the
 * global row-position identity used internally by editScenario/createScenario
 * to find the right Doc row; `displayNo` is purely a derived label, never
 * used for lookups, so numbering a module's cases never touches other rows.
 */
function assignDisplayNo_(scenarios) {
  var counters = {};
  scenarios.forEach(function (s) {
    var m = s.module || '?';
    counters[m] = (counters[m] || 0) + 1;
    s.displayNo = m + '-' + counters[m];
  });
}

function parseMetaKv_(txt, meta) {
  if (!txt) return;
  var idx = txt.indexOf(':');
  if (idx < 0) return;
  var k = txt.slice(0, idx).trim();
  var v = txt.slice(idx + 1).trim();
  if (!v) return;
  if (/version|เวอร์ชั่น|เวอร์ชัน/i.test(k)) meta.version = v;
  else if (/effective|มีผล/i.test(k)) meta.effective = v;
  else if (/scope|ขอบเขต/i.test(k)) meta.scope = v;
  else if (/ระบบอ้างอิง|manual/i.test(k)) meta.manual = v;
}

/** Parse a solution cell's children into steps[], plus ref + note.
 *
 * Each entry in steps[] is one of three kinds, matching the client's textarea
 * convention (see stepsToStorage/stepsFromStorage in index.html):
 *   - "N. text"  — a numbered top-level step (N is written into the Doc text
 *     itself as of the one-time renumberAllSteps_ migration; the client still
 *     renders the *position*, not the literal N, via CSS counters).
 *   - "» text" / "» » text" / … — a sub-bullet, depth = number of '» ' repeats.
 *   - "· text" — an unmarked caption, no number, no bullet.
 *
 * Depth for LIST_ITEMs comes from:
 *   1. The LIST_ITEM's explicit Doc nesting level (1 = '» ', 2 = '» » ', …).
 *   2. If nesting level is 0 but the LIST_ITEM uses a different glyph from the
 *      first one seen in this cell, treat it as depth 1 — i.e. the Doc author
 *      used ♦ for parents and ▶ for children at the same nesting level (Google
 *      Docs allows custom glyphs without bumping the level). Glyph mismatch
 *      alone can't distinguish depth 2+, so it only ever yields depth 1.
 * A bare PARAGRAPH (no bullet glyph) following a LIST_ITEM is a caption.
 */
function parseSolutionCell_(cell) {
  var steps = [];
  var ref = '';
  var note = '';
  var dateAdded = '';
  var extraModules = [];
  var attachments = [];
  var primaryGlyph = null;     // first list-item glyph; everything matching it is top-level
  var sawListItem = false;     // PARAGRAPHs after a LIST_ITEM are treated as sub-text
  var n = cell.getNumChildren();
  for (var i = 0; i < n; i++) {
    var child = cell.getChild(i);
    var type = child.getType();
    var txt = '';
    var isListItem = false;
    var nestingLevel = 0;
    var glyph = null;

    if (type === DocumentApp.ElementType.LIST_ITEM) {
      var li = child.asListItem();
      txt = li.getText().trim();
      isListItem = true;
      nestingLevel = li.getNestingLevel();
      try { glyph = li.getGlyphType(); } catch (e) { glyph = null; }
    } else if (type === DocumentApp.ElementType.PARAGRAPH) {
      txt = child.asParagraph().getText().trim();
    } else {
      continue;
    }
    if (!txt) continue;

    if (txt.indexOf('►') >= 0 || /^อ้างอิง:/.test(txt)) {
      ref = txt.replace(/^[*\s]*►\s*อ้างอิง:\s*/, '').replace(/^อ้างอิง:\s*/, '').replace(/\*+$/, '').trim();
      continue;
    }
    if (/^\*?\s*หมายเหตุ:/.test(txt)) {
      note = txt.replace(/^\*?\s*หมายเหตุ:\s*/, '').replace(/\*+$/, '').trim();
      continue;
    }
    if (/^\*?\s*วันที่เพิ่ม:/.test(txt)) {
      dateAdded = txt.replace(/^\*?\s*วันที่เพิ่ม:\s*/, '').replace(/\*+$/, '').trim();
      continue;
    }
    if (/^\*?\s*หมวดเพิ่มเติม:/.test(txt)) {
      var extraStr = txt.replace(/^\*?\s*หมวดเพิ่มเติม:\s*/, '').replace(/\*+$/, '').trim();
      extraModules = extraStr.split(',').map(function (m) { return m.trim(); }).filter(Boolean);
      continue;
    }
    // Attachments: one "ไฟล์แนบ: Label | URL" line per file, same
    // metadata-line convention as ref/note/dateAdded above. Stored as text so
    // it survives the Doc round-trip with no extra OAuth scope — the files
    // themselves live in Drive (or anywhere linkable) and are only referenced.
    if (/^\*?\s*ไฟล์แนบ:/.test(txt)) {
      var attStr = txt.replace(/^\*?\s*ไฟล์แนบ:\s*/, '').replace(/\*+$/, '').trim();
      var pipeAt = attStr.lastIndexOf('|');
      var aLabel = pipeAt >= 0 ? attStr.slice(0, pipeAt).trim() : '';
      var aUrl = pipeAt >= 0 ? attStr.slice(pipeAt + 1).trim() : attStr;
      if (aUrl) attachments.push({ label: aLabel || aUrl, url: aUrl });
      continue;
    }

    if (isListItem) {
      if (primaryGlyph === null && glyph !== null) primaryGlyph = glyph;
      var isSub = nestingLevel > 0 || (primaryGlyph !== null && glyph !== null && glyph !== primaryGlyph);
      // Depth = Doc nesting level, clamped to 1 when only the glyph differs
      // (glyph mismatch alone can't tell us how deep — treat as one level).
      var depth = nestingLevel > 0 ? nestingLevel : (isSub ? 1 : 0);
      steps.push(depth > 0 ? repeat_('» ', depth) + txt : txt);
      sawListItem = true;
    } else {
      // Bare PARAGRAPH (no bullet glyph) after a list item → unmarked caption
      // text under the previous step, same concept as '· ' in stored steps[].
      steps.push(sawListItem ? '· ' + txt : txt);
    }
  }
  return { steps: steps, ref: ref, note: note, dateAdded: dateAdded, extraModules: extraModules, attachments: attachments };
}

/**
 * Debug helper — dumps what the parser sees in a scenario's solution cell so
 * we can verify nesting heuristics against the real Doc structure.
 * Run from the Apps Script editor:  Logger.log(inspectScenarioStructure(8))
 * Or use the zero-arg wrapper inspect8() below and hit Run.
 */
function inspect8() { Logger.log(inspectScenarioStructure(8)); }
function inspectScenarioStructure(no) {
  var doc = DocumentApp.openById(SOP_DOC_ID);
  var body = doc.getBody();
  var scenarioTable = null;
  body.getTables().forEach(function (t) {
    if (scenarioTable) return;
    if (t.getNumRows() > 1 && t.getRow(0).getNumCells() === 4) scenarioTable = t;
  });
  if (!scenarioTable) return 'no scenario table';

  var counter = 0;
  for (var r = 1; r < scenarioTable.getNumRows(); r++) {
    var row = scenarioTable.getRow(r);
    if (row.getNumCells() < 4) continue;
    var titleText = row.getCell(1).getText().trim();
    var probText = row.getCell(2).getText().trim();
    if (!titleText && !probText) continue;
    counter++;
    if (counter !== no) continue;

    var cell = row.getCell(3);
    var lines = ['Scenario #' + no + ' — solution cell structure:'];
    var nc = cell.getNumChildren();
    for (var i = 0; i < nc; i++) {
      var child = cell.getChild(i);
      var type = child.getType();
      if (type === DocumentApp.ElementType.LIST_ITEM) {
        var li = child.asListItem();
        var glyph = '';
        try { glyph = String(li.getGlyphType()); } catch (e) { glyph = '?'; }
        lines.push('[' + i + '] LIST_ITEM  level=' + li.getNestingLevel() +
                   '  glyph=' + glyph + '  text="' + li.getText().slice(0, 60) + '"');
      } else if (type === DocumentApp.ElementType.PARAGRAPH) {
        lines.push('[' + i + '] PARAGRAPH                       text="' +
                   child.asParagraph().getText().slice(0, 60) + '"');
      } else {
        lines.push('[' + i + '] ' + type);
      }
    }
    return lines.join('\n');
  }
  return 'scenario #' + no + ' not found';
}

/* =========================================================================
 * formatDoc() — style the source Google Doc so it looks similar to the web
 * app, making it easier to edit. Run this from the Apps Script editor.
 * Idempotent — safe to re-run any time. Modifies the Doc directly; revert
 * via the Doc's File → Version history if needed.
 * ========================================================================= */

var FMT_BRAND      = '#1F3864';
var FMT_BRAND_SOFT = '#E7EEF7';
var FMT_PROBLEM_BG = '#FFF8EC';
var FMT_MUTED      = '#57606A';
var FMT_INK        = '#1F2328';
var FMT_RED        = '#B5302A';

function formatDoc() {
  var doc = DocumentApp.openById(SOP_DOC_ID);
  var body = doc.getBody();

  // 1. Whole-doc default font + size + ink colour
  var defaults = {};
  defaults[DocumentApp.Attribute.FONT_FAMILY] = 'Sarabun';
  defaults[DocumentApp.Attribute.FONT_SIZE] = 11;
  defaults[DocumentApp.Attribute.FOREGROUND_COLOR] = FMT_INK;
  body.setAttributes(defaults);

  // 2. Strip markdown junk (\*\*, \*, escaped backslashes, &#10;)
  cleanMarkdownArtifacts_(body);

  // 3. Apply Heading 2 style to numbered section paragraphs (1., 2., 3.)
  styleSectionHeadings_(body);

  // 4. Style each table based on its column count
  body.getTables().forEach(function (t) {
    var rows = t.getNumRows();
    if (rows < 1) return;
    var cols0 = t.getRow(0).getNumCells();
    if (cols0 === 4 && rows >= 2) styleScenarioTable_(t);
    else if (cols0 === 3 && rows >= 2) styleReportsTable_(t);
    else if (cols0 === 2 && rows <= 4) styleHeaderTable_(t);
  });

  // 5. Refresh web-app cache so changes are reflected immediately
  try { refreshFromDoc_(); } catch (e) { /* swallow — caller can re-sync */ }

  return { ok: true, formattedAt: new Date().toISOString() };
}

function cleanMarkdownArtifacts_(body) {
  function clean(s) {
    return s
      .replace(/\\\*\\\*/g, '')   // \*\*
      .replace(/\\\*/g, '')        // \*
      .replace(/\\\\/g, '')        // \\
      .replace(/&#10;/g, '\n')
      .replace(/&#8226;/g, '•');
  }
  body.getParagraphs().forEach(function (p) {
    var s = p.getText();
    if (!s) return;
    var c = clean(s);
    if (c !== s) p.setText(c);
  });
  body.getListItems().forEach(function (li) {
    var s = li.getText();
    if (!s) return;
    var c = clean(s);
    if (c !== s) li.setText(c);
  });
}

function styleSectionHeadings_(body) {
  var n = body.getNumChildren();
  for (var i = 0; i < n; i++) {
    var child = body.getChild(i);
    if (child.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
    var p = child.asParagraph();
    var s = p.getText().trim();
    if (!s) continue;
    if (/^[1-9]\.\s+\S/.test(s) && s.length < 90) {
      p.setHeading(DocumentApp.ParagraphHeading.HEADING2);
      p.editAsText().setForegroundColor(FMT_BRAND).setBold(true).setFontSize(16);
    }
  }
}

function styleScenarioTable_(t) {
  var rows = t.getNumRows();
  var head = t.getRow(0);
  for (var c = 0; c < head.getNumCells(); c++) {
    var hc = head.getCell(c);
    hc.setBackgroundColor(FMT_BRAND);
    hc.editAsText().setForegroundColor('#FFFFFF').setBold(true).setFontSize(11);
  }
  for (var r = 1; r < rows; r++) {
    var row = t.getRow(r);
    if (row.getNumCells() < 4) continue;

    var no = row.getCell(0);
    no.setBackgroundColor(FMT_BRAND_SOFT);
    no.editAsText().setForegroundColor(FMT_BRAND).setBold(true).setFontSize(13);

    var title = row.getCell(1);
    title.setBackgroundColor(null);
    styleScenarioTitleCell_(title);

    var prob = row.getCell(2);
    prob.setBackgroundColor(FMT_PROBLEM_BG);
    prob.editAsText().setForegroundColor('#5D4A18').setBold(false).setItalic(false).setFontSize(10);

    var sol = row.getCell(3);
    sol.setBackgroundColor(null);
    styleSolutionCell_(sol);
  }
}

function styleScenarioTitleCell_(cell) {
  var n = cell.getNumChildren();
  var firstSeen = false;
  for (var i = 0; i < n; i++) {
    var child = cell.getChild(i);
    if (child.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
    var p = child.asParagraph();
    var s = p.getText();
    if (!s || !s.trim()) continue;
    if (!firstSeen) {
      if (/^##\s+/.test(s)) p.setText(s.replace(/^##\s+/, ''));
      p.editAsText().setBold(true).setItalic(false).setFontSize(13).setForegroundColor(FMT_INK);
      firstSeen = true;
    } else {
      p.editAsText().setItalic(true).setBold(false).setFontSize(10).setForegroundColor(FMT_MUTED);
    }
  }
}

function styleSolutionCell_(cell) {
  var n = cell.getNumChildren();
  for (var i = 0; i < n; i++) {
    var child = cell.getChild(i);
    var type = child.getType();
    var text = '';
    var asTxt = null;
    if (type === DocumentApp.ElementType.PARAGRAPH) {
      text = child.asParagraph().getText();
      asTxt = child.asParagraph().editAsText();
    } else if (type === DocumentApp.ElementType.LIST_ITEM) {
      text = child.asListItem().getText();
      asTxt = child.asListItem().editAsText();
    } else continue;
    if (!text || !text.trim()) continue;

    if (text.indexOf('►') >= 0 || /^อ้างอิง:/.test(text)) {
      asTxt.setItalic(true).setForegroundColor(FMT_MUTED).setFontSize(10).setBold(false);
    } else if (/^\s*หมายเหตุ:/.test(text)) {
      asTxt.setForegroundColor(FMT_RED).setBold(false).setItalic(false).setFontSize(10);
    } else {
      asTxt.setForegroundColor(FMT_INK).setBold(false).setItalic(false).setFontSize(11);
    }
  }
}

function styleReportsTable_(t) {
  var rows = t.getNumRows();
  var head = t.getRow(0);
  for (var c = 0; c < head.getNumCells(); c++) {
    var hc = head.getCell(c);
    hc.setBackgroundColor(FMT_BRAND);
    hc.editAsText().setForegroundColor('#FFFFFF').setBold(true).setFontSize(11);
  }
  for (var r = 1; r < rows; r++) {
    var row = t.getRow(r);
    if (row.getNumCells() < 3) continue;
    var caseCell = row.getCell(0);
    caseCell.editAsText().setBold(true).setForegroundColor(FMT_BRAND).setFontSize(11);
    var pathCell = row.getCell(2);
    pathCell.editAsText().setFontFamily('Consolas').setForegroundColor('#2B3A33').setFontSize(10).setBold(false).setItalic(false);
  }
}

function styleHeaderTable_(t) {
  var rows = t.getNumRows();
  for (var r = 0; r < rows; r++) {
    var row = t.getRow(r);
    for (var c = 0; c < row.getNumCells(); c++) {
      var cell = row.getCell(c);
      cell.setBackgroundColor('#FBFCFE');
      cell.editAsText().setFontSize(10).setForegroundColor(FMT_INK).setBold(false).setItalic(false);
    }
  }
}

/**
 * One-time migration: run manually (from the Apps Script editor, or once via
 * doGet's ?migrate=1 debug hook — see doGet) after deploying the numbered/
 * sub/caption step rewrite. Every existing top-level step in every scenario
 * was implicitly "numbered by position" (the old default); this writes that
 * position in as literal "N. " text so the new rule — only lines that already
 * carry a number get numbered — doesn't silently un-number all existing SOP
 * content. Sub-bullets ('» ') and anything already numbered are left as-is;
 * only bare top-level list items get a number prepended.
 */
function renumberAllSteps_() {
  if (!isAdmin_()) throw new Error('Unauthorized — admin only.');
  var doc = DocumentApp.openById(SOP_DOC_ID);
  var body = doc.getBody();
  var scenarioTable = null;
  body.getTables().forEach(function (t) {
    if (scenarioTable) return;
    if (t.getNumRows() > 1 && t.getRow(0).getNumCells() === 4) scenarioTable = t;
  });
  if (!scenarioTable) throw new Error('Could not find the scenario table in the Doc.');

  var touched = 0;
  for (var r = 1; r < scenarioTable.getNumRows(); r++) {
    var row = scenarioTable.getRow(r);
    if (row.getNumCells() < 4) continue;
    var solCell = row.getCell(3);
    var parsed = parseSolutionCell_(solCell);
    if (!parsed.steps.length) continue;

    var stepNo = 0;
    var alreadyNumbered = false;
    var renumbered = parsed.steps.map(function (line) {
      if (line.indexOf('» ') === 0 || line.indexOf('· ') === 0) return line;
      if (/^\d+\.\s/.test(line)) { alreadyNumbered = true; return line; } // already migrated
      stepNo++;
      return stepNo + '. ' + line;
    });
    if (alreadyNumbered) continue; // this row already has literal numbers — skip
    if (!stepNo) continue;         // no top-level steps to number (all sub/caption)

    clearCell_(solCell);
    writeSteps_(solCell, renumbered);
    if (parsed.note) {
      solCell.appendParagraph('หมายเหตุ: ' + parsed.note).editAsText()
        .setForegroundColor(FMT_RED).setBold(false).setItalic(false).setFontSize(10);
    }
    if (parsed.ref) {
      solCell.appendParagraph('► อ้างอิง: ' + parsed.ref).editAsText()
        .setItalic(true).setBold(false).setFontSize(10).setForegroundColor(FMT_MUTED);
    }
    if (parsed.extraModules && parsed.extraModules.length) {
      solCell.appendParagraph('หมวดเพิ่มเติม: ' + parsed.extraModules.join(', ')).editAsText()
        .setItalic(true).setBold(false).setFontSize(10).setForegroundColor(FMT_MUTED);
    }
    if (parsed.dateAdded) {
      solCell.appendParagraph('วันที่เพิ่ม: ' + parsed.dateAdded).editAsText()
        .setItalic(true).setBold(false).setFontSize(10).setForegroundColor(FMT_MUTED);
    }
    writeAttachments_(solCell, parsed.attachments);
    trimLeadingEmptyParagraph_(solCell);
    touched++;
  }

  var newData = refreshFromDoc_();
  return { ok: true, scenariosRenumbered: touched, scenarios: newData.scenarios.length };
}

/* =========================================================================
 * editScenario — write the edited scenario back to the Doc, then refresh
 * the cache. Called from the in-app editor; admin-gated by email.
 * ========================================================================= */
/**
 * Bulk-attach files to many cases in ONE pass. Takes a map of
 * { "<displayNo>": [{label,url}, ...] } and appends the "ไฟล์แนบ:" metadata
 * lines to each matching case's solution cell.
 *
 * Deliberately NOT implemented as N editScenario() calls: each of those
 * rewrites the whole solution cell and then re-parses the entire document, so
 * 31 of them would be 31 full document parses. This walks the table once,
 * appends only the new lines (existing content is untouched), and refreshes
 * the cache a single time at the end.
 *
 * Idempotent: a case that already carries the exact URL is skipped, so
 * re-running never duplicates an attachment.
 */
function bulkAttachByDisplayNo(map, replaceMode) {
  if (!isAdmin_()) throw new Error('Unauthorized — admin only.');
  // Called from the Settings "Re-attach all diagrams" button with map=null,
  // meaning "use the server's own DIAGRAM_MAP_" — the client has no business
  // knowing file ids.
  if (!map) map = DIAGRAM_MAP_;
  if (!map) throw new Error('Missing map.');

  var doc = DocumentApp.openById(SOP_DOC_ID);
  var body = doc.getBody();
  var scenarioTable = null;
  body.getTables().forEach(function (t) {
    if (scenarioTable) return;
    if (t.getNumRows() > 1 && t.getRow(0).getNumCells() === 4) scenarioTable = t;
  });
  if (!scenarioTable) throw new Error('Could not find the scenario table in the Doc.');

  var counters = {};
  var applied = [], skipped = [], missing = {};
  Object.keys(map).forEach(function (k) { missing[k] = true; });

  for (var r = 1; r < scenarioTable.getNumRows(); r++) {
    var row = scenarioTable.getRow(r);
    if (row.getNumCells() < 4) continue;
    var titleText = row.getCell(1).getText().trim();
    var probText = row.getCell(2).getText().trim();
    if (!titleText && !probText) continue;

    var solCell = row.getCell(3);
    var cellText = solCell.getText();
    var chMatch = cellText.match(/บทที่\s*(\d+)/);
    var module = chMatch ? (CHAPTER_MODULE[chMatch[1]] || '?') : '?';
    counters[module] = (counters[module] || 0) + 1;
    var displayNo = module + '-' + counters[module];

    var want = map[displayNo];
    if (!want || !want.length) continue;
    delete missing[displayNo];

    if (replaceMode) {
      // Drop every existing "ไฟล์แนบ:" paragraph first, then write the new set.
      // Needed when the source files are re-uploaded: the old rows point at
      // trashed Drive ids that still resolve today but break once Trash empties.
      var removed = 0;
      for (var ci = solCell.getNumChildren() - 1; ci >= 0; ci--) {
        var child = solCell.getChild(ci);
        var ctype = child.getType();
        if (ctype !== DocumentApp.ElementType.PARAGRAPH &&
            ctype !== DocumentApp.ElementType.LIST_ITEM) continue;
        var ctext = (ctype === DocumentApp.ElementType.PARAGRAPH)
          ? child.asParagraph().getText() : child.asListItem().getText();
        if (/^\*?\s*ไฟล์แนบ:/.test(ctext.trim())) {
          if (solCell.getNumChildren() > 1) { solCell.removeChild(child); removed++; }
        }
      }
      writeAttachments_(solCell, want);
      applied.push(displayNo + '(-' + removed + '/+' + want.length + ')');
      continue;
    }

    var toAdd = want.filter(function (a) {
      return a && a.url && cellText.indexOf(a.url) === -1;   // already present?
    });
    if (!toAdd.length) { skipped.push(displayNo); continue; }
    writeAttachments_(solCell, toAdd);
    applied.push(displayNo + '(+' + toAdd.length + ')');
  }

  var newData = refreshFromDoc_();
  return {
    ok: true,
    applied: applied,
    skipped: skipped,
    notFound: Object.keys(missing),
    scenarios: newData.scenarios.length
  };
}

function editScenario(data) {
  if (!isAdmin_()) {
    var email = '';
    try { email = Session.getActiveUser().getEmail() || ''; } catch (e) {}
    throw new Error('Unauthorized — this URL is anonymous or your email (' + (email || '—') + ') is not an admin. Open the admin sign-in URL.');
  }
  if (!data || !data.no || data.no < 1) throw new Error('Missing scenario number.');

  var doc = DocumentApp.openById(SOP_DOC_ID);
  var body = doc.getBody();
  var scenarioTable = null;
  body.getTables().forEach(function (t) {
    if (scenarioTable) return;
    if (t.getNumRows() > 1 && t.getRow(0).getNumCells() === 4) scenarioTable = t;
  });
  if (!scenarioTable) throw new Error('Could not find the scenario table in the Doc.');

  // Walk rows, count non-empty scenario rows, find the target
  var targetRow = null;
  var counter = 0;
  for (var r = 1; r < scenarioTable.getNumRows(); r++) {
    var row = scenarioTable.getRow(r);
    if (row.getNumCells() < 4) continue;
    var titleText = row.getCell(1).getText().trim();
    var probText = row.getCell(2).getText().trim();
    if (!titleText && !probText) continue;
    counter++;
    if (counter === data.no) { targetRow = row; break; }
  }
  if (!targetRow) throw new Error('Scenario #' + data.no + ' not found in the Doc.');

  // Title cell (TH bold + EN italic muted)
  var titleCell = targetRow.getCell(1);
  clearCell_(titleCell);
  if (data.titleTH) {
    titleCell.appendParagraph(data.titleTH).editAsText()
      .setBold(true).setItalic(false).setFontSize(13).setForegroundColor(FMT_INK);
  }
  if (data.titleEN) {
    titleCell.appendParagraph('(' + data.titleEN + ')').editAsText()
      .setItalic(true).setBold(false).setFontSize(10).setForegroundColor(FMT_MUTED);
  }
  trimLeadingEmptyParagraph_(titleCell);

  // Problem cell
  var probCell = targetRow.getCell(2);
  clearCell_(probCell);
  probCell.setBackgroundColor(FMT_PROBLEM_BG);
  probCell.appendParagraph(data.when || '-').editAsText()
    .setForegroundColor('#5D4A18').setBold(false).setItalic(false).setFontSize(10);
  trimLeadingEmptyParagraph_(probCell);

  // Solution cell — bullets + optional note + ref
  var solCell = targetRow.getCell(3);
  // Preserve the existing dateAdded line — clearCell_ wipes the whole cell below,
  // and this rewrite has no "date" field of its own to overwrite it with.
  var existingParsed = parseSolutionCell_(solCell);
  var existingDateAdded = existingParsed.dateAdded;
  // extraModules: if the caller didn't send the field at all, keep what's there
  // (mirrors dateAdded); if they sent an array (even empty, to clear all tags),
  // use exactly that.
  var extraModules = data.extraModules !== undefined ? (data.extraModules || []) : existingParsed.extraModules;
  clearCell_(solCell);
  writeSteps_(solCell, data.steps);
  if (data.note) {
    solCell.appendParagraph('หมายเหตุ: ' + data.note).editAsText()
      .setForegroundColor(FMT_RED).setBold(false).setItalic(false).setFontSize(10);
  }
  // Module changed (case moved to a different module, e.g. PO → IC)? The case's
  // module is derived entirely from the FIRST "บทที่ N" in the ref (there's no
  // separate module field in the Doc — see parseDoc_'s chMatch) — swap ONLY
  // that first chapter+label pair (e.g. "บทที่ 4 (PO)" → "บทที่ 5 (IC)"),
  // leaving the rest of the ref text (manual name, any other chapters already
  // listed) exactly as written.
  var refText = (data.ref !== undefined ? data.ref : existingParsed.ref) || '';
  var currentChMatch = refText.match(/บทที่\s*(\d+)/);
  var currentModule = currentChMatch ? (CHAPTER_MODULE[currentChMatch[1]] || '') : '';
  if (data.module && data.module !== currentModule) {
    var newChapter = MODULE_CHAPTER[data.module] || '';
    if (newChapter) {
      var oldChapterPattern = /บทที่\s*\d+(\s*\([^)]*\))?/;
      var newChapterText = 'บทที่ ' + newChapter + ' (' + data.module + ')';
      if (oldChapterPattern.test(refText)) {
        refText = refText.replace(oldChapterPattern, newChapterText);
      } else {
        refText += (refText ? ' | ' : '') + newChapterText;
      }
    }
  }
  if (refText) {
    solCell.appendParagraph('► อ้างอิง: ' + refText).editAsText()
      .setItalic(true).setBold(false).setFontSize(10).setForegroundColor(FMT_MUTED);
  }
  var ownModule = data.module || currentModule;
  var newExtraModules = (extraModules || []).filter(function (m) { return m && m !== ownModule; });
  if (newExtraModules.length) {
    solCell.appendParagraph('หมวดเพิ่มเติม: ' + newExtraModules.join(', ')).editAsText()
      .setItalic(true).setBold(false).setFontSize(10).setForegroundColor(FMT_MUTED);
  }
  if (existingDateAdded) {
    solCell.appendParagraph('วันที่เพิ่ม: ' + existingDateAdded).editAsText()
      .setItalic(true).setBold(false).setFontSize(10).setForegroundColor(FMT_MUTED);
  }
  // Same convention as extraModules above: field omitted → keep what's in the
  // Doc; field sent (even empty, to clear all) → use exactly what was sent.
  writeAttachments_(solCell, data.attachments !== undefined
    ? (data.attachments || []) : existingParsed.attachments);
  trimLeadingEmptyParagraph_(solCell);

  // Refresh cache so all viewers see the change
  var newData = refreshFromDoc_();
  return { ok: true, no: data.no, scenarios: newData.scenarios.length };
}

/* =========================================================================
 * createScenario — append a brand-new row to the Doc's scenario table, then
 * refresh the cache. Called from the in-app "+ New case" button; admin-gated
 * by email. The parser (parseDoc_) assigns `no` by counting non-empty rows in
 * order, so appending at the bottom always becomes the next sequential case —
 * the "No" cell text itself is just a visual label, not read by the parser.
 * ========================================================================= */
function createScenario(data) {
  if (!isAdmin_()) {
    var email = '';
    try { email = Session.getActiveUser().getEmail() || ''; } catch (e) {}
    throw new Error('Unauthorized — this URL is anonymous or your email (' + (email || '—') + ') is not an admin. Open the admin sign-in URL.');
  }
  if (!data || !data.module) throw new Error('Missing module.');
  if (!data.titleTH || !data.titleTH.trim()) throw new Error('Missing title.');

  var doc = DocumentApp.openById(SOP_DOC_ID);
  var body = doc.getBody();
  var scenarioTable = null;
  body.getTables().forEach(function (t) {
    if (scenarioTable) return;
    if (t.getNumRows() > 1 && t.getRow(0).getNumCells() === 4) scenarioTable = t;
  });
  if (!scenarioTable) throw new Error('Could not find the scenario table in the Doc.');

  // Next display number = count of existing non-empty scenario rows + 1.
  var nextNo = 0;
  for (var r = 1; r < scenarioTable.getNumRows(); r++) {
    var row = scenarioTable.getRow(r);
    if (row.getNumCells() < 4) continue;
    var titleText = row.getCell(1).getText().trim();
    var probText = row.getCell(2).getText().trim();
    if (!titleText && !probText) continue;
    nextNo++;
  }
  nextNo++;

  var newRow = scenarioTable.appendTableRow();
  newRow.appendTableCell();
  newRow.appendTableCell();
  newRow.appendTableCell();
  newRow.appendTableCell();

  // No cell — styled to match styleScenarioTable_'s existing rows.
  var noCell = newRow.getCell(0);
  clearCell_(noCell);
  noCell.setBackgroundColor(FMT_BRAND_SOFT);
  noCell.getChild(0).asParagraph().setText(String(nextNo));
  noCell.editAsText().setForegroundColor(FMT_BRAND).setBold(true).setFontSize(13);

  // Title cell (TH bold + EN italic muted)
  var titleCell = newRow.getCell(1);
  clearCell_(titleCell);
  titleCell.appendParagraph(data.titleTH.trim()).editAsText()
    .setBold(true).setItalic(false).setFontSize(13).setForegroundColor(FMT_INK);
  if (data.titleEN && data.titleEN.trim()) {
    titleCell.appendParagraph('(' + data.titleEN.trim() + ')').editAsText()
      .setItalic(true).setBold(false).setFontSize(10).setForegroundColor(FMT_MUTED);
  }
  trimLeadingEmptyParagraph_(titleCell);

  // Problem cell
  var probCell = newRow.getCell(2);
  clearCell_(probCell);
  probCell.setBackgroundColor(FMT_PROBLEM_BG);
  probCell.appendParagraph((data.when && data.when.trim()) || '-').editAsText()
    .setForegroundColor('#5D4A18').setBold(false).setItalic(false).setFontSize(10);
  trimLeadingEmptyParagraph_(probCell);

  // Solution cell — bullets + optional note + ref (chapter number drives module).
  var solCell = newRow.getCell(3);
  clearCell_(solCell);
  writeSteps_(solCell, data.steps);
  if (data.note && data.note.trim()) {
    solCell.appendParagraph('หมายเหตุ: ' + data.note.trim()).editAsText()
      .setForegroundColor(FMT_RED).setBold(false).setItalic(false).setFontSize(10);
  }
  var chapter = MODULE_CHAPTER[data.module] || '';
  var refText = (data.ref && data.ref.trim()) || (chapter ? ('ERP Manual 14.3.68 – บทที่ ' + chapter) : '');
  if (chapter && refText.indexOf('บทที่ ' + chapter) < 0) {
    refText += (refText ? ' | ' : '') + 'บทที่ ' + chapter;
  }
  if (refText) {
    solCell.appendParagraph('► อ้างอิง: ' + refText).editAsText()
      .setItalic(true).setBold(false).setFontSize(10).setForegroundColor(FMT_MUTED);
  }
  var newExtraModules = (data.extraModules || []).filter(function (m) { return m && m !== data.module; });
  if (newExtraModules.length) {
    solCell.appendParagraph('หมวดเพิ่มเติม: ' + newExtraModules.join(', ')).editAsText()
      .setItalic(true).setBold(false).setFontSize(10).setForegroundColor(FMT_MUTED);
  }
  // Stamp today's date so the case shows a real creation date going forward.
  solCell.appendParagraph('วันที่เพิ่ม: ' + formatThaiDate_(new Date())).editAsText()
    .setItalic(true).setBold(false).setFontSize(10).setForegroundColor(FMT_MUTED);
  writeAttachments_(solCell, data.attachments);
  trimLeadingEmptyParagraph_(solCell);

  // Refresh cache so all viewers see the new case
  var newData = refreshFromDoc_();
  return { ok: true, no: nextNo, scenarios: newData.scenarios.length };
}

/**
 * Create a new row in the "วิธีเรียก Report" table (Case | Scenario | Menu Path).
 * `case` links back to an existing scenario's display number (just a label in
 * this table, not a foreign key the parser enforces) — mirrors createScenario's
 * write-then-refreshFromDoc_ pattern.
 */
function createReport(data) {
  if (!isAdmin_()) {
    var email = '';
    try { email = Session.getActiveUser().getEmail() || ''; } catch (e) {}
    throw new Error('Unauthorized — this URL is anonymous or your email (' + (email || '—') + ') is not an admin. Open the admin sign-in URL.');
  }
  if (!data || !data.scenario || !data.scenario.trim()) throw new Error('Missing scenario description.');
  if (!data.path || !data.path.trim()) throw new Error('Missing menu path.');

  var doc = DocumentApp.openById(SOP_DOC_ID);
  var body = doc.getBody();
  var reportsTable = null;
  body.getTables().forEach(function (t) {
    if (reportsTable) return;
    if (t.getNumRows() > 1 && t.getRow(0).getNumCells() === 3) reportsTable = t;
  });
  if (!reportsTable) throw new Error('Could not find the reports table in the Doc.');

  var caseNo = parseInt(data.case, 10);
  if (isNaN(caseNo)) caseNo = reportsTable.getNumRows(); // best-effort running number if none supplied

  var newRow = reportsTable.appendTableRow();
  newRow.appendTableCell();
  newRow.appendTableCell();
  newRow.appendTableCell();

  var caseCell = newRow.getCell(0);
  clearCell_(caseCell);
  caseCell.getChild(0).asParagraph().setText(String(caseNo));
  caseCell.editAsText().setBold(true).setForegroundColor(FMT_BRAND).setFontSize(11);

  var scenarioCell = newRow.getCell(1);
  clearCell_(scenarioCell);
  scenarioCell.getChild(0).asParagraph().setText(data.scenario.trim());
  scenarioCell.editAsText().setForegroundColor(FMT_INK).setBold(false).setItalic(false).setFontSize(11);

  var pathCell = newRow.getCell(2);
  clearCell_(pathCell);
  pathCell.getChild(0).asParagraph().setText(data.path.trim());
  pathCell.editAsText().setFontFamily('Consolas').setForegroundColor('#2B3A33').setFontSize(10).setBold(false).setItalic(false);

  // Refresh cache so all viewers see the new report row
  var newData = refreshFromDoc_();
  return { ok: true, reports: newData.reports.length };
}

/* =========================================================================
 * swapScenarioPositions — trade the entire row content of two scenario rows
 * (e.g. PO-3 ↔ PO-5), so numbering within a module can be reordered without
 * touching anything in between. Row COUNT and every other case's position is
 * unaffected — this is a content swap, not a row move (Apps Script has no
 * reliable native "move row" API that preserves rich formatting; swapping
 * each cell's children via .copy() achieves the same visible result safely).
 * ========================================================================= */
function swapScenarioPositions(data) {
  if (!isAdmin_()) {
    var email = '';
    try { email = Session.getActiveUser().getEmail() || ''; } catch (e) {}
    throw new Error('Unauthorized — this URL is anonymous or your email (' + (email || '—') + ') is not an admin. Open the admin sign-in URL.');
  }
  if (!data || !data.no || data.no < 1) throw new Error('Missing scenario number.');
  if (!data.swapWith) throw new Error('Missing target case (swapWith).');

  var doc = DocumentApp.openById(SOP_DOC_ID);
  var body = doc.getBody();
  var scenarioTable = null;
  body.getTables().forEach(function (t) {
    if (scenarioTable) return;
    if (t.getNumRows() > 1 && t.getRow(0).getNumCells() === 4) scenarioTable = t;
  });
  if (!scenarioTable) throw new Error('Could not find the scenario table in the Doc.');

  // Walk all non-empty scenario rows once, computing each one's display label
  // (mirrors assignDisplayNo_) so we can resolve data.swapWith ("PO-5") to a row.
  var rows = [];
  var counters = {};
  for (var r = 1; r < scenarioTable.getNumRows(); r++) {
    var row = scenarioTable.getRow(r);
    if (row.getNumCells() < 4) continue;
    var titleText = row.getCell(1).getText().trim();
    var probText = row.getCell(2).getText().trim();
    if (!titleText && !probText) continue;
    var no = rows.length + 1;
    // getText() on the whole cell, not parseSolutionCell_ — the module comes
    // from the first "บทที่ N" in the cell's text, and the full structural
    // parse (which walks every list item and paragraph) is hundreds of Docs
    // API calls per swap for information a plain text match already gives us.
    var chMatch = row.getCell(3).getText().match(/บทที่\s*(\d+)/);
    var module = chMatch ? (CHAPTER_MODULE[chMatch[1]] || '?') : '?';
    counters[module] = (counters[module] || 0) + 1;
    rows.push({ no: no, row: row, displayNo: module + '-' + counters[module] });
  }

  var rowA = null, rowB = null;
  rows.forEach(function (item) {
    if (item.no === data.no) rowA = item.row;
    if (item.displayNo === data.swapWith) rowB = item.row;
  });
  if (!rowA) throw new Error('Scenario #' + data.no + ' not found in the Doc.');
  if (!rowB) throw new Error('Case "' + data.swapWith + '" not found — check the label and try again.');
  if (rowA === rowB) throw new Error('Cannot swap a case with itself.');

  // Swap by RELOCATING the two rows, not by rebuilding their contents. The old
  // approach deep-copied every child of all 8 cells one element at a time —
  // a solution cell holds 20+ list items, and each copy/remove/append is its
  // own Docs API round-trip, so a single swap cost hundreds of them. Moving a
  // row is one operation and carries all formatting with it for free.
  //
  // insertTableRow(index, row) with an already-attached row moves it. Order
  // matters: take the LATER row out first so removing it can't shift the
  // earlier row's index out from under us.
  var idxA = scenarioTable.getChildIndex(rowA);
  var idxB = scenarioTable.getChildIndex(rowB);
  if (idxA !== idxB) {
    var firstIdx = Math.min(idxA, idxB), lastIdx = Math.max(idxA, idxB);
    var firstRow = firstIdx === idxA ? rowA : rowB;
    var lastRow  = firstIdx === idxA ? rowB : rowA;
    // Detach both, then reinsert in swapped order at the two original slots.
    var lastCopy  = lastRow.copy();
    var firstCopy = firstRow.copy();
    scenarioTable.removeChild(lastRow);
    scenarioTable.removeChild(firstRow);
    scenarioTable.insertTableRow(firstIdx, lastCopy);
    scenarioTable.insertTableRow(lastIdx, firstCopy);
  }

  // Refresh cache so all viewers see the swap
  var newData = refreshFromDoc_();
  return { ok: true, scenarios: newData.scenarios.length };
}

/* =========================================================================
 * deleteScenario — remove one case's row from the Doc's scenario table
 * entirely. Every later case in the SAME module renumbers up by one (its
 * displayNo is recomputed from row order on next read, same as everywhere
 * else in this file) — this is a real row delete, not a content clear.
 * ========================================================================= */
function deleteScenario(data) {
  if (!isAdmin_()) {
    var email = '';
    try { email = Session.getActiveUser().getEmail() || ''; } catch (e) {}
    throw new Error('Unauthorized — this URL is anonymous or your email (' + (email || '—') + ') is not an admin. Open the admin sign-in URL.');
  }
  if (!data || !data.no || data.no < 1) throw new Error('Missing scenario number.');

  var doc = DocumentApp.openById(SOP_DOC_ID);
  var body = doc.getBody();
  var scenarioTable = null;
  body.getTables().forEach(function (t) {
    if (scenarioTable) return;
    if (t.getNumRows() > 1 && t.getRow(0).getNumCells() === 4) scenarioTable = t;
  });
  if (!scenarioTable) throw new Error('Could not find the scenario table in the Doc.');

  var targetRowIndex = -1;
  var counter = 0;
  for (var r = 1; r < scenarioTable.getNumRows(); r++) {
    var row = scenarioTable.getRow(r);
    if (row.getNumCells() < 4) continue;
    var titleText = row.getCell(1).getText().trim();
    var probText = row.getCell(2).getText().trim();
    if (!titleText && !probText) continue;
    counter++;
    if (counter === data.no) { targetRowIndex = r; break; }
  }
  if (targetRowIndex < 0) throw new Error('Scenario #' + data.no + ' not found in the Doc.');

  scenarioTable.removeRow(targetRowIndex);

  // Refresh cache so all viewers see the deletion
  var newData = refreshFromDoc_();
  return { ok: true, scenarios: newData.scenarios.length };
}

/** Replaces all of a TableCell's children with the given detached elements
 * (each already produced by .copy()). Used by swapScenarioPositions. */
function replaceCellChildren_(cell, newChildren) {
  for (var i = cell.getNumChildren() - 1; i >= 0; i--) cell.removeChild(cell.getChild(i));
  newChildren.forEach(function (el) {
    var type = el.getType();
    if (type === DocumentApp.ElementType.PARAGRAPH) cell.appendParagraph(el);
    else if (type === DocumentApp.ElementType.LIST_ITEM) cell.appendListItem(el);
    else if (type === DocumentApp.ElementType.TABLE) cell.appendTable(el);
  });
  // A cell must always have at least one child — appendParagraph/appendListItem
  // above guarantee this as long as newChildren was non-empty (it always is;
  // clearCell_'s placeholder-space convention means every cell has ≥1 child).
}

/** Format a Date as "D เดือน พ.ศ." (Thai Buddhist-era month name + year). */
function formatThaiDate_(d) {
  var months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
    'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}

/** '» ' repeated n times — the nesting-depth prefix client and Doc share. */
function repeat_(s, n) {
  var out = '';
  for (var i = 0; i < n; i++) out += s;
  return out;
}

/** Strip leading '» ' repeats off a step line, returning {depth, text}. */
function stepDepth_(line) {
  var depth = 0;
  var rest = line;
  while (rest.indexOf('» ') === 0) {
    depth++;
    rest = rest.slice(2);
  }
  return { depth: depth, text: rest.trim() };
}

/**
 * Write a steps[] array (numbered "N. text" / sub "» text" / caption "· text")
 * into a solution TableCell. Numbered and sub lines become bulleted LIST_ITEMs
 * (nesting level = sub depth); captions become bare PARAGRAPHs with no bullet,
 * matching what parseSolutionCell_ reads back for each shape. Shared by
 * createScenario and editScenario so both write identically.
 */
function writeSteps_(cell, steps) {
  (steps || []).forEach(function (line) {
    if (!line || !line.trim()) return;
    var trimmed = line.trim();
    if (trimmed.indexOf('· ') === 0) {
      var text = trimmed.slice(2).trim();
      if (!text) return;
      cell.appendParagraph(text).editAsText()
        .setForegroundColor(FMT_INK).setBold(false).setItalic(false).setFontSize(11);
      return;
    }
    var parsed = stepDepth_(trimmed);
    if (!parsed.text) return;
    var li = cell.appendListItem(parsed.text);
    li.setNestingLevel(parsed.depth);
    li.editAsText().setForegroundColor(FMT_INK).setBold(false).setItalic(false).setFontSize(11);
  });
}

/**
 * Writes the "ไฟล์แนบ: Label | URL" metadata lines (one per attachment) that
 * parseSolutionCell_ reads back. Shared by renumberAllSteps_/editScenario/
 * createScenario so all three round-trip identically. Order matters only in
 * that these sit with the other metadata lines at the bottom of the cell.
 */
function writeAttachments_(cell, attachments) {
  (attachments || []).forEach(function (a) {
    if (!a || !a.url) return;
    var label = (a.label || '').trim() || a.url;
    cell.appendParagraph('ไฟล์แนบ: ' + label + ' | ' + a.url).editAsText()
      .setItalic(true).setBold(false).setFontSize(10).setForegroundColor(FMT_MUTED);
  });
}

function clearCell_(cell) {
  // Apps Script won't accept empty string in setText() on a list item (and in
  // some cases on a paragraph that's the only child of a TableCell). Using a
  // single space avoids "Cannot insert an empty text element." The placeholder
  // is removed later by trimLeadingEmptyParagraph_ once real content is appended.
  var n = cell.getNumChildren();
  for (var i = n - 1; i > 0; i--) cell.removeChild(cell.getChild(i));
  var first = cell.getChild(0);
  if (first.getType() === DocumentApp.ElementType.PARAGRAPH) first.asParagraph().setText(' ');
  else if (first.getType() === DocumentApp.ElementType.LIST_ITEM) first.asListItem().setText(' ');
}

function trimLeadingEmptyParagraph_(cell) {
  if (cell.getNumChildren() < 2) return;
  var first = cell.getChild(0);
  if (first.getType() === DocumentApp.ElementType.PARAGRAPH && !first.asParagraph().getText().trim()) {
    cell.removeChild(first);
  } else if (first.getType() === DocumentApp.ElementType.LIST_ITEM && !first.asListItem().getText().trim()) {
    cell.removeChild(first);
  }
}

/**
 * Looks up the Drive filename for a pasted attachment URL so the editor can
 * pre-fill the name field. Admin-gated like every other callable, and
 * deliberately read-only: it opens the file to read getName() and nothing else.
 *
 * Returns { name: '<filename>' } on success, or { name: '' } for anything that
 * is not a resolvable Drive file — a non-Drive URL, a typo'd id, or a file the
 * deploying user cannot read. The caller treats an empty name as "leave the
 * field alone", so a lookup failure is never an error the admin has to dismiss;
 * they just type the name themselves as before.
 *
 * The web app runs as USER_DEPLOYING, so this reads Drive with the owner's
 * access — the same identity that can already read the diagram folder.
 */
function getDriveFileName(url) {
  if (!isAdmin_()) throw new Error('Unauthorized — admin only.');
  var id = driveFileIdFromUrl_(String(url || ''));
  if (!id) return { name: '' };
  try {
    var f = DriveApp.getFileById(id);
    var name = f.getName() || '';
    // Strip the extension: the label shows as a caption under the thumbnail in
    // the detail rail, where ".pdf" is noise. The admin can always type it back.
    return { name: name.replace(/\.[A-Za-z0-9]{1,5}$/, '') };
  } catch (e) {
    // Not found / no access / not a file id. Silent by design — see above.
    return { name: '' };
  }
}

/**
 * Server-side twin of driveFileId() in index.html. Kept in sync deliberately:
 * the client uses its copy to decide whether to even ask, and this one guards
 * against a caller passing something that isn't a Drive URL at all.
 */
function driveFileIdFromUrl_(u) {
  var m = u.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/)
       || u.match(/[?&]id=([a-zA-Z0-9_-]{10,})/)
       || u.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  return m ? m[1] : '';
}
