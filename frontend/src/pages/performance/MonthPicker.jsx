import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { perfPrefs } from '../../lib/performance.js';
import { useT } from '../../lib/i18n.jsx';

export const THAI_MONTH_NAME = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const THAI_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** ปีแรกที่ระบบมีข้อมูล — ตรงกับระบบจริง (FIRST_YEAR_G) */
const FIRST_YEAR = 2026;

/** ปีที่แสดงตามค่าที่ตั้งไว้: พุทธศักราชเป็นค่าเริ่มต้น */
export const showYear = (y, fmt) => (fmt === 'ce' ? String(y) : String(y + 543));
/**
 * ชื่อเดือนภาษาไทย — ตัวช่วยล้วน ไม่แปลเอง
 *
 * การแปลทำที่จุดที่ render (กฎของโครงการ) ผู้เรียกจึงห่อค่าที่ได้ด้วยฟังก์ชันแปล
 * ของตัวเอง ส่วนปีที่ส่งไปเซิร์ฟเวอร์ยังเป็น ค.ศ. เสมอ ไม่ว่าจะแสดงเป็นแบบไหน
 */
export const monthName = (m) => THAI_MONTH_NAME[m - 1];

/**
 * ตัวเลือกเดือนแบบระบบที่ลูกค้าใช้อยู่ — ‹ ปุ่มเปิดปฏิทิน ›
 *
 * กดปุ่มกลางแล้วได้ป็อปโอเวอร์: แท็บปีอยู่ด้านบน ตารางเดือน 3×4 อยู่ด้านล่าง
 * ลูกศรซ้าย-ขวายังเดินทีละเดือนเหมือนเดิม เพราะคนที่ชินกับของเก่าใช้แบบนั้น
 * เดือนอนาคตกดไม่ได้ — บันทึกล่วงหน้าเกินพรุ่งนี้ไม่ได้อยู่แล้ว
 */
export default function MonthPicker({ cur, onChange, className = '' }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [tabYear, setTabYear] = useState(cur.y);
  const wrapRef = useRef(null);
  const fmt = perfPrefs.get().yearFmt;

  const now = useMemo(() => new Date(), []);
  const thisY = now.getFullYear();
  const thisM = now.getMonth() + 1;

  // แท็บปี: ย้อนได้ 2 ปีจากปีที่กำลังดู ไม่เกินปีนี้ และไม่ต่ำกว่าปีแรกที่มีข้อมูล
  const years = useMemo(() => {
    const out = [];
    for (let i = -2; i <= 0; i += 1) {
      const y = cur.y + i;
      if (y < FIRST_YEAR || y > thisY) continue;
      out.push(y);
    }
    if (!out.includes(thisY) && thisY >= FIRST_YEAR) out.push(thisY);
    return out;
  }, [cur.y, thisY]);

  useEffect(() => { if (open) setTabYear(years.includes(cur.y) ? cur.y : years[years.length - 1]); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ปิดเมื่อคลิกนอกกล่องหรือกด Escape — ป็อปโอเวอร์ที่ปิดไม่ได้คือกล่องที่ค้างจอ
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const step = (delta) => {
    const d = new Date(cur.y, cur.m - 1 + delta, 1);
    onChange({ y: d.getFullYear(), m: d.getMonth() + 1 });
  };
  const arrow = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700';

  return (
    <div ref={wrapRef} className={`relative inline-flex items-center gap-1.5 ${className}`}>
      <button type="button" onClick={() => step(-1)} aria-label={t('เดือนก่อนหน้า')} title={t('เดือนก่อนหน้า')} className={arrow}>
        <Icon name="arrowLeft" className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="true" aria-expanded={open}
        title={t('เลือกเดือน')}
        className="inline-flex min-w-[150px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-brand transition hover:bg-slate-50">
        <Icon name="calendar" className="h-4 w-4" />
        {t(monthName(cur.m))} {showYear(cur.y, fmt)}
        <Icon name="chevronDown" className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <button type="button" onClick={() => step(1)} aria-label={t('เดือนถัดไป')} title={t('เดือนถัดไป')} className={arrow}>
        <Icon name="arrowRight" className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-[18rem] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="mb-2 flex gap-1 border-b border-slate-100 pb-2">
            {years.map((y) => (
              <button key={y} type="button" onClick={() => setTabYear(y)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-semibold transition ${
                  y === tabYear ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                {showYear(y, fmt)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1">
            {THAI_SHORT.map((label, i) => {
              const m = i + 1;
              const future = tabYear > thisY || (tabYear === thisY && m > thisM);
              const on = tabYear === cur.y && m === cur.m;
              const isNow = tabYear === thisY && m === thisM;
              return (
                <button key={m} type="button" disabled={future}
                  onClick={() => { onChange({ y: tabYear, m }); setOpen(false); }}
                  className={`rounded-lg px-2 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-35 ${
                    on ? 'bg-brand text-white'
                      : isNow ? 'border border-brand/40 text-brand hover:bg-brand/5'
                        : 'text-slate-600 hover:bg-slate-100'}`}>
                  {t(label)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
