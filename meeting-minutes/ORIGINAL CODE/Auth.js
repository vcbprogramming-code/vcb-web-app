/**
 * Auth.gs — magic-link sign-in + per-project access for the VCB Meeting Minutes app.
 *
 * Sign-in works for ANY email (gmail, hotmail, anything): the app emails a one-time
 * link; clicking it proves inbox ownership and starts a session (remembered ~30 days).
 * The public dashboard (project tiles) is visible to everyone; opening a meeting
 * requires sign-in, and each signed-in email only sees the projects it's allowed for.
 */

var DOMAIN = 'vcb-con.com';
var SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // remember a signed-in device 30 days
var MAGIC_TTL_SEC = 30 * 60;                   // a magic link is valid 30 minutes
var MAGIC_RATE_SEC = 45;                       // min seconds between link requests per email

/* ----------------------------- identity ----------------------------------- */
function googleEmail_() {
  try { return (Session.getActiveUser().getEmail() || '').toLowerCase(); } catch (e) { return ''; }
}
function isAdminEmail_(email) {
  email = (email || '').toLowerCase();
  return ADMIN_EMAILS.some(function (a) { return a.toLowerCase() === email; });
}
// Effective email for a request. The web app requires a Google sign-in, so Google
// has already gated entry; we use the Google session purely to recognise admins and
// @vcb-con.com staff. External Google accounts come through with an empty email
// (the platform hides it when the app runs as the owner) — that's fine, they're
// still allowed to read visible meetings. The `token` arg is kept for call-site
// compatibility but is no longer used (the magic-link sign-in was retired).
// Effective email for a request: the app's OWN session first, then Google's.
//
// Under this deployment (ANYONE_ANONYMOUS + USER_DEPLOYING) Google hides the
// visitor's email from the script — googleEmail_() returns '' for everyone
// except the deploying owner. This function used to return googleEmail_()
// unconditionally and ignore its `token` argument, so an editor could hold a
// perfectly valid session and STILL be identified as nobody: isEditorEmail_('')
// is false, so the ✎ Edit button never rendered and every write path refused
// them. The token is now actually consulted, which is the whole point of
// having one.
function identify_(token) {
  var fromSession = emailFromToken_(token);
  if (fromSession) return fromSession;
  return googleEmail_();
}

/* ------------------------- app session tokens ------------------------------ */
function makeSession_(email, isAdminSession) {
  var token = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty(
    'SESS_' + token, JSON.stringify({
      email: String(email || '').toLowerCase(),
      admin: !!isAdminSession,
      exp: Date.now() + SESSION_TTL_MS
    }));
  return token;
}
function sessionRecord_(token) {
  if (!token) return null;
  try {
    var raw = PropertiesService.getScriptProperties().getProperty('SESS_' + token);
    if (!raw) return null;
    var rec = JSON.parse(raw);
    if (!rec.exp || Date.now() > rec.exp) {
      PropertiesService.getScriptProperties().deleteProperty('SESS_' + token); return null;
    }
    return rec;
  } catch (e) { return null; }
}
function emailFromToken_(token) {
  var rec = sessionRecord_(token);
  return rec ? (rec.email || '') : '';
}
function signOut(token) {
  if (token) PropertiesService.getScriptProperties().deleteProperty('SESS_' + token);
  return true;
}

/* --------------------- password-gated admin session ------------------------ */
// Lets the control panel be reached without a resolvable Google identity (the
// web app runs ANYONE_ANONYMOUS, so Session.getActiveUser() is blank for every
// visitor). Set ADMIN_PASSWORD as a Script Property to enable; unset = disabled
// (adminLogin always fails). A correct password mints a session token flagged
// admin:true, checked by isAdmin_ alongside the Google-email match.
function adminLogin(password) {
  var expected = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!expected) throw new Error('Admin password is not configured.');
  if (String(password || '') !== String(expected)) throw new Error('Incorrect password.');
  return { token: makeSession_('', true) };
}
function isAdminSessionToken_(token) {
  var rec = sessionRecord_(token);
  return !!(rec && rec.admin);
}

/* --------------------------- magic-link sign-in ---------------------------- */
// Anyone who has access to at least one project (or is an admin) gets a link.
// Unknown emails are silently ignored (no link, no error) so the app can't be used
// to spam arbitrary inboxes or to probe which addresses are allow-listed.
// Does this address have any access WORTH SIGNING IN FOR?
//
// Deliberately not canSeeProject_: that now returns true for a public project
// whoever is asking, which is right for reading but wrong here — it would
// make every address on earth "have access" and turn the sign-in form into an
// open mail relay. What earns a link is access an anonymous visitor does NOT
// already have: being an admin, an editor, or named on a specific project.
function emailHasAnyAccess_(email) {
  email = (email || '').toLowerCase();
  if (!email) return false;
  if (isAdminEmail_(email)) return true;
  if (isEditorEmail_(email)) return true;
  var map = getProjectAccessMap_();
  var isDomain = email.split('@')[1] === DOMAIN;
  var allProjects = getAllProjects_();
  for (var i = 0; i < allProjects.length; i++) {
    var rule = map[allProjects[i].id];
    if (!rule) continue;
    if (rule.domain && isDomain) return true;
    if ((rule.emails || []).some(function (x) { return String(x).toLowerCase() === email; })) return true;
  }
  return false;
}

