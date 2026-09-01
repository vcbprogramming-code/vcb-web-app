// DEPRECATED: the old write-only "Manual Submissions" sheet. Superseded by
// the MASTER sheet (see MASTER_SHEET_ID / setupMasterSheet). Kept only for
// reference; no longer read or written.
var STAGING_SHEET_ID = '1KHm9DLG0alfh4SifWiccwQOqMYjJQfBcqc0eG7ZhC0c';
var HTML_FILE_ID = '19k7Vlj56zV8-Yuecza0iYIWjHomGgvly';
var CLIENT_ID = '521733401644-tcqp5ahtonn3m2r1k71rgt1lnfrrs2kc.apps.googleusercontent.com';

// Sign-in uses a custom OAuth client (CLIENT_ID). Google rejects any
// redirect_uri not pre-registered on that client in Cloud Console, so the
// redirect URL must be STABLE and registered. A deployment's /exec URL is
// stable across version updates to the SAME deployment id — it only
// changes if a brand-new deployment is minted. We therefore pin it to the
// canonical public deployment below and update that deployment in place
// (clasp create-deployment -i <SAME id>). NEVER create a fresh deployment
// for this script: doing so changes this URL and breaks sign-in until the
// new URL is added to the OAuth client's Authorized redirect URIs.
// This exact value must be registered there. (Fallback to the live URL if
// somehow served from elsewhere, so the app still functions.)
var REDIRECT_URI = 'https://script.google.com/a/macros/vcb-con.com/s/AKfycbxv70XmRpmQf_9JKQsJwY_-N3oxc0llO4xQL52ycDdpW_HvaN_G1sG0GsRqePbLxROn/exec';
function getRedirectUri_() {
  return REDIRECT_URI || ScriptApp.getService().getUrl();
}

// Run this once after deploying, then open the execution log to read the
// exact redirect URL. Paste that value into Google Cloud Console >
// Credentials > (this OAuth client) > Authorized redirect URIs.
function logServiceUrl() {
  Logger.log('Register THIS exact URL as an Authorized redirect URI:');
  Logger.log(ScriptApp.getService().getUrl());
}

// RUN THIS ONCE in the editor (owner account). It actually touches
// Documents/Drive/Sheets/Gmail, so Google WILL show the "Authorization
// required" dialog — click Review permissions → Allow. After that the
// web app (which runs as the owner) can generate letters for everyone;
// no employee ever has to do this. Safe & idempotent: it creates a
// throwaway doc and immediately trashes it.
function authorizeAll() {
  var d = DocumentApp.create('VCB auth check — safe to delete');
  DriveApp.getFileById(d.getId()).setTrashed(true);
  try { SpreadsheetApp.openById(getMasterId_()); } catch (e) {}
  try { GmailApp.getInboxUnreadCount(); } catch (e) {}
  try { MailApp.getRemainingDailyQuota(); } catch (e) {}   // send_mail scope
  Logger.log('✅ All permissions granted. Close this — nothing else to do.');
}

function initSecret() {
  PropertiesService.getScriptProperties().setProperty(
    'OAUTH_CLIENT_SECRET', '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'
  );
  Logger.log('Secret stored.');
}

function doGet(e) {
  var code = e.parameter.code;
  if (code) {
    var diagMsg = '', usedRedirect = getRedirectUri_(), secretPresent = false;
    try {
      var clientSecret = PropertiesService.getScriptProperties().getProperty('OAUTH_CLIENT_SECRET');
      secretPresent = !!clientSecret;
      var tokenResp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
        method: 'post',
        payload: {
          code: code,
          client_id: CLIENT_ID,
          client_secret: clientSecret,
          redirect_uri: usedRedirect,
          grant_type: 'authorization_code'
        },
        muteHttpExceptions: true
      });
      var tokenData = JSON.parse(tokenResp.getContentText());
      diagMsg = 'token HTTP ' + tokenResp.getResponseCode() + ' · ' +
        (tokenData.error || (tokenData.access_token ? 'ok' : 'no access_token')) +
        (tokenData.error_description ? ' — ' + tokenData.error_description : '');
      if (tokenData.access_token) {
        var userResp = UrlFetchApp.fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { 'Authorization': 'Bearer ' + tokenData.access_token },
          muteHttpExceptions: true
        });
        var userInfo = JSON.parse(userResp.getContentText());
        var email = userInfo.email || '';
        if (email) {
          var token = Utilities.getUuid();
          // 7-day session. With webapp access = ANYONE + executeAs OWNER,
          // Session.getActiveUser() is blank, so the custom token is the
          // ONLY way the server knows the user — a short TTL meant a signed-
          // in user silently hit "Session expired" on every write after it
          // lapsed. A week keeps a working tab usable across the work week.
          var expires = new Date().getTime() + 7 * 24 * 60 * 60 * 1000;
          PropertiesService.getScriptProperties().setProperty('auth_' + token, email + '|' + expires);
          // Park the result by OAuth state so the app can poll for it
          // (iPad-safe — no popup→app postMessage needed).
          var st = e.parameter.state;
          if (st) {
            PropertiesService.getScriptProperties().setProperty(
              'ostate_' + st, token + '|' + email + '|' + (new Date().getTime() + 10 * 60 * 1000));
          }
          return HtmlService.createHtmlOutput(
            '<html><body>' +
      '<script>(function(){var d={type:"oauthToken",token:"' + token + '",email:"' + email + '"};var w=window.opener;try{if(!w&&window.parent)w=window.parent.opener;}catch(ex){}try{if(!w&&window.top)w=window.top.opener;}catch(ex){}try{if(w)w.postMessage(d,"*");}catch(ex){}' +
      'setTimeout(function(){try{(window.parent||window).close();}catch(ex){try{window.close();}catch(ex2){}}},500);})();<\/script>' +
            '<p style="font-family:sans-serif;padding:20px">Signed in as <b>' + email + '<\/b>. You may close this window.<\/p>' +
            '<\/body><\/html>'
          ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
        }
      }
    } catch(err) {
      Logger.log('OAuth error: ' + err);
      diagMsg = 'exception: ' + err;
    }
    return HtmlService.createHtmlOutput(
      '<html><body style="font-family:sans-serif;padding:20px;line-height:1.5">' +
      '<p><b>Sign-in failed.</b> Please close and try again.</p>' +
      '<p style="color:#b00020;font-size:13px;white-space:pre-wrap;word-break:break-word"><b>Reason:</b> ' + escHtml_(diagMsg || '(no detail)') + '</p>' +
      '<p style="color:#777;font-size:12px;white-space:pre-wrap;word-break:break-word">redirect_uri sent: ' + escHtml_(usedRedirect) + '<br>client secret stored: ' + (secretPresent ? 'yes' : 'NO — run initSecret()') + '</p>' +
      '<\/body><\/html>'
    );
  }
  // File viewer routes (Path B) — serve files via our own URL so the
  // iframe loads a standard https://script.google.com page instead of a
  // blob: URL. Edge's Scareware blocker silently blocks blob:-URL
  // iframes; this route looks like any other web-app navigation.
  if (e.parameter.action === 'fview' && e.parameter.id) {
    return serveDriveFileViewer_(e.parameter.id);
  }
  if (e.parameter.action === 'gview' && e.parameter.tid) {
    return serveGmailAttachmentViewer_(e.parameter.tid, e.parameter.mi, e.parameter.ai);
  }
  // One-click runners — opens in browser, executes the function as
  // USER_DEPLOYING, displays the result. Same effect as running the
  // function in the editor, but no editor required.
  if (e.parameter.action === 'runDiag') {
    var diag = testDriveAPI();
    return _runnerHtml_('testDriveAPI', diag);
  }
  if (e.parameter.action === 'rescueLpb') {
    var lpb = forceSaveByThreadId('19e3973ded6bf049');
    return _runnerHtml_('forceSaveByThreadId("19e3973ded6bf049")', lpb);
  }
  if (e.parameter.action === 'rescueAll') {
    var all = resaveAllPendingRows_();
    return _runnerHtml_('resaveAllPendingRows', all);
  }
  if (e.parameter.action === 'autolog') {
    var al = gmailAutoLog();
    return _runnerHtml_('gmailAutoLog', al);
  }
  if (e.parameter.action === 'relink') {
    return _runnerHtml_('relinkFromDriveByCode', relinkFromDriveByCode());
  }
  // Read-only row inspector: dumps a tab's Thread-ID / Drive Link / Source
  // cells so a "can't open / no attachments" report can be traced to the
  // actual cell contents. Writes nothing. ?action=rowDiag&tab=VC
  if (e.parameter.action === 'rowDiag') {
    return _runnerHtml_('rowDiag', rowDiag_(e.parameter.tab || 'VC'));
  }
  if (e.parameter.action === 'triggerStatus') {
    var trs = ScriptApp.getProjectTriggers().map(function (tr) {
      return { handler: tr.getHandlerFunction(), type: String(tr.getEventType()) };
    });
    return _runnerHtml_('triggerStatus', { triggers: trs, count: trs.length });
  }
  // Demo toggles: open Approve/Reject to ALL signed-in users, or restore
  // the manager allow-list. Runs as the owner (executeAs USER_DEPLOYING).
  if (e.parameter.action === 'initSecret') {
    initSecret();
    var hasSecret = !!PropertiesService.getScriptProperties().getProperty('OAUTH_CLIENT_SECRET');
    return _runnerHtml_('initSecret', { ok: hasSecret,
      note: hasSecret ? 'Client secret stored. Close this and try signing in again.' : 'Failed to store secret.' });
  }
  if (e.parameter.action === 'demoOn') {
    PropertiesService.getScriptProperties().setProperty('DEMO_ALL_MANAGERS', '1');
    return _runnerHtml_('demoOn', { ok: true, note: 'DEMO MODE ON — every signed-in user can Approve/Reject.' });
  }
  if (e.parameter.action === 'demoOff') {
    PropertiesService.getScriptProperties().deleteProperty('DEMO_ALL_MANAGERS');
    return _runnerHtml_('demoOff', { ok: true, note: 'DEMO MODE OFF — restored owner/MANAGEMENT_EMAILS allow-list.' });
  }
  // Shared single-document link (?doc=<id>): same index.html, but the
  // bootstrap value below tells the client to open straight into the
  // review panel for this one document and skip loading/showing the
  // dashboard list, so a recipient only ever sees the document they
  // were sent, never the full list of memos.
  var tpl = HtmlService.createTemplateFromFile('index');
  tpl.shareDocId = e.parameter.doc || '';
  return tpl.evaluate()
      .setTitle('VCB E-MEMO')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Renders a Drive file inside its own HtmlOutput so the iframe can
