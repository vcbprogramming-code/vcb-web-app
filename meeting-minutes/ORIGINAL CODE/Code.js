/**
 * Code.gs — backend for the VCB Meeting Minutes web app.
 *
 * This is a TRUE migration: every meeting from the 5 source Google Docs is read,
 * converted to clean self-contained HTML (bold, italics, lists, tables, links,
 * inline images all preserved), and stored in this app's own Google Sheet
 * database. The app then serves from that database — it is the real copy, not a
 * live mirror of the Docs.
 *
 * Splitting rule: one 📌 pushpin heading = one meeting. Heading-1 sub-sections
 * inside a meeting are kept within that meeting (never split). Text before the
 * first 📌 becomes the "Overview" record (project details / attendee roster).
 *
 * Storage: meeting metadata lives in the "Minutes" sheet; full HTML lives in the
 * "Content" sheet, chunked into ≤45,000-char rows so nothing is ever truncated
 * by the 50,000-char per-cell limit.
 */

/* ----------------------------- Web entry point ---------------------------- */

function doGet(e) {
  if (e && e.parameter && e.parameter.diag) {
    var body = e.parameter.diag === 'refs' ? diagRefs_()
      : e.parameter.diag === 'fathomraw' ? diagFathomRaw_(Number(e.parameter.n) || 3)
      : e.parameter.diag === 'fathomdupes' ? diagFathomDupes_()
      : e.parameter.diag === 'extraprojects' ? diagExtraProjects_()
      : e.parameter.diag === 'audit' ? diagAuditRaw_(e.parameter.id)
      : e.parameter.diag === 'missing' ? diagMissing_(e.parameter.q)
      : diagAll_();
    return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
  }
  // One-shot seeding endpoint. Runs importAllDocs and surfaces errors that the
  // normal sign-in path swallows. Admin-only.
  if (e && e.parameter && e.parameter.seed) {
    var seedOut;
    try {
      // migratestrayattachments is exempt from the admin gate: under the
      // fully-public (ANYONE_ANONYMOUS) deployment, Apps Script blanks
      // Session.getActiveUser() for everyone including the owner (see
      // googleEmail_'s note in Auth.js), so isAdmin_() can never pass here.
      // The action itself is a one-time, idempotent Drive move/cleanup with
      // no data exposure — safety comes from the deployment URL being
      // effectively unguessable, same reasoning as the Fathom webhook.
      var exemptFromAdminGate = e.parameter.seed === 'migratestrayattachments' || e.parameter.seed === 'fixfathomdatelabels';
      if (!exemptFromAdminGate && !isAdmin_()) {
        throw new Error('Sign in as an admin first.');
      }
      if (e.parameter.seed === 'fathombackfill') {
        seedOut = { ok: true, result: backfillFathomMeetings(false) };
      } else if (e.parameter.seed === 'fathomrefresh') {
        seedOut = { ok: true, result: backfillFathomMeetings(true) };
      } else if (e.parameter.seed === 'settranskriptorkey') {
        seedOut = { ok: true, result: setTranskriptorApiKey(e.parameter.key) };
      } else if (e.parameter.seed === 'transkriptorbackfill') {
        seedOut = { ok: true, result: backfillTranskriptorMeetings(false) };
      } else if (e.parameter.seed === 'transkriptorrefresh') {
        seedOut = { ok: true, result: backfillTranskriptorMeetings(true) };
      } else if (e.parameter.seed === 'detachprojectdoc') {
        seedOut = { ok: true, result: detachProjectDoc(e.parameter.id) };
      } else if (e.parameter.seed === 'migratestrayattachments') {
        seedOut = { ok: true, result: migrateStrayAttachments() };
      } else if (e.parameter.seed === 'fixfathomdatelabels') {
        seedOut = { ok: true, result: fixFathomDateLabels() };
      } else if (e.parameter.seed === 'dedupefathom') {
        seedOut = { ok: true, result: dedupeFathomMeetings() };
      } else if (e.parameter.seed === 'publishfiled') {
        seedOut = { ok: true, result: publishFiledMeetings() };
      } else {
        // Doc-import ?seed=/?seed=full is retired — Docs are no longer the
        // source of truth (2026-07-19). See ensureSeeded_'s note in this file.
        throw new Error('Doc import is disabled — Docs are no longer the source of truth. Use "+ New meeting" or Edit in-app instead.');
      }
    } catch (err) {
      seedOut = { ok: false, error: String(err && err.stack || err) };
    }
    return ContentService.createTextOutput(JSON.stringify(seedOut, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var t = HtmlService.createTemplateFromFile('Index');
  t.bootstrap = JSON.stringify(getPublicBootstrap());
  // Passed straight from the URL's own ?meeting= param, synchronously, at
  // render time — NOT read client-side via google.script.url.getLocation()
  // (2026-07-22 fix). getLocation() is async and has no documented timing
  // guarantee; the client previously raced it against a 2-second fallback
  // timeout that opened the dashboard instead. On a cold page load (exactly
  // the case for someone clicking a shared link fresh) getLocation() could
  // easily take longer than that, so the timeout won the race, set its
  // "already booted" guard, and silently discarded the real meeting id when
  // getLocation()'s callback finally did arrive — the share link always
  // landed on the homepage instead of the specific meeting. Embedding the id
  // directly in the initial HTML (same mechanism as `bootstrap` below) needs
  // no callback and can't race against anything.
  t.pendingMeetingId = JSON.stringify((e && e.parameter && e.parameter.meeting) || null);
  // Same synchronous, race-free mechanism as pendingMeetingId above, for
  // ?project=<id> permalinks that should always resolve to that project's
  // CURRENT latest meeting (resolved client-side once listMeetings loads),
  // rather than a fixed meeting id that goes stale the moment a newer
  // meeting is added.
  t.pendingProjectId = JSON.stringify((e && e.parameter && e.parameter.project) || null);
  return t.evaluate()
    .setTitle(APP_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ------------------------- Fathom webhook intake --------------------------- */
// Fathom POSTs here when a recording you made finishes processing (registered
// via registerFathomWebhook(), see below), and drops it into the FATHOM_INBOX
// pseudo-project as an admin-only row for you to review and tag into a real
// project (see setFathomTag) — the row never leaves FATHOM_INBOX.
//
// IMPORTANT LIMITATION: Apps Script's doPost(e) does not expose incoming HTTP
// request headers at all (only e.postData and e.parameter/query-string), and
// Fathom's webhook registration only accepts a plain destination_url with no
// place to inject a shared-secret query param per delivery. That means Fathom's
// HMAC signature (sent as the x-fathom-signature header) is NOT verifiable
// here — this is a hard Apps Script platform limitation, not a bug to fix.
// Practical mitigation instead of signature verification:
//   1. The exec URL itself is long and effectively unguessable.
//   2. Every delivery's raw body is logged to FATHOM_RAW_LOG regardless of
//      shape, so nothing is silently lost or forged without a trace.
//   3. Ingested rows are FATHOM_INBOX + invisible (admin-only) until you
//      manually file them — a forged POST can at worst add noise to a hidden
//      inbox, never publish anything to real visitors.
// doPost is deliberately as thin as possible (2026-07-21): it ONLY queues the
// raw payload and returns — it does NOT call ingestFathomPayload_ directly.
//
// Why: Apps Script's doPost is fully synchronous — there is no way to "ack
// now, process in the background" within one invocation, since the HTTP
// response can't be sent until the function returns. Doing the real parsing +
// LockService wait + sheet reads/writes inline here meant doPost's response
// time varied with lock contention and Apps Script's own cold-start latency.
// Fathom's webhook delivery resends the same notification if it doesn't get a
// prompt success response (confirmed via Fathom's docs: retried deliveries
// keep the same message id) — that resend-on-slow-response is what produced
// 4 duplicate rows ~10s/6min/33min apart for one recording (2026-07-21
// incident, see dedupeFathomMeetings). Queuing removes doPost's response time
// from the equation entirely: appendRow is fast and has no lock contention, so
// Fathom always gets an instant 200 and never has a reason to retry. The
// actual ingestion happens up to ~1 minute later via processFathomQueue_ (see
// the ensureFathomQueueTrigger_-installed time trigger), still protected by
// the same LockService + race re-check as before.
function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '';
    queueFathomRaw_(raw);
    return ContentService.createTextOutput(JSON.stringify({ ok: true, queued: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log('doPost error: ' + (err && err.stack || err));
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Raw-payload log AND pending-work queue in one sheet: every delivery is
// appended with processed='' (not yet ingested); processFathomQueue_ (run by a
// 1-minute trigger) scans for processed='' rows, calls ingestFathomPayload_ on
// each, and marks them processed='TRUE' (or 'ERROR: ...' if ingestion threw).
// Never deletes rows — this sheet is also the audit trail described in
// diagFathomRaw_'s doc comment.
function queueFathomRaw_(raw) {
  var ss = getDb_();
  var sheet = ss.getSheetByName('FATHOM_RAW_LOG') || ss.insertSheet('FATHOM_RAW_LOG');
  if (sheet.getLastRow() < 1) sheet.appendRow(['receivedAt', 'note', 'raw', 'processed']);
  // note is 'queued' (NOT 'received' — that value was used historically by the
  // old synchronous logFathomRaw_(raw,'received') call, before this queue
  // existed; processFathomQueue_ only ever looks for 'queued' rows, so it can
  // never mistake old already-ingested history for new pending work).
  sheet.appendRow([new Date().toISOString(), 'queued', raw, '']);
}

// Legacy name kept for any stray external caller (e.g. run directly from the
// editor) — logs without queuing (does not get auto-ingested). Prefer
// queueFathomRaw_ for anything that should actually be processed.
function logFathomRaw_(raw, note) {
  var ss = getDb_();
  var sheet = ss.getSheetByName('FATHOM_RAW_LOG') || ss.insertSheet('FATHOM_RAW_LOG');
  if (sheet.getLastRow() < 1) sheet.appendRow(['receivedAt', 'note', 'raw', 'processed']);
  sheet.appendRow([new Date().toISOString(), note || '', raw, 'TRUE']); // 'TRUE' = not queued for auto-processing
}

// Scans FATHOM_RAW_LOG for unprocessed deliveries (processed === '') and
// ingests each one via the same locked/race-checked path backfill uses.
// Marks each row processed='TRUE' on success, or 'ERROR: <message>' on
// failure (left for manual inspection — never retried automatically, so one
// bad payload can't loop forever). Wrapped in its own try/catch per row so one
// failure doesn't stop the rest of the batch from being processed.
function processFathomQueue_() {
  var ss = getDb_();
  var sheet = ss.getSheetByName('FATHOM_RAW_LOG');
  if (!sheet) return { processed: 0, failed: 0 };
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { processed: 0, failed: 0 };
  var values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  var processed = 0, failed = 0;
  for (var i = 0; i < values.length; i++) {
    var note = values[i][1], raw = values[i][2], status = values[i][3];
    if (status !== '') continue; // already processed (or a plain log entry, not a queue item)
    if (note !== 'queued') continue; // only doPost-queued rows are auto-ingested (never historical 'received' rows)
    var rowIndex = i + 2;
    try {
      ingestFathomPayload_(raw);
      sheet.getRange(rowIndex, 4).setValue('TRUE');
      processed++;
    } catch (err) {
      sheet.getRange(rowIndex, 4).setValue('ERROR: ' + String(err));
      failed++;
    }
  }
  return { processed: processed, failed: failed };
}

// One-time setup: installs a 1-minute time-driven trigger that drains the
// Fathom webhook queue. Run ONCE from the Apps Script editor's function
// picker (trigger creation needs your real Google account — same reason
// installTranskriptorPollTrigger does). Safe to re-run: clears any existing
// processFathomQueue_ trigger first so re-running never stacks duplicates.
function ensureFathomQueueTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processFathomQueue_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processFathomQueue_').timeBased().everyMinutes(1).create();
  return { ok: true, note: '1-minute Fathom queue-processing trigger installed.' };
}

/* ------------------------------- Audit log --------------------------------- */
// Append-only history of every content/permission-relevant mutation, now that
// the app itself (not Google Docs' own version history) is the source of
// truth. Never overwritten, never deleted by app code. One row per action.
// `who` is the acting Google account email (falls back to '(anonymous)' —
// public visitors can't mutate anything requiring audit anyway, since every
// write path already requires isAdmin_/isEditorFor_, but logging is
// unconditional so a bug in a permission check is still visible after the
// fact, not just prevented).
// Email of whoever is acting in THIS request, when it could only be learned
// from a session token. googleEmail_() is blank for every visitor except the
// deploying owner (ANYONE_ANONYMOUS), so an editor signed in with an emailed
// code would otherwise be logged as "(anonymous)" — which defeats the point of
// an audit log. Write paths set this from their token; auditLog_ prefers it.
// Request-scoped: each Apps Script call runs in a fresh execution context, so
// this cannot leak between users.
var CURRENT_ACTOR_ = '';
function setActor_(token) {
  try { CURRENT_ACTOR_ = identify_(token) || ''; } catch (e) { CURRENT_ACTOR_ = ''; }
  return CURRENT_ACTOR_;
}

function auditLog_(action, targetType, targetId, details) {
  try {
    var ss = getDb_();
    var sheet = ss.getSheetByName('AUDIT_LOG') || ss.insertSheet('AUDIT_LOG');
    if (sheet.getLastRow() < 1) sheet.appendRow(['when', 'who', 'action', 'targetType', 'targetId', 'details']);
    var who = googleEmail_() || CURRENT_ACTOR_ || '(anonymous)';
    sheet.appendRow([new Date().toISOString(), who, action, targetType || '', targetId || '', JSON.stringify(details || {})]);
  } catch (e) { Logger.log('auditLog_ failed: ' + e); } // logging must never block the actual action
}

// Returns every audit entry for one meeting id, newest first — powers the
// unified "Edit history" panel (one activity timeline, each content-changing
// entry offering a "View" of the pre-edit snapshot via details.versionSeq —
// no separate/redundant "current version" row, since that's just what's
// already on screen).
// Can this caller read this meeting? The same rule listMeetings applies, but
// without loading content/attachments/comments — it exists so access checks
// stay in ONE place and cannot drift apart from the list.
function canReadMeeting_(id, token) {
  var admin = isAdmin_(token);
  var rows = readAllRows_();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.id !== id) continue;
    if (admin) return true;
    if (isInboxProjectId_(r.projectId)) {
      return parseTaggedProjectIds_(r.taggedProjectId).length > 0 && isVisible_(r);
    }
    return isVisible_(r);
  }
  return false;
}

function getAuditHistory(targetId, token) {
  // The activity trail is shared: everyone who can read a meeting sees the
  // same history for it — who edited, tagged or commented, and when. It is
  // gated on access to the MEETING rather than on being an admin, so a
  // visitor can never read the history of something they cannot open.
  // The old drafts behind each entry stay admin-only (getVersionContent), as
  // do the delete controls.
  if (!canReadMeeting_(targetId, token)) throw new Error('Not authorized.');
  var ss = getDb_();
  var sheet = ss.getSheetByName('AUDIT_LOG');
  if (!sheet) return [];
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var vals = sheet.getRange(2, 1, last - 1, 6).getValues();
  return vals.filter(function (r) { return r[4] === targetId; })
    .map(function (r) {
      var details = {};
      try { details = JSON.parse(r[5] || '{}'); } catch (e) {}
      return { when: r[0], who: r[1], action: r[2], targetType: r[3], targetId: r[4], details: details };
    })
    .reverse();
}

/* Admin-only history pruning. The audit log is append-only as a rule, but an
   admin editing their own minutes can produce twenty entries in an afternoon
   and legitimately want that noise gone. Deleting an entry also deletes the
   version snapshot it points at, otherwise the panel would offer a "View"
   link to content that no longer exists.

   `seqs` is the list of AUDIT_LOG row identities to remove, expressed as the
   ISO timestamp in column 1 — stable, unlike a row index, which shifts as
   rows above are deleted. */
function deleteAuditEntries(targetId, whens, token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  var wanted = {};
  (whens || []).forEach(function (w) { wanted[String(w)] = true; });
  if (!Object.keys(wanted).length) return getAuditHistory(targetId, token);

  var ss = getDb_();
  var sheet = ss.getSheetByName('AUDIT_LOG');
  if (!sheet) return [];
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var vals = sheet.getRange(2, 1, last - 1, 6).getValues();

  // Collect the version snapshots referenced by the entries being removed, so
  // they can be deleted too rather than left orphaned.
  var deadSeqs = {};
  var toDelete = [];
  vals.forEach(function (r, i) {
    if (r[4] !== targetId) return;
    if (!wanted[String(r[0])]) return;
    toDelete.push(i + 2);                       // sheet row number
    var details = {};
    try { details = JSON.parse(r[5] || '{}'); } catch (e) {}
    if (details.versionSeq) deadSeqs[details.versionSeq] = true;
  });
  // Delete bottom-up so earlier row numbers stay valid.
  toDelete.sort(function (a, b) { return b - a; }).forEach(function (rowIdx) {
    sheet.deleteRow(rowIdx);
  });

  // Versions sheet columns: meetingId | savedAt | seq | chunkSeq | chunk | ...
  // A single version spans SEVERAL rows (content is chunked), so every row
  // carrying a dead seq must go, not just the first.
  var seqList = Object.keys(deadSeqs);
  if (seqList.length) {
    var v = getDb_().getSheetByName(VERSIONS_SHEET);
    if (v && v.getLastRow() > 1) {
      var vv = v.getRange(2, 1, v.getLastRow() - 1, 3).getValues();
      var vRows = [];
      vv.forEach(function (r, i) {
        if (r[0] === targetId && deadSeqs[String(r[2])]) vRows.push(i + 2);
      });
      vRows.sort(function (a, b) { return b - a; }).forEach(function (rowIdx) { v.deleteRow(rowIdx); });
    }
  }
  return getAuditHistory(targetId, token);
}

// Remove a meeting's entire history in one go.
function clearAuditHistory(targetId, token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  var all = getAuditHistory(targetId, token);
  return deleteAuditEntries(targetId, all.map(function (e) { return e.when; }), token);
}

/* One-time repair for meetings stranded hidden.

   Under the old model a meeting was created hidden and an admin published it
   with a "Visible to staff" button. That button was removed when visibility
   became automatic (filed into a project = published), which left every
   already-created meeting stuck at visible='' with no way to publish it —
   invisible to everyone but an admin, which is why meetings were missing in
   an incognito window.

   This brings existing rows in line with the current rule: anything sitting in
   a real project is published; inbox rows are left private, because an inbox
   is the staging area and its contents are only published by being tagged.
   Idempotent — safe to run more than once. Access: ?seed=publishfiled */
function publishFiledMeetings() {
  var sheet = getSheet_();
  var rows = readAllRows_();
  var col = COLUMNS.indexOf('visible') + 1;
  var published = 0, skippedInbox = 0, alreadyVisible = 0;
  rows.forEach(function (r) {
    if (isInboxProjectId_(r.projectId)) { skippedInbox++; return; }
    if (isVisible_(r)) { alreadyVisible++; return; }
    sheet.getRange(r._rowIndex, col).setValue('TRUE');
    published++;
  });
  return {
    published: published,
    alreadyVisible: alreadyVisible,
    leftPrivateInInbox: skippedInbox,
    note: 'Meetings filed into a project are now visible; inbox recordings stay private.'
  };
}

/* Why is a meeting not appearing? Finds every row whose title or date matches
   `q` and reports, for each, the exact fields the list filter reads — so a
   missing meeting can be explained from data rather than guessed at.
   Access: ?diag=missing&q=<part of the title or date>   (admin only) */
function diagMissing_(q) {
  if (!isAdminEmail_(googleEmail_())) return JSON.stringify({ error: 'admin only' });
  q = String(q || '').trim();
  var rows = readAllRows_();
  var hits = rows.filter(function (r) {
    if (!q) return false;
    return String(r.title || '').indexOf(q) !== -1 ||
           String(r.dateLabel || '').indexOf(q) !== -1 ||
           String(r.date || '').indexOf(q) !== -1;
  });
  var projects = getAllProjects_().map(function (p) { return p.id; });
  return JSON.stringify({
    query: q,
    totalRows: rows.length,
    matches: hits.length,
    knownProjectIds: projects,
    rows: hits.map(function (r) {
      var tagged = parseTaggedProjectIds_(r.taggedProjectId);
      return {
        id: r.id,
        title: r.title,
        projectId: r.projectId,
        projectExists: projects.indexOf(r.projectId) !== -1 || isInboxProjectId_(r.projectId),
        taggedProjectIds: tagged,
        taggedProjectsExist: tagged.map(function (t) { return t + '=' + (projects.indexOf(t) !== -1); }),
        visibleRaw: r.visible,
        isVisible: isVisible_(r),
        isInbox: isInboxProjectId_(r.projectId),
        date: r.date,
        dateLabel: r.dateLabel,
        // The two reasons a row is dropped from a non-admin's list.
        wouldListForAdmin: true,
        wouldListForStaff: !isInboxProjectId_(r.projectId) && isVisible_(r)
      };
    })
  }, null, 1);
}

// Admin-only diagnostic: without &id=, dumps the most recent 20 AUDIT_LOG rows
// across every meeting (so you don't need to know an id up front — find the
// entry by its timestamp/title, then re-run with &id=<that targetId> for
// full detail including matching Versions rows). Access via ?diag=audit or
// ?diag=audit&id=<meetingId>.
function diagAuditRaw_(meetingId) {
  if (!isAdminEmail_(googleEmail_())) return JSON.stringify({ error: 'admin only' });
  var ss = getDb_();
  var audit = ss.getSheetByName('AUDIT_LOG');
  if (!meetingId) {
    if (!audit || audit.getLastRow() < 2) return JSON.stringify({ note: 'AUDIT_LOG empty' });
    var last = audit.getLastRow();
    var n = Math.min(20, last - 1);
    var recent = audit.getRange(last - n + 1, 1, n, 6).getValues();
    return JSON.stringify({
      note: 'Most recent ' + n + ' audit rows (any meeting). Re-run with &id=<targetId> for full detail.',
      rows: recent.map(function (r) { return { when: r[0], who: r[1], action: r[2], targetType: r[3], targetId: r[4], rawDetails: r[5] }; }).reverse()
    }, null, 1);
  }
  var auditRows = [];
  if (audit && audit.getLastRow() >= 2) {
    var av = audit.getRange(2, 1, audit.getLastRow() - 1, 6).getValues();
    auditRows = av.filter(function (r) { return r[4] === meetingId; })
      .map(function (r) { return { when: r[0], who: r[1], action: r[2], targetType: r[3], targetId: r[4], rawDetails: r[5] }; });
  }
  var versions = ss.getSheetByName('Versions');
  var versionSeqs = {};
  if (versions && versions.getLastRow() >= 2) {
    var vv = versions.getRange(2, 1, versions.getLastRow() - 1, 3).getValues();
    vv.forEach(function (r) { if (r[0] === meetingId) versionSeqs[r[2]] = (versionSeqs[r[2]] || 0) + 1; });
  }
  return JSON.stringify({ meetingId: meetingId, auditRowCount: auditRows.length, auditRows: auditRows, distinctVersionSeqsForThisMeeting: versionSeqs }, null, 1);
}

/* ---------------------------- Version history ------------------------------ */
// Every content overwrite (saveEdit, saveMeeting, a Fathom refresh) snapshots
// the PRIOR content here first — append-only, chunked the same way as the
// live Content sheet (bodies can be a few KB, occasionally more with images).
// "Original" = the oldest snapshot (or the current content, if never edited);
// "Latest saved version before now" = the newest snapshot. Both are always
// available; the full list is there too if an admin wants to look further back.
var VERSIONS_SHEET = 'Versions';
// Columns 6-8 (title/dateLabel/time) capture the meeting's metadata AS IT WAS
// at the moment of THIS snapshot (2026-07-21 — see snapshotVersion_'s note).
// Repeated on every chunk row of a version rather than stored once per seq:
// keeps every reader (getVersionContent/getOriginalContent) a single flat
// filter+read with no second lookup, at the cost of some harmless repetition
// (title/date/time are tiny compared to a chunk of HTML).
function getVersionsSheet_() {
  var ss = getDb_();
  var v = ss.getSheetByName(VERSIONS_SHEET);
  if (!v) {
    v = ss.insertSheet(VERSIONS_SHEET);
    v.getRange(1, 1, 1, 8).setValues([['meetingId', 'savedAt', 'seq', 'chunkSeq', 'chunk', 'title', 'dateLabel', 'time']]).setFontWeight('bold');
    v.setFrozenRows(1);
  }
  return v;
}

// Snapshots one full content string AS WELL AS the title/dateLabel/time that
// were in effect at that moment, as a new version chunked across rows the way
// Content already is. `seq` groups a version's chunks together — a UUID, NOT
// Date.now(): two saves landing in the same script execution (confirmed while
// testing — e.g. a quick edit-then-edit-again) can share one millisecond,
// which under a timestamp seq would merge two different versions' chunks into
// one unreadable, concatenated blob. Order for display comes from AUDIT_LOG's
// own timestamp, not from the seq value itself.
//
// meta (title/dateLabel/time) was NOT captured here until 2026-07-21 — only
// the body HTML was versioned, so "View Original"/any past version always
// showed whatever title/date/time happened to be on the row RIGHT NOW, not
// what they actually were back then (confirmed bug: renaming a meeting made
// its own "Original" preview show the new name). Root cause was that title/
// date/time were never part of the versioned data at all, not a display bug —
// fixed by actually storing them alongside the body from now on.
function snapshotVersion_(meetingId, html, meta) {
  try {
    var v = getVersionsSheet_();
    html = String(html || '');
    if (!html) return null; // nothing to preserve
    meta = meta || {};
    var seq = Utilities.getUuid();
    var rows = [];
    var chunkSeq = 0;
    var savedAt = new Date().toISOString();
    for (var i = 0; i < html.length; i += CHUNK) {
      rows.push([meetingId, savedAt, seq, chunkSeq++, html.substr(i, CHUNK), meta.title || '', meta.dateLabel || '', meta.time || '']);
    }
    if (!rows.length) return null;
    v.getRange(v.getLastRow() + 1, 1, rows.length, 8).setValues(rows);
    return seq;
  } catch (e) { Logger.log('snapshotVersion_ failed for ' + meetingId + ': ' + e); return null; } // never block the actual save
}

// Fetches one version's full HTML plus the title/dateLabel/time captured with
// it — either a numbered snapshot (seq) or the live current content/row
// (seq === 'current'). Returns { html, title, dateLabel, time }; title/
// dateLabel/time are '' for a version snapshotted before 2026-07-21 (metadata
// wasn't captured yet) — the client falls back to the live meeting's current
// values in that case, same as the old (buggy) behavior, but only for
// genuinely-old versions that have no better answer available.
function getVersionContent(meetingId, seq, token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  if (seq === 'current' || seq === undefined || seq === null) {
    var row = readAllRows_().filter(function (r) { return r.id === meetingId; })[0];
    return { html: getContent_(meetingId), title: row ? row.title : '', dateLabel: row ? row.dateLabel : '', time: row ? row.time : '' };
  }
  var v = getDb_().getSheetByName(VERSIONS_SHEET);
  if (!v) return { html: '', title: '', dateLabel: '', time: '' };
  var last = v.getLastRow();
  if (last < 2) return { html: '', title: '', dateLabel: '', time: '' };
  var vals = v.getRange(2, 1, last - 1, 8).getValues();
  var hits = vals.filter(function (r) { return r[0] === meetingId && r[2] === seq; });
  hits.sort(function (a, b) { return a[3] - b[3]; });
  return {
    html: hits.map(function (r) { return r[4]; }).join(''),
    title: hits.length ? hits[0][5] : '', dateLabel: hits.length ? hits[0][6] : '', time: hits.length ? hits[0][7] : ''
  };
}

// Always-available "View Original" — finds the OLDEST snapshot in Versions
// for this meeting by savedAt (not by matching a specific audit entry's
// versionSeq, which may be missing on older/edge-case rows), and falls back
// to the current live row if no snapshot exists yet (a meeting that's never
// been edited since this feature shipped — current IS the original).
// This must never come up empty for an admin who has any content to look at.
// Returns { html, title, dateLabel, time } — see getVersionContent's note on
// the 2026-07-21 fix for what title/dateLabel/time are '' means (pre-fix snapshot).
function getOriginalContent(meetingId, token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  var v = getDb_().getSheetByName(VERSIONS_SHEET);
  if (v && v.getLastRow() >= 2) {
    var vals = v.getRange(2, 1, v.getLastRow() - 1, 8).getValues();
    var mine = vals.filter(function (r) { return r[0] === meetingId; });
    if (mine.length) {
      var oldestSavedAt = mine.reduce(function (min, r) { return r[1] < min ? r[1] : min; }, mine[0][1]);
      var oldestSeq = mine.filter(function (r) { return r[1] === oldestSavedAt; })[0][2];
      var chunks = mine.filter(function (r) { return r[2] === oldestSeq; }).sort(function (a, b) { return a[3] - b[3]; });
      return {
        html: chunks.map(function (r) { return r[4]; }).join(''),
        title: chunks[0][5], dateLabel: chunks[0][6], time: chunks[0][7]
      };
    }
  }
  var row = readAllRows_().filter(function (r) { return r.id === meetingId; })[0]; // never been edited — current row IS the original
  return { html: getContent_(meetingId), title: row ? row.title : '', dateLabel: row ? row.dateLabel : '', time: row ? row.time : '' };
}

// Admin-only diagnostic: dump the last N raw Fathom payloads so we can confirm
// the real field names against what fathomRecordToHtml_/ingestFathomPayload_
// expect. Access via ?diag=fathomraw&n=3 on the live URL (admin session req'd).
function diagFathomRaw_(n) {
  if (!isAdminEmail_(googleEmail_())) return JSON.stringify({ error: 'admin only' });
  var ss = getDb_();
  var sheet = ss.getSheetByName('FATHOM_RAW_LOG');
  if (!sheet) return JSON.stringify({ error: 'no FATHOM_RAW_LOG sheet yet' });
  var last = sheet.getLastRow();
  if (last < 2) return JSON.stringify({ error: 'no rows yet' });
  var start = Math.max(2, last - n + 1);
  var vals = sheet.getRange(start, 1, last - start + 1, 4).getValues();
  var out = vals.map(function (r) {
    var parsed = null;
    try { parsed = JSON.parse(r[2]); } catch (e) {}
    return { receivedAt: r[0], note: r[1], raw: parsed || r[2], processed: r[3] };
  });
  return JSON.stringify(out, null, 1);
}

// Diagnostic: lists Fathom Inbox rows sharing a meetingKey (should never
// happen — backfill/webhook both dedupe on it) so a reported "duplicate" can
// be confirmed as either genuinely-identical recordings (real bug, same
// recording_id inserted twice, or a missing recording_id falling back to a
// fresh random uuid every delivery) or several real calls that happen to
// share the same auto-generated title/date. Access via ?diag=fathomdupes.
// Exempt from the admin-email gate (2026-07-21): under the fully-public
// (ANYONE_ANONYMOUS) deployment, Session.getActiveUser() blanks out for
// EVERYONE hitting the URL directly, including the real admin — the exact
// same platform limitation already documented for migratestrayattachments/
// fixfathomdatelabels in doGet. Safe to expose without the gate: read-only,
// no mutation, and only returns metadata (titles/dates/excerpts/ids) already
// visible to the admin elsewhere in the app UI — same "URL is effectively
// unguessable" reasoning used for those other exemptions.
function diagFathomDupes_() {
  var rows = readAllRows_().filter(function (r) { return r.source === 'fathom'; });
  var byKey = {};
  rows.forEach(function (r) {
    (byKey[r.meetingKey] = byKey[r.meetingKey] || []).push({
      id: r.id, title: r.title, date: r.date, dateLabel: r.dateLabel, fathomUrl: r.fathomUrl,
      excerpt: r.excerpt, createdAt: r.createdAt, taggedProjectId: r.taggedProjectId
    });
  });
  var dupes = {};
  Object.keys(byKey).forEach(function (k) { if (byKey[k].length > 1) dupes[k] = byKey[k]; });
  return JSON.stringify({ totalFathomRows: rows.length, duplicateKeyCount: Object.keys(dupes).length, duplicates: dupes }, null, 1);
}

// Admin-only diagnostic: dumps EXTRA_PROJECTS (runtime-created projects) as
// actually stored, to settle exactly how/when a project like ERP was
// registered — whether via createProject (which always makes a real Doc) or
// some other path. Access via ?diag=extraprojects.
function diagExtraProjects_() {
  if (!isAdminEmail_(googleEmail_())) return JSON.stringify({ error: 'admin only' });
  return JSON.stringify({ extraProjects: getExtraProjects_(), overrides: getProjectOverrides_() }, null, 1);
}

// Parses one Fathom "new meeting content ready" delivery and inserts it as a
// FATHOM_INBOX row. Tolerant of the payload shape varying (recording may be
// nested under `recording`/`meeting`, transcript may be plain text or an array
// of speaker turns) since we're going on search-derived field names, not a
// confirmed schema — logFathomRaw_ keeps the original so nothing is lost if a
// field name guess is wrong.
// existingRow (optional): a row from readAllRows_() to overwrite in place
// instead of appending a new one. If omitted, this looks up FATHOM_INBOX for
// an existing row with the same recording_id itself — this is what makes
// doPost (webhook) safe against duplicates: Fathom can send more than one
// webhook delivery for the same recording as processing stages complete
// (transcript ready, then summary ready, etc.), and each one used to insert a
// brand-new row (bug found 2026-07-19 — 4 duplicate rows for one recording,
// ~5-40 min apart, matching that delivery pattern exactly). Passing
// existingRow explicitly (as backfillFathomMeetings' force-refresh does) skips
// this lookup and uses the given row directly.
//
// STILL HAPPENING as of 2026-07-21 (confirmed via ?diag=fathomdupes — 4 rows,
// same meetingKey "fathom-165023039", createdAt 14:54:29/14:54:39/15:00:36/
// 15:33:30) despite the lookup above. Root cause: the lookup alone isn't
// enough under concurrent execution — two doPost invocations for the same
// recording can both call readAllRows_() before either one's appendRow has
// committed, so both see "no existing row" and both insert (check-then-act
// race, no different from two threads both passing a null check on a shared
// counter). A script-wide lock around the check-and-insert closes that gap:
// concurrent deliveries now serialize instead of racing.
function ingestFathomPayload_(raw, existingRow) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return ingestFathomPayloadLocked_(raw, existingRow);
  } finally {
    lock.releaseLock();
  }
}

function ingestFathomPayloadLocked_(raw, existingRow) {
  // No logging call here (2026-07-21): the raw payload is already captured
  // once by queueFathomRaw_ before this function ever runs (webhook path) or
  // by backfillFathomMeetings' own logFathomRaw_ call (backfill path) —
  // logging it again here would double-write every webhook delivery into
  // FATHOM_RAW_LOG, and worse, processFathomQueue_ would see that second
  // 'received'-noted row as new pending work and try to re-ingest it forever.
  var data = JSON.parse(raw);
  var rec = data.recording || data.meeting || data;

  var title = rec.title || rec.meeting_title || data.title || 'Fathom recording';
  var recordingUrl = rec.url || rec.share_url || data.url || data.share_url || '';
  var recordingId = String(rec.recording_id || rec.id || data.recording_id || Utilities.getUuid());
  if (existingRow === undefined) {
    var key = 'fathom-' + recordingId;
    existingRow = readAllRows_().filter(function (r) { return r.source === 'fathom' && r.meetingKey === key; })[0] || null;
  }
  var startedAt = rec.recording_start_time || rec.started_at || rec.created_at || data.created_at || '';
  var d = startedAt ? new Date(startedAt) : new Date();
  var iso = isNaN(d.getTime()) ? '' : Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd');

  // Confirmed via a real webhook/backfill payload (2026-07-17): summary is NOT
  // a flat string — it's { template_name, markdown_formatted }. Transcript is
  // deliberately never read here (2026-07-21) — meetings only need the AI
  // summary, not the full raw transcript, even if a payload happens to include one.
  var summaryObj = data.default_summary || rec.default_summary || data.summary || rec.summary || null;
  var summary = summaryObj && typeof summaryObj === 'object' ? (summaryObj.markdown_formatted || '') : (summaryObj || '');
  var actionItems = data.action_items || rec.action_items || [];

  var html = fathomRecordToHtml_({ recordingUrl: recordingUrl, summary: summary, actionItems: actionItems });
  var attendees = extractAttendees_(html);

  var sheet = getSheet_();
  var now = new Date().toISOString();

  if (existingRow) {
    var merged = {
      id: existingRow.id, projectId: existingRow.projectId, meetingKey: existingRow.meetingKey,
      date: iso, dateLabel: isoToLabel_(iso), time: extractTime_(title) || '',
      title: title, kind: 'meeting',
      excerpt: stripTags_(html).slice(0, 200), fathomUrl: recordingUrl,
      attendees: JSON.stringify(attendees), tabId: '', source: 'fathom',
      visible: existingRow.visible, pinned: existingRow.pinned,
      taggedProjectId: existingRow.taggedProjectId, attachments: existingRow.attachments,
      createdAt: existingRow.createdAt || now, updatedAt: now
    };
    sheet.getRange(existingRow._rowIndex, 1, 1, COLUMNS.length).setValues([rowFromObject_(merged)]);
    saveContent_(existingRow.id, html, false, { title: existingRow.title, dateLabel: existingRow.dateLabel, time: existingRow.time });
    return existingRow.id;
  }

  // Second, independent check right before the insert (belt-and-suspenders
  // alongside the LockService wrapper above): re-verify under the lock that no
  // sibling row appeared between the lookup at the top of this function and
  // here. Cheap (one more read of an already-open sheet) and makes "one
  // recording, one row" hold even if some future code path ever calls
  // ingestFathomPayloadLocked_ directly instead of through the lock wrapper.
  var newKey = 'fathom-' + recordingId;
  var raceCheck = readAllRows_().filter(function (r) { return r.source === 'fathom' && r.meetingKey === newKey; })[0];
  if (raceCheck) return ingestFathomPayloadLocked_(raw, raceCheck);

  var id = Utilities.getUuid();
  var meetingRec = {
    id: id, projectId: FATHOM_INBOX_ID, meetingKey: newKey,
    date: iso, dateLabel: title, time: extractTime_(title) || '',
    title: title, kind: 'meeting',
    excerpt: stripTags_(html).slice(0, 200), fathomUrl: recordingUrl,
    attendees: JSON.stringify(attendees), tabId: '', source: 'fathom',
    visible: '', pinned: '', createdAt: now, updatedAt: now
  };
  sheet.appendRow(rowFromObject_(meetingRec));
  saveContent_(id, html);
  return id;
}

// One-time (and safe-to-re-run) repair: collapses any Fathom Inbox rows that
// share a meetingKey down to one — keeps the OLDEST row (earliest createdAt,
// i.e. the original recording, not a later duplicate delivery) and deletes the
// rest, but ONLY merges each duplicate's taggedProjectId list into the
// survivor first, so a duplicate that was independently filed into a project
// never silently loses that filing. Never touches a meetingKey with just one
// row. Access via ?seed=dedupefathom on the live URL (admin-only).
function dedupeFathomMeetings() {
  var sheet = getSheet_();
  var rows = readAllRows_().filter(function (r) { return r.source === 'fathom'; });
  var byKey = {};
  rows.forEach(function (r) { (byKey[r.meetingKey] = byKey[r.meetingKey] || []).push(r); });

  var removed = 0, mergedTags = 0;
  var toDeleteRowIndexes = [];
  Object.keys(byKey).forEach(function (key) {
    var group = byKey[key];
    if (group.length < 2) return;
    group.sort(function (a, b) { return (a.createdAt || '').localeCompare(b.createdAt || ''); });
    var survivor = group[0];
    var dupes = group.slice(1);

    var tagSet = parseTaggedProjectIds_(survivor.taggedProjectId);
    dupes.forEach(function (d) {
      parseTaggedProjectIds_(d.taggedProjectId).forEach(function (pid) {
        if (tagSet.indexOf(pid) === -1) { tagSet.push(pid); mergedTags++; }
      });
    });
    if (tagSet.length) {
      sheet.getRange(survivor._rowIndex, COLUMNS.indexOf('taggedProjectId') + 1).setValue(formatTaggedProjectIds_(tagSet));
    }
    dupes.forEach(function (d) {
      toDeleteRowIndexes.push(d._rowIndex);
      try { deleteContent_(d.id); } catch (e) {}
      auditLog_('dedupe_fathom_delete', 'meeting', d.id, { meetingKey: key, keptId: survivor.id });
      removed++;
    });
  });

  // Delete highest row index first so earlier indexes stay valid as rows shift up.
  toDeleteRowIndexes.sort(function (a, b) { return b - a; }).forEach(function (idx) { sheet.deleteRow(idx); });

  var summary = { removed: removed, mergedTags: mergedTags, groupsAffected: toDeleteRowIndexes.length ? Object.keys(byKey).filter(function (k) { return byKey[k].length > 1; }).length : 0 };
  Logger.log('dedupeFathomMeetings done: ' + JSON.stringify(summary));
  return summary;
}

// Fathom/Transkriptor sometimes prepend their own boilerplate AI-disclaimer
// line verbatim into the summary text (confirmed against real Transkriptor
// payloads) — the app shows its OWN disclaimer banner client-side (display-
// only, see renderDetail's aiDisclaimer / .ai-disclaimer CSS in
// JavaScript.html) so every AI-sourced meeting gets one consistently, rather
// than depending on whether this particular summary happened to include one.
// Strip any line matching either source's version so it's never shown twice.
// Deliberately loose (case-insensitive substring match on the distinctive
// phrase) since exact wording/formatting isn't guaranteed stable.
var TRANSKRIPTOR_DISCLAIMER_RE = /ai[- ]generated summary.*may contain errors/i;

// Minimal Markdown -> HTML for Fathom's default_summary.markdown_formatted,
// which uses only: #/##/### headings, **bold**, [text](url) links, and "- "
// bullets (confirmed against a real payload 2026-07-17). Not a general Markdown
// parser — deliberately narrow to what Fathom actually emits.
function fathomMarkdownToHtml_(md) {
  var lines = String(md).replace(/\r\n/g, '\n').split('\n');
  var html = [], inList = false;
  function closeList() { if (inList) { html.push('</ul>'); inList = false; } }
  function inline(s) {
    s = escapeHtml_(s);
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (m, text, url) {
      return '<a href="' + url.replace(/"/g, '&quot;') + '" target="_blank">' + text + '</a>';
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    return s;
  }
  lines.forEach(function (line) {
    if (TRANSKRIPTOR_DISCLAIMER_RE.test(line)) return; // same boilerplate line, same app-level banner replaces it — see the note on transkriptorMarkdownToHtml_
    var h = line.match(/^(#{1,6})\s+(.*)$/);
    var li = line.match(/^\s*-\s+(.*)$/);
    if (h) {
      closeList();
      // A markdown heading becomes a bold PARAGRAPH, never a real <h1>-<h6> tag
      // (2026-07-21, deliberate — see the note on transkriptorRecordToHtml_'s
      // section_title handling below for the full reasoning: real heading
      // tags are colored, and that color is a "hybrid" element mid-body that
      // silently swallows any plain text typed/pasted into it afterward).
      html.push('<p><b>' + inline(h[2]) + '</b></p>');
    } else if (li) {
      if (!inList) { html.push('<ul>'); inList = true; }
      html.push('<li>' + inline(li[1]) + '</li>');
    } else if (line.trim()) {
      closeList();
      html.push('<p>' + inline(line.trim()) + '</p>');
    }
  });
  closeList();
  return html.join('\n');
}

// Deliberately summary + action items ONLY (2026-07-21) — never renders a
// transcript, even if a payload happens to include one. The old transcript
// branch here also had a real bug: whatever shape Fathom actually sends turns
// per line/speaker fields don't match t.text/t.speaker, so any payload that
// did carry transcript data rendered as literal "[object Object]:" lines
// (seen on a 18-Jul Google Meet recording that came back with real transcript
// content, unlike most recordings where Fathom sends transcript:null) —
// removing the render path entirely fixes that regardless of what Fathom sends.
function fathomRecordToHtml_(f) {
  var parts = [];
  if (f.recordingUrl) parts.push('<p><a href="' + escapeHtml_(f.recordingUrl) + '" target="_blank">Watch on Fathom</a></p>');
  if (f.summary) parts.push(fathomMarkdownToHtml_(f.summary));
  if (f.actionItems && f.actionItems.length) {
    var items = (Array.isArray(f.actionItems) ? f.actionItems : [f.actionItems]).map(function (a) {
      var text = typeof a === 'string' ? a : (a.description || a.text || JSON.stringify(a));
      return '<li>' + escapeHtml_(text) + '</li>';
    }).join('');
    parts.push('<p><b>Action items</b></p><ul>' + items + '</ul>');
  }
  return parts.join('\n');
}

/* ---------------------- Transkriptor summary rendering ---------------------- */
// Transkriptor's summary JSON (confirmed 2026-07-20 against a real response) is
// an array of { section_title, section_content } objects — section_content is
// Markdown using #/##/### headings, **bold**, and bullets written as either
// "- " or "*   " (extra spaces after the asterisk, confirmed in real output).
// Reuses fathomMarkdownToHtml_'s inline-formatting approach but recognizes
// both bullet styles.
// (TRANSKRIPTOR_DISCLAIMER_RE is declared above, next to fathomMarkdownToHtml_ —
// shared by both converters since either source can carry the same boilerplate.)
function transkriptorMarkdownToHtml_(md) {
  var lines = String(md).replace(/\r\n/g, '\n').split('\n');
  var html = [], inList = false;
  function closeList() { if (inList) { html.push('</ul>'); inList = false; } }
  function inline(s) {
    s = escapeHtml_(s);
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (m, text, url) {
      return '<a href="' + url.replace(/"/g, '&quot;') + '" target="_blank">' + text + '</a>';
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    return s;
  }
  lines.forEach(function (line) {
    if (TRANSKRIPTOR_DISCLAIMER_RE.test(line)) return; // skip — replaced by the app's own display-only banner
    var h = line.match(/^(#{1,6})\s+(.*)$/);
    var li = line.match(/^\s*[-*]\s+(.*)$/);
    if (h) {
      closeList();
      // Bold paragraph, not a real heading tag — see the note on
      // fathomMarkdownToHtml_'s identical change and on transkriptorRecordToHtml_
      // below for the full 2026-07-21 reasoning.
      html.push('<p><b>' + inline(h[2]) + '</b></p>');
    } else if (li) {
      if (!inList) { html.push('<ul>'); inList = true; }
      html.push('<li>' + inline(li[1]) + '</li>');
    } else if (line.trim()) {
      closeList();
      html.push('<p>' + inline(line.trim()) + '</p>');
    }
  });
  closeList();
  return html.join('\n');
}

// Section titles and any markdown "#" headings inside section_content are
// rendered as bold PARAGRAPHS, never real <h1>-<h6> tags (2026-07-21,
// deliberate). Real heading tags are colored (see OVERRIDE_CSS/.ed-area h1,h2
// in Stylesheet.html) and, unlike a plain <b> run, contenteditable treats a
// heading as a genuine block container — pasting or typing INSIDE one (at its
// end, since Enter no longer lets you continue one — see the editor's Enter
// handler) still lands new text as a child of that same colored element,
// silently inheriting its color with no visible boundary and no toolbar
// action of the user's own. The only elements that should ever carry special
// styling are the company letterhead name and date line — both already
// rendered separately, outside the editable body, and never generated by
// this function. Bold text has no such container behavior: it's a plain
// inline run with a clear boundary, so pasting/typing next to it can never
// silently inherit it the way a block-level heading did.
function transkriptorRecordToHtml_(sections) {
  var parts = [];
  (sections || []).forEach(function (s) {
    if (s.section_title) parts.push('<p><b>' + escapeHtml_(s.section_title) + '</b></p>');
    if (s.section_content) parts.push(transkriptorMarkdownToHtml_(s.section_content));
  });
  return parts.join('\n');
}

/* ------------------------------- Database --------------------------------- */

var CONTENT_SHEET = 'Content';
var CHUNK = 45000;

function getDb_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_DB_ID);
  if (id) {
    // An ID is already stored. NEVER silently create a blank sheet on a
    // transient open failure — doing so would orphan the real database onto a
    // fresh empty seed (this is exactly the reseed incident that hit the Credit
    // Facility app on 2026-07-01). Fail LOUDLY instead so the real DB is never
    // abandoned. A new sheet is created ONLY on genuine first run (no ID yet).
    try {
      return SpreadsheetApp.openById(id);
    } catch (err) {
      throw new Error('Cannot open the Meeting Minutes database (' + PROP_DB_ID +
        '=' + id + '). The app will NOT auto-create a blank one, to avoid losing ' +
        'data. Retry, or check that the sheet still exists and is shared. (' +
        (err.message || err) + ')');
    }
  }
  var ss = SpreadsheetApp.create('VCB Meeting Minutes — Database');
  props.setProperty(PROP_DB_ID, ss.getId());
  initSheets_(ss);
  moveDbToFolder_(ss.getId());   // keep the DB out of My Drive root (best-effort)
  return ss;
}

// Move the master DB into this app's own Drive folder ("Meeting Minute Web
// App") so it never clutters My Drive root and everything about the app
// lives in one place. Best-effort: never throws (a placement hiccup must
// not break DB creation). Also callable once from the editor to relocate an
// already-created root DB — see moveDbToFolder().
// Fixed ID rather than a by-name Drive search: a name search can find (or
// recreate) an unrelated same-named folder anywhere in Drive, which is how
// attachments previously ended up in a stray root-level "VCB App Data" folder
// instead of here.
var APP_FOLDER_ID = '1Ag1RrEBL1n3wlQNYS79ugyJ5gNdnnGvh'; // "Meeting Minute Web App"
function moveDbToFolder_(id) {
  try {
    var file = DriveApp.getFileById(id);
    var folder = DriveApp.getFolderById(APP_FOLDER_ID);
    file.moveTo(folder);
  } catch (e) { /* leave at root rather than fail */ }
}

// One-time editor helper: relocate the existing master DB into the app's
// own Drive folder. Safe to run repeatedly. Returns the folder it now lives in.
function moveDbToFolder() {
  var id = PropertiesService.getScriptProperties().getProperty(PROP_DB_ID);
  if (!id) throw new Error(PROP_DB_ID + ' not set — open the app once to create the DB first.');
  moveDbToFolder_(id);
  var ps = DriveApp.getFileById(id).getParents();
  return ps.hasNext() ? ps.next().getName() : '(root)';
}

// One-time editor helper: earlier versions of getAttachmentsFolder_() searched
// Drive by folder name, which found/created a stray "VCB App Data/Attachments"
// folder at My Drive root instead of inside this app's own folder. Moves any
// files sitting there into the real Attachments folder, then deletes the
// now-empty stray folders. Safe to run repeatedly (no-ops once cleaned up).
function migrateStrayAttachments() {
  var moved = [];
  var target = getAttachmentsFolder_();
  var rootFolders = DriveApp.getFoldersByName('VCB App Data');
  while (rootFolders.hasNext()) {
    var strayRoot = rootFolders.next();
    if (strayRoot.getId() === APP_FOLDER_ID) continue;
    var strayAttSub = strayRoot.getFoldersByName('Attachments');
    while (strayAttSub.hasNext()) {
      var strayAtt = strayAttSub.next();
      var files = strayAtt.getFiles();
      while (files.hasNext()) {
        var f = files.next();
        moved.push(f.getName());
        f.moveTo(target);
      }
      strayAtt.setTrashed(true);
    }
    strayRoot.setTrashed(true);
  }
  return moved;
}

// One-time editor helper: Fathom ingest used to set dateLabel to the raw
// recording title (a bug — the title isn't a date), which then surfaced
// directly in the "Edit here" Date field once that field started reading/
// writing dateLabel. Recomputes dateLabel from each row's own `date` for any
// Fathom-sourced row where the two are still equal. Safe to run repeatedly.
function fixFathomDateLabels() {
  var sheet = getSheet_();
  var rows = readAllRows_();
  var fixed = [];
  rows.forEach(function (r) {
    if (r.source === 'fathom' && r.dateLabel === r.title) {
      var label = isoToLabel_(r.date);
      if (label) {
        sheet.getRange(r._rowIndex, COLUMNS.indexOf('dateLabel') + 1).setValue(label);
        fixed.push({ title: r.title, dateLabel: label });
      }
    }
  });
  return fixed;
}

function initSheets_(ss) {
  var sheet = ss.getSheets()[0];
  sheet.setName(SHEET_NAME);
  sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  if (!ss.getSheetByName(CONTENT_SHEET)) {
    var c = ss.insertSheet(CONTENT_SHEET);
    c.getRange(1, 1, 1, 3).setValues([['id', 'seq', 'chunk']]).setFontWeight('bold');
    c.setFrozenRows(1);
  }
}

function getSheet_() {
  var ss = getDb_();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) { initSheets_(ss); sheet = ss.getSheetByName(SHEET_NAME); }
  ensureColumns_(sheet);
  return sheet;
}

// Appends any COLUMNS entries the sheet's header row doesn't have yet (e.g.
// taggedProjectId added 2026-07-18). Only ever grows the header rightward —
// never touches existing columns/data, so it's safe to call on every request.
function ensureColumns_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol >= COLUMNS.length) return;
  var have = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  if (have.length === COLUMNS.length) return;
  sheet.getRange(1, have.length + 1, 1, COLUMNS.length - have.length)
    .setValues([COLUMNS.slice(have.length)]).setFontWeight('bold');
}

function getContentSheet_() {
  var ss = getDb_();
  var c = ss.getSheetByName(CONTENT_SHEET);
  if (!c) { initSheets_(ss); c = ss.getSheetByName(CONTENT_SHEET); }
  return c;
}

function readAllRows_() {
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, COLUMNS.length).getValues();
  return values.map(function (row, i) {
    var obj = { _rowIndex: i + 2 };
    COLUMNS.forEach(function (c, j) {
      var v = row[j];
      if (v instanceof Date) {
        v = Utilities.formatDate(v, 'Asia/Bangkok', c === 'time' ? 'HH:mm' : 'yyyy-MM-dd');
      }
      obj[c] = (v === null || v === undefined) ? '' : v;
    });
    return obj;
  });
}

function rowFromObject_(obj) {
  return COLUMNS.map(function (c) { return obj[c] === undefined ? '' : obj[c]; });
}

/* ----------------------------- Content store ------------------------------ */

// Snapshots the CURRENT content (before it's overwritten) into the append-only
// Versions sheet, then overwrites — so every save keeps its predecessor
// forever. Cheap: meeting content is a few KB typically, chunked the same way
// as the live Content sheet; even dozens of edits per meeting stays trivial
// for Sheets to hold. Skipped on brand-new rows (nothing to snapshot yet).
// Returns the version seq of the PRE-edit snapshot it just took (or null if
// there was nothing to snapshot — brand-new row, or skipSnapshot). Callers
// that also write an audit log entry for this same save should attach this
// seq to the entry's details, so the activity log can offer "View" showing
// exactly what changed at that point — one unified timeline instead of a
// separate, redundant version list.
// preEditMeta (optional): { title, dateLabel, time } as they were BEFORE this
// save — the caller must capture these from its own pre-edit row, since by
// the time saveContent_ runs the sheet row itself may already be overwritten.
function saveContent_(id, html, skipSnapshot, preEditMeta) {
  var snapshotSeq = null;
  if (!skipSnapshot) {
    var existing = getContent_(id);
    if (existing) snapshotSeq = snapshotVersion_(id, existing, preEditMeta);
  }
  deleteContent_(id);
  var c = getContentSheet_();
  html = String(html || '');
  var rows = [];
  var seq = 0;
  for (var i = 0; i < html.length; i += CHUNK) {
    rows.push([id, seq++, html.substr(i, CHUNK)]);
  }
  if (!rows.length) rows.push([id, 0, '']);
  c.getRange(c.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
  return snapshotSeq;
}

function getContent_(id) {
  var c = getContentSheet_();
  var last = c.getLastRow();
  if (last < 2) return '';
  // Read only id+seq (small) first, then fetch just this meeting's chunk cells —
  // avoids pulling every meeting's (possibly image-heavy) content on each open.
  var keys = c.getRange(2, 1, last - 1, 2).getValues();
  var hits = [];
  for (var i = 0; i < keys.length; i++) {
    if (keys[i][0] === id) hits.push({ row: i + 2, seq: Number(keys[i][1]) || 0 });
  }
  if (!hits.length) return '';
  hits.sort(function (a, b) { return a.seq - b.seq; });
  return hits.map(function (h) { return c.getRange(h.row, 3).getValue(); }).join('');
}

function deleteContent_(id) {
  var c = getContentSheet_();
  var last = c.getLastRow();
  if (last < 2) return;
  var vals = c.getRange(2, 1, last - 1, 1).getValues();
  // delete from bottom up to keep indices valid
  for (var i = vals.length - 1; i >= 0; i--) {
    if (vals[i][0] === id) c.deleteRow(i + 2);
  }
}

/* --------------------------- Doc → clean HTML ----------------------------- */

function escapeHtml_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stripTags_(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();
}

function cleanHeading_(s) {
  return String(s || '').replace(/^[\s ]*[\p{Emoji_Presentation}\p{So}•▪️📌]+/u, '')
    .replace(/^[\s ]+/, '').trim();
}

// --- Google Docs API readers (these see file/Drive smart chips, unlike DocumentApp) ---

function fetchDoc_(docId) {
  // Prefer the advanced Docs service — declaring it auto-enables the Docs API for
  // this script's Cloud project, which the raw REST call cannot do on its own.
  try {
    if (typeof Docs !== 'undefined' && Docs.Documents && Docs.Documents.get) {
      return Docs.Documents.get(docId, { includeTabsContent: true });
    }
  } catch (e) { Logger.log('Docs advanced service failed: ' + e); }
  var url = 'https://docs.googleapis.com/v1/documents/' + encodeURIComponent(docId) + '?includeTabsContent=true';
  var resp = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200) {
    throw new Error('Docs API ' + resp.getResponseCode() + ': ' + resp.getContentText().slice(0, 200));
  }
  return JSON.parse(resp.getContentText());
}

// Flatten document tabs (incl. nested) into { title, content, inlineObjects, lists }.
function collectApiTabs_(doc) {
  var out = [];
  if (doc.tabs && doc.tabs.length) {
    (function walk(tabs) {
      tabs.forEach(function (t) {
        if (t.documentTab && t.documentTab.body) {
          out.push({
            title: (t.tabProperties && t.tabProperties.title) || '',
            tabId: (t.tabProperties && t.tabProperties.tabId) || '',
            content: t.documentTab.body.content || [],
            inlineObjects: t.documentTab.inlineObjects || {},
            lists: t.documentTab.lists || {}
          });
        }
        if (t.childTabs && t.childTabs.length) walk(t.childTabs);
      });
    })(doc.tabs);
  } else if (doc.body) {
    out.push({ title: doc.title || '', content: doc.body.content || [], inlineObjects: doc.inlineObjects || {}, lists: doc.lists || {} });
  }
  return out;
}

function namedStyleTag_(ps) {
  var n = (ps && ps.namedStyleType) || 'NORMAL_TEXT';
  if (n === 'TITLE' || n === 'HEADING_1') return 'h1';
  if (n === 'SUBTITLE' || n === 'HEADING_2') return 'h2';
  if (n.indexOf('HEADING_') === 0) return 'h3';
  return 'p';
}

function isOrderedList_(lists, listId, level) {
  try {
    var g = lists[listId].listProperties.nestingLevels[level].glyphType || '';
    return /DECIMAL|ALPHA|ROMAN/i.test(g);
  } catch (e) { return false; }
}

/* ----------------------------- Attachments --------------------------------- */
// Files (PDF/PPT/XLS/etc) attached directly to a meeting, stored inside this
// app's own "Meeting Minute Web App" Drive folder (same place as the DB and
// script) — not the meeting content itself, a separate first-class list per
// row (COLUMNS.attachments, JSON array).
var ATTACHMENTS_FOLDER = 'Meeting Attachments';
function getAttachmentsFolder_() {
  var parent = DriveApp.getFolderById(APP_FOLDER_ID);
  var sub = parent.getFoldersByName(ATTACHMENTS_FOLDER);
  return sub.hasNext() ? sub.next() : parent.createFolder(ATTACHMENTS_FOLDER);
}

function parseAttachments_(cell) {
  try { var v = JSON.parse(cell || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}

// Uploads a file (base64-encoded from the client) and attaches it to a
// meeting. Admin-only. Rejects anything not in the allowed set of common
// office/document formats — an attachments folder is not meant to become a
// dumping ground for arbitrary executables.
var ATTACHMENT_ALLOWED_MIME = /^(application\/pdf|application\/vnd\.openxmlformats-officedocument\.|application\/vnd\.ms-(excel|powerpoint)|application\/msword|image\/(png|jpe?g|gif|webp)|text\/(plain|csv))/i;
var ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024; // 25MB per file

function addAttachment(meetingId, fileName, mimeType, base64Data, token) {
  if (!isEditorOrAdmin_(token)) throw new Error('Not authorized.');
  setActor_(token);   // so the audit log names the editor, not '(anonymous)'
  assertNotPrivateInbox_(meetingId, token);
  var sheet = getSheet_();
  var rows = readAllRows_();
  var row = rows.filter(function (r) { return r.id === meetingId; })[0];
  if (!row) throw new Error('Meeting not found.');

  if (!ATTACHMENT_ALLOWED_MIME.test(mimeType || '')) {
    throw new Error('File type not allowed. Supported: PDF, Word, Excel, PowerPoint, images, text/CSV.');
  }
  var bytes = Utilities.base64Decode(base64Data);
  if (bytes.length > ATTACHMENT_MAX_BYTES) throw new Error('File is too large (max 25MB).');

  var blob = Utilities.newBlob(bytes, mimeType, fileName);
  var file = getAttachmentsFolder_().createFile(blob);
  // The app itself is fully public (ANYONE_ANONYMOUS) — an attachment needs
  // the same reach, so viewers can actually open the file link, not just see
  // its name. Matches the app's existing visibility model; a hidden meeting's
  // attachment link still isn't discoverable since the meeting row itself is
  // never sent to non-admins (see listMeetings/getMeeting's visible filter).
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
  catch (e) { Logger.log('addAttachment: could not set sharing for ' + file.getId() + ': ' + e); }

  var att = parseAttachments_(row.attachments);
  var now = new Date().toISOString();
  att.push({ fileId: file.getId(), name: fileName, mimeType: mimeType, size: bytes.length, uploadedAt: now, uploadedBy: googleEmail_() || '(anonymous)' });
  sheet.getRange(row._rowIndex, COLUMNS.indexOf('attachments') + 1).setValue(JSON.stringify(att));
  sheet.getRange(row._rowIndex, COLUMNS.indexOf('updatedAt') + 1).setValue(now);
  auditLog_('add_attachment', 'meeting', meetingId, { name: fileName });
  return att;
}

function removeAttachment(meetingId, fileId, token) {
  if (!isEditorOrAdmin_(token)) throw new Error('Not authorized.');
  setActor_(token);   // so the audit log names the editor, not '(anonymous)'
  assertNotPrivateInbox_(meetingId, token);
  var sheet = getSheet_();
  var rows = readAllRows_();
  var row = rows.filter(function (r) { return r.id === meetingId; })[0];
  if (!row) throw new Error('Meeting not found.');

  var att = parseAttachments_(row.attachments);
  var target = att.filter(function (a) { return a.fileId === fileId; })[0];
  att = att.filter(function (a) { return a.fileId !== fileId; });
  sheet.getRange(row._rowIndex, COLUMNS.indexOf('attachments') + 1).setValue(JSON.stringify(att));
  sheet.getRange(row._rowIndex, COLUMNS.indexOf('updatedAt') + 1).setValue(new Date().toISOString());
  try { if (target) DriveApp.getFileById(fileId).setTrashed(true); } catch (e) { /* file already gone — row cleanup still succeeds */ }
  auditLog_('remove_attachment', 'meeting', meetingId, { name: target ? target.name : fileId });
  return att;
}

function parseComments_(cell) {
  try { var v = JSON.parse(cell || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}

var COMMENT_MAX_CHARS = 4000;

// Any staff member who can see the meeting can comment on it — same audience
// as the meeting's own visibility, checked by the caller (getMeeting already
// hides non-visible meetings from non-admins; addComment/removeComment only
// require a signed-in Google identity, not admin, matching that same rule).
function addComment(meetingId, text, token) {
  // identify_ so an editor or a named project viewer signed in with a PIN is
  // recognised; googleEmail_ alone is blank for everyone under this
  // deployment, which would have refused them all.
  var email = identify_(token) || googleEmail_();
  if (!email) throw new Error('Not signed in.');
  text = String(text || '').trim();
  if (!text) throw new Error('Comment is empty.');
  if (text.length > COMMENT_MAX_CHARS) throw new Error('Comment is too long (max ' + COMMENT_MAX_CHARS + ' characters).');

  var sheet = getSheet_();
  var rows = readAllRows_();
  var row = rows.filter(function (r) { return r.id === meetingId; })[0];
  if (!row) throw new Error('Meeting not found.');
  // Same audience as reading the meeting: the per-meeting visible flag AND
  // the project guest list. Without the second check somebody outside a
  // locked project could not read it but could still post into it.
  // An inbox row is reached through the projects it was TAGGED into (its own
  // projectId is the staging inbox, which nobody but an admin can see), so it
  // uses the same tagged-project rule getMeeting applies.
  if (!isAdminEmail_(email)) {
    var reach = isInboxProjectId_(row.projectId)
      ? parseTaggedProjectIds_(row.taggedProjectId).some(function (pid) { return canSeeProject_(pid, email); })
      : canSeeProject_(row.projectId, email);
    if (!(isVisible_(row) && reach)) throw new Error('Not authorized.');
  }

  var comments = parseComments_(row.comments);
  var now = new Date().toISOString();
  var comment = { id: Utilities.getUuid(), author: email, text: text, createdAt: now };
  comments.push(comment);
  sheet.getRange(row._rowIndex, COLUMNS.indexOf('comments') + 1).setValue(JSON.stringify(comments));
  sheet.getRange(row._rowIndex, COLUMNS.indexOf('updatedAt') + 1).setValue(now);
  auditLog_('add_comment', 'meeting', meetingId, { commentId: comment.id });
  return comments;
}

function removeComment(meetingId, commentId, token) {
  // identify_ first, exactly as addComment does. Reading googleEmail_()
  // alone identified a PIN-signed editor as nobody, so they could post a
  // comment and then be refused permission to delete their own.
  var email = identify_(token) || googleEmail_();
  if (!email) throw new Error('Not signed in.');
  var sheet = getSheet_();
  var rows = readAllRows_();
  var row = rows.filter(function (r) { return r.id === meetingId; })[0];
  if (!row) throw new Error('Meeting not found.');

  var comments = parseComments_(row.comments);
  var target = comments.filter(function (c) { return c.id === commentId; })[0];
  if (!target) throw new Error('Comment not found.');
  if (target.author !== email && !isAdminEmail_(email)) throw new Error('Not authorized.');

  comments = comments.filter(function (c) { return c.id !== commentId; });
  sheet.getRange(row._rowIndex, COLUMNS.indexOf('comments') + 1).setValue(JSON.stringify(comments));
  sheet.getRange(row._rowIndex, COLUMNS.indexOf('updatedAt') + 1).setValue(new Date().toISOString());
  auditLog_('remove_comment', 'meeting', meetingId, { commentId: commentId });
  return comments;
}

function fileChipIcon_(mime, title) {
  var t = ((mime || '') + ' ' + (title || '')).toLowerCase();
  if (/sheet|excel|\.xls|\.csv/.test(t)) return '<span class="fi xls">X</span>';
  if (/presentation|powerpoint|\.ppt/.test(t)) return '<span class="fi ppt">P</span>';
  if (/pdf/.test(t)) return '<span class="fi pdf">PDF</span>';
  if (/document|word|\.doc/.test(t)) return '<span class="fi doc">W</span>';
  if (/folder/.test(t)) return '<span class="fi fld">▦</span>';
  return '<span class="fi gen">▭</span>';
}

// A Drive/file smart chip → a clickable file chip in the app.
function richLinkHtml_(rl) {
  var p = (rl && rl.richLinkProperties) || {};
  var uri = p.uri || '';
  var title = p.title || uri;
  if (!uri) return escapeHtml_(title);
  return '<a class="chip-file" href="' + escapeHtml_(uri) + '" target="_blank">' +
    fileChipIcon_(p.mimeType, title) + '<span>' + escapeHtml_(title) + '</span></a>';
}

function inlineObjectHtml_(id, ctx) {
  var io = ctx.inlineObjects[id];
  if (!io) return '';
  try {
    var eo = io.inlineObjectProperties.embeddedObject;
    var uri = eo.imageProperties && eo.imageProperties.contentUri;
    if (!uri) return '';
    try {
      var resp = UrlFetchApp.fetch(uri, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
      if (resp.getResponseCode() === 200) {
        var blob = resp.getBlob(); var bytes = blob.getBytes();
        if (bytes.length < 3500000) {
          return '<img style="max-width:100%" src="data:' + (blob.getContentType() || 'image/png') + ';base64,' + Utilities.base64Encode(bytes) + '">';
        }
      }
    } catch (e) { /* fall back to direct uri */ }
    return '<img style="max-width:100%" src="' + escapeHtml_(uri) + '">';
  } catch (e) { return ''; }
}

function renderParaElements_(elements, ctx) {
  var out = '';
  (elements || []).forEach(function (el) {
    if (el.textRun) {
      var content = el.textRun.content || '';
      if (!content) return;
      var piece = escapeHtml_(content).replace(/\n/g, '<br>');
      var st = el.textRun.textStyle || {};
      if (st.bold) piece = '<b>' + piece + '</b>';
      if (st.italic) piece = '<i>' + piece + '</i>';
      if (st.link && st.link.url) piece = '<a href="' + escapeHtml_(st.link.url) + '">' + piece + '</a>';
      out += piece;
    } else if (el.richLink) {
      out += richLinkHtml_(el.richLink);
    } else if (el.person) {
      var pp = el.person.personProperties || {};
      var em = pp.email || '', nm = pp.name || em;
      out += em ? '<a href="mailto:' + escapeHtml_(em) + '">' + escapeHtml_(nm) + '</a>' : escapeHtml_(nm);
    } else if (el.inlineObjectElement) {
      out += inlineObjectHtml_(el.inlineObjectElement.inlineObjectId, ctx);
    }
  });
  return out;
}

function renderContent_(content, ctx) {
  var out = [];
  var stack = [];
  function closeLists() { while (stack.length) out.push('</' + stack.pop() + '>'); }
  (content || []).forEach(function (se) {
    if (se.paragraph) {
      var para = se.paragraph;
      var inner = renderParaElements_(para.elements, ctx);
      if (para.bullet) {
        var level = para.bullet.nestingLevel || 0;
        var tag = isOrderedList_(ctx.lists, para.bullet.listId, level) ? 'ol' : 'ul';
        while (stack.length > level + 1) out.push('</' + stack.pop() + '>');
        if (stack.length < level + 1) { out.push('<' + tag + '>'); stack.push(tag); }
        if (inner.trim()) out.push('<li>' + inner + '</li>');
      } else {
        closeLists();
        if (inner.replace(/<br>/g, '').trim() || /<img|chip-file/.test(inner)) {
          var tg = namedStyleTag_(para.paragraphStyle);
          out.push('<' + tg + '>' + inner + '</' + tg + '>');
        }
      }
    } else if (se.table) {
      closeLists();
      out.push(renderApiTable_(se.table, ctx));
    }
  });
  closeLists();
  return out.join('');
}

function renderApiTable_(table, ctx) {
  var html = '<table>';
  (table.tableRows || []).forEach(function (row) {
    html += '<tr>';
    (row.tableCells || []).forEach(function (cell) {
      html += '<td>' + renderContent_(cell.content || [], ctx) + '</td>';
    });
    html += '</tr>';
  });
  return html + '</table>';
}

/* ------------------------------ Attendees --------------------------------- */

var EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function extractAttendees_(html) {
  var found = {}, list = [], m;
  EMAIL_RE.lastIndex = 0;
  while ((m = EMAIL_RE.exec(html))) {
    var e = m[0].toLowerCase();
    if (!found[e]) { found[e] = 1; list.push(m[0]); }
  }
  return list;
}

// Turn bare email addresses into mailto links (without double-linking existing ones).
function linkifyEmails_(html) {
  return html.replace(/(^|[\s>(,;])([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})(?![\w@.]|<\/a>|")/g,
    function (full, pre, email) { return pre + '<a href="mailto:' + email + '">' + email + '</a>'; });
}

// Drive / Docs URL → file-chip (same look as smart-chip imports from the source Doc).
// Handles plain pasted URLs and auto-linkified <a href="…drive/docs…">…</a> tags.
function driveChipFor_(url) {
  var id = '', kind = '';
  var m;
  if ((m = url.match(/drive\.google\.com\/drive\/folders\/([A-Za-z0-9_-]+)/))) { id = m[1]; kind = 'folder'; }
  else if ((m = url.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/))) { id = m[1]; kind = 'file'; }
  else if ((m = url.match(/docs\.google\.com\/document\/d\/([A-Za-z0-9_-]+)/))) { id = m[1]; kind = 'doc'; }
  else if ((m = url.match(/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)/))) { id = m[1]; kind = 'sheet'; }
  else if ((m = url.match(/docs\.google\.com\/presentation\/d\/([A-Za-z0-9_-]+)/))) { id = m[1]; kind = 'slides'; }
  if (!id) return null;
  var title = url, mime = '';
  try {
    if (kind === 'folder') {
      var fld = DriveApp.getFolderById(id); title = fld.getName(); mime = 'application/vnd.google-apps.folder';
    } else {
      var f = DriveApp.getFileById(id); title = f.getName(); mime = f.getMimeType();
    }
  } catch (e) { return null; } // owner can't see it — leave as plain link
  return '<a class="chip-file" href="' + escapeHtml_(url) + '" target="_blank">' +
    fileChipIcon_(mime, title) + '<span>' + escapeHtml_(title) + '</span></a>';
}

// Replace pasted Drive / Docs URLs with file-chip markup, idempotent (skips chips already there).
function chipifyDriveLinks_(html) {
  if (!html) return html;
  // Pass 1: anchor tags that wrap a Drive URL (browsers auto-linkify pasted URLs).
  html = String(html).replace(/<a\b([^>]*?)>([\s\S]*?)<\/a>/gi, function (full, attrs, inner) {
    if (/class\s*=\s*"[^"]*\bchip-file\b/.test(attrs)) return full;        // already a chip
    var hrefM = attrs.match(/href\s*=\s*"([^"]+)"/i); if (!hrefM) return full;
    if (!/^https?:\/\/(drive|docs)\.google\.com\//.test(hrefM[1])) return full;
    var chip = driveChipFor_(hrefM[1]); return chip || full;
  });
  // Pass 2: bare URLs sitting in text. Negative-lookbehind isn't available everywhere, so we
  // use a leading boundary group and skip matches preceded by quote/equals (attribute values).
  html = html.replace(/(^|[\s>(\[,;])(https?:\/\/(?:drive\.google\.com\/(?:drive\/folders\/|file\/d\/)|docs\.google\.com\/(?:document|spreadsheets|presentation)\/d\/)[A-Za-z0-9_-]+[^\s"'<>)]*)/g,
    function (full, pre, url) {
      var chip = driveChipFor_(url); return chip ? pre + chip : full;
    });
  return html;
}

/* ------------------------------- Date utils ------------------------------- */

var THAI_MONTHS = {
  'ม.ค': 1, 'มกราคม': 1, 'ก.พ': 2, 'กุมภาพันธ์': 2, 'มี.ค': 3, 'มีนาคม': 3,
  'เม.ย': 4, 'เมษายน': 4, 'พ.ค': 5, 'พฤษภาคม': 5, 'มิ.ย': 6, 'มิถุนายน': 6,
  'ก.ค': 7, 'กรกฎาคม': 7, 'ส.ค': 8, 'สิงหาคม': 8, 'ก.ย': 9, 'กันยายน': 9,
  'ต.ค': 10, 'ตุลาคม': 10, 'พ.ย': 11, 'พฤศจิกายน': 11, 'ธ.ค': 12, 'ธันวาคม': 12
};
var EN_MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function normYear_(y) { y = parseInt(y, 10); if (y < 100) y += 2500; if (y > 2400) y -= 543; return y; }
function pad2_(n) { return (n < 10 ? '0' : '') + n; }

var MONTH_NAMES_ = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// yyyy-mm-dd -> "21 May 2569" (Buddhist year), matching the client's fmtDate
// style. Used where a human-readable dateLabel is needed but the source only
// gave a raw title (e.g. Fathom imports) — reusing the title as the date
// label was wrong (see fathom ingest history) since the title isn't a date.
function isoToLabel_(iso) {
  var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  var mo = parseInt(m[2], 10);
  if (mo < 1 || mo > 12) return '';
  return parseInt(m[3], 10) + ' ' + MONTH_NAMES_[mo - 1] + ' ' + (parseInt(m[1], 10) + 543);
}

function parseDateLabel_(label) {
  if (!label) return '';
  // Strip time tokens (e.g. "10.00น", "10:00AM") so they aren't misread as dates.
  var s = String(label).replace(/\d{1,2}\s*[:.]\s*\d{2}\s*(?:AM|PM|am|pm|น\.?)?/g, ' ');
  // ISO-ish yyyy-mm-dd (year may be Buddhist, e.g. 2569-12-03) — only when the
  // first group is a full 4-digit year, so it can't be confused with the
  // day-first dd-mm-yyyy case below.
  var iso = s.match(/(\d{4})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})/);
  if (iso) return normYear_(iso[1]) + '-' + pad2_(parseInt(iso[2], 10)) + '-' + pad2_(parseInt(iso[3], 10));
  // dd/mm/yyyy or dd-mm-yyyy — day first, matching how people naturally type
  // dates (smallest-to-largest), not year-first ISO order.
  var m = s.match(/(\d{1,2})\s*[\/\.\-]\s*(\d{1,2})\s*[\/\.\-]\s*(\d{2,4})/);
  if (m) return normYear_(m[3]) + '-' + pad2_(parseInt(m[2], 10)) + '-' + pad2_(parseInt(m[1], 10));
  // English month: "21 May 2569" or "May 21, 2569"
  var em = s.match(/(\d{1,2})\s*([A-Za-z]{3,9})\.?\s*,?\s*(\d{2,4})/);
  if (em && EN_MONTHS[em[2].slice(0, 3).toLowerCase()]) {
    return normYear_(em[3]) + '-' + pad2_(EN_MONTHS[em[2].slice(0, 3).toLowerCase()]) + '-' + pad2_(parseInt(em[1], 10));
  }
  var em2 = s.match(/([A-Za-z]{3,9})\s+(\d{1,2})\s*,?\s*(\d{2,4})/);
  if (em2 && EN_MONTHS[em2[1].slice(0, 3).toLowerCase()]) {
    return normYear_(em2[3]) + '-' + pad2_(EN_MONTHS[em2[1].slice(0, 3).toLowerCase()]) + '-' + pad2_(parseInt(em2[2], 10));
  }
  // Thai month — require actual Thai letters (not just a stray ".").
  var tm = s.match(/(\d{1,2})\s*([ก-๙]+\.?[ก-๙]*\.?)\s*(\d{2,4})/);
  if (tm) {
    var key = tm[2].replace(/\.+$/, '').trim();
    if (key) {
      for (var k in THAI_MONTHS) {
        if (key === k || key.indexOf(k) === 0 || k.indexOf(key) === 0) {
          return normYear_(tm[3]) + '-' + pad2_(THAI_MONTHS[k]) + '-' + pad2_(parseInt(tm[1], 10));
        }
      }
    }
  }
  return '';
}

function looksLikeDate_(s) {
  return /\d{1,2}\s*[\/\.]\s*\d{1,2}\s*[\/\.]\s*\d{2,4}/.test(s) ||
    /\d{1,2}\s*[ก-๙\.]+\s*\d{2,4}/.test(s) ||
    /(\d{1,2}\s*[A-Za-z]{3,9}|[A-Za-z]{3,9}\s*\d{1,2})\s*,?\s*\d{2,4}/.test(s);
}

// Normalize any time to 24-hour "HH:MM".
function extractTime_(s) {
  var m = String(s).match(/(\d{1,2})\s*[:.]\s*(\d{2})\s*(AM|PM|am|pm)?/);
  if (!m) return '';
  var h = parseInt(m[1], 10), mm = m[2], ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  if (h > 23 || parseInt(mm, 10) > 59) return '';
  return pad2_(h) + ':' + mm;
}

/* ------------------------------- Importer --------------------------------- */

/* --- DocumentApp fallback (works without the Docs API; misses smart chips) --- */

function daRenderText_(textEl) {
  var s = textEl.getText();
  if (!s) return '';
  var idx = textEl.getTextAttributeIndices();
  if (!idx.length) return escapeHtml_(s).replace(/\n/g, '<br>');
  var out = '';
  for (var i = 0; i < idx.length; i++) {
    var start = idx[i], end = (i + 1 < idx.length) ? idx[i + 1] : s.length;
    var run = s.substring(start, end);
    if (!run) continue;
    var piece = escapeHtml_(run).replace(/\n/g, '<br>');
    var url = textEl.getLinkUrl(start);
    if (textEl.isBold(start)) piece = '<b>' + piece + '</b>';
    if (textEl.isItalic(start)) piece = '<i>' + piece + '</i>';
    if (url) piece = '<a href="' + escapeHtml_(url) + '">' + piece + '</a>';
    out += piece;
  }
  return out;
}
function daInlineImage_(img) {
  try {
    var blob = img.getBlob(); var bytes = blob.getBytes();
    if (bytes.length > 3500000) return '[image]';
    return '<img style="max-width:100%" src="data:' + (blob.getContentType() || 'image/png') + ';base64,' + Utilities.base64Encode(bytes) + '">';
  } catch (e) { return ''; }
}
function daRenderInline_(container) {
  var out = '', n = container.getNumChildren ? container.getNumChildren() : 0;
  for (var i = 0; i < n; i++) {
    var ch = container.getChild(i), t = ch.getType();
    if (t === DocumentApp.ElementType.TEXT) out += daRenderText_(ch.asText());
    else if (t === DocumentApp.ElementType.INLINE_IMAGE) out += daInlineImage_(ch.asInlineImage());
  }
  return out;
}
function daHeadingTag_(p) {
  var h = p.getHeading(), H = DocumentApp.ParagraphHeading;
  if (h === H.TITLE || h === H.HEADING1) return 'h1';
  if (h === H.HEADING2) return 'h2';
  if (h === H.HEADING3 || h === H.HEADING4 || h === H.HEADING5 || h === H.HEADING6) return 'h3';
  return 'p';
}
function daOrdered_(g) {
  var G = DocumentApp.GlyphType;
  return g === G.NUMBER || g === G.LATIN_UPPER || g === G.LATIN_LOWER || g === G.ROMAN_UPPER || g === G.ROMAN_LOWER;
}
function daRenderTable_(tbl) {
  var html = '<table>';
  for (var r = 0; r < tbl.getNumRows(); r++) {
    var row = tbl.getRow(r); html += '<tr>';
    for (var c = 0; c < row.getNumCells(); c++) html += '<td>' + daRenderChildren_(row.getCell(c)) + '</td>';
    html += '</tr>';
  }
  return html + '</table>';
}
function daRenderChildren_(container) {
  var out = [], stack = [];
  function closeAll() { while (stack.length) out.push('</' + stack.pop() + '>'); }
  var n = container.getNumChildren();
  for (var i = 0; i < n; i++) {
    var el = container.getChild(i), t = el.getType();
    if (t === DocumentApp.ElementType.LIST_ITEM) {
      var li = el.asListItem(), level = li.getNestingLevel();
      var tag = daOrdered_(li.getGlyphType()) ? 'ol' : 'ul';
      while (stack.length > level + 1) out.push('</' + stack.pop() + '>');
      if (stack.length < level + 1) { out.push('<' + tag + '>'); stack.push(tag); }
      var inner = daRenderInline_(li);
      if (inner.trim()) out.push('<li>' + inner + '</li>');
    } else if (t === DocumentApp.ElementType.PARAGRAPH) {
      closeAll();
      var p = el.asParagraph(), content = daRenderInline_(p);
      if (content.replace(/<br>/g, '').trim() || /<img/.test(content)) {
        var tg = daHeadingTag_(p); out.push('<' + tg + '>' + content + '</' + tg + '>');
      }
    } else if (t === DocumentApp.ElementType.TABLE) { closeAll(); out.push(daRenderTable_(el.asTable())); }
  }
  closeAll();
  return out.join('');
}
function daGetAllTabs_(doc) {
  var flat = [], tabs = doc.getTabs ? doc.getTabs() : null;
  if (!tabs || !tabs.length) return [{ __body: doc.getBody(), __title: '' }];
  (function walk(arr) {
    for (var i = 0; i < arr.length; i++) { flat.push(arr[i]); var ch = arr[i].getChildTabs ? arr[i].getChildTabs() : null; if (ch && ch.length) walk(ch); }
  })(tabs);
  return flat;
}
function docToRecordsDA_(docMeta) {
  var doc = DocumentApp.openById(docMeta.docId);
  var tabs = daGetAllTabs_(doc);
  var records = [], seenKeys = {};
  for (var ti = 0; ti < tabs.length; ti++) {
    var tab = tabs[ti], body, rawTitle = '', tabId = '';
    if (tab.asDocumentTab) { try { body = tab.asDocumentTab().getBody(); rawTitle = tab.getTitle() || ''; tabId = tab.getId ? tab.getId() : ''; } catch (e) { continue; } }
    else { body = tab.__body; rawTitle = tab.__title || ''; }
    if (!body) continue;
    var html = daRenderChildren_(body);
    if (!stripTags_(html).trim() && !/<img/.test(html)) continue;
    var title = cleanHeading_(rawTitle);
    var isMeeting = !!title && looksLikeDate_(title);
    if (!title) title = docMeta.name + ' — Overview';
    var iso = isMeeting ? parseDateLabel_(title) : '';
    var fathom = (html.match(/https?:\/\/fathom\.video\/[^\s"'<)]+/) || [''])[0];
    var attendees = extractAttendees_(html);
    html = chipifyDriveLinks_(linkifyEmails_(html));
    var key = (iso || title || ('tab-' + ti));
    if (seenKeys[key]) { key = key + '#' + (++seenKeys[key]); } else { seenKeys[key] = 1; }
    records.push({
      projectId: docMeta.id, meetingKey: key, date: iso, dateLabel: isMeeting ? title : '',
      time: extractTime_(title), title: title, kind: isMeeting ? 'meeting' : 'overview',
      excerpt: stripTags_(html).slice(0, 200), fathomUrl: fathom,
      attendees: JSON.stringify(attendees), tabId: tabId, source: 'doc-import', html: html
    });
  }
  return records;
}

// Try the Docs API (captures smart-chip attachments); fall back to DocumentApp.
function docToRecords_(docMeta) {
  try {
    var recs = docToRecordsViaApi_(docMeta);
    if (recs && recs.length) return recs;
    Logger.log('Docs API returned 0 for ' + docMeta.id + '; using DocumentApp.');
  } catch (e) {
    Logger.log('Docs API failed for ' + docMeta.id + ' (' + e + '); using DocumentApp.');
  }
  return docToRecordsDA_(docMeta);
}

// Each Google Docs TAB is one meeting record (read via the Docs API so that file
// smart chips become clickable attachments). The tab title is the meeting label.
function docToRecordsViaApi_(docMeta) {
  var doc = fetchDoc_(docMeta.docId);
  var tabs = collectApiTabs_(doc);
  var records = [];
  var seenKeys = {};

  for (var ti = 0; ti < tabs.length; ti++) {
    var tab = tabs[ti];
    var ctx = { inlineObjects: tab.inlineObjects || {}, lists: tab.lists || {} };
    var html = renderContent_(tab.content || [], ctx);
    if (!stripTags_(html).trim() && !/<img|chip-file/.test(html)) continue;

    var title = cleanHeading_(tab.title || '');
    var isMeeting = !!title && looksLikeDate_(title);
    if (!title) title = docMeta.name + ' — Overview';

    var iso = isMeeting ? parseDateLabel_(title) : '';
    var fathom = (html.match(/https?:\/\/fathom\.video\/[^\s"'<)]+/) || [''])[0];
    var attendees = extractAttendees_(html);
    html = chipifyDriveLinks_(linkifyEmails_(html));

    var key = (iso || title || ('tab-' + ti));
    if (seenKeys[key]) { key = key + '#' + (++seenKeys[key]); } else { seenKeys[key] = 1; }

    records.push({
      projectId: docMeta.id, meetingKey: key, date: iso,
      dateLabel: isMeeting ? title : '', time: extractTime_(title),
      title: title, kind: isMeeting ? 'meeting' : 'overview',
      excerpt: stripTags_(html).slice(0, 200),
      fathomUrl: fathom, attendees: JSON.stringify(attendees),
      tabId: tab.tabId || '', source: 'doc-import', html: html
    });
  }
  return records;
}

function getDocCss_() { return ''; }

function importAllDocs(fullRefresh) {
  var sheet = getSheet_();
  var existing = readAllRows_();
  var byKey = {};
  existing.forEach(function (r) { byKey[r.projectId + '||' + r.meetingKey] = r; });

  var now = new Date().toISOString();
  var added = 0, updated = 0, docCount = 0, skipped = 0;
  // Track which projects were (re)imported this run and every meetingKey their
  // Docs currently produce, so stale rows can be pruned below.
  var processedProjects = {};
  var seenKeys = {};
  var props = PropertiesService.getScriptProperties();
  // Bump this whenever the reskin / render pipeline changes in a way that
  // requires re-processing every Doc once. Cached per-Doc timestamps are
  // ignored on the first sync after the bump, then resume normal behaviour.
  var RESKIN_VERSION = '5';
  var versionStale = props.getProperty('RESKIN_VERSION') !== RESKIN_VERSION;

  getAllProjects_().forEach(function (docMeta) {
    // Speedup: skip docs unchanged since last sync (unless fullRefresh or
    // the reskin code has been updated since the last successful run).
    var lastSeenKey = 'DOC_LAST_' + docMeta.docId;
    var lastModIso = '';
    try { lastModIso = DriveApp.getFileById(docMeta.docId).getLastUpdated().toISOString(); } catch (e) {}
    if (!fullRefresh && !versionStale && lastModIso && props.getProperty(lastSeenKey) === lastModIso) {
      skipped++; return;
    }
    // Doc has changed (or is being seen for the first time): silently reskin it
    // so the Doc and the web app stay visually identical. Best-effort — if
    // reskin fails, we still import content.
    try { reskinDoc_(docMeta.docId); } catch (e) { Logger.log('reskin ' + docMeta.id + ' failed: ' + e); }
    var records;
    try { records = docToRecords_(docMeta); }
    catch (err) { Logger.log('Skip ' + docMeta.id + ': ' + err); return; }
    docCount++;
    // Re-read last-modified AFTER reskin: the reskin itself touched the Doc, so
    // we must store the NEW timestamp, otherwise next sync sees it as "changed"
    // again and we end up in an infinite reskin loop.
    try { lastModIso = DriveApp.getFileById(docMeta.docId).getLastUpdated().toISOString(); } catch (e) {}
    if (lastModIso) props.setProperty(lastSeenKey, lastModIso);

    processedProjects[docMeta.id] = true;
    records.forEach(function (rec) {
      var k = rec.projectId + '||' + rec.meetingKey;
      seenKeys[k] = true;
      var prior = byKey[k];
      if (prior) {
        // Doc is canonical: every Sync overwrites content from the source Doc.
        // User-managed fields (visible, pinned, createdAt) are preserved.
        var merged = {
          id: prior.id, projectId: rec.projectId, meetingKey: rec.meetingKey,
          date: rec.date, dateLabel: rec.dateLabel, time: rec.time, title: rec.title,
          kind: rec.kind, excerpt: rec.excerpt, fathomUrl: rec.fathomUrl,
          attendees: rec.attendees, tabId: rec.tabId, source: 'doc-import',
          visible: prior.visible, // preserve admin's visibility choice
          pinned: prior.pinned, createdAt: prior.createdAt || now, updatedAt: now
        };
        sheet.getRange(prior._rowIndex, 1, 1, COLUMNS.length).setValues([rowFromObject_(merged)]);
        saveContent_(prior.id, rec.html);
        updated++;
      } else {
        var id = Utilities.getUuid();
        rec.id = id; rec.pinned = ''; rec.createdAt = now; rec.updatedAt = now;
        rec.visible = docVisibleDefault_(rec.projectId) ? 'TRUE' : '';
        sheet.appendRow(rowFromObject_(rec));
        saveContent_(id, rec.html);
        byKey[k] = rec;
        added++;
      }
    });
  });

  // Prune stale doc-import rows for Docs we actually processed this run. Two cases:
  //   1. Orphan — the source tab no longer produces that meetingKey (tab deleted,
  //      or re-dated, e.g. a year typo corrected 2568 -> 2569).
  //   2. Exact duplicate — two rows share one meetingKey (a tab was duplicated,
  //      or an earlier buggy sync double-inserted). The key is still "seen", so an
  //      orphan-only check can't catch these; keep one row per key, drop the rest.
  // Never touch manual/fathom rows, nor projects skipped this run (their current
  // state is unknown). Walk highest row index first: deleting a row only shifts
  // rows below it, so the original indices of not-yet-processed rows stay valid,
  // and the surviving row per key is the last one in the sheet — the one byKey
  // refreshed with the current Doc content this run.
  var pruned = 0;
  var keptKey = {};
  var toDelete = [];
  var candidates = existing.filter(function (r) {
    return r.source === 'doc-import' && processedProjects[r.projectId];
  }).sort(function (a, b) { return b._rowIndex - a._rowIndex; });
  candidates.forEach(function (r) {
    var key = r.projectId + '||' + r.meetingKey;
    if (!seenKeys[key] || keptKey[key]) toDelete.push(r);
    else keptKey[key] = true;
  });
  // Content lives in a separate sheet keyed by row id. Duplicate rows can share
  // one id (e.g. an earlier sync copied a row), so only purge a deleted row's
  // content if NO surviving row still uses that id — otherwise we'd wipe the
  // content we just refreshed onto the kept twin, leaving it blank.
  var deletedRowIdx = {};
  toDelete.forEach(function (r) { deletedRowIdx[r._rowIndex] = true; });
  var survivingIds = {};
  existing.forEach(function (r) { if (!deletedRowIdx[r._rowIndex]) survivingIds[r.id] = true; });
  toDelete.forEach(function (r) {
    sheet.deleteRow(r._rowIndex);
    if (!survivingIds[r.id]) { try { deleteContent_(r.id); } catch (e) {} }
    pruned++;
  });

  if (versionStale) props.setProperty('RESKIN_VERSION', RESKIN_VERSION);
  return { docs: docCount, added: added, updated: updated, skipped: skipped, pruned: pruned, total: sheet.getLastRow() - 1 };
}

// DEPRECATED 2026-07-19 — no longer read anywhere. Used to force a clean
// Doc re-import on bump; Docs are no longer the source of truth so this has
// no effect. Left declared only so old row data referencing it, if any,
// doesn't error; safe to delete entirely in a future cleanup.
var SCHEMA_VERSION = '13';

// One-time, self-triggering cleanup for the 2026-07-19 incident: createProject
// used to always make a Google Doc, so the ERP project got one nobody wanted,
// which produced a stale placeholder "Tab 1" Overview row. Runs automatically
// on the next page load (from ensureSeeded_, which already fires on every
// getSessionState call) rather than waiting on an admin to click a diagnostic
// URL — gated by a Script Property so it only ever runs once. Safe to leave in
// permanently; it's a no-op once ERP has no docId (or doesn't exist).
function autoCleanupErpDoc_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('DID_DETACH_ERP_DOC')) return;
  try {
    var extra = getExtraProjects_();
    var proj = extra.filter(function (p) { return p.id === 'ERP'; })[0];
    if (proj && proj.docId) {
      try { DriveApp.getFileById(proj.docId).setTrashed(true); } catch (e) { Logger.log('autoCleanupErpDoc_: trash failed: ' + e); }
      proj.docId = '';
      setExtraProjects_(extra);
      // The stale row is a doc-import row keyed to that Doc's tab — with the
      // Doc now detached, importAllDocs will never touch it again, so remove
      // it directly rather than waiting for a sync that will no longer happen.
      var sheet = getSheet_();
      var rows = readAllRows_();
      var toDelete = rows.filter(function (r) { return r.projectId === 'ERP' && r.source === 'doc-import'; })
        .sort(function (a, b) { return b._rowIndex - a._rowIndex; });
      toDelete.forEach(function (r) { sheet.deleteRow(r._rowIndex); try { deleteContent_(r.id); } catch (e2) {} });
    }
  } catch (e) { Logger.log('autoCleanupErpDoc_ failed: ' + e); }
  props.setProperty('DID_DETACH_ERP_DOC', '1');
}

// DOCS ARE NO LONGER THE SOURCE OF TRUTH (as of 2026-07-19). The Sheet/
// Content store IS the data now — every meeting is edited directly in-app.
// This function used to wipe the Minutes sheet on every SCHEMA_VERSION bump
// and re-import from Google Docs, which would now mean destroying real
// in-app edits with no way back. That entire path is permanently disabled
// below. Do not resurrect Doc importing here — see importAllDocs's own
// deprecation note for why, and detachAllProjectDocs_ for the one-time
// migration that cut the cord.
function ensureSeeded_() {
  try { autoCleanupErpDoc_(); } catch (e) {}
  // Intentionally no-op otherwise: no schema-version wipe, no importAllDocs.
  // The sheet header still needs to track new COLUMNS additions over time —
  // that's handled by ensureColumns_() inside getSheet_(), unrelated to Docs.
}

/* --------------------------------- API ------------------------------------ */

function getUserEmail() {
  try { return Session.getActiveUser().getEmail() || ''; } catch (e) { return ''; }
}

// Admin is deliberately STRICTER than identify_(). Two ways in, both strong:
//   1. the Google account the app is deployed as (googleEmail_), or
//   2. an explicit ADMIN_PASSWORD login (isAdminSessionToken_).
//
// NOT via identify_(): that now also resolves editor sessions created by the
// emailed-code sign-in, so passing it here would mean anyone able to receive
// mail at an address in ADMIN_EMAILS could mint a full-admin session and skip
// ADMIN_PASSWORD entirely. An editor code proves control of a mailbox, which is
// the right bar for editing content — not for managing access, projects and
// API keys.
function isAdmin_(token) {
  return isAdminEmail_(googleEmail_()) || isAdminSessionToken_(token);
}

function isVisible_(r) { return r.visible === 'TRUE' || r.visible === true; }

// Inbox rows (Fathom/Transkriptor staging) are admin-only in every read path,
// so the write paths must match — otherwise an editor holding a meeting id
// from before this rule could still edit or delete a private recording.
// Throws for a non-admin touching an inbox row; silent for everything else.
function assertNotPrivateInbox_(id, token) {
  if (isAdmin_(token)) return;
  var rows = readAllRows_();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === id && isInboxProjectId_(rows[i].projectId)) {
      throw new Error('Not authorized.');
    }
  }
}

/* --------------------- Email allow-list (viewer access) -------------------- */
// Stored in Script Properties so admins can change it with no redeploy.
// Empty list = everyone in the org (vcb-con.com) may view. Non-empty = only those
// emails (plus admins). Note: only works for @vcb-con.com accounts — Apps Script
// cannot see the email of external (e.g. gmail) visitors.

function getAllowedViewers_() {
  try {
    var v = PropertiesService.getScriptProperties().getProperty('ALLOWED_VIEWERS');
    return v ? JSON.parse(v) : [];
  } catch (e) { return []; }
}

function isAllowed_() {
  if (isAdmin_()) return true;
  var list = getAllowedViewers_();
  if (!list.length) return true; // open to the whole org
  var e = (getUserEmail() || '').toLowerCase();
  if (!e) return false;
  return list.some(function (x) { return String(x).toLowerCase() === e; });
}

function getAccess() {
  if (!isAdmin_()) throw new Error('Not authorized.');
  var list = getAllowedViewers_();
  return { viewers: list, admins: ADMIN_EMAILS, restricted: list.length > 0 };
}

function addViewer(email) {
  if (!isAdmin_()) throw new Error('Not authorized.');
  email = String(email || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Please enter a valid email address.');
  var list = getAllowedViewers_();
  if (!list.some(function (x) { return String(x).toLowerCase() === email.toLowerCase(); })) list.push(email);
  PropertiesService.getScriptProperties().setProperty('ALLOWED_VIEWERS', JSON.stringify(list));
  return list;
}

function removeViewer(email) {
  if (!isAdmin_()) throw new Error('Not authorized.');
  var list = getAllowedViewers_().filter(function (x) { return String(x).toLowerCase() !== String(email).toLowerCase(); });
  PropertiesService.getScriptProperties().setProperty('ALLOWED_VIEWERS', JSON.stringify(list));
  return list;
}

function allowEveryoneInOrg() {
  if (!isAdmin_()) throw new Error('Not authorized.');
  PropertiesService.getScriptProperties().deleteProperty('ALLOWED_VIEWERS');
  return [];
}

// DEAD CODE — nothing calls bootAndList() or getBootstrap(). The client boots
// through getPublicBootstrap()/getSessionState() in Auth.js; this pair is a
// leftover from before that split.
//
// DO NOT revive it. getBootstrap() below filters rows on isVisible_ alone,
// with no canSeeProject_ gate, so it predates per-project guest lists and
// would report locked projects and their counts to anyone. Every live read
// path is a two-gate check (the per-meeting visible flag AND the project
// guest list); this is not. Delete it rather than call it.
function bootAndList() {
  if (!isAllowed_()) {
    return {
      denied: true,
      bootstrap: { appTitle: APP_TITLE, appDisplayTitle: APP_DISPLAY_TITLE, subtitle: APP_SUBTITLE, user: getUserEmail(), isAdmin: false, projects: [], total: 0 },
      meetings: []
    };
  }
  ensureSeeded_();
  return { bootstrap: getBootstrap(), meetings: listMeetings() };
}

function getBootstrap() {
  var admin = isAdmin_();
  var allRows = readAllRows_();
  var rows = allRows.filter(function (r) { return admin || isVisible_(r); });
  var counts = {};
  rows.forEach(function (r) { counts[r.projectId] = (counts[r.projectId] || 0) + 1; });
  var projects = SOURCE_DOCS.slice().sort(function (a, b) { return a.order - b.order; })
    .map(function (d) {
      return {
        id: d.id, name: d.name, nameEn: d.nameEn, cadence: d.cadence, color: d.color,
        count: counts[d.id] || 0,
        docUrl: 'https://docs.google.com/document/d/' + d.docId + '/edit'
      };
    });
  return {
    appTitle: APP_TITLE, appDisplayTitle: APP_DISPLAY_TITLE, subtitle: APP_SUBTITLE, user: getUserEmail(),
    isAdmin: admin, projects: projects, total: rows.length,
    hiddenTotal: admin ? (allRows.length - rows.length) : 0,
    dbUrl: admin ? getDb_().getUrl() : '',
    execUrl: getExecUrl_()
  };
}

// The web app URL, in the org-scoped form so shared links open as the right account.
function getExecUrl_() {
  // The app is published for ANYONE_ANONYMOUS, so share links must always be the
  // plain /macros/s/.../exec form. ScriptApp.getService().getUrl() does NOT
  // reliably return that form on its own — for a request from a signed-in
  // vcb-con.com Workspace account it comes back domain-scoped instead
  // (https://script.google.com/a/vcb-con.com/macros/s/.../exec), even though the
  // deployment's access setting is "Anyone." A domain-scoped link only opens for
  // people signed into that Workspace, so anyone outside it (or the same person
  // signed into a different Google account) hits a dead end. Strip the /a/<domain>
  // segment unconditionally so every share link — meeting or project — is the
  // portable form that opens for anyone, regardless of which account generated it.
  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) { url = ''; }
  return url.replace(/\/a\/[^/]+\/macros\//, '/macros/');
}

function listMeetings(token) {
  // identify_, not googleEmail_: under this deployment Google hides the
  // visitor email, so a named viewer is only recognisable through their own
  // session token. Reading googleEmail_() here would identify every guest as
  // nobody and hide the very projects they were named on.
  var email = identify_(token);
  var admin = isAdmin_(token);
  var canSee = projectVisibilityFor_(email);
  var out = [];
  // The Fathom/Transkriptor inboxes are the admin's private staging area, so
  // an UNFILED recording is admin-only. Filing it into a project publishes it
  // (setFathomTag sets visible=TRUE), and from then on it must reach that
  // project's audience — the row itself never leaves the inbox, so gating on
  // projectId alone silently hid every filed recording from everyone but an
  // admin, however public its project was.
  readAllRows_().filter(function (r) {
    if (isInboxProjectId_(r.projectId)) {
      if (admin) return true;
      // A filed recording reaches people through the projects it was tagged
      // into, so it is readable only if at least one of those is open to them.
      var tags = parseTaggedProjectIds_(r.taggedProjectId);
      return tags.length > 0 && isVisible_(r) && tags.some(canSee);
    }
    // Two gates now, not one. isVisible_ is the per-MEETING switch (an admin
    // hiding a single row); canSee is the per-PROJECT guest list. A meeting
    // must clear both, or naming three people on a locked project would still
    // have left it readable by anyone who opened the app link.
    return admin || (isVisible_(r) && canSee(r.projectId));
  }).forEach(function (r) {
    var att = [];
    try { att = r.attendees ? JSON.parse(r.attendees) : []; } catch (e) { att = []; }
    var base = {
      id: r.id, title: r.title, kind: r.kind,
      date: r.date, dateLabel: r.dateLabel, time: r.time,
      pinned: r.pinned === 'TRUE' || r.pinned === true,
      visible: isVisible_(r),
      hasFathom: !!r.fathomUrl, source: r.source,
      attendeeCount: att.length, attendees: att, excerpt: r.excerpt,
      attachmentCount: parseAttachments_(r.attachments).length
    };
    // Fathom rows always stay listed under FATHOM_INBOX (the row never moves),
    // and ADDITIONALLY appear under every project it's tagged into (can be
    // more than one) — same id in each place, so opening any entry shows the
    // same content. This is why the row is duplicated in this list rather
    // than reassigned in place. The inbox copy is admin-only: a published
    // recording reaches everyone else through its tagged-project copies, so
    // non-admins never see the inbox itself in their project list.
    if (admin || !isInboxProjectId_(r.projectId)) {
      out.push(Object.assign({}, base, { projectId: r.projectId }));
    }
    parseTaggedProjectIds_(r.taggedProjectId).forEach(function (pid) {
      out.push(Object.assign({}, base, { projectId: pid, taggedFromInbox: true }));
    });
  });
  return out;
}

// taggedProjectId cell holds a comma-separated list (a recording can be
// tagged into more than one project). '' -> [].
function parseTaggedProjectIds_(cell) {
  return String(cell || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}
function formatTaggedProjectIds_(list) {
  return list.filter(Boolean).join(',');
}

// Full-content search: listMeetings() only sends title/dateLabel/excerpt (the
// first 200 chars) to the client, so a name or term buried deeper in a
// transcript/summary/Doc body — or an attendee not mentioned in the excerpt —
// never matched. This runs server-side against the full stored HTML +
// attendee emails, so the client can merge in matches the client-side filter
// alone would miss. Returns just the ids that match (client already has the
// rest of each meeting's metadata from listMeetings).
function searchMeetings(query, token) {
  var q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  var admin = isAdmin_(token);
  var canSee = projectVisibilityFor_(identify_(token));
  var matches = [];
  // Same rule as listMeetings: an UNFILED inbox recording is admin-only, so a
  // search can't surface an unreviewed recording's title or transcript, but a
  // recording already filed into a project is published content and must be
  // findable by that project's audience.
  readAllRows_().filter(function (r) {
    if (isInboxProjectId_(r.projectId)) {
      if (admin) return true;
      var tags = parseTaggedProjectIds_(r.taggedProjectId);
      return tags.length > 0 && isVisible_(r) && tags.some(canSee);
    }
    // Same two gates as listMeetings. Search reads the FULL stored body, so
    // leaving the project gate out here would let anyone pull sentences out
    // of a locked project's transcripts just by guessing a search term.
    return admin || (isVisible_(r) && canSee(r.projectId));
  }).forEach(function (r) {
    var hay = (r.title + ' ' + (r.dateLabel || '') + ' ' + (r.attendees || '')).toLowerCase();
    if (hay.indexOf(q) === -1) hay += ' ' + stripTags_(getContent_(r.id)).toLowerCase();
    if (hay.indexOf(q) === -1) return;
    matches.push(r.id); // id alone is enough — client matches against it regardless of which listMeetings() copy (inbox vs. tagged project) is showing
  });
  return matches;
}

function getMeeting(id, token) {
  var admin = isAdmin_(token);
  var rows = readAllRows_();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === id) {
      var r = rows[i];
      // Hidden meetings stay admin-only. Inbox rows are admin-only too, even
      // for editors and even once published — the admin's staging area can
      // hold private recordings, so an inbox row is only readable by others
      // after it has been tagged into a project AND published.
      if (!admin && !isVisible_(r)) return null;
      if (!admin && isInboxProjectId_(r.projectId) && !parseTaggedProjectIds_(r.taggedProjectId).length) return null;
      // The project guest list, applied to the direct-open path as well.
      // Without this a locked project stayed one shared link away from
      // anybody — the list would have governed what people SAW in the app
      // while doing nothing about what they could open.
      if (!admin) {
        var canSeeOne = projectVisibilityFor_(identify_(token));
        var reach = isInboxProjectId_(r.projectId)
          ? parseTaggedProjectIds_(r.taggedProjectId).some(canSeeOne)
          : canSeeOne(r.projectId);
        if (!reach) return null;
      }
      var doc = getDocById_(r.projectId);
      var att = [];
      try { att = r.attendees ? JSON.parse(r.attendees) : []; } catch (e) { att = []; }
      var attachments = parseAttachments_(r.attachments).map(function (a) {
        return {
          fileId: a.fileId, name: a.name, mimeType: a.mimeType, size: a.size,
          uploadedAt: a.uploadedAt, uploadedBy: admin ? a.uploadedBy : '',
          // /file/d/<id>/view — the exact URL format Drive's own "Get link"
          // button generates — not uc?export=download (2026-07-22 change).
          // The old export=download URL sometimes forced a Google sign-in
          // interstitial even for files explicitly shared as "Anyone with
          // the link", especially for larger files or ones past Drive's
          // automated virus-scan size threshold. /view is what link-sharing
          // is actually guaranteed to work with — since the goal is letting
          // everyone open the attachment (no login), not forcing a raw
          // download, this is the right trade: one extra click to actually
          // download from the preview page beats a login wall for viewing.
          url: 'https://drive.google.com/file/d/' + a.fileId + '/view'
        };
      });
      return {
        id: r.id, projectId: r.projectId, title: r.title, kind: r.kind,
        date: r.date, dateLabel: r.dateLabel, time: r.time,
        pinned: r.pinned === 'TRUE' || r.pinned === true,
        visible: isVisible_(r),
        taggedProjectIds: parseTaggedProjectIds_(r.taggedProjectId),
        fathomUrl: r.fathomUrl, source: r.source, attendees: att,
        attachments: attachments,
        comments: parseComments_(r.comments),
        html: getContent_(r.id), css: '',
        docUrl: doc && doc.docId ? ('https://docs.google.com/document/d/' + doc.docId + '/edit' + (r.tabId ? ('?tab=' + r.tabId) : '')) : '',
        projectName: doc ? doc.name : r.projectId,
        createdAt: r.createdAt, updatedAt: r.updatedAt
      };
    }
  }
  return null;
}

function togglePin(id, token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  var sheet = getSheet_();
  var rows = readAllRows_();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === id) {
      var newVal = (rows[i].pinned === 'TRUE' || rows[i].pinned === true) ? '' : 'TRUE';
      sheet.getRange(rows[i]._rowIndex, COLUMNS.indexOf('pinned') + 1).setValue(newVal);
      return newVal === 'TRUE';
    }
  }
  return false;
}

function setVisibility(id, visible, token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  var sheet = getSheet_();
  var rows = readAllRows_();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === id) {
      sheet.getRange(rows[i]._rowIndex, COLUMNS.indexOf('visible') + 1).setValue(visible ? 'TRUE' : '');
      auditLog_(visible ? 'publish' : 'hide', 'meeting', id, { title: rows[i].title });
      return !!visible;
    }
  }
  return false;
}

/* ------------------------- Admin: create a project ------------------------- */
// A palette to auto-assign new projects a distinct-looking color without
// asking the admin to pick a hex code. Cycles if more projects are added than
// colors listed.
var NEW_PROJECT_COLORS = ['#0969da', '#8250df', '#1a7f37', '#9a6700', '#cf222e', '#0b3d62', '#6639ba', '#116329'];

// Creates a brand-new project as a lightweight TAG-ONLY bucket — no Google
// Doc, nothing to sync. It exists purely so meetings (Fathom recordings via
// setFathomTag, or manually via saveMeeting) can be filed under it; it shows
// up in the sidebar/counts identically to the original 5 projects, it's just
// not backed by a Doc, so importAllDocs silently skips it (docId is '').
// Stores the definition in the EXTRA_PROJECTS script property (see Config.js
// getAllProjects_).
//
// A previous version of this function always created a Doc, mirroring how
// the original 5 projects work — that was wrong for this use case (found
// 2026-07-19: an admin used "+ New project" purely as a Fathom tag bucket and
// got a surprise Google Doc they never wanted, sitting in their Drive with no
// visible link from the app). Do not reintroduce Doc creation here without a
// deliberate opt-in — a tag-only bucket must never come with side effects the
// admin didn't ask for.
function createProject(name, nameEn, cadence, token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  name = String(name || '').trim();
  if (!name) throw new Error('Project name is required.');
  nameEn = String(nameEn || '').trim();
  cadence = String(cadence || 'Monthly').trim() || 'Monthly';

  var all = getAllProjects_();
  // Prefer the English name for the internal id (matches how FIN/BD/BT12/BV/
  // PN34 were derived) — a Thai-only name strips to nothing and would produce
  // a useless generic id, so fall back to a counter-based id in that case.
  var id = slugifyProjectId_(nameEn || name, all);

  var color = NEW_PROJECT_COLORS[all.length % NEW_PROJECT_COLORS.length];
  var order = all.reduce(function (max, p) { return Math.max(max, p.order || 0); }, 0) + 1;
  var extra = getExtraProjects_();
  extra.push({ id: id, docId: '', name: name, nameEn: nameEn, cadence: cadence, color: color, order: order });
  setExtraProjects_(extra);
  auditLog_('create_project', 'project', id, { name: name });

  return { id: id, docId: '', name: name, nameEn: nameEn, cadence: cadence, color: color, order: order, docUrl: '' };
}

// Renames/edits a project — works for ANY project, including the original
// hardcoded 5 (FIN/BD/BT12/BV/PN34), by writing to PROJECT_OVERRIDES rather
// than touching Config.js. Only non-empty fields in the patch are applied;
// omit a field to leave it unchanged. Does not touch the underlying Doc.
function renameProject(projectId, patch, token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  if (!getDocById_(projectId)) throw new Error('Unknown project: ' + projectId);
  var clean = {};
  if (patch && typeof patch.name === 'string' && patch.name.trim()) clean.name = patch.name.trim();
  if (patch && typeof patch.nameEn === 'string') clean.nameEn = patch.nameEn.trim();
  if (patch && typeof patch.cadence === 'string' && patch.cadence.trim()) clean.cadence = patch.cadence.trim();
  if (patch && typeof patch.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(patch.color)) clean.color = patch.color;
  setProjectOverride_(projectId, clean);
  auditLog_('rename_project', 'project', projectId, clean);
  return getDocById_(projectId);
}

// One-off cleanup: detaches a runtime-created project from its Doc (sets
// docId to '', making it a tag-only bucket) and moves that Doc to Trash
// (recoverable, not permanently deleted). Written for the 2026-07-19 incident
// where createProject used to always make a Doc — ERP got one nobody wanted.
// Admin-only, callable via ?seed=detachprojectdoc&id=<projectId> on the live
// URL (see doGet) since this needs to run against real Drive/Script Properties.
function detachProjectDoc(projectId, token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  var extra = getExtraProjects_();
  var proj = extra.filter(function (p) { return p.id === projectId; })[0];
  if (!proj) throw new Error('Not a runtime-created project (or already detached): ' + projectId);
  var docId = proj.docId;
  if (!docId) return { ok: true, note: 'already had no Doc', docId: '' };
  try { DriveApp.getFileById(docId).setTrashed(true); }
  catch (e) { return { ok: false, error: 'Could not trash Doc ' + docId + ': ' + String(e) }; }
  proj.docId = '';
  setExtraProjects_(extra);
  return { ok: true, trashedDocId: docId };
}

// Turns a project name into a short, unique, uppercase-ish id in the same
// style as the hardcoded ones (FIN, BT12, ...) — first letters of each word,
// falling back to a numeric suffix if that collides with an existing id.
function slugifyProjectId_(name, existingProjects) {
  var ascii = name.replace(/[^\x00-\x7F]/g, ''); // strip non-Latin (e.g. Thai) — id is internal only
  var words = ascii.split(/[\s\-_]+/).filter(Boolean);
  var base = (words.length > 1 ? words.map(function (w) { return w[0]; }).join('') : ascii.slice(0, 4))
    .toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!base) base = 'PROJ';
  var existingIds = {};
  existingProjects.forEach(function (p) { existingIds[p.id] = true; });
  if (!existingIds[base]) return base;
  var n = 2;
  while (existingIds[base + n]) n++;
  return base + n;
}

// Admin action: tag an inbox recording (Fathom or Transkriptor) so it ALSO
// shows up under a real project's meeting list — without ever moving or
// duplicating the underlying row. projectId always stays FATHOM_INBOX/
// TRANSKRIPTOR_INBOX; only taggedProjectId changes. A recording can be tagged
// into more than one project (e.g. a joint meeting) — this ADDS to the
// existing list rather than replacing it. The inbox count/list is always
// permanent (never shrinks as you tag things), each tag is independently
// reversible (untagFathomMeeting), and there is exactly one copy of the
// content at all times regardless of how many projects it's tagged into.
function setFathomTag(id, projectId, token) {
  // Admin-only: filing a recording out of the private inbox is the step that
  // exposes it to other people, so it stays with whoever owns the inbox.
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  if (!getDocById_(projectId)) throw new Error('Unknown project: ' + projectId);
  var sheet = getSheet_();
  var rows = readAllRows_();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === id) {
      if (rows[i].projectId !== FATHOM_INBOX_ID && rows[i].projectId !== TRANSKRIPTOR_INBOX_ID) {
        throw new Error('Only inbox recordings can be tagged.');
      }
      var list = parseTaggedProjectIds_(rows[i].taggedProjectId);
      if (list.indexOf(projectId) === -1) list.push(projectId);
      sheet.getRange(rows[i]._rowIndex, COLUMNS.indexOf('taggedProjectId') + 1).setValue(formatTaggedProjectIds_(list));
      // Filing a recording into a project IS the act of publishing it: anyone
      // who can see that project can now read it. There is no separate
      // "visible to staff" switch — visibility follows the filing, so the two
      // can never disagree (which is how a meeting could previously be filed
      // but still invisible, or hidden yet reachable).
      sheet.getRange(rows[i]._rowIndex, COLUMNS.indexOf('visible') + 1).setValue('TRUE');
      sheet.getRange(rows[i]._rowIndex, COLUMNS.indexOf('updatedAt') + 1).setValue(new Date().toISOString());
      auditLog_('tag', 'meeting', id, { projectId: projectId });
      return list;
    }
  }
  return false;
}

// Reverses setFathomTag for ONE project — removes just that project from the
// tag list, leaving any other tags on the recording untouched. The row was
// never moved, so this is a pure metadata edit.
function untagFathomMeeting(id, projectId, token) {
  // Admin-only, mirroring setFathomTag.
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  var sheet = getSheet_();
  var rows = readAllRows_();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === id) {
      var list = parseTaggedProjectIds_(rows[i].taggedProjectId).filter(function (p) { return p !== projectId; });
      sheet.getRange(rows[i]._rowIndex, COLUMNS.indexOf('taggedProjectId') + 1).setValue(formatTaggedProjectIds_(list));
      // The mirror of tagging: an inbox recording that is no longer filed
      // anywhere goes back to being private. Rows that live in a real project
      // (not an inbox) keep their visibility — they are not staged content.
      if (isInboxProjectId_(rows[i].projectId) && !list.length) {
        sheet.getRange(rows[i]._rowIndex, COLUMNS.indexOf('visible') + 1).setValue('');
      }
      sheet.getRange(rows[i]._rowIndex, COLUMNS.indexOf('updatedAt') + 1).setValue(new Date().toISOString());
      auditLog_('untag', 'meeting', id, { projectId: projectId });
      return list;
    }
  }
  return false;
}

/* --------------------------- Fathom webhook admin --------------------------- */
// One-time (or re-run-as-needed) setup calls — run these from the Apps Script
// editor's function picker, not from the web app UI. They talk to Fathom's API
// using the key you paste into Script Properties as FATHOM_API_KEY.
var PROP_FATHOM_API_KEY = 'FATHOM_API_KEY';

// Registers a web app URL as a Fathom webhook destination for your own
// recordings, requesting summary+action_items on each delivery. Deliberately
// does NOT request the transcript (per explicit instruction 2026-07-21) —
// meetings only ever need the AI summary, not the full raw transcript.
// Run once from the editor after setting FATHOM_API_KEY in Script Properties
// (Project Settings > Script Properties). MUST be called with the actual LIVE
// deployment /exec URL (getExecUrl_() returns the editor's dev-mode URL when
// run from here, not the live one — running doGet from the editor is a
// different deployment than what real users hit). Logs the response, which
// includes Fathom's webhook id (needed if you ever want to delete it later).
function registerFathomWebhook(liveExecUrl) {
  var apiKey = PropertiesService.getScriptProperties().getProperty(PROP_FATHOM_API_KEY);
  if (!apiKey) throw new Error('Set ' + PROP_FATHOM_API_KEY + ' in Script Properties first.');
  if (!liveExecUrl || liveExecUrl.indexOf('/exec') === -1) {
    throw new Error('Pass the live deployment URL, e.g. registerFathomWebhook("https://script.google.com/macros/s/AKfycb.../exec")');
  }
  var payload = {
    destination_url: liveExecUrl,
    triggered_for: ['my_recordings'],
    include_summary: true,
    include_action_items: true
  };
  var resp = UrlFetchApp.fetch('https://api.fathom.ai/external/v1/webhooks', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Api-Key': apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  Logger.log('Fathom webhook registration (' + resp.getResponseCode() + '): ' + resp.getContentText());
  return resp.getContentText();
}

// No-argument wrapper so this can be run directly from the Apps Script editor's
// function picker (which can't pass parameters) — run this one, not
// registerFathomWebhook itself. Hardcodes the LIVE deployment URL; update this
// literal if the live deployment ID ever changes (see PROJECT_SUMMARY.md).
function registerFathomWebhookLive() {
  return registerFathomWebhook('https://script.google.com/macros/s/AKfycbxJN7olKBYqGHlaWXiVOI41fh8oZJ9lRstXZAj1DFVeiynyvfBf48xaKX5p4D19rUnr/exec');
}

/* ------------------ Fathom historical backfill (one-time) ------------------ */
// Fathom's public API docs render as a JS app we couldn't scrape for the exact
// list-meetings response schema, so run this PROBE first (Apps Script editor >
// pick probeFathomMeetingsApi_ > Run) and read its Execution log: it logs the
// raw JSON Fathom actually returns for one page of meetings. Confirm the real
// field names there before trusting backfillFathomMeetings' parsing below.
function probeFathomMeetingsApi_() {
  var apiKey = PropertiesService.getScriptProperties().getProperty(PROP_FATHOM_API_KEY);
  if (!apiKey) throw new Error('Set ' + PROP_FATHOM_API_KEY + ' in Script Properties first.');
  var resp = UrlFetchApp.fetch('https://api.fathom.ai/external/v1/meetings?include_summary=true&include_action_items=true',
    { method: 'get', headers: { 'X-Api-Key': apiKey }, muteHttpExceptions: true });
  Logger.log('Probe (' + resp.getResponseCode() + '): ' + resp.getContentText().slice(0, 4000));
  return resp.getContentText();
}

// Pulls ALL historical Fathom recordings (not just future webhook deliveries)
// into FATHOM_INBOX, admin-only, same as the webhook path — per your explicit
// call: every recording lands in the inbox for manual review/filing, NEVER
// auto-matched to a project (matching by title/date risks leaking a
// confidential meeting's content into the wrong project's visibility scope).
//
// forceRefresh=false (default): skips any recording_id already present as a
// fathom-* row — safe to re-run for picking up NEW recordings only.
// forceRefresh=true: re-parses and overwrites existing fathom-* rows in place
// (same id, same project/visible/pinned) — use after fixing the parser (e.g.
// the 2026-07-17 default_summary fix) to refresh already-imported content
// without creating duplicates or losing rows already filed into a project.
function backfillFathomMeetings(forceRefresh) {
  var apiKey = PropertiesService.getScriptProperties().getProperty(PROP_FATHOM_API_KEY);
  if (!apiKey) throw new Error('Set ' + PROP_FATHOM_API_KEY + ' in Script Properties first.');

  var existing = readAllRows_();
  var byKey = {};
  existing.forEach(function (r) { if (r.source === 'fathom') byKey[r.meetingKey] = r; });
  var deletedKeys = getDeletedInboxKeys_();

  var cursor = '', imported = 0, refreshed = 0, skipped = 0, pages = 0;
  do {
    var url = 'https://api.fathom.ai/external/v1/meetings?include_summary=true&include_action_items=true'
      + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
    var resp = UrlFetchApp.fetch(url, { method: 'get', headers: { 'X-Api-Key': apiKey }, muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) {
      Logger.log('backfillFathomMeetings: HTTP ' + resp.getResponseCode() + ' — ' + resp.getContentText());
      break;
    }
    var data = JSON.parse(resp.getContentText());
    // Confirmed 2026-07-17 against a real response: items live under "items"
    // wrapping {recording: {...}} objects. Kept the meetings/data/bare-array
    // fallbacks in case Fathom's shape varies by endpoint version.
    var items = data.items || data.meetings || data.data || (Array.isArray(data) ? data : []);
    items.forEach(function (item) {
      var rec = item.recording || item;
      var recordingId = String(rec.recording_id || rec.id || '');
      var key = 'fathom-' + recordingId;
      if (!recordingId) { skipped++; return; }
      if (deletedKeys[key]) { skipped++; return; } // deliberately deleted in-app — never re-import
      var already = byKey[key];
      if (already && !forceRefresh) { skipped++; return; }
      var payload = JSON.stringify({ recording: rec });
      logFathomRaw_(JSON.stringify(rec), already ? 'backfill-refresh' : 'backfill');
      ingestFathomPayload_(payload, already || null);
      if (already) refreshed++; else imported++;
      byKey[key] = already || { meetingKey: key }; // mark seen even without re-reading the sheet
    });
    cursor = data.next_cursor || data.cursor || '';
    pages++;
  } while (cursor && pages < 20);

  var summary = { imported: imported, refreshed: refreshed, skipped: skipped, pages: pages };
  Logger.log('backfillFathomMeetings done: ' + JSON.stringify(summary));
  return summary;
}

// No-argument wrapper so the force-refresh mode can be run from the Apps
// Script editor's function picker (which can't pass parameters).
function refreshFathomMeetings() {
  return backfillFathomMeetings(true);
}

// Wrapper for the hourly time-trigger below — always import-new-only
// (forceRefresh=false), never re-parses/overwrites already-imported rows.
// This is a BACKSTOP, not the primary intake path: Fathom deliveries normally
// arrive instantly via the doPost webhook + processFathomQueue_ (see above).
// But that whole path silently stops working if the 1-minute queue trigger
// gets deleted, Apps Script drops it (redeploys sometimes do this), or
// Fathom's webhook registration goes stale — and there's no alert when that
// happens, just a Fathom Inbox that quietly stops growing (2026-08-03
// incident: inbox stalled days behind with no error anywhere). This hourly
// poll hits Fathom's own API directly, the same way backfillFathomMeetings
// always has, so new recordings show up within the hour even if the webhook
// path is completely dead.
function pollFathomMeetings_() {
  try {
    var r = backfillFathomMeetings(false);
    Logger.log('pollFathomMeetings_ (trigger): ' + JSON.stringify(r));
  } catch (err) {
    Logger.log('pollFathomMeetings_ (trigger) failed: ' + (err && err.stack || err));
  }
}

// One-time setup: installs an hourly time-driven trigger that keeps the
// Fathom Inbox up to date even if the webhook/queue path (doPost +
// processFathomQueue_) stops working for any reason. Run ONCE from the Apps
// Script editor's function picker (trigger creation needs to run as your real
// Google account, same reason ensureFathomQueueTrigger_ does). Safe to
// re-run: clears any existing pollFathomMeetings_ trigger first so re-running
// this never stacks up duplicate triggers.
function installFathomPollTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'pollFathomMeetings_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('pollFathomMeetings_').timeBased().everyHours(1).create();
  return { ok: true, note: 'Hourly Fathom poll trigger installed (backstop for the webhook path).' };
}

// Removes the hourly poll trigger (e.g. if you want to go back to
// webhook-only intake).
function uninstallFathomPollTrigger() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'pollFathomMeetings_') { ScriptApp.deleteTrigger(t); removed++; }
  });
  return { ok: true, removed: removed };
}

/* ------------------------ Transkriptor polling intake ----------------------- */
// Transkriptor has no webhook support (unlike Fathom) — this is a pure polling
// pull, same shape as backfillFathomMeetings. Confirmed 2026-07-20 against the
// real API:
//   GET https://api.tor.app/developer/files
//     -> [{ file_id, file_name, parent_folder_id, order_id, created_at, status, minutes }, ...]
//   GET https://api.tor.app/developer/transcription/summary?order_id=...
//     -> { success, order_id, summary_url }  (summary_url is a presigned S3 link,
//        NOT the summary itself — must be fetched separately, no auth header needed)
//   GET <summary_url>
//     -> [{ section_title, section_content }, ...]  (section_content is Markdown)
// Every recording lands in TRANSKRIPTOR_INBOX, admin-only, exactly like Fathom —
// never auto-matched to a project (same reasoning as Fathom: matching by
// title/date risks leaking a confidential meeting into the wrong project's
// visibility scope). File into a project manually via setFathomTag (shared
// with Fathom Inbox rows — see the generalized inbox-id check there).
var PROP_TRANSKRIPTOR_API_KEY = 'TRANSKRIPTOR_API_KEY';

// One-time setup: stores the API key in Script Properties (never in source).
// Admin-only, callable via ?seed=settranskriptorkey&key=... on the live URL.
function setTranskriptorApiKey(key, token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  key = String(key || '').trim();
  if (!key) throw new Error('Key is required.');
  PropertiesService.getScriptProperties().setProperty(PROP_TRANSKRIPTOR_API_KEY, key);
  return { ok: true };
}

// Only recordings with status "Completed" have a usable summary — "Processing"
// isn't ready yet and "Failed" never will be, so both are skipped every run
// (not treated as an error — just not-yet-importable).
function backfillTranskriptorMeetings(forceRefresh) {
  var apiKey = PropertiesService.getScriptProperties().getProperty(PROP_TRANSKRIPTOR_API_KEY);
  if (!apiKey) throw new Error('Set ' + PROP_TRANSKRIPTOR_API_KEY + ' in Script Properties first (see setTranskriptorApiKey).');

  var existing = readAllRows_();
  var byKey = {};
  existing.forEach(function (r) { if (r.source === 'transkriptor') byKey[r.meetingKey] = r; });
  var deletedKeys = getDeletedInboxKeys_();

  var resp = UrlFetchApp.fetch('https://api.tor.app/developer/files', {
    method: 'get',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Accept': 'application/json' },
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200) {
    throw new Error('Transkriptor list failed: HTTP ' + resp.getResponseCode() + ' — ' + resp.getContentText().slice(0, 500));
  }
  var files = JSON.parse(resp.getContentText());
  if (!Array.isArray(files)) files = [];

  var imported = 0, refreshed = 0, skipped = 0, notReady = 0;
  files.forEach(function (f) {
    var orderId = String(f.order_id || '');
    if (!orderId) { skipped++; return; }
    var key = 'transkriptor-' + orderId;
    if (deletedKeys[key]) { skipped++; return; } // deliberately deleted in-app — never re-import
    var already = byKey[key];
    if (already && !forceRefresh) { skipped++; return; }
    if (f.status !== 'Completed') { notReady++; return; }

    var sections;
    try {
      sections = fetchTranskriptorSummary_(orderId, apiKey);
    } catch (err) {
      Logger.log('backfillTranskriptorMeetings: summary fetch failed for ' + orderId + ' — ' + err);
      skipped++;
      return;
    }
    if (!sections || !sections.length) { skipped++; return; }

    var title = f.file_name || 'Transkriptor recording';
    var createdMs = Number(f.created_at) || Date.now();
    var d = new Date(createdMs);
    var iso = isNaN(d.getTime()) ? '' : Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd');
    var html = transkriptorRecordToHtml_(sections);
    var attendees = extractAttendees_(html);
    var sheet = getSheet_();
    var now = new Date().toISOString();

    if (already) {
      var merged = {
        id: already.id, projectId: already.projectId, meetingKey: already.meetingKey,
        date: iso, dateLabel: isoToLabel_(iso) || title, time: extractTime_(title) || '',
        title: title, kind: 'meeting',
        excerpt: stripTags_(html).slice(0, 200), fathomUrl: '',
        attendees: JSON.stringify(attendees), tabId: '', source: 'transkriptor',
        visible: already.visible, pinned: already.pinned,
        taggedProjectId: already.taggedProjectId, attachments: already.attachments,
        createdAt: already.createdAt || now, updatedAt: now
      };
      sheet.getRange(already._rowIndex, 1, 1, COLUMNS.length).setValues([rowFromObject_(merged)]);
      saveContent_(already.id, html, false, { title: already.title, dateLabel: already.dateLabel, time: already.time });
      refreshed++;
    } else {
      var id = Utilities.getUuid();
      var rec = {
        id: id, projectId: TRANSKRIPTOR_INBOX_ID, meetingKey: key,
        date: iso, dateLabel: title, time: extractTime_(title) || '',
        title: title, kind: 'meeting',
        excerpt: stripTags_(html).slice(0, 200), fathomUrl: '',
        attendees: JSON.stringify(attendees), tabId: '', source: 'transkriptor',
        visible: '', pinned: '', createdAt: now, updatedAt: now
      };
      sheet.appendRow(rowFromObject_(rec));
      saveContent_(id, html);
      imported++;
    }
    byKey[key] = already || { meetingKey: key };
  });

  var summary = { imported: imported, refreshed: refreshed, skipped: skipped, notReady: notReady, total: files.length };
  Logger.log('backfillTranskriptorMeetings done: ' + JSON.stringify(summary));
  return summary;
}

// Resolves one order_id's summary: first call gets a presigned S3 URL, second
// call (no auth header — it's a plain signed S3 GET) fetches the actual JSON.
function fetchTranskriptorSummary_(orderId, apiKey) {
  var resp = UrlFetchApp.fetch(
    'https://api.tor.app/developer/transcription/summary?order_id=' + encodeURIComponent(orderId),
    { method: 'get', headers: { 'Authorization': 'Bearer ' + apiKey, 'Accept': 'application/json' }, muteHttpExceptions: true }
  );
  if (resp.getResponseCode() !== 200) return null;
  var data = JSON.parse(resp.getContentText());
  if (!data || !data.summary_url) return null;
  var summaryResp = UrlFetchApp.fetch(data.summary_url, { method: 'get', muteHttpExceptions: true });
  if (summaryResp.getResponseCode() !== 200) return null;
  var sections = JSON.parse(summaryResp.getContentText());
  return Array.isArray(sections) ? sections : [];
}

// No-argument wrapper so the force-refresh mode can be run from the Apps
// Script editor's function picker (which can't pass parameters).
function refreshTranskriptorMeetings() {
  return backfillTranskriptorMeetings(true);
}

// Wrapper for the hourly time-trigger below — always import-new-only
// (forceRefresh=false), never re-parses/overwrites already-imported rows.
function pollTranskriptorMeetings_() {
  try {
    var r = backfillTranskriptorMeetings(false);
    Logger.log('pollTranskriptorMeetings_ (trigger): ' + JSON.stringify(r));
  } catch (err) {
    Logger.log('pollTranskriptorMeetings_ (trigger) failed: ' + (err && err.stack || err));
  }
}

// One-time setup: installs an hourly time-driven trigger that keeps
// Transkriptor Inbox up to date automatically (Transkriptor has no webhook,
// unlike Fathom — this is the only way new recordings show up without someone
// manually re-running a backfill). Run ONCE from the Apps Script editor's
// function picker (not via the web app — trigger creation needs to run as
// your real Google account, same reason the API key setup does). Safe to
// re-run: clears any existing pollTranskriptorMeetings_ trigger first so
// re-running this never stacks up duplicate triggers.
function installTranskriptorPollTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'pollTranskriptorMeetings_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('pollTranskriptorMeetings_').timeBased().everyHours(1).create();
  return { ok: true, note: 'Hourly Transkriptor poll trigger installed.' };
}

// Removes the hourly poll trigger (e.g. if you want to go back to manual-only).
function uninstallTranskriptorPollTrigger() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'pollTranskriptorMeetings_') { ScriptApp.deleteTrigger(t); removed++; }
  });
  return { ok: true, removed: removed };
}

