/**
 * VCB Connect — internal portal that links to every VCB Group web app.
 * The portal itself is read-only: it renders a static list of registered
 * apps. Update APPS below to add / remove / re-order links.
 */

var APP_TITLE = 'VCB Connect';

var APPS = [
  {
    key:  'ememo',
    name: 'E-Memo',
    desc: 'Document control, memo issuance & approval workflow.',
    url:  'https://script.google.com/a/macros/vcb-con.com/s/AKfycbxv70XmRpmQf_9JKQsJwY_-N3oxc0llO4xQL52ycDdpW_HvaN_G1sG0GsRqePbLxROn/exec',
    icon: 'memo',
    accent: '#4fd1ff'
  },
  {
    key:  'minutes',
    name: 'Meeting Minutes',
    desc: 'Meeting records, decisions & action-item tracking.',
    url:  'https://script.google.com/a/macros/vcb-con.com/s/AKfycbxJN7olKBYqGHlaWXiVOI41fh8oZJ9lRstXZAj1DFVeiynyvfBf48xaKX5p4D19rUnr/exec',
    icon: 'minutes',
    accent: '#7ee8ff'
  },
  {
    key:  'sop',
    name: 'Standard Operating Procedures',
    desc: 'Browse, search & version-control company SOPs.',
    url:  'https://script.google.com/a/macros/vcb-con.com/s/AKfycby8FFhiGqjn2tSYaj8LjIPMHwBtkQk66hed7sq1q_tCFd7XhHeHef1_NTuv7qzJDIi8Dg/exec',
    icon: 'sop',
    accent: '#a78bfa'
  },
  {
    key:  'sysmap',
    name: 'System Map',
    desc: 'Interactive map of VCB Group systems & integrations.',
    url:  'https://script.google.com/macros/s/AKfycbyslTl8HOSLBtqFfp8lo0UBoVJGvCl7ieAxskcdl0HrDwYec7Uzj8khCjKtpC2VRRgh/exec',
    icon: 'sysmap',
    accent: '#f472b6'
  },
  {
    key:  'hr',
    name: 'HR Work Log',
    desc: 'Attendance, task logs & timesheet for the HR team.',
    url:  'https://script.google.com/macros/s/AKfycbzEg5Sn0tNnciRkWmwnsEM9cmq0NVmy6weblTLPqlAOccsDKkh9m6dmLMRVBpqspBblUA/exec',
    icon: 'hr',
    accent: '#34d399'
  },
  {
    key:  'credit',
    name: 'Credit Facility Manager',
    desc: 'Credit limits, drawdowns, requests & approvals.',
    url:  'https://script.google.com/a/macros/vcb-con.com/s/AKfycbztWhyi0anTnTu8lOkMYVrECpRStAn0jqjlNrfxPlnnTwkk1t45XfCofWiv9wLLVEisjQ/exec',
    icon: 'credit',
    accent: '#fbbf24'
  }
];