// `src=` to a normal script.google.com URL. PDFs and native Google docs
// delegate to Drive's own /preview (reliable, no CDN dependency — tried
// PDF.js-from-CDN and a data:-URI <embed> here first; both failed on
// this network/browser combo). Its dark background and expand icon are
// Google's own UI (cross-origin iframe), not ours to restyle. Other
// file types offer a download.
function serveDriveFileViewer_(fileId) {
  try {
    var id = String(fileId || '').match(/[-\w]{20,}/);
    if (!id) return _vrErrHtml_('Bad file id');
    var f = DriveApp.getFileById(id[0]);
    var mime = f.getMimeType() || '';
    if (/^application\/vnd\.google-apps\./.test(mime) || mime === 'application/pdf') {
      var which = mime.indexOf('document') >= 0 ? 'document'
                 : mime.indexOf('spreadsheet') >= 0 ? 'spreadsheets'
                 : mime.indexOf('presentation') >= 0 ? 'presentation' : 'file';
      var prev = mime === 'application/pdf'
        ? 'https://drive.google.com/file/d/' + id[0] + '/preview'
        : 'https://docs.google.com/' + which + '/d/' + id[0] + '/preview';
      return HtmlService.createHtmlOutput(
        '<html><body style="margin:0"><iframe src="' + prev + '" style="border:0;width:100vw;height:100vh"></iframe></body></html>')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    var bytes = f.getBlob().getBytes();
    return _vrEmbedHtml_(mime, bytes, f.getName(),
      'https://drive.google.com/file/d/' + id[0] + '/view');
  } catch (err) { return _vrErrHtml_('Could not load file: ' + err); }
}

// Same idea, but pulls the bytes straight from a Gmail attachment.
function serveGmailAttachmentViewer_(tid, msgIdx, attIdx) {
  try {
    var th = GmailApp.getThreadById(String(tid).trim());
    if (!th) return _vrErrHtml_('Gmail thread not found');
    var msgs = th.getMessages();
    var mi = parseInt(msgIdx, 10) || 0;
    if (mi < 0 || mi >= msgs.length) return _vrErrHtml_('Bad message index');
    var atts = msgs[mi].getAttachments({ includeInlineImages: false, includeAttachments: true });
    var ai = parseInt(attIdx, 10) || 0;
    if (ai < 0 || ai >= atts.length) return _vrErrHtml_('Bad attachment index');
    var a = atts[ai];
    return _vrEmbedHtml_(a.getContentType() || 'application/octet-stream',
                         a.getBytes(), a.getName(), '');
  } catch (err) { return _vrErrHtml_('Could not load Gmail attachment: ' + err); }
}

function _vrEmbedHtml_(mime, bytes, name, openUrl) {
  var sizeKb = Math.round(bytes.length / 1024);
  if (bytes.length > 20 * 1024 * 1024) {
    return HtmlService.createHtmlOutput(
      '<html><body style="font-family:sans-serif;padding:30px;color:#444;background:#fafafa;text-align:center">' +
      '<h3>' + _esc_(name) + '</h3>' +
      '<p>' + sizeKb + ' KB — too large for inline preview.</p>' +
      (openUrl ? '<p><a href="' + openUrl + '" target="_blank" rel="noopener" style="color:#1a73e8;font-weight:600">Open in Drive ↗</a></p>' : '') +
      '</body></html>')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  var b64 = Utilities.base64Encode(bytes);
  var dataUri = 'data:' + mime + ';base64,' + b64;
  var body;
  if (mime === 'application/pdf') {
    // Primary: <embed> with a same-origin data: URI — the browser's own
    // native PDF viewer (normal scrollbar/thumbnails/page controls, no
    // external CDN, no blob: URL to be silently blocked). Some browsers
    // are configured to download PDFs instead of showing them inline;
    // detect that (the <embed> never paints) and fall back to PDF.js
    // from a CDN, which at least works where the CDN is reachable.
    body =
      '<embed id="pdfEmbed" src="' + dataUri + '" type="application/pdf" ' +
      'style="width:100%;height:100vh;border:0;display:block">' +
      '<div id="status" style="display:none;font-family:sans-serif;padding:14px;color:#555;background:#f0f2f5;text-align:center;font-size:13px">Loading PDF…</div>' +
      '<div id="pdfctr" style="display:none;background:#f0f2f5;min-height:calc(100vh - 50px);padding:8px 0"></div>' +
      '<script>window.__PDF_B64="' + b64 + '";<\/script>' +
      '<script>(function(){' +
      'setTimeout(function(){' +
      // If the <embed> actually rendered a PDF plugin, it reports a
      // non-trivial size; a browser set to download instead leaves it
      // collapsed. That's the signal to fall back to PDF.js.
      'var em=document.getElementById("pdfEmbed");' +
      'if(em && em.offsetHeight>100) return;' +
      'if(em) em.style.display="none";' +
      'var s=document.getElementById("status"),ctr=document.getElementById("pdfctr");' +
      's.style.display="block"; ctr.style.display="block";' +
      'var cdns=["https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.js",' +
                '"https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.min.js",' +
                '"https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.js"];' +
      'var workers=["https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js",' +
                   '"https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.worker.min.js",' +
                   '"https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.js"];' +
      'function tryLoad(i){' +
      'if(i>=cdns.length){s.textContent="No PDF viewer CDN reachable.";s.style.color="#c5221f";return;}' +
      'var sc=document.createElement("script");sc.src=cdns[i];' +
      'sc.onload=function(){render(workers[i]);};' +
      'sc.onerror=function(){tryLoad(i+1);};' +
      'document.head.appendChild(sc);' +
      '}' +
      'function render(workerUrl){' +
      'try{' +
      'window.pdfjsLib.GlobalWorkerOptions.workerSrc=workerUrl;' +
      'var b=atob(window.__PDF_B64),n=b.length,a=new Uint8Array(n);' +
      'for(var i=0;i<n;i++)a[i]=b.charCodeAt(i);' +
      'window.pdfjsLib.getDocument({data:a}).promise.then(function(pdf){' +
      's.style.display="none";' +
      'var q=Promise.resolve();' +
      'for(var p=1;p<=pdf.numPages;p++){(function(pn){' +
      'q=q.then(function(){return pdf.getPage(pn).then(function(page){' +
      'var vw=page.getViewport({scale:1.5}),c=document.createElement("canvas");' +
      'c.width=vw.width;c.height=vw.height;' +
      'c.style.cssText="display:block;margin:10px auto;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.45);max-width:calc(100% - 16px)";' +
      'ctr.appendChild(c);' +
      'return page.render({canvasContext:c.getContext("2d"),viewport:vw}).promise;' +
      '});});})(p);}' +
      '},function(e){s.textContent="Could not render PDF: "+e.message;s.style.color="#c5221f";});' +
      '}catch(e){s.textContent="PDF.js error: "+e.message;s.style.color="#c5221f";}' +
      '}' +
      'tryLoad(0);' +
      '},400);' +
      '})();<\/script>';
  } else if (/^image\//.test(mime)) {
    body = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#f0f2f5">' +
           '<img src="' + dataUri + '" style="max-width:100%;max-height:100%">' +
           '</div>';
  } else {
    body = '<div style="padding:30px;font-family:sans-serif">' +
           '<h3>' + _esc_(name) + '</h3>' +
           '<p>This file type (' + _esc_(mime) + ') can\'t be previewed inline.</p>' +
           '<p><a download="' + _esc_(name) + '" href="' + dataUri + '" style="color:#1a73e8;font-weight:600">Download ' + _esc_(name) + '</a></p>' +
           '</div>';
  }
  return HtmlService.createHtmlOutput(
    '<!doctype html><html><head><meta charset="utf-8"><title>' + _esc_(name) + '</title>' +
    '<style>html,body{margin:0;padding:0;height:100%;background:#fff}</style></head><body>' + body + '</body></html>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setTitle(name);
}
function _vrErrHtml_(msg) {
  return HtmlService.createHtmlOutput(
    '<html><body style="font-family:sans-serif;padding:30px;color:#c5221f;background:#fff;text-align:center">' +
    '<h3>Could not load file</h3><p>' + _esc_(String(msg)) + '</p></body></html>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function _esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getOAuthUrl(state) {
  var u = 'https://accounts.google.com/o/oauth2/v2/auth' +
    '?client_id=' + encodeURIComponent(CLIENT_ID) +
    '&redirect_uri=' + encodeURIComponent(getRedirectUri_()) +
    '&response_type=code' +
    '&scope=' + encodeURIComponent('email profile') +
    '&prompt=select_account';
  if (state) u += '&state=' + encodeURIComponent(state);
  return u;
}

// iPad-safe sign-in: the popup can't reliably postMessage back into the
// sandboxed app iframe, so the sign-in result is also parked server-side
// keyed by the OAuth `state`. The app polls claimAuth(state) to pick it
// up — no cross-window messaging required.
function claimAuth(state) {
  state = String(state || '');
  if (!state) return {};
  var key = 'ostate_' + state;
  var raw = PropertiesService.getScriptProperties().getProperty(key);
  if (!raw) return {};
  var p = raw.split('|');
  var exp = parseInt(p[2], 10);
  PropertiesService.getScriptProperties().deleteProperty(key);   // one-time
  if (new Date().getTime() > exp) return {};
  return { token: p[0], email: p[1] };
}

function submitDocument(data) {
  var authToken = data.authToken || '';
  var stored = PropertiesService.getScriptProperties().getProperty('auth_' + authToken);
  if (!stored) {
    return { success: false, error: 'Session expired or invalid. Please sign in again.' };
  }
  var parts = stored.split('|');
  var email = parts[0];
  var expires = parseInt(parts[1]);
  if (new Date().getTime() > expires) {
    PropertiesService.getScriptProperties().deleteProperty('auth_' + authToken);
    return { success: false, error: 'Session expired. Please sign in again.' };
  }
  try {
    var cfg = LETTERHEAD[data.project];
    var bodyText = String(data.body || '').trim();
    var folderId = getFolderId(data.project, data.code);

    // Uploads one blob into the project folder (or root if unresolved)
    // and returns its view URL, or '' if nothing supplied.
    function saveUpload_(b64, mime, name) {
      if (!b64) return '';
      var f = DriveApp.createFile(
        Utilities.newBlob(Utilities.base64Decode(b64),
          mime || 'application/octet-stream', name));
      var url = 'https://drive.google.com/file/d/' + f.getId() + '/view';
      if (folderId) {
        try {
          DriveApp.getFolderById(folderId).addFile(f);
          DriveApp.getRootFolder().removeFile(f);
        } catch (mv) { Logger.log('attach move failed: ' + mv); }
      }
      shareForViewing_(f.getId());
      return url;
    }

    var letterUrl = '', letterDocUrl = '', genRef = '', letterHtml = '', pendingToken = '';
    if (cfg) {
      // Configured project: the LETTER is the document and is compulsory.
      if (!bodyText) {
        return { success: false, error: 'Document body is required — type the letter body.' };
      }
      var rn = getNextRunningNumber(data.project, data.code);
      var runNo = (rn && rn.ok && rn.found) ? rn.next : '001';
      var codeForRef = String(data.code || '').trim();
      genRef = cfg.prefix + '/' + deptForCode_(codeForRef) + '/' +
               codeForRef + '/' + runNo;
      var letterOpts = {
        ref: genRef,
        thaiDate: thaiDate_(data.docDate),
        subject: data.subject || '',
        to: String(data.to || '').trim(),
        cc: String(data.cc || '').trim(),
        typist: String(data.typist || '').trim(),
        bodyText: bodyText,
        folderId: folderId
      };
      // The slow part (create Doc + export PDF, ~8-12s) is DEFERRED to
      // finalizeLetter() so submitting returns in a few seconds. The row
      // is logged now with a PENDING token; finalize fills the link.
      letterHtml = generateLetterHtml_(cfg, letterOpts);   // instant, for the print view
      pendingToken = Utilities.getUuid();
    } else if (!data.fileBase64) {
      // No letterhead for this project and no file → nothing to record.
      return { success: false, error: 'No letter template for this project — please attach a file.' };
    }

    // The attachment is SUPPLEMENTARY extra material (never replaces the
    // letter). For non-letterhead projects it is the document itself.
    var attachUrl = saveUpload_(data.fileBase64, data.mimeType, data.filename);

    var docUrl  = letterUrl || attachUrl;          // main register link
    var placed  = !!(folderId && (letterUrl || attachUrl));

    var masterId = getMasterId_();
    if (!masterId) return { success: false, error: 'Master sheet not set up yet. Ask admin to run setupMasterSheet().' };
    var ss = SpreadsheetApp.openById(masterId);
    var proj = data.project || 'UNCLASSIFIED';
    var sh = getMasterSheetForProject_(ss, proj);
    var tz = 'Asia/Bangkok';
    var now = new Date();
    var dateStr = Utilities.formatDate(now, tz, 'dd/MM/yyyy');
    var timeStr = Utilities.formatDate(now, tz, 'HH:mm');
    var month = Utilities.formatDate(now, tz, 'MMMM yyyy');
    var nextNo = Math.max(0, sh.getLastRow() - 1) + 1;   // minus header
    var remarks = genRef ? ('Auto-generated letter ' + genRef) : 'Manual submission';
    if (genRef && attachUrl) remarks += ' | แนบเพิ่ม: ' + attachUrl;
    if (pendingToken) remarks += ' | ⏳ กำลังสร้างเอกสาร';
    // Brief content for the register's 2nd line (the "Summary" column),
    // same as the email-logged rows show.
    var summary = bodyText ? bodyText.replace(/\s+/g, ' ').trim().slice(0, 200)
                           : String(data.subject || '');

    // Write by COLUMN HEADER, not fixed position — tabs created by the
    // email-logger may have a different column order / extra columns, and
    // a positional append would scatter values (e.g. the Drive link into
    // the Summary column, which is exactly what showed the URL as the
    // 2nd line). Resolve each field to its header and fill that cell.
    var hdrRow = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var hmap = {};
    for (var hi = 0; hi < hdrRow.length; hi++) {
      hmap[String(hdrRow[hi]).trim().toLowerCase()] = hi;
    }
    var fields = {
      'no.': nextNo,
      'date received': data.docDate || dateStr,
      'time received': timeStr,
      'sender email': email,
      'document type': data.code || '',
      'subject': data.subject || '',
      'drive link': docUrl,
      'project': proj,
      'logged date': dateStr,
      'logged time': timeStr,
      'gmail thread-id': pendingToken ? ('PENDING:' + pendingToken) : '',
      'remarks': remarks,
      'month': month,
      'source': 'Manual',
      'summary': summary,
      'letterdata': genRef ? JSON.stringify({
        proj: proj, code: data.code || '', ref: genRef,
        subject: data.subject || '', to: String(data.to || '').trim(),
        cc: String(data.cc || '').trim(),
        typist: String(data.typist || '').trim(),
        body: bodyText, docDate: data.docDate || ''
      }) : ''
    };
    var rowArr = new Array(hdrRow.length);
    for (var ci = 0; ci < rowArr.length; ci++) rowArr[ci] = '';
    for (var key in fields) {
      if (hmap[key] !== undefined) rowArr[hmap[key]] = fields[key];
    }
    sh.appendRow(rowArr);
    return { success: true, fileUrl: docUrl, placed: placed,
             generated: !!genRef, ref: genRef, attachUrl: attachUrl,
             editUrl: letterDocUrl, letterHtml: letterHtml,
             pending: !!pendingToken, token: pendingToken };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// Phase 2 (called by the client right after submit returns): does the
// slow Doc + PDF creation, then patches the just-logged row's Drive
// Link. Keeps the submit itself fast. Idempotent-ish: if the PENDING
// token row is gone it just returns the generated URLs.
function finalizeLetter(data) {
  try {
    if (!resolveAuthEmail_(data.authToken)) {
      return { ok: false, error: 'Session expired.' };
    }
    var cfg = LETTERHEAD[data.project];
    if (!cfg) return { ok: false, error: 'No template.' };
    var folderId = getFolderId(data.project, data.code);
    var gen = generateLetterDoc_(cfg, {
      ref: String(data.ref || ''),
      thaiDate: thaiDate_(data.docDate),
      subject: data.subject || '',
      to: String(data.to || '').trim(),
      cc: String(data.cc || '').trim(),
      typist: String(data.typist || '').trim(),
      bodyText: String(data.body || '').trim(),
      folderId: folderId
    });
    var pdfUrl = gen.pdfUrl || gen.docUrl;

    // Patch the PENDING row: set Drive Link, clear the token, drop the
    // "⏳ creating" marker from Remarks.
    var token = String(data.token || '');
    if (token) {
      var ss = SpreadsheetApp.openById(getMasterId_());
      var sh = ss.getSheetByName(data.project) ||
               ss.getSheetByName(PROJECT_ALIAS_INV_(data.project) || data.project);
      if (sh) {
        var vals = sh.getDataRange().getValues();
        var H = {};
        for (var h = 0; h < vals[0].length; h++) H[String(vals[0][h]).trim().toLowerCase()] = h;
        var iTid = H['gmail thread-id'], iUrl = H['drive link'], iRem = H['remarks'];
        for (var r = 1; r < vals.length; r++) {
          if (iTid !== undefined && String(vals[r][iTid]) === 'PENDING:' + token) {
            if (iUrl !== undefined) sh.getRange(r + 1, iUrl + 1).setValue(pdfUrl);
            sh.getRange(r + 1, iTid + 1).setValue('');
            if (iRem !== undefined) {
              sh.getRange(r + 1, iRem + 1).setValue(
                String(vals[r][iRem]).replace(/\s*\|\s*⏳[^|]*/, ''));
            }
            break;
          }
        }
      }
    }
    return { ok: true, url: pdfUrl, editUrl: gen.docUrl };
  } catch (err) {
    return { ok: false, error: err.toString() };
  }
}

// Reverse of PROJECT_ALIAS (canonical → raw tab name), for finalize.
function PROJECT_ALIAS_INV_(canon) {
  for (var k in PROJECT_ALIAS) if (PROJECT_ALIAS[k] === canon) return k;
  return null;
}

function getFolderId(project, code) {
  // Normalize the document code: take the first run of digits anywhere
  // in the value (handles "01", "1", " 01 ", "01-DWG", "01A", "A01"),
  // then pad a single digit so "1" -> "01".
  var raw = String(code || '').trim();
  var m = raw.match(/\d+/);
  var num = m ? m[0] : '';
  if (num.length === 1) num = '0' + num;

  if (project === 'PN4' || project === 'V&K' || project === 'BR3' || project === 'BR4') {
    if (num === '01' || num === '10') return '1p6zGngon2vVFK7eAWm5l0OE8rmIbu84P';
    if (num === '02' || num === '03') return '1wMYCdl892oUs-5OquW6algeIDmpR0Wjy';
    if (num === '05') return '16W-KmIJ6cPcp3ZvtDfLBQ0Rp3wmfX3qu';
    if (num === '06') return '16KSmsNnp6dxevHollsZKoDx2DeFpadN2';
    if (num === '08') return '102P3W5wmeyegQf-HRVlrAh6gYhtl7-H7';
    if (num === '09') return '1aA3Yz3JaShPNxqcZeQ1zu1Hddc-QNDzt';
    Logger.log('getFolderId: no PN4-group rule for num="' + num +
      '" (code="' + raw + '"), using default folder');
    return '1lbJb4TmH8M6XzpTUBjz9vbT9P8_wq1zy';
  }

  var nameMap = {
    'BT1': 'บางเตย ตอน1 (BT1)', 'BT': 'บางเตย ตอน1 (BT1)',
    'VK2': 'บางเตย ตอน2 (VK2)', 'VK': 'บางเตย ตอน2 (VK2)',
    'VC': 'ลาดหลุมแก้ว (LK)',
    'CVE': 'CVE', 'LPB': 'หลวงพระบาง (LPB)', 'BV': 'บางวัว (BV)', 'EP': 'บ้านแพ้ว (EP)'
  };
  var folderName = nameMap[project];
  if (!folderName) {
    Logger.log('getFolderId: unknown project "' + project + '" - no folder mapping');
    return null;
  }
  var id = findFolderIdByName_(folderName);
  if (!id) {
    Logger.log('getFolderId: folder "' + folderName +
      '" not found in Drive for project "' + project + '"');
  }
  return id;
}

// Resilient folder lookup. Tries an exact name match first (fast path),
// then falls back to a normalized scan so a stray/extra space or a
// casing difference in the (Thai) folder name no longer returns null.
function findFolderIdByName_(name) {
  var target = String(name).trim();
  var it = DriveApp.getFoldersByName(target);
  if (it.hasNext()) return it.next().getId();

  var norm = function (s) {
    return String(s).replace(/\s+/g, ' ').trim().toLowerCase();
  };
  var want = norm(target);
  var all = DriveApp.getFolders();
  while (all.hasNext()) {
    var f = all.next();
    if (norm(f.getName()) === want) return f.getId();
  }
  return null;
}

// ── Single source of truth: the MASTER Google Sheet ──────────────
// One spreadsheet, one tab per project, one schema. Every row carries
// a "Source" column (Email = logged from Gmail, Manual = web form).
// The email logger and submitDocument() both append here; the web app
// reads only here. Its ID lives in Script Property MASTER_SHEET_ID.
// Summary column intentionally removed — the Subject/name is self-
// explanatory. getDocuments() maps columns by HEADER NAME (not fixed
// index), so this layout can differ from whatever the email-logger
// skill writes without breaking the web app.
var MASTER_HEADER = ['No.', 'Date Received', 'Time Received', 'Sender Email',
  'Document Type', 'Subject', 'Drive Link', 'Project',
  'Logged Date', 'Logged Time', 'Gmail Thread-ID', 'Remarks', 'Month', 'Source',
  'LetterData'];

// Legacy project-name fixes applied when reading. "VNK" was a mis-spelling
// of "V&K"; the reader canonicalises it so the web never shows "VNK".
var PROJECT_ALIAS = { 'VNK': 'V&K' };

function getMasterId_() {
  return PropertiesService.getScriptProperties().getProperty('MASTER_SHEET_ID');
}

function getMasterSheetForProject_(ss, project) {
  var sh = ss.getSheetByName(project);
  if (!sh) {
    sh = ss.insertSheet(project);
    sh.getRange(1, 1, 1, MASTER_HEADER.length).setValues([MASTER_HEADER]);
    sh.setFrozenRows(1);
  }
  return sh;
}

// ONE-TIME, automatic, guarded data cleanup: removes EXACT duplicate
// rows from every project tab (same Subject + Document Type + Drive
// Link in the same tab), keeping the FIRST occurrence. Runs a single
// time — a Script Property flag prevents it ever repeating, so it is
// safe to call from getDocuments(). Conservative on purpose: rows are
// only removed when subject, type AND link all match exactly.
var DEDUPE_FLAG = 'DEDUPE_V1_DONE';
function dedupeMasterOnce_(ss) {
  try {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty(DEDUPE_FLAG)) return;     // already cleaned

    var sheets = ss.getSheets();
    var totalRemoved = 0;
    for (var s = 0; s < sheets.length; s++) {
      var sh = sheets[s];
      var nm = sh.getName();
      if (nm === DISCUSSION_SHEET || /summary/i.test(nm)) continue;
      var rng = sh.getDataRange();
      var v = rng.getValues();
      if (v.length < 3) continue;                   // header + <2 rows

      var hdr = {};
      for (var h = 0; h < v[0].length; h++) {
        hdr[String(v[0][h]).trim().toLowerCase()] = h;
      }
      var iSubj = hdr['subject'];
      if (iSubj === undefined) continue;             // not a document tab
      var iType = hdr['document type'];
      var iUrl  = hdr['drive link'];
      function norm(x) { return String(x == null ? '' : x).replace(/\s+/g, ' ').trim().toLowerCase(); }

      var seen = {}, dropRows = [];
      for (var r = 1; r < v.length; r++) {
        var subj = norm(v[r][iSubj]);
        var type = iType !== undefined ? norm(v[r][iType]) : '';
        var url  = iUrl  !== undefined ? norm(v[r][iUrl])  : '';
        if (!subj && !type && !url) continue;        // blank row, leave it
        var key = subj + '' + type + '' + url;
        if (seen[key]) dropRows.push(r + 1);         // 1-based sheet row
        else seen[key] = true;
      }
      // Delete from the bottom up so indices stay valid.
      for (var d = dropRows.length - 1; d >= 0; d--) {
        sh.deleteRow(dropRows[d]);
        totalRemoved++;
      }
      if (dropRows.length) {
        Logger.log('Dedupe: removed ' + dropRows.length + ' dup row(s) from "' + nm + '"');
      }
    }
    props.setProperty(DEDUPE_FLAG, new Date().toISOString());
    Logger.log('Dedupe complete. Total rows removed: ' + totalRemoved);
  } catch (e) {
    Logger.log('Dedupe skipped (error): ' + e);
  }
}

// ONE-TIME, automatic, guarded: VC-prefixed rows were being logged into
// the BT1 tab (subject starts with "VC/" or "VC-") before the VC project
// tab existed. Move any such row still sitting in BT1 into its own VC
// tab (created on demand via getMasterSheetForProject_), matched purely
// by the doc-code prefix in the Subject column — never a hand edit, and
// safe to re-run since a tab with no matching rows is a no-op.
//
// v1 briefly used the tab name "LK" (the Drive folder's name) before the
// project key was corrected to "VC" to match its doc-code prefix, like
// every other project. If that ran already, mergeLkIntoVcOnce_ folds
// whatever landed in "LK" into "VC" and removes the stray tab.
var VC_MIGRATE_FLAG = 'VC_MIGRATE_FROM_BT1_V2_DONE';
function migrateVcRowsFromBt1Once_(ss) {
  try {
    var props = PropertiesService.getScriptProperties();
    mergeLkIntoVcOnce_(ss);
    if (props.getProperty(VC_MIGRATE_FLAG)) return;

    var bt1 = ss.getSheetByName('BT1');
    if (!bt1) { props.setProperty(VC_MIGRATE_FLAG, new Date().toISOString()); return; }

    var v = bt1.getDataRange().getValues();
    if (v.length < 2) { props.setProperty(VC_MIGRATE_FLAG, new Date().toISOString()); return; }

    var hdr = {};
    for (var h = 0; h < v[0].length; h++) hdr[String(v[0][h]).trim().toLowerCase()] = h;
    var iSubj = hdr['subject'];
    if (iSubj === undefined) { props.setProperty(VC_MIGRATE_FLAG, new Date().toISOString()); return; }

    var moveRows = [];       // sheet row numbers (1-based), top to bottom
    for (var r = 1; r < v.length; r++) {
      var subj = String(v[r][iSubj] == null ? '' : v[r][iSubj]).trim().toUpperCase();
      if (subj.indexOf('VC/') === 0 || subj.indexOf('VC-') === 0) moveRows.push(r + 1);
    }

    if (moveRows.length) {
      var vc = getMasterSheetForProject_(ss, 'VC');
      for (var i = 0; i < moveRows.length; i++) {
        var rowVals = bt1.getRange(moveRows[i], 1, 1, v[0].length).getValues();
        vc.getRange(vc.getLastRow() + 1, 1, 1, rowVals[0].length).setValues(rowVals);
      }
      // Delete from the bottom up so earlier row indices stay valid.
      for (var d = moveRows.length - 1; d >= 0; d--) bt1.deleteRow(moveRows[d]);
      Logger.log('Migrated ' + moveRows.length + ' VC-prefixed row(s) from BT1 to VC.');
    }

    props.setProperty(VC_MIGRATE_FLAG, new Date().toISOString());
  } catch (e) {
    Logger.log('migrateVcRowsFromBt1Once_ skipped (error): ' + e);
  }
}

// ONE-TIME, automatic, guarded: fold a stray "LK" tab (created by v1 of
// the migration above, before the project key was corrected to "VC")
// into the "VC" tab, then delete "LK". No-op if "LK" was never created.
var LK_MERGE_FLAG = 'LK_MERGED_INTO_VC_V1_DONE';
function mergeLkIntoVcOnce_(ss) {
  try {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty(LK_MERGE_FLAG)) return;

    var lk = ss.getSheetByName('LK');
    if (!lk) { props.setProperty(LK_MERGE_FLAG, new Date().toISOString()); return; }

    var v = lk.getDataRange().getValues();
    if (v.length > 1) {
      var vc = getMasterSheetForProject_(ss, 'VC');
      var rowVals = lk.getRange(2, 1, v.length - 1, v[0].length).getValues();
      vc.getRange(vc.getLastRow() + 1, 1, rowVals.length, rowVals[0].length).setValues(rowVals);
      Logger.log('Merged ' + rowVals.length + ' row(s) from LK into VC.');
    }
    ss.deleteSheet(lk);

    props.setProperty(LK_MERGE_FLAG, new Date().toISOString());
  } catch (e) {
    Logger.log('mergeLkIntoVcOnce_ skipped (error): ' + e);
  }
}

// ONE-TIME, automatic, guarded: V&K- and BR3-prefixed rows (พุทธมณฑล ตอน 3)
// were being logged into the PN4 tab (พุทธมณฑล ตอน 4) — a different site
// that happens to share the same 01/10/02/03/05/06/08/09 Drive subfolder
// structure via getFolderId's PN4-group branch, which is unaffected by
// this migration. Move any row still sitting in PN4 whose Subject starts
// with "V&K/", "V&K-" or "BR3-" into its own "V&K" tab (created on demand
// via getMasterSheetForProject_), matched purely by the doc-code prefix —
// never a hand edit, and safe to re-run since a tab with no matching rows
// is a no-op.
var VK_MIGRATE_FLAG = 'VK_MIGRATE_FROM_PN4_V1_DONE';
function migrateVkRowsFromPn4Once_(ss) {
  try {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty(VK_MIGRATE_FLAG)) return;

    var pn4 = ss.getSheetByName('PN4');
    if (!pn4) { props.setProperty(VK_MIGRATE_FLAG, new Date().toISOString()); return; }

    var v = pn4.getDataRange().getValues();
    if (v.length < 2) { props.setProperty(VK_MIGRATE_FLAG, new Date().toISOString()); return; }

    var hdr = {};
    for (var h = 0; h < v[0].length; h++) hdr[String(v[0][h]).trim().toLowerCase()] = h;
    var iSubj = hdr['subject'];
    if (iSubj === undefined) { props.setProperty(VK_MIGRATE_FLAG, new Date().toISOString()); return; }

    var moveRows = [];       // sheet row numbers (1-based), top to bottom
    for (var r = 1; r < v.length; r++) {
      var subj = String(v[r][iSubj] == null ? '' : v[r][iSubj]).trim().toUpperCase();
      if (subj.indexOf('V&K/') === 0 || subj.indexOf('V&K-') === 0 || subj.indexOf('BR3-') === 0) moveRows.push(r + 1);
    }

    if (moveRows.length) {
      var vk = getMasterSheetForProject_(ss, 'V&K');
      for (var i = 0; i < moveRows.length; i++) {
        var rowVals = pn4.getRange(moveRows[i], 1, 1, v[0].length).getValues();
        vk.getRange(vk.getLastRow() + 1, 1, 1, rowVals[0].length).setValues(rowVals);
      }
      // Delete from the bottom up so earlier row indices stay valid.
      for (var d = moveRows.length - 1; d >= 0; d--) pn4.deleteRow(moveRows[d]);
      Logger.log('Migrated ' + moveRows.length + ' V&K/BR3-prefixed row(s) from PN4 to V&K.');
    }

    props.setProperty(VK_MIGRATE_FLAG, new Date().toISOString());
  } catch (e) {
    Logger.log('migrateVkRowsFromPn4Once_ skipped (error): ' + e);
  }
}

// ONE-TIME, automatic, guarded: repair rows whose cells are shifted one
// column RIGHT of the MASTER_HEADER layout. Found 2026-08-19 on the VC
// tab: 14 of 15 rows had Subject's text sitting in "Drive Link", the
// "Logged Time" value in "Gmail Thread-ID" (which is why the attachment
// viewer reported a bogus 'Sun Dec 31 1899 ...' thread id and listed no
// attachments), and a date in "Source". These rows were NOT written by
// this app — all three write paths (submitDocument, the letter path, the
// Gmail auto-logger) build rows via buildRow_(hmap, ...) keyed by HEADER
// NAME, so they cannot shift columns. They were pasted/imported with one
// extra leading column. The Gmail-logged rows on the same tab, and every
// other tab (BT1/PN4/EP verified clean), are unaffected.
//
// Detection is by SIGNATURE, not by row number or tab: a row qualifies
// only when "Gmail Thread-ID" holds a Date object (a real thread id is a
// hex string) AND "Source" holds a Date (it should read 'Email'/'Manual').
// Anything not matching both is left untouched, so this is safe to run
// over every tab and safe to re-run.
var COLSHIFT_FLAG = 'COLSHIFT_REPAIR_V1_DONE';
function repairShiftedRowsOnce_(ss) {
  try {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty(COLSHIFT_FLAG)) return;

    var sheets = ss.getSheets(), totalFixed = 0, perTab = {};
    for (var s = 0; s < sheets.length; s++) {
      var sh = sheets[s], nm = sh.getName();
      if (nm === DISCUSSION_SHEET || /summary/i.test(nm)) continue;
      var v = sh.getDataRange().getValues();
      if (v.length < 2) continue;
      var H = colMapLower_(v[0]);
      var iTid = H['gmail thread-id'], iSrc = H['source'];
      if (iTid === undefined || iSrc === undefined) continue;

      var width = v[0].length, fixed = 0;
      for (var r = 1; r < v.length; r++) {
        if (!(v[r][iTid] instanceof Date) || !(v[r][iSrc] instanceof Date)) continue;
        // Shift this row one column LEFT, dropping the stray leading cell
        // and blanking the vacated last column.
        var row = v[r].slice(1);
        row.push('');
        sh.getRange(r + 1, 1, 1, width).setValues([row]);
        fixed++;
      }
      if (fixed) { perTab[nm] = fixed; totalFixed += fixed; }
    }
    props.setProperty(COLSHIFT_FLAG, new Date().toISOString());
    Logger.log('repairShiftedRowsOnce_: fixed ' + totalFixed +
               ' row(s) ' + JSON.stringify(perTab));
  } catch (e) {
    Logger.log('repairShiftedRowsOnce_ skipped (error): ' + e);
  }
}

// ONE-TIME, automatic, guarded: rewrite the date columns in the master
// sheet so they are stored CORRECTLY as plain-text dd/MM/yyyy (fixing
// the rows a US-locale auto-parse had swapped, e.g. Dec 5 → 12/05), and
// set those whole columns to plain-text format so future appends are no
// longer re-misparsed. Runs once (Script Property guard).
var DATEFIX_FLAG = 'DATEFIX_V1_DONE';
function fixDatesOnce_(ss) {
  try {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty(DATEFIX_FLAG)) return;

    var DATE_COLS = ['date received', 'logged date'];
    var sheets = ss.getSheets();
    var fixed = 0;
    for (var s = 0; s < sheets.length; s++) {
      var sh = sheets[s];
      var nm = sh.getName();
      if (nm === DISCUSSION_SHEET || /summary/i.test(nm)) continue;
      var lastRow = sh.getLastRow();
      if (lastRow < 2) continue;
      var hrow = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      var hdr = {};
      for (var h = 0; h < hrow.length; h++) hdr[String(hrow[h]).trim().toLowerCase()] = h;

      for (var dcI = 0; dcI < DATE_COLS.length; dcI++) {
        var ci = hdr[DATE_COLS[dcI]];
        if (ci === undefined) continue;
        var n = lastRow - 1;
        var rng = sh.getRange(2, ci + 1, n, 1);
        var vals = rng.getValues();
        var out = [];
        for (var r = 0; r < n; r++) {
          var norm = normalizeDate_(vals[r][0]);          // -> 'dd/MM/yyyy' or ''
          out.push([norm]);
          if (norm && String(vals[r][0]) !== norm) fixed++;
        }
        // Plain-text the WHOLE column (incl. future rows) so new appends
        // stay text and are never auto-parsed again, then write values.
        sh.getRange(2, ci + 1, Math.max(n, sh.getMaxRows() - 1), 1).setNumberFormat('@');
        rng.setValues(out);
      }
    }
    props.setProperty(DATEFIX_FLAG, new Date().toISOString());
    Logger.log('Date cleanup complete. Cells corrected: ' + fixed);
  } catch (e) {
    Logger.log('Date cleanup skipped (error): ' + e);
  }
}

// Ensure every project tab has a "LetterData" column (stores the JSON
// needed to re-render the letter for the on-screen review). One-time;
// guarded. Email-logger tabs created without it get it appended.
var LETTERDATA_FLAG = 'LETTERDATA_COL_V1';
function ensureLetterDataColumn_(ss) {
  try {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty(LETTERDATA_FLAG)) return;
    var sheets = ss.getSheets();
    for (var s = 0; s < sheets.length; s++) {
      var sh = sheets[s];
      var nm = sh.getName();
      if (nm === DISCUSSION_SHEET || /summary/i.test(nm)) continue;
      var lastCol = sh.getLastColumn();
      if (lastCol < 1) continue;
      var hdr = sh.getRange(1, 1, 1, lastCol).getValues()[0];
      var has = false;
      for (var h = 0; h < hdr.length; h++) {
        if (String(hdr[h]).trim().toLowerCase() === 'letterdata') { has = true; break; }
      }
      if (!has) sh.getRange(1, lastCol + 1).setValue('LetterData');
    }
    props.setProperty(LETTERDATA_FLAG, new Date().toISOString());
    Logger.log('LetterData column ensured on all tabs.');
  } catch (e) {
    Logger.log('ensureLetterDataColumn_ skipped: ' + e);
  }
}

