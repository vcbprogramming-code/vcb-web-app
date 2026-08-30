// Typed, stateful mock layer. Mirrors the GAS server contracts (Code.js / Auth.js)
// exactly — same function names, args, return shapes, and authorization rules — so
// the UI exercises real flows (pin, hide/show, save, delete, edit, project access)
// against an in-memory store. No Google services; representative sample content.
//
// Admin simulation: the live web app is ANYONE_ANONYMOUS, so isAdmin is only ever
// true when an admin email is in the Google session. Here that is simulated by the
// `?admin=1` URL flag (see resolveIdentity). This is a faithful entry hook, not an
// added feature — the GAS code already branches on isAdmin everywhere.
//
// Editor simulation: mirrors the self-service EDITOR_EMAILS tier added to
// Auth.js — a `?editor=1` URL flag (or `?admin=1`, since admins can do
// everything an editor can) makes resolveIdentity().isEditor true.

import type {
  Attachment, AuditEntry, Comment, CreatedProject, MeetingFull, MeetingListItem, Project, ProjectAccess, SaveEditMeta, SaveEditResult,
  SaveMeetingInput, ServerApi, SessionState, ProjectId, VersionContent,
  EditorAccount, EditorSession, SharedPinStatus
} from '../types'
import { isInboxProject } from '../types'
import {
  ADMIN_EMAIL, EDITOR_EMAIL, APP_DISPLAY_TITLE, APP_SUBTITLE, APP_TITLE, DOMAIN,
  SOURCE_PROJECTS, FATHOM_INBOX_PROJECT, TRANSKRIPTOR_INBOX_PROJECT, makeSeedRows, type SeedRow, type SeedProject
} from './seed'

interface AccessRule { domain: boolean; emails: string[] }

// ---- identity (simulated Google session) ----
function resolveIdentity(): { email: string; isAdmin: boolean; isEditor: boolean } {
  let admin = false
  let editor = false
  try {
    const q = new URLSearchParams(window.location.search)
    admin = q.get('admin') === '1'
    editor = q.get('editor') === '1'
  } catch { /* ignore */ }
  if (admin) return { email: ADMIN_EMAIL, isAdmin: true, isEditor: true }
  if (editor) return { email: EDITOR_EMAIL, isAdmin: false, isEditor: true }
  return { email: '', isAdmin: false, isEditor: false }
}

// ---- in-memory store ----
const rows: SeedRow[] = makeSeedRows()
const accessMap: Record<ProjectId, AccessRule> = {}
// Mirrors EXTRA_PROJECTS script property — projects created at runtime via
// createProject(). SOURCE_PROJECTS itself is never mutated (see getAllProjects_
// in Config.js), extras are purely additive.
const extraProjects: SeedProject[] = []
// Mirrors PROJECT_OVERRIDES — renames/edits applied to ANY project (including
// the original 5) without mutating SOURCE_PROJECTS. See renameProject below.
const projectOverrides = new Map<ProjectId, Partial<SeedProject>>()
function allProjects(): SeedProject[] {
  return SOURCE_PROJECTS.concat(extraProjects).map(p => {
    const o = projectOverrides.get(p.id)
    return o ? { ...p, ...o } : p
  })
}
function getProjectById(id: ProjectId): SeedProject | undefined { return allProjects().find(p => p.id === id) }

// ---- audit log + version history (mirrors AUDIT_LOG / Versions sheets) ----
// Append-only in-memory history of content/permission-relevant mutations, and
// a parallel append-only snapshot store of pre-edit content — powers the
// Edit History panel (getAuditHistory) and its "View" / "View Original"
// preview (getVersionContent / getOriginalContent).
const auditLog: AuditEntry[] = []
function logAudit(action: string, targetType: string, targetId: string, details: Record<string, unknown> = {}): void {
  const { email } = resolveIdentity()
  auditLog.push({ when: new Date().toISOString(), who: email || '(anonymous)', action, targetType, targetId, details })
}
interface VersionSnapshot { meetingId: string; savedAt: string; seq: string; html: string; title: string; dateLabel: string; time: string }
const versions: VersionSnapshot[] = []
let versionSeqCounter = 0
// Snapshots the CURRENT content of a row (before it's overwritten) as a new
// version, AS WELL AS the title/dateLabel/time that were in effect at that
// moment (2026-07-22 schema change — previously only body HTML was
// versioned, so "View Original"/any past version always showed whatever
// title/date/time happened to be on the row RIGHT NOW, not what they
// actually were back then — confirmed bug: renaming a meeting made its own
// "Original" preview show the new name). Returns the seq so the caller's
// audit entry can reference it — mirrors saveContent_/snapshotVersion_ in
// Code.js. Skipped if there's nothing to snapshot yet (brand-new row with no
// content). `meta` must be the PRE-edit {title,dateLabel,time} — callers
// capture it from their own row object before overwriting it, same as
// preEditMeta in Code.js.
function snapshotVersion(meetingId: string, html: string, meta: { title: string; dateLabel: string; time: string }): string | null {
  if (!html) return null
  const seq = 'v' + (++versionSeqCounter)
  versions.push({ meetingId, savedAt: new Date().toISOString(), seq, html, title: meta.title, dateLabel: meta.dateLabel, time: meta.time })
  return seq
}

