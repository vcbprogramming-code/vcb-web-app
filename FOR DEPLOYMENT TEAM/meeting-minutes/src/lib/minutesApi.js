// Every call Meeting Minutes makes to the single Express API at api/.
//
// This file replaces src/api/client.ts, src/api/mock.ts, src/api/seed.ts and
// src/lib/supabaseClient.ts. The browser now holds no database credentials and
// reaches no database — it talks to api/src/routes/minutes.js over REST, which
// is the only place SQL runs. TECH_STACK.md:
// "เบราว์เซอร์ต้องไม่ต่อ Supabase โดยตรง".
//
// Endpoints, from api/src/routes/minutes.js. `anon` marks a route mounted with
// allowAnonymous — the old app was deployed ANYONE_ANONYMOUS and a visitor with
// no session is a normal caller, so a 401 on a read would be a regression:
//
//   GET    /api/minutes/projects                          anon
//   POST   /api/minutes/projects                          admin
//   PATCH  /api/minutes/projects/:id                      admin
//   DELETE /api/minutes/projects/:id                      admin
//   GET    /api/minutes/projects/:id/access               editor | admin
//   PUT    /api/minutes/projects/:id/visibility           admin
//   POST   /api/minutes/projects/:id/guests               admin
//   DELETE /api/minutes/projects/:id/guests/:email        admin
//   GET    /api/minutes/meetings[?projectId=]             anon
//   GET    /api/minutes/meetings/search?q=                anon
//   GET    /api/minutes/meetings/:id                      anon
//   POST   /api/minutes/meetings                          editor | admin
//   PUT    /api/minutes/meetings/:id/content              editor | admin
//   PUT    /api/minutes/meetings/:id/pin                  admin
//   PUT    /api/minutes/meetings/:id/visibility           admin
//   DELETE /api/minutes/meetings/:id                      admin
//   POST   /api/minutes/meetings/:id/tags                 editor | admin
//   DELETE /api/minutes/meetings/:id/tags/:projectId      editor | admin
//   POST   /api/minutes/meetings/:id/attachments          editor | admin
//   DELETE /api/minutes/meetings/:id/attachments/:fileId  editor | admin
//   POST   /api/minutes/meetings/:id/comments             any signed-in reader
//   DELETE /api/minutes/meetings/:id/comments/:commentId  author | admin
//   GET    /api/minutes/meetings/:id/versions             admin
//   GET    /api/minutes/meetings/:id/versions/:seq        admin
//   GET    /api/minutes/meetings/:id/audit                admin
//   GET    /api/minutes/audit[?limit=]                    admin
//   GET    /api/minutes/fathom-raw-log[?limit&recordingId] admin
//
// THERE IS NO IMPORT ENDPOINT, AND THERE MUST NOT BE ONE.
// Google Docs stopped being the source of truth on 2026-07-19. Every meeting
// since is authored in the app, so re-importing would overwrite real edits with
// stale Doc content. `docId` and `source: 'doc-import'` are read-only
// provenance for rows that predate that date — see the note on saveMeeting.
//
// The api client is created ONCE here rather than per call, and main.jsx hands
// this same instance to <AuthProvider>. A second createApi() anywhere would get
// neither the token source nor the 401 handling, and every call through it
// would go out unsigned — a failure that only shows up at runtime.

import { createApi } from '@vcb/shared';

export const api = createApi();

const BASE = '/api/minutes';