// Force ANY date value to dd/MM/yyyy. Real Date cells are formatted in
// Bangkok time. Strings: clearly day-first or month-first are fixed by
// the >12 rule; for the ambiguous case (both ≤12) we prefer the reading
// that is NOT in the future (a register date is essentially never
// future), else default day-first (the historical data norm).
function normalizeDate_(v) {
  function p(n) { return (n < 10 ? '0' : '') + n; }
  if (v instanceof Date) {
    // A "dd/mm/yyyy" string written into a US-locale sheet gets parsed
    // as m/d → the stored Date is wrong (e.g. 12/05 → Dec 5). A register
    // date is never in the future, so if this Date is future and the day
    // could be a month, the components were swapped at write time —
    // un-swap them. Otherwise format as-is.
    var t1 = new Date(); t1.setHours(23, 59, 59, 999);
    var dd = v.getDate(), mm = v.getMonth() + 1, y = v.getFullYear();
    if (v > t1 && dd <= 12) return p(mm) + '/' + p(dd) + '/' + y;  // un-swap
    return p(dd) + '/' + p(mm) + '/' + y;
  }
  var s = String(v == null ? '' : v).trim();
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return s;
  var a = +m[1], b = +m[2], y = +m[3]; if (y < 100) y += 2000;
  var day, mon;
  if (a > 12 && b <= 12)      { day = a; mon = b; }   // clearly dd/mm
  else if (b > 12 && a <= 12) { day = b; mon = a; }   // clearly mm/dd
  else {
    var today = new Date(); today.setHours(23, 59, 59, 999);
    var dmFuture = new Date(y, b - 1, a) > today;     // read as dd/mm
    var mdFuture = new Date(y, a - 1, b) > today;     // read as mm/dd
    if (dmFuture && !mdFuture) { day = b; mon = a; }   // dd/mm impossible → mm/dd
    else                       { day = a; mon = b; }   // default day-first
  }
  return p(day) + '/' + p(mon) + '/' + y;
}

// THE single canonical list of document categories. A document can ONLY
// fall into one of these — this is the source of truth the whole app is
// derived from. To add/retire a category, edit this list (nowhere else).
// Anything not here (e.g. "48", a running sequence number that slipped into
// the Document Type column) is treated as miscoded and never surfaces as a
// phantom type. Keep in sync with the client TO_BY_CODE / CODE_LABEL labels.
var VALID_DOC_CODES = {
  '01': 1,
  '02': 1, '02A': 1, '02B': 1, '02C': 1,
  '03': 1, '04': 1, '05': 1, '06': 1, '07': 1,
  '08': 1, '09': 1, '10': 1
};
// True only for a real category code (case/zero-pad insensitive): "8" → "08",
// "2a" → "02A" both validate; "48", "048", "วิศวะ" do not.
function isValidDocCode_(c) {
  return !!VALID_DOC_CODES[fmtCode_(c).toUpperCase()];
}

// A document code is ALWAYS one of the VALID_DOC_CODES categories above
// ("03", "02A", "10"). A Thai department word (วิศวะ, บริหาร, …), a running
// sequence number ("48"/"048"), or any other token is NOT a valid code.
// When the stored Document Type is not a valid category, recover the real
// code from the reference number in the subject — the first valid category
// embedded AFTER the alphabetic/Thai project prefix, whether separated
// ("1.BP-วิศวะ-03-013" → "03") or glued to the department word
// ("BT/วิศวะ03/048" → "03"). Three-or-more-digit runs ("048") and the
// leading list number ("1.") are skipped. If nothing valid is found the row
// is left uncoded (shows as unclassified) rather than inventing a code.
function normalizeDocCode_(rawCode, subject) {
  var c = String(rawCode == null ? '' : rawCode).trim();
  if (isValidDocCode_(c)) return fmtCode_(c).toUpperCase();   // trusted category
  // The reference (e.g. "CVE/วิศวะ/02B/287") is usually the first word of the
  // subject, but some rows prefix it with a Thai ref-word ("ที่ CVE/...") so
  // the first whitespace token would be "ที่" and miss the code. Prefer the
  // first token that actually looks like a reference — one carrying a / or -
  // separator AND a digit — and only fall back to the first token otherwise.
  var toks = String(subject || '').trim().split(/\s+/);
  var tok = '';
  for (var ti = 0; ti < toks.length; ti++) {
    if (/[\/\-]/.test(toks[ti]) && /\d/.test(toks[ti])) { tok = toks[ti]; break; }
  }
  if (!tok) tok = toks[0] || '';
  var segs = tok.split(/[\/\-_.]+/);
  var seenPrefix = false;
  for (var i = 0; i < segs.length; i++) {
    var s = segs[i].trim();
    if (!s) continue;
    // Pull the first 1–2 digit code out of the segment, even when it is glued
    // to a leading department word ("วิศวะ03" → "03"). m[3] catches a trailing
    // digit, i.e. the number was really 3+ digits (a running number) → reject.
    var m = s.match(/^\D*?(\d{1,2})([A-Za-z]?)(\d*)/);
    if (m && !m[3]) {
      var cand = m[1] + m[2];
      if (seenPrefix && isValidDocCode_(cand)) return fmtCode_(cand).toUpperCase();
    }
    if (/[A-Za-z฀-๿]/.test(s)) seenPrefix = true;  // Latin/Thai prefix
  }
  return '';                                   // no valid category → unclassified
}

// Read live on every page load. Each tab is a project; row 0 is the
// header. Maps the register schema to the list the web page expects.
function getDocuments(authToken) {
  var id = getMasterId_();
  if (!id) throw new Error('Master sheet not set up yet. Run setupMasterSheet() once in the Apps Script editor.');
  var viewer = resolveAuthEmail_(authToken);        // for confidential-doc filtering
  var ss = SpreadsheetApp.openById(id);
  var tz = 'Asia/Bangkok';
  function cell(v) {
    if (v instanceof Date) return Utilities.formatDate(v, tz, 'dd/MM/yyyy');
    return String(v == null ? '' : v).trim();
  }
  function colMap(headerRow) {
    var m = {};
    for (var i = 0; i < headerRow.length; i++) {
      m[String(headerRow[i]).trim().toLowerCase()] = i;
    }
    return m;
  }
  // Self-heal the legacy mis-spelled tab: "VNK" → "V&K". Runs once
  // (no-op afterwards); if a "V&K" tab already exists we leave both and
  // the alias map below merges them so the web never shows "VNK".
  try {
    if (!ss.getSheetByName('V&K')) {
      var oldVnk = ss.getSheetByName('VNK');
      if (oldVnk) { oldVnk.setName('V&K'); Logger.log('Renamed tab VNK -> V&K'); }
    }
  } catch (e) { Logger.log('VNK auto-rename skipped: ' + e); }

  dedupeMasterOnce_(ss);                            // one-time data cleanup
  repairShiftedRowsOnce_(ss);                       // one-time column-shift repair (must precede the splits)
  migrateVcRowsFromBt1Once_(ss);                    // one-time VC/ split out of BT1
  migrateVkRowsFromPn4Once_(ss);                    // one-time V&K/BR3 split out of PN4
  fixDatesOnce_(ss);                                // one-time date repair
  ensureLetterDataColumn_(ss);                      // add LetterData col

  var disc = readDiscussions_(ss);                // doc → status map
  var out = {};
  var sheets = ss.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s];
    if (sh.getName() === DISCUSSION_SHEET) continue;   // not a project tab
    var name = PROJECT_ALIAS[sh.getName()] || sh.getName();
    if (/summary/i.test(name)) continue;          // skip rollup tabs
    var values = sh.getDataRange().getValues();
    if (!values.length) continue;
    // Resolve columns by HEADER NAME, not position, so the schema can
    // change (Summary removed, columns reordered by the email-logger)
    // without breaking this reader.
    var c = colMap(values[0]);
    var iSubj = c['subject'];
    if (iSubj === undefined) continue;            // not a document tab
    var iDate = c['date received'];
    var iCode = c['document type'];
    var iUrl  = c['drive link'];
    var iDesc = c['summary'];                      // optional (may not exist)
    var iRem  = c['remarks'];                       // holds the auto ref
    var list = [];
    for (var i = 1; i < values.length; i++) {
      var r = values[i];
      var subject = cell(r[iSubj]);
      var code = iCode !== undefined ? cell(r[iCode]) : '';
      var url  = iUrl  !== undefined ? cell(r[iUrl])  : '';
      if (!subject && !code && !url) continue;     // blank row
      code = normalizeDocCode_(code, subject);     // never surface a Thai word as a code
      if (!canViewDoc_(viewer, name, code)) continue;  // confidential — hidden from this viewer
      var rowDate = iDate !== undefined ? normalizeDate_(r[iDate]) : '';
      var docId = docKey_(url, name, subject, rowDate);
      var remarks = iRem !== undefined ? cell(r[iRem]) : '';
      list.push({
        num: list.length + 1,
        date: rowDate,
        code: code,
        subject: subject,
        desc: iDesc !== undefined ? cell(r[iDesc]) : '',
        url: url,
        id: docId,
        ref: remarks,                  // "Auto-generated letter <ref>"
        status: disc.statusById[docId] || 'pending'
      });
    }
    if (list.length) out[name] = (out[name] || []).concat(list);
  }
  return out;
}

// Suggest the next running number for a given project + document code.
// The running number lives inside the Subject, in the segment right
// after the code, e.g. "BT/วิศวะ/02B/067" -> 067 for code 02B. Scoped
// to the selected project's tab only (each project has its own series).
// Returns { ok, found, latest, next } or { ok:false, error }.
function getNextRunningNumber(project, code) {
  try {
    var id = getMasterId_();
    if (!id) return { ok: false, error: 'Master sheet not set up.' };
    project = String(project || '').trim();
    code = String(code || '').trim();
    if (!project || !code) return { ok: false, error: 'Project and code required.' };

    var ss = SpreadsheetApp.openById(id);
    var sh = ss.getSheetByName(project);
    if (!sh) return { ok: true, found: false };   // no tab yet -> no history

    var values = sh.getDataRange().getValues();
    if (values.length < 2) return { ok: true, found: false };

    var header = values[0];
    var iSubj = -1, iRem = -1;
    for (var h = 0; h < header.length; h++) {
      var hn = String(header[h]).trim().toLowerCase();
      if (hn === 'subject') iSubj = h;
      else if (hn === 'remarks') iRem = h;
    }
    if (iSubj === -1) return { ok: true, found: false };

    // Build a tolerant matcher: ignore leading zeros on the code
    // ("08" ~ "8", "02A" ~ "2A"), require a boundary before it and a
    // / - or space separator before the running number.
    var sig = code.replace(/^0+/, '');                  // "02A" -> "2A"
    var esc = sig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp('(?:^|[^0-9A-Za-z])0*' + esc + '[\\/\\-\\s]+0*(\\d{1,5})', 'gi');

    var max = -1, latestRaw = '';
    for (var i = 1; i < values.length; i++) {
      // Scan the Subject AND the Remarks (Remarks holds the auto ref
      // "Auto-generated letter <prefix>/<dept>/<code>/<NNN>" for letters
      // whose subject no longer contains the number).
      var hay = String(values[i][iSubj] == null ? '' : values[i][iSubj]);
      if (iRem !== -1) hay += '  ' + String(values[i][iRem] == null ? '' : values[i][iRem]);
      var m;
      re.lastIndex = 0;
      while ((m = re.exec(hay)) !== null) {
        var n = parseInt(m[1], 10);
        if (!isNaN(n) && n > max) { max = n; latestRaw = m[1]; }
      }
    }

    if (max < 0) return { ok: true, found: false };
    var pad = function (x) { var s = String(x); while (s.length < 3) s = '0' + s; return s; };
    return { ok: true, found: true, latest: pad(max), next: pad(max + 1) };
  } catch (err) {
    return { ok: false, error: err.toString() };
  }
}

// ── Auto-generated A4 letterhead documents ───────────────────────
// Per-project letterhead config. Only projects listed here can have a
// letter auto-generated; others fall back to "attach a file". Each ref
// number is <PREFIX>/<DEPARTMENT>/<CODE>/<RUNNING-NO>; DEPARTMENT comes
// from the document code via DEPT_BY_CODE.
var DEPT_BY_CODE = {
  '01':'บริหาร', '02A':'วิศวะ', '02B':'วิศวะ', '02C':'วิศวะ',
  '03':'วิศวะ', '08':'บุคคล', '09':'บัญชี'
  // 04/05/06/10 rarely used — no fixed department; fall back to วิศวะ.
};
function deptForCode_(code) {
  var c = String(code || '').trim().toUpperCase();
  return DEPT_BY_CODE[c] || 'วิศวะ';
}

// Shared Bangkok address block for the กิจการร่วมค้า joint-venture sites.
var JV_ADDRESS = [
  '2044 อาคารชวนะนันท์ ถนนเพชรบุรีตัดใหม่',
  'แขวงบางกะปิ เขตห้วยขวาง กรุงเทพมหานคร 10310',
  'โทรศัพท์ : +66 (0)2314-4101-5 โทรสาร : +66 (0) 2319-0921'
];

// Per-project letterhead. The HEADER is only: logo (if any) + company /
// joint-venture name + the หน่วยงาน (site) line. "เรียน" (recipient) is
// NOT fixed here — the user types it per letter (defaultTo just pre-
// fills the box for the three projects where we know the usual value).
// signName/signTitle/typist are filled only where confirmed from a real
// sample; when blank the letter prints "ขอแสดงความนับถือ" + blank lines
// for a hand signature (no guessed names on official letters).
var LETTERHEAD = {
  CVE: {
    prefix: 'CVE',
    company: ['บริษัท ชวนา เอ็นจิเนียร์ริ่ง จำกัด', 'CHAVANA ENGINEERING CO., LTD'],
    address: [], unit: '', logoFile: 'logo_cve.png',
    defaultTo: 'คุณวิวัฒน์ ชวนะนันท์',
    closing: 'จึงเรียนมาเพื่อโปรดพิจารณา',
    signName: 'นายสุรวัจ เภตราพิบูลย์โชติ', signTitle: 'ผู้จัดการโรงงาน',
    typist: ''
  },
  LPB: {
    prefix: 'VC-LBP',
    company: ['บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด'],
    address: [], unit: 'หน่วยงาน Luang Prabang', logoFile: 'logo_vcb.png',
    defaultTo: 'ผู้จัดการฝ่ายวิศวะฯ',
    closing: 'จึงเรียนมาเพื่อโปรดพิจารณา',
    signName: 'นายไชนุสร เอี้ยงเลิศ', signTitle: 'ผู้จัดการโครงการ',
    typist: ''
  },
  PN4: {
    prefix: 'BP',
    company: ['กิจการร่วมค้า วีเค'], address: JV_ADDRESS,
    unit: 'หน่วยงาน พุทธมณฑล ตอน 4', logoFile: '',
    defaultTo: 'ผู้จัดการฝ่ายวิศวกรรม',
    closing: 'จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ',
    signName: 'นายพศิน สุขธร', signTitle: 'ผู้จัดการโครงการ',
    typist: ''
  },
  // ── Joint-venture sites (text-only header). Company/site confirmed
  // by user; signatory/typist NOT yet supplied → blank (user signs the
  // generated Doc by hand or tells us the fixed name later).
  BT1: {
    prefix: 'BT', company: ['กิจการร่วมค้า วีเค'], address: JV_ADDRESS,
    unit: 'หน่วยงาน บางเตย ตอน 1', logoFile: '',
    defaultTo: '', closing: 'จึงเรียนมาเพื่อโปรดพิจารณา',
    signName: 'นายสมโพช โสนุช', signTitle: 'ผู้จัดการโครงการ', typist: ''
  },
  VC: {
    prefix: 'VC', company: ['กิจการร่วมค้า วีเค'], address: JV_ADDRESS,
    unit: 'หน่วยงาน ลาดหลุมแก้ว ตอน 3', logoFile: '',
    defaultTo: '', closing: 'จึงเรียนมาเพื่อโปรดพิจารณา',
    signName: '', signTitle: '', typist: ''
  },
  VK2: {
    prefix: 'BP', company: ['กิจการร่วมค้า วีเค'], address: JV_ADDRESS,
    unit: 'หน่วยงาน บางเตย ตอน 2', logoFile: '',
    defaultTo: '', closing: 'จึงเรียนมาเพื่อโปรดพิจารณา',
    signName: 'นายสมโพช โสนุช', signTitle: 'ผู้จัดการโครงการ', typist: ''
  },
  BV: {
    prefix: 'BV', company: ['กิจการร่วมค้า วีเค'], address: JV_ADDRESS,
    unit: 'หน่วยงาน บางวัว ตอน 6', logoFile: '',
    defaultTo: '', closing: 'จึงเรียนมาเพื่อโปรดพิจารณา',
    signName: '', signTitle: '', typist: ''
  },
  EP: {
    prefix: 'EP', company: ['กิจการร่วมค้า วีเค'], address: JV_ADDRESS,
    unit: 'หน่วยงาน บ้านแพ้ว ตอน 3', logoFile: '',
    defaultTo: '', closing: 'จึงเรียนมาเพื่อโปรดพิจารณา',
    signName: 'นายพศิน สุขธร', signTitle: 'ผู้จัดการโครงการ', typist: ''
  },
  'V&K': {
    prefix: 'VK', company: ['กิจการร่วมค้า วี แอนด์ เค'], address: JV_ADDRESS,
    unit: 'หน่วยงาน พุทธมณฑล ตอน 3', logoFile: '',
    defaultTo: '', closing: 'จึงเรียนมาเพื่อโปรดพิจารณา',
    signName: 'นายพศิน สุขธร', signTitle: 'ผู้จัดการโครงการ', typist: ''
  }
};

// Front-end uses this to show the body box and pre-fill the เรียน box.
// { projects:[...], defaults:{ proj: defaultTo } }
function getLetterheadMeta() {
  var projects = [], defaults = {};
  for (var p in LETTERHEAD) { projects.push(p); defaults[p] = LETTERHEAD[p].defaultTo || ''; }
  return { projects: projects, defaults: defaults };
}
// Back-compat (older clients).
function getLetterheadProjects() {
  var k = []; for (var p in LETTERHEAD) k.push(p); return k;
}


var THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

// "2026-05-30" or "30/05/2026" -> "30 พฤษภาคม 2569" (Buddhist era).
function thaiDate_(s) {
  s = String(s || '').trim();
  var d, m, y;
  var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  var dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (iso)      { y = +iso[1]; m = +iso[2]; d = +iso[3]; }
  else if (dmy) { d = +dmy[1]; m = +dmy[2]; y = +dmy[3]; }
  else {
    var n = new Date();
    d = n.getDate(); m = n.getMonth() + 1; y = n.getFullYear();
  }
  if (y < 2500) y += 543;                       // Gregorian -> Buddhist era
  return d + ' ' + (THAI_MONTHS[m - 1] || '') + ' ' + y;
}

// Make a file viewable by everyone at the company so the web app's
// embedded preview / Open works for all staff (not just the owner).
// Prefers domain-only; falls back to anyone-with-link.
function shareForViewing_(fileId) {
  var f;
  try { f = DriveApp.getFileById(fileId); } catch (e) { return; }
  // ANYONE_WITH_LINK first: this is what makes the embedded preview work
  // inside the (anonymous) web-app iframe — DOMAIN_WITH_LINK needs the
  // viewer's browser to have a vcb-con.com Google session in a 3rd-party
  // iframe, which is exactly what fails with "unable to open the file".
  try {
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e1) {
    try { f.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW); }
    catch (e2) { Logger.log('shareForViewing_ failed for ' + fileId + ': ' + e2); }
  }
}

// Pretty result page for the one-click runners (?action=...).
function _runnerHtml_(name, result) {
  var body = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  return HtmlService.createHtmlOutput(
    '<!doctype html><html><head><meta charset="utf-8"><title>' + name + '</title>' +
    '<style>body{font-family:Segoe UI,Arial,sans-serif;background:#0f1421;color:#e4e7ef;margin:0;padding:30px}' +
    'h2{color:#9dc3e6;margin:0 0 12px}pre{background:#1a2030;border:1px solid #2c3447;border-radius:8px;padding:18px;overflow:auto;font-size:13px;line-height:1.55;color:#e4e7ef;white-space:pre-wrap;word-break:break-word}' +
    '.h{color:#a8aec1;font-size:13px;margin-bottom:18px}</style></head><body>' +
    '<h2>' + _esc_(name) + '</h2>' +
    '<div class="h">Result returned by the server. Close this tab when done.</div>' +
    '<pre>' + _esc_(body) + '</pre>' +
    '</body></html>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Re-save EVERY email row whose Drive Link is empty or points to one
// of the workaround viewer URLs we wrote earlier. Pulls the original
// thread from Gmail, saves attachments via Drive API v3 into the
// right project folder, replaces the Drive Link cell with the real
// Drive URL. Logs per-row outcomes.
function resaveAllPendingRows_() {
  if (typeof Drive === 'undefined') {
    return 'Drive Advanced Service not enabled. Editor → Services (+) → Drive API v3 → Add.';
  }
  var ss = SpreadsheetApp.openById(getMasterId_());
  var sheets = ss.getSheets();
  var report = { tabs: {}, savedFiles: 0, errors: [] };
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s], nm = sh.getName();
    if (nm === DISCUSSION_SHEET || /summary/i.test(nm)) continue;
    var vals = sh.getDataRange().getValues();
    if (vals.length < 2) continue;
    var H = colMapLower_(vals[0]);
    var iUrl = H['drive link'], iTid = H['gmail thread-id'], iSrc = H['source'], iRem = H['remarks'];
    if (iUrl === undefined || iTid === undefined) continue;
    var canon = PROJECT_ALIAS[nm] || nm;
    var folderId = gmailFolderId_(canon, nm);
    for (var r = 1; r < vals.length; r++) {
      if (iSrc !== undefined && String(vals[r][iSrc] || '').trim().toLowerCase() !== 'email') continue;
      var url = String(vals[r][iUrl] || '').trim();
      var tid = String(vals[r][iTid] || '').trim();
      if (!tid || /^PENDING:/i.test(tid)) continue;
      // Skip rows that already have a *real* Drive URL.
      var needs = (!url) || /script\.google\.com.+action=/.test(url);
      if (!needs) continue;
      try {
        var th = GmailApp.getThreadById(tid);
        if (!th) { report.errors.push(nm + ' r' + (r+1) + ': thread missing'); continue; }
        var msgs = th.getMessages(), saved = [];
        var driveRe = /https:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]{20,})/g;
        var seenIds = {};
        for (var mi = 0; mi < msgs.length; mi++) {
          // (1) MIME attachments
          var atts = msgs[mi].getAttachments({ includeInlineImages: false, includeAttachments: true });
          for (var ai = 0; ai < atts.length; ai++) {
            try {
              var resource = { name: atts[ai].getName(), parents: [folderId] };
              var f = Drive.Files.create(resource, atts[ai], {
                supportsAllDrives: true, fields: 'id,name'
              });
              try { shareForViewing_(f.id); } catch (e) {}
              saved.push(f);
            } catch (e) {
              report.errors.push(nm + ' r' + (r+1) + ' "' + atts[ai].getName() + '": ' + e);
            }
          }
          // (2) Drive-shared files referenced inline in the body
          var body = '';
          try { body = msgs[mi].getBody() + '\n' + msgs[mi].getPlainBody(); } catch (e) {}
          driveRe.lastIndex = 0;
          var match;
          while ((match = driveRe.exec(body)) !== null) {
            var srcId = match[1];
            if (seenIds[srcId]) continue;
            seenIds[srcId] = true;
            try {
              var src = DriveApp.getFileById(srcId);
              var copy = Drive.Files.copy(
                { name: src.getName(), parents: [folderId] },
                srcId,
                { supportsAllDrives: true, fields: 'id,name' }
              );
              try { shareForViewing_(copy.id); } catch (e) {}
              saved.push(copy);
            } catch (e) {
              report.errors.push(nm + ' r' + (r+1) + ' [driveLink ' + srcId + ']: ' + e);
            }
          }
        }
        if (saved.length) {
          sh.getRange(r+1, iUrl+1)
            .setValue('https://drive.google.com/file/d/' + saved[0].id + '/view');
          if (iRem !== undefined && saved.length > 1) {
            sh.getRange(r+1, iRem+1)
              .setValue(saved.length + ' attachments — first in Drive Link, all viewable in the portal');
          }
          report.tabs[nm] = (report.tabs[nm] || 0) + 1;
          report.savedFiles += saved.length;
        }
      } catch (e) { report.errors.push(nm + ' r' + (r+1) + ': ' + e); }
    }
  }
  return report;
}

// One-shot test: writes a tiny "test.txt" into the LPB folder using
// Drive API v3. Tells us in plain text whether Drive API v3 + the
// folder + the script's permissions all work end-to-end.
function testDriveAPI() {
  try {
    if (typeof Drive === 'undefined') {
      Logger.log('FAIL: Drive advanced service is not enabled. Open Editor → Services (+) → Drive API (v3) → Add.');
      return 'FAIL: Drive advanced service not connected.';
    }
    var folderId = '1dKayj6ei1kC8x88CFfCrCofo1_NaF0zG'; // LPB
    var blob = Utilities.newBlob('hello ' + new Date(), 'text/plain', 'vcb-test.txt');
    var f = Drive.Files.create({ name: blob.getName(), parents: [folderId] }, blob, {
      supportsAllDrives: true, fields: 'id,name,parents,webViewLink'
    });
    Logger.log('OK: created ' + f.name + ' (id=' + f.id + ') in parents=' + JSON.stringify(f.parents) +
               '  link=' + f.webViewLink);
    return f;
  } catch (e) {
    Logger.log('FAIL: ' + e);
    return 'FAIL: ' + e;
  }
}

