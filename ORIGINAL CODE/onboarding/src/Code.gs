function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || 'home';
  var template = HtmlService.createTemplateFromFile('Index');
  template.initialPage = page;
  /* Admin edits to checklist tasks (see the Checklist Content sheet below)
     need to be baked into the page BEFORE it's sent — unlike progress
     checkmarks (loaded async after render, since they only toggle an
     already-rendered checkbox), checklist TEXT has to be correct at the
     moment renderSectionContent builds each <li>, or the page would flash
     stale hardcoded text and then re-render. Fetched here, server-side,
     and injected as a plain JSON blob the same way initialPage already is
     (see Index.html) — content.html applies these on top of the hardcoded
     PAGES baseline right after building it. */
  /* Wrapped: getChecklistOverrides() throws by design when the content sheet
     cannot be opened (see getChecklistContentSheet_ — it refuses to create a
     replacement, which is correct). Unguarded here, that throw escaped doGet
     and the visitor got Apps Script's raw error page instead of the app.

     A missing sheet means "no admin edits to apply", not "no app". The
     checklist has a full hardcoded baseline in PAGES; the overrides are edits
     layered on top. Falling back to none renders the standard checklist —
     every page, every task, all the structure — which is what the user should
     see. Progress checkmarks load async and degrade on their own. */
  var overrides = {};
  try {
    overrides = getChecklistOverrides();
  } catch (err) {
    console.warn('checklist overrides unavailable, using the hardcoded baseline: ' + err.message);
  }
  template.checklistOverridesJson = JSON.stringify(overrides);
  return template.evaluate()
    .setTitle('VCB 90-Day Onboarding Portal')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setFaviconUrl('https://www.gstatic.com/script/apps_script_1x_16dp.png');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ============================================================
   Onboarding checklist progress — stored in a Google Sheet
   bound to this Apps Script project (created on first use).
   Sheet: "Onboarding Progress", columns: Employee | TaskId | Completed | Timestamp
   ============================================================ */

var PROGRESS_SHEET_NAME = 'Onboarding Progress';

// The real progress database, confirmed in Drive on 2026-08-30 (created
// 2026-07-27, owner c.chavananand@vcb-con.com). Used as a recovery fallback if
// the PROGRESS_SS_ID script property is missing or points at a sheet that no
// longer opens — see getProgressSheet_(). It is never used to create anything.
var PROGRESS_SS_FALLBACK_ID = '1H5d-BwYADdUMix_BjzzWgSo5tFNrgPCYr9nhuhmfW0k';

/** Open the progress database, preferring the stored id and falling back to the
 *  known-good one above. Returns null if neither opens — the caller decides. */
function openProgressSs_(props) {
  var ssId = props.getProperty('PROGRESS_SS_ID');
  if (ssId) {
    try { return SpreadsheetApp.openById(ssId); } catch (e) { /* try fallback */ }
  }
  // Stored id missing or dead. Recover onto the real database rather than
  // failing the request or standing up a blank sheet.
  try {
    var ss = SpreadsheetApp.openById(PROGRESS_SS_FALLBACK_ID);
    props.setProperty('PROGRESS_SS_ID', PROGRESS_SS_FALLBACK_ID); // self-heal
    return ss;
  } catch (e2) { return null; }
}

function getProgressSheet_() {
  var props = PropertiesService.getScriptProperties();
  var ss = openProgressSs_(props);
  if (!ss) {
    // Neither the stored id nor the known-good fallback opened. Fail LOUDLY —
    // never quietly stand up a blank replacement, because the app would then
    // write to an empty sheet and the real progress data would look lost.
    // (On 2026-08-30 an unguarded reseed here created two empty sheets after
    // the live database was trashed.)
    throw new Error(
      'Onboarding progress database could not be opened (tried PROGRESS_SS_ID ' +
      'and the known-good id ' + PROGRESS_SS_FALLBACK_ID + '). It may be in ' +
      'Drive Trash or its sharing may have changed. Restore it, or set ' +
      'PROGRESS_SS_ID to the correct spreadsheet id. Refusing to create a blank ' +
      'replacement.'
    );
  }
  var sheet = ss.getSheetByName(PROGRESS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PROGRESS_SHEET_NAME);
    sheet.appendRow(['Employee', 'TaskId', 'Completed', 'Timestamp']);
    var defaultSheet = ss.getSheetByName('Sheet1');
    if (defaultSheet) ss.deleteSheet(defaultSheet);
  }
  return sheet;
}