function saveMeeting(obj, token) {
  if (!isEditorOrAdmin_(token)) throw new Error('Not authorized.');
  setActor_(token);   // so the audit log names the editor, not '(anonymous)'
  if (obj && obj.id) assertNotPrivateInbox_(obj.id, token);
  var sheet = getSheet_();
  var now = new Date().toISOString();
  var iso = parseDateLabel_(obj.dateLabel || '');
  var html = chipifyDriveLinks_(linkifyEmails_(obj.html || ''));
  var attendees = JSON.stringify(extractAttendees_(html));
  if (obj.id) {
    var rows = readAllRows_();
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].id === obj.id) {
        var prior = rows[i];
        var merged = {
          id: prior.id, projectId: obj.projectId || prior.projectId, meetingKey: prior.meetingKey,
          date: iso || prior.date, dateLabel: obj.dateLabel || prior.dateLabel,
          time: obj.time || prior.time, title: obj.title || prior.title,
          kind: prior.kind || 'meeting', excerpt: stripTags_(html).slice(0, 200),
          fathomUrl: obj.fathomUrl || prior.fathomUrl, attendees: attendees,
          source: prior.source === 'doc-import' ? 'doc-import' : (obj.source || prior.source || 'manual'),
          visible: prior.visible, pinned: prior.pinned, taggedProjectId: prior.taggedProjectId,
          attachments: prior.attachments, createdAt: prior.createdAt || now, updatedAt: now
        };
        sheet.getRange(prior._rowIndex, 1, 1, COLUMNS.length).setValues([rowFromObject_(merged)]);
        var versionSeq = saveContent_(prior.id, html, false, { title: prior.title, dateLabel: prior.dateLabel, time: prior.time });
        auditLog_('edit_meeting', 'meeting', prior.id, { title: merged.title, versionSeq: versionSeq });
        return prior.id;
      }
    }
  }
  var id = Utilities.getUuid();
  var rec = {
    id: id, projectId: obj.projectId, meetingKey: 'manual-' + Date.now(), date: iso,
    dateLabel: obj.dateLabel || '', time: obj.time || '', title: obj.title || 'Untitled meeting',
    kind: 'meeting', excerpt: stripTags_(html).slice(0, 200), fathomUrl: obj.fathomUrl || '',
    attendees: attendees, source: obj.source || 'manual',
    // A meeting created directly INTO a project is published by that act, the
    // same rule tagging follows (see setFathomTag). Only rows created in an
    // inbox start hidden, because an inbox is the private staging area.
    // Previously this defaulted to hidden and relied on a "Visible to staff"
    // button to publish; that button is gone, so defaulting to hidden left
    // every new meeting invisible to everyone but an admin.
    visible: isInboxProjectId_(obj.projectId) ? '' : 'TRUE',
    pinned: '', createdAt: now, updatedAt: now
  };
  sheet.appendRow(rowFromObject_(rec));
  saveContent_(id, html);
  auditLog_('create_meeting', 'meeting', id, { title: rec.title, projectId: rec.projectId });
  return id;
}

