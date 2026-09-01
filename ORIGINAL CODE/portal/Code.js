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
    // Re-pointed 2026-09-01: the previous deployment belonged to script project
    // 13GL834Y…, which no longer exists in Drive. HR was rebuilt as project
    // 16IoKsjX… and redeployed, so the old /exec URL is permanently dead.
    //
    // This deployment is the one set to "Anyone" — NOT "Anyone with a Google
    // account", which is what the earlier rebuilt deployments defaulted to and
    // which put a sign-in page in front of the app. That setting lives in the
    // deployment record only: appsscript.json's webapp.access does not control
    // it, and clasp cannot write it. It has to be set in the editor under
    // Deploy ▸ Manage deployments.
    url:  'https://script.google.com/macros/s/AKfycbz4q_xAlsKRM-fXys7-JMKcDhsrz6qw-FECzZvcRDFc3anzHiXxu8cJJ7kvooS4IwcI/exec',
    icon: 'hr',
    accent: '#34d399'
  },
  {
    key:  'credit',
    name: 'Credit Facility Manager',
    desc: 'Credit limits, drawdowns, requests & approvals.',
    url:  'https://script.google.com/macros/s/AKfycbytkA07aNklbDv3gKca-iI02FPCdC1Q0i3gAtE1Ls1ry9MCoIUmG_KabhCBip8C0vn91g/exec',
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

/* ---------- upcoming birthdays ---------- */
//
// Sourced from HR's employee roster (name, nickname, birthdate). Only name +
// birth month/day are kept here — no ID numbers, ages, or hire dates, since
// the dashboard only needs enough to greet people on their birthday.
// To add/remove someone, edit BIRTHDAY_ROSTER below.
//
// Department codes are HR's actual department abbreviations, matched 1:1
// against the employee roster the user supplied.

var BIRTHDAY_ROSTER = [
  { name: 'ธนกร สมมาตร',        nickname: 'อาร์ม',   month: 1,  day: 26, dept: 'ADMIN' },
  { name: 'ธนวรรณ หัสดง',       nickname: 'ฟิวส์',   month: 7,  day: 22, dept: 'FIN' },
  { name: 'เปรมกมล ขวัญเจริญศรี', nickname: 'ไอซ์',    month: 1,  day: 24, dept: 'IC' },
  { name: 'ณิชชา วัฒนการุณวงค์', nickname: 'กีฟ',     month: 1,  day: 14, dept: 'FIN' },
  { name: 'อรุณกมล หนูพุ่ม',     nickname: 'บิว',     month: 11, day: 20, dept: 'HR' },
  { name: 'ชินวิวัฒน์ นาวาทอง',  nickname: 'ชิน',     month: 5,  day: 14, dept: 'IT' },
  { name: 'สิริรัตน์ เพชรไพฑูรย์', nickname: 'บุ๋ม',    month: 10, day: 19, dept: 'FIN' },
  { name: 'เบญจมาศ ฉิมพาลี',    nickname: 'ชมพู',    month: 9,  day: 20, dept: 'FIN' },
  { name: 'นัชลิกา เนียมสอาด',  nickname: 'แอม',     month: 1,  day: 1,  dept: 'PUR' },
  { name: 'ชยันตร์ ธูปประดิษฐ์', nickname: 'ท้อป',    month: 3,  day: 1,  dept: 'ADMIN' },
  { name: 'สุธาสินี เลาหะนันท์', nickname: 'เกด',     month: 3,  day: 3,  dept: 'ACCT' },
  { name: 'นิชาภา ทำนา',        nickname: 'นา',      month: 9,  day: 17, dept: 'PUR' },
  { name: 'สุพรรณี ไชยสาร',     nickname: 'แจง',     month: 3,  day: 3,  dept: 'ACCT' },
  { name: 'สิทธิชัย ยิ้มแย้ม',   nickname: 'เอส',     month: 7,  day: 18, dept: 'ADMIN' },
  { name: 'กรกวรรษ จันทนาม',    nickname: 'วี',      month: 9,  day: 8,  dept: 'SUPPORT' },
  { name: 'รมณีย์ กรุณจินตดิฏฐ์', nickname: 'หน่อง',   month: 12, day: 6,  dept: 'ENG' },
  { name: 'วาริศา แก้วกาม',     nickname: 'ปู',      month: 3,  day: 3,  dept: 'ENG' },
  { name: 'บุญชัย บุญน้อม',     nickname: 'เก่ง',     month: 2,  day: 3,  dept: 'ADMIN' },
  { name: 'กรรณิการ์ กฤษแก้ว',  nickname: 'หญิง',    month: 6,  day: 14, dept: 'ADMIN' },
  { name: 'ปรางค์ทิพย์ หาสิน',  nickname: 'ปู',      month: 6,  day: 25, dept: 'ACCT' },
  { name: 'สหวุฒิ วรพันธ์',     nickname: 'เท่ง',     month: 9,  day: 21, dept: 'ENG' },
  { name: 'ปานทิป กองสุข',      nickname: 'ต่าย',    month: 1,  day: 24, dept: 'ADMIN' },
  { name: 'อภิชา ชมชื่น',       nickname: 'เพ็ญ',    month: 12, day: 20, dept: 'HR' },
  { name: 'เฉลิมพล เพ็ชรสวัสดิ์', nickname: 'โอม',    month: 12, day: 12, dept: 'ENG' },
  { name: 'กฤษณ์พรรณ เอี่ยมวัฒนกิจ', nickname: 'พริ้ง', month: 12, day: 1,  dept: 'ACCT' },
  { name: 'พลอยพรรณ เรนภักดี',  nickname: 'ใจ',      month: 2,  day: 23, dept: 'ACCT' },
  { name: 'เอกสิทธิ์ แต้ภักดี',  nickname: 'เล็ก',     month: 10, day: 10, dept: 'ENG' },
  { name: 'พิทักษ์พงศ์ พลาศรี', nickname: 'เพด',     month: 10, day: 16, dept: 'ADMIN' },
  { name: 'วันเพ็ญ อภิปัญญาธนสุข', nickname: 'เพ็ญ',   month: 10, day: 2,  dept: 'ACCT' },
  { name: 'สายชล ทรัพย์บุญโต',  nickname: 'ป๋อง',    month: 6,  day: 10, dept: 'ADMIN' },
  { name: 'จิราพร ศรีแก้ว',     nickname: 'จิ',      month: 9,  day: 16, dept: 'ACCT' },
  { name: 'จักรสกล ภู่อร่าม',   nickname: 'จักร',    month: 12, day: 12, dept: 'ADMIN' },
  { name: 'ชญาภา วจนรจนา',     nickname: 'เปี๊ยก',   month: 5,  day: 17, dept: 'ADMIN' },
  { name: 'ภาลีนา บุญอำนวยสมบัติ', nickname: 'อ้วน',   month: 11, day: 17, dept: 'FIN' },
  { name: 'ชาญ กรุณจินตดิฏฐ์',  nickname: 'ชาญ',     month: 9,  day: 8,  dept: 'ENG' }
];

/**
 * Returns the `count` (default 3) employees whose birthday is soonest from
 * today, wrapping to next year for anyone whose birthday already passed this
 * year. Someone whose birthday is today counts as "0 days away" (soonest).
 */
function getUpcomingBirthdays(count) {
  count = count || 3;
  var tz = Session.getScriptTimeZone() || 'Asia/Bangkok';
  var todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var today = new Date(todayStr + 'T00:00:00');
  var thisYear = today.getFullYear();

  var withDates = BIRTHDAY_ROSTER.map(function (p) {
    var next = new Date(thisYear, p.month - 1, p.day);
    if (next < today) next = new Date(thisYear + 1, p.month - 1, p.day);
    var daysAway = Math.round((next - today) / 86400000);
    return {
      name: p.name,
      nickname: p.nickname,
      dept: p.dept,
      month: p.month,
      day: p.day,
      daysAway: daysAway
    };
  });

  withDates.sort(function (a, b) { return a.daysAway - b.daysAway; });
  return withDates.slice(0, count);
}

/* ---------- holiday calendar ---------- */
//
// Fixed-date Thai public holidays only — month/day repeats every year, so no
// per-year table to maintain. Deliberately excludes lunar/Buddhist holidays
// (Makha Bucha, Visakha Bucha, Asalha Bucha, Buddhist Lent) and government
// "compensation day" (วันหยุดชดเชย) substitutions, since both shift yearly
// and are announced by cabinet resolution — add them here once confirmed
// for the year in question, keyed as 'YYYY-MM-DD' in THAI_HOLIDAYS_DATED.

var THAI_HOLIDAYS_FIXED = [
  { month: 1,  day: 1,  name_en: "New Year's Day",       name_th: 'วันขึ้นปีใหม่' },
  { month: 4,  day: 6,  name_en: 'Chakri Day',            name_th: 'วันจักรี' },
  { month: 4,  day: 13, name_en: 'Songkran Festival',     name_th: 'วันสงกรานต์' },
  { month: 4,  day: 14, name_en: 'Songkran Festival',     name_th: 'วันสงกรานต์' },
  { month: 4,  day: 15, name_en: 'Songkran Festival',     name_th: 'วันสงกรานต์' },
  { month: 5,  day: 1,  name_en: 'National Labor Day',    name_th: 'วันแรงงานแห่งชาติ' },
  { month: 5,  day: 4,  name_en: 'Coronation Day',        name_th: 'วันฉัตรมงคล' },
  { month: 7,  day: 28, name_en: "King's Birthday",       name_th: 'วันเฉลิมพระชนมพรรษา ร.10' },
  { month: 8,  day: 12, name_en: "Mother's Day",          name_th: 'วันแม่แห่งชาติ' },
  { month: 10, day: 13, name_en: 'King Bhumibol Memorial Day', name_th: 'วันคล้ายวันสวรรคต ร.9' },
  { month: 10, day: 23, name_en: 'Chulalongkorn Day',     name_th: 'วันปิยมหาราช' },
  { month: 12, day: 5,  name_en: "Father's Day",          name_th: 'วันพ่อแห่งชาติ' },
  { month: 12, day: 10, name_en: 'Constitution Day',      name_th: 'วันรัฐธรรมนูญ' },
  { month: 12, day: 31, name_en: "New Year's Eve",        name_th: 'วันสิ้นปี' }
];

// Year-specific holidays confirmed by cabinet resolution (lunar-calendar
// observances, compensation days). Empty until confirmed dates are supplied.
var THAI_HOLIDAYS_DATED = {};

/**
 * Returns holidays for the given year as { 'YYYY-MM-DD': { name_en, name_th } },
 * merging the fixed-date list with any confirmed dated entries for that year.
 */
function getHolidays(year) {
  year = year || new Date().getFullYear();
  var out = {};
  THAI_HOLIDAYS_FIXED.forEach(function (h) {
    var key = year + '-' + ('0' + h.month).slice(-2) + '-' + ('0' + h.day).slice(-2);
    out[key] = { name_en: h.name_en, name_th: h.name_th };
  });
  Object.keys(THAI_HOLIDAYS_DATED).forEach(function (key) {
    if (key.indexOf(String(year) + '-') === 0) out[key] = THAI_HOLIDAYS_DATED[key];
  });
  return out;
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
