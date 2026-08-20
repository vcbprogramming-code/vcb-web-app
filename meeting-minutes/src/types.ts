// Typed mirror of the Google Apps Script API shapes.
// Source of truth: Code.js (getBootstrap/listMeetings/getMeeting/saveMeeting/…)
// and Auth.js (getSessionState/getProjectAccess/…). Field names + value
// conventions match the GAS returns verbatim.

export type Lang = 'en' | 'th'
export type Theme = 'light' | 'dark'

export type ProjectId = string
export type MeetingKind = 'meeting' | 'overview'
export type MeetingSource = 'doc-import' | 'doc-edited' | 'manual' | 'fathom' | 'transkriptor'

/** A project tile as returned in sessionState.projects. */
export interface Project {
  id: ProjectId
  name: string
  nameEn: string
  cadence?: string
  color: string
  count: number
  canSee?: boolean
  docUrl?: string
}

/** sessionState() / getPublicBootstrap() return. */
/** One row of the admin's editor list, with whether that person can actually
 *  sign in. Mirrors getEditorAccounts in Auth.js — deliberately carries no
 *  hash or salt. */
export interface EditorAccount {
  email: string
  /** False means they are allow-listed but have no PIN, so they still cannot
   *  get in — the gap that used to strand employees silently. */
  hasPassword: boolean
  /** True while the PIN is one an admin chose; the employee is forced to
   *  replace it on first sign-in so the admin stops knowing it. */
  mustChange: boolean
  setAt: string
}

/** Result of a successful editor sign-in. Mirrors editorLogin in Auth.js. */
export interface EditorSession {
  token: string
  user: string
  /** Always false: a PIN is the right bar for editing content, never for
   *  managing access, projects or API keys. Admin stays behind the Google
   *  account or ADMIN_PASSWORD. */
  isAdmin: boolean
  isEditor: boolean
  mustChange: boolean
  /** True when the SHARED team PIN was used rather than a personal one. Such a
   *  session is never asked to change its PIN — that would lock out everyone
   *  else holding it. */
  usedSharedPin: boolean
}

/** Shared-PIN state for the admin panel. `pin` is present only when explicitly
 *  revealed. */
export interface SharedPinStatus {
  enabled: boolean
  setAt: string
  pin?: string
}

export interface SessionState {
  appTitle: string
  appDisplayTitle: string
  subtitle: string
  authed: boolean
  user: string
  isAdmin: boolean
  /** True for admins too. A self-service tier below admin: can edit/create/
   *  delete meeting content and attachments, and file inbox recordings into
   *  projects, but cannot manage access lists, projects, or API keys.
   *  Mirrors EDITOR_EMAILS / isEditorOrAdmin_ in Auth.js. */
  isEditor: boolean
  projects: Project[]
  dbUrl?: string
  execUrl: string
}

/** One file attached to a meeting (Code.js's addAttachment/removeAttachment).
 *  Stored in Drive in the real app; here it's an in-memory data: URL so
 *  "download" still works in the mock without a real file host. */
export interface Attachment {
  fileId: string
  name: string
  mimeType: string
  size: number
  uploadedAt: string
  uploadedBy: string
  /** Mock-only: object/data URL to open on click. The real GAS app instead
   *  points this at a Drive file's share link (see Code.js addAttachment). */
  url: string
}

/** listMeetings() row — the lightweight list shape. A Fathom recording tagged
 *  into one or more projects appears once per projectId (FATHOM_INBOX always,
 *  plus one entry per tagged project) — same id, taggedFromInbox marks the
 *  duplicate copies. */
export interface MeetingListItem {
  id: string
  projectId: ProjectId
  title: string
  kind: MeetingKind
  date: string        // ISO yyyy-mm-dd or ''
  dateLabel: string
  time: string
  pinned: boolean
  visible: boolean
  hasFathom: boolean
  source: MeetingSource
  attendeeCount: number
  attendees: string[]
  excerpt: string
  taggedFromInbox?: boolean
  /** Count only, for the 📎 badge on cards — full list is in getMeeting(). */
  attachmentCount: number
}

/** getMeeting() — full record incl. rendered html + content meta. */
export interface MeetingFull {
  id: string
  projectId: ProjectId
  title: string
  kind: MeetingKind
  date: string
  dateLabel: string
  time: string
  pinned: boolean
  visible: boolean
  /** Fathom rows only: every project this recording is ALSO tagged into
   *  (can be more than one). projectId stays FATHOM_INBOX permanently —
   *  tagging never moves the row, only adds to this list. */
  taggedProjectIds: ProjectId[]
  fathomUrl: string
  source: MeetingSource
  attendees: string[]
  html: string
  css: string
  docUrl: string
  projectName: string
  createdAt: string
  updatedAt: string
  attachments: Attachment[]
  comments: Comment[]
}