function normalizeEmployeeName_(name) {
  return String(name || '').trim().toLowerCase();
}

/* Returns { taskId: true, ... } for every completed task belonging to this employee. */
function getProgress(employeeName) {
  var key = normalizeEmployeeName_(employeeName);
  if (!key) return {};
  var sheet = getProgressSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};
  var data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  var result = {};
  for (var i = 0; i < data.length; i++) {
    if (normalizeEmployeeName_(data[i][0]) === key && data[i][2] === true) {
      result[data[i][1]] = true;
    }
  }
  return result;
}

/* Marks a single task done/undone for an employee. Upserts by (employee, taskId). */
function setTaskDone(employeeName, taskId, done) {
  var key = normalizeEmployeeName_(employeeName);
  if (!key || !taskId) throw new Error('Missing employee name or task id.');

  /* This is a read-scan-then-write upsert with no atomicity of its own.
     Two concurrent calls for the same (employee, taskId) both scan, both
     find no existing row, and both append — producing DUPLICATE rows for
     one key. That is not hypothetical here: syncTaskDone (progress.html)
     automatically retries once, so a call that times out client-side but
     succeeded server-side hits exactly this path. The duplicate is then
     near-permanent: the scan below stops at the FIRST match (break), so a
     later un-tick updates only one of the two rows and getProgress still
     sees the stale `true` from the other — the task appears permanently
     complete and cannot be unticked. Serialize the whole read-write. */
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    /* Surfaced to the user by syncTaskDone's retry-then-revert path,
       rather than silently dropping the write. */
    throw new Error('Server busy, please try again.');
  }
  try {
    var sheet = getProgressSheet_();
    var lastRow = sheet.getLastRow();
    var rowIndex = -1;
    if (lastRow >= 2) {
      var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
      for (var i = 0; i < data.length; i++) {
        if (normalizeEmployeeName_(data[i][0]) === key && data[i][1] === taskId) {
          rowIndex = i + 2;
          break;
        }
      }
    }
    var now = new Date();
    if (rowIndex === -1) {
      sheet.appendRow([employeeName, taskId, !!done, now]);
    } else {
      sheet.getRange(rowIndex, 3, 1, 2).setValues([[!!done, now]]);
    }
    return true;
  } finally {
    lock.releaseLock();
  }
}

/* Moves every saved row from one employee name to another, for the
   Settings → "Change my name" typo-correction flow (promptToChangeName in
   progress.html). Without this a rename would just rewrite localStorage
   and silently orphan all the rows saved under the old spelling, leaving
   the employee staring at an empty checklist.

   If rows already exist under the TARGET name (the employee is merging a
   typo back onto their real record), the two are unioned rather than one
   clobbering the other: a task completed under either spelling stays
   completed, and the duplicate row is removed. */
function renameEmployee(oldName, newName) {
  var oldKey = normalizeEmployeeName_(oldName);
  var newKey = normalizeEmployeeName_(newName);
  if (!oldKey || !newKey) throw new Error('Missing name.');
  if (oldKey === newKey) return true;

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    throw new Error('Server busy, please try again.');
  }
  try {
    var sheet = getProgressSheet_();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return true;
    var data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();

    // Which taskIds already exist under the target name, and are they done?
    var targetDone = {};
    for (var i = 0; i < data.length; i++) {
      if (normalizeEmployeeName_(data[i][0]) === newKey) targetDone[data[i][1]] = data[i][2] === true;
    }

    var rowsToDelete = [];
    for (var j = 0; j < data.length; j++) {
      if (normalizeEmployeeName_(data[j][0]) !== oldKey) continue;
      var taskId = data[j][1];
      var rowNum = j + 2;
      if (Object.prototype.hasOwnProperty.call(targetDone, taskId)) {
        /* Already present under the new name — union the completion flag,
           then drop this now-redundant row. */
        if (data[j][2] === true && !targetDone[taskId]) {
          var target = findRowForTask_(data, newKey, taskId);
          if (target !== -1) sheet.getRange(target, 3).setValue(true);
        }
        rowsToDelete.push(rowNum);
      } else {
        sheet.getRange(rowNum, 1).setValue(newName);
      }
    }
    for (var r = rowsToDelete.length - 1; r >= 0; r--) sheet.deleteRow(rowsToDelete[r]);
    return true;
  } finally {
    lock.releaseLock();
  }
}

/* Row number (1-based, incl. header) of a given (normalized name, taskId)
   within an already-fetched data block, or -1. */
