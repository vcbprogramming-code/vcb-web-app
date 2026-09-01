import React, { useEffect, useRef, useState } from 'react';
import { useAuth, useI18n } from '@vcb/shared';
import * as minutesApi from '../lib/minutesApi';
import { errorMessage } from '../lib/errors';
import { Button, Field, TextInput, useConfirm, usePrompt } from '../ui';
import EditHistoryModal from './EditHistoryModal';
import VersionPreviewModal from './VersionPreviewModal';

/**
 * The in-app content editor.
 *
 * Docs stopped being the source of truth on 2026-07-19: every meeting is edited
 * here now, whatever its content originally came from, and the old "Also update
 * the source Google Doc" checkbox is gone because there is nothing left to
 * write back to. An imported row keeps source='doc-import' through every edit —
 * the API pins it — so nothing here needs to, or may, change provenance.
 *
 * ---------------------------------------------------------------------------
 * ENTER AND PASTE USE DIRECT RANGE/DOM SURGERY, NEVER document.execCommand.
 * ---------------------------------------------------------------------------
 * execCommand's insertParagraph/formatBlock/insertHTML are deprecated precisely
 * because vendors never implemented consistent list-splitting: pressing Enter
 * inside a nested <li> could corrupt the list and dump the new line at the very
 * end instead of splitting in place. The same root cause broke pasted HTML that
 * landed inside an existing list. Both are handled below with explicit Range
 * work. execCommand IS still used for bold/italic/list-creation/link, where it
 * is reliable and there is no standard replacement.
 */

/**
 * Field separator for the editor's unsaved-changes fingerprint (see
 * snapshot()). U+001F, the ASCII unit separator, because it is the one
 * character a title, a date label, a time or a document body cannot contain.
 * Written as an escape, never as a raw control character in the source.
 */
const SNAPSHOT_SEP = '\u001f';

/** Tags a pasted fragment may keep. Everything else is unwrapped. */
const PASTE_ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'A', 'UL', 'OL', 'LI', 'BR', 'P']);

