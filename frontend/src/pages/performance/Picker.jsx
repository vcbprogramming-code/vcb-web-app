import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useT } from '../../lib/i18n.jsx';

/**
 * Two-step searchable picker (port of the reference oppOpen/oppRender flow).
 * Step 1 = กิจกรรม (Activity), Step 2 = หมวดงาน (Work Category). A one-to-one
 * activity skips step 2 and auto-applies its fixed cost. Stored value = "A-1 / 5".
 * ลอยอยู่ข้างช่องที่คลิก โดยรับ `rect` = พิกัดที่วัดไว้ตอนคลิก ไม่ใช่ตัว element
 * เพราะตารางอาจวาดใหม่จน element เดิมหลุดออกจากหน้าจอก่อนกล่องจะวัดตำแหน่งได้
 * (เคยทำให้กล่องไปเกาะมุมซ้ายบนทุกครั้ง) onApply('') = ล้างค่าในช่อง
 */
export default function Picker({ rect, activities, categories, siblingCode = '', onApply, onClose }) {
  const t = useT();
  const [step, setStep] = useState(1);
  const [warn, setWarn] = useState('');
  const [q, setQ] = useState('');
  const [pending, setPending] = useState(null);
  // แถวที่ลูกศรขึ้น-ลงชี้อยู่ — ของเขาเลื่อนด้วยคีย์บอร์ดแล้ว Enter เลือกได้ (oppKey)
  // คนกรอกทั้งวันไม่ได้ยกมือไปจับเมาส์ทุกช่อง
  const [kbd, setKbd] = useState(0);
  const boxRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  // pick() ถูกสร้างใหม่ทุกครั้งที่วาด ผูก listener ตรง ๆ จะถอด-ติดใหม่ไม่หยุด
  const pickRef = useRef(null);
  const [pos, setPos] = useState({ left: 0, top: 0, width: 360, maxHeight: 460 });

  useLayoutEffect(() => {
    const place = () => {
      const vw = window.innerWidth, vh = window.innerHeight, margin = 8, gap = 4;
      const w = Math.min(560, vw - 2 * margin);
      const h0 = Math.min(460, vh - 2 * margin);
      // วัดตำแหน่งไม่ได้ (ไม่มีพิกัด หรือพิกัดเป็นศูนย์) → วางกลางจอ ดีกว่าไปกองมุมซ้ายบน
      if (!rect || (!rect.width && !rect.height)) {
        setPos({ left: Math.round((vw - w) / 2), top: Math.max(margin, Math.round((vh - h0) / 2)), width: w, maxHeight: h0 });
        return;
      }
      const left = Math.max(margin, Math.min(rect.left, vw - w - margin));
      const spaceBelow = vh - rect.bottom - margin - gap;
      const spaceAbove = rect.top - margin - gap;
      let h, top;
      if (Math.max(spaceBelow, spaceAbove) < 260) { h = h0; top = Math.max(margin, Math.round((vh - h) / 2)); }
      else if (spaceBelow >= spaceAbove) { h = Math.min(460, spaceBelow); top = rect.bottom + gap; }
      else { h = Math.min(460, spaceAbove); top = Math.max(margin, rect.top - gap - h); }
      setPos({ left, top, width: w, maxHeight: h });
    };
    place();
    // เลื่อนตารางหรือย่อ-ขยายหน้าต่างแล้วกล่องต้องไม่ค้างอยู่ที่เดิมจนหลุดจอ
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [rect, step]);

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

  // ขั้นที่สองต้องเหลือเฉพาะหมวดงานที่รหัสงานนั้นใช้ได้จริง (allowed_cost)
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
    // 'อื่น ๆ' ตรงนี้เป็นหัวกลุ่มบนจอล้วน ๆ (กิจกรรมที่ไม่ได้ระบุหมวดหมู่) ไม่ได้ถูก
    // เก็บลงฐานและไม่ได้อ่านกลับ จึงเว้นวรรคตามหลักภาษาไทยได้ — ต่างจากประเภทการลา
    // 'อื่นๆ' ที่เป็นค่า ต้องสะกดตรงตัวอักษรกับระบบจริง (ดู LEAVE_TYPES_TH)
    const c = step === 1 ? (String(it.category || '').trim() || 'อื่น ๆ') : 'หมวดงาน';
    if (!groups[c]) { groups[c] = []; order.push(c); }
    groups[c].push(it);
  });
  // ลำดับแบนตามที่ตาเห็นจริง (เรียงตามกลุ่ม) ลูกศรจึงเดินตามลำดับบนจอ
  const flat = order.flatMap((c) => groups[c]);

  // ลูกศรขึ้น-ลง เลื่อนแถวที่ชี้ · Enter เลือกแถวนั้น — เหมือน oppKey ของระบบจริง
  // ผูกไว้หลังจากคำนวณ flat แล้ว เพราะต้องรู้ว่ามีกี่แถวจริง ๆ หลังกรองคำค้น
  useEffect(() => {
    const onNav = (e) => {
      if (!flat.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setKbd((i) => {
          const n = e.key === 'ArrowDown' ? i + 1 : i - 1;
          return (n + flat.length) % flat.length;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        pickRef.current?.(flat[Math.min(kbd, flat.length - 1)]);
      }
    };
    document.addEventListener('keydown', onNav);
    return () => document.removeEventListener('keydown', onNav);
  }, [flat, kbd]);
  // พิมพ์คำค้นใหม่แล้วรายการเปลี่ยน ตัวชี้ต้องกลับไปแถวแรก ไม่ใช่ค้างเลยท้ายรายการ
  useEffect(() => { setKbd(0); }, [q, step]);
  // เลื่อนแถวที่ชี้ให้อยู่ในสายตา ไม่งั้นกดลูกศรลงไปเรื่อย ๆ แล้วไม่เห็นว่าอยู่ไหน
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-kbd="1"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [kbd]);

  const pick = (it) => {
    if (step === 1) {
      // ห้ามลงงานเดียวกันทั้งสองช่องของวันเดียว — จะกลายเป็นครึ่งวันสองครั้ง
      // ของงานเดิม ซึ่งไม่ได้บอกอะไรและทำให้การกระจายแรงงาน-วันเพี้ยน
      if (siblingCode && it.code === siblingCode) {
        setWarn(t('งานทั้งสองช่องเหมือนกัน — เลือกงานคนละประเภทเพื่อบันทึก 2 งาน'));
        return;
      }
      // งานที่ใช้หมวดงานได้หมวดเดียว ไม่ต้องถามขั้นที่สอง
      const only = String(it.allowed_cost || '').split(',').map((x) => x.trim()).filter(Boolean);
      const oneToOne = (it.mapping || 'one-to-many') === 'one-to-one';
      if (oneToOne) { onApply(it.fixed_cost ? `${it.code} / ${it.fixed_cost}` : it.code); return; }
      if (only.length === 1) { onApply(`${it.code} / ${only[0]}`); return; }
      // ยังไม่มีทะเบียนหมวดงานเลย — ขั้นที่สองจะเป็นรายการเปล่าที่ไปต่อไม่ได้
      // ระบบจริงลงรหัสงานเปล่าให้แล้วบอกทางไปเพิ่มหมวดงาน ทำเหมือนกัน ไม่ใช่
      // ปล่อยให้คนกรอกค้างอยู่หน้ารายการว่างโดยไม่รู้ว่าต้องทำอะไร
      if (!categories.length) {
        onApply(it.code);
        return;
      }
      setPending(it); setStep(2); setQ(''); setKbd(0);
    } else {
      onApply(`${pending ? pending.code : ''} / ${it.code}`);
    }
  };
  pickRef.current = pick;

  return (
    <div ref={boxRef} className="fixed z-[60] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      style={{ left: pos.left, top: pos.top, width: pos.width, maxHeight: pos.maxHeight }}>
      {warn && (
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{warn}</div>
      )}
      {/* ยังไม่มีทะเบียนหมวดงาน — บอกล่วงหน้าว่าจะได้แต่รหัสงาน และบอกทางไปเพิ่ม */}
      {step === 1 && !categories.length && (
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {t('ยังไม่มีรายการหมวดงาน — เพิ่มได้ที่ ดัชนีงาน › แท็บ หมวดงาน')}
        </div>
      )}
      <div className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold ${step === 2 ? 'cursor-pointer text-brand' : 'text-slate-700'} bg-slate-50 border-b border-slate-200`}
        onMouseDown={(e) => { e.preventDefault(); if (step === 2) { setStep(1); setQ(''); } }}>
        {step === 1
          ? <><span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand">1/2</span> {t('เลือกกิจกรรม')}</>
          : <>
              <span className="text-lg leading-none">‹</span>
              <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand">2/2</span>
              {t('เลือกหมวดงาน · งาน:')} <b>{pending?.code}</b>
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
        <button onMouseDown={(e) => { e.preventDefault(); onApply(''); }} title={t('ล้างเซลล์')}
          className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">{t('ล้าง')}</button>
      </div>
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-1">
        {order.length === 0
          ? <div className="px-3 py-6 text-center text-sm text-slate-400">{t('ไม่พบรายการที่ตรงกับ “{q}”', { q })}</div>
          : order.map((c) => (
            <div key={c}>
              <div className="sticky top-0 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{c}</div>
              {groups[c].map((it) => {
                const oneToOne = step === 1 && (it.mapping || 'one-to-many') === 'one-to-one';
                const onKbd = flat[Math.min(kbd, flat.length - 1)] === it;
                return (
                  <div key={it.code} data-pick-code={it.code} data-kbd={onKbd ? '1' : undefined}
                    onMouseDown={(e) => { e.preventDefault(); pick(it); }}
                    className={`cursor-pointer px-3 py-1.5 hover:bg-brand-tint ${onKbd ? 'bg-brand-tint' : ''}`}>
                    <div className="flex items-center gap-1.5 text-sm text-slate-800">
                      {it.code && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-600">{it.code}</span>}
                      {step === 1 && it.code && (
                        <span title={oneToOne ? 'กำหนดหมวดงานอัตโนมัติ · ขั้นตอนเดียว' : 'เลือกหมวดงานต่อ · 2 ขั้นตอน'}
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