function findRowForTask_(data, key, taskId) {
  for (var i = 0; i < data.length; i++) {
    if (normalizeEmployeeName_(data[i][0]) === key && data[i][1] === taskId) return i + 2;
  }
  return -1;
}

/* Deletes every saved task row for this employee whose taskId's page key starts
   with one of the given prefixes (e.g. ["accounting-"]). Used when an employee
   switches department — an employee belongs to exactly one department at a time,
   so their prior department's progress is discarded rather than kept dangling. */
function clearDepartmentProgress(employeeName, pagePrefixes) {
  var key = normalizeEmployeeName_(employeeName);
  if (!key || !pagePrefixes || !pagePrefixes.length) return true;

  /* The client passes PAGE-key prefixes ("accounting-", from DEPARTMENTS in
     progress.html), but task ids on the sheet use the abbreviated stable-id
     scheme ("acct-p1-know-3") since migrateTaskIdsToStableIds ran. A direct
     indexOf therefore matched NOTHING for every one of the five departments,
     so this function silently deleted zero rows: the confirm modal promised
     the old department's progress was gone, only the in-memory
     PROGRESS_CACHE was actually cleared, and the rows came straight back on
     the next load. Translate through the same TASK_ID_DEPT_ABBR_ map the
     migration used, so the two can't drift apart again. Unknown prefixes
     fall through unchanged rather than being dropped, so a caller passing an
     already-abbreviated prefix still works. */
  var idPrefixes = pagePrefixes.map(function (p) {
    return TASK_ID_DEPT_ABBR_[p] ? TASK_ID_DEPT_ABBR_[p] + '-' : p;
  });

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    throw new Error('Server busy, please try again.');
  }
  try {
    var sheet = getProgressSheet_();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return true;
    var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    var rowsToDelete = [];
    for (var i = 0; i < data.length; i++) {
      if (normalizeEmployeeName_(data[i][0]) !== key) continue;
      var taskId = String(data[i][1] || '');
      for (var p = 0; p < idPrefixes.length; p++) {
        if (taskId.indexOf(idPrefixes[p]) === 0) {
          rowsToDelete.push(i + 2);
          break;
        }
      }
    }
    for (var r = rowsToDelete.length - 1; r >= 0; r--) {
      sheet.deleteRow(rowsToDelete[r]);
    }
    return true;
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
   Pre-boarding document uploads — completion re-uses setTaskDone/
   getProgress (taskId "doc::<docId>") so it rides the same Sheet
   and progress-loading path as checklist tasks. Uploaded files are
   additionally saved to a dedicated Drive folder for the HR record.
   ============================================================ */

var DOC_UPLOAD_FOLDER_NAME = 'VCB Onboarding Portal — Document Uploads';

function getDocUploadFolder_() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty('DOC_UPLOAD_FOLDER_ID');
  if (folderId) {
    try { return DriveApp.getFolderById(folderId); } catch (e) {}
  }
  var folder = DriveApp.createFolder(DOC_UPLOAD_FOLDER_NAME);
  props.setProperty('DOC_UPLOAD_FOLDER_ID', folder.getId());
  return folder;
}

/* Saves an uploaded document to Drive under a per-employee subfolder, then
   marks that document's task done via the same Sheet setTaskDone uses.
   fileData is a base64 string from FileReader on the client (see progress.html). */
/* ~10MB, mirroring MAX_DOC_UPLOAD_BYTES in progress.html. The client
   checks first for a fast, clear error; this is the real enforcement,
   since the client check is trivially bypassed. */
var MAX_DOC_UPLOAD_BYTES_ = 10 * 1024 * 1024;
var ALLOWED_DOC_EXTENSIONS_ = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];