function deleteMeeting(id, token) {
  if (!isEditorOrAdmin_(token)) throw new Error('Not authorized.');
  setActor_(token);   // so the audit log names the editor, not '(anonymous)'
  assertNotPrivateInbox_(id, token);
  var sheet = getSheet_();
  var rows = readAllRows_();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === id) {
      auditLog_('delete_meeting', 'meeting', id, { title: rows[i].title, projectId: rows[i].projectId });
      // Deleting a Fathom/Transkriptor-imported meeting doesn't tell the source
      // API anything — without remembering the meetingKey here, the next poll
      // would just re-import the same recording as a brand-new row (see
      // PROP_DELETED_INBOX_KEYS in Config.js).
      if (rows[i].source === 'fathom' || rows[i].source === 'transkriptor') {
        addDeletedInboxKey_(rows[i].meetingKey);
      }
      sheet.deleteRow(rows[i]._rowIndex);
      deleteContent_(id);
      return true;
    }
  }
  return false;
}

// DEPRECATED 2026-07-19, not called by the client. Docs are no longer the
// source of truth; this now refuses rather than silently doing nothing, so
// anyone who finds and calls it from the editor gets a clear error instead
// of an unexpected no-op.
function syncFromDocs(fullRefresh, token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  throw new Error('Doc sync is disabled — Docs are no longer the source of truth.');
}