export default function EditorModal({ meeting, onClose, onSaved, onDeleted, onToast, onBusy }) {
  const { t } = useI18n();
  const { hasRole } = useAuth();
  const { confirm, node: confirmNode } = useConfirm();
  const { prompt, node: promptNode } = usePrompt();

  const areaRef = useRef(null);
  const snapshotRef = useRef(null);

  const [title, setTitle] = useState('');
  const [dateLabel, setDateLabel] = useState('');
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [previewSeq, setPreviewSeq] = useState(null);

  const isAdmin = hasRole('minutes', 'admin');

  /**
   * A cheap fingerprint of the form, used only to answer "did anything change?"
   * before discarding an edit.
   *
   * Joined with an explicit separator rather than concatenated: without one,
   * moving a character from the end of the title to the start of the date
   * yields an identical string, and Cancel would then throw the edit away
   * without asking.
   */
  const snapshot = () =>
    [title, dateLabel, time, areaRef.current?.innerHTML ?? ''].join(SNAPSHOT_SEP);

  useEffect(() => {
    if (!meeting) {
      snapshotRef.current = null;
      return;
    }
    setTitle(meeting.title || '');
    setDateLabel(meeting.dateLabel || '');
    setTime(meeting.time || '');
    if (areaRef.current) {
      areaRef.current.innerHTML = meeting.html || '';
      areaRef.current.focus();
    }
    // After the DOM and the state above have both been applied this tick, so
    // the baseline is what the user actually sees rather than a half-filled form.
    queueMicrotask(() => {
      snapshotRef.current = [
        meeting.title || '',
        meeting.dateLabel || '',
        meeting.time || '',
        meeting.html || '',
      ].join(SNAPSHOT_SEP);
    });
  }, [meeting]);

  /**
   * Split `block` at the cursor into two siblings, moving everything after the
   * cursor into a new `newTag` element. If `block` ends up empty the caller
   * decides whether to remove it.
   */
  function splitBlockAtCursor(sel, range, block, newTag) {
    const newBlock = document.createElement(newTag);
    const after = range.cloneRange();
    after.setEnd(block, block.childNodes.length);
    newBlock.appendChild(after.extractContents());
    if (!newBlock.hasChildNodes()) newBlock.appendChild(document.createElement('br'));
    if (block.nextSibling) block.parentNode.insertBefore(newBlock, block.nextSibling);
    else block.parentNode.appendChild(newBlock);
    if (!block.hasChildNodes()) block.appendChild(document.createElement('br'));

    const caret = document.createRange();
    caret.setStart(newBlock, 0);
    caret.collapse(true);
    sel.removeAllRanges();
    sel.addRange(caret);
    return newBlock;
  }

  function handleKeyDown(e) {
    if (e.key !== 'Enter' || e.shiftKey) return;
    const area = areaRef.current;
    if (!area) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const startNode = range.startContainer;
    const startEl = startNode.nodeType === 1 ? startNode : startNode.parentElement;
    if (!startEl || !area.contains(startEl)) return;

    // Inside a list item, possibly nested: split it in place.
    const li = startEl.closest('li');
    if (li && area.contains(li)) {
      e.preventDefault();
      splitBlockAtCursor(sel, range, li, 'LI');
      return;
    }

    // Inside a heading: the new line is a paragraph, never another heading.
    const heading = startEl.closest('h1,h2,h3,h4,h5,h6');
    if (heading && area.contains(heading)) {
      e.preventDefault();
      const p = splitBlockAtCursor(sel, range, heading, 'P');
      // Enter at the very start of a heading converts the whole thing to a
      // paragraph rather than leaving a hollow heading behind.
      if (
        !heading.hasChildNodes() ||
        (heading.childNodes.length === 1 && heading.firstChild.nodeName === 'BR')
      ) {
        heading.parentNode.insertBefore(p, heading);
        heading.parentNode.removeChild(heading);
      }
    }
  }

  /**
   * Strip a pasted fragment to the structure this editor's own toolbar can
   * produce, discarding every style/class/font attribute.
   *
   * A browser's default paste keeps the clipboard's inline style="…" verbatim —
   * font-family, colour, line-height, custom margins — which is how pasted
   * content showed up in a different colour or line spacing from the rest of
   * the document, permanently baked into the saved HTML the moment it landed.
   *
   * A source's block-level DIV becomes a plain paragraph rather than being
   * unwrapped into nothing: multi-div sources (Word and Google Docs HTML, very
   * commonly) would otherwise collapse into one run-on paragraph.
   */
  function sanitizePastedNode(node) {
    if (node.nodeType === 3) return document.createTextNode(node.nodeValue || '');
    if (node.nodeType !== 1) return null;

    const tag = node.tagName;
    const outTag = tag === 'DIV' ? 'P' : PASTE_ALLOWED_TAGS.has(tag) ? tag : null;
    const out = outTag ? document.createElement(outTag) : document.createDocumentFragment();

    if (outTag === 'A') {
      const href = node.getAttribute('href');
      // Only http(s) and mailto survive. A pasted javascript: href would
      // otherwise be saved into the document and served to every later reader.
      if (href && /^(https?:|mailto:)/i.test(href.trim())) out.setAttribute('href', href);
      out.setAttribute('target', '_blank');
      out.setAttribute('rel', 'noreferrer');
    }

    for (const child of Array.from(node.childNodes)) {
      const cleaned = sanitizePastedNode(child);
      if (cleaned) out.appendChild(cleaned);
    }
    return out;
  }

  function handlePaste(e) {
    const html = e.clipboardData.getData('text/html');
    const frag = document.createDocumentFragment();

    if (html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      for (const n of Array.from(doc.body.childNodes)) {
        const cleaned = sanitizePastedNode(n);
        if (cleaned) frag.appendChild(cleaned);
      }
    } else {
      // Plain-text clipboard. This needs the same explicit normalisation as
      // HTML: the browser's native plain-text paste inserts AT THE CURSOR,
      // inheriting whatever formatting the surrounding context already had. The
      // whole point of the sanitizer is that everything entering this editor
      // gets one standard format regardless of source.
      const text = e.clipboardData.getData('text/plain');
      if (!text) return; // an image, say — let the browser deal with it
      for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
        if (line) {
          const p = document.createElement('p');
          p.textContent = line;
          frag.appendChild(p);
        } else {
          frag.appendChild(document.createElement('br'));
        }
      }
    }

    e.preventDefault();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const lastNode = frag.lastChild;
    // Range.insertNode, not execCommand('insertHTML') — same reasoning as
    // Enter: execCommand is what mis-nests a paste that lands inside an <li>.
    range.insertNode(frag);
    if (lastNode) {
      const after = document.createRange();
      after.setStartAfter(lastNode);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);
    }
  }

  if (!meeting) return null;

  const focusArea = () => areaRef.current?.focus();
  const cmd = (c) => {
    document.execCommand(c, false);
    focusArea();
  };

  /**
   * The green-tick checklist. There is no execCommand for it, so it reuses
   * insertUnorderedList to get a real, correctly-nested <ul> — the one part of
   * list handling execCommand is reliable for — then tags it, and CSS renders
   * the tick both here and in the final A4 render.
   */
  function tickList() {
    document.execCommand('insertUnorderedList', false);
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const node = sel.getRangeAt(0).startContainer;
      const el = node.nodeType === 1 ? node : node.parentElement;
      const ul = el?.closest('ul');
      if (ul && areaRef.current?.contains(ul)) {
        ul.classList.add('tick-list');
        for (const li of ul.querySelectorAll(':scope > li')) li.classList.add('tick-list');
      }
    }
    focusArea();
  }

  async function addLink() {
    // The selection is lost the moment the dialog takes focus, so it is
    // captured now and restored before execCommand runs.
    const sel = window.getSelection();
    const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
    const url = await prompt(t('editor.linkUrl'), {
      title: t('editor.linkTitle'),
      placeholder: 'https://',
      okLabel: t('common.add'),
    });
    if (!url) {
      focusArea();
      return;
    }
    if (!/^(https?:|mailto:)/i.test(url.trim())) {
      onToast(t('common.error'));
      focusArea();
      return;
    }
    if (range && sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
    document.execCommand('createLink', false, url.trim());
    focusArea();
  }

  async function handleCancel() {
    if (snapshotRef.current !== null && snapshot() !== snapshotRef.current) {
      const ok = await confirm(t('editor.discardHint'), {
        title: t('editor.discardTitle'),
        okLabel: t('editor.discard'),
      });
      if (!ok) return;
    }
    onClose();
  }

  async function save() {
    const html = areaRef.current?.innerHTML ?? '';
    const meta = { title: title.trim(), dateLabel: dateLabel.trim(), time: time.trim() };
    setSaving(true);
    onBusy(t('state.saving'));
    try {
      // PUT /content, not POST /meetings: this route snapshots the previous
      // content AND its metadata into the version history first, which is what
      // makes "View Original" show the name the meeting had at the time.
      await minutesApi.saveMeetingContent(meeting.id, html, meta);
      onToast(t('state.saved'));
      await onSaved(meeting.id);
    } catch (err) {
      onToast(errorMessage(err, t));
    } finally {
      setSaving(false);
      onBusy(null);
    }
  }

  async function handleDelete() {
    const ok = await confirm(t('attach.removeHint'), {
      title: t('modal.deleteMeetingTitle'),
      okLabel: t('common.delete'),
    });
    if (!ok) return;
    onBusy(t('modal.deleting'));
    try {
      await minutesApi.deleteMeeting(meeting.id);
      onToast(t('modal.deleted'));
      await onDeleted();
    } catch (err) {
      onToast(errorMessage(err, t));
    } finally {
      onBusy(null);
    }
  }

  const toolBtn =
    'rounded-md border border-line bg-surface-card px-[11px] py-[5px] text-[13px] text-ink hover:bg-surface-sunken dark:border-line-dark dark:bg-surface-dark-card dark:text-ink-dark dark:hover:bg-surface-dark-sunken';

  return (
    <>
      {/* No backdrop dismissal: an accidental click outside must never silently
          discard an in-progress edit. Escape is likewise not wired — Cancel
          asks first. */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,20,28,.45)] p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('editor.title')}
          className="flex h-[88vh] w-[900px] max-w-[95vw] flex-col overflow-hidden rounded-card bg-surface-card shadow-[0_20px_60px_rgba(0,0,0,.3)] dark:bg-surface-dark-card"
        >
          <h3 className="shrink-0 border-b border-line px-5 py-3.5 text-base font-semibold text-ink dark:border-line-dark dark:text-ink-dark">
            {t('editor.title')}
          </h3>

          <div className="flex shrink-0 flex-wrap gap-3.5 border-b border-line px-5 py-3 dark:border-line-dark">
            <Field label={t('editor.titleField')} className="min-w-[140px] flex-1">
              <TextInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('editor.titlePlaceholder')}
              />
            </Field>
            <Field label={t('editor.date')} className="min-w-[140px] flex-1">
              <TextInput
                value={dateLabel}
                onChange={(e) => setDateLabel(e.target.value)}
                placeholder={t('editor.datePlaceholder')}
              />
            </Field>
            <Field label={t('editor.time')} className="min-w-[140px] flex-1">
              <TextInput
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder={t('editor.timePlaceholder')}
              />
            </Field>
          </div>

          <div
            role="toolbar"
            aria-label={t('editor.title')}
            className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-line bg-surface-alt px-4 py-2 dark:border-line-dark dark:bg-surface-dark-sunken"
          >
            {/* onMouseDown preventDefault everywhere: without it the button
                takes focus and the selection the command acts on is gone. */}
            <button
              type="button"
              title={t('editor.bold')}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => cmd('bold')}
              className={toolBtn}
            >
              <b>B</b>
            </button>
            <button
              type="button"
              title={t('editor.italic')}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => cmd('italic')}
              className={toolBtn}
            >
              <i>I</i>
            </button>
            <span aria-hidden="true" className="mx-0.5 h-6 w-px bg-line dark:bg-line-dark" />
            <button
              type="button"
              title={t('editor.bulletList')}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => cmd('insertUnorderedList')}
              className={toolBtn}
            >
              {t('editor.bulletListBtn')}
            </button>
            <button
              type="button"
              title={t('editor.numberedList')}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => cmd('insertOrderedList')}
              className={toolBtn}
            >
              {t('editor.numberedListBtn')}
            </button>
            <button
              type="button"
              title={t('editor.tickList')}
              onMouseDown={(e) => e.preventDefault()}
              onClick={tickList}
              className={toolBtn}
            >
              {t('editor.tickListBtn')}
            </button>
            <span aria-hidden="true" className="mx-0.5 h-6 w-px bg-line dark:bg-line-dark" />
            <button
              type="button"
              title={t('editor.addLink')}
              onMouseDown={(e) => e.preventDefault()}
              onClick={addLink}
              className={toolBtn}
            >
              {t('editor.addLinkBtn')}
            </button>
            <button
              type="button"
              title={t('editor.unlink')}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => cmd('unlink')}
              className={toolBtn}
            >
              {t('editor.unlinkBtn')}
            </button>
          </div>

          {/* .ed-area's descendant rules live in index.css: its children are
              created at runtime by execCommand and by the paste sanitizer, so
              no className can ever be attached to them. */}
          <div
            ref={areaRef}
            role="textbox"
            aria-multiline="true"
            aria-label={t('editor.title')}
            contentEditable
            suppressContentEditableWarning
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            className="ed-area text-ink dark:text-ink-dark"
          />

          <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-line px-5 py-3.5 dark:border-line-dark">
            <Button
              className="mr-auto"
              onClick={() => setHistoryOpen(true)}
              title={t('meeting.historyHint')}
            >
              {t('editor.editHistory')}
            </Button>
            {isAdmin ? (
              <Button variant="danger" onClick={handleDelete}>
                {t('modal.deleteMeeting')}
              </Button>
            ) : null}
            <Button onClick={handleCancel}>{t('common.cancel')}</Button>
            <Button variant="primary" disabled={saving} onClick={save}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </div>

      <EditHistoryModal
        open={historyOpen}
        meeting={meeting}
        onClose={() => setHistoryOpen(false)}
        onViewVersion={setPreviewSeq}
      />
      <VersionPreviewModal
        seq={previewSeq}
        meeting={meeting}
        projectName=""
        onClose={() => setPreviewSeq(null)}
      />
      {confirmNode}
      {promptNode}
    </>
  );
}