function uploadRequiredDocument(employeeName, docId, fileName, mimeType, base64Data) {
  var key = normalizeEmployeeName_(employeeName);
  if (!key || !docId) throw new Error('Missing employee name or document id.');
  if (!base64Data) throw new Error('That file appears to be empty.');

  /* The input's accept="" attribute is only a file-picker filter, not
     validation — "All Files" in the OS dialog bypasses it entirely, as
     does any direct google.script.run call. Enforce here, where it
     actually holds. Extension rather than MIME, since the client-supplied
     mimeType is equally forgeable and browsers report it inconsistently
     for .doc/.docx anyway. */
  var safeName = String(fileName || '').replace(/[\\\/\x00-\x1f]/g, '_').trim() || docId;
  var ext = safeName.indexOf('.') >= 0 ? safeName.split('.').pop().toLowerCase() : '';
  if (ALLOWED_DOC_EXTENSIONS_.indexOf(ext) === -1) {
    throw new Error('Unsupported file type. Please upload a PDF, image, or Word document.');
  }
  /* base64 is ~4/3 the byte size of what it encodes. */
  if (base64Data.length * 0.75 > MAX_DOC_UPLOAD_BYTES_) {
    throw new Error('That file is too large (limit 10MB).');
  }

  var root = getDocUploadFolder_();
  /* Folder lookup now uses the same normalized key the progress sheet uses.
     It previously used the raw employeeName, so "Somchai" and "somchai"
     shared one set of progress rows but got two different Drive folders. */
  var employeeFolders = root.getFoldersByName(key);
  var employeeFolder = employeeFolders.hasNext() ? employeeFolders.next() : root.createFolder(key);

  var bytes = Utilities.base64Decode(base64Data);
  /* Name the file by docId so a given requirement maps to exactly one
     file. Previously the file kept the user's own filename, so nothing
     tied a file to the requirement it satisfied — HR could not tell which
     upload was which, and re-uploading appended ANOTHER file rather than
     replacing, silently accumulating duplicates with no way to tell which
     was current. Trash any existing file for this docId first, so
     re-uploading genuinely replaces. */
  var storedName = docId + '.' + ext;
  var existing = employeeFolder.getFilesByName(storedName);
  while (existing.hasNext()) existing.next().setTrashed(true);

  var blob = Utilities.newBlob(bytes, mimeType || 'application/octet-stream', storedName);
  var file = employeeFolder.createFile(blob);

  /* Mark the task done only AFTER the file is safely written. If this
     throws, the file exists but the task is unticked — the employee sees
     a failure and re-uploads, which now REPLACES rather than duplicating
     (see above), so the retry is safe. */
  setTaskDone(employeeName, 'doc::' + docId, true);
  return { fileUrl: file.getUrl(), fileName: safeName };
}

/* ============================================================
   Checklist content admin overrides — lets an admin edit/add/remove
   checklist items (Required Reading / Knowledge Requirements / Required
   Outputs, per department per phase) without a code deploy. Every
   checklist item has a permanent id (see it()/itemId() in content.html);
   this sheet stores edits/additions keyed by that id, layered on top of
   the hardcoded PAGES baseline at render time (see getChecklistOverrides
   below and applyChecklistOverrides in content.html) rather than
   replacing it outright — an item with no matching row here just renders
   from its hardcoded baseline, so a never-edited page works exactly as
   before.
   Sheet: "Checklist Content", columns:
     ItemId | PageKey | BlockIndex | Text | Level | Deleted | Order
   - ItemId: matches an existing hardcoded item's id to EDIT it, or a
     freshly admin-assigned id (see newChecklistItemId_) to ADD a new one.
   - PageKey/BlockIndex: which phase page + block (0=Reading, 1=Knowledge,
     2=Outputs) this item belongs to — required for new items (nothing
     hardcoded to fall back to); for edits of an existing item they're
     informational only (the hardcoded PAGES structure still decides where
     an EXISTING item renders — only new items use these to place
     themselves), kept so the sheet is readable/auditable without
     cross-referencing content.html.
   - Text/Level: overrides the item's displayed text / junior-vs-senior
     visibility. Blank Text on an existing-id row means "no text override",
     not "blank text" — see getChecklistOverrides.
   - Deleted: TRUE hides this item entirely (existing items can't be
     removed from content.html without a deploy, so deletion is itself an
     override, not a sheet row removal — keeps the row as an audit trail).
   - Order: sort position within its block; new items without an Order
     value append after every hardcoded item in that block.
   ============================================================ */

var CHECKLIST_CONTENT_SHEET_NAME = 'Checklist Content';
var CHECKLIST_CONTENT_HEADERS = ['ItemId', 'PageKey', 'BlockIndex', 'Text', 'Level', 'Deleted', 'Order'];

function getChecklistContentSheet_() {
  var props = PropertiesService.getScriptProperties();
  // Same path as getProgressSheet_(): prefer the stored id, recover onto the
  // known-good one, and refuse to invent a blank replacement.
  var ss = openProgressSs_(props);
  if (!ss) {
    throw new Error(
      'Onboarding progress database could not be opened (tried PROGRESS_SS_ID ' +
      'and the known-good id ' + PROGRESS_SS_FALLBACK_ID + '). Restore it, or ' +
      'set PROGRESS_SS_ID to the correct spreadsheet id. Refusing to create a ' +
      'blank replacement.'
    );
  }
  var sheet = ss.getSheetByName(CHECKLIST_CONTENT_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CHECKLIST_CONTENT_SHEET_NAME);
    sheet.appendRow(CHECKLIST_CONTENT_HEADERS);
  }
  return sheet;
}