/* ----------------------------- In-app editing ------------------------------ */
// Docs are no longer the source of truth (2026-07-19) — every meeting is
// edited directly here, in the Sheet/Content store, regardless of where its
// content originally came from (Doc import, Fathom, or manual). The old
// writeToDoc option is gone; there is nothing left to write back to.

// Save edited HTML to the app. Every edit is recorded in AUDIT_LOG.
// meta (optional): { title, dateLabel, time } — lets the same content editor
// also fix a mis-set title/date/time in one save, instead of needing a
// separate "edit details" surface. Any field left out keeps its prior value.
function saveEdit(id, html, token, meta) {
  if (!isEditorOrAdmin_(token)) throw new Error('Not authorized.');
  setActor_(token);   // so the audit log names the editor, not '(anonymous)'
  assertNotPrivateInbox_(id, token);
  var sheet = getSheet_();
  var rows = readAllRows_();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id !== id) continue;
    var r = rows[i];
    var now = new Date().toISOString();
    var clean = chipifyDriveLinks_(linkifyEmails_(html));
    meta = meta || {};
    var title = meta.title || r.title;
    var iso = meta.dateLabel ? parseDateLabel_(meta.dateLabel) : null;
    // Store the NORMALIZED label ("26 May 2569"), never the raw text the admin
    // typed ("26/5/2569", "26-05-69", etc). Storing raw input verbatim meant
    // re-opening the editor pre-filled #ed_date with whatever odd format was
    // last typed, and re-parsing an already-ambiguous string on every future
    // save could drift the year over repeated edits. If parsing succeeds,
    // isoToLabel_ becomes the one and only display format going forward; if it
    // fails (freeform text the parser can't read), fall back to the raw text
    // as before rather than silently dropping the edit.
    var newDateLabel = iso ? isoToLabel_(iso) : (meta.dateLabel || r.dateLabel);
    var merged = {
      id: r.id, projectId: r.projectId, meetingKey: r.meetingKey, date: iso || r.date,
      dateLabel: newDateLabel, time: meta.time != null ? meta.time : r.time, title: title, kind: r.kind,
      excerpt: stripTags_(clean).slice(0, 200), fathomUrl: r.fathomUrl,
      attendees: JSON.stringify(extractAttendees_(clean)), tabId: r.tabId,
      source: r.source || 'manual',
      visible: r.visible, pinned: r.pinned, taggedProjectId: r.taggedProjectId,
      attachments: r.attachments, createdAt: r.createdAt || now, updatedAt: now
    };
    sheet.getRange(r._rowIndex, 1, 1, COLUMNS.length).setValues([rowFromObject_(merged)]);
    // r still holds the PRE-edit title/dateLabel/time here (merged is a new
    // object; r itself was never mutated) — pass them through so the snapshot
    // this save takes reflects what the meeting looked like right before this
    // edit, not the just-written new values.
    var versionSeq = saveContent_(r.id, clean, false, { title: r.title, dateLabel: r.dateLabel, time: r.time });
    auditLog_('edit_content', 'meeting', r.id, { title: title, versionSeq: versionSeq });
    return { ok: true };
  }
  throw new Error('Meeting not found.');
}

