/**
 * Diagnose.gs — TEMPORARY, read-only survey of the meeting corpus.
 *
 * Answers one question before any "action plan" view gets built: is there
 * enough STRUCTURE in the documents to extract action items reliably, or would
 * such a view be mostly empty and therefore unused?
 *
 * Writes nothing. Run diagnoseActionItems() from the Apps Script editor and
 * read the log. Delete this file once the question is settled.
 */

// Same patterns the client already uses in JavaScript.html, kept in sync by
// hand here so the survey measures exactly what the real extractor would see.
var DIAG_SUMMARY_RE = /สรุปผู้บริหาร|บทสรุป|executive\s*summary|key\s*takeaway|ประเด็นสำคัญ/i;
var DIAG_ACTION_RE = /action\s*item|รายการที่ต้องดำเนินการ|รายการที่ต้องทำ|สิ่งที่ต้องทำ|สิ่งที่ต้องดำเนินการ|ขั้นตอนถัดไป|ขั้นตอนต่อไป|มอบหมายงาน|next\s*step/i;

function diagnoseActionItems() {
  var rows = readAllRows_();
  var projects = {};
  getAllProjects_().forEach(function (p) { projects[p.id] = p.name; });

  var stat = {
    total: 0, withContent: 0, empty: 0,
    realHeadings: 0,          // has any <h1..h6> at all
    actionHeading: 0,         // action section found via a REAL heading
    actionBoldOnly: 0,        // action wording present, but not as a heading
    actionNone: 0,            // no action wording anywhere
    summaryHeading: 0,
    itemsTotal: 0,
    multiProject: 0,
    perProject: {},           // projectId -> {meetings, withActions, items}
    samples: []
  };

  rows.forEach(function (r) {
    if (isInboxProjectId_(r.projectId) && !parseTaggedProjectIds_(r.taggedProjectId).length) return;
    stat.total++;

    var tagged = parseTaggedProjectIds_(r.taggedProjectId);
    var owning = [r.projectId].concat(tagged).filter(function (x, i, a) {
      return x && !isInboxProjectId_(x) && a.indexOf(x) === i;
    });
    if (owning.length > 1) stat.multiProject++;
    owning.forEach(function (pid) {
      var s = stat.perProject[pid] || (stat.perProject[pid] = { meetings: 0, withActions: 0, items: 0 });
      s.meetings++;
    });

    var html = '';
    try { html = getContent_(r.id) || ''; } catch (e) { html = ''; }
    if (!html) { stat.empty++; return; }
    stat.withContent++;

    if (/<h[1-6][\s>]/i.test(html)) stat.realHeadings++;
    if (diagHasHeadingMatching_(html, DIAG_SUMMARY_RE)) stat.summaryHeading++;

    var section = diagSectionText_(html, DIAG_ACTION_RE);
    var plain = diagStrip_(html);

    if (section !== null) {
      stat.actionHeading++;
      var n = diagCountItems_(section);
      stat.itemsTotal += n;
      owning.forEach(function (pid) { var s = stat.perProject[pid]; s.withActions++; s.items += n; });
      if (stat.samples.length < 12) {
        stat.samples.push({
          title: String(r.title || '').slice(0, 48),
          projects: owning.map(function (p) { return projects[p] || p; }).join(' + '),
          items: n,
          first: diagStrip_(section).slice(0, 110)
        });
      }
    } else if (DIAG_ACTION_RE.test(plain)) {
      stat.actionBoldOnly++;
    } else {
      stat.actionNone++;
    }
  });

  diagReport_(stat, projects);
  return stat;
}

/* ------------------------------ helpers -------------------------------- */

