// Typed, stateful mock layer. Mirrors the GAS server contracts (Code.js / Auth.js)
// exactly — same function names, args, return shapes, and authorization rules — so
// the UI exercises real flows (pin, hide/show, save, delete, edit, project access)
// against an in-memory store. No Google services; representative sample content.
//
// Admin simulation: the live web app is ANYONE_ANONYMOUS, so isAdmin is only ever
// true when an admin email is in the Google session. Here that is simulated by the
// `?admin=1` URL flag (see resolveIdentity). This is a faithful entry hook, not an
// added feature — the GAS code already branches on isAdmin everywhere.

import type {
  CreatedProject, MeetingFull, MeetingListItem, Project, ProjectAccess, SaveEditResult,
  SaveMeetingInput, ServerApi, SessionState, SyncResult, ProjectId
} from '../types'
import { FATHOM_INBOX_ID } from '../types'
import {
  ADMIN_EMAIL, APP_DISPLAY_TITLE, APP_SUBTITLE, APP_TITLE, DOMAIN,
  SOURCE_PROJECTS, FATHOM_INBOX_PROJECT, makeSeedRows, type SeedRow, type SeedProject
} from './seed'

interface AccessRule { domain: boolean; emails: string[] }

// ---- identity (simulated Google session) ----
function resolveIdentity(): { email: string; isAdmin: boolean } {
  let admin = false
  try {
    const q = new URLSearchParams(window.location.search)
    admin = q.get('admin') === '1'
  } catch { /* ignore */ }
  return admin ? { email: ADMIN_EMAIL, isAdmin: true } : { email: '', isAdmin: false }
}

// ---- in-memory store ----
const rows: SeedRow[] = makeSeedRows()
const accessMap: Record<ProjectId, AccessRule> = {}
// Mirrors EXTRA_PROJECTS script property — projects created at runtime via
// createProject(). SOURCE_PROJECTS itself is never mutated (see getAllProjects_
// in Config.js), extras are purely additive.
const extraProjects: SeedProject[] = []
function allProjects(): SeedProject[] { return SOURCE_PROJECTS.concat(extraProjects) }
function getProjectById(id: ProjectId): SeedProject | undefined { return allProjects().find(p => p.id === id) }

const EMPLOYEE_VISIBLE_DEFAULT: Record<ProjectId, boolean> = { FIN: true, BD: true, BT12: true, BV: true, PN34: true }
function docVisibleDefault(projectId: ProjectId): boolean { return !!EMPLOYEE_VISIBLE_DEFAULT[projectId] }

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

function buildProjects(admin: boolean): Project[] {
  const counts: Record<string, number> = {}
  rows.filter(r => admin || isVisible(r)).forEach(r => {
    counts[r.projectId] = (counts[r.projectId] || 0) + 1
    ;(r.taggedProjectIds || []).forEach(pid => { counts[pid] = (counts[pid] || 0) + 1 })
  })
  const projects = allProjects().slice().sort((a, b) => a.order - b.order).map(d => ({
    id: d.id, name: d.name, nameEn: d.nameEn, cadence: d.cadence, color: d.color,
    count: counts[d.id] || 0, canSee: true,
    docUrl: admin ? 'https://docs.google.com/document/d/EXAMPLE_' + d.id + '/edit' : ''
  }))
  // Fathom Inbox is admin-only — mirrors the `if (admin)` gate in
  // getPublicBootstrap/getSessionState (Auth.js).
  if (admin) {
    projects.push({
      id: FATHOM_INBOX_PROJECT.id, name: FATHOM_INBOX_PROJECT.name, nameEn: FATHOM_INBOX_PROJECT.nameEn,
      cadence: FATHOM_INBOX_PROJECT.cadence, color: FATHOM_INBOX_PROJECT.color,
      count: counts[FATHOM_INBOX_PROJECT.id] || 0, canSee: true, docUrl: ''
    })
  }
  return projects
}

function requireAdmin(): void {
  if (!resolveIdentity().isAdmin) throw new Error('Not authorized.')
}

