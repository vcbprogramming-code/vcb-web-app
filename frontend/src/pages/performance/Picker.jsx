import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useT } from '../../lib/i18n.jsx';

/**
 * Two-step searchable picker (port of the reference oppOpen/oppRender flow).
 * Step 1 = กิจกรรม (Activity), Step 2 = หมวดงาน (Cost Category). A one-to-one
 * activity skips step 2 and auto-applies its fixed cost. Stored value = "A-1 / 5".
 * Floats next to `anchor`; onApply('') clears the cell.
 */
export default function Picker({ anchor, activities, categories, onApply, onClose }) {
  const t = useT();
  const [step, setStep] = useState(1);
  const [q, setQ] = useState('');
  const [pending, setPending] = useState(null);
  const boxRef = useRef(null);
  const searchRef = useRef(null);
  const [pos, setPos] = useState({ left: 0, top: 0, width: 360, maxHeight: 460 });

  useLayoutEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight, margin = 8, gap = 4;
    const w = Math.min(560, vw - 2 * margin);
    const left = Math.max(margin, Math.min(r.left, vw - w - margin));
    const spaceBelow = vh - r.bottom - margin - gap;
    const spaceAbove = r.top - margin - gap;
    let h, top;
    if (Math.max(spaceBelow, spaceAbove) < 260) { h = Math.min(460, vh - 2 * margin); top = Math.max(margin, Math.round((vh - h) / 2)); }
    else if (spaceBelow >= spaceAbove) { h = Math.min(460, spaceBelow); top = r.bottom + gap; }
    else { h = Math.min(460, spaceAbove); top = Math.max(margin, r.top - gap - h); }
    setPos({ left, top, width: w, maxHeight: h });
  }, [anchor, step]);

  useEffect(() => { searchRef.current?.focus(); }, [step]);
  // ตัวปิดเมื่อคลิกนอกกล่องต้องทำงานที่ capture phase
  //
  // กดรายการที่เป็น one-to-many แล้ว pick() เรียก setStep(2) ทันทีใน discrete
  // event — React 18 flush แบบ synchronous ไม่ batch แถวขั้นที่หนึ่งจึงถูกถอด
  // ออกจาก DOM ไปแล้วก่อนที่ listener แบบ bubble บน document จะได้ทำงาน พอถึง
  // คิว .contains() ก็ตอบ false อย่างถูกต้องตามสิ่งที่มันเห็น เพราะ node นั้น
  // ไม่อยู่ใน DOM แล้ว ผลคือกล่องปิดแทนที่จะไปขั้นที่สอง
  //
  // capture phase ทำงานขาลง ก่อน React จะ dispatch และก่อน node ถูกถอด จึงเห็น
  // DOM ตามสภาพจริงตอนที่เมาส์กดลงเสมอ — ข้อกำหนดฟังก์ชัน §3.2.3 บันทึกบั๊กนี้ไว้
  useEffect(() => {
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') { if (step === 2) { setStep(1); setQ(''); } else onClose(); } };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [step, onClose]);

  // ขั้นที่สองต้องเหลือเฉพาะหมวดต้นทุนที่รหัสงานนั้นใช้ได้จริง (allowed_cost)
  // ระบบเดิมของลูกค้ากรองตรงนี้ การปล่อยให้เลือกได้ทุกหมวดทำให้ค่าแรงลงผิดหมวด
  // โดยไม่มีอะไรฟ้อง — รหัสที่ไม่ระบุไว้ (กลุ่ม Z) ยังเลือกได้ทั้งหมดตามเดิม
  const allowed = String(pending?.allowed_cost || '').split(',').map((x) => x.trim()).filter(Boolean);
  const allowedCats = allowed.length ? categories.filter((c) => allowed.includes(String(c.code))) : categories;
  const items = step === 1 ? activities : allowedCats;
  const query = q.trim().toLowerCase();
  const filtered = query
    ? items.filter((it) => [it.name, it.desc, it.category, it.code].some((x) => String(x || '').toLowerCase().includes(query)))
    : items;

  const groups = {}; const order = [];
  filtered.forEach((it) => {
    const c = step === 1 ? (String(it.category || '').trim() || 'อื่น ๆ') : 'หมวดต้นทุน';
    if (!groups[c]) { groups[c] = []; order.push(c); }
    groups[c].push(it);
  });

  const pick = (it) => {
    if (step === 1) {
      const oneToOne = (it.mapping || 'one-to-many') === 'one-to-one';
      if (oneToOne) { onApply(it.fixed_cost ? `${it.code} / ${it.fixed_cost}` : it.code); return; }
      setPending(it); setStep(2); setQ('');
    } else {
      onApply(`${pending ? pending.code : ''} / ${it.code}`);
    }
  };

  return (
    <div ref={boxRef} className="fixed z-[60] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      style={{ left: pos.left, top: pos.top, width: pos.width, maxHeight: pos.maxHeight }}>
      <div className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold ${step === 2 ? 'cursor-pointer text-brand' : 'text-slate-700'} bg-slate-50 border-b border-slate-200`}
        onMouseDown={(e) => { e.preventDefault(); if (step === 2) { setStep(1); setQ(''); } }}>
        {step === 1
          ? <><span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand">1/2</span> {t('เลือกกิจกรรม')}</>
          : <>
              <span className="text-lg leading-none">‹</span>
              <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand">2/2</span>
              {t('เลือกหมวดต้นทุน · งาน:')} <b>{pending?.code}</b>
              {allowed.length > 0 && (
                <span className="ml-auto text-[11px] font-normal text-slate-400">
                  {t('ใช้ได้ {n} หมวด', { n: allowed.length })}
                </span>
              )}
            </>}
      </div>
      <div className="flex items-center gap-2 border-b border-slate-100 px-2 py-1.5">
        <input ref={searchRef} type="text" placeholder={t('ค้นหา…')} autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
        <span className="shrink-0 text-[11px] text-slate-400">{filtered.length}/{items.length}</span>
        <button onMouseDown={(e) => { e.preventDefault(); onApply(''); }} className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">{t('ล้าง')}</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {order.length === 0
          ? <div className="px-3 py-6 text-center text-sm text-slate-400">{t('ไม่พบรายการ "')}{q}"</div>
          : order.map((c) => (
            <div key={c}>
              <div className="sticky top-0 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{c}</div>
              {groups[c].map((it) => {
                const oneToOne = step === 1 && (it.mapping || 'one-to-many') === 'one-to-one';
                return (
                  <div key={it.code} onMouseDown={(e) => { e.preventDefault(); pick(it); }}
                    className="cursor-pointer px-3 py-1.5 hover:bg-brand-tint">
                    <div className="flex items-center gap-1.5 text-sm text-slate-800">
                      {it.code && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-600">{it.code}</span>}
                      {step === 1 && it.code && (
                        <span title={oneToOne ? 'กำหนดต้นทุนอัตโนมัติ · ขั้นตอนเดียว' : 'เลือกหมวดต้นทุนต่อ · 2 ขั้นตอน'}
                          className={`inline-block h-1.5 w-1.5 rounded-full ${oneToOne ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                      )}
                      <span className="truncate">{it.name}</span>
                    </div>
                    {it.desc && <div className="truncate pl-1 text-xs text-slate-400">{it.desc}</div>}
                  </div>
                );
              })}
            </div>
          ))}
      </div>
    </div>
  );
}