// Targeted rescue: force-save attachments via Drive API v3 for ONE row
// matched by its Gmail thread-id. Verbose Logger output for diagnosis,
// then writes the first file's URL into Drive Link, removes the row's
// Gmail-stream fallback URL if present.
function forceSaveByThreadId(threadId) {
  if (!threadId) return 'pass a thread id, e.g. forceSaveByThreadId("19e3973ded6bf049")';
  if (typeof Drive === 'undefined') return 'Drive advanced service not enabled.';
  var ss = SpreadsheetApp.openById(getMasterId_());
  var sheets = ss.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s], nm = sh.getName();
    if (nm === DISCUSSION_SHEET || /summary/i.test(nm)) continue;
    var vals = sh.getDataRange().getValues();
    if (vals.length < 2) continue;
    var H = colMapLower_(vals[0]);
    var iTid = H['gmail thread-id'], iUrl = H['drive link'], iRem = H['remarks'];
    if (iTid === undefined || iUrl === undefined) continue;
    for (var r = 1; r < vals.length; r++) {
      var tid = String(vals[r][iTid] || '').trim();
      if (tid !== String(threadId).trim()) continue;
      Logger.log('Found ' + nm + ' row ' + (r+1) + ' for thread ' + tid);
      var canon = PROJECT_ALIAS[nm] || nm;
      var folderId = gmailFolderId_(canon, nm);
      Logger.log('Folder id: ' + folderId);
      var th = GmailApp.getThreadById(tid);
      if (!th) { return { ok: false, error: 'thread not in Gmail' }; }
      var msgs = th.getMessages();
      var saved = [], errors = [];
      var driveRe = /https:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]{20,})/g;
      var seenDriveIds = {};
      for (var m = 0; m < msgs.length; m++) {
        // 1) Real MIME attachments
        var atts = msgs[m].getAttachments({ includeInlineImages: false, includeAttachments: true });
        for (var a = 0; a < atts.length; a++) {
          var attName = atts[a].getName();
          var sizeKb = 0;
          try { sizeKb = Math.round(atts[a].getBytes().length / 1024); } catch (e) {}
          try {
            var resource = { name: attName, parents: [folderId] };
            var f = Drive.Files.create(resource, atts[a], {
              supportsAllDrives: true, fields: 'id,name'
            });
            try { shareForViewing_(f.id); } catch (e) {}
            saved.push({ name: f.name, id: f.id, sizeKb: sizeKb, kind: 'attachment' });
          } catch (e) {
            errors.push({ name: attName, sizeKb: sizeKb, mime: atts[a].getContentType(),
                          error: e && e.message ? e.message : String(e), kind: 'attachment' });
          }
        }
        // 2) Drive-shared files referenced in the body (Gmail's "Insert
        // files using Drive" — these aren't MIME attachments, they're
        // clickable links to Drive files. Copy them into the folder.)
        var body = '';
        try { body = msgs[m].getBody() + '\n' + msgs[m].getPlainBody(); } catch (e) {}
        driveRe.lastIndex = 0;
        var match;
        while ((match = driveRe.exec(body)) !== null) {
          var srcId = match[1];
          if (seenDriveIds[srcId]) continue;
          seenDriveIds[srcId] = true;
          try {
            var src = DriveApp.getFileById(srcId);
            var sname = src.getName();
            var copy = Drive.Files.copy(
              { name: sname, parents: [folderId] },
              srcId,
              { supportsAllDrives: true, fields: 'id,name' }
            );
            try { shareForViewing_(copy.id); } catch (e) {}
            saved.push({ name: copy.name, id: copy.id, kind: 'driveLink', sourceId: srcId });
          } catch (e) {
            errors.push({ sourceId: srcId,
                          error: e && e.message ? e.message : String(e), kind: 'driveLink' });
          }
        }
      }
      if (saved.length) {
        sh.getRange(r+1, iUrl+1)
          .setValue('https://drive.google.com/file/d/' + saved[0].id + '/view');
        if (iRem !== undefined && saved.length > 1) {
          sh.getRange(r+1, iRem+1)
            .setValue(saved.length + ' attachments — first in Drive Link, all viewable in the portal');
        }
        return { ok: true, saved: saved, errors: errors };
      }
      return { ok: false, saved: [], errors: errors };
    }
  }
  return 'Row with that thread id not found.';
}

// ONE-CLICK RESCUE: run this in the editor to force-save attachments
// for every Email row that has a blank Drive Link, with VERBOSE logging
// so silent failures become visible. Idempotent. Capped to 30 rows so
// it always finishes within the editor's time limit.
function rescueMissingAttachments() {
  var ss = SpreadsheetApp.openById(getMasterId_());
  var sheets = ss.getSheets(), report = { tabs: {}, errors: [], done: 0 };
  for (var s = 0; s < sheets.length && report.done < 30; s++) {
    var sh = sheets[s], nm = sh.getName();
    if (nm === DISCUSSION_SHEET || /summary/i.test(nm)) continue;
    var vals = sh.getDataRange().getValues();
    if (vals.length < 2) continue;
    var H = colMapLower_(vals[0]);
    var iUrl = H['drive link'], iTid = H['gmail thread-id'], iSrc = H['source'];
    if (iUrl === undefined || iTid === undefined) continue;
    var folderId = (typeof gmailFolderId_ === 'function') ? gmailFolderId_(PROJECT_ALIAS[nm] || nm, nm) : '';
    Logger.log('[' + nm + '] folder id = ' + folderId);
    for (var r = 1; r < vals.length && report.done < 30; r++) {
      var url = String(vals[r][iUrl] || '').trim();
      if (url) continue;                       // already has a file
      var tid = String(vals[r][iTid] || '').trim();
      if (!tid || /^PENDING:/i.test(tid)) continue;
      if (iSrc !== undefined && String(vals[r][iSrc] || '').trim().toLowerCase() !== 'email') continue;
      try {
        var th = GmailApp.getThreadById(tid);
        if (!th) { report.errors.push(nm + ' row ' + (r+1) + ': thread ' + tid + ' not found'); continue; }
        var msgs = th.getMessages();
        var folder = DriveApp.getFolderById(folderId);
        var saved = [];
        for (var mi = 0; mi < msgs.length; mi++) {
          var atts = msgs[mi].getAttachments({ includeInlineImages: false, includeAttachments: true });
          for (var ai = 0; ai < atts.length; ai++) {
            try {
              var f = folder.createFile(atts[ai]);
              try { shareForViewing_(f.getId()); } catch (sh1) {
                report.errors.push(nm + ' row ' + (r+1) + ' share failed: ' + sh1);
              }
              saved.push('https://drive.google.com/file/d/' + f.getId() + '/view');
              Logger.log('  saved "' + f.getName() + '" → ' + f.getId());
            } catch (e1) {
              report.errors.push(nm + ' row ' + (r+1) + ' createFile failed: ' + e1);
            }
          }
        }
        if (saved.length) {
          sh.getRange(r + 1, iUrl + 1).setValue(saved[0]);
          report.tabs[nm] = (report.tabs[nm] || 0) + 1;
          report.done++;
        } else {
          report.errors.push(nm + ' row ' + (r+1) + ': 0 files saved (thread has ' + msgs.length + ' messages, 0 usable attachments)');
        }
      } catch (e) {
        report.errors.push(nm + ' row ' + (r+1) + ': ' + e);
      }
    }
  }
  Logger.log('RESCUE SUMMARY: ' + JSON.stringify(report, null, 2));
  return report;
}

// ONE-TIME migration: convert any =HYPERLINK("URL","Open") in the Drive
// Link column to a plain URL string. =HYPERLINK formulas confuse the
// portal's per-row docKey (getValues returns the display label "Open"
// instead of the URL, so every linked row collides on the same key and
// getDocAttachments returns the first matching row's thread for ALL of
// them — symptom: every Open click shows the same Gmail thread ID).
// Idempotent; safe to re-run.
function normalizeDriveLinks() {
  var ss = SpreadsheetApp.openById(getMasterId_());
  var converted = 0, perTab = {};
  var sheets = ss.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s], nm = sh.getName();
    if (nm === DISCUSSION_SHEET || /summary/i.test(nm)) continue;
    var lastRow = sh.getLastRow();
    if (lastRow < 2) continue;
    var lastCol = sh.getLastColumn();
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var H = colMapLower_(headers);
    var iUrl = H['drive link'];
    if (iUrl === undefined) continue;
    var range = sh.getRange(2, iUrl + 1, lastRow - 1, 1);
    var formulas = range.getFormulas();
    var tabCount = 0;
    for (var r = 0; r < formulas.length; r++) {
      var f = formulas[r][0];
      if (!f) continue;
      var m = f.match(/HYPERLINK\("([^"]+)"/i);
      if (m) {
        sh.getRange(r + 2, iUrl + 1).setValue(m[1]);
        tabCount++;
      }
    }
    if (tabCount) { perTab[nm] = tabCount; converted += tabCount; }
  }
  Logger.log('normalizeDriveLinks converted ' + converted + ' cells: ' + JSON.stringify(perTab));
  return { converted: converted, perTab: perTab };
}

// ONE-TIME helper: rewrite every Drive Link in the master sheet to point
// at the current Drive file whose name starts with the row's document
// code. Use after a Drive reorganization that left the files at new IDs
// (e.g. attachments were re-uploaded into the canonical project folders
// under "9. DOCUMENT CONTROL"). Idempotent — re-running re-resolves.
//
// Folder discovery is done by NAME, not by ID, so it survives folder
// moves and the stale ids in GMAIL_FOLDER_BY_KEY.
function relinkFromDriveByCode() {
  var ss = SpreadsheetApp.openById(getMasterId_());

  var TAB_TO_FOLDER_NAME = {
    'BT1':  'บางเตย ตอน1 (BT1)',
    'VC':   'ลาดหลุมแก้ว (LK)',
    'VK2':  'บางเตย ตอน2 (VK2)',
    'BV':   'บางวัว ตอน6 (BV)',
    'V&K':  'บรม ตอน3 (V&K)',
    'PN4':  'บรม ตอน4 (PN4)',
    'LPB':  'หลวงพระบาง (LPB)',
    'EP':   'บ้านแพ้ว (EP)',
    'CVE':  'โรงหล่อชวนา (CVE)',
    'UNCLASSIFIED': '_Unclassified'
  };
  var expected = {};
  for (var k in TAB_TO_FOLDER_NAME) expected[TAB_TO_FOLDER_NAME[k]] = true;

  // Locate the "9. DOCUMENT CONTROL" parent that actually contains the
  // expected project subfolders (defends against orphan folders of the
  // same name from prior reorgs).
  var parent = null;
  var pit = DriveApp.getFoldersByName('9. DOCUMENT CONTROL');
  while (pit.hasNext()) {
    var cand = pit.next();
    var sit = cand.getFolders();
    while (sit.hasNext()) {
      if (expected[sit.next().getName()]) { parent = cand; break; }
    }
    if (parent) break;
  }
  if (!parent) throw new Error('Could not find "9. DOCUMENT CONTROL" folder containing expected project subfolders.');
  Logger.log('Parent folder: ' + parent.getName() + ' (id=' + parent.getId() + ')');

  var folderByName = {};
  var sit2 = parent.getFolders();
  while (sit2.hasNext()) { var sf = sit2.next(); folderByName[sf.getName()] = sf; }

  // Code "essence" = digit-pair + optional letter, separator, digit run.
  // Matches "02C-036", "08-012", "02A/183", "08.925", "08 925" etc. Used
  // to normalize both subject and filename so different prefix styles
  // match (e.g. "BT/วิศวะ/02C/036" ↔ "BT-02C-036.pdf",
  // "VC-LBP สำนักงาน 08.925" ↔ "08-925"). Separators accepted: / - _ . space.
  function extractEssence(s) {
    if (!s) return '';
    var m = String(s).match(/(\d{2}[A-Z]?)[\/\-_.\s](\d{2,})/i);
    return m ? (m[1] + '-' + m[2]).toLowerCase() : '';
  }
  // Strip the optional letter (e.g. "02b-057" → "02-057") for a looser
  // fallback match — files re-uploaded by hand sometimes drop the letter.
  function essenceNoLetter(ess) {
    return ess ? ess.replace(/^(\d{2})[a-z]-/i, '$1-') : '';
  }

  var fileCache = {};
  function loadFiles(folderName) {
    if (fileCache[folderName] !== undefined) return fileCache[folderName];
    var f = folderByName[folderName];
    if (!f) { Logger.log('MISSING SUBFOLDER: ' + folderName); fileCache[folderName] = []; return []; }
    var arr = [], fit = f.getFiles();
    while (fit.hasNext()) {
      var fl = fit.next();
      var nm = fl.getName();
      arr.push({ id: fl.getId(), name: nm, essence: extractEssence(nm) });
    }
    Logger.log('  [' + folderName + '] ' + arr.length + ' files');
    fileCache[folderName] = arr;
    return arr;
  }

  // Lazy global index for cross-folder fallback (e.g. V&K rows logged
  // under the PN4 tab where the file actually lives in the V&K folder).
  var globalFiles = null;
  function getGlobalFiles() {
    if (globalFiles !== null) return globalFiles;
    globalFiles = [];
    for (var k in TAB_TO_FOLDER_NAME) {
      var arr = loadFiles(TAB_TO_FOLDER_NAME[k]);
      for (var i = 0; i < arr.length; i++) globalFiles.push(arr[i]);
    }
    return globalFiles;
  }

  function findByEssence(files, essence) {
    if (!essence) return null;
    for (var i = 0; i < files.length; i++) {
      if (files[i].essence === essence) return files[i];
    }
    return null;
  }

  var report = { tabs: {}, matched: 0, missed: 0, missedSamples: {}, skippedTabs: [] };
  var sheets = ss.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s], tab = sh.getName();
    var folderName = TAB_TO_FOLDER_NAME[tab];
    if (!folderName) { report.skippedTabs.push(tab); continue; }

    var lastRow = sh.getLastRow();
    if (lastRow < 2) continue;
    var lastCol = sh.getLastColumn();
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var H = colMapLower_(headers);
    var iSubj = H['subject'], iUrl = H['drive link'];
    if (iSubj === undefined || iUrl === undefined) {
      report.skippedTabs.push(tab + ' (no Subject/Drive Link col)'); continue;
    }

    var vals = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var localFiles = loadFiles(folderName);
    var stats = { matched: 0, crossMatched: 0, missed: 0, blank: 0 };

    for (var r = 0; r < vals.length; r++) {
      var subj = String(vals[r][iSubj] || '');
      var essence = extractEssence(subj);
      if (!essence) { stats.blank++; continue; }

      var hit = findByEssence(localFiles, essence);
      if (!hit) {
        hit = findByEssence(getGlobalFiles(), essence);
        if (hit) stats.crossMatched++;
      }
      // Loose fallback: drop the letter suffix on the subject's essence.
      if (!hit) {
        var loose = essenceNoLetter(essence);
        if (loose && loose !== essence) {
          hit = findByEssence(localFiles, loose) || findByEssence(getGlobalFiles(), loose);
        }
      }
      // Last resort: download attachments from the original Gmail thread
      // and save them into the project folder, then link to the first one.
      if (!hit) {
        var iTid = H['gmail thread-id'];
        var tid = iTid !== undefined ? String(vals[r][iTid] || '').trim() : '';
        if (tid && !/^PENDING:/i.test(tid)) {
          try {
            var th = GmailApp.getThreadById(tid);
            if (!th) {
              Logger.log('  row ' + (r + 2) + ': gmail thread not found (' + tid + ')');
            } else {
              var targetFolder = folderByName[folderName];
              if (!targetFolder) {
                Logger.log('  row ' + (r + 2) + ': cannot rescue, missing folder ' + folderName);
              } else {
                var msgs = th.getMessages();
                var firstSaved = null, savedCount = 0;
                for (var mi = 0; mi < msgs.length; mi++) {
                  var atts = msgs[mi].getAttachments({includeInlineImages: false, includeAttachments: true});
                  for (var ai = 0; ai < atts.length; ai++) {
                    try {
                      var newFile = targetFolder.createFile(atts[ai]);
                      try { shareForViewing_(newFile.getId()); } catch (shErr) {}
                      var entry = { id: newFile.getId(), name: newFile.getName(), essence: extractEssence(newFile.getName()) };
                      localFiles.push(entry);
                      if (globalFiles !== null) globalFiles.push(entry);
                      if (!firstSaved) firstSaved = entry;
                      savedCount++;
                    } catch (saveErr) {
                      Logger.log('  row ' + (r + 2) + ' createFile failed: ' + saveErr);
                    }
                  }
                }
                if (firstSaved) {
                  hit = firstSaved;
                  stats.rescuedFromGmail = (stats.rescuedFromGmail || 0) + 1;
                  Logger.log('  row ' + (r + 2) + ': rescued ' + savedCount + ' file(s) from Gmail (' + firstSaved.name + ')');
                } else {
                  Logger.log('  row ' + (r + 2) + ': gmail thread has 0 attachments (' + tid + ')');
                }
              }
            }
          } catch (gmailErr) {
            Logger.log('  row ' + (r + 2) + ' gmail rescue failed: ' + gmailErr);
          }
        }
      }
      if (hit) {
        sh.getRange(r + 2, iUrl + 1).setValue(
          'https://drive.google.com/file/d/' + hit.id + '/view');
        stats.matched++;
      } else {
        stats.missed++;
        if (!report.missedSamples[tab]) report.missedSamples[tab] = [];
        if (report.missedSamples[tab].length < 5) {
          report.missedSamples[tab].push(essence + ' | ' + subj.substring(0, 60));
        }
      }
    }

    report.tabs[tab] = stats;
    report.matched += stats.matched;
    report.missed += stats.missed;
    Logger.log('[' + tab + '] matched=' + stats.matched + ' (cross=' + stats.crossMatched + ')  missed=' + stats.missed + '  blank=' + stats.blank);
  }

  Logger.log('=== RELINK SUMMARY ===');
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

// Stream a Gmail attachment's bytes through the server (script reads
// Gmail as USER_DEPLOYING). This makes the viewer work even when the
// Drive copy of the attachment never got saved — the email itself is
// always the authoritative source.
function streamGmailAttachment(threadId, msgIdx, attIdx) {
  try {
    if (!threadId) return { ok: false, error: 'missing threadId' };
    var th = GmailApp.getThreadById(String(threadId).trim());
    if (!th) return { ok: false, error: 'Gmail thread not found' };
    var msgs = th.getMessages();
    var mi = parseInt(msgIdx, 10) || 0;
    if (mi < 0 || mi >= msgs.length) return { ok: false, error: 'message index out of range' };
    var atts = msgs[mi].getAttachments({ includeInlineImages: false, includeAttachments: true });
    var ai = parseInt(attIdx, 10) || 0;
    if (ai < 0 || ai >= atts.length) return { ok: false, error: 'attachment index out of range' };
    var a = atts[ai];
    var bytes = a.getBytes();
    var sizeKb = Math.round(bytes.length / 1024);
    if (bytes.length > 20 * 1024 * 1024) {
      return { ok: false, tooLarge: true, name: a.getName(),
               mime: a.getContentType(), sizeKb: sizeKb };
    }
    return { ok: true, name: a.getName(),
             mime: a.getContentType() || 'application/octet-stream',
             sizeKb: sizeKb, base64: Utilities.base64Encode(bytes) };
  } catch (err) { return { ok: false, error: String(err) }; }
}

// List EVERY attachment that belongs to a register row — for emails
// with multiple files, the Open viewer stacks them all. Pulls the names
// from the original Gmail thread (so nothing is missed) and maps them
// to the saved files in the project folder when present. If a Drive
// copy isn't there, returns a Gmail-source reference so the viewer can
// stream the attachment straight from the email.
function getDocAttachments(docId, authToken) {
  try {
    var viewer = resolveAuthEmail_(authToken);
    var ss = SpreadsheetApp.openById(getMasterId_());
    var sheets = ss.getSheets();
    for (var s = 0; s < sheets.length; s++) {
      var sh = sheets[s], nm = sh.getName();
      if (nm === DISCUSSION_SHEET || /summary/i.test(nm)) continue;
      var vals = sh.getDataRange().getValues();
      if (vals.length < 2) continue;
      var H = colMapLower_(vals[0]);
      var iSubj = H['subject']; if (iSubj === undefined) continue;
      var iTid = H['gmail thread-id'], iUrl = H['drive link'], iDate = H['date received'];
      var iCode = H['document type'];
      var canon = PROJECT_ALIAS[nm] || nm;
      for (var r = 1; r < vals.length; r++) {
        var url = iUrl !== undefined ? String(vals[r][iUrl] || '').trim() : '';
        var subj = String(vals[r][iSubj] || '').trim();
        var dt = iDate !== undefined ? normalizeDate_(vals[r][iDate]) : '';
        if (!rowMatchesDocId_(docId, url, canon, subj, dt)) continue;
        var rowCode = normalizeDocCode_(iCode !== undefined ? vals[r][iCode] : '', subj);
        if (!canViewDoc_(viewer, canon, rowCode)) {
          return { ok: false, error: 'You do not have access to this confidential document.' };
        }
        var tid = iTid !== undefined ? String(vals[r][iTid] || '').trim() : '';
        var atts = [];
        if (tid && !/^PENDING:/i.test(tid)) {
          try {
            var th = GmailApp.getThreadById(tid);
            if (th) {
              var msgs = th.getMessages();
              // Build a name → Drive files map of the project folder once.
              var byName = {};
              try {
                var folderId = (typeof gmailFolderId_ === 'function')
                  ? gmailFolderId_(canon, nm) : '';
                if (folderId) {
                  var folder = DriveApp.getFolderById(folderId);
                  var it = folder.getFiles();
                  while (it.hasNext()) {
                    var ff = it.next(), fn = ff.getName();
                    (byName[fn] = byName[fn] || []).push(ff);
                  }
                }
              } catch (e) { Logger.log('getDocAttachments folder: ' + e); }
              var seenDrive = {};
              var driveRe = /https:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]{20,})/g;
              for (var mi = 0; mi < msgs.length; mi++) {
                // (1) MIME attachments → match by name in the project folder.
                var aa = msgs[mi].getAttachments({ includeInlineImages: false, includeAttachments: true });
                for (var ai = 0; ai < aa.length; ai++) {
                  var nm2 = aa[ai].getName();
                  var hits = byName[nm2] || [], f0 = null;
                  for (var hi = 0; hi < hits.length; hi++) {
                    if (!seenDrive[hits[hi].getId()]) { f0 = hits[hi]; break; }
                  }
                  if (f0) {
                    var fid = f0.getId();
                    seenDrive[fid] = true;
                    try { shareForViewing_(fid); } catch (e) {}
                    atts.push({ source: 'drive', id: fid, name: f0.getName(),
                                mime: f0.getMimeType() || '',
                                url: 'https://drive.google.com/file/d/' + fid + '/view' });
                  }
                }
                // (2) Drive-share links in the body → match the source file's
                // name to the copy in the project folder.
                var body = '';
                try { body = msgs[mi].getBody() + '\n' + msgs[mi].getPlainBody(); } catch (e) {}
                driveRe.lastIndex = 0;
                var lm;
                while ((lm = driveRe.exec(body)) !== null) {
                  try {
                    var src = DriveApp.getFileById(lm[1]);
                    var sname = src.getName();
                    var lhits = byName[sname] || [], lf = null;
                    for (var lhi = 0; lhi < lhits.length; lhi++) {
                      if (!seenDrive[lhits[lhi].getId()]) { lf = lhits[lhi]; break; }
                    }
                    if (lf) {
                      var lfid = lf.getId();
                      seenDrive[lfid] = true;
                      try { shareForViewing_(lfid); } catch (e) {}
                      atts.push({ source: 'drive', id: lfid, name: lf.getName(),
                                  mime: lf.getMimeType() || '',
                                  url: 'https://drive.google.com/file/d/' + lfid + '/view' });
                    }
                  } catch (e) { /* source link inaccessible, ignore */ }
                }
              }
            }
          } catch (e) { Logger.log('getDocAttachments thread: ' + e); }
        }
        // Fallback: the row's Drive Link (manual rows / no thread).
        if (!atts.length && url) {
          var m = url.match(/\/d\/([^/]+)/);
          if (m) atts.push({ source: 'drive', id: m[1], name: subj || 'Document', mime: '', url: url });
        }
        return { ok: true, atts: atts, threadId: tid };
      }
    }
    return { ok: false, error: 'Row not found' };
  } catch (err) { return { ok: false, error: String(err) }; }
}

