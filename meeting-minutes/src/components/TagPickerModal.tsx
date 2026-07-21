import type { MeetingFull, Project } from '../types'
import { isInboxProject } from '../types'
import { api, getToken } from '../api/client'

interface Props {
  open: boolean
  meeting: MeetingFull | null
  projects: Project[]
  onClose: () => void
  onTagged: (projectId: string) => void
  onBusy: (msg: string | null) => void
  onToast: (msg: string) => void
}

// Generic English words that show up as tokens from nameEn (e.g. "Financial
// Review", "Business Development") but are common enough in ANY business
// transcript that matching them says little about which project it's
// actually about. Weighted far below strong signals (id, full Thai name) so
// e.g. "Financial" alone can't outscore a project whose id/name is mentioned
// directly — this is what caused an ERP/PO/PR meeting to wrongly suggest FIN.
const WEAK_SUGGEST_WORDS = new Set([
  'all', 'project', 'review', 'section', 'sections', 'business', 'development',
  'monthly', 'quarterly', 'meeting', 'overview', 'financial', 'highway'
])

function stripHtml(html: string): string {
  const d = document.createElement('div')
  d.innerHTML = html
  return d.textContent || ''
}

// Scores how well a project's own name/id keywords appear in the meeting's
// title + content — a suggestion only, never auto-picked, since project
// content can be sensitive and the admin must always choose explicitly (the
// tagging design: recordings never move/auto-assign on their own). Mirrors
// suggestProjectFor_ in JavaScript.html.
function suggestProjectFor(m: MeetingFull, projects: Project[]): Project | null {
  const text = (m.title + ' ' + stripHtml(m.html || '')).toLowerCase()
  let best: Project | null = null
  let bestScore = 0
  projects.forEach(p => {
    let score = 0
    // Strong signals: the project's own id, its short alias in parentheses in
    // nameEn (e.g. "Bang Toey Sections 1+2 (BT)" -> "BT" — the real shorthand
    // Fathom titles actually use), and its full name/nameEn as a whole phrase.
    if (p.id && p.id.length >= 2 && text.includes(p.id.toLowerCase())) score += 5
    const alias = (p.nameEn || '').match(/\(([^)]+)\)/)
    if (alias && alias[1].length >= 2 && text.includes(alias[1].toLowerCase())) score += 5
    ;[p.name, p.nameEn].forEach(full => {
      const f = (full || '').trim().toLowerCase()
      if (f.length >= 4 && text.includes(f)) score += 5
    })
    // Weak signals: individual words split out of name/nameEn — only count
    // ones not in the generic-word list, and only worth a fraction each.
    ;(p.name || '').split(/[\s()+.,·-]+/).concat((p.nameEn || '').split(/[\s()+.,·-]+/))
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length >= 3 && !WEAK_SUGGEST_WORDS.has(t))
      .forEach(t => { if (text.includes(t)) score += 1 })
    if (score > bestScore) { bestScore = score; best = p }
  })
  return bestScore >= 2 ? best : null // require more than one weak word alone
}

// Lets an admin tag a Fathom Inbox recording into one or more projects — the
// recording stays in Fathom Inbox permanently (this only ADDS a tag, never
// moves the row). Mirrors the tag picker in JavaScript.html's openTagPicker().
export default function TagPickerModal({ open, meeting, projects, onClose, onTagged, onBusy, onToast }: Props) {
  if (!open || !meeting) return null

  const already = new Set(meeting.taggedProjectIds)
  const candidates = projects.filter(p => !isInboxProject(p.id) && !already.has(p.id))
  const suggestion = suggestProjectFor(meeting, candidates)

  const pick = (target: Project) => {
    onClose()
    onBusy('Tagging into ' + target.name + '…')
    api.setFathomTag(meeting.id, target.id, getToken())
      .then(() => onTagged(target.name))
      .catch(e => onToast('Failed: ' + (e instanceof Error ? e.message : String(e))))
      .finally(() => onBusy(null))
  }

  return (
    <div className="modal-bg show" onClick={e => { if ((e.target as HTMLElement).classList.contains('modal-bg')) onClose() }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <h3>Also show this recording in…</h3>
        <p className="subhead">It stays in Fathom Inbox too — this just adds it to a project's list as well.</p>
        <div className="form">
          {candidates.map(p => {
            const isSuggested = suggestion !== null && (suggestion as Project).id === p.id
            return (
              <div key={p.id} className={'proj' + (isSuggested ? ' suggested' : '')} onClick={() => pick(p)}>
                <span className="dot" style={{ background: p.color }} />
                <span className="pn"><b>{p.name}</b><small>{p.nameEn || ''}</small></span>
                {isSuggested && <span className="badge suggest-badge">Suggested</span>}
              </div>
            )
          })}
        </div>
        <div className="actions"><button className="dbtn" onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  )
}
