/**
 * Config.gs — central configuration for the VCB Meeting Minutes web app.
 *
 * The app keeps an editable Google Sheet as its database, and imports meeting
 * content directly from the source Google Docs in the "04 MEETINGS (สรุปประชุม)"
 * folder. Re-importing is non-destructive: existing edited rows are matched by a
 * stable key (project + meetingKey) and only new meetings are added, unless a
 * full refresh is requested.
 */

// Display name shown in the app header.
var APP_TITLE = 'VCB Meeting Minutes';
var APP_DISPLAY_TITLE = 'Meeting Minutes';
var APP_SUBTITLE = 'กลุ่มวิจิตรภัณฑ์ก่อสร้าง · รายงานการประชุมภายใน';

// The Google Drive folder that holds the source minutes (for reference / future auto-discovery).
var SOURCE_FOLDER_NAME = '04 MEETINGS (สรุปประชุม)';

// Source Google Docs. Each is one "stream" of recurring meetings.
// `order` controls sidebar ordering. `color` is the accent used in the UI.
var SOURCE_DOCS = [
  {
    id: 'FIN',
    docId: '17lWoQHzihe6_zu7qw_Y5cjC3DW9QMePNZBXVZ3Y3wL0',
    name: 'งบการเงินทุกโครงการ',
    nameEn: 'All-Project Financial Review',
    cadence: 'Monthly',
    color: '#1f6feb',
    order: 1
  },
  {
    id: 'BD',
    docId: '1MS405PXOH_srvuMs_NIfkIbGKEtntUuevKNVs19kc30',
    name: 'Business Development',
    nameEn: 'กลยุทธ์การพัฒนาธุรกิจ',
    cadence: 'Quarterly',
    color: '#8957e5',
    order: 2
  },
  {
    id: 'BT12',
    docId: '1k5z1t5sUfOxCSglG0XHQgFEP9zM3RVDbL_C5hW88-ck',
    name: 'โครงการบางเตย ตอน 1+2',
    nameEn: 'Bang Toey Sections 1+2 (BT)',
    cadence: 'Monthly',
    color: '#2da44e',
    order: 3
  },
  {
    id: 'BV',
    docId: '1nW24IcmFcOgOLaQ3KXFIURlPgWPv4vTADnhdnUDm3kE',
    name: 'โครงการบางวัว ตอน 6',
    nameEn: 'Bang Wua Section 6 (BV) · Highway 34',
    cadence: 'Monthly',
    color: '#bf8700',
    order: 4
  },
  {
    id: 'PN34',
    docId: '1DXSOlZF-zBEWjD1n6I6jLlOwB00mFDK9X8b2wkCG9dg',
    name: 'โครงการบรม ตอน 3+4',
    nameEn: 'Borommaratchachonnani Sections 3+4 (PN)',
    cadence: 'Monthly',
    color: '#cf222e',
    order: 5
  }
];

// Pseudo-project: incoming Fathom recordings land here (via webhook) until an
// admin files them into a real project. Not a Doc-backed project, so it's kept
// out of SOURCE_DOCS/importAllDocs, but shares the same row schema.
var FATHOM_INBOX_ID = 'FATHOM_INBOX';
var FATHOM_INBOX_META = {
  id: FATHOM_INBOX_ID, name: 'Fathom Inbox', nameEn: 'Fathom Inbox',
  cadence: 'As recorded', color: '#8b949e', order: 99
};

// Pseudo-project: incoming Transkriptor recordings land here (pulled via the
// Transkriptor API, polling — no webhook support) until an admin files them
// into a real project. Mirrors FATHOM_INBOX_ID exactly; same row schema.
function isInboxProjectId_(projectId) {
  return projectId === FATHOM_INBOX_ID || projectId === TRANSKRIPTOR_INBOX_ID;
}

var TRANSKRIPTOR_INBOX_ID = 'TRANSKRIPTOR_INBOX';
var TRANSKRIPTOR_INBOX_META = {
  // Same neutral grey as FATHOM_INBOX_META, deliberately (2026-07-22) — an
  // inbox is a review queue, not a real project, and giving it its own accent
  // color made it look like one more designated group in the sidebar instead
  // of the temporary holding area it actually is.
  id: TRANSKRIPTOR_INBOX_ID, name: 'Transkriptor Inbox', nameEn: 'Transkriptor Inbox',
  cadence: 'As recorded', color: '#8b949e', order: 100
};

// Admins see every meeting + visibility controls. Everyone else (employees) only
// ever receives meetings marked visible. Add more admin emails here as needed.
var ADMIN_EMAILS = ['c.chavananand@vcb-con.com'];

// Sections whose meetings are shown to all employees by default. Any source doc
// NOT listed here (e.g. a future HR / personal doc) defaults to hidden.
var EMPLOYEE_VISIBLE_DOCS = { FIN: true, BD: true, BT12: true, BV: true, PN34: true };

// Runtime per-project "Public" override, set from the control panel's lock/
// unlock toggle (setProjectPublic in Auth.js) — lets an admin flip a project's
// default visibility without editing source. Keyed by project id, JSON bool
// map; a project with no entry here falls back to EMPLOYEE_VISIBLE_DOCS.
var PROP_PROJECT_PUBLIC = 'PROJECT_PUBLIC';

function getProjectPublicOverrides_() {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(PROP_PROJECT_PUBLIC);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}
function setProjectPublicOverride_(projectId, isPublic) {
  var map = getProjectPublicOverrides_();
  map[projectId] = !!isPublic;
  PropertiesService.getScriptProperties().setProperty(PROP_PROJECT_PUBLIC, JSON.stringify(map));
}
function docVisibleDefault_(projectId) {
  var overrides = getProjectPublicOverrides_();
  if (Object.prototype.hasOwnProperty.call(overrides, projectId)) return !!overrides[projectId];
  return !!EMPLOYEE_VISIBLE_DOCS[projectId];
}