/* Returns { itemId: { text, level, deleted, order } } for every row in the
   sheet — deploy-time overrides layered onto the hardcoded PAGES baseline.
   A row with an empty Text cell means "don't override text", not "set
   text to empty" (an admin clearing a level/order change without
   retyping the full text shouldn't blank it out) — omitted from the
   returned override's `text` key entirely in that case, so
   applyChecklistOverrides (content.html) falls back to the hardcoded
   value the same way it does for any item with no row at all. */
function getChecklistOverrides() {
  var sheet = getChecklistContentSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};
  var data = sheet.getRange(2, 1, lastRow - 1, CHECKLIST_CONTENT_HEADERS.length).getValues();
  var result = {};
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var itemId = String(row[0] || '').trim();
    if (!itemId) continue;
    var override = {};
    if (row[1]) override.pageKey = String(row[1]);
    if (row[2] !== '' && row[2] !== null) override.blockIndex = Number(row[2]);
    if (row[3]) override.text = String(row[3]);
    if (row[4]) override.level = String(row[4]);
    override.deleted = row[5] === true;
    if (row[6] !== '' && row[6] !== null) override.order = Number(row[6]);
    result[itemId] = override;
  }
  return result;
}

/* Upserts one row by ItemId — used both to edit an existing hardcoded
   item (pageKey/blockIndex may be omitted; only the fields the admin
   actually changed need be non-empty) and to add a brand new one (which
   MUST include pageKey/blockIndex, since there's no hardcoded fallback to
   place it). fields: { pageKey, blockIndex, text, level, deleted, order } —
   any key omitted leaves that column's existing value untouched on an
   update, or blank on a new row. */
function saveChecklistItem(itemId, fields, password) {
  /* AUTHORIZATION. This used to take no password at all and perform no
     check — the gate lived purely in admin.html's UI flow, while the
     comment on checkAdminPassword claimed the client "resends it with
     every save". It did not: adminPassword was captured at the prompt and
     never sent anywhere. Since appsscript.json deploys with
     access: ANYONE, that meant any visitor could open devtools and call
     google.script.run.saveChecklistItem(...) / .deleteChecklistItem(...)
     to rewrite or delete any department's checklist without ever seeing
     the password prompt. Every mutating entry point now verifies
     server-side, where the client cannot skip it. */
  requireAdmin_(password);
  itemId = String(itemId || '').trim();
  if (!itemId) throw new Error('Missing item id.');
  fields = fields || {};

  /* Same read-scan-then-write race as setTaskDone, and reached
     concurrently in normal use: moveItem (admin.html) fires one call per
     item in the block in parallel via Promise.all. */
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    throw new Error('Server busy, please try again.');
  }
  try {
    var sheet = getChecklistContentSheet_();
    var lastRow = sheet.getLastRow();
    var rowIndex = -1;
    if (lastRow >= 2) {
      var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0] || '').trim() === itemId) { rowIndex = i + 2; break; }
      }
    }
    var existing = rowIndex === -1
      ? [itemId, '', '', '', '', false, '']
      : sheet.getRange(rowIndex, 1, 1, CHECKLIST_CONTENT_HEADERS.length).getValues()[0];
    var next = [
      itemId,
      fields.pageKey !== undefined ? fields.pageKey : existing[1],
      fields.blockIndex !== undefined ? fields.blockIndex : existing[2],
      fields.text !== undefined ? fields.text : existing[3],
      fields.level !== undefined ? fields.level : existing[4],
      fields.deleted !== undefined ? !!fields.deleted : existing[5],
      fields.order !== undefined ? fields.order : existing[6]
    ];
    if (rowIndex === -1) {
      sheet.appendRow(next);
    } else {
      sheet.getRange(rowIndex, 1, 1, CHECKLIST_CONTENT_HEADERS.length).setValues([next]);
    }
    return true;
  } finally {
    lock.releaseLock();
  }
}

/* Marks an item deleted (soft-delete — see the Deleted column note above)
   rather than removing its row, so a deleted item's row survives with
   Deleted=TRUE. Note this is NOT a full audit trail, as an earlier version
   of this comment claimed: rows are upserted in place, so an edit
   overwrites the previous text with no history, and there is no actor or
   timestamp column. Google Sheets' own version history is the only real
   record of who changed what. */
