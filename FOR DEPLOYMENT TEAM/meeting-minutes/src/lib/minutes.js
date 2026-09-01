// The rules this module reasons in, in one place.
//
// These were spread across seven components as duplicated filter/sort
// expressions. Each one existed because the Apps Script app made the same
// decision in several screens; keeping the duplicates meant a rule could be
// fixed in one view and left wrong in the others — which is how the inbox
// exclusion came to disagree between the dashboard and the meeting list.

/* --------------------------------- inboxes -------------------------------- */

/**
 * Fathom recordings live under this project id permanently. It is a REAL
 * project row that appears in listings — not a client-side fiction — and a
 * recording never leaves it: tagging only adds to taggedProjectIds.
 */
export const FATHOM_INBOX_ID = 'FATHOM_INBOX';

/** Transkriptor's equivalent. Same rules, same permanence. */
export const TRANSKRIPTOR_INBOX_ID = 'TRANSKRIPTOR_INBOX';

/**
 * True for either inbox.
 *
 * Both are standalone review queues, not tracked projects, so they are excluded
 * from the "All meetings" aggregate, from the dashboard card grid, from the
 * mobile latest strip and from the timeline. They keep their own sidebar tile
 * and their own count.
 */
export function isInboxProject(id) {
  return id === FATHOM_INBOX_ID || id === TRANSKRIPTOR_INBOX_ID;
}

/** The pseudo-id the sidebar's aggregate tile uses. Never a real project. */
export const ALL_PROJECTS = 'ALL';

/** The pseudo-id that swaps the detail pane for the timeline. */
export const TIMELINE_PROJECT = 'TIMELINE';

/* --------------------------------- sources -------------------------------- */

/**
 * Where a meeting's content came from.
 *
 * 'doc-import' is HISTORY, not a state anything may write. Docs stopped being
 * the source of truth on 2026-07-19; the API's save pins an imported row's
 * source forever and the database CHECK constraint refuses 'doc-edited'
 * outright. An edit is a tidy-up, not a new creation — the true origin is what
 * matters. So an edited import must still render as imported, and there is no
 * 'edited' badge to add.
 */
export const SOURCE = {
  DOC_IMPORT: 'doc-import',
  MANUAL: 'manual',
  FATHOM: 'fathom',
  TRANSKRIPTOR: 'transkriptor',
};

/** The only values a client may send to saveMeeting. */
export const WRITABLE_SOURCES = [SOURCE.MANUAL, SOURCE.FATHOM, SOURCE.TRANSKRIPTOR];

/** Machine-transcribed, so the rendered page carries the AI disclaimer. */
export function isAiSourced(source) {
  return source === SOURCE.FATHOM || source === SOURCE.TRANSKRIPTOR;
}

/**
 * True for a row that came from a Google Doc before the cutover.
 *
 * Such a row is never editable in the app: its content is a one-way import and
 * the Doc it came from is no longer authoritative, so there is nothing coherent
 * to save back into. The ✎ Edit button is hidden for these and only these.
 */
export function isDocImport(source) {
  return source === SOURCE.DOC_IMPORT;
}

/* --------------------------------- sorting -------------------------------- */

/** Missing dates sort last rather than first, which '' would do. */
const DATE_FLOOR = '0000-00-00';

/**
 * The list order, used everywhere a meeting list is shown: pinned first, then
 * newest by meeting date. Overview rows are undated and sink below the dated
 * ones (see sortMeetingsWithOverview).
 */
export function byPinnedThenDate(a, b) {
  if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
  return (b.date || DATE_FLOOR).localeCompare(a.date || DATE_FLOOR);
}

/**
 * The meeting LIST's order, which additionally sinks 'overview' rows below the
 * dated meetings — an Overview is a standing summary, not an event, so it must
 * not sit at the top just because it has no date.
 */
export function sortMeetingsWithOverview(a, b) {
  if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
  const ova = a.kind === 'overview' ? 1 : 0;
  const ovb = b.kind === 'overview' ? 1 : 0;
  if (ova !== ovb) return ova - ovb;
  return (b.date || DATE_FLOOR).localeCompare(a.date || DATE_FLOOR);
}

/**
 * A project's meetings, newest first, Overview rows dropped.
 *
 * Used by the project dashboard and by the ?project= permalink, which must
 * always resolve to whatever is CURRENTLY latest — never to a stored id, so the
 * same link keeps pointing at the newest meeting each time it is opened.
 */
export function projectMeetings(meetings, projectId) {
  return meetings
    .filter((m) => m.projectId === projectId && m.kind !== 'overview')
    .slice()
    .sort(byPinnedThenDate);
}

/** That project's current latest meeting, or undefined. */
export function latestInProject(meetings, projectId) {
  return projectMeetings(meetings, projectId)[0];
}