const EMPLOYEE_VISIBLE_DEFAULT: Record<ProjectId, boolean> = { FIN: true, BD: true, BT12: true, BV: true, PN34: true }
// Runtime lock/unlock overrides, mirroring PROJECT_PUBLIC in Config.js: a
// project with no entry here falls back to the static default above.
const publicOverrides: Record<string, boolean> = {}
function docVisibleDefault(projectId: ProjectId): boolean {
  if (Object.prototype.hasOwnProperty.call(publicOverrides, projectId)) return !!publicOverrides[projectId]
  return !!EMPLOYEE_VISIBLE_DEFAULT[projectId]
}
function setProjectPublicOverride(projectId: ProjectId, isPublic: boolean): void {
  publicOverrides[projectId] = !!isPublic
}

function isVisible(r: SeedRow): boolean { return r.visible }

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}
function extractAttendees(html: string): string[] {
  const out: string[] = []
  const re = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) { if (out.indexOf(m[0]) === -1) out.push(m[0]) }
  return out
}
function parseDateLabel(label: string): string {
  // Mirror of parseDateLabel_: accept dd/mm/yyyy(BE) or "dd <month> yyyy(BE)" → ISO.
  const s = String(label || '').trim()
  let mm = s.match(/(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})/)
  if (mm) {
    const d = +mm[1], mo = +mm[2]
    let y = +mm[3]; if (y > 2400) y -= 543
    if (d && mo >= 1 && mo <= 12) return y + '-' + pad2(mo) + '-' + pad2(d)
  }
  const THM = ['มกรา', 'กุมภา', 'มีนา', 'เมษา', 'พฤษภา', 'มิถุนา', 'กรกฎา', 'สิงหา', 'กันยา', 'ตุลา', 'พฤศจิกา', 'ธันวา']
  mm = s.match(/(\d{1,2})\s+(\S+)\s+(\d{4})/)
  if (mm) {
    const d = +mm[1]
    let y = +mm[3]; if (y > 2400) y -= 543
    const idx = THM.findIndex(t => mm![2].indexOf(t) === 0)
    if (idx >= 0 && d) return y + '-' + pad2(idx + 1) + '-' + pad2(d)
  }
  return ''
}
function pad2(n: number): string { return (n < 10 ? '0' : '') + n }
function uuid(): string {
  // Deterministic-enough id for the mock; crypto when available.
  try { return crypto.randomUUID() } catch { return 'm-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) }
}

function buildProjects(admin: boolean, editor: boolean): Project[] {
  const counts: Record<string, number> = {}
  rows.filter(r => admin || isVisible(r) || (editor && isInboxProject(r.projectId))).forEach(r => {
    counts[r.projectId] = (counts[r.projectId] || 0) + 1
    ;(r.taggedProjectIds || []).forEach(pid => { counts[pid] = (counts[pid] || 0) + 1 })
  })
  const projects = allProjects().slice().sort((a, b) => a.order - b.order).map(d => ({
    id: d.id, name: d.name, nameEn: d.nameEn, cadence: d.cadence, color: d.color,
    count: counts[d.id] || 0, canSee: true,
    docUrl: admin ? 'https://docs.google.com/document/d/EXAMPLE_' + d.id + '/edit' : ''
  }))
  // Fathom Inbox and Transkriptor Inbox are admin/editor-only — mirrors the
  // `if (editor)` gate in getPublicBootstrap/getSessionState (Auth.js).
  // Editors need this to reach recordings they can file into projects.
  if (editor) {
    ;[FATHOM_INBOX_PROJECT, TRANSKRIPTOR_INBOX_PROJECT].forEach(inbox => {
      projects.push({
        id: inbox.id, name: inbox.name, nameEn: inbox.nameEn,
        cadence: inbox.cadence, color: inbox.color,
        count: counts[inbox.id] || 0, canSee: true, docUrl: ''
      })
    })
  }
  return projects
}

function requireAdmin(): void {
  if (!resolveIdentity().isAdmin) throw new Error('Not authorized.')
}

// Mirrors EDITOR_EMAILS (Script Property, Auth.js) — a self-service list an
// admin manages from Settings → Project access → Editors, no redeploy. The
// simulated `?editor=1` identity is independent of this list (see
// resolveIdentity); this store only backs the getEditors/addEditor/
// removeEditor management calls themselves.
const editorEmails: string[] = []

// Editor sign-in state. See the editorLogin block below for why these hold
// plain values where the live app stores salted hashes.
const PIN_RE = /^[0-9]{4}$/
const EDITOR_LOCK_TRIES = 5      // matches EDITOR_LOCK_TRIES in Auth.js
interface EditorPin { pin: string; mustChange: boolean; setAt: string }
const editorPins: Record<string, EditorPin> = {}
const editorFails: Record<string, number> = {}
const sharedPin: { pin: string; setAt: string } = { pin: '', setAt: '' }

function requireEditorOrAdmin(): void {
  const { isAdmin, isEditor } = resolveIdentity()
  if (!isAdmin && !isEditor) throw new Error('Not authorized.')
}

// Mirrors ATTACHMENT_ALLOWED_MIME / ATTACHMENT_MAX_BYTES in Code.js verbatim.
const ATTACHMENT_ALLOWED_MIME = /^(application\/pdf|application\/vnd\.openxmlformats-officedocument\.|application\/vnd\.ms-(excel|powerpoint)|application\/msword|image\/(png|jpe?g|gif|webp)|text\/(plain|csv))/i
const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024 // 25MB per file
const COMMENT_MAX_CHARS = 4000

function toListItem(r: SeedRow, projectId: ProjectId, taggedFromInbox?: boolean): MeetingListItem {
  return {
    id: r.id, projectId, title: r.title, kind: r.kind,
    date: r.date, dateLabel: r.dateLabel, time: r.time,
    pinned: r.pinned, visible: r.visible, hasFathom: !!r.fathomUrl,
    source: r.source, attendeeCount: r.attendees.length, attendees: r.attendees.slice(), excerpt: r.excerpt,
    attachmentCount: (r.attachments || []).length,
    ...(taggedFromInbox ? { taggedFromInbox: true } : {})
  }
}

// A Fathom row always stays listed under FATHOM_INBOX (the row never moves)
// and ADDITIONALLY appears under every project it's tagged into — same id in
// each place. Mirrors listMeetings() in Code.js.
function toListItems(r: SeedRow): MeetingListItem[] {
  const out = [toListItem(r, r.projectId)]
  ;(r.taggedProjectIds || []).forEach(pid => out.push(toListItem(r, pid, true)))
  return out
}

function accessList(): ProjectAccess[] {
  return allProjects().slice().sort((a, b) => a.order - b.order).map(d => {
    // No fallback to docVisibleDefault for `domain`: a project being public
    // says nothing about whether all staff are allow-listed on it.
    const r = accessMap[d.id] || { domain: false, emails: [] }
    return {
      id: d.id, name: d.name, nameEn: d.nameEn, color: d.color,
      domain: !!r.domain, emails: r.emails.slice(), isPublic: docVisibleDefault(d.id),
    }
  })
}
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export const mockApi: ServerApi = {
  async getSessionState(): Promise<SessionState> {
    const { email, isAdmin, isEditor } = resolveIdentity()
    return {
      appTitle: APP_TITLE, appDisplayTitle: APP_DISPLAY_TITLE, subtitle: APP_SUBTITLE,
      authed: true, user: email, isAdmin, isEditor,
      projects: buildProjects(isAdmin, isEditor),
      dbUrl: isAdmin ? 'https://docs.google.com/spreadsheets/d/EXAMPLE_DB/edit' : '',
      execUrl: 'https://script.google.com/macros/s/EXAMPLE_DEPLOYMENT_ID/exec'
    }
  },

  async listMeetings(): Promise<MeetingListItem[]> {
    const { isAdmin, isEditor } = resolveIdentity()
    return rows.filter(r => isAdmin || isVisible(r) || (isEditor && isInboxProject(r.projectId))).flatMap(toListItems)
  },

  async getMeeting(id: string): Promise<MeetingFull | null> {
    const { isAdmin, isEditor } = resolveIdentity()
    const r = rows.find(x => x.id === id)
    if (!r) return null
    // Hidden meetings stay admin-only; inbox rows (always non-visible) are
    // also reachable by editors, who need to open them to file/edit.
    if (!isAdmin && !isVisible(r) && !(isEditor && isInboxProject(r.projectId))) return null
    const proj = getProjectById(r.projectId)
    return {
      id: r.id, projectId: r.projectId, title: r.title, kind: r.kind,
      date: r.date, dateLabel: r.dateLabel, time: r.time,
      pinned: r.pinned, visible: r.visible, taggedProjectIds: (r.taggedProjectIds || []).slice(), fathomUrl: r.fathomUrl,
      source: r.source, attendees: r.attendees.slice(), html: r.content, css: '',
      docUrl: isAdmin && proj ? 'https://docs.google.com/document/d/EXAMPLE_' + proj.id + '/edit?tab=' + r.tabId : '',
      projectName: proj ? proj.name : r.projectId,
      createdAt: r.createdAt || '2026-06-21T03:00:00.000Z', updatedAt: '2026-06-21T03:00:00.000Z',
      attachments: (r.attachments || []).slice(),
      comments: (r.comments || []).slice()
    }
  },

  async togglePin(id: string): Promise<boolean> {
    requireAdmin()
    const r = rows.find(x => x.id === id); if (!r) return false
    r.pinned = !r.pinned; return r.pinned
  },

  async setVisibility(id: string, visible: boolean): Promise<boolean> {
    requireAdmin()
    const r = rows.find(x => x.id === id); if (!r) return false
    r.visible = !!visible; return r.visible
  },

  async saveMeeting(obj: SaveMeetingInput): Promise<string> {
    requireEditorOrAdmin()
    const html = obj.html || ''
    const excerpt = stripTags(html).slice(0, 200)
    const attendees = extractAttendees(html)
    const iso = parseDateLabel(obj.dateLabel || '')
    const now = new Date().toISOString()
    if (obj.id) {
      const r = rows.find(x => x.id === obj.id)
      if (r) {
        r.projectId = obj.projectId || r.projectId
        r.date = iso || r.date
        r.dateLabel = obj.dateLabel || r.dateLabel
        r.time = obj.time || r.time
        r.title = obj.title || r.title
        r.excerpt = excerpt
        r.fathomUrl = obj.fathomUrl || r.fathomUrl
        r.attendees = attendees
        r.source = r.source === 'doc-import' ? 'doc-import' : (obj.source || r.source || 'manual')
        r.content = html
        return r.id
      }
    }
    const id = uuid()
    rows.push({
      id, projectId: obj.projectId, meetingKey: 'manual-' + Date.now(), date: iso,
      dateLabel: obj.dateLabel || '', time: obj.time || '', title: obj.title || 'Untitled meeting',
      kind: 'meeting', excerpt, fathomUrl: obj.fathomUrl || '', attendees, tabId: '',
      source: obj.source || 'manual', visible: !!obj.visible, pinned: false, content: html,
      createdAt: now
    })
    logAudit('create_meeting', 'meeting', id, { title: obj.title, projectId: obj.projectId })
    return id
  },

  // Deleting an inbox-sourced (fathom/transkriptor) meeting doesn't tell the
  // source API anything server-side (see PROP_DELETED_INBOX_KEYS in
  // Config.js) — the mock has no polling backfill to re-suppress, so there's
  // nothing to mirror here beyond the row removal + audit entry.
  async deleteMeeting(id: string): Promise<boolean> {
    requireEditorOrAdmin()
    const i = rows.findIndex(x => x.id === id)
    if (i === -1) return false
    const r = rows[i]
    logAudit('delete_meeting', 'meeting', id, { title: r.title, projectId: r.projectId })
    rows.splice(i, 1); return true
  },

  // meta (optional): { title, dateLabel, time } — lets the same content editor
  // also fix a mis-set title/date/time in one save. Mirrors saveEdit in Code.js.
  async saveEdit(id: string, html: string, _token: string, meta?: SaveEditMeta): Promise<SaveEditResult> {
    requireEditorOrAdmin()
    const r = rows.find(x => x.id === id)
    if (!r) throw new Error('Meeting not found.')
    // Capture title/dateLabel/time BEFORE they're overwritten below — the
    // snapshot must reflect what the meeting looked like right before this
    // edit, not the just-written new values (mirrors preEditMeta in Code.js).
    const versionSeq = snapshotVersion(id, r.content, { title: r.title, dateLabel: r.dateLabel, time: r.time })
    r.content = html
    r.excerpt = stripTags(html).slice(0, 200)
    r.attendees = extractAttendees(html)
    if (r.source === 'doc-import') r.source = 'doc-edited'
    if (meta) {
      if (meta.title) r.title = meta.title
      if (meta.dateLabel) {
        r.dateLabel = meta.dateLabel
        const iso = parseDateLabel(meta.dateLabel)
        if (iso) r.date = iso
      }
      if (meta.time != null) r.time = meta.time
    }
    logAudit('edit_content', 'meeting', id, { title: r.title, versionSeq })
    return { ok: true }
  },

  async getProjectAccess(): Promise<ProjectAccess[]> { requireAdmin(); return accessList() },

  async setProjectDomain(projectId, allowDomain): Promise<ProjectAccess[]> {
    requireAdmin()
    const r = accessMap[projectId] || { domain: false, emails: [] }
    r.domain = !!allowDomain; accessMap[projectId] = r; return accessList()
  },

  // Lock/unlock. Unlocking publishes every meeting already in the project;
  // locking only stops the future default, matching setProjectPublic in Auth.js.
  async setProjectPublic(projectId, isPublic): Promise<ProjectAccess[]> {
    requireAdmin()
    setProjectPublicOverride(projectId, isPublic)
    if (isPublic) rows.forEach(r => { if (r.projectId === projectId) r.visible = true })
    return accessList()
  },

  async addProjectViewer(projectId, email): Promise<ProjectAccess[]> {
    requireAdmin()
    const e = String(email || '').trim()
    if (!EMAIL_RE.test(e)) throw new Error('Please enter a valid email address.')
    const r = accessMap[projectId] || { domain: docVisibleDefault(projectId), emails: [] }
    if (!r.emails.some(x => x.toLowerCase() === e.toLowerCase())) r.emails.push(e)
    accessMap[projectId] = r; return accessList()
  },

  // Add several at once from a pasted list. The whole batch is rejected if
  // any entry is malformed, so a typo is reported rather than half-saved.
  async addProjectViewers(projectId, emailsText): Promise<ProjectAccess[]> {
    requireAdmin()
    const parts = String(emailsText || '').split(/[\s,;]+/).filter(Boolean)
    if (!parts.length) throw new Error('Enter at least one email address.')
    const bad = parts.filter(e => !EMAIL_RE.test(e))
    if (bad.length) throw new Error('Not a valid email address: ' + bad.join(', '))
    const r = accessMap[projectId] || { domain: false, emails: [] }
    parts.forEach(e => {
      if (!r.emails.some(x => x.toLowerCase() === e.toLowerCase())) r.emails.push(e)
    })
    accessMap[projectId] = r; return accessList()
  },

  async removeProjectViewer(projectId, email): Promise<ProjectAccess[]> {
    requireAdmin()
    const r = accessMap[projectId]; if (!r) return accessList()
    r.emails = r.emails.filter(x => x.toLowerCase() !== String(email).toLowerCase())
    accessMap[projectId] = r; return accessList()
  },

  // Copy one guest list onto other locked projects. A public target is
  // skipped: a guest list on it would control nothing.
  async copyProjectViewers(fromProjectId, toProjectIds): Promise<ProjectAccess[]> {
    requireAdmin()
    const src = accessMap[fromProjectId]?.emails || []
    if (!src.length) throw new Error('That project has no named people to copy.')
    ;(toProjectIds || []).forEach(pid => {
      if (pid === fromProjectId || docVisibleDefault(pid)) return
      const r = accessMap[pid] || { domain: false, emails: [] }
      src.forEach(e => {
        if (!r.emails.some(x => x.toLowerCase() === e.toLowerCase())) r.emails.push(e)
      })
      accessMap[pid] = r
    })
    return accessList()
  },

  // Mirrors getEditors/addEditor/removeEditor in Auth.js.
  async getEditors(): Promise<string[]> { requireAdmin(); return editorEmails.slice() },

  async addEditor(email): Promise<string[]> {
    requireAdmin()
    const e = String(email || '').trim()
    if (!EMAIL_RE.test(e)) throw new Error('Please enter a valid email address.')
    if (!editorEmails.some(x => x.toLowerCase() === e.toLowerCase())) editorEmails.push(e)
    return editorEmails.slice()
  },

  async removeEditor(email): Promise<string[]> {
    requireAdmin()
    const idx = editorEmails.findIndex(x => x.toLowerCase() === String(email).toLowerCase())
    if (idx !== -1) editorEmails.splice(idx, 1)
    return editorEmails.slice()
  },

  /* ---- editor sign-in. Mirrors Auth.js ----
     The PINs here are stored in plain memory, unlike the live app which salts
     and iteratively hashes them: this is a throwaway in-memory mock with no
     persistence and no real secrets, and reproducing the hashing would only
     obscure the AUTHORIZATION rules this mock exists to exercise. The rules
     themselves are mirrored exactly — 4 digits, allow-list re-checked at
     login, lockout after 5 failures, shared PIN is not a skeleton key. */

  async getEditorAccounts(): Promise<EditorAccount[]> {
    requireAdmin()
    return editorEmails.map(e => {
      const c = editorPins[e.toLowerCase()]
      return { email: e, hasPassword: !!c, mustChange: !!(c && c.mustChange), setAt: c ? c.setAt : '' }
    })
  },

  async setEditorPassword(email, pin): Promise<{ ok: true }> {
    requireAdmin()
    const e = String(email || '').trim().toLowerCase()
    if (!EMAIL_RE.test(e)) throw new Error('Please enter a valid email address.')
    if (!PIN_RE.test(String(pin || '').trim())) throw new Error('PIN must be exactly 4 digits (0-9).')
    // An account only exists for someone already on the list, so the two
    // cannot drift apart.
    if (!editorEmails.some(x => x.toLowerCase() === e)) throw new Error('Add this email as an editor first.')
    editorPins[e] = { pin: String(pin).trim(), mustChange: true, setAt: new Date().toISOString() }
    delete editorFails[e]
    return { ok: true }
  },

  async editorLogin(email, pin): Promise<EditorSession> {
    const e = String(email || '').trim().toLowerCase()
    const given = String(pin || '').trim()
    if ((editorFails[e] || 0) >= EDITOR_LOCK_TRIES) {
      throw new Error('Too many failed attempts. Try again in 15 minutes, or ask an admin to reset your password.')
    }
    const own = editorPins[e]
    let ok = !!(own && own.pin === given)
    let usedShared = false
    // The SHARED team PIN: a convenience so one number can be given to several
    // trusted people. Still requires the email to be on the list, so it is not
    // a skeleton key.
    if (!ok && sharedPin.pin && given === sharedPin.pin) { ok = true; usedShared = true }
    // Re-checked at login, not just when set: an admin may have removed them.
    if (ok && !editorEmails.some(x => x.toLowerCase() === e)) {
      throw new Error('This email no longer has edit access.')
    }
    if (!ok) {
      editorFails[e] = (editorFails[e] || 0) + 1
      throw new Error('Incorrect email or password.')
    }
    delete editorFails[e]
    return {
      token: 'mock-editor-token', user: e,
      isAdmin: false, isEditor: true,
      // Never force a change on the shared PIN — it would lock out everyone
      // else holding it.
      mustChange: !usedShared && !!(own && own.mustChange),
      usedSharedPin: usedShared
    }
  },

  async getSharedPinStatus(_token, reveal): Promise<SharedPinStatus> {
    requireAdmin()
    const out: SharedPinStatus = { enabled: !!sharedPin.pin, setAt: sharedPin.setAt }
    // Only ever returned when explicitly asked for, so it is not sitting in
    // every payload. Recoverable by design — see the type doc.
    if (reveal) out.pin = sharedPin.pin
    return out
  },

  async setSharedEditorPin(pin): Promise<{ ok: true }> {
    requireAdmin()
    if (!PIN_RE.test(String(pin || '').trim())) throw new Error('PIN must be exactly 4 digits (0-9).')
    sharedPin.pin = String(pin).trim()
    sharedPin.setAt = new Date().toISOString()
    return { ok: true }
  },

  async clearSharedEditorPin(): Promise<{ ok: true }> {
    requireAdmin()
    sharedPin.pin = ''
    sharedPin.setAt = ''
    return { ok: true }
  },

  // Adds projectId to the recording's tag list (never removes existing tags,
  // never moves the row out of its inbox). Accepts rows from EITHER inbox
  // (Fathom or Transkriptor) — mirrors the generalized setFathomTag in
  // Code.js, which checks projectId !== FATHOM_INBOX_ID &&
  // projectId !== TRANSKRIPTOR_INBOX_ID rather than Fathom-only.
  async setFathomTag(id, projectId): Promise<ProjectId[]> {
    requireEditorOrAdmin()
    if (!getProjectById(projectId)) throw new Error('Unknown project: ' + projectId)
    const r = rows.find(x => x.id === id)
    if (!r) return []
    if (!isInboxProject(r.projectId)) throw new Error('Only inbox recordings can be tagged.')
    const list = r.taggedProjectIds || []
    if (list.indexOf(projectId) === -1) list.push(projectId)
    r.taggedProjectIds = list
    logAudit('tag', 'meeting', id, { projectId })
    return list.slice()
  },

  // Removes just projectId from the tag list, leaving any other tags intact.
  // Mirrors untagFathomMeeting in Code.js.
  async untagFathomMeeting(id, projectId): Promise<ProjectId[]> {
    requireEditorOrAdmin()
    const r = rows.find(x => x.id === id)
    if (!r) return []
    r.taggedProjectIds = (r.taggedProjectIds || []).filter(p => p !== projectId)
    logAudit('untag', 'meeting', id, { projectId })
    return r.taggedProjectIds.slice()
  },

  // Full-content search: listMeetings() only sends title/dateLabel/excerpt to
  // the client, so a name/term buried deeper in the body (or an attendee not
  // in the excerpt) never matched with the client-side filter alone. Mirrors
  // searchMeetings in Code.js — searches title/dateLabel/attendees/full content.
  async searchMeetings(query): Promise<string[]> {
    const q = String(query || '').trim().toLowerCase()
    if (!q) return []
    const { isAdmin, isEditor } = resolveIdentity()
    const matches: string[] = []
    rows.filter(r => isAdmin || isVisible(r) || (isEditor && isInboxProject(r.projectId))).forEach(r => {
      let hay = (r.title + ' ' + (r.dateLabel || '') + ' ' + r.attendees.join(' ')).toLowerCase()
      if (hay.indexOf(q) === -1) hay += ' ' + stripTags(r.content).toLowerCase()
      if (hay.indexOf(q) !== -1) matches.push(r.id)
    })
    return matches
  },

  // Creates a new project as a lightweight TAG-ONLY bucket — no Google Doc.
  // Mirrors createProject in Code.js. An earlier version of both the mock and
  // the real GAS function always created a Doc (matching how the original 5
  // projects work); that was wrong for this use case — an admin using "+ New
  // project" purely as a Fathom tag bucket got a surprise Doc they never
  // wanted (found 2026-07-19). Do not reintroduce Doc creation without a
  // deliberate opt-in.
  async createProject(name, nameEn, cadence): Promise<CreatedProject> {
    requireAdmin()
    const trimmedName = String(name || '').trim()
    if (!trimmedName) throw new Error('Project name is required.')
    const trimmedNameEn = String(nameEn || '').trim()
    const trimmedCadence = String(cadence || 'Monthly').trim() || 'Monthly'

    const id = slugifyProjectId(trimmedNameEn || trimmedName, allProjects())
    const palette = ['#0969da', '#8250df', '#1a7f37', '#9a6700', '#cf222e', '#0b3d62', '#6639ba', '#116329']
    const color = palette[allProjects().length % palette.length]
    const order = allProjects().reduce((max, p) => Math.max(max, p.order || 0), 0) + 1

    extraProjects.push({ id, name: trimmedName, nameEn: trimmedNameEn, cadence: trimmedCadence, color, order })
    logAudit('create_project', 'project', id, { name: trimmedName })
    return { id, docId: '', name: trimmedName, nameEn: trimmedNameEn, cadence: trimmedCadence, color, order, docUrl: '' }
  },

  // Renames/edits a project — works for ANY project, including the original
  // hardcoded 5, via a PROJECT_OVERRIDES-style patch layered over the base
  // definition. Mirrors renameProject in Code.js.
  async renameProject(projectId, patch): Promise<Project> {
    requireAdmin()
    if (!getProjectById(projectId)) throw new Error('Unknown project: ' + projectId)
    const clean: Partial<SeedProject> = {}
    if (patch && typeof patch.name === 'string' && patch.name.trim()) clean.name = patch.name.trim()
    if (patch && typeof patch.nameEn === 'string') clean.nameEn = patch.nameEn.trim()
    if (patch && typeof patch.cadence === 'string' && patch.cadence.trim()) clean.cadence = patch.cadence.trim()
    if (patch && typeof patch.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(patch.color)) clean.color = patch.color
    const overrides = projectOverrides.get(projectId) || {}
    projectOverrides.set(projectId, { ...overrides, ...clean })
    const updated = getProjectById(projectId)!
    logAudit('rename_project', 'project', projectId, clean)
    return { id: updated.id, name: updated.name, nameEn: updated.nameEn, cadence: updated.cadence, color: updated.color, count: 0, canSee: true }
  },

  // Every audit entry for one meeting id, newest first. Mirrors getAuditHistory in Code.js.
  async getAuditHistory(targetId): Promise<AuditEntry[]> {
    requireAdmin()
    return auditLog.filter(e => e.targetId === targetId).slice().reverse()
  },

  // Always-available "View Original" — the oldest snapshot for this meeting,
  // or the current live content if no snapshot exists yet (never edited since
  // this feature shipped — current IS the original). Returns
  // { html, title, dateLabel, time } — title/dateLabel/time are '' for a
  // version snapshotted before the 2026-07-22 metadata-capture fix; the
  // caller falls back to the live meeting's current values only in that
  // case. Mirrors getOriginalContent in Code.js.
  async getOriginalContent(meetingId): Promise<VersionContent> {
    requireAdmin()
    const mine = versions.filter(v => v.meetingId === meetingId)
    if (mine.length) {
      const oldest = mine.reduce((min, v) => v.savedAt < min.savedAt ? v : min, mine[0])
      return { html: oldest.html, title: oldest.title, dateLabel: oldest.dateLabel, time: oldest.time }
    }
    const r = rows.find(x => x.id === meetingId)
    return r ? { html: r.content, title: r.title, dateLabel: r.dateLabel, time: r.time } : { html: '', title: '', dateLabel: '', time: '' }
  },

  // Fetches one version's full HTML plus the title/dateLabel/time captured
  // with it — either a numbered snapshot (seq) or the live current content/
  // row ('current'). Mirrors getVersionContent in Code.js.
  async getVersionContent(meetingId, seq): Promise<VersionContent> {
    requireAdmin()
    if (seq === 'current' || seq == null) {
      const r = rows.find(x => x.id === meetingId)
      return r ? { html: r.content, title: r.title, dateLabel: r.dateLabel, time: r.time } : { html: '', title: '', dateLabel: '', time: '' }
    }
    const hit = versions.find(v => v.meetingId === meetingId && v.seq === seq)
    return hit ? { html: hit.html, title: hit.title, dateLabel: hit.dateLabel, time: hit.time } : { html: '', title: '', dateLabel: '', time: '' }
  },

  // Mirrors addAttachment in Code.js: same MIME allow-list and 25MB cap. The
  // real app uploads to Drive and shares the file link; the mock has no file
  // host, so it keeps the upload as a data: URL instead — good enough to
  // actually open/download in the browser, which is all the UI needs to prove.
  async addAttachment(meetingId, fileName, mimeType, base64Data): Promise<Attachment[]> {
    requireEditorOrAdmin()
    const r = rows.find(x => x.id === meetingId)
    if (!r) throw new Error('Meeting not found.')
    if (!ATTACHMENT_ALLOWED_MIME.test(mimeType || '')) {
      throw new Error('File type not allowed. Supported: PDF, Word, Excel, PowerPoint, images, text/CSV.')
    }
    const sizeBytes = Math.ceil((base64Data.length * 3) / 4)
    if (sizeBytes > ATTACHMENT_MAX_BYTES) throw new Error('File is too large (max 25MB).')
    const { email } = resolveIdentity()
    const att: Attachment = {
      fileId: uuid(), name: fileName, mimeType, size: sizeBytes,
      uploadedAt: new Date().toISOString(), uploadedBy: email || '(anonymous)',
      url: 'data:' + (mimeType || 'application/octet-stream') + ';base64,' + base64Data
    }
    r.attachments = [...(r.attachments || []), att]
    logAudit('add_attachment', 'meeting', meetingId, { name: fileName })
    return r.attachments.slice()
  },

  async removeAttachment(meetingId, fileId): Promise<Attachment[]> {
    requireEditorOrAdmin()
    const r = rows.find(x => x.id === meetingId)
    if (!r) throw new Error('Meeting not found.')
    const target = (r.attachments || []).find(a => a.fileId === fileId)
    r.attachments = (r.attachments || []).filter(a => a.fileId !== fileId)
    logAudit('remove_attachment', 'meeting', meetingId, { name: target ? target.name : fileId })
    return r.attachments.slice()
  },

  // Mirrors addComment/removeComment in Code.js: any signed-in staff who can
  // see the meeting may post; author or admin may delete their own.
  async addComment(meetingId, text): Promise<Comment[]> {
    const { email, isAdmin } = resolveIdentity()
    if (!email && !isAdmin) throw new Error('Not signed in.')
    const trimmed = text.trim()
    if (!trimmed) throw new Error('Comment is empty.')
    if (trimmed.length > COMMENT_MAX_CHARS) throw new Error('Comment is too long (max ' + COMMENT_MAX_CHARS + ' characters).')
    const r = rows.find(x => x.id === meetingId)
    if (!r) throw new Error('Meeting not found.')
    if (!isAdmin && !isVisible(r)) throw new Error('Not authorized.')
    const comment: Comment = { id: uuid(), author: email || ADMIN_EMAIL, text: trimmed, createdAt: new Date().toISOString() }
    r.comments = [...(r.comments || []), comment]
    logAudit('add_comment', 'meeting', meetingId, { commentId: comment.id })
    return r.comments.slice()
  },

  async removeComment(meetingId, commentId): Promise<Comment[]> {
    const { email, isAdmin } = resolveIdentity()
    if (!email && !isAdmin) throw new Error('Not signed in.')
    const r = rows.find(x => x.id === meetingId)
    if (!r) throw new Error('Meeting not found.')
    const target = (r.comments || []).find(c => c.id === commentId)
    if (!target) throw new Error('Comment not found.')
    if (target.author !== email && !isAdmin) throw new Error('Not authorized.')
    r.comments = (r.comments || []).filter(c => c.id !== commentId)
    logAudit('remove_comment', 'meeting', meetingId, { commentId })
    return r.comments.slice()
  }
}

// Mirrors slugifyProjectId_ in Code.js: derives a short id from the English
// name (falls back to the given name if no English name), same style as the
// hardcoded ids (FIN, BT12, ...), with a numeric-suffix fallback on collision.
function slugifyProjectId(name: string, existingProjects: SeedProject[]): ProjectId {
  const ascii = name.replace(/[^\x00-\x7F]/g, '')
  const words = ascii.split(/[\s\-_]+/).filter(Boolean)
  let base = (words.length > 1 ? words.map(w => w[0]).join('') : ascii.slice(0, 4)).toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!base) base = 'PROJ'
  const existingIds = new Set(existingProjects.map(p => p.id))
  if (!existingIds.has(base)) return base
  let n = 2
  while (existingIds.has(base + n)) n++
  return base + n
}

// Unused param kept for signature parity with the GAS DOMAIN-based rules.
void DOMAIN