/** Build `?a=1&b=2`, omitting empty values, or '' when there is nothing to add. */
function qs(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

/* -------------------------------- projects -------------------------------- */

/**
 * The sidebar's project list.
 *
 * Anonymous by design, and already filtered by tier server-side: a LOCKED
 * project is absent from an anonymous caller's response entirely, not merely
 * unclickable. Showing the name of a project someone cannot open is exactly the
 * leak the 🔒 tier exists to prevent, so this client must never re-add rows or
 * infer projects from the meeting list.
 *
 * Returns [{ id, name, nameEn, cadence, color, count, canSee, builtin,
 * isPublic, docId }]. `count` is meetings THIS caller may see. `docId` is
 * non-empty for admins only, and only for Doc-era rows.
 */
export function listProjects({ signal } = {}) {
  return api.get(`${BASE}/projects`, { signal });
}

/**
 * Create a tag-only project bucket. Admin only.
 *
 * No Google Doc is created — "+ New project" used to mint a surprise Doc nobody
 * wanted (regression guard, 2026-07-19). The response's docId/docUrl are always
 * ''; they exist so the shape matches a Doc-era project, not so anything can be
 * opened.
 */
export function createProject({ name, nameEn = '', cadence = 'Monthly' }) {
  return api.post(`${BASE}/projects`, { name, nameEn, cadence });
}

/**
 * Rename or recolour a project, including the original five. Admin only.
 * Omitted fields are left untouched (the API coalesces), so pass only what
 * changed.
 */
export function updateProject(projectId, patch) {
  return api.patch(`${BASE}/projects/${encodeURIComponent(projectId)}`, patch);
}

/**
 * Delete a project. Admin only.
 *
 * Refused with PROJECT_BUILTIN for the original five (they carry the Doc-era
 * history) and with PROJECT_NOT_EMPTY while any meeting still points at it.
 * Both are business rules, not faults — see lib/errors.js.
 *
 * NO UI CALLS THIS YET, deliberately. The Apps Script app had no delete-project
 * control either, and adding one is a decision about the archive rather than a
 * porting task: the only projects it can act on are empty, non-builtin buckets
 * someone created by mistake. The wrapper and its error copy exist so that
 * screen is a small addition rather than a new API surface.
 */
export function deleteProject(projectId) {
  return api.del(`${BASE}/projects/${encodeURIComponent(projectId)}`);
}

/* ----------------------------- project access ----------------------------- */

/**
 * One project's guest list. Editor or admin.
 *
 * Returns { id, name, nameEn, color, isPublic, emails }. Note there is no
 * `domain` field: the old ProjectAccess type carried an "all @vcb-con.com
 * staff" flag, and the ported schema has no column for it — see PORT_NOTES.md.
 */
export function getProjectAccess(projectId, { signal } = {}) {
  return api.get(`${BASE}/projects/${encodeURIComponent(projectId)}/access`, { signal });
}

/**
 * Publish or lock a project. Admin only.
 *
 * Asymmetric on purpose, and the UI must say so: unlocking publishes every
 * meeting already in the project, while locking only stops the future default
 * and leaves already-published rows visible. Locking again does NOT re-hide
 * them.
 */
export function setProjectPublic(projectId, isPublic) {
  return api.put(`${BASE}/projects/${encodeURIComponent(projectId)}/visibility`, { isPublic });
}

/**
 * Name people who may read a locked project. Admin only.
 *
 * Accepts one address or a pasted batch — the API splits on commas, semicolons
 * and whitespace and rejects the WHOLE batch on a bad entry (INVALID_EMAIL,
 * with the offending addresses in `err.body.emails`), so a typo is reported
 * rather than half-saved. Returns the full updated { emails }.
 */
export function addProjectGuests(projectId, emailsText) {
  return api.post(`${BASE}/projects/${encodeURIComponent(projectId)}/guests`, {
    emails: emailsText,
  });
}

export function removeProjectGuest(projectId, email) {
  return api.del(
    `${BASE}/projects/${encodeURIComponent(projectId)}/guests/${encodeURIComponent(email)}`
  );
}

/* -------------------------------- meetings -------------------------------- */

/**
 * The meeting list — the lightweight shape the cards render from.
 *
 * One inbox recording can appear several times: it keeps its own project_id
 * forever AND appears under each project it is tagged into, same id each time,
 * with `taggedFromInbox: true` on the copies. Callers that key a map by id must
 * account for that; the list is keyed by `projectId + id` where uniqueness
 * matters.
 */
export function listMeetings({ projectId, signal } = {}) {
  return api.get(`${BASE}/meetings${qs({ projectId })}`, { signal });
}

/**
 * Full-content search — returns matching ids only.
 *
 * The list payload carries title/dateLabel/excerpt, so a term buried past the
 * excerpt never matched a client-side filter. This searches the whole body and
 * the attendee list server-side; the client already holds the rows, so ids are
 * all that come back.
 */
export function searchMeetings(query, { signal } = {}) {
  return api.get(`${BASE}/meetings/search${qs({ q: query })}`, { signal });
}

/** One meeting, full record including body HTML, attachments and comments. */
export function getMeeting(id, { signal } = {}) {
  return api.get(`${BASE}/meetings/${encodeURIComponent(id)}`, { signal });
}

/**
 * Create or update a meeting. Editor or admin.
 *
 * `source` accepts only 'manual' | 'fathom' | 'transkriptor'. 'doc-import' is
 * absent DELIBERATELY: it is historical provenance, the import path is never
 * coming back, and the database CHECK constraint refuses 'doc-edited' outright.
 * A row that came from Docs keeps source='doc-import' forever even after it is
 * edited here — the API's UPDATE pins it. An edit is a tidy-up, not a new
 * creation, and knowing where a document truly came from outranks knowing it
 * was touched. Never display an edited import as anything but imported.
 *
 * `visible` is honoured for admins only; an editor's new row always starts
 * hidden regardless of what is sent.
 */
export function saveMeeting(input) {
  return api.post(`${BASE}/meetings`, input);
}

/**
 * Body-only edit, with an optional metadata fix in the same save.
 *
 * The API snapshots the PREVIOUS content AND its title/dateLabel/time into
 * minutes.versions before writing, which is what makes "View Original" show the
 * name the meeting had at that moment rather than its current one.
 */
export function saveMeetingContent(id, html, meta) {
  return api.put(`${BASE}/meetings/${encodeURIComponent(id)}/content`, { html, meta });
}

/** Toggle the pin. Admin only — returns the resulting { pinned }. */
export function togglePin(id) {
  return api.put(`${BASE}/meetings/${encodeURIComponent(id)}/pin`);
}

/**
 * Publish or hide one meeting. Admin only.
 *
 * Split from the editor's save on purpose: this is the old minutes_guard
 * trigger, which existed because RLS cannot compare old and new values per
 * column. Here it is simply a route with a stricter guard, so an editor's save
 * can never touch pin or visibility.
 */
export function setMeetingVisible(id, visible) {
  return api.put(`${BASE}/meetings/${encodeURIComponent(id)}/visibility`, { visible });
}

/** Delete a meeting. Admin only. */
export function deleteMeeting(id) {
  return api.del(`${BASE}/meetings/${encodeURIComponent(id)}`);
}

/* ------------------------------ inbox tagging ----------------------------- */

/**
 * Also show an inbox recording under a project. Editor or admin.
 *
 * ADDS a tag; it never moves the row. An inbox recording's project_id is
 * permanent — FATHOM_INBOX and TRANSKRIPTOR_INBOX are real projects that appear
 * in listings and hold their recordings forever. Refused with CANNOT_TAG_INBOX
 * when the target is itself an inbox, and NOT_AN_INBOX_ROW when the meeting is
 * not an inbox row. Returns the full updated { taggedProjectIds }.
 */
export function tagMeeting(id, projectId) {
  return api.post(`${BASE}/meetings/${encodeURIComponent(id)}/tags`, { projectId });
}

/** Remove ONE project's tag, leaving any others intact. Editor or admin. */
export function untagMeeting(id, projectId) {
  return api.del(
    `${BASE}/meetings/${encodeURIComponent(id)}/tags/${encodeURIComponent(projectId)}`
  );
}

/* ------------------------------- attachments ------------------------------ */

/**
 * Record an already-uploaded file against a meeting. Editor or admin.
 *
 * METADATA ONLY. The bytes never pass through this API: the JSON body limit is
 * 2 MB and the attachment cap is 25 MB, so base64 through here would fail on
 * anything real (and cost a 33% encoding tax besides). The file goes to
 * Supabase Storage from the browser via a presigned URL, and this records the
 * resulting link — the same division of labour the Apps Script version had with
 * Drive.
 *
 * `url` must be a real URL and `mimeType` must pass the API's allow-list (PDF,
 * Word, Excel, PowerPoint, images, text/CSV); anything else is
 * VALIDATION_FAILED. Returns the full updated { attachments }.
 *
 * NOTE: minutes.js exposes no presign route of its own — see uploadUrlFor().
 */
export function addAttachment(id, { name, mimeType, url, size }) {
  return api.post(`${BASE}/meetings/${encodeURIComponent(id)}/attachments`, {
    name,
    mimeType,
    url,
    size,
  });
}

export function removeAttachment(id, fileId) {
  return api.del(
    `${BASE}/meetings/${encodeURIComponent(id)}/attachments/${encodeURIComponent(fileId)}`
  );
}

/**
 * Ask the API to sign a Storage upload for an attachment.
 *
 * ---------------------------------------------------------------------------
 * THIS ENDPOINT DOES NOT EXIST YET.
 * ---------------------------------------------------------------------------
 * api/src/routes/minutes.js has no presign route. Onboarding has one
 * (GET /api/onboarding/documents/:name/path, which returns
 * { bucket, path, uploadUrl, downloadUrl } from lib/storage.js), and minutes
 * needs the same thing before attaching a file can work end to end.
 *
 * The client half is written here so the flow is one function when the route
 * lands, and it FAILS LOUDLY rather than silently degrading: uploading through
 * the JSON API is not a fallback that exists to be taken. Until the route is
 * added, addAttachment can only record a URL the user already has.
 */
export function uploadUrlFor(meetingId, { fileName, contentType, signal } = {}) {
  return api.get(
    `${BASE}/meetings/${encodeURIComponent(meetingId)}/attachment-url${qs({
      name: fileName,
      contentType,
    })}`,
    { signal }
  );
}

/**
 * PUT the bytes straight at Storage using a presigned URL.
 *
 * Deliberately a bare fetch, not api.put: the presigned URL is a signed S3
 * request that must carry no Authorization header of ours, and the shared
 * client would attach one. The Content-Type is signed INTO the URL, so it has
 * to match what was asked for exactly.
 */
export async function putToStorage(uploadUrl, file, contentType) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType || file.type || 'application/octet-stream' },
    body: file,
  });
  if (!res.ok) throw new Error(`UPLOAD_FAILED_${res.status}`);
  return true;
}

