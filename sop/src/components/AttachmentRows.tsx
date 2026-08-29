/** Attachment editor rows for the case modal. Mirrors addAttachmentRow() /
 *  setAttachmentRows() / readAttachmentRows() / maybeFillAttachmentName() in
 *  the canonical index.html.
 *
 *  The canonical version builds DOM nodes imperatively and tracks "the admin
 *  named this row" with a `data-named` attribute. Here that flag is component
 *  state (`named`) on each row, which is the same contract expressed the way a
 *  React codebase would: an explicitly-typed name always outranks a looked-up
 *  one, and auto-fill only ever writes into an empty field.
 */
import { useRef, useState } from 'react';
import type { Attachment } from '../data/types';
import { getDriveFileName } from '../lib/api';

/** One editable row. `named` is sticky: once the admin types a name, this row
 * is never auto-filled again, even if the URL changes afterwards. */
export interface AttachmentRow {
  /** Stable key for React — attachments have no id of their own, and index
   * keys would reorder wrongly when a middle row is deleted. */
  key: number;
  label: string;
  url: string;
  named: boolean;
}

let rowKeySeq = 0;
export function newAttachmentRow(label = '', url = '', named = false): AttachmentRow {
  return { key: ++rowKeySeq, label, url, named };
}

/** Storage → rows. A row whose stored label is just the URL counts as unnamed,
 * so it starts empty and *can* be auto-filled — that legacy shape is exactly
 * what renders as "เอกสารแนบ" in the detail rail. */
export function attachmentsToRows(atts: Attachment[] | undefined): AttachmentRow[] {
  return (atts || [])
    .filter((a) => a && a.url)
    .map((a) => {
      const hasLabel = !!a.label && a.label !== a.url;
      return newAttachmentRow(hasLabel ? a.label : '', a.url, hasLabel);
    });
}

/** Rows → storage. Drops URL-less rows; a blank name falls back to the URL,
 * matching writeAttachments_() in Code.js. */
export function rowsToAttachments(rows: AttachmentRow[]): Attachment[] {
  return rows
    .map((r) => ({ label: r.label.trim(), url: r.url.trim() }))
    .filter((a) => a.url)
    .map((a) => ({ label: a.label || a.url, url: a.url }));
}

/** Mirrors driveFileId() in the canonical index.html — used here only to decide
 * whether a lookup is worth attempting. */
function driveFileId(u: string): string {
  const m =
    u.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/) ||
    u.match(/[?&]id=([a-zA-Z0-9_-]{10,})/) ||
    u.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  return m ? m[1] : '';
}

export default function AttachmentRows({
  rows,
  onChange,
}: {
  rows: AttachmentRow[];
  onChange: (next: AttachmentRow[]) => void;
}) {
  const [looking, setLooking] = useState<Set<number>>(new Set());
  // Read in async callbacks so a lookup that resolves late compares against
  // what the row holds *now*, not what it held when the request went out.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  function patch(key: number, next: Partial<AttachmentRow>) {
    onChange(rowsRef.current.map((r) => (r.key === key ? { ...r, ...next } : r)));
  }

  /** Fill a row's name from the Drive filename — only into an EMPTY field, and
   * never over a name the admin typed or one that came from storage. A failed
   * lookup is silent: the field stays empty and gets typed by hand. */
  async function maybeFill(key: number) {
    const row = rowsRef.current.find((r) => r.key === key);
    if (!row || row.named || row.label.trim()) return;
    const url = row.url.trim();
    if (!url || !driveFileId(url)) return;
    if (looking.has(key)) return;

    setLooking((prev) => new Set(prev).add(key));
    try {
      const res = await getDriveFileName(url);
      // Re-check everything that could have changed while in flight.
      const now = rowsRef.current.find((r) => r.key === key);
      if (!res || !res.name) return;
      if (!now || now.named || now.label.trim() || now.url.trim() !== url) return;
      patch(key, { label: res.name });
    } catch {
      /* silent by design — see the module comment */
    } finally {
      setLooking((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  return (
    <div id="ed_attachments" className="att-list">
      {rows.map((r) => (
        <div className="att-row" key={r.key}>
          <input
            type="text"
            className="att-name"
            placeholder={
              looking.has(r.key) ? 'กำลังอ่านชื่อไฟล์…' : 'ชื่อไฟล์ (เช่น SOP-09 · IC Balance Adjustment)'
            }
            value={r.label}
            // Typing marks the row as the admin's own, permanently.
            onChange={(e) => patch(r.key, { label: e.target.value, named: true })}
          />
          <input
            type="text"
            className="att-url"
            placeholder="https://drive.google.com/file/d/…"
            value={r.url}
            onChange={(e) => patch(r.key, { url: e.target.value })}
            // Paste/blur, never per keystroke: a half-typed URL isn't worth a
            // round-trip. onPaste fires before the value lands, hence the tick.
            onPaste={() => setTimeout(() => maybeFill(r.key), 0)}
            onBlur={() => maybeFill(r.key)}
          />
          <button
            type="button"
            className="att-del"
            title="ลบไฟล์แนบนี้"
            onClick={() => onChange(rowsRef.current.filter((x) => x.key !== r.key))}
          >
            {'×'}
          </button>
        </div>
      ))}
    </div>
  );
}