// Read-only diagnostic (?action=rowDiag&tab=VC): dump each row's
// Thread-ID / Drive Link / Source so a "can't open / no attachments"
// report can be traced to the actual cell contents instead of guessed
// at. Reads nothing else, writes nothing. This is what identified the
// 2026-08-19 column-shift corruption on the VC tab — worth keeping.
function rowDiag_(tabName) {
  try {
    var ss = SpreadsheetApp.openById(getMasterId_());
    var sh = ss.getSheetByName(tabName);
    if (!sh) return { ok: false, error: 'no such tab: ' + tabName };
    var v = sh.getDataRange().getValues();
    if (v.length < 2) return { ok: true, tab: tabName, rows: [] };
    var H = colMapLower_(v[0]);
    var iTid = H['gmail thread-id'], iUrl = H['drive link'],
        iSubj = H['subject'], iSrc = H['source'];
    var out = [];
    for (var r = 1; r < v.length; r++) {
      var tidRaw = iTid !== undefined ? v[r][iTid] : '';
      var urlRaw = iUrl !== undefined ? v[r][iUrl] : '';
      out.push({
        row: r + 1,
        subject: String(iSubj !== undefined ? v[r][iSubj] : '').slice(0, 60),
        source: String(iSrc !== undefined ? v[r][iSrc] : ''),
        tidType: (tidRaw instanceof Date) ? 'Date' : typeof tidRaw,
        tid: String(tidRaw || '').slice(0, 40),
        urlEmpty: !String(urlRaw || '').trim(),
        url: String(urlRaw || '').slice(0, 90)
      });
    }
    return { ok: true, tab: tabName, count: out.length, rows: out };
  } catch (err) { return { ok: false, error: String(err) }; }
}

// ── Enterprise file streaming ─────────────────────────────────────
// The app embeds documents via this function instead of public Drive
// previews, so files NEVER need to be shared "Anyone with the link" —
// the script reads them as USER_DEPLOYING (you) and serves the bytes
// to the in-app viewer iframe via a base64 → blob URL on the client.
// This is policy-stable: enabling/disabling external sharing at the
// Workspace level can't break the Open button.
//
// Max 20 MB per call (binary size). Native Google files (Docs/Sheets)
// can't be streamed as binary — for those we return a fallback /preview
// URL the client uses with an iframe, as before. Drive Link rows that
// store a real file (PDF/image/etc., which is what the auto-logger and
// the letter generator now produce) get the streamed path.
function streamFileForViewer(fileId) {
  try {
    var raw = String(fileId || '').trim();
    if (!raw) return { ok: false, error: 'missing fileId' };
    var m = raw.match(/[-\w]{20,}/);     // accept a raw ID or any Drive URL
    var id = m ? m[0] : raw;
    var f;
    try { f = DriveApp.getFileById(id); }
    catch (e) { return { ok: false, error: 'file not found / no access' }; }
    var mime = f.getMimeType() || '';
    var name = f.getName() || 'document';
    // Native Google formats can't be served as binary bytes — let the
    // client use the standard /preview URL (those are typically already
    // shared with the org / via Drive's own access control).
    if (/^application\/vnd\.google-apps\./.test(mime)) {
      var which = mime.indexOf('document') >= 0 ? 'document'
                 : mime.indexOf('spreadsheet') >= 0 ? 'spreadsheets'
                 : mime.indexOf('presentation') >= 0 ? 'presentation' : 'file';
      return { ok: false, isNative: true, name: name, mime: mime,
        previewUrl: 'https://docs.google.com/' + which + '/d/' + id + '/preview' };
    }
    var blob = f.getBlob();
    var bytes = blob.getBytes();
    var sizeKb = Math.round(bytes.length / 1024);
    if (bytes.length > 20 * 1024 * 1024) {
      return { ok: false, tooLarge: true, name: name, mime: mime, sizeKb: sizeKb,
               openUrl: 'https://drive.google.com/file/d/' + id + '/view' };
    }
    return { ok: true, name: name, mime: mime, sizeKb: sizeKb,
             base64: Utilities.base64Encode(bytes) };
  } catch (err) { return { ok: false, error: String(err) }; }
}

// Builds the finished A4 letter as an editable Google Doc inside the
// project's Drive folder and returns its URL. Header/ref/date/subject/
// signature are filled; the body is whatever the user typed.
function generateLetterDoc_(cfg, opts) {
  var title = opts.ref.replace(/[\/\\]/g, '-') + ' ' + (opts.subject || '');
  var doc = DocumentApp.create(title);
  var body = doc.getBody();

  // A4 page. Top margin kept tight so the letterhead sits near the top
  // (not wasting the upper third); sides/bottom ~1 inch.
  body.setPageWidth(595.3).setPageHeight(841.9);
  body.setMarginTop(28).setMarginBottom(56).setMarginLeft(64).setMarginRight(64);

  var C = DocumentApp.HorizontalAlignment.CENTER;
  var R = DocumentApp.HorizontalAlignment.RIGHT;
  var first = body.getParagraphs()[0];           // reuse the default empty para

  // Optional logo, centered. Prefer the embedded base64 (Logos.js) so
  // nothing needs to live in Drive; fall back to a Drive file by name.
  if (cfg.logoFile) {
    try {
      var logoBlob = null;
      if (typeof LOGO_B64 !== 'undefined' && LOGO_B64[cfg.logoFile]) {
        logoBlob = Utilities.newBlob(
          Utilities.base64Decode(LOGO_B64[cfg.logoFile]), 'image/jpeg', cfg.logoFile);
      } else {
        var it = DriveApp.getFilesByName(cfg.logoFile);
        if (it.hasNext()) logoBlob = it.next().getBlob();
      }
      if (logoBlob) {
        var img = first.appendInlineImage(logoBlob);
        var w = 150, ratio = img.getHeight() / img.getWidth();
        img.setWidth(w).setHeight(Math.round(w * ratio));
        first.setAlignment(C);
        first = body.appendParagraph('');
      }
    } catch (e) { Logger.log('logo "' + cfg.logoFile + '" load failed: ' + e); }
  }

  function head(text, sizeBold) {
    var p = (first ? first : body.appendParagraph(''));
    first = null;
    p.setText(text); p.setAlignment(C);
    p.editAsText().setBold(true).setFontSize(sizeBold ? 16 : 12);
    return p;
  }
  head(cfg.company[0], true);
  for (var i = 1; i < cfg.company.length; i++) {
    var pc = body.appendParagraph(cfg.company[i]);
    pc.setAlignment(C); pc.editAsText().setBold(true).setFontSize(12);
  }
  for (var a = 0; a < cfg.address.length; a++) {
    var pa = body.appendParagraph(cfg.address[a]);
    pa.setAlignment(C); pa.editAsText().setBold(false).setFontSize(11);
  }
  if (cfg.address.length) body.appendHorizontalRule();
  if (cfg.unit) {
    var pu = body.appendParagraph(cfg.unit);
    pu.setAlignment(C); pu.editAsText().setBold(true).setFontSize(13);
  }

  body.appendParagraph('');
  body.appendParagraph('เอกสารเลขที่  ' + opts.ref);
  var pd = body.appendParagraph('วันที่  ' + opts.thaiDate);
  pd.setAlignment(R);
  body.appendParagraph('เรื่อง  ' + (opts.subject || ''));
  body.appendParagraph('เรียน  ' + (opts.to || ''));   // user-entered recipient
  var ccv = String(opts.cc || '').trim();
  if (ccv) body.appendParagraph('สำเนาเรียน  ' + ccv);
  body.appendParagraph('');

  var bodyText = String(opts.bodyText || '').replace(/\r\n/g, '\n');
  var lines = bodyText.split('\n');
  // No automatic first-line indent — the writer adds their own spacing if
  // they want one.
  for (var b = 0; b < lines.length; b++) {
    body.appendParagraph(lines[b]);
  }

  // NOTE: no auto closing line ("จึงเรียนมาเพื่อโปรดพิจารณา"). Some
  // letters are informational only — the writer types their own closing
  // sentence in the body.
  // Default sign-off position ≈ 1/3–just-over-half down the page; only
  // a longer body pushes it further (gap floors at 2). ~40 lines fill an
  // A4, header uses ~11, so aim total ≈ 17 (~43%) for a short letter.
  var gap = Math.max(2, 17 - 11 - lines.length);
  for (var g = 0; g < gap; g++) body.appendParagraph('');

  var s1 = body.appendParagraph('ขอแสดงความนับถือ'); s1.setAlignment(R);

  // Signature image (optional, embedded like the logos via SIG_B64).
  var sigShown = false;
  if (cfg.sigFile && typeof SIG_B64 !== 'undefined' && SIG_B64[cfg.sigFile]) {
    try {
      var sp = body.appendParagraph('');
      var sImg = sp.appendInlineImage(Utilities.newBlob(
        Utilities.base64Decode(SIG_B64[cfg.sigFile]), 'image/png', cfg.sigFile));
      var sw = 140, sr = sImg.getHeight() / sImg.getWidth();
      sImg.setWidth(sw).setHeight(Math.round(sw * sr));
      sp.setAlignment(R);
      sigShown = true;
    } catch (e) { Logger.log('sig "' + cfg.sigFile + '" load failed: ' + e); }
  }
  if (!sigShown) { body.appendParagraph(''); body.appendParagraph(''); }

  if (cfg.signName) {
    var s2 = body.appendParagraph('(' + cfg.signName + ')'); s2.setAlignment(R);
  }
  if (cfg.signTitle) {
    var s3 = body.appendParagraph(cfg.signTitle); s3.setAlignment(R);
  }

  var typist = String(opts.typist || cfg.typist || '').trim();
  if (typist) {
    if (!/พิมพ์/.test(typist)) typist += '/พิมพ์';
    body.appendParagraph(''); body.appendParagraph('');
    var pt = body.appendParagraph(typist);
    pt.setAlignment(R); pt.editAsText().setFontSize(10);
  }

  // Match the on-screen preview: a Thai serif/sans like the preview's
  // "TH Sarabun New" instead of the Doc default (which renders Thai
  // heavy/bold-looking). Font-family doesn't touch the bold ranges
  // (header stays bold); explicitly normalise the body to non-bold.
  try {
    var allTxt = body.editAsText();
    allTxt.setFontFamily('Sarabun');
  } catch (e) { Logger.log('font set failed: ' + e); }

  doc.saveAndClose();

  // Move into the project folder (out of My Drive root).
  if (opts.folderId) {
    try {
      var f = DriveApp.getFileById(doc.getId());
      DriveApp.getFolderById(opts.folderId).addFile(f);
      DriveApp.getRootFolder().removeFile(f);
    } catch (mv) { Logger.log('letter move failed: ' + mv); }
  }
  shareForViewing_(doc.getId());

  // Also export a PDF copy. Google Docs editor previews refuse to embed
  // inside the app's sandboxed iframe ("unable to open the file"); a
  // Drive PDF preview embeds reliably. The PDF is what the register
  // links to/opens; the Doc stays for editing.
  var pdfUrl = '';
  try {
    var pdfBlob = DriveApp.getFileById(doc.getId()).getAs('application/pdf')
                    .setName(title + '.pdf');
    var pdfFile;
    if (opts.folderId) {
      pdfFile = DriveApp.getFolderById(opts.folderId).createFile(pdfBlob);
    } else {
      pdfFile = DriveApp.createFile(pdfBlob);
    }
    shareForViewing_(pdfFile.getId());
    pdfUrl = 'https://drive.google.com/file/d/' + pdfFile.getId() + '/view';
  } catch (pe) { Logger.log('PDF export failed: ' + pe); }

  return { docUrl: doc.getUrl(), pdfUrl: pdfUrl };
}

// HTML render of the SAME letter, for the on-screen A4 preview (no Doc
// is created). Kept visually close to generateLetterDoc_.
function generateLetterHtml_(cfg, opts) {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }
  var H = [];
  H.push('<div class="pg">');
  if (cfg.logoFile && typeof LOGO_B64 !== 'undefined' && LOGO_B64[cfg.logoFile]) {
    H.push('<div class="ctr"><img class="logo" src="data:image/jpeg;base64,' +
      LOGO_B64[cfg.logoFile] + '"></div>');
  }
  H.push('<div class="ctr co1">' + esc(cfg.company[0]) + '</div>');
  for (var i = 1; i < cfg.company.length; i++)
    H.push('<div class="ctr co2">' + esc(cfg.company[i]) + '</div>');
  for (var a = 0; a < cfg.address.length; a++)
    H.push('<div class="ctr ad">' + esc(cfg.address[a]) + '</div>');
  if (cfg.address.length) H.push('<hr>');
  if (cfg.unit) H.push('<div class="ctr unit">' + esc(cfg.unit) + '</div>');

  H.push('<div class="sp"></div>');
  H.push('<div>เอกสารเลขที่&nbsp;&nbsp;' + esc(opts.ref) + '</div>');
  H.push('<div class="rt">วันที่&nbsp;&nbsp;' + esc(opts.thaiDate) + '</div>');
  H.push('<div>เรื่อง&nbsp;&nbsp;' + esc(opts.subject) + '</div>');
  H.push('<div>เรียน&nbsp;&nbsp;' + esc(opts.to) + '</div>');
  if (String(opts.cc || '').trim())
    H.push('<div>สำเนาเรียน&nbsp;&nbsp;' + esc(String(opts.cc).trim()) + '</div>');
  H.push('<div class="sp"></div>');

  var lines = String(opts.bodyText || '').replace(/\r\n/g, '\n').split('\n');
  if (opts.editable) {
    // One editable region styled like the body; the page chrome around
    // it (header/ref/date/subject/เรียน/signature) stays fixed.
    H.push('<div id="bxBody" contenteditable="true" class="bd bxedit">' +
      lines.map(function (l) { return esc(l) || '<br>'; }).join('<br>') +
      '</div>');
  } else {
    for (var b = 0; b < lines.length; b++)
      H.push('<div class="bd">' + (esc(lines[b]) || '&nbsp;') + '</div>');
  }

  // No auto closing line — the writer types their own in the body.
  // Default sign-off ≈ 1/3–just-over-half down; long bodies push it.
  var hGap = Math.max(2, 17 - 11 - lines.length);
  H.push('<div style="height:' + (hGap * 1.5) + 'em"></div>');
  H.push('<div class="sig">');
  H.push('<div>ขอแสดงความนับถือ</div>');
  if (cfg.sigFile && typeof SIG_B64 !== 'undefined' && SIG_B64[cfg.sigFile]) {
    H.push('<img class="sigimg" src="data:image/png;base64,' + SIG_B64[cfg.sigFile] + '">');
  } else {
    H.push('<div class="sp2"></div>');
  }
  if (cfg.signName)  H.push('<div>(' + esc(cfg.signName) + ')</div>');
  if (cfg.signTitle) H.push('<div>' + esc(cfg.signTitle) + '</div>');
  H.push('</div>');
  var hTypist = String(opts.typist || cfg.typist || '').trim();
  if (hTypist) {
    if (!/พิมพ์/.test(hTypist)) hTypist += '/พิมพ์';
    H.push('<div class="sp"></div>');
    H.push('<div class="rt ty">' + esc(hTypist) + '</div>');
  }
  // Comments go INSIDE the letter page (same A4, continuing after the
  // letter; overflow naturally flows to new printed A4 pages) and BEFORE
  // any attachment pages.
  if (opts.commentsHtml) H.push(opts.commentsHtml);
  H.push('</div>');                       // close the letter .pg
  if (opts.attachHtml) H.push(opts.attachHtml);   // attachment pages last

  return '<!doctype html><html><head><meta charset="utf-8"><style>' +
    'html,body{margin:0;background:#f0f2f5}' +
    "*{font-family:'TH Sarabun New','Sarabun','Tahoma',sans-serif}" +
    'html,body{overflow-x:hidden}' +
    // Fluid on screen (never clips in the narrower review window); fixed
    // A4 only when printing (handled in @media print below).
    '.pg{width:100%;max-width:210mm;min-height:297mm;margin:14px auto;padding:4% 7% 7%;' +
    'box-sizing:border-box;background:#fff;border:1px solid #dcdfe6;box-shadow:0 1px 3px rgba(0,0,0,.15);font-size:16px;color:#000;line-height:1.5}' +
    '.ctr{text-align:center}.rt{text-align:right}' +
    '.co1{font-weight:700;font-size:22px}.co2{font-weight:700;font-size:17px}' +
    '.ad{font-size:14px}.unit{font-weight:700;font-size:18px;margin-top:4px}' +
    '.logo{max-width:190px;height:auto;margin-bottom:6px}' +
    'hr{border:none;border-top:1px solid #000;margin:8px 0}' +
    '.sp{height:14px}.sp2{height:46px}' +
    '.bd{text-align:justify}' +
    '.bxedit{min-height:300px;outline:2px dashed #1a73e8;outline-offset:6px;padding:2px}' +
    '.bxedit:focus{outline-color:#137333}' +
    '.sig{width:48%;margin-left:52%;text-align:center}' +
    '.sigimg{max-width:170px;height:auto;display:block;margin:2px auto}' +
    '.ty{font-size:13px}' +
    // Comments section — continues on the letter page, then flows to new
    // A4 sheets; sits before any attachment pages.
    '.cmts{margin-top:14px;border-top:1px solid #999;padding-top:6px}' +
    '.cmts h4{margin:0 0 6px;font-size:14px}' +
    '.cmts ol{margin:0;padding-left:22px}' +
    '.cmts li{padding:2px 0 6px;border-bottom:1px dotted #d8d8d8}' +
    '.cmts li::marker{font-weight:700;color:#1a3a6b}' +
    '.cmts .meta{font-size:11px;color:#777;margin-bottom:1px}' +
    '.cmts .act{font-weight:700}' +
    '.cmts .ap{color:#137333}.cmts .rj{color:#c5221f}' +
    '.cmts .tx{font-size:13px;color:#111;white-space:pre-wrap;word-break:break-word;line-height:1.35}' +
    '.cmts .cc{font-size:12px;color:#8a5a00;background:#fff4e5;border:1px solid #ffd9a8;border-radius:5px;padding:3px 8px;margin-top:5px;display:inline-block}' +
    '.cmts .ink{max-width:100%;border:1px solid #ddd;border-radius:4px;background:#fff}' +
    '.attpg{break-before:page;page-break-before:always}' +
    '@media print{html,body{background:#fff;overflow:visible}.pg{width:210mm;max-width:none;margin:0;padding:10mm 20mm 22mm;box-shadow:none}}' +
    '</style></head><body>' + H.join('') + '</body></html>';
}

// Returns { ok, ref, html } for the pre-submit A4 preview (no Doc made).
function previewLetter(data) {
  try {
    var cfg = LETTERHEAD[data.project];
    if (!cfg) return { ok: false, error: 'No letter template for this project.' };
    var rn = getNextRunningNumber(data.project, data.code);
    var runNo = (rn && rn.ok && rn.found) ? rn.next : '001';
    var codeForRef = String(data.code || '').trim();
    var ref = cfg.prefix + '/' + deptForCode_(codeForRef) + '/' +
              codeForRef + '/' + runNo;
    var html = generateLetterHtml_(cfg, {
      ref: ref,
      thaiDate: thaiDate_(data.docDate),
      subject: data.subject || '',
      to: String(data.to || '').trim(),
      cc: String(data.cc || '').trim(),
      typist: String(data.typist || '').trim(),
      bodyText: String(data.body || ''),
      editable: !!data.editable
    });
    return { ok: true, ref: ref, html: html };
  } catch (err) {
    return { ok: false, error: err.toString() };
  }
}

// ── Review / approval workflow ───────────────────────────────────
// A single hidden tab "Discussions" in the master sheet stores every
// comment and decision (append-only). A document's status is derived:
// the FIRST approve/reject locks it and is final; comments are allowed
// only while still pending. Anyone signed in may comment; only emails
// in Script Property MANAGEMENT_EMAILS may approve/reject.
var DISCUSSION_SHEET = 'Discussions';
var DISCUSSION_HEADER = ['Timestamp', 'DocID', 'Project', 'Email', 'Action', 'Text'];

// Management team allowed to Approve/Reject. Add the other 3-4 emails
// here (lowercase) when known. The Script Property MANAGEMENT_EMAILS,
// if set, overrides this list.
var MANAGEMENT_DEFAULT = [
  'c.chavananand@vcb-con.com'
];

// CC-by-department. The reviewer picks departments (not raw emails);
// each routes to that department head's address. Fill the emails in
// DEPT_EMAILS_DEFAULT (or override at runtime via Script Property
// DEPT_EMAILS as JSON {"eng":"x@vcb-con.com",...}). 'email' may be
// blank for now — selecting it still records on the thread; the email
// is simply skipped until you set it.
var DEPARTMENTS = [
  { key: 'engineer', label: 'ฝ่ายวิศวกรรม' },
  { key: 'hr', label: 'ฝ่ายบุคคล' },
  { key: 'account', label: 'ฝ่ายบัญชี' },
  { key: 'finance', label: 'ฝ่ายการเงิน' },
  { key: 'supply', label: 'ฝ่ายพัสดุ-ทรัพย์สิน' },
  { key: 'borihan', label: 'ฝ่ายบริหาร' }
];
var DEPT_EMAILS_DEFAULT = {
  borihan: '', engineer: '', supply: '', hr: '', account: '', finance: ''
};
function getDepartments() { return DEPARTMENTS; }   // client builds the picker
function getDeptEmails_() {
  var raw = PropertiesService.getScriptProperties().getProperty('DEPT_EMAILS');
  if (raw) { try { return JSON.parse(raw); } catch (e) {} }
  return DEPT_EMAILS_DEFAULT;
}
// One-time/admin: link departments to emails, e.g.
// setDeptEmails('{"engineer":"eng.head@vcb-con.com","account":"..."}')
function setDeptEmails(json) {
  JSON.parse(json);                                  // validate
  PropertiesService.getScriptProperties().setProperty('DEPT_EMAILS', String(json));
  Logger.log('DEPT_EMAILS saved: ' + json);
  return getDeptEmails_();
}
// Resolve selected department keys + any free-typed emails →
// { labelStr, emails[] }. Thread shows the dept labels and the typed
// emails; notifications go to dept-head emails + the typed ones.
function resolveDepts_(ccDepts, ccEmails) {
  var keys = String(ccDepts || '').split(/[\s,;]+/)
    .map(function (k) { return k.trim(); }).filter(function (k) { return k; });
  var byKey = {}; for (var i = 0; i < DEPARTMENTS.length; i++) byKey[DEPARTMENTS[i].key] = DEPARTMENTS[i].label;
  var emap = getDeptEmails_();
  var labels = [], emails = [];
  for (var j = 0; j < keys.length; j++) {
    var k = keys[j];
    if (byKey[k]) labels.push(byKey[k]);
    var em = emap[k];
    if (em && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(em).trim())) emails.push(String(em).trim());
  }
  String(ccEmails || '').split(/[\s,;]+/).forEach(function (e) {
    e = e.trim();
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { labels.push(e); emails.push(e); }
  });
  return { labelStr: labels.join(', '), emails: emails };
}

// One-time/admin: set the manager allow-list. Comma/space/newline list.
function setManagementEmails(csv) {
  PropertiesService.getScriptProperties().setProperty(
    'MANAGEMENT_EMAILS', String(csv || '').trim());
  Logger.log('MANAGEMENT_EMAILS = ' + getManagementEmails_().join(', '));
  return getManagementEmails_();
}
function getManagementEmails_() {
  var raw = PropertiesService.getScriptProperties().getProperty('MANAGEMENT_EMAILS') || '';
  var list = raw.split(/[\s,;]+/).map(function (e) { return e.trim().toLowerCase(); })
                .filter(function (e) { return e; });
  if (list.length) return list;
  return MANAGEMENT_DEFAULT.map(function (e) { return e.toLowerCase(); });
}
// The owner can ALWAYS approve/reject/delete, regardless of the
// configured management list (or a Script Property override).
var OWNER_EMAIL = 'c.chavananand@vcb-con.com';
function isManager_(email) {
  var e = String(email || '').trim().toLowerCase();
  if (!e) return false;
  // DEMO MODE: when the Script Property DEMO_ALL_MANAGERS === '1', every
  // signed-in user may Approve/Reject so trial users can try everything.
  // Toggle via the web-app URLs ?action=demoOn / ?action=demoOff, or
  // delete the property to restore the owner/MANAGEMENT_EMAILS list.
  if (PropertiesService.getScriptProperties().getProperty('DEMO_ALL_MANAGERS') === '1') return true;
  if (e === OWNER_EMAIL) return true;
  return getManagementEmails_().indexOf(e) >= 0;
}