/* --------------------------------- comments ------------------------------- */

/**
 * Post a comment. Any signed-in person who can READ the meeting — the API
 * re-checks readability, so being signed in is not on its own enough on a
 * locked project. Returns the full updated { comments }.
 */
export function addComment(id, text) {
  return api.post(`${BASE}/meetings/${encodeURIComponent(id)}/comments`, { text });
}

/** Delete a comment. Its author, or an admin. */
export function removeComment(id, commentId) {
  return api.del(
    `${BASE}/meetings/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}`
  );
}

/* --------------------------- versions / audit trail ----------------------- */

/**
 * The snapshot list for one meeting. Admin only.
 * Returns [{ seq, takenAt, takenBy }], newest first.
 */
export function listVersions(id, { signal } = {}) {
  return api.get(`${BASE}/meetings/${encodeURIComponent(id)}/versions`, { signal });
}

/**
 * One version's content. Admin only.
 *
 * `seq` is a snapshot id, or the literal 'current' (the live row) or 'original'
 * (the OLDEST snapshot — the content before the first ever edit, or the live
 * row when the meeting has never been edited, in which case current genuinely
 * IS the original).
 *
 * Returns { html, title, dateLabel, time } — the metadata AS IT WAS at that
 * moment. Snapshots taken before the 2026-07-22 fix hold only html and return
 * '' for the rest; that empty string is the documented signal to fall back to
 * the live row, and ONLY in that case.
 */
