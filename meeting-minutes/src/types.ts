// Typed mirror of the Google Apps Script API shapes.
// Source of truth: Code.js (getBootstrap/listMeetings/getMeeting/saveMeeting/…)
// and Auth.js (getSessionState/getProjectAccess/…). Field names + value
// conventions match the GAS returns verbatim.

export type Lang = 'en' | 'th'
export type Theme = 'light' | 'dark'

export type ProjectId = string
export type MeetingKind = 'meeting' | 'overview'
export type MeetingSource = 'doc-import' | 'doc-edited' | 'manual' | 'fathom'

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
export interface SessionState {
  appTitle: string
  appDisplayTitle: string
  subtitle: string
  authed: boolean
  user: string
  isAdmin: boolean
  projects: Project[]
  dbUrl?: string
  execUrl: string
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
  updatedAt: string
}

/** autoSync() result. */
export interface SyncResult {
  ok: boolean
  added?: number
  updated?: number
  skipped?: number
  total?: number
  reason?: string
  error?: string
}

/** saveEdit() result. */
export interface SaveEditResult {
  ok: boolean
  doc: { attempted: boolean; ok: boolean; msg: string }
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

/** createProject() result. */
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

/** The set of server functions callable through the gs() bridge. */
export interface ServerApi {
  getSessionState(token: string): Promise<SessionState>
  listMeetings(token: string): Promise<MeetingListItem[]>
  getMeeting(id: string, token: string): Promise<MeetingFull | null>
  autoSync(token: string): Promise<SyncResult>
  togglePin(id: string, token: string): Promise<boolean>
  setVisibility(id: string, visible: boolean, token: string): Promise<boolean>
  saveMeeting(obj: SaveMeetingInput, token: string): Promise<string>
  deleteMeeting(id: string, token: string): Promise<boolean>
  saveEdit(id: string, html: string, writeToDoc: boolean, token: string): Promise<SaveEditResult>
  getProjectAccess(token: string): Promise<ProjectAccess[]>
  setProjectDomain(projectId: ProjectId, allowDomain: boolean, token: string): Promise<ProjectAccess[]>
  addProjectViewer(projectId: ProjectId, email: string, token: string): Promise<ProjectAccess[]>
  removeProjectViewer(projectId: ProjectId, email: string, token: string): Promise<ProjectAccess[]>
  /** Adds projectId to the recording's tag list (does not remove existing tags). Returns the full updated list. */
  setFathomTag(id: string, projectId: ProjectId, token: string): Promise<ProjectId[]>
  /** Removes just projectId from the recording's tag list, leaving other tags intact. Returns the full updated list. */
  untagFathomMeeting(id: string, projectId: ProjectId, token: string): Promise<ProjectId[]>
  /** Full-content search (title/dateLabel/attendees/whole body) — returns matching meeting ids. */
  searchMeetings(query: string, token: string): Promise<string[]>
  /** Creates a new Doc-backed project at runtime. Admin only. */
  createProject(name: string, nameEn: string, cadence: string, token: string): Promise<CreatedProject>
}
