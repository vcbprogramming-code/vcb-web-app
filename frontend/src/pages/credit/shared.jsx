import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * ของที่ทุกแท็บของวงเงินสินเชื่อใช้ร่วมกัน
 *
 * สามอย่างในนี้เคยถูกเขียนซ้ำคนละแบบในแต่ละแท็บ แล้วผู้ใช้ก็เจอว่าชื่อโครงการใน
 * ช่องเลือกของแท็บหนึ่งไม่เหมือนอีกแท็บหนึ่ง ทั้งที่เป็นโครงการเดียวกัน —
 * รูปแบบป้ายชื่อ ตัวกรองประเภทวงเงิน และการเรียงตารางจึงย้ายมาอยู่ที่เดียว
 */

// ป้ายสีตามป้ายสั้นบนเอกสาร (doc_kind) ของทะเบียนประเภทวงเงิน
export const TYPE_CHIP = {
  BG: 'bg-pink-50 text-pink-700',
  'L/G': 'bg-fuchsia-50 text-fuchsia-700',
  'T/L': 'bg-amber-50 text-amber-700',
  'B/E': 'bg-blue-50 text-blue-700',
  'P/N': 'bg-violet-50 text-violet-700',
  'M/L': 'bg-teal-50 text-teal-700',
  DLC: 'bg-sky-50 text-sky-700',
  'PN-post': 'bg-indigo-50 text-indigo-700',
};

/** `CODE · ชื่อ` — รูปแบบเดียวกันทุกช่องเลือกโครงการ ทุกแท็บ */
export const projectLabel = (p) => (p ? [p.code, p.name].filter(Boolean).join(' · ') : '—');

/**
 * ค่าในช่องเลือกประเภทวงเงิน
 *
 * ค่าธรรมดา ('4') คือเลขประเภทหนึ่งเดียว ค่าที่ขึ้นต้นด้วย 'k:' คือกลุ่มที่ใช้
 * วงเงินก้อนเดียวกันกับธนาคาร — การ์ด BG กับ B/E บนหน้าภาพรวมกดแล้วเลือกค่านี้
 * ให้ ช่องเลือกจึงเป็นที่เดียวที่บอกว่ากำลังกรองอะไรอยู่ ไม่มีตัวกรองซ่อน
 */
export const GROUP_BG = 'k:LG';
export const GROUP_BE = 'k:AVAL,LGM,DLC,PNPOST';

/** แปลงค่าในช่องเลือกเป็นพารามิเตอร์ที่ API เข้าใจ */
export function typeParams(value) {
  const v = String(value || '');
  if (!v) return {};
  if (v.startsWith('k:')) return { kinds: v.slice(2) };
  return { facilityNo: v };
}

/** ตัวเลือกในช่องกรองประเภทวงเงิน — กลุ่มรวมขึ้นก่อน แล้วค่อยแยกรายวงเงิน */
export function TypeFilterOptions({ types }) {
  const t = useT();
  return (
    <>
      <option value="">{t('ทุกประเภท')}</option>
      <optgroup label={t('รวมกลุ่มวงเงิน / Grouped')}>
        <option value={GROUP_BG}>{t('BG · วงเงินค้ำประกัน (รวมทุกวงเงิน)')}</option>
        <option value={GROUP_BE}>{t('B/E · รับรอง/อาวัล (รวม L/G วัสดุ + DLC + PN-post)')}</option>
      </optgroup>
      <optgroup label={t('แยกรายวงเงิน / Individual')}>
        {types.map((ty) => <option key={ty.no} value={ty.no}>{ty.no}. {ty.name_th}</option>)}
      </optgroup>
    </>
  );
}

/**
 * เรียงตารางด้วยการกดหัวคอลัมน์ — กดครั้งแรกน้อยไปมาก ครั้งที่สองมากไปน้อย
 * ครั้งที่สามเลิกเรียง (กลับไปลำดับตั้งต้น) เหมือน sortBy ของระบบจริง
 */
export function useSort() {
  const [state, setState] = useState({ key: null, dir: 0 });
  const toggle = useCallback((key) => setState((s) => (
    s.key === key ? { key: s.dir === 2 ? null : key, dir: (s.dir + 1) % 3 } : { key, dir: 1 }
  )), []);
  const apply = useCallback((rows, accessors) => {
    if (!state.key || !state.dir || !accessors[state.key]) return rows;
    const get = accessors[state.key];
    const sign = state.dir === 2 ? -1 : 1;
    return rows.slice().sort((a, b) => {
      const x = get(a); const y = get(b);
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * sign;
      const sx = String(x ?? '').toLowerCase(); const sy = String(y ?? '').toLowerCase();
      return sx < sy ? -sign : sx > sy ? sign : 0;
    });
  }, [state]);
  // ตัวเดียวกันตลอดจนกว่าการเรียงจะเปลี่ยน — ตารางที่ useMemo ตามตัวนี้จะได้ไม่
  // คำนวณใหม่ทุกครั้งที่หน้า re-render
  return useMemo(() => ({ state, toggle, apply }), [state, toggle, apply]);
}

