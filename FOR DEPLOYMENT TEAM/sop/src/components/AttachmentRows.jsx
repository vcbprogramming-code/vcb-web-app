/**
 * Attachment editor rows.
 *
 * ---------------------------------------------------------------------------
 * THE DRIVE FILENAME LOOKUP IS GONE.
 * ---------------------------------------------------------------------------
 * The canonical Apps Script app auto-filled an attachment's name by opening the
 * file with DriveApp and reading getName(). The old React port kept the call
 * shape but always returned '' — it could not do it, and said so.
 *
 * Under this stack it is not merely unimplemented, it is not implementable from
 * the browser: Drive sends no permissive CORS headers for file metadata, and
 * the Express API has no Drive endpoint (see the report in PORT_NOTES.md). So
 * the pretence is dropped rather than carried forward as a call that always
 * fails silently: the name field is simply typed, and left blank it renders as
 * "เอกสารแนบ", which is exactly what the old auto-fill produced anyway.
 *
 * `named` is kept in the row shape because the storage round-trip still needs
 * it: a stored label equal to the URL is the legacy "unnamed" shape and must
 * come back as an empty field, not as a URL sitting in the name box.
 */

import { useI18n } from '@vcb/shared';

import { TextInput } from './ui.jsx';

let rowKeySeq = 0;

/** Rows need a stable key: attachments have no id, and an index key reorders
 * wrongly the moment a middle row is deleted. */
export function newAttachmentRow(label = '', url = '', named = false) {
  return { key: ++rowKeySeq, label, url, named };
}

/** Storage → rows. A stored label that is just the URL counts as unnamed, so it
 * starts empty and renders as the generic "เอกสารแนบ" in the detail rail. */
export function attachmentsToRows(atts) {
  return (atts || [])
    .filter((a) => a && a.url)
    .map((a) => {
      const hasLabel = Boolean(a.label) && a.label !== a.url;
      return newAttachmentRow(hasLabel ? a.label : '', a.url, hasLabel);
    });
}

/** Rows → storage. Drops URL-less rows; a blank name falls back to the URL,
 * matching writeAttachments_() in the canonical Code.js. */
export function rowsToAttachments(rows) {
  return rows
    .map((r) => ({ label: r.label.trim(), url: r.url.trim() }))
    .filter((a) => a.url)
    .map((a) => ({ label: a.label || a.url, url: a.url }));
}

export default function AttachmentRows({ rows, onChange }) {
  const { t } = useI18n();

  function patch(key, next) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...next } : r)));
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-1.5">
          <TextInput
            type="text"
            placeholder={t('edit.attachmentNamePh')}
            value={r.label}
            onChange={(e) => patch(r.key, { label: e.target.value, named: true })}
            className="flex-1"
          />
          <TextInput
            type="url"
            placeholder="https://drive.google.com/file/d/…"
            value={r.url}
            onChange={(e) => patch(r.key, { url: e.target.value })}
            className="flex-1"
          />
          <button
            type="button"
            title={t('edit.attachmentDelete')}
            aria-label={t('edit.attachmentDelete')}
            onClick={() => onChange(rows.filter((x) => x.key !== r.key))}
            className="shrink-0 rounded p-1.5 text-ink-muted hover:bg-danger-bg hover:text-danger dark:text-ink-dark-muted dark:hover:bg-danger/20 dark:hover:text-danger-dark"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ))}
    </div>
  );
}