function requestMagicLink(email) {
  email = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Please enter a valid email address.');
  var cache = CacheService.getScriptCache();
  // Rate-limit per email so the link button can't be hammered.
  if (cache.get('RL_' + email)) return { ok: true }; // pretend success; a link was just sent
  cache.put('RL_' + email, '1', MAGIC_RATE_SEC);

  // Only actually send to emails that have access somewhere (silent otherwise).
  if (!emailHasAnyAccess_(email)) return { ok: true };

  var token = Utilities.getUuid().replace(/-/g, '');
  cache.put('MAGIC_' + token, email, MAGIC_TTL_SEC);
  var exec = getExecUrl_();
  var link = exec + (exec.indexOf('?') > -1 ? '&' : '?') + 'login=' + encodeURIComponent(token);
  MailApp.sendEmail({
    to: email,
    subject: APP_TITLE + ' — your sign-in link',
    htmlBody:
      '<div style="font-family:Sarabun,Arial,sans-serif;font-size:15px;color:#1f2328;line-height:1.6">' +
      '<p>Tap the button below to sign in to <b>' + APP_TITLE + '</b>:</p>' +
      '<p style="margin:22px 0"><a href="' + link + '" ' +
      'style="background:#0b3d62;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">Sign in</a></p>' +
      '<p style="color:#57606a;font-size:13px">This link works once and expires in 30 minutes. ' +
      'If you didn\'t request it, you can ignore this email.</p>' +
      '<p style="color:#8b949e;font-size:12px;word-break:break-all">Or paste this link:<br>' + link + '</p></div>'
  });
  return { ok: true };
}

// Consume a magic-link token (single use) → email, or '' if invalid/expired.
function consumeMagicToken_(token) {
  if (!token) return '';
  var cache = CacheService.getScriptCache();
  var email = cache.get('MAGIC_' + token);
  if (!email) return '';
  cache.remove('MAGIC_' + token);
  return email;
}

/* --------------------- editor sign-in (Google, preferred) ------------------ */
// THE PREFERRED WAY IN. Google verifies who the person is; this app never sees
// or stores a password, and there is nothing to share, leak or reuse.
//
// Why it can't just use Session.getActiveUser(): the deployment is
// ANYONE_ANONYMOUS + USER_DEPLOYING so that readers need no account and the
// script can reach the private Sheet as the owner. PROBED on the live
// deployment (2026-08-20), an anonymous visitor yields:
//     {"activeUser":"","effectiveUser":"<owner>"}
// — Apps Script exposes no visitor identity at all. Changing the manifest to
// get one would force EVERY reader to have a Google account and sign in, which
// is precisely what we don't want.
//
// So identity comes from Google Identity Services in the BROWSER instead: it
// returns a signed JWT (an ID token) for whoever signed in, the client posts
// that here, and this verifies it with Google before trusting a single field.
//
// Set GOOGLE_CLIENT_ID (Script Property) to enable. Until then this throws a
// clear message and the password login remains available as the fallback.
function getGoogleClientId() {
  return PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID') || '';
}

// Verify an ID token WITH GOOGLE. Never decode-and-trust locally: a JWT is only
// base64, so anyone could hand us {"email":"boss@vcb-con.com"} and be believed.
// Google's tokeninfo endpoint checks the signature, issuer and expiry for us.
function verifyGoogleIdToken_(idToken) {
  var clientId = getGoogleClientId();
  if (!clientId) throw new Error('Google sign-in is not configured yet. Ask an admin to set GOOGLE_CLIENT_ID.');
  if (!idToken) throw new Error('Sign-in failed. Please try again.');

  var resp = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) throw new Error('Sign-in failed. Please try again.');

  var info;
  try { info = JSON.parse(resp.getContentText()); } catch (e) { throw new Error('Sign-in failed. Please try again.'); }

  // aud must be OUR client id, or a token minted for some other site would be
  // accepted here (token-substitution).
  if (String(info.aud) !== String(clientId)) throw new Error('Sign-in failed. Please try again.');
  // Google says the address is verified, not merely claimed.
  if (String(info.email_verified) !== 'true' && info.email_verified !== true) {
    throw new Error('Your Google account email is not verified.');
  }
  // tokeninfo rejects expired tokens itself; belt-and-braces in case of clock skew.
  if (info.exp && (Number(info.exp) * 1000) < Date.now()) throw new Error('Sign-in expired. Please try again.');

  return String(info.email || '').toLowerCase();
}

// Exchange a Google ID token for an app session.
function googleEditorLogin(idToken) {
  var email = verifyGoogleIdToken_(idToken);
  if (!email) throw new Error('Sign-in failed. Please try again.');

  // Being authenticated is not the same as being authorised.
  if (!(isAdminEmail_(email) || isEditorEmail_(email))) {
    // Safe to name the address here: they already proved they own it, so this
    // reveals nothing they don't know. Vagueness would just be confusing.
    throw new Error(email + ' does not have edit access. Ask an admin to add you as an editor.');
  }

  // NOT an admin session — see isAdmin_ in Code.js. Proving an identity is the
  // right bar for editing content, not for managing access, projects or API
  // keys; those stay behind the Google account the app is deployed as, or
  // ADMIN_PASSWORD.
  return { token: makeSession_(email, false), user: email, isAdmin: false, isEditor: true, mustChange: false };
}