/** หัวคอลัมน์ที่กดเรียงได้ พร้อมลูกศรบอกทิศทางที่กำลังเรียงอยู่ */
export function SortTh({ sort, colKey, children, className = '' }) {
  const active = sort.state.key === colKey && sort.state.dir > 0;
  return (
    <th className={`tbl-th cursor-pointer select-none ${className}`} onClick={() => sort.toggle(colKey)}
      aria-sort={active ? (sort.state.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <span className="inline-flex items-center gap-1">
        {children}
        {/* ลูกศรใช้ไอคอนเส้นเดียว ไม่ใช่อักขระ ▲▼ — ขนาดคงที่ หัวตารางจึงไม่ขยับตอนกด */}
        <Icon name="chevronDown"
          className={`h-3 w-3 transition ${active ? 'text-brand' : 'text-slate-300'} ${active && sort.state.dir === 1 ? 'rotate-180' : ''}`} />
      </span>
    </th>
  );
}

// ── ตั้งค่าแดชบอร์ด: เปิด-ปิดพาเนลรายตัว เก็บไว้ที่เครื่องของผู้ใช้ ──────────
const DASH_KEY = 'vcb_credit_dash';
export const DASH_DEFAULTS = {
  lines: { tl: true, bg: true, ml: false, be: true, pn: true },
  due: { week: false, this: true, next: true },
  status: { new: false, proposed: true, approved: true },
};
export function readDashPrefs() {
  try {
    const raw = localStorage.getItem(DASH_KEY);
    if (!raw) return DASH_DEFAULTS;
    const p = JSON.parse(raw) || {};
    return {
      lines: { ...DASH_DEFAULTS.lines, ...(p.lines || {}) },
      due: { ...DASH_DEFAULTS.due, ...(p.due || {}) },
      status: { ...DASH_DEFAULTS.status, ...(p.status || {}) },
    };
  } catch { return DASH_DEFAULTS; }
}
/** อ่าน/เขียนค่าที่ผู้ใช้เลือกไว้ — โหมดส่วนตัวเขียนไม่ได้ก็ต้องไม่ล้ม */
export function useDashPrefs() {
  const [prefs, setPrefs] = useState(readDashPrefs);
  const save = useCallback((next) => {
    setPrefs(next);
    try { localStorage.setItem(DASH_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  }, []);
  const setPanel = useCallback((group, key, on) => save({
    ...prefs, [group]: { ...prefs[group], [key]: Boolean(on) },
  }), [prefs, save]);
  return { prefs, setPanel };
}

/**
 * ช่องหมวดค่าใช้จ่าย — พิมพ์เองก็ได้ เลือกจากทะเบียนก็ได้
 *
 * ทะเบียนมีสิบแปดหมวดและยาวขึ้นเรื่อย ๆ ช่องเลือกล้วนบังคับให้เลื่อนหา ส่วนช่อง
 * พิมพ์ล้วนทำให้เกิดหมวดสะกดเพี้ยนที่หน้าสรุปนับแยกกอง ระบบจริงจึงให้ทั้งสองทาง
 * และบอกตรง ๆ เมื่อคำที่พิมพ์ไม่ตรงกับทะเบียน
 */
export function CostCategoryCombo({ value, onChange, options = [], id, placeholder }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);
  const matches = useMemo(() => {
    const q = String(value || '').trim().toLowerCase();
    return q ? options.filter((c) => c.toLowerCase().includes(q)) : options;
  }, [value, options]);
  return (
    <div className="relative" ref={box}>
      <input
        id={id} value={value} autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder || t('เช่น ทราย / ค่าแรง / คอนกรีต')}
        className="field pr-8"
      />
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={t('เลือกหมวดค่าใช้จ่าย')}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600">
        <Icon name="chevronDown" className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          {matches.length === 0 ? (
            <div className="px-2 py-2 text-xs italic text-slate-400">{t('— ไม่มีรายการที่ตรง — ใช้คำที่พิมพ์เอง')}</div>
          ) : (
            <div className="grid grid-cols-2 gap-1">
              {matches.map((c) => (
                <button key={c} type="button" title={c}
                  onClick={() => { onChange(c); setOpen(false); }}
                  className="truncate rounded-lg bg-slate-50 px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-brand-tint hover:text-brand">
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
