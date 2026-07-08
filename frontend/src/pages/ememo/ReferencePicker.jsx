import { useEffect, useRef, useState } from 'react';
import { ememoApi, formatThaiDate } from '../../lib/ememo.js';
import Icon from '../../components/Icon.jsx';

/**
 * "อ้างถึง" picker (#3) — search existing in-system documents and pick one, so the
 * reference is always a real document (no typos). Emits both the chosen doc's id
 * (referenceDocId, the enforced link) and a printable label (reference text).
 *
 * Props:
 *   value      { docId, text } — current selection
 *   onChange   ({ docId, text }) => void
 *   excludeId  a document id to hide from results (don't reference yourself)
 */
export default function ReferencePicker({ value, onChange, excludeId }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  // Show a chip when EITHER a document is linked (docId) OR a legacy free-text
  // reference exists (text without an id, from docs created before feature #3).
  // Legacy text still needs to be visible and clearable — not hidden behind a
  // blank search box. `isLinked` distinguishes a real in-system link from text.
  const selected = (value?.docId || value?.text) ? { doc_number: value.text, isLinked: !!value?.docId } : null;

  // debounce the search query
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 1) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      ememoApi.searchDocuments(term)
        .then((r) => { if (!cancelled) setResults((r.data || []).filter((d) => d.id !== excludeId)); })
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setLoading(false));
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, open, excludeId]);

  // close on outside click
  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (d) => {
    onChange({ docId: d.id, text: d.doc_number });
    setOpen(false);
    setQ('');
  };
  const clear = () => { onChange({ docId: '', text: '' }); setQ(''); };

  return (
    <div className="relative" ref={boxRef}>
      {selected ? (
        // a reference is set — show it as a chip with a clear button. A linked
        // in-system doc gets the brand file icon; a legacy free-text reference is
        // shown in muted style so it's clear it isn't a live link.
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
          <Icon name={selected.isLinked ? 'file' : 'edit'} className={`h-4 w-4 shrink-0 ${selected.isLinked ? 'text-brand' : 'text-slate-400'}`} />
          <span className="truncate text-sm font-medium text-slate-800">{selected.doc_number}</span>
          {!selected.isLinked && <span className="shrink-0 text-[11px] text-slate-400">(ข้อความเดิม — ไม่ได้ลิงก์)</span>}
          <button type="button" onClick={clear} className="ml-auto text-slate-400 hover:text-red-600">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="ค้นหาเลขที่หรือเรื่องของเอกสารในระบบ…"
            className="field !py-2.5 pl-9"
          />
        </div>
      )}

      {open && !selected && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {loading ? (
            <div className="px-3 py-3 text-sm text-slate-400">กำลังค้นหา…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-400">
              {q.trim() ? 'ไม่พบเอกสารที่ตรงกัน' : 'พิมพ์เพื่อค้นหาเอกสาร'}
            </div>
          ) : (
            <ul className="max-h-64 overflow-auto">
              {results.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => pick(d)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-slate-50"
                  >
                    <span className="mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: d.project_color || '#64748b' }}>
                      {d.project_code}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">{d.doc_number}</span>
                      <span className="block truncate text-xs text-slate-500">{d.subject} · {formatThaiDate(d.date_received)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