/* ------------------- editor sign-in (password, fallback) ------------------- */
// WHY THE APP HAS ITS OWN LOGIN: the deployment is ANYONE_ANONYMOUS +
// USER_DEPLOYING, so Google never tells the script who a visitor is
// (googleEmail_() is '' for everyone but the owner). EDITOR_EMAILS cannot be
// matched against anything on its own, which is why an allow-listed employee
// used to see no ✎ Edit button at all. Identity has to come from credentials
// the app itself verifies.
//
// Email + password, one account per person: the audit log names a real person,
// and revoking one employee doesn't disturb anyone else.
//
// Passwords are stored SALTED AND HASHED, never in plaintext:
//   EDITOR_CREDS = { "<email>": { salt, hash, rounds, mustChange, setAt } }
// Script Properties are readable by anyone who can open the Apps Script
// project, so a plaintext password there would leak every editor's password
// (and people reuse passwords). Hashing means a leak of the property yields
// nothing directly usable.
//
// PBKDF2 is not available in Apps Script, so this uses iterated SHA-256 over
// (salt + password). Iteration makes an offline guessing attack expensive;
// the per-user random salt makes one precomputed table useless against all
// accounts. Not bcrypt/argon2 — Apps Script offers no memory-hard primitive —
// but far beyond the plaintext it replaces.
// MEASURED on the live deployment, not estimated: Utilities.computeDigest costs
// ~0.98ms per call, so 12000 rounds took 11.8 SECONDS per login — unusable.
// 1200 rounds ≈ 1.2s, which is the most that still feels like a login rather
// than a hang. Raise only after re-measuring (?diag=hashtime while the probe
// exists); Apps Script's per-execution ceiling is 360s but users give up long
// before that.
//
// Be clear-eyed about what this buys: 1200 rounds is far weaker than bcrypt and
// would not stop a determined offline attacker who obtained EDITOR_CREDS. The
// real protections are that the property is only readable by someone who can
// already open the Apps Script project (i.e. an admin), that each password is
// uniquely salted, and that online guessing is throttled by EDITOR_LOCK_TRIES.
// Hashing here is defence in depth against a leak, not a substitute for
// treating that property as a secret.
var EDITOR_HASH_ROUNDS = 1200;
// 4-digit numeric PIN, at the owner's request (2026-08-20). Short and easy to
// hand over verbally, but only 10,000 combinations — so the ONLINE lockout is
// what actually protects it, not the length. Kept deliberately tight: 5 wrong
// tries then a 15-minute freeze means ~20 guesses/hour, which makes exhausting
// the space take years. Do NOT relax EDITOR_LOCK_* without revisiting this.
var EDITOR_PIN_LENGTH = 4;
var EDITOR_PIN_RE = /^[0-9]{4}$/;
var EDITOR_LOCK_TRIES = 5;           // failed attempts before a cooldown (tight: a 4-digit PIN is only 10k wide)
var EDITOR_LOCK_SEC = 15 * 60;       // cooldown length

function getEditorCreds_() {
  try {
    var v = PropertiesService.getScriptProperties().getProperty('EDITOR_CREDS');
    return v ? JSON.parse(v) : {};
  } catch (e) { return {}; }
}
function setEditorCreds_(map) {
  PropertiesService.getScriptProperties().setProperty('EDITOR_CREDS', JSON.stringify(map || {}));
}