// ── Per-document access control ────────────────────────────────────
// Two-state model. Each document-type code (and each project) is either
// PUBLIC (everyone signed in can see + open it) or CONFIDENTIAL (only the
// owner and an explicit allow-list of emails can see + open it). Owner
// ALWAYS has full visibility. Enforced server-side in both the register
// listing (getDocuments) and the open path (getDocAttachments).
//
// Default: document codes 01–07, 09, 10 are PUBLIC; everything else
// (notably 08 = ฝ่ายบุคคล / HR) is CONFIDENTIAL until the owner authorises
// specific emails. Projects default to PUBLIC. The owner can flip any of
// these in Settings → Access Control.
//
// Stored as JSON in the ACCESS_RULES script property; each entry is an
// explicit { conf:<bool>, allow:[emails] }:
//   { "codes":    { "08": { "conf": true,  "allow": ["hr@vcb-con.com"] } },
//     "projects": { "CVE": { "conf": false, "allow": [] } } }
// Codes never seen before fall back to the default below.
var DEFAULT_PUBLIC_CODE_PREFIXES = {
  '01': 1, '02': 1, '03': 1, '04': 1, '05': 1, '06': 1, '07': 1, '09': 1, '10': 1
};
function getAccessRules_() {
  var raw = PropertiesService.getScriptProperties().getProperty('ACCESS_RULES');
  if (raw) {
    try {
      var o = JSON.parse(raw);
      return { codes: o.codes || {}, projects: o.projects || {} };
    } catch (e) {}
  }
  return { codes: {}, projects: {} };
}
// Pad a single leading digit so "8" -> "08" (matches the client's
// fmtCode and the document-type filter), preserving any trailing letter
// ("2A" stays "2A"). Used to key the per-code allow-list.
function fmtCode_(c) {
  var s = String(c == null ? '' : c).trim();
  var m = s.match(/^(\d+)(.*)$/);
  if (m && m[1].length === 1) return '0' + m[1] + m[2];
  return s;
}
// Numeric prefix of a code: "02A" -> "02", "08" -> "08". Groups the
// lettered engineering codes (02A/02B/02C) under one default.
function codePrefix_(c) {
  var m = fmtCode_(c).match(/^(\d+)/);
  return m ? m[1] : '';
}
// Lower-case, validate and de-dupe a list of email addresses.
function normEmailList_(arr) {
  var out = [];
  (arr || []).forEach(function (e) {
    e = String(e || '').trim().toLowerCase();
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && out.indexOf(e) < 0) out.push(e);
  });
  return out;
}
// Whether a document code is confidential by default (no stored override).
function codeDefaultConfidential_(code) {
  return !DEFAULT_PUBLIC_CODE_PREFIXES[codePrefix_(code)];
}
// Resolve { conf, allow } for a code, honouring a stored override on the
// exact code first, then its numeric prefix, then the default.
function codeAccess_(rules, code) {
  var entry = rules.codes[fmtCode_(code)] || rules.codes[codePrefix_(code)];
  var conf = (entry && typeof entry.conf === 'boolean')
    ? entry.conf : codeDefaultConfidential_(code);
  return { conf: conf, allow: (entry && entry.allow) || [] };
}
// True if `email` may view/open a row in `project` with document `code`.
// Owner always may. A confidential code or project blocks anyone not on
// its allow-list. Both the code gate AND the project gate must pass.
function canViewDoc_(email, project, code) {
  var e = String(email || '').trim().toLowerCase();
  if (e && e === OWNER_EMAIL) return true;          // owner sees everything
  var rules = getAccessRules_();
  var ca = codeAccess_(rules, code);
  if (ca.conf && normEmailList_(ca.allow).indexOf(e) < 0) return false;
  var pe = rules.projects[String(project || '')];
  if (pe && pe.conf && normEmailList_(pe.allow).indexOf(e) < 0) return false;
  return true;
}

// Admin (manager / owner) only: read the current rules + label/default
// metadata. This is intentionally a fast Script-Property read only — the
// universe of codes and projects is built CLIENT-side from the documents
// already loaded in the portal, so opening the panel never waits on a
// full sheet scan. Non-admins get { ok:false, isAdmin:false }.
function getAccessConfig(authToken) {
  var email = resolveAuthEmail_(authToken);
  if (!email || !isManager_(email)) {
    return { ok: false, isAdmin: false,
             error: 'Only the management team can view access settings.' };
  }
  return {
    ok: true, isAdmin: true, email: email,
    rules: getAccessRules_(),
    codeLabels: DEPT_BY_CODE,
    defaultPublicPrefixes: Object.keys(DEFAULT_PUBLIC_CODE_PREFIXES)
  };
}

// Admin only: replace the access rules. `json` is
//   { codes:{ "<code>": { conf:<bool>, allow:[emails] } }, projects:{ … } }
// Each entry is stored explicitly so behaviour stays predictable after a
// save; codes never listed fall back to the default-public set.
function setAccessConfig(authToken, json) {
  try {
    var email = resolveAuthEmail_(authToken);
    if (!email || !isManager_(email)) {
      return { ok: false, error: 'Only the management team can change access settings.' };
    }
    var o = JSON.parse(json || '{}');
    var clean = { codes: {}, projects: {} };
    ['codes', 'projects'].forEach(function (kind) {
      var src = o[kind] || {};
      for (var k in src) {
        var entry = src[k] || {};
        clean[kind][String(k).trim()] = {
          conf: !!entry.conf,
          allow: normEmailList_(entry.allow)
        };
      }
    });
    PropertiesService.getScriptProperties().setProperty('ACCESS_RULES', JSON.stringify(clean));
    Logger.log('ACCESS_RULES saved by ' + email + ': ' + JSON.stringify(clean));
    return { ok: true, rules: clean };
  } catch (err) {
    return { ok: false, error: err.toString() };
  }
}

// Resolve a sign-in token (from the existing Google OAuth popup) to a
// verified email, or '' if missing/expired.
function resolveAuthEmail_(authToken) {
  // 1) Honour the custom OAuth token if the client passed one and it's
  //    still valid. (Pre-existing behaviour — keeps the popup sign-in
  //    flow working for anonymous deployments.)
  if (authToken) {
    var stored = PropertiesService.getScriptProperties().getProperty('auth_' + authToken);
    if (stored) {
      var parts = stored.split('|');
      if (new Date().getTime() <= parseInt(parts[1], 10)) {
        return parts[0] || '';
      }
      PropertiesService.getScriptProperties().deleteProperty('auth_' + authToken);
    }
  }
  // 2) Fall back to Session.getActiveUser() — works when the web-app
  //    access is "Anyone with a Google account" or domain-restricted,
  //    because the page itself required a Google sign-in. This means
  //    the user no longer needs to click the custom Sign-in popup just
  //    to comment / approve.
  try {
    var sessEmail = Session.getActiveUser().getEmail();
    if (sessEmail) return sessEmail;
  } catch (e) {}
  return '';
}

// Stable per-document key: the Drive Link is unique per letter/upload;
// fall back to project|subject|date for the rare link-less row.
function docKey_(url, proj, subject, date) {
  var u = String(url || '').trim();
  if (u) return u;
  return String(proj || '') + '|' + String(subject || '') + '|' + String(date || '');
}

// True if a register row is the one identified by docId — tolerant of the
// Drive Link being filled in AFTER the list was rendered. A letter row is
// logged link-less (docKey_ = proj|subject|date), then finalizeLetter
// patches the real PDF link in, which flips docKey_ to the URL. If the user
// opens the row during that window the client still holds the link-less id,
// so we accept a match on EITHER the live key or the link-less fallback.
function rowMatchesDocId_(docId, url, proj, subject, date) {
  if (!docId) return false;
  if (docKey_(url, proj, subject, date) === docId) return true;
  var fb = String(proj || '') + '|' + String(subject || '') + '|' + String(date || '');
  return fb === docId;
}

function getDiscussionSheet_(ss, createIfMissing) {
  var sh = ss.getSheetByName(DISCUSSION_SHEET);
  if (!sh && createIfMissing) {
    sh = ss.insertSheet(DISCUSSION_SHEET);
    sh.getRange(1, 1, 1, DISCUSSION_HEADER.length).setValues([DISCUSSION_HEADER]);
    sh.setFrozenRows(1);
    try { sh.hideSheet(); } catch (e) {}
  }
  return sh;
}

// Reads the whole Discussions tab once → { byId, statusById }. Status
// is walked CHRONOLOGICALLY so a "reopen" after an approve/reject
// unlocks the document again (back to "commented", floats to the top).
function readDiscussions_(ss) {
  var byId = {}, statusById = {};
  var sh = getDiscussionSheet_(ss, false);
  if (!sh) return { byId: byId, statusById: statusById };
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    var id = String(v[i][1] || '');
    if (!id) continue;
    var entry = {
      time: v[i][0] instanceof Date
        ? Utilities.formatDate(v[i][0], 'Asia/Bangkok', 'dd/MM/yyyy HH:mm')
        : String(v[i][0] || ''),
      email: String(v[i][3] || ''),
      action: String(v[i][4] || 'comment'),
      text: String(v[i][5] || '')
    };
    (byId[id] = byId[id] || []).push(entry);
  }
  for (var k in byId) {
    var st = 'pending', list = byId[k];
    for (var j = 0; j < list.length; j++) {
      var a = list[j].action;
      if (a === 'approve')      st = 'approved';
      else if (a === 'reject')  st = 'rejected';
      else if (a === 'reopen')  st = 'commented';   // reactivated
      else if (a === 'comment' && st !== 'approved' && st !== 'rejected') st = 'commented';
    }
    statusById[k] = st;
  }
  return { byId: byId, statusById: statusById };
}

// Full thread for one document (for the review panel).
function escHtml_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// The numbered comments block injected into the letter page.
function buildCommentsHtml_(entries) {
  var h = ['<div class="cmts"><h4>ความเห็น / Comments</h4>'];
  if (!entries || !entries.length) {
    h.push('<div style="color:#888;font-size:14px;padding:8px 0">ยังไม่มีความเห็น — No comments yet.</div>');
  } else {
    h.push('<ol>');
    for (var i = 0; i < entries.length; i++) {
      var en = entries[i];
      if (en.action === 'mango') continue;   // ERP-push: audit only, not on the letter
      var cls = en.action === 'approve' ? 'ap' : en.action === 'reject' ? 'rj' : '';
      var label = en.action === 'approve' ? '✓ Approved'
                : en.action === 'reject' ? '✕ Rejected'
                : en.action === 'reopen' ? '↺ Reopened / revision requested'
                : en.action === 'delete' ? '🗑 Deleted' : '💬 Comment';
      var raw = String(en.text || '');
      var ccPart = '';
      var cpos = raw.indexOf(CC_TOK);
      if (cpos >= 0) { ccPart = raw.slice(cpos + CC_TOK.length); raw = raw.slice(0, cpos); }
      var t = raw, bodyHtml = '';
      if (t.indexOf('INK:') === 0) {
        var nl = t.indexOf('\n');
        var img = (nl >= 0 ? t.slice(4, nl) : t.slice(4));
        var note = (nl >= 0 ? t.slice(nl + 1) : '');
        bodyHtml = '<img class="ink" src="' + img + '">' +
          (note ? '<div class="tx">' + escHtml_(note) + '</div>' : '');
      } else if (t) {
        bodyHtml = '<div class="tx">' + escHtml_(t) + '</div>';
      }
      if (ccPart) bodyHtml += '<div class="cc">🔔 CC: ' + escHtml_(ccPart) + '</div>';
      h.push('<li><div class="meta"><span class="act ' + cls + '">' + label +
        '</span> · ' + escHtml_(en.email) + ' · ' + escHtml_(en.time) +
        '</div>' + bodyHtml + '</li>');
    }
    h.push('</ol>');
  }
  h.push('</div>');
  return h.join('');
}

// Locate a register row by its docId → its LetterData JSON + the
// supplementary attachment URL (parsed from Remarks).
function findRowMeta_(ss, docId) {
  var sheets = ss.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s];
    var nm = sh.getName();
    if (nm === DISCUSSION_SHEET || /summary/i.test(nm)) continue;
    var canon = PROJECT_ALIAS[nm] || nm;
    var vals = sh.getDataRange().getValues();
    if (vals.length < 2) continue;
    var H = {};
    for (var hh = 0; hh < vals[0].length; hh++) H[String(vals[0][hh]).trim().toLowerCase()] = hh;
    var iSubj = H['subject']; if (iSubj === undefined) continue;
    var iUrl = H['drive link'], iDate = H['date received'],
        iRem = H['remarks'], iLd = H['letterdata'], iCode = H['document type'];
    for (var r = 1; r < vals.length; r++) {
      var url = iUrl !== undefined ? String(vals[r][iUrl] || '').trim() : '';
      var subj = String(vals[r][iSubj] || '').trim();
      var dt = iDate !== undefined ? normalizeDate_(vals[r][iDate]) : '';
      if (!rowMatchesDocId_(docId, url, canon, subj, dt)) continue;
      var rem = iRem !== undefined ? String(vals[r][iRem] || '') : '';
      var am = rem.match(/แนบเพิ่ม:\s*(\S+)/);
      return {
        letterData: iLd !== undefined ? String(vals[r][iLd] || '') : '',
        attachUrl: am ? am[1] : '',
        subject: subj,
        proj: canon,
        url: url,
        code: iCode !== undefined ? normalizeDocCode_(vals[r][iCode], subj) : ''
      };
    }
  }
  return { letterData: '', attachUrl: '', subject: '', proj: '', url: '', code: '' };
}

function getReview(docId) {
  try {
    var id = getMasterId_();
    if (!id) return { ok: false, error: 'Master sheet not set up.' };
    var ss = SpreadsheetApp.openById(id);
    var d = readDiscussions_(ss);
    var entries = d.byId[docId] || [];
    var status = d.statusById[docId] || 'pending';
    var locked = (status === 'approved' || status === 'rejected');

    // Render the letter + numbered comments (same page, before any
    // attachment) as one HTML doc, when we have the stored LetterData.
    var combinedHtml = '';
    var meta = findRowMeta_(ss, docId);
    try {
      if (meta.letterData) {
        var ld = JSON.parse(meta.letterData);
        var cfg = LETTERHEAD[ld.proj];
        if (cfg) {
          var attachHtml = '';
          if (meta.attachUrl) {
            var am = String(meta.attachUrl).match(/\/d\/([^/]+)/);
            var prev = am
              ? (meta.attachUrl.indexOf('/document/') >= 0
                  ? 'https://docs.google.com/document/d/' + am[1] + '/preview'
                  : 'https://drive.google.com/file/d/' + am[1] + '/preview')
              : meta.attachUrl;
            attachHtml = '<div class="pg attpg" style="padding:0;overflow:hidden">' +
              '<div style="font-weight:700;font-size:14px;color:#111;background:#f3f4f6;' +
              'border-bottom:1px solid #cfd3dc;padding:7px 12px">📎 เอกสารแนบ (Attachment)</div>' +
              '<iframe src="' + prev + '" style="border:0;width:100%;height:100%;min-height:270mm"></iframe></div>';
          }
          combinedHtml = generateLetterHtml_(cfg, {
            ref: ld.ref || '',
            thaiDate: thaiDate_(ld.docDate),
            subject: ld.subject || '',
            to: String(ld.to || ''),
            cc: String(ld.cc || ''),
            typist: String(ld.typist || ''),
            bodyText: String(ld.body || ''),
            commentsHtml: buildCommentsHtml_(entries),
            attachHtml: attachHtml
          });
        }
      }
    } catch (e) { Logger.log('combinedHtml build failed: ' + e); }

    return { ok: true, status: status, locked: locked,
             entries: entries, combinedHtml: combinedHtml,
             subject: meta.subject, proj: meta.proj, url: meta.url,
             attachUrl: meta.attachUrl, code: meta.code };
  } catch (err) { return { ok: false, error: err.toString() }; }
}

function appendDiscussion_(ss, docId, project, email, action, text) {
  var sh = getDiscussionSheet_(ss, true);
  sh.appendRow([ new Date(), docId, project || '', email,
                 action, String(text || '') ]);
}

// Any signed-in user may comment — but only while still pending.
// Combine a typed comment and/or a handwritten (Apple Pencil) image
// into the single Text cell. Ink is stored as "INK:<dataURL>" with any
// typed note on the following line; the client renders it as an image.
// CC is appended after a unit-separator token so renderers can split it
// off and show a "🔔 CC: …" line without disturbing the comment/ink.
var CC_TOK = '␟CC␟';
function packComment_(text, ink, cc) {
  text = String(text || '').trim();
  ink = String(ink || '');
  cc = String(cc || '').trim();
  var base;
  if (ink && /^data:image\//.test(ink)) base = 'INK:' + ink + (text ? '\n' + text : '');
  else base = text;
  if (cc) base += CC_TOK + cc;
  return base;
}

// Email everyone in the CC string a link to this document, and return
// the addresses actually notified. Never throws (mail issues must not
// block the comment/decision).
function notifyCc_(emails, labelStr, docId, project, byEmail, action, note) {
  var sent = [];
  try {
    emails = (emails || []).filter(function (e) {
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e).trim());
    });
    if (!emails.length) return sent;
    var appUrl = '';
    try { appUrl = ScriptApp.getService().getUrl(); } catch (e) {}
    var verb = action === 'approve' ? 'approved'
             : action === 'reject' ? 'rejected'
             : action === 'reopen' ? 'reopened for revision' : 'commented on';
    var subj = '[VCB Document Control] ' + (labelStr || 'You') +
               ' — CC’d on a document (' + project + ')';
    var body = byEmail + ' ' + verb + ' a document and CC’d ' +
               (labelStr || 'your department') + ' for attention.\n\n' +
               (note ? 'Note: ' + note + '\n\n' : '') +
               'Open the Document Control portal to view it:\n' + appUrl + '\n\n' +
               '(Document ref/ID: ' + docId + ')';
    for (var i = 0; i < emails.length; i++) {
      try { MailApp.sendEmail(emails[i], subj, body); sent.push(emails[i]); }
      catch (e) { Logger.log('CC mail failed ' + emails[i] + ': ' + e); }
    }
  } catch (e) { Logger.log('notifyCc_ error: ' + e); }
  return sent;
}

function addReviewComment(data) {
  try {
    var email = resolveAuthEmail_(data.authToken);
    if (!email) return { ok: false, error: 'Please sign in to comment.' };
    var dr = resolveDepts_(data.ccDepts, data.ccEmails);
    var packed = packComment_(data.text, data.ink, dr.labelStr);
    if (!packed) return { ok: false, error: 'Comment is empty.' };
    var id = getMasterId_();
    var ss = SpreadsheetApp.openById(id);
    var st = readDiscussions_(ss).statusById[data.docId] || 'pending';
    if (st === 'approved' || st === 'rejected') {
      return { ok: false, error: 'This document is ' + st + ' and locked — no more comments.' };
    }
    appendDiscussion_(ss, data.docId, data.project, email, 'comment', packed);
    notifyCc_(dr.emails, dr.labelStr, data.docId, data.project, email, 'comment', String(data.text || '').trim());
    return getReview(data.docId);
  } catch (err) { return { ok: false, error: err.toString() }; }
}

// Approve / reject — managers only, first decision is final.
function submitDecision(data) {
  try {
    var email = resolveAuthEmail_(data.authToken);
    if (!email) return { ok: false, error: 'Please sign in.' };
    if (!isManager_(email)) {
      return { ok: false, error: 'Only the management team can approve or reject.' };
    }
    var decision = String(data.decision || '').toLowerCase();
    if (decision !== 'approve' && decision !== 'reject') {
      return { ok: false, error: 'Invalid decision.' };
    }
    var id = getMasterId_();
    var ss = SpreadsheetApp.openById(id);
    var st = readDiscussions_(ss).statusById[data.docId] || 'pending';
    if (st === 'approved' || st === 'rejected') {
      return { ok: false, error: 'Already ' + st + ' — the decision is final.' };
    }
    var dr2 = resolveDepts_(data.ccDepts, data.ccEmails);
    appendDiscussion_(ss, data.docId, data.project, email, decision,
                      packComment_(data.text, data.ink, dr2.labelStr));
    notifyCc_(dr2.emails, dr2.labelStr, data.docId, data.project, email, decision, String(data.text || '').trim());
    return getReview(data.docId);
  } catch (err) { return { ok: false, error: err.toString() }; }
}

// Reopen a locked (approved/rejected) document for revision and push it
// back to attention — managers/owner only. Unlocks it (status →
// commented) so commenting and a fresh decision are possible again.
function reopenDocument(data) {
  try {
    var email = resolveAuthEmail_(data.authToken);
    if (!email) return { ok: false, error: 'Please sign in.' };
    if (!isManager_(email)) {
      return { ok: false, error: 'Only the management team can reopen a document.' };
    }
    var ss = SpreadsheetApp.openById(getMasterId_());
    var st = readDiscussions_(ss).statusById[data.docId] || 'pending';
    if (st !== 'approved' && st !== 'rejected') {
      return { ok: false, error: 'This document is already open.' };
    }
    var dr3 = resolveDepts_(data.ccDepts, data.ccEmails);
    appendDiscussion_(ss, data.docId, data.project, email, 'reopen',
                      packComment_(data.text, data.ink, dr3.labelStr));
    notifyCc_(dr3.emails, dr3.labelStr, data.docId, data.project, email, 'reopen', String(data.text || '').trim());
    return getReview(data.docId);
  } catch (err) { return { ok: false, error: err.toString() }; }
}

// Delete the LAST discussion entry for a document, but only if it's
// the requesting user's own. Anyone (or any approve/reject/reopen)
// posted after — the entry becomes immutable. This matches the user
// model: edit-while-fresh, locked-once-someone-replies.
function deleteOwnLastEntry(authToken, docId) {
  try {
    var email = resolveAuthEmail_(authToken);
    if (!email) return { ok: false, error: 'Please sign in.' };
    var id = String(docId || '').trim();
    if (!id) return { ok: false, error: 'Missing document id.' };
    var ss = SpreadsheetApp.openById(getMasterId_());
    var sh = getDiscussionSheet_(ss, false);
    if (!sh) return { ok: false, error: 'No discussion to delete.' };
    var vals = sh.getDataRange().getValues();
    // Find every row for this doc, pick the latest (highest timestamp).
    var lastIdx = -1, lastTime = -1;
    for (var i = 1; i < vals.length; i++) {
      if (String(vals[i][1] || '').trim() !== id) continue;
      var t = vals[i][0];
      var tn = t instanceof Date ? t.getTime() : new Date(String(t || 0)).getTime();
      if (isNaN(tn)) continue;
      if (tn > lastTime) { lastTime = tn; lastIdx = i; }
    }
    if (lastIdx < 0) return { ok: false, error: 'No entries for this document.' };
    var entryEmail = String(vals[lastIdx][3] || '').trim().toLowerCase();
    if (entryEmail !== String(email).trim().toLowerCase()) {
      return { ok: false,
        error: 'Cannot delete — the most recent entry is by someone else (' + entryEmail + ').' };
    }
    sh.deleteRow(lastIdx + 1);
    return getReview(id);
  } catch (err) { return { ok: false, error: String(err) }; }
}

// Lets the client know if the signed-in user is a manager (to show the
// Approve/Reject/Delete buttons). Returns { signedIn, email, manager }.
function getReviewerRole(authToken) {
  var email = resolveAuthEmail_(authToken);
  return { signedIn: !!email, email: email, manager: email ? isManager_(email) : false };
}