function diagStrip_(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// Is there a REAL <h1..h6> whose text matches? That is the difference between
// an extractable document and one that only looks structured to a human.
function diagHasHeadingMatching_(html, re) {
  var m, rx = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  while ((m = rx.exec(html))) {
    if (re.test(diagStrip_(m[2]))) return true;
  }
  return false;
}

// Mirrors sectionHtml() in JavaScript.html: from a matching heading, take
// everything up to the next same-or-higher heading. Returns null if no such
// heading exists (as opposed to '' for a heading with an empty body).
function diagSectionText_(html, re) {
  var rx = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, m, hits = [];
  while ((m = rx.exec(html))) {
    hits.push({ rank: +m[1], text: diagStrip_(m[2]), start: m.index, end: rx.lastIndex });
  }
  for (var i = 0; i < hits.length; i++) {
    if (!re.test(hits[i].text)) continue;
    var stop = html.length;
    for (var j = i + 1; j < hits.length; j++) {
      if (hits[j].rank <= hits[i].rank) { stop = hits[j].start; break; }
    }
    return html.slice(hits[i].end, stop);
  }
  return null;
}

// Count real list items; fall back to non-trivial paragraphs.
function diagCountItems_(sectionHtml) {
  var lis = sectionHtml.match(/<li[\s>]/gi);
  if (lis && lis.length) return lis.length;
  var ps = sectionHtml.match(/<p[\s>]/gi);
  if (!ps) return 0;
  var n = 0, m, rx = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  while ((m = rx.exec(sectionHtml))) { if (diagStrip_(m[1]).length >= 12) n++; }
  return n;
}

function diagPct_(n, d) { return d ? Math.round((n / d) * 100) + '%' : '—'; }

function diagReport_(s, projects) {
  var L = [];
  L.push('=========== ACTION-ITEM STRUCTURE SURVEY ===========');
  L.push('Meetings surveyed:            ' + s.total);
  L.push('  with stored content:        ' + s.withContent);
  L.push('  empty / unreadable:         ' + s.empty);
  L.push('  spanning >1 project:        ' + s.multiProject + '  (' + diagPct_(s.multiProject, s.total) + ')');
  L.push('');
  L.push('--- Document structure (of ' + s.withContent + ' with content) ---');
  L.push('Uses real <h1..h6> headings:  ' + s.realHeadings + '  (' + diagPct_(s.realHeadings, s.withContent) + ')');
  L.push('Exec Summary as a heading:    ' + s.summaryHeading + '  (' + diagPct_(s.summaryHeading, s.withContent) + ')');
  L.push('');
  L.push('--- Action items: THE DECIDING NUMBER ---');
  L.push('EXTRACTABLE (real heading):   ' + s.actionHeading + '  (' + diagPct_(s.actionHeading, s.withContent) + ')');
  L.push('Wording present, NOT heading: ' + s.actionBoldOnly + '  (' + diagPct_(s.actionBoldOnly, s.withContent) + ')  <- needs doc fixes');
  L.push('No action wording at all:     ' + s.actionNone + '  (' + diagPct_(s.actionNone, s.withContent) + ')  <- nothing to show');
  L.push('Total extractable items:      ' + s.itemsTotal);
  L.push('');
  L.push('--- Per project (meetings / with actions / items) ---');
  Object.keys(s.perProject).forEach(function (pid) {
    var v = s.perProject[pid];
    L.push('  ' + (projects[pid] || pid) + ': ' + v.meetings + ' / ' + v.withActions + ' / ' + v.items + ' items');
  });
  L.push('');
  L.push('--- Samples of what a column would actually show ---');
  s.samples.forEach(function (x) {
    L.push('  [' + x.projects + '] ' + x.title + ' (' + x.items + ' items)');
    L.push('      ' + x.first);
  });
  L.push('');
  var pct = s.withContent ? (s.actionHeading / s.withContent) : 0;
  L.push('VERDICT: ' + (
    pct >= 0.6 ? 'BUILD IT — most documents are structured enough to fill the view.' :
    pct >= 0.3 ? 'PARTIAL — it would work but look patchy; fix doc headings first.' :
                 'NOT YET — too few documents are structured; the view would be mostly empty.'
  ));
  L.push('====================================================');
  Logger.log(L.join('\n'));
}