function deleteChecklistItem(itemId, password) {
  return saveChecklistItem(itemId, { deleted: true }, password);
}

/* Shared server-side gate for every mutating admin entry point. Throws
   rather than returning false so a caller can never accidentally treat a
   failed check as success by ignoring the return value. */
function requireAdmin_(password) {
  if (!checkAdminPassword(password)) throw new Error('Not authorized.');
}

/* Admin editor auth — a single shared password (Script Property
   ADMIN_PASSWORD, set manually in the Apps Script editor's Project
   Settings, never committed to source) gates the checklist editor. The
   client never has the real password to compare against locally (it
   would be visible in page source) — every attempt round-trips through
   this function instead. Not session-based (no server-side "logged in"
   state persists between calls) — the client holds the password in memory
   for the duration of its edit session and resends it with every mutating
   call, which is verified server-side via requireAdmin_ (see
   saveChecklistItem). Simple and adequate for a single shared admin
   password; not meant to scale to per-admin accounts or audit-by-identity.

   Note this gate protects WRITES only. getChecklistOverrides is
   deliberately unauthenticated — its content is rendered into every
   employee's page anyway (see doGet), so there is nothing to withhold. */
function checkAdminPassword(password) {
  var configured = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!configured) return false; // no password configured yet = admin editor stays locked out, not wide open
  return String(password || '') === configured;
}

/* Generates a fresh, guaranteed-unique id for a brand NEW checklist item
   (one the admin adds that has no hardcoded counterpart) — distinct from
   the dept-p<phase>-<block>-<n> scheme hardcoded items use, specifically
   so a newly admin-added item can never collide with one of those even if
   an admin later adds enough items to reach a number a hardcoded item
   already uses. Timestamp + random suffix rather than a counter — no
   shared counter state to keep consistent across concurrent admin
   sessions. */
function newChecklistItemId_() {
  return 'admin-' + new Date().getTime() + '-' + Math.floor(Math.random() * 10000);
}

/* ============================================================
   ONE-TIME MIGRATION — checklist task ids used to be built from an item's
   raw position ("pageKey::blockIndex::itemIndex", e.g.
   "accounting-day-1-30::0::2") — fragile, because reordering or inserting
   a checklist item (now possible via the admin editor) would silently
   repoint an employee's already-saved checkmark at a different task.
   Every checklist item now carries its own permanent id instead (see
   it()/itemId() in content.html, e.g. "acct-p1-know-3") — this rewrites
   every existing row in the Progress sheet from the old scheme to the new
   one, one time, so nobody's saved progress is lost by the switch.
   Mapping is fully mechanical: old blockIndex 0/1/2 always meant
   Reading/Knowledge/Outputs (see PHASE_BLOCK_ANCHORS in content.html —
   unchanged by this migration), and each item's position within its block
   didn't change when ids were added (only wrapped, not reordered) — so
   itemIndex j (0-based) always maps to the new id's trailing -(j+1).
   Run manually from the Apps Script editor (Run button) exactly once,
   after deploying the itemId()-based code but before anyone using the old
   deploy has more progress to save under the old scheme. Safe to delete
   once run — check the log output confirms every row it saw was either
   migrated or already in the new format (0 "unrecognized" rows). */
var TASK_ID_DEPT_ABBR_ = {
  'accounting-': 'acct',
  'finance-': 'fin',
  'procurement-': 'proc',
  'property-': 'prop',
  'engineering-': 'eng'
};
var TASK_ID_BLOCK_ABBR_ = ['read', 'know', 'out']; // index = old blockIndex