// Managers only: permanently remove a document — deletes its register
// row, trashes the generated letter file, and records who did it in the
// Discussions audit log. Matches by the same docKey as getDocuments.
function deleteDocument(data) {
  try {
    var email = resolveAuthEmail_(data.authToken);
    if (!email) return { ok: false, error: 'Please sign in.' };
    if (!isManager_(email)) {
      return { ok: false, error: 'Only the management team can delete documents.' };
    }
    var target = String(data.docId || '').trim();
    if (!target) return { ok: false, error: 'Missing document id.' };

    var ss = SpreadsheetApp.openById(getMasterId_());
    var sheets = ss.getSheets();
    for (var s = 0; s < sheets.length; s++) {
      var sh = sheets[s];
      var nm = sh.getName();
      if (nm === DISCUSSION_SHEET || /summary/i.test(nm)) continue;
      var vals = sh.getDataRange().getValues();
      if (vals.length < 2) continue;
      var hdr = {};
      for (var h = 0; h < vals[0].length; h++) hdr[String(vals[0][h]).trim().toLowerCase()] = h;
      var iSubj = hdr['subject'];
      if (iSubj === undefined) continue;
      var iUrl = hdr['drive link'], iDate = hdr['date received'];
      var canon = PROJECT_ALIAS[nm] || nm;
      for (var r = 1; r < vals.length; r++) {
        var url  = iUrl  !== undefined ? String(vals[r][iUrl] || '').trim() : '';
        var subj = String(vals[r][iSubj] || '').trim();
        var dt   = iDate !== undefined ? normalizeDate_(vals[r][iDate]) : '';
        if (!rowMatchesDocId_(target, url, canon, subj, dt)) continue;
        var trashed = false;
        if (url) {
          var m = url.match(/\/d\/([^/]+)/);
          if (m) { try { DriveApp.getFileById(m[1]).setTrashed(true); trashed = true; } catch (e) {} }
        }
        sh.deleteRow(r + 1);
        appendDiscussion_(ss, target, canon, email, 'delete',
          'Document deleted' + (trashed ? ' (letter file trashed)' : ''));
        return { ok: true };
      }
    }
    return { ok: false, error: 'Document not found — it may already be deleted.' };
  } catch (err) { return { ok: false, error: err.toString() }; }
}

// ── Mango ERP integration ────────────────────────────────────────
// "An API" just means: our server makes an HTTPS call to Mango ERP's
// server and hands it this document's details (and a link to the file).
// Mango then files it on their side automatically — no copy/paste.
//
// The endpoint URL + key live in Script Properties (not in the code) so
// there are no secrets in the source and they can change without a
// redeploy. Until Mango ERP gives us those two things the button still
// works in DEMO mode: it records the push in the audit log and reports
// exactly what's missing — so it's fully demonstrable to management now.
//
// One-time setup once Mango provides the details (run in the editor):
//   setMangoConfig('https://erp.mango.example/api/documents',
//                   'THE-API-KEY', 'Authorization', 'Bearer ')
function setMangoConfig(url, apiKey, headerName, prefix) {
  var p = PropertiesService.getScriptProperties();
  p.setProperty('MANGO_API_URL', String(url || '').trim());
  p.setProperty('MANGO_API_KEY', String(apiKey || '').trim());
  p.setProperty('MANGO_AUTH_HEADER', String(headerName || 'Authorization').trim());
  p.setProperty('MANGO_AUTH_PREFIX', prefix == null ? 'Bearer ' : String(prefix));
  return 'Mango ERP config saved.';
}
function mangoConfig_() {
  var p = PropertiesService.getScriptProperties();
  var pref = p.getProperty('MANGO_AUTH_PREFIX');
  return {
    url:    p.getProperty('MANGO_API_URL') || '',
    key:    p.getProperty('MANGO_API_KEY') || '',
    header: p.getProperty('MANGO_AUTH_HEADER') || 'Authorization',
    prefix: pref == null ? 'Bearer ' : pref
  };
}

// Locate a register row by docId → { url, subject, dt, canon, letterData }.
function mangoRow_(ss, docId) {
  var sheets = ss.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s];
    var nm = sh.getName();
    if (nm === DISCUSSION_SHEET || /summary/i.test(nm)) continue;
    var vals = sh.getDataRange().getValues();
    if (vals.length < 2) continue;
    var H = {};
    for (var h = 0; h < vals[0].length; h++) H[String(vals[0][h]).trim().toLowerCase()] = h;
    var iSubj = H['subject']; if (iSubj === undefined) continue;
    var iUrl = H['drive link'], iDate = H['date received'], iLd = H['letterdata'];
    var canon = PROJECT_ALIAS[nm] || nm;
    for (var r = 1; r < vals.length; r++) {
      var url  = iUrl  !== undefined ? String(vals[r][iUrl] || '').trim() : '';
      var subj = String(vals[r][iSubj] || '').trim();
      var dt   = iDate !== undefined ? normalizeDate_(vals[r][iDate]) : '';
      if (docKey_(url, canon, subj, dt) !== docId) continue;
      return { url: url, subject: subj, dt: dt, canon: canon,
               letterData: iLd !== undefined ? String(vals[r][iLd] || '') : '' };
    }
  }
  return null;
}

// Send one document to Mango ERP. Manager/owner only (an ERP push is a
// controlled action — it shouldn't be repeatable by every viewer). The
// push is recorded in the Discussions audit with action 'mango' so there
// is a history and the button can show "already sent".
function sendToMangoERP(data) {
  try {
    var email = resolveAuthEmail_(data.authToken);
    if (!email) return { ok: false, error: 'Please sign in.' };
    if (!isManager_(email)) {
      return { ok: false, error: 'Only the management team can send a document to Mango ERP.' };
    }
    var docId = String(data.docId || '').trim();
    if (!docId) return { ok: false, error: 'Missing document id.' };

    var ss = SpreadsheetApp.openById(getMasterId_());
    var row = mangoRow_(ss, docId);
    if (!row) return { ok: false, error: 'Document not found in the register.' };
    var ld = {};
    try { ld = row.letterData ? JSON.parse(row.letterData) : {}; } catch (e) {}

    var status = readDiscussions_(ss).statusById[docId] || 'pending';
    var appUrl = '';
    try { appUrl = ScriptApp.getService().getUrl(); } catch (e) {}

    var payload = {
      source:        'VCB Document Control',
      reference:     ld.ref || '',
      subject:       ld.subject || row.subject || '',
      project:       row.canon || data.project || '',
      documentDate:  ld.docDate || '',
      addressedTo:   String(ld.to || ''),
      cc:            String(ld.cc || ''),
      status:        status,
      driveLink:     row.url || '',
      portalLink:    appUrl,
      pushedBy:      email,
      pushedAt:      new Date().toISOString()
    };

    var cfg = mangoConfig_();

    // DEMO mode — no endpoint configured yet. Record it so the workflow
    // is demonstrable, and say exactly what's still needed.
    if (!cfg.url || !cfg.key) {
      appendDiscussion_(ss, docId, row.canon, email, 'mango',
        'DEMO push to Mango ERP (no API endpoint configured yet) · ref ' +
        (payload.reference || '—'));
      return { ok: true, demo: true,
        message: 'Demo mode — recorded as sent to Mango ERP. To push for real, ' +
                 'Mango ERP just needs to give us (1) an API endpoint URL and ' +
                 '(2) an API key. We set those once and the button works live — ' +
                 'nothing changes for users.' };
    }

    var headers = {};
    headers[cfg.header] = cfg.prefix + cfg.key;
    var resp = UrlFetchApp.fetch(cfg.url, {
      method: 'post',
      contentType: 'application/json',
      headers: headers,
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    var bodyTxt = resp.getContentText() || '';
    if (code < 200 || code >= 300) {
      appendDiscussion_(ss, docId, row.canon, email, 'mango',
        'Mango ERP push FAILED (HTTP ' + code + ') · ref ' + (payload.reference || '—'));
      return { ok: false,
        error: 'Mango ERP rejected the push (HTTP ' + code + '). ' + bodyTxt.slice(0, 300) };
    }
    var mangoId = '';
    try { var j = JSON.parse(bodyTxt); mangoId = j.id || j.documentId || j.ref || ''; } catch (e) {}
    appendDiscussion_(ss, docId, row.canon, email, 'mango',
      'Sent to Mango ERP' + (mangoId ? ' (ID ' + mangoId + ')' : '') +
      ' · ref ' + (payload.reference || '—'));
    return { ok: true, demo: false, mangoId: mangoId,
             message: 'Sent to Mango ERP' + (mangoId ? ' — ID ' + mangoId : '') + '.' };
  } catch (err) { return { ok: false, error: err.toString() }; }
}

// ── ONE-TIME migration ───────────────────────────────────────────
// Run once in the editor. Creates the master spreadsheet, one tab per
// project, and loads the historical email-logged rows from SEED
// (generated from Document_Control_Register.xlsx) tagged Source=Email.
// Idempotent: if the master already exists it just logs its URL.
function setupMasterSheet() {
  var props = PropertiesService.getScriptProperties();
  var existing = props.getProperty('MASTER_SHEET_ID');
  if (existing) {
    try {
      var u = SpreadsheetApp.openById(existing).getUrl();
      Logger.log('Master sheet already exists: ' + u);
      return u;
    } catch (e) { /* stale id - recreate below */ }
  }
  if (typeof SEED === 'undefined') throw new Error('Seed.js is missing from the project.');
  var ss = SpreadsheetApp.create('VCB Document Control — Master');
  var first = true;
  for (var proj in SEED) {
    var rows = SEED[proj] || [];
    var sh = first ? ss.getSheets()[0].setName(proj) : ss.insertSheet(proj);
    first = false;
    var data = [MASTER_HEADER];
    for (var i = 0; i < rows.length; i++) {
      var d = rows[i];
      data.push([ i + 1, d.dateReceived || '', d.timeReceived || '',
        d.senderEmail || '', d.docType || '', d.subject || '',
        d.driveLink || '', d.project || proj,
        d.loggedDate || '', d.loggedTime || '', d.threadId || '',
        d.remarks || '', d.month || '', 'Email' ]);
    }
    sh.getRange(1, 1, data.length, MASTER_HEADER.length).setValues(data);
    sh.setFrozenRows(1);
  }
  props.setProperty('MASTER_SHEET_ID', ss.getId());
  Logger.log('Master sheet created: ' + ss.getUrl());
  Logger.log('MASTER_SHEET_ID = ' + ss.getId());
  return ss.getUrl();
}

// One-time helper: move the master spreadsheet into the
// "08 DOCUMENT CONTROL" Drive folder (it is created in My Drive root by
// default). Safe to run repeatedly. Prefers the folder whose parent is
// "WORK" if the name is not unique.
function moveMasterToFolder() {
  var id = getMasterId_();
  if (!id) throw new Error('MASTER_SHEET_ID not set; run setupMasterSheet first.');
  var file = DriveApp.getFileById(id);

  var candidates = [];
  var it = DriveApp.getFoldersByName('08 DOCUMENT CONTROL');
  while (it.hasNext()) candidates.push(it.next());
  if (candidates.length === 0) {
    throw new Error('Drive folder "08 DOCUMENT CONTROL" not found for this account.');
  }
  var target = candidates[0];
  if (candidates.length > 1) {
    for (var i = 0; i < candidates.length; i++) {
      var ps = candidates[i].getParents();
      while (ps.hasNext()) {
        if (ps.next().getName() === 'WORK') { target = candidates[i]; break; }
      }
    }
  }

  target.addFile(file);
  var parents = file.getParents();
  while (parents.hasNext()) {
    var p = parents.next();
    if (p.getId() !== target.getId()) p.removeFile(file);
  }
  Logger.log('Moved "' + file.getName() + '" into folder "' +
    target.getName() + '" (' + target.getId() + ').');
  return target.getId();
}

// One-time: delete the existing "Summary" column from every tab of the
// master sheet (it was seeded with one; the Subject is enough). Found by
// header name, so it works regardless of column position. Idempotent.
// The summary text remains in the Document_Control_Register.xlsx backup.
function removeSummaryColumn() {
  var id = getMasterId_();
  if (!id) throw new Error('MASTER_SHEET_ID not set.');
  var ss = SpreadsheetApp.openById(id);
  var sheets = ss.getSheets();
  var removed = 0;
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s];
    if (sh.getLastColumn() < 1 || sh.getLastRow() < 1) continue;
    var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    for (var col = 0; col < header.length; col++) {
      if (String(header[col]).trim().toLowerCase() === 'summary') {
        sh.deleteColumn(col + 1);
        removed++;
        break;
      }
    }
  }
  Logger.log('Removed Summary column from ' + removed + ' tab(s).');
  return removed;
}

function testDoGet() {
  var out = HtmlService.createHtmlOutputFromFile('index');
  Logger.log('OK: ' + out.getContent().length + ' chars');
}

function testFetch() {
  var resp = UrlFetchApp.fetch("https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=test");
  Logger.log(resp.getContentText());
}

// ── Claude API: email document logger + attachment filer ─────────────────────
// doPost handles JSON POST requests from the Claude Cowork skill.
// Supported actions:
//   "getKnownThreadIds"  → returns all Gmail thread IDs already logged
//   "logEmailDoc"        → appends one row to the master register
//   "updateDriveLink"    → patches the Drive Link cell for an existing row
//   "saveGmailAttachment"→ saves a Gmail attachment blob into a Drive folder
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    if (!verifySecret_(payload.secret)) {
      return gasJson_({ success: false, error: 'Unauthorized' });
    }
    switch (payload.action) {
      case 'getKnownThreadIds':   return gasJson_(getKnownThreadIds_());
      case 'logEmailDoc':         return gasJson_(logEmailDoc_(payload));
      case 'updateDriveLink':     return gasJson_(updateDriveLink_(payload));
      case 'saveGmailAttachment': return gasJson_(saveGmailAttachment_(payload));
      default:
        return gasJson_({ success: false, error: 'Unknown action: ' + payload.action });
    }
  } catch (err) {
    return gasJson_({ success: false, error: err.toString() });
  }
}

// Shared JSON response helper
function gasJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── getKnownThreadIds ─────────────────────────────────────────────
// Returns { success: true, threadIds: [...] } with every non-pending
// Gmail thread ID already in any sheet of the master register.
function getKnownThreadIds_() {
  try {
    var ss = SpreadsheetApp.openById(getMasterId_());
    var ids = [];
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      var nm = sheets[i].getName();
      if (nm === DISCUSSION_SHEET || /summary/i.test(nm)) continue;
      var vals = sheets[i].getDataRange().getValues();
      if (vals.length < 2) continue;
      var iTid = colIdx_(vals[0], 'gmail thread-id');
      if (iTid < 0) continue;
      for (var r = 1; r < vals.length; r++) {
        var tid = String(vals[r][iTid] || '').trim();
        if (tid && tid.indexOf('PENDING:') !== 0) ids.push(tid);
      }
    }
    return { success: true, threadIds: ids };
  } catch (err) { return { success: false, error: err.toString() }; }
}

// ── logEmailDoc ───────────────────────────────────────────────────
// Appends one row to the project sheet.
// Expected payload fields (all optional except project):
//   project, date_received, time_received, sender_email, doc_type,
//   subject, drive_link, thread_id, remarks
function logEmailDoc_(p) {
  try {
    var ss = SpreadsheetApp.openById(getMasterId_());
    var proj = String(p.project || 'UNCLASSIFIED').trim();
    var sh = getMasterSheetForProject_(ss, proj);
    var hdrRow = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var hmap = colMapLower_(hdrRow);
    var nextNo = Math.max(0, sh.getLastRow() - 1) + 1;
    var tz = 'Asia/Bangkok';
    var now = new Date();
    var month = monthFromDate_(p.date_received, tz, now);
    var fields = {
      'no.':             nextNo,
      'date received':   p.date_received  || '',
      'time received':   p.time_received  || '',
      'sender email':    p.sender_email   || '',
      'document type':   p.doc_type       || '',
      'subject':         p.subject        || '',
      'drive link':      p.drive_link     || '',
      'project':         proj,
      'logged date':     p.log_date  || Utilities.formatDate(now, tz, 'dd/MM/yyyy'),
      'logged time':     p.log_time  || Utilities.formatDate(now, tz, 'HH:mm'),
      'gmail thread-id': p.thread_id      || '',
      'remarks':         p.remarks        || '',
      'month':           month,
      'source':          'Email',
      'letterdata':      ''
    };
    var rowArr = buildRow_(hmap, hdrRow.length, fields);
    sh.appendRow(rowArr);
    return { success: true, no: nextNo, project: proj };
  } catch (err) { return { success: false, error: err.toString() }; }
}

// ── updateDriveLink ───────────────────────────────────────────────
// Finds the row with the matching thread_id and sets its Drive Link.
// Payload: { project, thread_id, drive_link }
function updateDriveLink_(p) {
  try {
    var ss = SpreadsheetApp.openById(getMasterId_());
    var proj = String(p.project || '').trim();
    var tid  = String(p.thread_id || '').trim();
    var url  = String(p.drive_link || '').trim();
    // Search all sheets if project is empty; otherwise target it directly.
    var sheets = proj ? [ss.getSheetByName(proj)] : ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      var sh = sheets[i];
      if (!sh) continue;
      var nm = sh.getName();
      if (nm === DISCUSSION_SHEET || /summary/i.test(nm)) continue;
      var vals = sh.getDataRange().getValues();
      var iTid = colIdx_(vals[0], 'gmail thread-id');
      var iUrl = colIdx_(vals[0], 'drive link');
      if (iTid < 0 || iUrl < 0) continue;
      for (var r = 1; r < vals.length; r++) {
        if (String(vals[r][iTid]).trim() === tid) {
          sh.getRange(r + 1, iUrl + 1).setValue(url);
          return { success: true };
        }
      }
    }
    return { success: false, error: 'Thread ID not found: ' + tid };
  } catch (err) { return { success: false, error: err.toString() }; }
}

// ── doPost column helpers ─────────────────────────────────────────
function colIdx_(headerRow, name) {
  var n = name.toLowerCase();
  for (var i = 0; i < headerRow.length; i++)
    if (String(headerRow[i]).trim().toLowerCase() === n) return i;
  return -1;
}
function colMapLower_(headerRow) {
  var m = {};
  for (var i = 0; i < headerRow.length; i++)
    m[String(headerRow[i]).trim().toLowerCase()] = i;
  return m;
}
function buildRow_(hmap, len, fields) {
  var arr = new Array(len);
  for (var i = 0; i < len; i++) arr[i] = '';
  for (var k in fields)
    if (hmap[k] !== undefined) arr[hmap[k]] = fields[k];
  return arr;
}
function monthFromDate_(dateStr, tz, now) {
  if (dateStr) {
    var p = String(dateStr).split('/');
    if (p.length === 3) {
      try {
        var d = new Date(+p[2], +p[1] - 1, +p[0]);
        return Utilities.formatDate(d, tz || 'Asia/Bangkok', 'MMMM yyyy');
      } catch (e) {}
    }
  }
  return Utilities.formatDate(now || new Date(), tz || 'Asia/Bangkok', 'MMMM yyyy');
}

// Saves one Gmail attachment directly into a Drive folder.
// Params: { messageId, attachmentIndex, folderId, filename (optional) }
// Returns: { success, fileId, fileUrl, filename } or { success: false, error }
function saveGmailAttachment_(params) {
  var messageId       = String(params.messageId       || '').trim();
  var attachmentIndex = parseInt(params.attachmentIndex, 10) || 0;
  var folderId        = String(params.folderId        || '').trim();

  if (!messageId) return { success: false, error: 'messageId is required' };
  if (!folderId)  return { success: false, error: 'folderId is required' };

  var msg;
  try {
    msg = GmailApp.getMessageById(messageId);
  } catch (e) {
    return { success: false, error: 'Cannot find message ' + messageId + ': ' + e.toString() };
  }
  if (!msg) return { success: false, error: 'Message not found: ' + messageId };

  var attachments = msg.getAttachments();
  if (attachments.length === 0) {
    return { success: false, error: 'Message has no attachments' };
  }
  if (attachmentIndex >= attachments.length) {
    return {
      success: false,
      error: 'attachmentIndex ' + attachmentIndex +
             ' out of range (message has ' + attachments.length + ' attachment(s))'
    };
  }

  var attachment = attachments[attachmentIndex];
  var folder;
  try {
    folder = DriveApp.getFolderById(folderId);
  } catch (e) {
    return { success: false, error: 'Folder not found ' + folderId + ': ' + e.toString() };
  }

  // createFile on the folder object saves DIRECTLY there — never touches My Drive root
  var file = folder.createFile(attachment);
  if (params.filename) file.setName(String(params.filename).trim());

  var fileId = file.getId();
  Logger.log('saveGmailAttachment: saved "' + file.getName() + '" → folder ' + folderId);
  return {
    success:  true,
    fileId:   fileId,
    fileUrl:  'https://drive.google.com/file/d/' + fileId + '/view',
    filename: file.getName()
  };
}

// Returns true if the supplied secret matches the stored CLAUDE_API_SECRET.
function verifySecret_(secret) {
  var stored = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_SECRET');
  return !!(stored && secret === stored);
}

// Run ONCE in the Apps Script editor after deploying a new version.
// Copy the printed secret into the SKILL.md GAS_SECRET placeholder.
function initClaudeSecret() {
  var existing = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_SECRET');
  if (existing) {
    Logger.log('CLAUDE_API_SECRET already set: ' + existing);
    return existing;
  }
  var secret = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('CLAUDE_API_SECRET', secret);
  Logger.log('CLAUDE_API_SECRET set to: ' + secret);
  Logger.log('Paste this into SKILL.md as the GAS_SECRET value.');
  return secret;
}

// ════════════════════════════════════════════════════════════════════
//  GMAIL AUTO-LOGGER  (replaces the Cowork schedule)
//  Runs itself every 10 minutes via a time-driven trigger. Scans Gmail
//  for new project-document emails, classifies them, appends one row to
//  the correct project tab of the SAME master sheet the web app uses,
//  and saves the attachments straight into the right Drive folder.
//  Uses only permissions the app already has (gmail.readonly + Drive +
//  Sheets) — nothing else in the app changes.
//
//  ONE-TIME setup (run once in the editor):  installGmailAutoLogTrigger
//  Manual test without writing anything:      gmailAutoLogDryRun
// ════════════════════════════════════════════════════════════════════

// Sender → project group (Pass A). Used only when the subject has no
// recognisable prefix. The BT1/VK2 senders default to BT1.
var GMAIL_SENDER_GROUPS = {
  'BT1': ['pm9.phasdu@gmail.com', 'pasonghongarasa@gmail.com'],
  'CVE': ['kugkaichaicharn@gmail.com', 'store.suphanburi@gmail.com', 'r.kulsaya@gmail.com', 'yanisa1504y@gmail.com'],
  'LPB': ['phinyavcb@gmail.com', 'phommakaisone1401@gmail.com', 'wiphada26@hotmail.com', 'vilailouangphon.t@gmail.com', 'vcb1122@outlook.com', 'yongkhamsomphengphanh@gmail.com'],
  'BV':  ['bvbangvua@gmail.com', 'wn_vcb@yahoo.com', 'titadeelert@hotmail.com'],
  'PN4': ['tamkarn1793@hotmail.com', 'Piya85850@gmail.com', 'sribow.plus@gmail.com', 'sirilak123.hr@gmail.com', 'soontorn2507@hotmail.com']
};

// Subject-prefix → { tab, project }. Checked in THIS order, first match
// wins (longer / more specific prefixes first).
var GMAIL_PREFIX_RULES = [
  { p: ['VC-LBP/', 'VC-LPB/'], tab: 'LPB', project: 'LPB' },
  { p: ['V&K-', 'V&K/'],       tab: 'V&K', project: 'V&K' },
  { p: ['BR4-'],               tab: 'PN4', project: 'BR4' },
  { p: ['BR3-'],               tab: 'V&K', project: 'BR3' },
  { p: ['PN-', 'PN4-'],        tab: 'PN4', project: 'PN4' },
  { p: ['BT/', 'BT-'],         tab: 'BT1', project: 'BT'  },
  { p: ['VC/', 'VC-'],         tab: 'VC',  project: 'VC'  },
  { p: ['BP/', 'BP-', 'VK/', 'VK-'], tab: 'VK2', project: 'VK' },
  { p: ['BV/', 'BV-'],         tab: 'BV',  project: 'BV'  },
  { p: ['EP-', 'EP/'],         tab: 'EP',  project: 'EP'  },
  { p: ['CVE/', 'CVE-'],       tab: 'CVE', project: 'CVE' }
];

// Subject-pattern searches (Pass B) — catches unknown senders.
var GMAIL_SUBJECT_QUERIES = [
  'subject:(VC-LBP OR VC-LPB)',
  'subject:(BT/ OR BT-)',
  'subject:(VC/ OR VC-)',
  'subject:(BP/ OR BP- OR VK/ OR VK-)',
  'subject:(BV/ OR BV-)',
  'subject:(PN- OR PN4- OR BR3- OR BR4- OR "V&K-" OR "V&K/")',
  'subject:(EP/ OR EP-)',
  'subject:(CVE/)',
  'subject:("/06/" OR "/02/" OR "/01/" OR "/08/" OR "/09/" OR "/03/")'
];

