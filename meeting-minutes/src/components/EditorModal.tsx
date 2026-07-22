import { useEffect, useRef, useState } from 'react'
import type { AuditEntry, MeetingFull } from '../types'
import { api, getToken } from '../api/client'
import { setCached } from '../api/contentCache'
import { useConfirm, usePrompt } from './ConfirmPrompt'
import EditHistoryModal from './EditHistoryModal'
import VersionPreviewModal from './VersionPreviewModal'

interface Props {
  meeting: MeetingFull | null   // non-null => open
  projectName?: string
  onClose: () => void
  onSaved: (id: string) => void
  onDeleted: () => void
  onBusy: (msg: string | null) => void
  onToast: (msg: string) => void
}

// Mirrors the in-app content editor in Index.html (#edBg) + openEditor()/
// closeEditor()/edSave/edDelete/edCancel in JavaScript.html. Uses
// contentEditable; toolbar buttons still use document.execCommand (bold/
// italic/lists/link — GAS keeps these too, only Enter-key and paste were
// rewritten off execCommand, see below).
//
// Docs are no longer the source of truth (2026-07-19) — every meeting is
// edited directly here regardless of where its content originally came from.
// The old "Also update the source Google Doc" checkbox + writeToDoc param are
// gone; there is nothing left to write back to.
//
// Enter-key and paste handling (2026-07-21/22 GAS change, ported verbatim —
// see splitBlockAtCursor_/sanitizePastedNode_ in JavaScript.html): both use
// direct Range/DOM manipulation, NEVER document.execCommand. execCommand's
// insertParagraph/formatBlock/insertHTML are deprecated specifically because
// browser vendors never implemented consistent list-splitting — pressing
// Enter inside a nested <li> could corrupt the list and dump the new line at
// the very end instead of splitting in place. Same root cause broke pasted
// HTML landing inside an existing list. Both are handled below with explicit
// Range surgery instead.
// Allow-list of tags a pasted-in fragment may keep (everything else is
// unwrapped to its children, or turned into <p> for DIV — see
// sanitizePastedNode below). Mirrors PASTE_ALLOWED_TAGS in JavaScript.html.
const PASTE_ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'A', 'UL', 'OL', 'LI', 'BR', 'P'])