// Iterated SHA-256. Returns a hex string.
function hashPassword_(password, salt, rounds) {
  rounds = rounds || EDITOR_HASH_ROUNDS;
  var bytes = Utilities.newBlob(String(salt) + String(password)).getBytes();
  for (var i = 0; i < rounds; i++) {
    bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  }
  return bytes.map(function (b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

// Constant-time-ish comparison: compare every character regardless of where the
// first mismatch is, so response timing doesn't leak how much of a hash matched.
function safeEquals_(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  return diff === 0;
}

function editorLockKey_(email) { return 'ELOCK_' + String(email || '').toLowerCase(); }

/* ------------------------- shared team PIN (optional) ---------------------- */
// ONE PIN that any listed editor may use, so an admin can tell a handful of
// trusted people a single number instead of creating an account each. Off until
// an admin sets it.
//
// It does NOT replace the editor list: the email must still be on EDITOR_EMAILS
// (see editorLogin), so knowing the shared PIN is useless on its own and
// removing someone from the list still locks them out immediately.
//
// The obvious trade-off, and the reason per-person PINs remain the default:
// everyone who has it is indistinguishable in the audit log beyond the email
// they typed, and it cannot be revoked for one person — changing it changes it
// for all of them. Fine for a small circle of confidants; not for wide access.
// Stored hashed, exactly like a personal PIN, so a leak of the property yields
// nothing directly usable.
function getSharedEditorPin_() {
  return PropertiesService.getScriptProperties().getProperty('EDITOR_SHARED_HASH') || '';
}
function getSharedEditorSalt_() {
  return PropertiesService.getScriptProperties().getProperty('EDITOR_SHARED_SALT') || '';
}

// Is a shared PIN configured, and what is it?
//
// The shared PIN is stored RECOVERABLY (alongside the hash used for
// verification), unlike a personal PIN. That is deliberate, not an oversight:
// its whole purpose is to be told to people, so an admin who forgets it must be
// able to look it up rather than reset it and break everyone else's access at
// once. Admin-only, and only ever returned when `reveal` is explicitly
// requested — so it is not sitting in every bootstrap payload.
//
// Personal PINs are NOT recoverable and never will be: they are one-way hashed,
// so nobody — including an admin, including this code — can read them back.
// That is the point of hashing. An admin who needs to help someone sets a new
// PIN for them instead.
function getSharedPinStatus(token, reveal) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  var props = PropertiesService.getScriptProperties();
  var setAt = props.getProperty('EDITOR_SHARED_SETAT') || '';
  var out = { enabled: !!getSharedEditorPin_(), setAt: setAt };
  if (reveal) out.pin = props.getProperty('EDITOR_SHARED_PLAIN') || '';
  return out;
}

function setSharedEditorPin(pin, token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  pin = String(pin || '').trim();
  if (!EDITOR_PIN_RE.test(pin)) {
    throw new Error('PIN must be exactly ' + EDITOR_PIN_LENGTH + ' digits (0-9).');
  }
  var props = PropertiesService.getScriptProperties();
  var salt = Utilities.getUuid().replace(/-/g, '');
  props.setProperty('EDITOR_SHARED_SALT', salt);
  props.setProperty('EDITOR_SHARED_HASH', hashPassword_(pin, salt, EDITOR_HASH_ROUNDS));
  props.setProperty('EDITOR_SHARED_SETAT', new Date().toISOString());
  // Kept recoverable ON PURPOSE so an admin can look it up later to tell
  // someone — see getSharedPinStatus. A personal PIN is never stored this way.
  props.setProperty('EDITOR_SHARED_PLAIN', pin);
  auditLog_('set_shared_editor_pin', 'editor', 'shared', {});
  return { ok: true };
}

function clearSharedEditorPin(token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('EDITOR_SHARED_HASH');
  props.deleteProperty('EDITOR_SHARED_SALT');
  props.deleteProperty('EDITOR_SHARED_SETAT');
  props.deleteProperty('EDITOR_SHARED_PLAIN');
  auditLog_('clear_shared_editor_pin', 'editor', 'shared', {});
  return { ok: true };
}

// Admin sets or resets an employee's password. Also used to hand out the first
// one; mustChange forces the employee to pick their own on first sign-in, so
// the admin does not keep knowing it.
function setEditorPassword(email, password, token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  email = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Please enter a valid email address.');
  password = String(password || '').trim();
  if (!EDITOR_PIN_RE.test(password)) {
    throw new Error('PIN must be exactly ' + EDITOR_PIN_LENGTH + ' digits (0-9).');
  }
  // Only people on the editor list get an account, so the two can't drift apart.
  if (!isEditorEmail_(email)) throw new Error('Add this email as an editor first.');

  var salt = Utilities.getUuid().replace(/-/g, '');
  var creds = getEditorCreds_();
  creds[email] = {
    salt: salt,
    hash: hashPassword_(password, salt, EDITOR_HASH_ROUNDS),
    rounds: EDITOR_HASH_ROUNDS,
    mustChange: true,          // employee must choose their own on first login
    setAt: new Date().toISOString()
  };
  setEditorCreds_(creds);
  CacheService.getScriptCache().remove(editorLockKey_(email));  // clear any lockout
  auditLog_('set_editor_password', 'editor', email, {});
  return { ok: true };
}

// Which editors have a password set — so the admin panel can show who can
// actually sign in. Never returns hashes.
function getEditorAccounts(token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  var creds = getEditorCreds_();
  return getEditorEmails_().map(function (e) {
    var c = creds[String(e).toLowerCase()];
    return { email: e, hasPassword: !!c, mustChange: !!(c && c.mustChange), setAt: c ? c.setAt : '' };
  });
}

function clearEditorPassword(email, token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  email = String(email || '').trim().toLowerCase();
  var creds = getEditorCreds_();
  delete creds[email];
  setEditorCreds_(creds);
  auditLog_('clear_editor_password', 'editor', email, {});
  return { ok: true };
}

// Sign in. Deliberately vague on failure — "Incorrect email or password" for
// both an unknown account and a wrong password, so this can't be used to
// discover who has edit access.
function editorLogin(email, password) {
  email = String(email || '').trim().toLowerCase();
  password = String(password || '');
  var cache = CacheService.getScriptCache();
  var lockKey = editorLockKey_(email);

  // Throttle guessing. Counts failures per email over a rolling window.
  var raw = cache.get(lockKey);
  var fails = raw ? Number(raw) || 0 : 0;
  if (fails >= EDITOR_LOCK_TRIES) {
    throw new Error('Too many failed attempts. Try again in 15 minutes, or ask an admin to reset your password.');
  }

  var creds = getEditorCreds_();
  var rec = creds[email];
  var ok = false;
  var usedShared = false;
  if (rec && rec.hash) {
    ok = safeEquals_(hashPassword_(password, rec.salt, rec.rounds || EDITOR_HASH_ROUNDS), rec.hash);
  }
  // Fall back to the SHARED team PIN. Convenience option so an admin can hand
  // one PIN to several trusted people instead of creating an account each.
  // Still requires the email to be on the editor list, so the shared PIN alone
  // is not enough — it is a second factor of "and you are one of these people",
  // not a skeleton key.
  if (!ok && getSharedEditorPin_()) {
    ok = safeEquals_(hashPassword_(password, getSharedEditorSalt_(), EDITOR_HASH_ROUNDS), getSharedEditorPin_());
    if (ok) usedShared = true;
  }
  // Re-check the allow-list at login, not just when the password was set: an
  // admin may have removed this person since.
  if (ok && !(isAdminEmail_(email) || isEditorEmail_(email))) {
    throw new Error('This email no longer has edit access.');
  }

  if (!ok) {
    cache.put(lockKey, String(fails + 1), EDITOR_LOCK_SEC);
    throw new Error('Incorrect email or password.');
  }

  cache.remove(lockKey);
  // NOT an admin session — see isAdmin_ in Code.js. An editor password is the
  // right bar for editing content, not for managing access, projects or API
  // keys. Admin still requires the Google account or ADMIN_PASSWORD.
  return {
    token: makeSession_(email, false),
    user: email,
    isAdmin: false,
    isEditor: true,
    // Never force a password change on the SHARED pin — "change your password"
    // is meaningless for a credential several people hold, and changing it
    // would silently lock the others out. `rec` is also undefined in that case,
    // so this must not be read blindly.
    mustChange: !usedShared && !!(rec && rec.mustChange),
    usedSharedPin: usedShared
  };
}

// Employee changes their own password (required on first sign-in, optional
// after). Requires the current one, so a borrowed unlocked browser can't be
// used to lock the real owner out.
function changeEditorPassword(currentPassword, newPassword, token) {
  var email = emailFromToken_(token);
  if (!email) throw new Error('Please sign in first.');
  newPassword = String(newPassword || '').trim();
  if (!EDITOR_PIN_RE.test(newPassword)) {
    throw new Error('New PIN must be exactly ' + EDITOR_PIN_LENGTH + ' digits (0-9).');
  }
  var creds = getEditorCreds_();
  var rec = creds[email];
  if (!rec || !rec.hash) throw new Error('No password is set for this account.');
  if (!safeEquals_(hashPassword_(currentPassword, rec.salt, rec.rounds || EDITOR_HASH_ROUNDS), rec.hash)) {
    throw new Error('Current password is incorrect.');
  }
  var salt = Utilities.getUuid().replace(/-/g, '');
  creds[email] = {
    salt: salt,
    hash: hashPassword_(newPassword, salt, EDITOR_HASH_ROUNDS),
    rounds: EDITOR_HASH_ROUNDS,
    mustChange: false,
    setAt: new Date().toISOString()
  };
  setEditorCreds_(creds);
  setActor_(token);
  auditLog_('change_editor_password', 'editor', email, {});
  return { ok: true };
}

// End an editor session (the "Sign out" control). Harmless if already gone.
function editorSignOut(token) {
  try {
    if (token) PropertiesService.getScriptProperties().deleteProperty('SESS_' + token);
  } catch (e) {}
  return { ok: true };
}

/* --------------------- editor access (edit, not admin) --------------------- */
// A self-service tier below admin: editors can edit/create/delete meeting
// content and attachments, and file inbox recordings into projects, but they
// cannot manage access lists, projects, or API keys. Stored the same way as
// ALLOWED_VIEWERS — a Script Property, editable from the Access UI, no redeploy.
function getEditorEmails_() {
  try {
    var v = PropertiesService.getScriptProperties().getProperty('EDITOR_EMAILS');
    return v ? JSON.parse(v) : [];
  } catch (e) { return []; }
}
function setEditorEmails_(list) {
  PropertiesService.getScriptProperties().setProperty('EDITOR_EMAILS', JSON.stringify(list || []));
}
function isEditorEmail_(email) {
  email = (email || '').toLowerCase();
  if (!email) return false;
  return getEditorEmails_().some(function (x) { return String(x).toLowerCase() === email; });
}
// True for admins too — admins can do everything an editor can.
function isEditorOrAdmin_(token) {
  if (isAdminSessionToken_(token)) return true;
  var email = identify_(token);
  return isAdminEmail_(email) || isEditorEmail_(email);
}
function getEditors(token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  return getEditorEmails_();
}
function addEditor(email, token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  email = String(email || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Please enter a valid email address.');
  var list = getEditorEmails_();
  if (!list.some(function (x) { return String(x).toLowerCase() === email.toLowerCase(); })) list.push(email);
  setEditorEmails_(list);
  return list;
}
function removeEditor(email, token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  var list = getEditorEmails_().filter(function (x) { return String(x).toLowerCase() !== String(email).toLowerCase(); });
  setEditorEmails_(list);
  return list;
}

/* ----------------------- per-project access control ------------------------ */
// Script Property PROJECT_ACCESS = { "<projectId>": { "domain": bool, "emails": [..] } }
function getProjectAccessMap_() {
  try {
    var v = PropertiesService.getScriptProperties().getProperty('PROJECT_ACCESS');
    return v ? JSON.parse(v) : {};
  } catch (e) { return {}; }
}
function setProjectAccessMap_(map) {
  PropertiesService.getScriptProperties().setProperty('PROJECT_ACCESS', JSON.stringify(map || {}));
}

// Can this email read the meetings in this project?
//
// The rule, in one line: a PUBLIC project is readable by everyone (no sign-in
// at all), a LOCKED project only by admins, editors, and the exact addresses
// an admin has named for it.
//
// A locked project is NOT open to the whole @vcb-con.com domain. That is the
// deliberate change from the earlier draft of this function: "locked" now
// means a named guest list, so a project can be shared with three specific
// colleagues without being shared with every staff address. Anyone not on the
// list — same domain or not — is treated exactly like an outsider.
//
// `rule.domain` is still honoured as an explicit opt-in, so an admin can
// re-open a locked project to all staff if they ever want that back, but it is
// off unless somebody sets it.
function canSeeProject_(projectId, email) {
  if (docVisibleDefault_(projectId)) return true; // public → no sign-in needed
  email = (email || '').toLowerCase();
  if (!email) return false;                       // locked + anonymous → nothing
  if (isAdminEmail_(email)) return true;
  if (isEditorEmail_(email)) return true;         // editors may edit everything, so they may read it
  var rule = getProjectAccessMap_()[projectId];
  if (!rule) return false;                        // locked, no list → admins/editors only
  if (rule.domain && email.split('@')[1] === DOMAIN) return true;
  return (rule.emails || []).some(function (x) { return String(x).toLowerCase() === email; });
}

// Per-request memo for the listing loops. canSeeProject_ reads two Script
// Properties every call, and listMeetings/searchMeetings/getSessionState call
// it once PER ROW — on a few hundred rows that is hundreds of redundant
// property reads on a single request. Resolving each project id once keeps
// those loops to one lookup each.
function projectVisibilityFor_(email) {
  var seen = {};
  return function (projectId) {
    if (!(projectId in seen)) seen[projectId] = canSeeProject_(projectId, email);
    return seen[projectId];
  };
}

/* ------------------ admin: per-project access management ------------------- */
function getProjectAccess(token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  var map = getProjectAccessMap_();
  return getAllProjects_().slice().sort(function (a, b) { return a.order - b.order; }).map(function (d) {
    // No fallback to docVisibleDefault_ for `domain` any more: a project being
    // public says nothing about whether all staff are allow-listed on it, and
    // reporting it as an enabled domain rule made the panel display a staff
    // rule that canSeeProject_ was not actually applying.
    var r = map[d.id] || { domain: false, emails: [] };
    return {
      id: d.id, name: d.name, nameEn: d.nameEn, color: d.color,
      domain: !!r.domain, emails: r.emails || [],
      isPublic: docVisibleDefault_(d.id)
    };
  });
}
// Lock/unlock a whole project: unlocking makes every current meeting in it
// visible to all staff right now, and makes any meeting imported into it
// later default to visible too. Locking only stops the future default —
// meetings already made visible stay visible (matches setVisibility's normal
// one-at-a-time behaviour; an admin can still hide individual meetings).
function setProjectPublic(projectId, isPublic, token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  if (!getDocById_(projectId)) throw new Error('Unknown project: ' + projectId);
  setProjectPublicOverride_(projectId, isPublic);
  if (isPublic) {
    var sheet = getSheet_();
    var visibleCol = COLUMNS.indexOf('visible') + 1;
    readAllRows_().forEach(function (r) {
      if (r.projectId === projectId && !isVisible_(r)) {
        sheet.getRange(r._rowIndex, visibleCol).setValue('TRUE');
      }
    });
  }
  return getProjectAccess(token);
}
function setProjectDomain(projectId, allowDomain, token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  var map = getProjectAccessMap_(); var r = map[projectId] || { domain: false, emails: [] };
  r.domain = !!allowDomain; map[projectId] = r; setProjectAccessMap_(map); return getProjectAccess(token);
}
function addProjectViewer(projectId, email, token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  email = String(email || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Please enter a valid email address.');
  var map = getProjectAccessMap_(); var r = map[projectId] || { domain: false, emails: [] };
  r.emails = r.emails || [];
  if (!r.emails.some(function (x) { return x.toLowerCase() === email.toLowerCase(); })) r.emails.push(email);
  map[projectId] = r; setProjectAccessMap_(map); return getProjectAccess(token);
}
function removeProjectViewer(projectId, email, token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  var map = getProjectAccessMap_(); var r = map[projectId]; if (!r) return getProjectAccess(token);
  r.emails = (r.emails || []).filter(function (x) { return x.toLowerCase() !== String(email).toLowerCase(); });
  map[projectId] = r; setProjectAccessMap_(map); return getProjectAccess(token);
}

// Add several viewers in one go. The admin panel lets an address list be
// pasted straight in ("a@x.com, b@y.com" — commas, semicolons, spaces or
// newlines), because naming the five people who may see a project one
// round-trip at a time is the tedious part of running a guest list.
// Invalid entries are reported rather than silently dropped, so a typo does
// not quietly leave somebody without access.
function addProjectViewers(projectId, emailsText, token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  if (!getDocById_(projectId)) throw new Error('Unknown project: ' + projectId);
  var parts = String(emailsText || '').split(/[\s,;]+/).filter(Boolean);
  if (!parts.length) throw new Error('Enter at least one email address.');
  var bad = parts.filter(function (e) { return !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); });
  if (bad.length) throw new Error('Not a valid email address: ' + bad.join(', '));
  var map = getProjectAccessMap_();
  var r = map[projectId] || { domain: false, emails: [] };
  r.emails = r.emails || [];
  parts.forEach(function (email) {
    var dup = r.emails.some(function (x) { return String(x).toLowerCase() === email.toLowerCase(); });
    if (!dup) r.emails.push(email);
  });
  map[projectId] = r;
  setProjectAccessMap_(map);
  return getProjectAccess(token);
}

// Copy one project's guest list onto other projects. Several projects often
// share the same audience, and re-typing the same addresses per project is
// both slow and the easiest way to end up with lists that quietly disagree.
function copyProjectViewers(fromProjectId, toProjectIds, token) {
  if (!isAdmin_(token)) throw new Error('Not authorized.');
  var map = getProjectAccessMap_();
  var src = (map[fromProjectId] && map[fromProjectId].emails) || [];
  if (!src.length) throw new Error('That project has no named people to copy.');
  (toProjectIds || []).forEach(function (pid) {
    if (pid === fromProjectId || !getDocById_(pid)) return;
    // A public project is readable by everyone, so a guest list on it means
    // nothing. Skip rather than write a list that silently does nothing —
    // the client filters these out too, but its copy can be a render stale.
    if (docVisibleDefault_(pid)) return;
    var r = map[pid] || { domain: false, emails: [] };
    r.emails = r.emails || [];
    src.forEach(function (email) {
      var dup = r.emails.some(function (x) { return String(x).toLowerCase() === String(email).toLowerCase(); });
      if (!dup) r.emails.push(email);
    });
    map[pid] = r;
  });
  setProjectAccessMap_(map);
  return getProjectAccess(token);
}

/* ----------------------- bootstrap ------------------------ */
// The web app requires a Google sign-in, so anyone who reaches it is allowed to
// read visible meetings. Both bootstrap builders therefore report authed:true; the
// only thing the Google session changes is admin powers (and seeing hidden rows).

// Lightweight bootstrap injected at page load (doGet) for instant first paint.
// First paint, before the client has handed us its session token. That means
// the only identity available here is the Google one, which this deployment
// blanks for everyone but the owner — so this must show the CONSERVATIVE view
// (public projects only) and let getSessionState widen it a moment later once
// the token identifies a named viewer. Erring the other way would flash a
// locked project on screen before hiding it again.
function getPublicBootstrap() {
  var email = googleEmail_();
  var admin = isAdminEmail_(email);
  var editor = admin || isEditorEmail_(email);
  var canSee = projectVisibilityFor_(email);
  var counts = {};
  try {
    readAllRows_().forEach(function (r) {
      // Inbox rows count only for admins (see listMeetings) — everyone else
      // reaches a recording through the projects it was tagged into.
      if (isInboxProjectId_(r.projectId)) {
        // Tagged-project rule, same as listMeetings: an inbox row counts
        // only if one of the projects it was filed into is open to them.
        if (!admin && !(isVisible_(r) && parseTaggedProjectIds_(r.taggedProjectId).some(canSee))) return;
      } else if (!(admin || (isVisible_(r) && canSee(r.projectId)))) return;
      counts[r.projectId] = (counts[r.projectId] || 0) + 1;
      // See getSessionState: taggedProjectId is a comma-separated list and
      // must be parsed, or a multi-tagged meeting is counted under neither.
      parseTaggedProjectIds_(r.taggedProjectId).forEach(function (pid) {
        if (!admin && !canSee(pid)) return;
        counts[pid] = (counts[pid] || 0) + 1;
      });
    });
  } catch (e) {}
  var projects = getAllProjects_().slice().sort(function (a, b) { return a.order - b.order; })
    .filter(function (d) { return admin || canSee(d.id); })
    .map(function (d) {
      return { id: d.id, name: d.name, nameEn: d.nameEn, cadence: d.cadence, color: d.color, count: counts[d.id] || 0, canSee: true };
    });
  // Fathom/Transkriptor Inbox are ADMIN-ONLY: they hold unreviewed recordings
  // that may be private, so not even editors see them. A recording reaches
  // other people only once the admin tags it into a project and publishes it.
  if (admin) {
    projects.push({
      id: FATHOM_INBOX_META.id, name: FATHOM_INBOX_META.name, nameEn: FATHOM_INBOX_META.nameEn,
      cadence: FATHOM_INBOX_META.cadence, color: FATHOM_INBOX_META.color,
      count: counts[FATHOM_INBOX_META.id] || 0, canSee: true
    });
    projects.push({
      id: TRANSKRIPTOR_INBOX_META.id, name: TRANSKRIPTOR_INBOX_META.name, nameEn: TRANSKRIPTOR_INBOX_META.nameEn,
      cadence: TRANSKRIPTOR_INBOX_META.cadence, color: TRANSKRIPTOR_INBOX_META.color,
      count: counts[TRANSKRIPTOR_INBOX_META.id] || 0, canSee: true
    });
  }
  return {
    appTitle: APP_TITLE, appDisplayTitle: APP_DISPLAY_TITLE, subtitle: APP_SUBTITLE,
    projects: projects, authed: true, user: email, isAdmin: admin,
    isEditor: editor, execUrl: getExecUrl_(),
    // Public by design — the Client ID identifies the app to Google, it is not
    // a secret. Empty until an admin sets it, which is how the client knows to
    // fall back to the password login.
    googleClientId: getGoogleClientId()
  };
}

// Fuller bootstrap the client fetches right after load (also runs first-load seeding).
function getSessionState(token) {
  // identify_, not googleEmail_: an editor signed in with an emailed code is
  // known only via their session token (Google hides visitor emails under this
  // deployment). Reading googleEmail_() here would make every reload forget
  // them and hide the ✎ Edit button again.
  var email = identify_(token);
  // Admin from the GOOGLE session or an ADMIN_PASSWORD login only — never from
  // an emailed-code session, which proves mailbox control but not admin. Must
  // stay identical to isAdmin_() in Code.js, or the UI would offer admin
  // controls that every server call then refuses.
  var admin = isAdminEmail_(googleEmail_()) || isAdminSessionToken_(token);
  var editor = admin || isEditorEmail_(email);
  try { ensureSeeded_(); } catch (e) {}
  var canSee = projectVisibilityFor_(email);
  var counts = {};
  readAllRows_().forEach(function (r) {
    // Inbox rows count only for admins (see listMeetings) — everyone else
    // reaches a recording through the projects it was tagged into.
    if (isInboxProjectId_(r.projectId)) {
      // Tagged-project rule, same as listMeetings: an inbox row counts only
      // if one of the projects it was filed into is open to them.
      if (!admin && !(isVisible_(r) && parseTaggedProjectIds_(r.taggedProjectId).some(canSee))) return;
    } else if (!(admin || (isVisible_(r) && canSee(r.projectId)))) return;
    counts[r.projectId] = (counts[r.projectId] || 0) + 1;
    // taggedProjectId holds a comma-separated LIST ("BT12,BV"), so it must be
    // parsed. Using the raw cell as a key created a bogus "BT12,BV" entry that
    // matched no project, so a meeting tagged into two projects was counted
    // under neither — it appeared in the list but not in any sidebar total.
    parseTaggedProjectIds_(r.taggedProjectId).forEach(function (pid) {
      if (!admin && !canSee(pid)) return;
      counts[pid] = (counts[pid] || 0) + 1;
    });
  });
  // A project the viewer is not named on is left OUT of the list rather than
  // sent with canSee:false — the sidebar would otherwise advertise the exact
  // set of projects somebody is being kept out of.
  var projects = getAllProjects_().slice().sort(function (a, b) { return a.order - b.order; })
    .filter(function (d) { return admin || canSee(d.id); })
    .map(function (d) {
    return {
      id: d.id, name: d.name, nameEn: d.nameEn, cadence: d.cadence, color: d.color,
      count: counts[d.id] || 0,
      canSee: true,
      docUrl: admin && d.docId ? ('https://docs.google.com/document/d/' + d.docId + '/edit') : ''
    };
  });
  // Fathom/Transkriptor Inbox are ADMIN-ONLY — see getPublicBootstrap's
  // identical comment above.
  if (admin) {
    projects.push({
      id: FATHOM_INBOX_META.id, name: FATHOM_INBOX_META.name, nameEn: FATHOM_INBOX_META.nameEn,
      cadence: FATHOM_INBOX_META.cadence, color: FATHOM_INBOX_META.color,
      count: counts[FATHOM_INBOX_META.id] || 0, canSee: true, docUrl: ''
    });
    projects.push({
      id: TRANSKRIPTOR_INBOX_META.id, name: TRANSKRIPTOR_INBOX_META.name, nameEn: TRANSKRIPTOR_INBOX_META.nameEn,
      cadence: TRANSKRIPTOR_INBOX_META.cadence, color: TRANSKRIPTOR_INBOX_META.color,
      count: counts[TRANSKRIPTOR_INBOX_META.id] || 0, canSee: true, docUrl: ''
    });
  }
  return {
    appTitle: APP_TITLE, appDisplayTitle: APP_DISPLAY_TITLE, subtitle: APP_SUBTITLE,
    authed: true, user: email, isAdmin: admin, isEditor: editor,
    googleClientId: getGoogleClientId(),
    projects: projects, dbUrl: admin ? getDb_().getUrl() : '', execUrl: getExecUrl_()
  };
}
