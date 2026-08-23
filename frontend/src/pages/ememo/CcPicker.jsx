import { useEffect, useRef, useState } from 'react';
import { ememoApi } from '../../lib/ememo.js';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * สำเนาเรียน (CC) — pick people, not free text.
 *
 * It used to be one text box that a regex scraped addresses out of: a typo meant
 * nobody was notified and nothing said so. CC recipients now have to be real
 * accounts (the client's decision) because they open the same document page as
 * everyone else and take part in the conversation.
 *
 * Chosen people are listed one per line — numbered, name and address both fully
 * readable — laid out to match สิ่งที่ส่งมาด้วย right below it, because on a memo
 * these are two lists of the same kind. The earlier chip row packed the names
 * into pills too small to check before sending.
 *
 * `value` is an array of profile ids; `onChange` gets the new array.
 */
export default function CcPicker({ value = [], onChange, exclude = [] }) {
  const t = useT();
  const [people, setPeople] = useState([]);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { ememoApi.listPeople().then((r) => setPeople(r.data || [])).catch(() => setPeople([])); }, []);
  useEffect(() => {
    if (!adding) return undefined;
    inputRef.current?.focus();
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) { setAdding(false); setQ(''); } };
    const onKey = (e) => { if (e.key === 'Escape') { setAdding(false); setQ(''); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [adding]);

  const chosen = value.map((id) => people.find((p) => p.id === id)).filter(Boolean);
  const term = q.trim().toLowerCase();
  const options = people.filter((p) =>
    !value.includes(p.id) && !exclude.includes(p.id)
    && (!term || (p.full_name || '').toLowerCase().includes(term) || p.email.toLowerCase().includes(term)));

  // stay open after a pick: adding three people in a row is the common case
  const add = (id) => { onChange([...value, id]); setQ(''); inputRef.current?.focus(); };
  const remove = (id) => onChange(value.filter((x) => x !== id));

  return (
    <div ref={boxRef}>
      {chosen.length > 0 && (
        <div className="space-y-2">
          {chosen.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-center text-sm text-slate-400">{i + 1}.</span>
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[10px] font-bold text-brand">
                  {(p.full_name || p.email).slice(0, 1).toUpperCase()}
                </span>
                <span className="truncate text-sm text-slate-800">{p.full_name || p.email}</span>
                {p.full_name && <span className="truncate text-xs text-slate-400">· {p.email}</span>}
              </div>
              <button type="button" onClick={() => remove(p.id)} title={t('เอาออก')}
                className="px-1 text-slate-400 hover:text-red-600">
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="relative mt-2">
          <div className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-center text-sm text-slate-400">{chosen.length + 1}.</span>
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-brand bg-white px-3 py-2">
              <Icon name="search" className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('พิมพ์ชื่อหรืออีเมลเพื่อค้นหา')}
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <button type="button" onClick={() => { setAdding(false); setQ(''); }} title={t('ปิด')}
              className="px-1 text-slate-400 hover:text-slate-700">
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>

          <div className="absolute left-7 right-7 z-30 mt-1 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
            {options.length === 0 ? (
              <div className="px-3 py-2.5 text-xs text-slate-400">
                {people.length === 0 ? 'กำลังโหลดรายชื่อ…'
                  : term ? 'ไม่พบผู้ใช้ที่ตรงกับคำค้น'
                    : 'เลือกครบทุกคนแล้ว'}
              </div>
            ) : options.slice(0, 40).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => add(p.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[10px] font-bold text-brand">
                  {(p.full_name || p.email).slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-slate-800">{p.full_name || p.email}</span>
                  <span className="block truncate text-[11px] text-slate-400">{p.email}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          className="mt-2 text-sm font-medium text-blue-600 hover:underline">
          {t('+ เพิ่มผู้รับสำเนา')}
        </button>
      )}

      <p className="mt-1 text-xs text-slate-400">
        {t('ผู้รับสำเนาต้องมีบัญชีในระบบ · จะได้รับอีเมลแจ้ง เปิดดูเอกสารและร่วมแสดงความเห็นได้ในหน้าเดียวกับผู้อนุมัติ (ไม่ต้องอนุมัติ)')}
      </p>
    </div>
  );
}