function migrateTaskIdsToStableIds() {
  var sheet = getProgressSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('No progress rows to migrate.');
    return;
  }
  var range = sheet.getRange(2, 2, lastRow - 1, 1); // TaskId column only
  var values = range.getValues();
  var migrated = 0, alreadyNew = 0, unrecognized = 0;
  var unrecognizedSamples = [];

  for (var i = 0; i < values.length; i++) {
    var taskId = String(values[i][0] || '');
    if (!taskId) continue;

    if (taskId.indexOf('doc::') === 0) { alreadyNew++; continue; } // document uploads, untouched by this migration

    var parts = taskId.split('::');
    if (parts.length !== 3) {
      // Already a stable id (no "::"), or some other unrecognized shape.
      if (taskId.indexOf('::') === -1) alreadyNew++;
      else { unrecognized++; if (unrecognizedSamples.length < 10) unrecognizedSamples.push(taskId); }
      continue;
    }

    var pageKey = parts[0];
    var blockIndex = parseInt(parts[1], 10);
    var itemIndex = parseInt(parts[2], 10);

    var deptAbbr = null;
    for (var prefix in TASK_ID_DEPT_ABBR_) {
      if (pageKey.indexOf(prefix) === 0) { deptAbbr = TASK_ID_DEPT_ABBR_[prefix]; break; }
    }
    var phaseMatch = pageKey.match(/day-(\d+)-\d+$/);
    var blockAbbr = TASK_ID_BLOCK_ABBR_[blockIndex];

    if (!deptAbbr || !phaseMatch || !blockAbbr || isNaN(itemIndex)) {
      unrecognized++;
      if (unrecognizedSamples.length < 10) unrecognizedSamples.push(taskId);
      continue;
    }
    var phaseNum = phaseMatch[1] === '1' ? 1 : (phaseMatch[1] === '31' ? 2 : 3);
    var newId = deptAbbr + '-p' + phaseNum + '-' + blockAbbr + '-' + (itemIndex + 1);
    values[i][0] = newId;
    migrated++;
  }

  range.setValues(values);
  Logger.log('Migration complete. Migrated: ' + migrated + ', already new format: ' + alreadyNew + ', unrecognized: ' + unrecognized + '.');
  if (unrecognizedSamples.length) {
    Logger.log('Unrecognized samples (left unchanged, investigate manually): ' + unrecognizedSamples.join(', '));
  }
}

/* ============================================================
   ONE-TIME DEV UTILITY — not called by the app itself. Run manually from
   the Apps Script editor (select a wrapper function below in the
   dropdown, click Run) to pull real photos out of a Drive folder the user
   shared and print them as ready-to-paste EMBEDDED_IMAGES entries for
   images.html. Compresses via Drive's own thumbnail export (?sz=w1280)
   rather than re-encoding by hand — same 1280px-wide sizing the rest of
   this app's embedded photos already use. Safe to delete once its output
   has been pasted in.
   ============================================================ */
function dumpDriveFolderAsEmbeddedImages_(folderId, keyPrefix) {
  var folder = DriveApp.getFolderById(folderId);
  var files = folder.getFiles();
  var count = 0;
  while (files.hasNext()) {
    var file = files.next();
    var mime = file.getMimeType();
    if (mime.indexOf('image/') !== 0) continue;
    count++;
    var key = keyPrefix + count;
    var thumbUrl = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1280';
    var resp;
    try {
      resp = UrlFetchApp.fetch(thumbUrl, { muteHttpExceptions: true });
    } catch (e) {
      Logger.log('FAILED to fetch ' + file.getName() + ': ' + e);
      continue;
    }
    if (resp.getResponseCode() !== 200) {
      Logger.log('FAILED (' + resp.getResponseCode() + ') for ' + file.getName() + ' — falling back to original file bytes.');
      var blob = file.getBlob();
      var b64 = Utilities.base64Encode(blob.getBytes());
      Logger.log('// ' + file.getName() + ' (original, not thumbnail-compressed)');
      Logger.log(key + ': "data:' + blob.getContentType() + ';base64,' + b64 + '",');
      continue;
    }
    var thumbBlob = resp.getBlob();
    var thumbB64 = Utilities.base64Encode(thumbBlob.getBytes());
    Logger.log('// ' + file.getName());
    Logger.log(key + ': "data:' + thumbBlob.getContentType() + ';base64,' + thumbB64 + '",');
  }
  Logger.log('Done — ' + count + ' image file(s) found in folder.');
}

function dumpTrackRecordPhotosAsEmbeddedImages() {
  dumpDriveFolderAsEmbeddedImages_('1sDAVo_QNiZ67gw2_B6Gnc3Ox4JGn4zJk', 'trackRecordReal');
}

/* "Meet Our Team" event photos folder — run this one, then paste its
   Logger output (meetTeamEventN entries) into images.html, then list all
   of them in PAGES['meet-our-team']'s gallery images array in
   content.html. */
function dumpMeetTeamEventPhotosAsEmbeddedImages() {
  dumpDriveFolderAsEmbeddedImages_('1mA5_PO8ATE1GnJb_apNKJPOo27EEB_8F', 'meetTeamEvent');
}