function doGet() {
  var t = HtmlService.createTemplateFromFile('index');
  t.apps = APPS;
  try { t.announcement = getAnnouncement(); } catch (e) { t.announcement = null; }
  try { t.adminInitialized = isAdminInitialized(); } catch (e) { t.adminInitialized = false; }
  return t.evaluate()
    .setTitle(APP_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** Client calls this to display the logged-in user's name in the header. */
function getActiveUserEmail() {
  try {
    return Session.getActiveUser().getEmail() || '';
  } catch (e) {
    return '';
  }
}

/* ---------- announcement banner ---------- */
//
// Stored as a single JSON blob in ScriptProperties under ANNOUNCEMENT_JSON.
// Admin password (its SHA-256 hash) lives in ADMIN_PASSWORD_HASH; the first
// person to open the admin modal sets it, anyone else must enter it.
// Edit sessions get a short-lived UUID token from CacheService — clients hold
// onto it in localStorage and pass it back when saving so we don't need to
// re-prompt on every keystroke.

var PROP_ANNOUNCEMENT = 'ANNOUNCEMENT_JSON';
var PROP_ADMIN_HASH   = 'ADMIN_PASSWORD_HASH';
var ADMIN_TOKEN_TTL   = 1800;          // seconds — 30 min edit session
var ADMIN_TOKEN_KEY   = 'ADMIN_TOK_';

function isAdminInitialized() {
  return !!PropertiesService.getScriptProperties().getProperty(PROP_ADMIN_HASH);
}

function getAnnouncement() {
  var raw = PropertiesService.getScriptProperties().getProperty(PROP_ANNOUNCEMENT);
  if (!raw) return null;
  try {
    var obj = JSON.parse(raw);
    return obj && obj.show ? obj : null;
  } catch (e) {
    return null;
  }
}

function hashPassword_(plain) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(plain));
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

/**
 * First-time setup OR password check. Returns a session token that the client
 * must pass back when saving. Throws a friendly error on bad input.
 */
function unlockAdmin(password) {
  password = String(password || '');
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');

  var props = PropertiesService.getScriptProperties();
  var existing = props.getProperty(PROP_ADMIN_HASH);
  var incoming = hashPassword_(password);

  if (!existing) {
    props.setProperty(PROP_ADMIN_HASH, incoming);
  } else if (incoming !== existing) {
    Utilities.sleep(700);                          // crude brute-force throttle
    throw new Error('Incorrect password.');
  }

  var token = Utilities.getUuid();
  CacheService.getScriptCache().put(ADMIN_TOKEN_KEY + token, '1', ADMIN_TOKEN_TTL);
  return token;
}

function isValidAdminToken_(token) {
  if (!token) return false;
  return CacheService.getScriptCache().get(ADMIN_TOKEN_KEY + token) === '1';
}

/**
 * Save / publish a new announcement. Pass `null` payload to clear.
 * Token must come from a recent unlockAdmin() call.
 */
function saveAnnouncement(token, payload) {
  if (!isValidAdminToken_(token)) {
    throw new Error('Your admin session expired. Please unlock admin again.');
  }
  var props = PropertiesService.getScriptProperties();

  if (payload === null || payload === undefined) {
    props.deleteProperty(PROP_ANNOUNCEMENT);
    return null;
  }

  if (typeof payload !== 'object') throw new Error('Bad payload.');

  var obj = {
    id:      Utilities.getUuid(),                  // new id = re-shows for everyone
    title:   String(payload.title || '').slice(0, 120).trim(),
    body:    String(payload.body  || '').slice(0, 600).trim(),
    show:    !!payload.show,
    updated: new Date().toISOString()
  };
  if (!obj.title && !obj.body) {
    throw new Error('Add at least a title or a message.');
  }
  props.setProperty(PROP_ANNOUNCEMENT, JSON.stringify(obj));
  return obj;
}

/** Returns the current announcement record (including show=false) for the editor. */
function getAnnouncementForEdit(token) {
  if (!isValidAdminToken_(token)) {
    throw new Error('Your admin session expired. Please unlock admin again.');
  }
  var raw = PropertiesService.getScriptProperties().getProperty(PROP_ANNOUNCEMENT);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

/* ---------- help & support: issue reports ---------- */
//
// The Help modal's report form calls sendIssueReport(payload) directly —
// no admin/auth needed, this is just a contact form. A per-reporter cache
// key throttles repeat submissions so the mailbox can't be flooded.

var SUPPORT_EMAIL      = 'c.chavananand@vcb-con.com';
var ISSUE_THROTTLE_KEY = 'ISSUE_REPORT_';
var ISSUE_THROTTLE_TTL = 60; // seconds between reports from the same visitor

/**
 * Sends an issue report to SUPPORT_EMAIL. `payload` = { area, message }.
 * `area` must be one of APPS[].key or 'other'. Throws a friendly error on
 * bad input or when throttled.
 */
function sendIssueReport(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Bad payload.');

  var area = String(payload.area || '').trim();
  var message = String(payload.message || '').trim();
  if (!area) throw new Error('Choose what you were trying to do.');
  if (!message) throw new Error('Describe the issue.');
  if (message.length > 2000) message = message.slice(0, 2000);

  var areaLabel = 'Other / something else';
  if (area !== 'other') {
    var known = false;
    for (var i = 0; i < APPS.length; i++) {
      if (APPS[i].key === area) { areaLabel = APPS[i].name; known = true; break; }
    }
    if (!known) throw new Error('Unrecognized area.');
  }

  var reporterEmail = getActiveUserEmail() || 'unknown (anonymous visitor)';

  // throttle repeat submissions per reporter (falls back to a shared bucket
  // for anonymous visitors, which is an acceptable trade-off for a low-traffic
  // internal contact form).
  var cache = CacheService.getScriptCache();
  var throttleKey = ISSUE_THROTTLE_KEY + reporterEmail;
  if (cache.get(throttleKey)) {
    throw new Error('Please wait a moment before sending another report.');
  }
  cache.put(throttleKey, '1', ISSUE_THROTTLE_TTL);

  var subject = 'VCB Connect — issue report: ' + areaLabel;
  var body =
    'Area: ' + areaLabel + '\n' +
    'Reported by: ' + reporterEmail + '\n' +
    'When: ' + new Date().toISOString() + '\n\n' +
    'Message:\n' + message + '\n';

  MailApp.sendEmail({
    to: SUPPORT_EMAIL,
    subject: subject,
    body: body,
    replyTo: (reporterEmail.indexOf('@') !== -1) ? reporterEmail : SUPPORT_EMAIL
  });

  return { sent: true };
}
