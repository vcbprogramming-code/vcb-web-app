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

/** listMeetings() row — the lightweight list shape. */
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
  excerpt: string
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
}
