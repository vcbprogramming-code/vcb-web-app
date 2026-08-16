import { useEffect, useRef, useState } from 'react';
import { ememoApi } from '../../lib/ememo.js';
import Icon from '../../components/Icon.jsx';

/**
 * สำเนาเรียน (CC) — pick people, not free text.
 *
 * It used to be one text box that a regex scraped addresses out of: a typo meant
 * nobody was notified and nothing said so. CC recipients now have to be real
 * accounts (the client's decision) because they open the same document page as
 * everyone else and take part in the conversation.
 *
 * `value` is an array of profile ids; `onChange` gets the new array.
 */
export default function CcPicker({ value = [], onChange, exclude = [] }) {
  const [people, setPeople] = useState([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const boxRef = useRef(null);

  useEffect(() => { ememoApi.listPeople().then((r) => setPeople(r.data || [])).catch(() => setPeople([])); }, []);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const chosen = value.map((id) => people.find((p) => p.id === id)).filter(Boolean);
  const term = q.trim().toLowerCase();
  const options = people.filter((p) =>
    !value.includes(p.id) && !exclude.includes(p.id)
    && (!term || (p.full_name || '').toLowerCase().includes(term) || p.email.toLowerCase().includes(term)));

  const add = (id) => { onChange([...value, id]); setQ(''); };
  const remove = (id) => onChange(value.filter((x) => x !== id));

  return (
    <div className="relative" ref={boxRef}>
      <div
        onClick={() => setOpen(true)}
        className="flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus-within:border-brand"
      >
        {chosen.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1 rounded-md bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
            {p.full_name || p.email}
            <button type="button" onClick={(e) => { e.stopPropagation(); remove(p.id); }}
              title="เอาออก" className="text-brand/60 hover:text-red-600">
              <Icon name="x" className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={chosen.length ? 'เพิ่มอีกคน…' : 'เลือกผู้รับสำเนา (ต้องมีบัญชีในระบบ)'}
          className="min-w-[160px] flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-slate-400"
        />
      </div>

      {open && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {options.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-slate-400">
              {people.length === 0 ? 'กำลังโหลดรายชื่อ…' : 'ไม่พบผู้ใช้ที่ตรงกับคำค้น'}
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
      )}
      <p className="mt-1 text-[11px] text-slate-400">
        ผู้รับสำเนาจะได้รับอีเมลแจ้ง เปิดดูเอกสารและร่วมแสดงความเห็นได้ในหน้าเดียวกับผู้อนุมัติ
      </p>
    </div>
  );
}