// Property keys.
var PROP_DB_ID = 'MINUTES_DB_SPREADSHEET_ID';
var SHEET_NAME = 'Minutes';

// Columns of the database sheet (order matters).
var COLUMNS = [
  'id',          // unique id
  'projectId',   // FIN / BD / BT12 / BV / PN34
  'meetingKey',  // stable key within a project (date label or "overview")
  'date',        // normalized ISO date (yyyy-mm-dd) when parseable, else ''
  'dateLabel',   // original date label as written
  'time',        // e.g. "10:00AM"
  'title',       // heading text
  'kind',        // 'overview' | 'meeting'
  'excerpt',     // short text snippet for the list view
  'fathomUrl',   // first fathom.video link found, if any
  'attendees',   // JSON array of attendee emails extracted from the content
  'tabId',       // source Google Docs tab id (for deep-link editing)
  'source',      // 'doc-import' | 'manual' | 'fathom' | 'transkriptor'
  'visible',     // 'TRUE' = shown to all employees; '' = admin-only
  'pinned',      // 'TRUE'/''
  'createdAt',
  'updatedAt',
  'taggedProjectId', // Inbox rows only (fathom/transkriptor source): comma-
                     // separated project ids this recording is ALSO filed
                     // under (a recording can be tagged into more than one
                     // project). projectId stays FATHOM_INBOX/TRANSKRIPTOR_INBOX
                     // permanently — the row never leaves its inbox; tagging
                     // just makes it also appear in each tagged project's
                     // list. '' = untagged. Column name kept singular for
                     // compatibility with rows written before multi-tag
                     // support (2026-07-18) — a lone id is just a
                     // one-item list.
  'attachments',     // JSON array of {fileId, name, mimeType, size,
                     // uploadedAt, uploadedBy} — files (PDF/PPT/XLS/etc)
                     // attached to this meeting, stored in the app's own
                     // Drive attachments folder. '' or '[]' = none.
  'comments'         // JSON array of {id, author, text, createdAt} — staff
                     // comments on this meeting. '' or '[]' = none.
];

// Projects added at runtime via the "+ New project" admin UI (createProject).
// SOURCE_DOCS above stays as the original hardcoded 5 — never mutated — so a
// bad Script Property value can never lose the original project list; extra
// projects are purely additive. Stored as one JSON array under this key.
var PROP_EXTRA_PROJECTS = 'EXTRA_PROJECTS';

function getExtraProjects_() {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(PROP_EXTRA_PROJECTS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}
function setExtraProjects_(list) {
  PropertiesService.getScriptProperties().setProperty(PROP_EXTRA_PROJECTS, JSON.stringify(list || []));
}

// Tombstone list for deleted Fathom/Transkriptor Inbox recordings — a JSON
// array of meetingKey strings ('fathom-<recordingId>' / 'transkriptor-<orderId>').
// Without this, deleting an inbox-sourced meeting from the app has no effect on
// the next poll: the source API doesn't know or care that you deleted it, so
// the same recording would just get re-imported as a brand-new row. Written to
// by deleteMeeting (Code.js) whenever the deleted row's source is fathom/
// transkriptor; checked by backfillFathomMeetings/backfillTranskriptorMeetings
// before importing anything, alongside their normal "already imported" check.
var PROP_DELETED_INBOX_KEYS = 'DELETED_INBOX_KEYS';

function getDeletedInboxKeys_() {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(PROP_DELETED_INBOX_KEYS);
    var arr = raw ? JSON.parse(raw) : [];
    var set = {};
    arr.forEach(function (k) { set[k] = true; });
    return set;
  } catch (e) { return {}; }
}
function addDeletedInboxKey_(meetingKey) {
  if (!meetingKey) return;
  var set = getDeletedInboxKeys_();
  if (set[meetingKey]) return;
  var keys = Object.keys(set);
  keys.push(meetingKey);
  PropertiesService.getScriptProperties().setProperty(PROP_DELETED_INBOX_KEYS, JSON.stringify(keys));
}

// Renames/edits applied at runtime to ANY project — including the original
// hardcoded 5 — without ever editing Config.js source. Keyed by project id;
// each value is a partial { name?, nameEn?, cadence?, color? } patch merged
// over the base definition in getAllProjects_(). This is what makes every
// project's name editable from the app, not just ones created after tonight.
var PROP_PROJECT_OVERRIDES = 'PROJECT_OVERRIDES';

function getProjectOverrides_() {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(PROP_PROJECT_OVERRIDES);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}
function setProjectOverride_(id, patch) {
  var map = getProjectOverrides_();
  map[id] = Object.assign({}, map[id] || {}, patch);
  PropertiesService.getScriptProperties().setProperty(PROP_PROJECT_OVERRIDES, JSON.stringify(map));
}

// The full project list every part of the app should iterate — the original 5
// (SOURCE_DOCS, hardcoded) plus any added later at runtime, with any saved
// renames/edits applied. Call this instead of referencing SOURCE_DOCS
// directly anywhere outside this file.
function getAllProjects_() {
  var overrides = getProjectOverrides_();
  return SOURCE_DOCS.concat(getExtraProjects_()).map(function (p) {
    var o = overrides[p.id];
    return o ? Object.assign({}, p, o) : p;
  });
}

function getDocById_(id) {
  var all = getAllProjects_();
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) return all[i];
  }
  return null;
}