// Project / tab → destination Drive folder (from the spec).
var GMAIL_FOLDER_BY_KEY = {
  'BT': '172S8rI5fUW_iRVroKfCjU0npjEhf6Z7C', 'BT1': '172S8rI5fUW_iRVroKfCjU0npjEhf6Z7C',
  'VC': '1uvauUHzi7bhALTkK7GlcjPniu_yxmGV4',
  'VK': '1nSLoMJxIi251UUPJRDfFN0ZTx30oFjYW', 'VK2': '1nSLoMJxIi251UUPJRDfFN0ZTx30oFjYW',
  'BV': '14tkDfWJfwud07-B2faDz2MU_z0acaJh4',
  'V&K': '1NNz-TxGkBBjlVxtKN6EUrIptMo8WELyK', 'BR3': '1NNz-TxGkBBjlVxtKN6EUrIptMo8WELyK',
  'PN4': '1lbJb4TmH8M6XzpTUBjz9vbT9P8_wq1zy', 'BR4': '1lbJb4TmH8M6XzpTUBjz9vbT9P8_wq1zy',
  'LPB': '1dKayj6ei1kC8x88CFfCrCofo1_NaF0zG',
  'EP': '1QZtfsLinBUnCtQiehpaVEOUm9nhmOYQQ',
  'CVE': '1Cls_JJk9lxfBfX8RSXq2Zp_HJ9qlrVGy',
  'UNKNOWN': '1eUS5ydHWO7ckHFi4-51lw6X8Lfu7geg7'
};

// Canonical project subfolders live under "9. DOCUMENT CONTROL". Folder
// IDs can change (re-uploads, manual reorgs); names are stable. Resolve
// by name first, falling back to the legacy hardcoded id map only if the
// canonical parent can't be found.
var _docControlFolderMap = null;
function getDocControlFolderMap_() {
  if (_docControlFolderMap !== null) return _docControlFolderMap;
  var expected = {
    'บางเตย ตอน1 (BT1)': true, 'บางเตย ตอน2 (VK2)': true, 'บางวัว ตอน6 (BV)': true,
    'บรม ตอน3 (V&K)': true,    'บรม ตอน4 (PN4)': true,   'หลวงพระบาง (LPB)': true,
    'บ้านแพ้ว (EP)': true,     'โรงหล่อชวนา (CVE)': true, '_Unclassified': true,
    'ลาดหลุมแก้ว (LK)': true,  'พระราม2 (PT)': true
  };
  var parent = null;
  var pit = DriveApp.getFoldersByName('9. DOCUMENT CONTROL');
  while (pit.hasNext()) {
    var cand = pit.next();
    var sit = cand.getFolders();
    while (sit.hasNext()) {
      if (expected[sit.next().getName()]) { parent = cand; break; }
    }
    if (parent) break;
  }
  var map = {};
  if (parent) {
    var sit2 = parent.getFolders();
    while (sit2.hasNext()) { var sf = sit2.next(); map[sf.getName()] = sf.getId(); }
  }
  _docControlFolderMap = map;
  return map;
}

var PROJECT_KEY_TO_FOLDER_NAME = {
  'BT':  'บางเตย ตอน1 (BT1)',  'BT1': 'บางเตย ตอน1 (BT1)',
  'VK':  'บางเตย ตอน2 (VK2)',  'VK2': 'บางเตย ตอน2 (VK2)',
  'BV':  'บางวัว ตอน6 (BV)',
  'V&K': 'บรม ตอน3 (V&K)',     'BR3': 'บรม ตอน3 (V&K)',
  'PN4': 'บรม ตอน4 (PN4)',     'BR4': 'บรม ตอน4 (PN4)',  'PN': 'บรม ตอน4 (PN4)',
  'LPB': 'หลวงพระบาง (LPB)',
  'EP':  'บ้านแพ้ว (EP)',
  'PT':  'พระราม2 (PT)',
  'VC':  'ลาดหลุมแก้ว (LK)',
  'CVE': 'โรงหล่อชวนา (CVE)',
  'UNKNOWN':      '_Unclassified',
  'UNCLASSIFIED': '_Unclassified'
};

function gmailFolderId_(project, tab) {
  var nameMap = getDocControlFolderMap_();
  var n = PROJECT_KEY_TO_FOLDER_NAME[project] || PROJECT_KEY_TO_FOLDER_NAME[tab] || '_Unclassified';
  if (nameMap[n]) return nameMap[n];
  return GMAIL_FOLDER_BY_KEY[project] || GMAIL_FOLDER_BY_KEY[tab] || GMAIL_FOLDER_BY_KEY['UNKNOWN'];
}

// The web app renders the grey 2nd line from a column named "Summary".
// Some project tabs never had that column, so the line could never
// show. Add it as the last column when missing (position-safe — every
// reader/writer resolves columns by header name). Returns true if added.
function gmailEnsureSummaryCol_(sh) {
  var lastCol = sh.getLastColumn();
  var hdr = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < hdr.length; i++) {
    if (String(hdr[i]).trim().toLowerCase() === 'summary') return false;
  }
  sh.getRange(1, lastCol + 1).setValue('Summary');
  return true;
}

// e-mail address out of a "Name <a@b.com>" From header.
function gmailAddr_(from) {
  var m = String(from || '').match(/<([^>]+)>/);
  return (m ? m[1] : String(from || '')).trim().toLowerCase();
}

// Noise filter — never log these.
function gmailIsNoise_(subject, from) {
  var s = (subject || '').toLowerCase(), f = (from || '').toLowerCase();
  if (/no-?reply|do-?not-?reply|mailer-daemon|postmaster|notification|newsletter|unsubscribe|out of office|automatic reply|n8n|delivery status/.test(f + ' ' + s)) return true;
  if (/payment (confirmation|received|notification)|statement is ready|e-statement/.test(s) && !/[/-]\d/.test(s)) return true;
  return false;
}

// Project / tab routing — subject prefix first, sender list as fallback.
function gmailClassify_(subject, fromAddr) {
  var subj = String(subject || '').trim();
  for (var i = 0; i < GMAIL_PREFIX_RULES.length; i++) {
    var rule = GMAIL_PREFIX_RULES[i];
    for (var j = 0; j < rule.p.length; j++) {
      var pre = rule.p[j];
      if (subj.toUpperCase().indexOf(pre.toUpperCase()) === 0) {
        return { tab: rule.tab, project: rule.project, via: 'subject' };
      }
    }
  }
  for (var g in GMAIL_SENDER_GROUPS) {
    var list = GMAIL_SENDER_GROUPS[g];
    for (var k = 0; k < list.length; k++) {
      if (list[k].toLowerCase() === fromAddr) {
        return { tab: g, project: g, via: 'sender' };
      }
    }
  }
  return { tab: 'UNCLASSIFIED', project: 'UNCLASSIFIED', via: 'none' };
}

// Document-type code from the subject (3b). Slash form → 3rd segment;
// hyphen form → segment after the first hyphen. Letter suffixes (02A /
// 02B / 02C) are preserved exactly. Falls back to attachment filenames
// for a more specific code when only a plain number is found.
function gmailDocCode_(subject, attachNames) {
  var tok = String(subject || '').trim().split(/\s+/)[0] || '';
  var code = '';
  if (tok.indexOf('/') >= 0) {
    var sp = tok.split('/');
    code = (sp[2] || '').trim();
  } else if (tok.indexOf('-') >= 0) {
    var hp = tok.split('-');
    code = (hp[1] || '').trim();
  }
  if (/^\d+$/.test(code) && attachNames && attachNames.length) {
    var re = new RegExp('\\b' + code + '([A-Za-z])\\b');
    for (var i = 0; i < attachNames.length; i++) {
      var mm = String(attachNames[i]).match(re);
      if (mm) { code = code + mm[1].toUpperCase(); break; }
    }
  }
  return code;
}

// Read every project tab once → Set of Gmail Thread-IDs already logged
// (ignoring PENDING: placeholders), plus the per-tab blank-link rows
// for the Step 3.5 backfill.
function gmailKnownState_(ss) {
  var known = {}, pending = [];
  var sheets = ss.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s], nm = sh.getName();
    if (nm === DISCUSSION_SHEET || /summary/i.test(nm)) continue;
    var vals = sh.getDataRange().getValues();
    if (vals.length < 2) continue;
    var H = colMapLower_(vals[0]);
    var iTid = H['gmail thread-id'], iUrl = H['drive link'];
    if (iTid === undefined) continue;
    for (var r = 1; r < vals.length; r++) {
      var tid = String(vals[r][iTid] || '').trim();
      if (!tid || /^PENDING:/i.test(tid)) continue;
      known[tid] = true;
      var url = iUrl !== undefined ? String(vals[r][iUrl] || '').trim() : 'x';
      if (!url) pending.push({ sheet: sh, row: r + 1, tid: tid, hmap: H });
    }
  }
  return { known: known, pending: pending };
}

// Save every real attachment of a Gmail thread into a Drive folder.
// Uses Drive API v3 (Advanced Drive Service) so the file is created
// DIRECTLY in the target folder in a single atomic call. DriveApp's
// folder.createFile() has a long-standing bug under strict Workspace
// policies where files land in My Drive root instead of the folder,
// silently. The v3 API doesn't have that problem.
// Returns array of {name,url,id}. Never throws.
function gmailSaveThreadAttachments_(thread, folderId) {
  var saved = [];
  // Build a {filename: fileId} map of what's already in the target folder
  // so re-runs link to the existing file instead of creating duplicates.
  var existing = {};
  try {
    var folder = DriveApp.getFolderById(folderId);
    var fit = folder.getFiles();
    while (fit.hasNext()) { var f = fit.next(); existing[f.getName()] = f.getId(); }
  } catch (e) { Logger.log('folder list failed: ' + e); }

  try {
    var msgs = thread.getMessages();
    for (var m = 0; m < msgs.length; m++) {
      var atts = msgs[m].getAttachments({ includeInlineImages: false, includeAttachments: true });
      for (var a = 0; a < atts.length; a++) {
        try {
          var name = atts[a].getName();
          if (existing[name]) {
            saved.push({ name: name, id: existing[name],
                         url: 'https://drive.google.com/file/d/' + existing[name] + '/view',
                         dedup: true });
            continue;
          }
          var resource = { name: name, parents: [folderId] };
          var created = Drive.Files.create(resource, atts[a], {
            supportsAllDrives: true,
            fields: 'id,name'
          });
          try { shareForViewing_(created.id); } catch (sh) { Logger.log('share failed: ' + sh); }
          existing[created.name] = created.id;
          saved.push({ name: created.name, id: created.id,
                       url: 'https://drive.google.com/file/d/' + created.id + '/view' });
        } catch (e) { Logger.log('attach save failed: ' + e); }
      }
    }
  } catch (e) { Logger.log('thread read failed: ' + e); }
  return saved;
}

// The function the 10-minute trigger calls.
function gmailAutoLog(e) {
  // When fired by the time-based trigger (`e` is present), skip outside
  // 8am–6pm Bangkok — no project-site email is expected after hours, and
  // a no-op invocation still consumes a tiny quota slice. Manual editor
  // runs (no `e`) bypass the gate so testing off-hours still works.
  if (e) {
    var h = parseInt(Utilities.formatDate(new Date(), 'Asia/Bangkok', 'H'), 10);
    if (h < 8 || h >= 18) {
      Logger.log('gmailAutoLog (trigger): outside 8am–6pm Bangkok (' + h + 'h) — skipping.');
      return;
    }
  }
  return gmailAutoLogRun_(false);
}
function gmailAutoLogDryRun() { return gmailAutoLogRun_(true); }
// Recovery helper: scan a 90-day window of Gmail so old un-logged threads
// get caught and their attachments saved (deduped) into the canonical
// folders under "9. DOCUMENT CONTROL".
function gmailAutoLogFullSync() { return gmailAutoLogRun_(false, 90); }

function gmailAutoLogRun_(dryRun, windowDays) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) { Logger.log('gmailAutoLog: another run is in progress — skipping.'); return; }
  var rep = { dryRun: !!dryRun, window: '', found: 0, skipped: 0, logged: {},
              attachments: 0, dedupHits: 0, pendingFilled: 0, stillPending: 0, passBOnly: [], errors: [] };
  try {
    var ss = SpreadsheetApp.openById(getMasterId_());
    var tz = 'Asia/Bangkok';
    var days = (typeof windowDays === 'number' && windowDays > 0) ? windowDays : 2;
    var since = new Date(Date.now() - days * 86400000);
    var after = Utilities.formatDate(since, tz, 'yyyy/MM/dd');
    rep.window = 'after:' + after;

    var state = gmailKnownState_(ss);

    // ---- Step 2: Pass A (senders) + Pass B (subject patterns) --------
    var threads = {}, passA = {};
    for (var g in GMAIL_SENDER_GROUPS) {
      var froms = GMAIL_SENDER_GROUPS[g].map(function (e) { return 'from:' + e; }).join(' OR ');
      gmailCollect_('after:' + after + ' (' + froms + ')', threads, passA, true);
    }
    for (var q = 0; q < GMAIL_SUBJECT_QUERIES.length; q++) {
      gmailCollect_('after:' + after + ' ' + GMAIL_SUBJECT_QUERIES[q], threads, passA, false);
    }

    // ---- Step 3 + 4: classify, log, save ----------------------------
    for (var tid in threads) {
      try {
        if (state.known[tid]) { rep.skipped++; continue; }
        var th = threads[tid];
        var msgs = th.getMessages();
        if (!msgs.length) { rep.skipped++; continue; }
        var first = msgs[0];
        var subject = th.getFirstMessageSubject() || first.getSubject() || '';
        var fromRaw = first.getFrom() || '';
        var fromAddr = gmailAddr_(fromRaw);
        if (gmailIsNoise_(subject, fromRaw)) { rep.skipped++; continue; }

        rep.found++;
        if (!passA[tid]) rep.passBOnly.push(subject.slice(0, 80) + '  <' + fromAddr + '>');

        // attachment filenames (for sharper doc-code) without downloading
        var attNames = [];
        for (var mi = 0; mi < msgs.length; mi++) {
          var aa = msgs[mi].getAttachments({ includeInlineImages: false, includeAttachments: true });
          for (var ai = 0; ai < aa.length; ai++) attNames.push(aa[ai].getName());
        }

        var cls = gmailClassify_(subject, fromAddr);
        var code = gmailDocCode_(subject, attNames);
        var dRecv = first.getDate();
        var now = new Date();

        rep.logged[cls.tab] = (rep.logged[cls.tab] || 0) + 1;
        if (dryRun) continue;

        var sh = getMasterSheetForProject_(ss, cls.tab);   // creates tab w/ header if missing
        gmailEnsureSummaryCol_(sh);                         // grey 2nd-line column
        var hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
        var hmap = colMapLower_(hdr);
        var dateRecv = Utilities.formatDate(dRecv, tz, 'dd/MM/yyyy');
        // Brief content for the register's grey 2nd line (the "Summary"
        // column) — email body snippet, same as the old email-logged rows.
        var snippet = '';
        try { snippet = String(first.getPlainBody() || '').replace(/\s+/g, ' ').trim().slice(0, 200); } catch (e) {}
        if (!snippet) snippet = subject;
        var row = buildRow_(hmap, hdr.length, {
          'no.': Math.max(1, sh.getLastRow()),
          'date received': dateRecv,
          'time received': Utilities.formatDate(dRecv, tz, 'HH:mm'),
          'sender email': fromAddr,
          'document type': code,
          'subject': subject,
          'summary': snippet,
          'drive link': '',
          'project': cls.project,
          'logged date': Utilities.formatDate(now, tz, 'dd/MM/yyyy'),
          'logged time': Utilities.formatDate(now, tz, 'HH:mm'),
          'gmail thread-id': tid,
          'remarks': '',
          'month': monthFromDate_(dateRecv, tz, now),
          'source': 'Email',
          'letterdata': ''
        });
        sh.appendRow(row);
        var rowIdx = sh.getLastRow();
        state.known[tid] = true;

        // save attachments → Drive, write first link back to the row
        var saved = gmailSaveThreadAttachments_(th, gmailFolderId_(cls.project, cls.tab));
        var attCount = attNames.length;
        if (saved.length && hmap['drive link'] !== undefined) {
          sh.getRange(rowIdx, hmap['drive link'] + 1).setValue(saved[0].url);
          rep.attachments += saved.length;
          if (saved.length > 1 && hmap['remarks'] !== undefined) {
            sh.getRange(rowIdx, hmap['remarks'] + 1)
              .setValue(saved.length + ' attachments — first in Drive Link, all viewable in the portal');
          }
        } else if (attCount > 0 && hmap['drive link'] !== undefined) {
          // Drive save failed (Workspace policy / quota / etc.) — fall back
          // to a Gmail-stream viewer URL so the cell still has a clickable
          // link and the web app's Open still works.
          try {
            var appUrl = ScriptApp.getService().getUrl();
            var viewUrl = appUrl + '?action=gview&tid=' + encodeURIComponent(tid) + '&mi=0&ai=0';
            sh.getRange(rowIdx, hmap['drive link'] + 1).setValue(viewUrl);
            if (hmap['remarks'] !== undefined) {
              sh.getRange(rowIdx, hmap['remarks'] + 1)
                .setValue(attCount + ' attachment(s) — streamed from Gmail (no Drive copy)');
            }
          } catch (e) { /* keep cell empty if even URL build fails */ }
        }
      } catch (e) { rep.errors.push('thread ' + tid + ': ' + e); }
    }

    // ---- Step 3.5: backfill older rows still missing a Drive link ---
    if (!dryRun) {
      for (var p = 0; p < state.pending.length; p++) {
        var pr = state.pending[p];
        if (pr.hmap['drive link'] === undefined) continue;
        try {
          var pth = GmailApp.getThreadById(pr.tid);
          if (!pth) { rep.stillPending++; continue; }
          var projCell = pr.hmap['project'] !== undefined
            ? String(pr.sheet.getRange(pr.row, pr.hmap['project'] + 1).getValue() || '').trim() : '';
          var sv = gmailSaveThreadAttachments_(pth, gmailFolderId_(projCell, pr.sheet.getName()));
          if (sv.length) {
            pr.sheet.getRange(pr.row, pr.hmap['drive link'] + 1).setValue(sv[0].url);
            rep.attachments += sv.length;
            rep.pendingFilled++;
            if (sv.length > 1 && pr.hmap['remarks'] !== undefined) {
              pr.sheet.getRange(pr.row, pr.hmap['remarks'] + 1)
                .setValue(sv.length + ' attachments — first in Drive Link, all viewable in the portal');
            }
          } else {
            // Couldn't save to Drive (Workspace policy) — write a Gmail-
            // stream viewer URL so the cell is still clickable and the
            // file is still openable from the portal.
            var msgsP = pth.getMessages(), attN = 0;
            for (var mip = 0; mip < msgsP.length; mip++) {
              attN += msgsP[mip].getAttachments({ includeInlineImages: false, includeAttachments: true }).length;
            }
            if (attN > 0) {
              var appUrlP = ScriptApp.getService().getUrl();
              var viewUrlP = appUrlP + '?action=gview&tid=' + encodeURIComponent(pr.tid) + '&mi=0&ai=0';
              pr.sheet.getRange(pr.row, pr.hmap['drive link'] + 1).setValue(viewUrlP);
              if (pr.hmap['remarks'] !== undefined) {
                pr.sheet.getRange(pr.row, pr.hmap['remarks'] + 1)
                  .setValue(attN + ' attachment(s) — streamed from Gmail (no Drive copy)');
              }
              rep.pendingFilled++;
            } else { rep.stillPending++; }
          }
        } catch (e) { rep.stillPending++; rep.errors.push('backfill ' + pr.tid + ': ' + e); }
      }

      // ---- Backfill the grey "Summary" 2nd line on Email rows that
      // were logged before this column was populated. Capped per run.
      rep.summaryFilled = 0;
      var capS = 60, doneS = 0;
      var shts = ss.getSheets();
      for (var si = 0; si < shts.length && doneS < capS; si++) {
        var ssh = shts[si], snm = ssh.getName();
        if (snm === DISCUSSION_SHEET || /summary/i.test(snm)) continue;
        gmailEnsureSummaryCol_(ssh);                        // add the column if a tab lacks it
        var sv2 = ssh.getDataRange().getValues();
        if (sv2.length < 2) continue;
        var SH = colMapLower_(sv2[0]);
        var iSum = SH['summary'], iTid2 = SH['gmail thread-id'], iSrc = SH['source'];
        if (iSum === undefined || iTid2 === undefined) continue;
        for (var rr = 1; rr < sv2.length && doneS < capS; rr++) {
          if (String(sv2[rr][iSum] || '').trim()) continue;            // already has one
          if (iSrc !== undefined && String(sv2[rr][iSrc] || '').trim().toLowerCase() !== 'email') continue;
          var tid2 = String(sv2[rr][iTid2] || '').trim();
          if (!tid2 || /^PENDING:/i.test(tid2)) continue;
          try {
            var th2 = GmailApp.getThreadById(tid2);
            if (!th2) continue;
            var ms = th2.getMessages();
            if (!ms.length) continue;
            var snp = String(ms[0].getPlainBody() || '').replace(/\s+/g, ' ').trim().slice(0, 200);
            if (!snp) continue;
            ssh.getRange(rr + 1, iSum + 1).setValue(snp);
            rep.summaryFilled++; doneS++;
          } catch (e) { rep.errors.push('summary backfill ' + tid2 + ': ' + e); }
        }
      }

      // ---- Re-share any older attachment files that aren't yet
      // ANYONE_WITH_LINK — those load blank in the anonymous web app's
      // iframe. Idempotent (re-setting same sharing is a no-op). Capped.
      rep.reshared = 0;
      var capR = 60, doneR = 0;
      var shtsR = ss.getSheets();
      var seenIds = {};
      for (var siR = 0; siR < shtsR.length && doneR < capR; siR++) {
        var sR = shtsR[siR], snR = sR.getName();
        if (snR === DISCUSSION_SHEET || /summary/i.test(snR)) continue;
        var vR = sR.getDataRange().getValues();
        if (vR.length < 2) continue;
        var HR = colMapLower_(vR[0]);
        var iUrlR = HR['drive link'], iSrcR = HR['source'];
        if (iUrlR === undefined) continue;
        for (var rrR = 1; rrR < vR.length && doneR < capR; rrR++) {
          if (iSrcR !== undefined && String(vR[rrR][iSrcR] || '').trim().toLowerCase() !== 'email') continue;
          var urlR = String(vR[rrR][iUrlR] || '').trim();
          if (!urlR) continue;
          var mR = urlR.match(/\/d\/([^/?#]+)/);
          if (!mR) continue;
          var fid = mR[1];
          if (seenIds[fid]) continue;
          seenIds[fid] = true;
          try { shareForViewing_(fid); rep.reshared++; doneR++; }
          catch (e) { rep.errors.push('reshare ' + fid + ': ' + e); }
        }
      }
    }

    PropertiesService.getScriptProperties()
      .setProperty('GMAIL_AUTOLOG_LASTRUN',
        Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm') + ' | ' + JSON.stringify(rep));
    Logger.log('gmailAutoLog summary: ' + JSON.stringify(rep, null, 2));
  } catch (err) {
    rep.errors.push('FATAL: ' + err);
    Logger.log('gmailAutoLog FATAL: ' + err);
  } finally {
    lock.releaseLock();
  }
  return rep;
}

// Run a Gmail query, add its threads to `bag` (keyed by id); mark Pass-A
// ones in `passA`. Capped + guarded so a bad query can't break the run.
function gmailCollect_(query, bag, passA, isPassA) {
  try {
    var ths = GmailApp.search(query, 0, 100);
    for (var i = 0; i < ths.length; i++) {
      var id = ths[i].getId();
      bag[id] = ths[i];
      if (isPassA) passA[id] = true;
    }
  } catch (e) { Logger.log('search failed [' + query + ']: ' + e); }
}

// ── ONE-TIME: install / remove the 10-minute trigger ──────────────
function installGmailAutoLogTrigger() {
  removeGmailAutoLogTrigger();
  ScriptApp.newTrigger('gmailAutoLog').timeBased().everyMinutes(30).create();
  Logger.log('Gmail auto-logger installed — fires every 30 minutes; function self-gates to 8am–6pm Bangkok.');
  return 'Installed: gmailAutoLog every 30 minutes (8am–6pm Bangkok).';
}
function removeGmailAutoLogTrigger() {
  var t = ScriptApp.getProjectTriggers(), n = 0;
  for (var i = 0; i < t.length; i++) {
    if (t[i].getHandlerFunction() === 'gmailAutoLog') { ScriptApp.deleteTrigger(t[i]); n++; }
  }
  if (n) Logger.log('Removed ' + n + ' existing gmailAutoLog trigger(s).');
  return n;
}