/** A staff comment on a meeting. Author/admin may delete their own. */
export interface Comment {
  id: string
  author: string
  text: string
  createdAt: string
}

/** saveEdit() result. */
export interface SaveEditResult {
  ok: boolean
}

/** Optional 4th param to saveEdit() — lets the in-app editor fix a mis-set
 *  title/date/time in the same save as a content edit. Any field left out
 *  keeps its prior value. Mirrors the `meta` param in Code.js's saveEdit. */
export interface SaveEditMeta {
  title?: string
  dateLabel?: string
  time?: string
}

/** getVersionContent()/getOriginalContent() return shape (2026-07-22 schema
 *  change — previously a bare HTML string). title/dateLabel/time are the
 *  meeting's metadata AS IT WAS at the moment of that snapshot, not
 *  whatever the live row currently holds — fixes a confirmed bug where
 *  renaming a meeting made its own "Original"/version previews show the new
 *  name. title/dateLabel/time are '' for a version snapshotted before this
 *  fix shipped (metadata wasn't captured yet); the caller falls back to the
 *  live meeting's current values only in that specific case. Mirrors the
 *  { html, title, dateLabel, time } return of getVersionContent/
 *  getOriginalContent in Code.js. */
export interface VersionContent {
  html: string
  title: string
  dateLabel: string
  time: string
}

/** getAuditHistory() row — one entry in a meeting's unified activity timeline. */
export interface AuditEntry {
  when: string
  who: string
  action: string
  targetType: string
  targetId: string
  details: { versionSeq?: string | null; [k: string]: unknown }
}

/** getProjectAccess() row. */
export interface ProjectAccess {
  id: ProjectId
  name: string
  nameEn: string
  color: string
  domain: boolean
  emails: string[]
}

/** Payload accepted by saveMeeting(). */
export interface SaveMeetingInput {
  id?: string
  projectId: ProjectId
  title: string
  dateLabel: string
  time: string
  html: string
  fathomUrl?: string
  source?: MeetingSource
  visible?: boolean
}

/** Fathom recordings always live under this pseudo-project id (permanent
 *  archive — never leaves it) and additionally show up under any project
 *  they're tagged into. Mirrors FATHOM_INBOX_ID in Config.js. */
export const FATHOM_INBOX_ID: ProjectId = 'FATHOM_INBOX'

/** Transkriptor recordings (pulled via the Transkriptor API, polling — no
 *  webhook support) land here — mirrors FATHOM_INBOX_ID exactly, same rules.
 *  Mirrors TRANSKRIPTOR_INBOX_ID in Config.js. */
export const TRANSKRIPTOR_INBOX_ID: ProjectId = 'TRANSKRIPTOR_INBOX'

/** True for either inbox pseudo-project id. Mirrors isInboxProject_ in
 *  JavaScript.html (which replaced scattered === FATHOM_INBOX_ID checks). */
export function isInboxProject(id: ProjectId): boolean {
  return id === FATHOM_INBOX_ID || id === TRANSKRIPTOR_INBOX_ID
}

/** createProject() result. docId/docUrl are '' — projects created at runtime
 *  are tag-only buckets, never Doc-backed (see PORT_NOTES.md 2026-07-19). */
export interface CreatedProject {
  id: ProjectId
  docId: string
  name: string
  nameEn: string
  cadence: string
  color: string
  order: number
  docUrl: string
}

/** Partial edit accepted by renameProject() — omit a field to leave it unchanged. */
export interface ProjectRenamePatch {
  name?: string
  nameEn?: string
  cadence?: string
  color?: string
}

/** The set of server functions callable through the gs() bridge. */
export interface ServerApi {
  getSessionState(token: string): Promise<SessionState>
  listMeetings(token: string): Promise<MeetingListItem[]>
  getMeeting(id: string, token: string): Promise<MeetingFull | null>
  /** Admin only. */
  togglePin(id: string, token: string): Promise<boolean>
  /** Admin only. */
  setVisibility(id: string, visible: boolean, token: string): Promise<boolean>
  /** Editor or admin. */
  saveMeeting(obj: SaveMeetingInput, token: string): Promise<string>
  /** Editor or admin. */
  deleteMeeting(id: string, token: string): Promise<boolean>
  /** Editor or admin. meta (optional): { title, dateLabel, time } — lets the
   *  same content editor also fix a mis-set title/date/time in one save. */
  saveEdit(id: string, html: string, token: string, meta?: SaveEditMeta): Promise<SaveEditResult>
  getProjectAccess(token: string): Promise<ProjectAccess[]>
  setProjectDomain(projectId: ProjectId, allowDomain: boolean, token: string): Promise<ProjectAccess[]>
  addProjectViewer(projectId: ProjectId, email: string, token: string): Promise<ProjectAccess[]>
  removeProjectViewer(projectId: ProjectId, email: string, token: string): Promise<ProjectAccess[]>
  /** The current editor email list. Admin only. Mirrors getEditors in Auth.js. */
  getEditors(token: string): Promise<string[]>
  /** Adds an email to the editor tier (self-service, no redeploy). Admin only.
   *  Returns the full updated list. Mirrors addEditor in Auth.js. */
  addEditor(email: string, token: string): Promise<string[]>
  /** Removes an email from the editor tier. Admin only. Returns the full
   *  updated list. Mirrors removeEditor in Auth.js. */
  removeEditor(email: string, token: string): Promise<string[]>