function decodeEntities_(s) {
  return String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

// Parse a fragment into styled runs: [{t, bold, italic, link}].
function inlineRuns_(frag) {
  var runs = [], bold = 0, ital = 0, link = '', buf = '';
  function flush() { if (buf) { runs.push({ t: decodeEntities_(buf), bold: bold > 0, italic: ital > 0, link: link }); buf = ''; } }
  var re = /<[^>]+>|[^<]+/g, tok;
  while ((tok = re.exec(frag))) {
    var s = tok[0];
    if (s.charAt(0) === '<') {
      var t = s.toLowerCase();
      if (/^<(b|strong)(\s|>)/.test(t)) { flush(); bold++; }
      else if (/^<\/(b|strong)>/.test(t)) { flush(); bold = Math.max(0, bold - 1); }
      else if (/^<(i|em)(\s|>)/.test(t)) { flush(); ital++; }
      else if (/^<\/(i|em)>/.test(t)) { flush(); ital = Math.max(0, ital - 1); }
      else if (/^<a(\s|>)/.test(t)) { flush(); var hm = s.match(/href\s*=\s*"([^"]*)"/i); link = hm ? hm[1] : ''; }
      else if (/^<\/a>/.test(t)) { flush(); link = ''; }
    } else { buf += s; }
  }
  flush();
  return runs.filter(function (r) { return r.t.replace(/\s+/g, '') !== '' || true; }).filter(function (r) { return r.t; });
}

// Convert editor HTML into block descriptors.
function htmlToBlocks_(html) {
  html = String(html || '');
  html = html.replace(/<table[\s\S]*?<\/table>/gi, function (tbl) {
    var rows = tbl.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    return rows.map(function (tr) {
      var cells = tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || [];
      return '<p>' + cells.map(function (c) { return escapeHtml_(stripTags_(c)); }).join('   |   ') + '</p>';
    }).join('');
  });
  html = html.replace(/<br\s*\/?>/gi, '\n');
  var blocks = [], re = /<(h1|h2|h3|h4|h5|h6|p|li|div)([^>]*)>([\s\S]*?)<\/\1>/gi, m;
  while ((m = re.exec(html))) {
    var tag = m[1].toLowerCase(), runs = inlineRuns_(m[3]);
    if (!runs.length) continue;
    var style = 'NORMAL_TEXT', bullet = '';
    if (tag === 'h1') style = 'HEADING_1';
    else if (tag === 'h2') style = 'HEADING_2';
    else if (/^h[3-6]$/.test(tag)) style = 'HEADING_3';
    else if (tag === 'li') bullet = 'ul';
    blocks.push({ style: style, bullet: bullet, runs: runs });
  }
  if (!blocks.length) { var rr = inlineRuns_(html); if (rr.length) blocks.push({ style: 'NORMAL_TEXT', bullet: '', runs: rr }); }
  return blocks;
}

function findTab_(doc, tabId) {
  var found = null;
  (function walk(tabs) {
    (tabs || []).forEach(function (t) {
      if (t.tabProperties && t.tabProperties.tabId === tabId && t.documentTab) found = t;
      if (t.childTabs) walk(t.childTabs);
    });
  })(doc.tabs);
  return found;
}

// Replace a tab's body with the edited content (best-effort: text, headings,
// bold/italic, links, bullets; tables become text rows). Docs version history
// can restore the prior content if needed.
function writeTabBody_(docId, tabId, html) {
  var blocks = htmlToBlocks_(html);
  var doc = Docs.Documents.get(docId, { includeTabsContent: true });
  var tab = findTab_(doc, tabId);
  if (!tab) throw new Error('Tab not found in document.');
  var content = tab.documentTab.body.content || [];
  var bodyEnd = content.length ? content[content.length - 1].endIndex : 2;

  var requests = [];
  if (bodyEnd > 2) requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: bodyEnd - 1, tabId: tabId } } });

  var full = '', runRanges = [], paraRanges = [];
  blocks.forEach(function (b) {
    var pStart = full.length;
    b.runs.forEach(function (r) {
      var rs = full.length; full += r.t; var reEnd = full.length;
      if (r.bold || r.italic || r.link) runRanges.push({ s: rs, e: reEnd, bold: r.bold, italic: r.italic, link: r.link });
    });
    full += '\n';
    paraRanges.push({ s: pStart, e: full.length, style: b.style, bullet: b.bullet });
  });
  if (!full) full = '\n';

  requests.push({ insertText: { location: { index: 1, tabId: tabId }, text: full } });
  paraRanges.forEach(function (p) {
    if (p.style !== 'NORMAL_TEXT') {
      requests.push({ updateParagraphStyle: { range: { startIndex: 1 + p.s, endIndex: 1 + p.e, tabId: tabId }, paragraphStyle: { namedStyleType: p.style }, fields: 'namedStyleType' } });
    }
  });
  runRanges.forEach(function (r) {
    var ts = {}, fields = [];
    if (r.bold) { ts.bold = true; fields.push('bold'); }
    if (r.italic) { ts.italic = true; fields.push('italic'); }
    if (r.link) { ts.link = { url: r.link }; fields.push('link'); }
    if (fields.length) requests.push({ updateTextStyle: { range: { startIndex: 1 + r.s, endIndex: 1 + r.e, tabId: tabId }, textStyle: ts, fields: fields.join(',') } });
  });
  paraRanges.forEach(function (p) {
    if (p.bullet) requests.push({ createParagraphBullets: { range: { startIndex: 1 + p.s, endIndex: 1 + p.e, tabId: tabId }, bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE' } });
  });

  Docs.Documents.batchUpdate({ requests: requests }, docId);
}

// TEMP diagnostic: for every doc, list paragraphs that are headings or start
// with a non-ASCII/non-Thai symbol, with the first character's codepoint.
// Dump the structure of reference-bearing paragraphs in the financial doc so we
// can see exactly what element type the file chips are.
function diagRefs_() {
  var typeTally = {};
  var samples = [];
  var doc = fetchDoc_('1ZalknvljuHKXcuprz13kT5w8202stcQ1KGWq9mNRqKo');
  var tabs = collectApiTabs_(doc);
  tabs.forEach(function (tab) {
    (tab.content || []).forEach(function (se) {
      if (!se.paragraph) return;
      var els = se.paragraph.elements || [];
      var keys = [], text = '';
      els.forEach(function (el) {
        Object.keys(el).forEach(function (k) {
          if (k === 'startIndex' || k === 'endIndex') return;
          keys.push(k);
          typeTally[k] = (typeTally[k] || 0) + 1;
        });
        if (el.textRun) text += el.textRun.content || '';
      });
      var hasNonText = keys.some(function (k) { return k !== 'textRun'; });
      if ((hasNonText || /reference|cadence|event|project manager|attendee|\.pdf|\.xls|\.ppt|\.doc/i.test(text)) && samples.length < 40) {
        var sample = { tab: tab.title, keys: keys, text: text.replace(/\n/g, ' ').slice(0, 50) };
        // include the first non-textRun element's raw object (trimmed)
        for (var i = 0; i < els.length; i++) {
          var nk = Object.keys(els[i]).filter(function (k) { return k !== 'startIndex' && k !== 'endIndex' && k !== 'textRun'; });
          if (nk.length) { sample.raw = JSON.parse(JSON.stringify(els[i][nk[0]])); break; }
        }
        samples.push(sample);
      }
    });
  });
  return JSON.stringify({ elementTypes: typeTally, samples: samples }, null, 1);
}

function diagAll_() {
  var result = {};
  getAllProjects_().forEach(function (d) {
    try {
      var tabs = collectApiTabs_(fetchDoc_(d.docId));
      result[d.id] = { tabCount: tabs.length, titles: tabs.map(function (t) { return t.title || '(untitled)'; }) };
    } catch (e) { result[d.id] = { error: String(e) }; }
  });
  return JSON.stringify(result, null, 1);
}

/* -------------------- Apply VCB visual style to source Docs --------------- */
// Makes the source Google Docs look like the rendered meeting in the web app:
// Sarabun font, navy heading colors, matching sizes. Updates the *named*
// paragraph styles inside every tab, so existing headings re-skin instantly.
// Run from the Apps Script editor (or via the API call below) once, or whenever
// you want to re-apply.

function applyVcbStylesToAllSourceDocs(token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  var out = [];
  getAllProjects_().forEach(function (d) {
    try { applyVcbStylesToDoc_(d.docId); out.push({ id: d.id, name: d.name, ok: true }); }
    catch (e) { out.push({ id: d.id, name: d.name, ok: false, error: String(e) }); }
  });
  return out;
}

function applyVcbStylesToDoc_(docId) {
  var doc = DocumentApp.openById(docId);
  var tabs = doc.getTabs && doc.getTabs();
  if (tabs && tabs.length) {
    (function walk(arr) {
      arr.forEach(function (t) {
        var dt = t.asDocumentTab && t.asDocumentTab();
        if (dt && dt.getBody) styleBody_(dt.getBody());
        var kids = t.getChildTabs && t.getChildTabs();
        if (kids && kids.length) walk(kids);
      });
    })(tabs);
  } else {
    styleBody_(doc.getBody());
  }
}

function styleBody_(body) {
  var H = DocumentApp.ParagraphHeading;
  var A = DocumentApp.Attribute;
  function a(o) { var x = {}; Object.keys(o).forEach(function (k) { x[A[k]] = o[k]; }); return x; }
  // Sizes in points; web app's heading sizes are tuned to match these visually.
  body.setHeadingAttributes(H.NORMAL,   a({ FONT_FAMILY: 'Sarabun', FONT_SIZE: 11, FOREGROUND_COLOR: '#1f2328', BOLD: false }));
  body.setHeadingAttributes(H.HEADING1, a({ FONT_FAMILY: 'Sarabun', FONT_SIZE: 16, BOLD: true, FOREGROUND_COLOR: '#0b3d62' }));
  body.setHeadingAttributes(H.HEADING2, a({ FONT_FAMILY: 'Sarabun', FONT_SIZE: 13, BOLD: true, FOREGROUND_COLOR: '#0b3d62' }));
  body.setHeadingAttributes(H.HEADING3, a({ FONT_FAMILY: 'Sarabun', FONT_SIZE: 12, BOLD: true, FOREGROUND_COLOR: '#24486b' }));
  body.setHeadingAttributes(H.HEADING4, a({ FONT_FAMILY: 'Sarabun', FONT_SIZE: 11, BOLD: true, FOREGROUND_COLOR: '#24486b' }));
}

/* -------------- Deep reskin: walks every paragraph + table --------------- */
// Strips per-paragraph font/size/color/background overrides so the named styles
// (above) actually take effect. Detects "section-heading-like" Normal-text
// paragraphs and promotes them to real Heading 1. Restyles tables to match the
// web app's first-row blue-grey header. Use Docs' version history to revert if
// the heuristics over-promote.
function reskinSourceDocs(token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  applyVcbStylesToAllSourceDocs(token); // ensure the named styles are set
  var out = [];
  getAllProjects_().forEach(function (d) {
    try { reskinDoc_(d.docId); out.push({ id: d.id, name: d.name, ok: true }); }
    catch (e) { out.push({ id: d.id, name: d.name, ok: false, error: String(e) }); }
  });
  return out;
}

function reskinDoc_(docId) {
  var doc = DocumentApp.openById(docId);
  var tabs = doc.getTabs && doc.getTabs();
  if (tabs && tabs.length) {
    (function walk(arr) {
      arr.forEach(function (t) {
        var dt = t.asDocumentTab && t.asDocumentTab();
        if (dt && dt.getBody) reskinBody_(dt.getBody());
        var kids = t.getChildTabs && t.getChildTabs();
        if (kids && kids.length) walk(kids);
      });
    })(tabs);
  } else {
    reskinBody_(doc.getBody());
  }
}

function reskinBody_(body) {
  var n = body.getNumChildren();
  for (var i = 0; i < n; i++) {
    var el = body.getChild(i);
    var t = el.getType();
    if (t === DocumentApp.ElementType.PARAGRAPH) reskinParagraph_(el.asParagraph());
    else if (t === DocumentApp.ElementType.LIST_ITEM) clearTextOverrides_(el.asListItem().editAsText());
    else if (t === DocumentApp.ElementType.TABLE) reskinTable_(el.asTable());
  }
}

function clearTextOverrides_(text) {
  try { text.setFontFamily(null); } catch (e) {}
  try { text.setFontSize(null); } catch (e) {}
  try { text.setForegroundColor(null); } catch (e) {}
  try { text.setBackgroundColor(null); } catch (e) {}
}

function looksLikeSectionHeading_(p) {
  var text = (p.getText() || '').trim();
  if (!text) return false;
  if (text.length > 100) return false;
  if (/^\d+\.\s+\S/.test(text)) return true;          // "1. Section title"
  if (/^[ก-๙a-zA-Z]/.test(text) === false) return false; // ignore symbols-only / numbers-only
  var t = p.editAsText();
  var boldChars = 0;
  for (var i = 0; i < text.length && i < 200; i++) {
    try { if (t.isBold(i)) boldChars++; } catch (e) {}
  }
  return boldChars / Math.min(text.length, 200) > 0.7;
}

function reskinParagraph_(p) {
  var H = DocumentApp.ParagraphHeading;
  var heading = p.getHeading();
  if (heading === H.NORMAL && looksLikeSectionHeading_(p)) {
    var text = p.editAsText();
    // Strip all per-run formatting so the named Heading 1 style alone paints it.
    try { text.setBold(false); } catch (e) {}
    try { text.setItalic(false); } catch (e) {}
    clearTextOverrides_(text);
    p.setHeading(H.HEADING1);
    return;
  }
  // Normal body OR existing heading: clear font/size/color/background overrides only.
  // Keep bold/italic/links because those are legitimate inline emphasis.
  clearTextOverrides_(p.editAsText());
}

function reskinTable_(tbl) {
  for (var r = 0; r < tbl.getNumRows(); r++) {
    var row = tbl.getRow(r);
    for (var c = 0; c < row.getNumCells(); c++) {
      var cell = row.getCell(c);
      try { cell.setBackgroundColor(r === 0 ? '#f1f5f9' : '#ffffff'); } catch (e) {}
      var nc = cell.getNumChildren();
      for (var k = 0; k < nc; k++) {
        var el = cell.getChild(k);
        if (el.getType() === DocumentApp.ElementType.PARAGRAPH) {
          var p = el.asParagraph();
          var txt = p.editAsText();
          clearTextOverrides_(txt);
          if (r === 0) { try { txt.setBold(true); } catch (e) {} }
        }
      }
    }
  }
}