/* ============================================================
   Required Documents — real files (uploaded by the user to a shared Drive
   folder from E:\WORK\03 HR (บุคคล)\06 เอกสารสำหรับพนักงานใหม่, numbered
   1-7 as PDFs) matched by filename PREFIX to the doc ids used in
   PAGES['required-documents'] (see content.html). Matches on startsWith
   rather than an exact filename because the user uploaded them as plain
   numbered PDFs ("1. ....pdf" etc, "ignore the Word files") rather than
   the originals' exact on-disk names — prefix matching survives whatever
   the user actually typed as the rest of the filename. Not embedded (these
   are documents to open/read, not photos to inline) — instead this sets
   each matched file to "anyone with the link can view" and prints its real
   Drive view URL, ready to paste into each doc's { id, title, action, url }
   entry in content.html; docCard() in app.html already renders doc.url
   when present (see esc(doc.url) in that function) so no further app.html
   change is needed. ONE-TIME DEV UTILITY, not called by the app itself —
   run manually from the Apps Script editor (Run button, no clasp run
   available since this project has no executionApi/GCP linkage set up).
   Safe to delete once its output has been pasted in. */
function matchAndLinkRequiredDocuments() {
  var FOLDER_ID = '1U47DcMdzG5IC26HMLSD8J25TFU-W0xgI';
  /* Matched by the "N. " numeric prefix the user uploaded each file under.
     VCB (this company) variants used where a VCB/CVE choice exists in the
     source folder. Tax Registration Form has no matching file — left unset
     (null) so the dump clearly reports it as not found rather than
     silently guessing at a filename that doesn't exist. */
  var DOC_FILENAME_PREFIX_MAP = {
    'employment-contract': '2.',
    'application-form': '1.',
    'nda': '3.',
    'pdpa-consent': '4.1',
    'pdpa-policy': '5.1',
    'anti-corruption': '6.1',
    'reporting-form': '7.',
    'tax-form': null
  };

  var folder = DriveApp.getFolderById(FOLDER_ID);
  var files = [];
  var iter = folder.getFiles();
  while (iter.hasNext()) files.push(iter.next());

  function findByPrefix(prefix) {
    return files.filter(function (f) { return f.getName().indexOf(prefix) === 0; })[0] || null;
  }

  function linkFile(file) {
    if (!file) return null;
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
      Logger.log('Could not set sharing on ' + file.getName() + ': ' + e);
    }
    return file.getUrl();
  }

  /* Written to a fresh Doc (one line per doc id) instead of relying on the
     Execution log — the log truncates/scrolls in the editor UI once there
     are more than a few lines, which was cutting off exactly the rows
     needed (only the last 2 of 8 were visible in a screenshot of it). A Doc
     is one URL to open, nothing to scroll past or miscopy. */
  var outputDoc = DocumentApp.create('Required Documents — Drive Links (' + new Date().toISOString() + ')');
  var body = outputDoc.getBody();
  body.appendParagraph('Paste each line below into its doc entry\'s url field in content.html, then delete this Doc.');

  Logger.log('--- Required Documents (paste each url into its doc entry in content.html) ---');
  Object.keys(DOC_FILENAME_PREFIX_MAP).forEach(function (docId) {
    var prefix = DOC_FILENAME_PREFIX_MAP[docId];
    if (!prefix) {
      Logger.log(docId + ': NO MATCHING FILE — leave as placeholder.');
      body.appendParagraph(docId + ': NO MATCHING FILE — leave as placeholder.');
      return;
    }
    var file = findByPrefix(prefix);
    if (!file) {
      Logger.log(docId + ': FILE NOT FOUND IN FOLDER (prefix "' + prefix + '") — check it was uploaded.');
      body.appendParagraph(docId + ': FILE NOT FOUND IN FOLDER (prefix "' + prefix + '") — check it was uploaded.');
      return;
    }
    var url = linkFile(file);
    Logger.log(docId + ': "' + url + '",  // ' + file.getName());
    body.appendParagraph(docId + ': "' + url + '",  // ' + file.getName());
  });

  body.appendParagraph('--- All files actually in the folder (for reference) ---');
  files.forEach(function (f) { body.appendParagraph('  ' + f.getName()); });
  outputDoc.saveAndClose();

  Logger.log('--- All files actually in the folder (for reference) ---');
  files.forEach(function (f) { Logger.log('  ' + f.getName()); });
  Logger.log('=== FULL RESULTS WRITTEN TO: ' + outputDoc.getUrl() + ' ===');
}