export function getVersion(id, seq, { signal } = {}) {
  return api.get(
    `${BASE}/meetings/${encodeURIComponent(id)}/versions/${encodeURIComponent(seq)}`,
    { signal }
  );
}

/** Every audit entry for one meeting, newest first. Admin only. */
export function getMeetingAudit(id, { signal } = {}) {
  return api.get(`${BASE}/meetings/${encodeURIComponent(id)}/audit`, { signal });
}

/**
 * The whole audit log. Admin only.
 *
 * NO UI CALLS THIS YET. The per-meeting log (getMeetingAudit) is what the Edit
 * History panel shows, and that is what the Apps Script app had. A site-wide
 * activity screen is a genuinely new feature, not part of the port, so the
 * wrapper is here and nothing renders it.
 */
export function listAudit({ limit, signal } = {}) {
  return api.get(`${BASE}/audit${qs({ limit })}`, { signal });
}

/**
 * Raw Fathom webhook payloads. Admin only, and read-only here.
 *
 * Fathom and Transkriptor ingestion happens server-side, via webhook and
 * polling. There is no client UI for it and no POST here — a browser must never
 * be able to forge an ingest.
 *
 * NO UI CALLS THIS. It is a debugging surface for an admin diagnosing why a
 * recording did not appear, and the payloads are raw third-party JSON — useful
 * from a console, not something to render. Kept so that diagnosis does not
 * require writing a new client.
 */
export function listFathomRawLog({ limit, recordingId, signal } = {}) {
  return api.get(`${BASE}/fathom-raw-log${qs({ limit, recordingId })}`, { signal });
}