  /* ---- editor sign-in (see Auth.js) ----
     The live app is ANYONE_ANONYMOUS, so Google never tells the server who a
     visitor is: an employee on EDITOR_EMAILS is indistinguishable from a
     stranger until they present a credential. Hence a login of the app's own. */

  /** Editor accounts with whether each can actually sign in yet — being on the
   *  editor list is only half of it. Never returns hashes. Admin only.
   *  Mirrors getEditorAccounts in Auth.js. */
  getEditorAccounts(token: string): Promise<EditorAccount[]>
  /** Sets an editor's 4-digit PIN. The employee must change it on first
   *  sign-in. Admin only. Mirrors setEditorPassword in Auth.js. */
  setEditorPassword(email: string, pin: string, token: string): Promise<{ ok: true }>
  /** Signs in with email + PIN (either the person's own, or the shared team
   *  PIN if enabled). Mirrors editorLogin in Auth.js. */
  editorLogin(email: string, pin: string): Promise<EditorSession>
  /** Whether a shared team PIN is configured; `reveal` also returns its value.
   *  The shared PIN is stored recoverably ON PURPOSE (its point is to be told
   *  to people); a PERSONAL PIN is one-way hashed and can never be read back.
   *  Admin only. Mirrors getSharedPinStatus in Auth.js. */
  getSharedPinStatus(token: string, reveal?: boolean): Promise<SharedPinStatus>
  /** Sets the optional shared team PIN. Admin only. */
  setSharedEditorPin(pin: string, token: string): Promise<{ ok: true }>
  /** Turns the shared team PIN off. Admin only. */
  clearSharedEditorPin(token: string): Promise<{ ok: true }>
  /** Editor or admin. Adds projectId to the recording's tag list (does not remove existing tags). Returns the full updated list. Works for either inbox pseudo-project's rows. */
  setFathomTag(id: string, projectId: ProjectId, token: string): Promise<ProjectId[]>
  /** Editor or admin. Removes just projectId from the recording's tag list, leaving other tags intact. Returns the full updated list. */
  untagFathomMeeting(id: string, projectId: ProjectId, token: string): Promise<ProjectId[]>
  /** Full-content search (title/dateLabel/attendees/whole body) — returns matching meeting ids. */
  searchMeetings(query: string, token: string): Promise<string[]>
  /** Creates a new tag-only project bucket at runtime (no Google Doc). Admin only. */
  createProject(name: string, nameEn: string, cadence: string, token: string): Promise<CreatedProject>
  /** Renames/edits any project, including the original 5. Admin only. */
  renameProject(projectId: ProjectId, patch: ProjectRenamePatch, token: string): Promise<Project>
  /** Every audit entry for one meeting id, newest first. Admin only. */
  getAuditHistory(targetId: string, token: string): Promise<AuditEntry[]>
  /** The oldest content snapshot for a meeting (or current content if never edited),
   *  plus the title/dateLabel/time captured with it. Admin only. */
  getOriginalContent(meetingId: string, token: string): Promise<VersionContent>
  /** One numbered version's full HTML plus the title/dateLabel/time captured with it. Admin only. */
  getVersionContent(meetingId: string, seq: string, token: string): Promise<VersionContent>
  /** Uploads a file (base64) and attaches it to a meeting. Editor or admin.
   *  Mirrors Code.js's addAttachment — same MIME allow-list, 25MB cap. */
  addAttachment(meetingId: string, fileName: string, mimeType: string, base64Data: string, token: string): Promise<Attachment[]>
  /** Removes one attachment by fileId. Editor or admin. Returns the remaining list. */
  removeAttachment(meetingId: string, fileId: string, token: string): Promise<Attachment[]>
  /** Posts a comment. Any signed-in staff who can see the meeting. Returns the updated list. */
  addComment(meetingId: string, text: string, token: string): Promise<Comment[]>
  /** Deletes one comment by id. Author or admin only. Returns the remaining list. */
  removeComment(meetingId: string, commentId: string, token: string): Promise<Comment[]>
}