export default function EditorModal({ meeting, projectName, onClose, onSaved, onDeleted, onBusy, onToast }: Props) {
  const areaRef = useRef<HTMLDivElement>(null)
  const [title, setTitle] = useState('')
  const [dateLabel, setDateLabel] = useState('')
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)
  const snapshotRef = useRef<string | null>(null)
  const { confirm, node: confirmNode } = useConfirm()
  const { prompt, node: promptNode } = usePrompt()
  const [historyMeeting, setHistoryMeeting] = useState<MeetingFull | null>(null)
  const [previewRequest, setPreviewRequest] = useState<{ meetingId: string; seq: string } | null>(null)

  function snapshot(): string {
    return title + '' + dateLabel + '' + time + '' + (areaRef.current?.innerHTML ?? '')
  }

  useEffect(() => {
    if (meeting && areaRef.current) {
      areaRef.current.innerHTML = meeting.html || ''
      setTitle(meeting.title || '')
      setDateLabel(meeting.dateLabel || '')
      setTime(meeting.time || '')
      areaRef.current.focus()
      // Snapshot after the DOM/state above has been applied this tick.
      queueMicrotask(() => { snapshotRef.current = snapshot() })
    } else {
      snapshotRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting])

  // Splits `block` (an LI or heading ancestor of the cursor) at the cursor
  // position into two siblings via Range.cloneRange()/setEnd()/extractContents
  // — never execCommand. Moves everything after the cursor into a new
  // `newTag` element inserted right after `block`. If `block` ends up empty
  // (cursor was at position 0), the caller is responsible for deciding
  // whether to remove it (see the heading case below). Mirrors
  // splitBlockAtCursor_ in JavaScript.html exactly.
  function splitBlockAtCursor(sel: Selection, range: Range, block: Element, newTag: string): HTMLElement {
    const newBlock = document.createElement(newTag)
    const afterRange = range.cloneRange()
    afterRange.setEnd(block, block.childNodes.length)
    newBlock.appendChild(afterRange.extractContents())
    if (!newBlock.hasChildNodes()) newBlock.appendChild(document.createElement('br'))
    if (block.nextSibling) block.parentNode!.insertBefore(newBlock, block.nextSibling)
    else block.parentNode!.appendChild(newBlock)
    if (!block.hasChildNodes()) block.appendChild(document.createElement('br'))
    const caret = document.createRange()
    caret.setStart(newBlock, 0)
    caret.collapse(true)
    sel.removeAllRanges()
    sel.addRange(caret)
    return newBlock
  }

  // Enter is handled with direct Range/DOM manipulation, NEVER execCommand
  // (see the file-level note above for why). Two cases:
  //   1. Cursor inside a heading (H1-H6) -> split off a plain <p>, never
  //      continue the heading for the new line.
  //   2. Cursor inside a list item (LI, possibly nested) -> split that LI
  //      into two siblings at the cursor position, correctly in place.
  // Everything else (plain paragraphs, bold/italic runs) is left to native
  // contenteditable Enter behavior, which already handles those correctly.
  function handleAreaKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (e.key !== 'Enter' || e.shiftKey) return
    const area = areaRef.current
    if (!area) return
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    const startNode = range.startContainer
    const startEl = (startNode.nodeType === 1 ? startNode : startNode.parentElement) as Element | null
    if (!startEl || !area.contains(startEl)) return

    const li = startEl.closest('li')
    if (li && area.contains(li)) {
      e.preventDefault()
      splitBlockAtCursor(sel, range, li, 'LI')
      return
    }
    const heading = startEl.closest('h1,h2,h3,h4,h5,h6')
    if (heading && area.contains(heading)) {
      e.preventDefault()
      const p = splitBlockAtCursor(sel, range, heading, 'P')
      // The part still inside the original heading tag stays a heading only
      // if there was text BEFORE the cursor; an Enter at the very start of an
      // empty/cursor-at-0 heading converts the whole thing to a paragraph
      // instead of leaving a hollow heading behind.
      if (!heading.hasChildNodes() || (heading.childNodes.length === 1 && heading.firstChild!.nodeName === 'BR')) {
        heading.parentNode!.insertBefore(p, heading)
        heading.parentNode!.removeChild(heading)
      }
      return
    }
  }

  // Pasting must never bring in the source's own formatting — a browser
  // default paste keeps every inline style="..." from the clipboard verbatim
  // (font-family, color, line-height, custom margins), which is how pasted
  // content could show up in a different color ("rainbow text") or with
  // different line spacing than the rest of the document, permanently baked
  // into the saved HTML the moment you paste. Fix: intercept paste, strip the
  // clipboard's HTML down to only the structure this editor's own toolbar can
  // produce (bold/italic/lists/links/paragraphs), discarding every
  // style/class/font attribute, then insert that instead. Plain-text paste
  // (Ctrl+Shift+V or a source with no HTML) already had no styling to strip,
  // so it's passed through as-is via the browser default. Mirrors
  // PASTE_ALLOWED_TAGS/sanitizePastedNode_ in JavaScript.html exactly.
  function sanitizePastedNode(node: Node): Node | null {
    if (node.nodeType === 3) return document.createTextNode(node.nodeValue || '')
    if (node.nodeType !== 1) return null
    const el = node as Element
    const tag = el.tagName
    // A source's block-level DIV becomes a plain paragraph (still a real line
    // break) rather than being unwrapped into nothing — otherwise multi-div
    // sources (very common from Word/Google Docs HTML) would collapse into
    // one run-on paragraph. SPANs/headings/everything else not in the
    // allow-list are unwrapped: their text/children are kept, just not the
    // wrapper tag (and therefore not its inline style/color/font either).
    const outTag = tag === 'DIV' ? 'P' : (PASTE_ALLOWED_TAGS.has(tag) ? tag : null)
    const out: Element | DocumentFragment = outTag ? document.createElement(outTag) : document.createDocumentFragment()
    if (outTag === 'A') {
      const href = el.getAttribute('href')
      if (href) (out as Element).setAttribute('href', href)
      ;(out as Element).setAttribute('target', '_blank')
    }
    Array.prototype.forEach.call(el.childNodes, (child: Node) => {
      const cleaned = sanitizePastedNode(child)
      if (cleaned) out.appendChild(cleaned)
    })
    return out
  }

  function handleAreaPaste(e: React.ClipboardEvent<HTMLDivElement>): void {
    const html = e.clipboardData.getData('text/html')
    if (!html) return // no HTML on the clipboard (plain text, or an image) — let the browser's default plain-text paste happen
    e.preventDefault()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const frag = document.createDocumentFragment()
    Array.prototype.forEach.call(doc.body.childNodes, (n: Node) => {
      const cleaned = sanitizePastedNode(n)
      if (cleaned) frag.appendChild(cleaned)
    })
    // Inserted via Range, NOT execCommand('insertHTML', ...) — same root-cause
    // reasoning as the Enter-key handler above: execCommand's insertion logic
    // is what mis-nests lists when the paste target is already inside an
    // existing <li>/<ul>. Range.insertNode gives an explicit, predictable
    // insertion point with no browser-specific list-splitting guesswork.
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    range.deleteContents()
    const lastNode = frag.lastChild
    range.insertNode(frag)
    if (lastNode) {
      const after = document.createRange()
      after.setStartAfter(lastNode)
      after.collapse(true)
      sel.removeAllRanges()
      sel.addRange(after)
    }
  }

  if (!meeting) return null

  const focusArea = () => areaRef.current?.focus()
  const cmd = (c: string) => { document.execCommand(c, false); focusArea() }
  const prevent = (e: React.MouseEvent) => e.preventDefault()

  async function addLink(): Promise<void> {
    // Selection is lost once the dialog steals focus, so it must be captured
    // now and restored before execCommand runs.
    const sel = window.getSelection()
    const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null
    const u = await prompt('Link URL', { title: 'Add a link', placeholder: 'https://', okLabel: 'Add' })
    if (!u) { focusArea(); return }
    if (range && sel) { sel.removeAllRanges(); sel.addRange(range) }
    document.execCommand('createLink', false, u)
    focusArea()
  }
  const unlink = () => { document.execCommand('unlink', false); focusArea() }

  async function handleCancel(): Promise<void> {
    if (snapshotRef.current !== null && snapshot() !== snapshotRef.current) {
      const ok = await confirm('Anything you typed will be lost.', { title: 'Discard unsaved changes?', okLabel: 'Discard' })
      if (ok) onClose()
    } else {
      onClose()
    }
  }

  async function save(): Promise<void> {
    const html = areaRef.current?.innerHTML ?? ''
    const meta = { title: title.trim(), dateLabel: dateLabel.trim(), time: time.trim() }
    setSaving(true); onBusy('Saving…')
    try {
      await api.saveEdit(meeting!.id, html, getToken(), meta)
      setCached(meeting!.id, { ...meeting!, html, title: meta.title || meeting!.title, dateLabel: meta.dateLabel || meeting!.dateLabel, time: meta.time })
      onSaved(meeting!.id)
      onToast('Saved')
    } catch (e) { onToast('Save failed: ' + (e instanceof Error ? e.message : String(e))) }
    finally { setSaving(false); onBusy(null) }
  }

  async function handleDelete(): Promise<void> {
    const ok = await confirm('This cannot be undone.', { title: 'Delete this meeting?', okLabel: 'Delete' })
    if (!ok) return
    onBusy('Deleting…')
    try {
      await api.deleteMeeting(meeting!.id, getToken())
      onDeleted()
      onToast('Deleted')
    } catch (e) { onToast('Failed: ' + (e instanceof Error ? e.message : String(e))) }
    finally { onBusy(null) }
  }

  const fetchHistory = (id: string): Promise<AuditEntry[]> => api.getAuditHistory(id, getToken())

  return (
    <>
      <div className="modal-bg show" /* backdrop click no longer closes this editor — an accidental
           click outside the modal must never silently discard an in-progress edit */>
        <div className="editor">
          <h3>Edit meeting</h3>
          <div className="ed-meta">
            <div>
              <label>Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Meeting title" />
            </div>
            <div>
              <label>Date</label>
              <input value={dateLabel} onChange={e => setDateLabel(e.target.value)} placeholder="e.g. 21 May 2569 or 21-05-2569" />
            </div>
            <div>
              <label>Time</label>
              <input value={time} onChange={e => setTime(e.target.value)} placeholder="e.g. 10:00" />
            </div>
          </div>
          <div className="ed-toolbar">
            <span className="ed-group">
              <button type="button" title="Bold" onMouseDown={prevent} onClick={() => cmd('bold')}><b>B</b></button>
              <button type="button" title="Italic" onMouseDown={prevent} onClick={() => cmd('italic')}><i>I</i></button>
            </span>
            <span className="ed-sep" />
            <span className="ed-group">
              <button type="button" title="Bullet list" onMouseDown={prevent} onClick={() => cmd('insertUnorderedList')}>• List</button>
              <button type="button" title="Numbered list" onMouseDown={prevent} onClick={() => cmd('insertOrderedList')}>1. List</button>
            </span>
            <span className="ed-sep" />
            <span className="ed-group">
              <button type="button" title="Add a hyperlink" onMouseDown={prevent} onClick={addLink}>🔗 Link</button>
              <button type="button" title="Remove hyperlink" onMouseDown={prevent} onClick={unlink}>Unlink</button>
            </span>
          </div>
          <div className="ed-area" ref={areaRef} contentEditable suppressContentEditableWarning
            onKeyDown={handleAreaKeyDown} onPaste={handleAreaPaste} />
          <div className="actions">
            <button className="dbtn" style={{ marginRight: 'auto' }} title="See who edited this and when" onClick={() => setHistoryMeeting(meeting)}>🕘 Edit history</button>
            <button className="dbtn danger" onClick={handleDelete}>🗑 Delete meeting</button>
            <button className="dbtn" onClick={handleCancel}>Cancel</button>
            <button className="dbtn primary" disabled={saving} onClick={save}>Save</button>
          </div>
        </div>
      </div>

      <EditHistoryModal
        meeting={historyMeeting}
        fetchHistory={fetchHistory}
        onClose={() => setHistoryMeeting(null)}
        onViewOriginal={(id) => setPreviewRequest({ meetingId: id, seq: 'current-original' })}
        onViewVersion={(id, seq) => setPreviewRequest({ meetingId: id, seq })}
      />
      <VersionPreviewModal
        request={previewRequest}
        meeting={historyMeeting}
        projectName={projectName || ''}
        fetchHtml={(id, seq) => seq === 'current-original' ? api.getOriginalContent(id, getToken()) : api.getVersionContent(id, seq, getToken())}
        onClose={() => setPreviewRequest(null)}
      />
      {confirmNode}
      {promptNode}
    </>
  )
}