function toListItem(r: SeedRow, projectId: ProjectId, taggedFromInbox?: boolean): MeetingListItem {
  return {
    id: r.id, projectId, title: r.title, kind: r.kind,
    date: r.date, dateLabel: r.dateLabel, time: r.time,
    pinned: r.pinned, visible: r.visible, hasFathom: !!r.fathomUrl,
    source: r.source, attendeeCount: r.attendees.length, attendees: r.attendees.slice(), excerpt: r.excerpt,
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
    const r = accessMap[d.id] || { domain: docVisibleDefault(d.id), emails: [] }
    return { id: d.id, name: d.name, nameEn: d.nameEn, color: d.color, domain: !!r.domain, emails: r.emails.slice() }
  })
}
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export const mockApi: ServerApi = {
  async getSessionState(): Promise<SessionState> {
    const { email, isAdmin } = resolveIdentity()
    return {
      appTitle: APP_TITLE, appDisplayTitle: APP_DISPLAY_TITLE, subtitle: APP_SUBTITLE,
      authed: true, user: email, isAdmin,
      projects: buildProjects(isAdmin),
      dbUrl: isAdmin ? 'https://docs.google.com/spreadsheets/d/EXAMPLE_DB/edit' : '',
      execUrl: 'https://script.google.com/macros/s/EXAMPLE_DEPLOYMENT_ID/exec'
    }
  },

  async listMeetings(): Promise<MeetingListItem[]> {
    const { isAdmin } = resolveIdentity()
    return rows.filter(r => isAdmin || isVisible(r)).flatMap(toListItems)
  },

  async getMeeting(id: string): Promise<MeetingFull | null> {
    const { isAdmin } = resolveIdentity()
    const r = rows.find(x => x.id === id)
    if (!r) return null
    if (!isAdmin && !isVisible(r)) return null
    const proj = getProjectById(r.projectId)
    return {
      id: r.id, projectId: r.projectId, title: r.title, kind: r.kind,
      date: r.date, dateLabel: r.dateLabel, time: r.time,
      pinned: r.pinned, visible: r.visible, taggedProjectIds: (r.taggedProjectIds || []).slice(), fathomUrl: r.fathomUrl,
      source: r.source, attendees: r.attendees.slice(), html: r.content, css: '',
      docUrl: isAdmin && proj ? 'https://docs.google.com/document/d/EXAMPLE_' + proj.id + '/edit?tab=' + r.tabId : '',
      projectName: proj ? proj.name : r.projectId, updatedAt: '2026-06-21T03:00:00.000Z'
    }
  },

  async autoSync(): Promise<SyncResult> {
    const { isAdmin } = resolveIdentity()
    if (!isAdmin) return { ok: false, reason: 'anonymous' }
    return { ok: true, added: 0, updated: 0, skipped: rows.length, total: rows.length }
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
    requireAdmin()
    const html = obj.html || ''
    const excerpt = stripTags(html).slice(0, 200)
    const attendees = extractAttendees(html)
    const iso = parseDateLabel(obj.dateLabel || '')
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
      source: obj.source || 'manual', visible: !!obj.visible, pinned: false, content: html
    })
    return id
  },

  async deleteMeeting(id: string): Promise<boolean> {
    requireAdmin()
    const i = rows.findIndex(x => x.id === id)
    if (i === -1) return false
    rows.splice(i, 1); return true
  },

  async saveEdit(id: string, html: string, writeToDoc: boolean): Promise<SaveEditResult> {
    requireAdmin()
    const r = rows.find(x => x.id === id)
    if (!r) throw new Error('Meeting not found.')
    r.content = html
    r.excerpt = stripTags(html).slice(0, 200)
    r.attendees = extractAttendees(html)
    if (r.source === 'doc-import') r.source = 'doc-edited'
    const doc = { attempted: false, ok: false, msg: '' }
    if (writeToDoc && r.tabId) { doc.attempted = true; doc.ok = true }
    return { ok: true, doc }
  },

  async getProjectAccess(): Promise<ProjectAccess[]> { requireAdmin(); return accessList() },

  async setProjectDomain(projectId, allowDomain): Promise<ProjectAccess[]> {
    requireAdmin()
    const r = accessMap[projectId] || { domain: docVisibleDefault(projectId), emails: [] }
    r.domain = !!allowDomain; accessMap[projectId] = r; return accessList()
  },

  async addProjectViewer(projectId, email): Promise<ProjectAccess[]> {
    requireAdmin()
    const e = String(email || '').trim()
    if (!EMAIL_RE.test(e)) throw new Error('Please enter a valid email address.')
    const r = accessMap[projectId] || { domain: docVisibleDefault(projectId), emails: [] }
    if (!r.emails.some(x => x.toLowerCase() === e.toLowerCase())) r.emails.push(e)
    accessMap[projectId] = r; return accessList()
  },

  async removeProjectViewer(projectId, email): Promise<ProjectAccess[]> {
    requireAdmin()
    const r = accessMap[projectId]; if (!r) return accessList()
    r.emails = r.emails.filter(x => x.toLowerCase() !== String(email).toLowerCase())
    accessMap[projectId] = r; return accessList()
  },

  // Adds projectId to the recording's tag list (never removes existing tags,
  // never moves the row out of FATHOM_INBOX). Mirrors setFathomTag in Code.js.
  async setFathomTag(id, projectId): Promise<ProjectId[]> {
    requireAdmin()
    if (!getProjectById(projectId)) throw new Error('Unknown project: ' + projectId)
    const r = rows.find(x => x.id === id)
    if (!r) return []
    if (r.projectId !== FATHOM_INBOX_ID) throw new Error('Only Fathom Inbox recordings can be tagged.')
    const list = r.taggedProjectIds || []
    if (list.indexOf(projectId) === -1) list.push(projectId)
    r.taggedProjectIds = list
    return list.slice()
  },

  // Removes just projectId from the tag list, leaving any other tags intact.
  // Mirrors untagFathomMeeting in Code.js.
  async untagFathomMeeting(id, projectId): Promise<ProjectId[]> {
    requireAdmin()
    const r = rows.find(x => x.id === id)
    if (!r) return []
    r.taggedProjectIds = (r.taggedProjectIds || []).filter(p => p !== projectId)
    return r.taggedProjectIds.slice()
  },

  // Full-content search: listMeetings() only sends title/dateLabel/excerpt to
  // the client, so a name/term buried deeper in the body (or an attendee not
  // in the excerpt) never matched with the client-side filter alone. Mirrors
  // searchMeetings in Code.js — searches title/dateLabel/attendees/full content.
  async searchMeetings(query): Promise<string[]> {
    const q = String(query || '').trim().toLowerCase()
    if (!q) return []
    const { isAdmin } = resolveIdentity()
    const matches: string[] = []
    rows.filter(r => isAdmin || isVisible(r)).forEach(r => {
      let hay = (r.title + ' ' + (r.dateLabel || '') + ' ' + r.attendees.join(' ')).toLowerCase()
      if (hay.indexOf(q) === -1) hay += ' ' + stripTags(r.content).toLowerCase()
      if (hay.indexOf(q) !== -1) matches.push(r.id)
    })
    return matches
  },

  // Creates a new Doc-backed project at runtime — mirrors createProject in
  // Code.js. In the real app this makes an actual Google Doc; here it just
  // registers the project definition so the rest of the mock treats it
  // identically to the hardcoded 5 (see allProjects()).
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
    const docId = 'EXAMPLE_' + id

    extraProjects.push({ id, name: trimmedName, nameEn: trimmedNameEn, cadence: trimmedCadence, color, order })
    return {
      id, docId, name: trimmedName, nameEn: trimmedNameEn, cadence: trimmedCadence, color, order,
      docUrl: 'https://docs.google.com/document/d/' + docId + '/edit'
    }
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