/* ------------------------------- range filter ----------------------------- */

export const RANGES = ['all', 'week', 'month'];

const pad2 = (n) => (n < 10 ? '0' : '') + n;
const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** The ISO date a range starts at, or null for 'all'. Weeks start Monday. */
function rangeCutoff(range) {
  const now = new Date();
  if (range === 'week') {
    const d = new Date(now);
    const dow = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - dow);
    return isoOf(d);
  }
  if (range === 'month') return isoOf(new Date(now.getFullYear(), now.getMonth(), 1));
  return null;
}

/** Is this meeting inside the range? An undated row is only in 'all'. */
export function inRange(meeting, range) {
  if (range === 'all') return true;
  if (!meeting.date) return false;
  const cut = rangeCutoff(range);
  return cut == null ? true : meeting.date >= cut;
}

/* ------------------------------ list filtering ---------------------------- */

/**
 * Does this row belong under the project tab currently selected?
 *
 * 'ALL' means every TRACKED project — neither inbox folds in, even though all
 * of them share one meetings array.
 */
export function passesProjectFilter(meeting, activeProject) {
  return activeProject === ALL_PROJECTS
    ? !isInboxProject(meeting.projectId)
    : meeting.projectId === activeProject;
}

/**
 * The instant client-side text filter.
 *
 * Covers what the list payload actually carries — title, date label, excerpt,
 * attendees. A term buried past the excerpt is caught instead by the debounced
 * server search, whose matching ids are merged in by the caller.
 */
export function matchesQuery(meeting, lowerQuery) {
  if (!lowerQuery) return true;
  const hay = [
    meeting.title,
    meeting.dateLabel || '',
    meeting.excerpt || '',
    (meeting.attendees || []).join(' '),
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(lowerQuery);
}

/* --------------------------------- files ---------------------------------- */

/** The API's allow-list, as an <input accept> string. Keep the two in step. */
export const ATTACH_ACCEPT =
  '.pdf,.ppt,.pptx,.xls,.xlsx,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv';

/** ATTACHMENT_MAX_BYTES in api/src/routes/minutes.js. */
export const ATTACH_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Short label + colour key for an attachment's file type, sniffed from the mime
 * type and the filename together — a .csv served as text/plain and a
 * .xlsx served as application/octet-stream both still need to read as a
 * spreadsheet.
 */
export function fileIconKind(mime, name) {
  const t = `${mime || ''} ${name || ''}`.toLowerCase();
  if (/sheet|excel|\.xls|\.csv/.test(t)) return { kind: 'xls', label: 'X' };
  if (/presentation|powerpoint|\.ppt/.test(t)) return { kind: 'ppt', label: 'P' };
  if (/pdf/.test(t)) return { kind: 'pdf', label: 'PDF' };
  if (/document|word|\.doc/.test(t)) return { kind: 'doc', label: 'W' };
  if (/image\//.test(t)) return { kind: 'img', label: '🖼' };
  return { kind: 'gen', label: '▭' };
}

/** Tailwind classes per file-type badge, so the colour lives with the kind. */
export const FILE_ICON_CLASS = {
  xls: 'bg-[#1a7f37]',
  ppt: 'bg-[#d24726]',
  pdf: 'bg-[#cf222e]',
  doc: 'bg-[#1f6feb]',
  img: 'bg-[#8250df]',
  gen: 'bg-[#6e7781]',
};

export function fmtFileSize(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

/* ---------------------------------- misc ---------------------------------- */

/** HTML-escape for the strings hand-built into an iframe srcdoc. */
export function esc(s) {
  return String(s == null ? '' : s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
  );
}

/**
 * A permalink to one meeting, absolute against wherever the SPA is served.
 *
 * The Apps Script version needed the deployment's /exec URL handed to it by the
 * server (sessionState.execUrl). A Vercel-hosted SPA knows its own origin, so
 * that field is gone and this reads window.location instead.
 */
export function meetingLink(id) {
  try {
    return `${window.location.origin}${window.location.pathname}?meeting=${encodeURIComponent(id)}`;
  } catch {
    return String(id);
  }
}

/** A permalink that always opens whatever is currently latest in a project. */
export function projectLink(projectId) {
  try {
    return `${window.location.origin}${window.location.pathname}?project=${encodeURIComponent(projectId)}`;
  } catch {
    return String(projectId);
  }
}

/**
 * Copy text, falling back to a prompt the user can copy out of by hand.
 * navigator.clipboard is unavailable on an insecure origin and can be refused
 * outright, and a share button that silently does nothing is worse than one
 * that shows you the link.
 */
export function copyLink(link, onCopied, promptLabel) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(link).then(
      () => onCopied(),
      () => window.prompt(promptLabel, link)
    );
  } else {
    window.prompt(promptLabel, link);
  }
}
