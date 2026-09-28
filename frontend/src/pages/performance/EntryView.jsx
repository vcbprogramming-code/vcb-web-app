import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { perfApi, perfPrefs } from '../../lib/performance.js';
import { useToast } from '../../components/Toast.jsx';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import Picker from './Picker.jsx';
import EmployeesPanel from './EmployeesPanel.jsx';
import { useT } from '../../lib/i18n.jsx';

const DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
// Add n days to a YYYY-MM-DD string. Built purely in UTC so it never shifts a
// day in local timezones (e.g. Asia/Bangkok UTC+7): `new Date("2026-07-10T00:00:00")`
// parses as LOCAL then toISOString() prints UTC, landing one day early. Using
// Date.UTC + UTC arithmetic keeps the edit-lock window aligned with the backend
// (which does the same string math), so cells the grid marks editable really are.
const isoAdd = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};
const dnum = (iso) => Number(iso.slice(8, 10));
const TH_MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const thaiMonthShort = (iso) => TH_MONTH_SHORT[Number(iso.slice(5, 7)) - 1] || '';

/**
 * Entry screen — record what each employee did each day. Two sub-views:
 *  • ภาพรวม (Coverage): employee×day heatmap + per-day % strip; click a cell to jump.
 *  • รายสัปดาห์ (Weekly): 7-day grid, each cell = primary task (op→team / sup→detail)
 *    + optional 2nd task (pm). Click a slot → Picker. Autosaves per field.
 */
/**
 * โน้ตของวันที่มาจากการอนุมัติคำขอลา เก็บเป็น "[LV] <ประเภท> · <เลขที่คำขอ>"
 *
 * การอนุมัติเขียนรหัส Z-2 ลงช่องงานหลักเหมือนที่ HR พิมพ์มือทุกประการ ทั้งสอง
 * กรณีจึงแยกจากกันไม่ออกถ้าไม่มี marker นี้ — จับที่ตัวอักษร [LV] เท่านั้น
 * ไม่จับข้อความไทยข้างหลัง เพราะข้อความเป็นสิ่งที่แก้คำหรือแปลได้
 */
const leaveNote = (note) => {
  const m = /^\[LV\]\s*([^·]+)(?:·\s*(.*))?$/.exec(String(note || '').trim());
  return m ? { type: m[1].trim(), ref: (m[2] || '').trim() } : null;
};


export default function EntryView({ siteKey, siteName, siteColor, cur, canEdit, isAdmin, sites = [], onPickSite }) {
  const t = useT();
  const toast = useToast();
  const [base, setBase] = useState(null);   // SiteMonth from server
  const [entries, setEntries] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('coverage');
  const [weekStart, setWeekStart] = useState(0);
  const [focus, setFocus] = useState(null);
  const [picker, setPicker] = useState(null); // { eid, date, field, anchor }
  // หน้านี้ re-render แทบทุกครั้งที่บันทึกหรือพิมพ์ ถ้าส่ง arrow function ใหม่ทุกครั้ง
  // effect ที่ผูก listener ในตัวเลือกจะถอดแล้วติดใหม่ไม่หยุด และมีจังหวะที่กลืนคลิก
  // ที่ควรพาไปขั้นที่สอง — ข้อกำหนดฟังก์ชัน §3.2.3 ระบุจุดนี้ไว้ตรง ๆ
  const closePicker = useCallback(() => setPicker(null), []);
  /**
   * สถานะการบันทึก: idle | saving | saved | error
   *
   * ระบบจริงมีสถานะที่หกคือ "แก้ไขที่ยังไม่บันทึก" (dirty) เพราะของเขาเก็บการแก้
   * ลงคิวแล้วค่อย flush ทีเดียว จึงมีช่วงที่ค่าอยู่บนจอแต่ยังไม่ได้ส่ง ของเรายิง
   * คำขอทันทีที่เลือก ช่วงนั้นจึงไม่มีจริง — ใส่ป้ายไว้ก็ไม่มีทางได้แสดง (ลองแล้ว
   * ด้วยการหน่วงคำขอ 3 วินาที ยังไม่โผล่ เพราะ React รวบ state ชุดเดียวกันก่อนวาด)
   * เก็บการยิงทันทีไว้ดีกว่า เพราะปิดจอกลางทางแล้วไม่มีงานค้างหาย
   */
  const [saveState, setSaveState] = useState('idle');
  // ผู้ดูแลระบบต้องเปิดโหมดก่อนถึงจะแก้วันที่ล็อกแล้วได้ — กันแก้โดนโดยไม่ตั้งใจ
  const [unlocked, setUnlocked] = useState(false);
  const [showEmp, setShowEmp] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const flashTimer = useRef();

  useEffect(() => {
    if (!siteKey) { setBase(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true); setError(null);
    perfApi.siteMonth(siteKey, cur.y, cur.m)
      .then((r) => {
        if (cancelled) return;
        setBase(r); setEntries(structuredClone(r.entries || {}));
        // open the weekly grid on the week that contains "today" (not always week 1),
        // so a user viewing the current month doesn't have to page forward to reach now.
        const ti = (r.days || []).findIndex((x) => x.date === r.today);
        setWeekStart(ti >= 0 ? Math.floor(ti / 7) * 7 : 0);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [siteKey, cur.y, cur.m, reloadKey]);

  const actByCode = useMemo(() => Object.fromEntries((base?.teams || []).map((a) => [a.code, a.name])), [base]);
  const catByCode = useMemo(() => Object.fromEntries((base?.costs || []).map((c) => [c.code, c.name])), [base]);

  const cellNames = perfPrefs.get().cellNames; // 'code' | 'name'
  const cellDisplay = (v) => {
    if (!v) return '';
    if (cellNames === 'code') return v;
    const a = (v.split(' / ')[0] || '').trim();
    return actByCode[a] || v;
  };
  const cellTitle = (v) => {
    if (!v) return '';
    const [a, c] = v.split(' / ').map((x) => (x || '').trim());
    const an = actByCode[a] || '', cn = c ? (catByCode[c] || '') : '';
    return (a + (an ? ' · ' + an : '')) + (c ? '   →   ' + c + (cn ? ' · ' + cn : '') : '');
  };
  const ccodes = (am, pm) => {
    const a = String(am || '').trim().split(' / ').join('/');
    const p = String(pm || '').trim().split(' / ').join('/');
    return (a && p && a !== p) ? [a, p] : [a || p].filter(Boolean);
  };

  const markSaved = () => { setSaveState('saved'); clearTimeout(flashTimer.current); flashTimer.current = setTimeout(() => setSaveState('idle'), 2500); };
  useEffect(() => () => clearTimeout(flashTimer.current), []); // clear pending flash on unmount

  // update one cell field locally + autosave. On failure revert ONLY this field
  // via a functional update — a whole-map snapshot revert would wipe any other
  // cell edited while this save was still in flight. Flash the "saved" toast only
  // after the server confirms, so a failed save can't show success + error at once.
  /**
   * รหัสงานที่อยู่ในอีกช่องของเซลล์เดียวกัน
   *
   * ใช้กันไม่ให้เลือกงานเดียวกันทั้งสองช่อง — วันเดียวที่ลงงานเดิมสองครั้งจะถูก
   * นับเป็นครึ่งวันสองท่อนของงานเดียวกัน ซึ่งไม่ได้บอกอะไรและทำให้การกระจาย
   * แรงงาน-วันลงหมวดงานเพี้ยน (กฎเดียวกับระบบที่ลูกค้าใช้อยู่)
   */
  const siblingCodeOf = (p) => {
    if (!p || !entries) return '';
    const cell = (entries[p.eid] || {})[p.date] || {};
    const other = p.field === 'pm'
      ? (cell.team || cell.detail || '')
      : (cell.pm || '');
    return String(other).split('/')[0].trim();
  };

  const setCell = (eid, date, field, value, unlock = false) => {
    const applyField = (map, v) => {
      const next = { ...map };
      const row = { ...(next[eid] || {}) };
      const cell = { ...(row[date] || {}) };
      if (v) cell[field] = v; else delete cell[field];
      if (Object.keys(cell).length) row[date] = cell; else delete row[date];
      next[eid] = row;
      return next;
    };
    const prevValue = entries[eid]?.[date]?.[field] || null;
    // ยิงคำขอทันที ไม่มีคิวรอ flush เหมือนระบบจริง จึงไม่มีช่วง "ค้างบนจอแต่ยัง
    // ไม่ได้ส่ง" ให้รายงาน — ดูเหตุผลที่ไม่มีสถานะ dirty ได้ที่ useState ด้านบน
    setSaveState('saving');
    setEntries((prev) => applyField(prev, value));
    perfApi.saveCell({ site: siteKey, eid, date, field, value, adminUnlock: unlock })
      .then(markSaved)
      .catch((e) => { setSaveState('error'); toast.error(e.message || 'บันทึกไม่สำเร็จ'); setEntries((prev) => applyField(prev, prevValue)); });
  };

  const jump = (eid, date) => {
    const idx = (base?.days || []).findIndex((x) => x.date === date);
    if (idx < 0) return;
    setWeekStart(Math.floor(idx / 7) * 7);
    setFocus({ eid, date });
    setMode('week');
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลดข้อมูลไซต์งาน…')} /></div>;
  if (error) return <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  // ไม่มีหน่วยงานที่เลือกไว้ = หน้าว่างที่บอกทางออกสองทาง (เหมือนระบบจริง)
  // หน้าว่างที่ไม่บอกอะไรอ่านเหมือนระบบเสีย
  if (!siteKey) {
    /**
     * เลือกหน่วยงานได้จากตรงนี้เลย ไม่ใช่บอกให้ไปกดที่อื่น
     *
     * เดิมเป็นการ์ดเต็มความกว้าง (1,376px) ที่มีข้อความอยู่ตรงกลาง 512px เหลือที่ว่าง
     * ข้าง ๆ 864px และทางออกที่บอกไว้อยู่คนละที่กับสายตา (ดรอปดาวน์ด้านบน หรือกลับ
     * ไปหน้าแดชบอร์ด) — คนเปิดแท็บนี้มาเพื่อจะบันทึกงาน ปุ่มที่ต้องกดจึงควรอยู่ตรงนี้
     */
    return (
      <div className="card">
        <div className="flex flex-col items-center gap-2 text-center">
          <Icon name="card" className="h-8 w-8 text-slate-300" />
          <h3 className="font-bold text-slate-700">{t('เลือกหน่วยงานเพื่อเริ่มบันทึก')}</h3>
          <p className="max-w-lg text-sm text-slate-500">
            {t('เลือกหน่วยงานด้านล่าง หรือใช้ดรอปดาวน์ หน่วยงาน ด้านบนก็ได้')}
          </p>
        </div>
        {sites.length > 0 && (
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sites.map((s) => (
              <button key={s.key} type="button" onClick={() => onPickSite?.(s.key)}
                className="card-sm card-btn border-l-4 text-left transition hover:border-brand/60 hover:shadow-sm"
                style={{ borderLeftColor: s.color || '#cbd5e1' }}>
                <span className="truncate text-sm font-semibold text-slate-800">{s.name}</span>
                {s.company && <span className="mt-0.5 truncate text-[11px] text-slate-400">{s.company}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (!base) return null;

  const { today, lockDays, days } = base;
  const cutoff = isoAdd(today, -lockDays), ahead = isoAdd(today, 1);
  const d = { ...base, entries };
  const empPanel = showEmp && (
    <EmployeesPanel siteKey={siteKey} siteName={siteName} onClose={() => setShowEmp(false)} onChanged={() => setReloadKey((k) => k + 1)} />
  );

  return (
    <div className="space-y-3">
      {/* แถบสีประจำหน่วยงาน — เปิดสลับหลายหน่วยงานทั้งวันแล้วต้องรู้ได้ทันทีว่าอยู่ที่ไหน */}
      {siteColor && <div className="h-1 rounded-full" style={{ background: siteColor }} />}
      {/* sub-view toggle + manage employees + save state */}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <div className="mb-0.5 text-[11px] font-medium text-slate-400">{t('มุมมอง')}</div>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            {/* ชื่อมุมมองตรงกับระบบจริง: ภาพรวม / รายอาทิตย์ — ไม่ชนกับแท็บใหญ่แล้ว
                เพราะแท็บใหญ่เปลี่ยนไปใช้คำว่า "แดชบอร์ด" ตามระบบจริงเช่นกัน */}
            {[['coverage', 'ภาพรวม'], ['week', 'รายอาทิตย์']].map(([k, label]) => (
              <button key={k} onClick={() => setMode(k)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${mode === k ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                {t(label)}
              </button>
            ))}
          </div>
        </div>
        {canEdit && (
          <button onClick={() => setShowEmp(true)} className="btn-outline !py-1.5 !text-sm">
            <Icon name="people" className="h-4 w-4" /> {t('จัดการพนักงาน')}
          </button>
        )}
        {/* ปุ่มส่งออก Excel อยู่ที่แถบด้านบนเพียงปุ่มเดียว — เดิมมีสองปุ่มที่เรียก
            คนละเส้นทางและได้ไฟล์หน้าตาไม่เหมือนกัน คนจึงส่งไฟล์ผิดแบบให้ลูกค้า */}
        {/* โหมดแก้ย้อนหลังของผู้ดูแลระบบ — ปิดไว้เป็นค่าเริ่มต้น ต้องกดเปิดก่อนถึงแก้วันที่ล็อกแล้วได้ */}
        {isAdmin && canEdit && (
          <button onClick={() => setUnlocked((v) => !v)}
            title={t('เฉพาะผู้ดูแลระบบ — เปิดไว้เพื่อแก้ข้อมูลของวันที่เลยกำหนดแล้ว')}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              unlocked ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
            <Icon name={unlocked ? 'undo' : 'lock'} className="h-4 w-4" />
            {unlocked ? t('แก้ไขย้อนหลังเปิดอยู่') : t('แก้ไขย้อนหลัง (ผู้ดูแลระบบ)')}
          </button>
        )}
        {/* ป้ายสถานะค้างอยู่ตลอด ไม่ใช่ข้อความวาบแล้วหาย — คนกรอกต้องรู้ได้ทุกเมื่อว่าบันทึกแล้วหรือยัง */}
        <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
          { idle: 'bg-slate-100 text-slate-500', saving: 'bg-sky-50 text-sky-700', saved: 'bg-emerald-50 text-emerald-700', error: 'bg-red-50 text-red-700' }[saveState]}`}>
          {saveState === 'saving' && <Icon name="clock" className="h-3.5 w-3.5" />}
          {saveState === 'saved' && <Icon name="check" className="h-3.5 w-3.5" />}
          {saveState === 'error' && <Icon name="warning" className="h-3.5 w-3.5" />}
          {t({ idle: 'พร้อมแก้ไข', saving: 'กำลังบันทึก…', saved: 'บันทึกแล้ว', error: 'บันทึกไม่สำเร็จ' }[saveState])}
        </span>
        {!canEdit && <span className="text-xs text-slate-400">{t('· โหมดดูอย่างเดียว')}</span>}
      </div>

      {/* คำอธิบายสีของช่อง — ของเดิมมีแต่ข้อความ ต้องเดาเองว่าสีไหนคืออะไร */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-dashed border-slate-200 pt-2 text-[11px] text-slate-500">
        {[['#fdf0d4', 'วันหยุด'], ['#1d4e89', 'วันนี้'], ['#eef2f8', 'ล็อก (อ่านอย่างเดียว · เกิน {n} วัน)'], ['#1f9d55', 'บันทึกแล้ว']].map(([c, label]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm border border-slate-200" style={{ background: c }} />
            {t(label).replace('{n}', lockDays)}
          </span>
        ))}
      </div>

      {base.employees.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <Icon name="people" className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">{t('ยังไม่มีพนักงานในไซต์นี้')}</p>
          {canEdit && <button onClick={() => setShowEmp(true)} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> {t('เพิ่มพนักงาน')}</button>}
        </div>
      ) : mode === 'coverage'
        ? <Coverage d={d} today={today} cutoff={cutoff} ahead={ahead} lockDays={lockDays} jump={jump} ccodes={ccodes} cellTitle={cellTitle} />
        : <Weekly d={d} today={today} cutoff={cutoff} ahead={ahead} lockDays={lockDays} weekStart={weekStart} setWeekStart={setWeekStart}
            focus={focus} canEdit={canEdit} isAdmin={isAdmin} unlocked={unlocked}
            openPicker={(eid, date, field, rect, unlock) => setPicker({ eid, date, field, rect, unlock })}
            cellDisplay={cellDisplay} cellTitle={cellTitle} />}

      {picker && (
        <Picker rect={picker.rect} activities={base.teams} categories={base.costs}
          siblingCode={siblingCodeOf(picker)}
          onApply={(value) => { setCell(picker.eid, picker.date, picker.field, value, picker.unlock); setPicker(null); }}
          onClose={closePicker} />
      )}
      {empPanel}
    </div>
  );
}

// ── Coverage: per-day % strip + employee×day heatmap ─────────────────────────
function Coverage({ d, today, cutoff, ahead, lockDays, jump, ccodes, cellTitle }) {
  const t = useT();
  const perDay = {};
  d.days.forEach((day) => { perDay[day.date] = { f: 0, t: 0 }; });
  d.employees.forEach((e) => {
    const aw = new Set(e.away);
    d.days.forEach((day) => {
      if (aw.has(day.date)) return;
      perDay[day.date].t++;
      const v = (d.entries[e.eid] || {})[day.date] || {};
      if (v.team || v.detail || v.pm) perDay[day.date].f++;
    });
  });

  return (
    <div className="card !p-3">
      {/* per-day % strip */}
      <div className="mb-2 overflow-x-auto">
        <div className="flex gap-1">
          {d.days.map((day) => {
            const s = perDay[day.date], pct = s.t ? Math.round((s.f / s.t) * 100) : 0;
            const isFut = day.date > ahead, isEdit = day.date >= cutoff && day.date <= ahead;
            let bg, fg = '#fff', ptxt = pct + '%';
            if (day.date === today) bg = '#1d4e89';
            else if (day.weekend) { bg = '#fdf0d4'; fg = '#6b5232'; ptxt = 'พัก'; }
            else if (isFut) { bg = '#eef2f8'; fg = '#9aa5b4'; ptxt = '—'; }
            else if (isEdit) { bg = '#e8b500'; fg = '#5a4500'; }
            else if (pct >= 100) bg = '#1f9d55';
            else bg = '#e0533a';
            return (
              <div key={day.date} className="flex w-9 shrink-0 flex-col items-center rounded-md py-1 text-center" style={{ background: bg, color: fg }}>
                <div className="text-xs font-bold leading-none">{dnum(day.date)}</div>
                <div className="text-[9px] leading-tight opacity-80">{DOW[day.dow]}</div>
                <div className="mt-0.5 text-[10px] font-semibold leading-none">{ptxt}</div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mb-2 text-[11px] text-slate-400">เหลือง = ยังแก้ได้ (ย้อนหลัง {lockDays} วัน ถึงพรุ่งนี้) · เขียว = ครบ 100% (ล็อกแล้ว) · แดง = ขาด · เทา = ยังไม่ถึงกำหนด · พัก = วันหยุด</p>

      {/* employee × day heatmap */}
      <div className="overflow-x-auto">
        <table className="border-separate" style={{ borderSpacing: '2px' }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-2 text-left text-xs font-semibold text-slate-500">{t('พนักงาน (')}{d.employees.length})</th>
              {d.days.map((day) => (
                <th key={day.date} className={`w-7 text-center text-[10px] font-semibold ${day.weekend ? 'text-amber-600' : 'text-slate-400'} ${day.date === today ? 'text-brand' : ''}`}>
                  {dnum(day.date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.employees.map((e) => {
              const op = e.kind === 'operation', by = d.entries[e.eid] || {};
              const awaySet = new Set(e.away);
              return (
                <tr key={e.eid}>
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-0.5 text-xs text-slate-700">
                    <span className={`mr-1 rounded px-1 py-0.5 text-[9px] font-bold ${op ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>{op ? 'OP' : 'SUP'}</span>
                    {e.name}
                  </td>
                  {d.days.map((day) => {
                    if (awaySet.has(day.date)) {
                      const why = e.leave?.[day.date] || t('ไม่ได้สังกัดหน่วยงานนี้');
                      return <td key={day.date} title={`${day.date} · ${why}`}><div className="flex h-7 w-7 items-center justify-center rounded text-[10px] text-slate-400" style={{ background: '#e7ebf1' }}>—</div></td>;
                    }
                    const v = by[day.date] || {};
                    const amv = v.team || v.detail || '', pmv = v.pm || '', has = !!(amv || pmv);
                    const future = day.date > ahead, locked = day.date < cutoff, editable = !future && !locked;
                    let bg, inner = null;
                    if (future) bg = '#eef2f8';
                    else if (day.weekend) { bg = '#fdf0d4'; inner = 'พัก'; }
                    else if (editable) { bg = '#e8b500'; inner = has ? ccodes(amv, pmv) : null; }
                    else if (has) { bg = '#1f9d55'; inner = ccodes(amv, pmv); }
                    else bg = '#e0533a';
                    const clickable = has || editable;
                    return (
                      <td key={day.date} title={day.date + (has ? ' · ' + cellTitle(amv) : '')}
                        onClick={() => { if (clickable) jump(e.eid, day.date); }}>
                        <div className={`flex h-7 w-7 flex-col items-center justify-center gap-px overflow-hidden rounded text-[8px] font-semibold leading-none text-white ${clickable ? 'cursor-pointer' : ''} ${day.date === today ? 'ring-2 ring-brand ring-offset-1' : ''}`}
                          style={{ background: bg }}>
                          {Array.isArray(inner) ? inner.map((c, i) => <span key={i} className="max-w-full truncate px-px">{c}</span>) : <span className="text-[9px]" style={{ color: day.weekend ? '#6b5232' : '#fff' }}>{inner}</span>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">{t('คลิกเซลล์เพื่อกระโดดไปแก้พนักงาน/วันนั้นในมุมมองสัปดาห์')}</p>
    </div>
  );
}

// ── Weekly: 7-day grid, each cell has primary + 2nd (pm) slot ─────────────────
/**
 * ช่องงานหนึ่งช่องในตารางรายสัปดาห์
 *
 * ต้องอยู่นอก Weekly — ถ้าประกาศไว้ข้างในจะกลายเป็นคอมโพเนนต์ตัวใหม่ทุกครั้งที่
 * ตารางวาดใหม่ React จึงถอดช่องทั้งหมดทิ้งแล้วสร้างใหม่ ผลคือ element ที่เพิ่ง
 * ถูกคลิกหลุดออกจากหน้าจอก่อนที่กล่องเลือกกิจกรรมจะวัดตำแหน่งได้ กล่องเลยไป
 * เกาะมุมซ้ายบนแทนที่จะโผล่ตรงช่องที่คลิก
 */
function Slot({ val, field, isSecond, weekend, locked, unlocked, future, canEdit, cellDisplay, cellTitle, onOpen }) {
  const t = useT();
  const ph = isSecond ? '+ งานที่ 2' : (weekend ? 'วันหยุด' : '+');
  // ผู้ดูแลระบบแก้ช่องที่ล็อกได้เมื่อเปิดโหมดแก้ย้อนหลังไว้เท่านั้น
  const clickable = (!locked || unlocked) && canEdit;
  // วันข้างหน้ากับวันที่เลยกำหนดไม่ใช่เรื่องเดียวกัน ถ้าบอกเหมือนกันคนจะไปกดปลดล็อก
  // แล้วก็ยังกรอกไม่ได้ (ขอบบน "ไม่เกินพรุ่งนี้" ไม่มีใครปลดได้ รวมผู้ดูแลระบบ)
  const hint = future ? t('ยังไม่ถึงกำหนด — บันทึกล่วงหน้าได้ถึงพรุ่งนี้เท่านั้น')
    : locked && !unlocked ? t('เลยกำหนดแก้ไขแล้ว — ผู้ดูแลระบบเปิดโหมดแก้ย้อนหลังได้') : undefined;
  return (
    <div
      data-slot={field}
      title={val ? cellTitle(val) : hint}
      onClick={clickable ? (ev) => onOpen(field, ev.currentTarget.getBoundingClientRect()) : undefined}
      className={`min-h-[22px] rounded px-1 py-0.5 text-[11px] leading-tight ${isSecond ? 'mt-0.5 border-t border-dashed border-slate-200 pt-1' : ''} ${
        val ? 'font-medium text-slate-800' : 'text-slate-300'
      } ${clickable ? 'cursor-pointer hover:bg-brand-tint' : ''} ${
        // ช่องว่างที่คลิกได้ต้องดูออกว่าคลิกได้ ไม่ใช่ที่ว่างเปล่า
        clickable && !val && !isSecond ? 'border border-dashed border-slate-200' : ''}`}>
      {val ? cellDisplay(val) : (clickable ? ph : '')}
    </div>
  );
}

function Weekly({ d, today, cutoff, ahead, lockDays, weekStart, setWeekStart, focus, canEdit, isAdmin, unlocked, openPicker, cellDisplay, cellTitle }) {
  const t = useT();
  const start = Math.min(Math.max(0, weekStart), Math.max(0, d.days.length - 1));
  const count = Math.min(7, d.days.length - start);
  const visible = d.days.slice(start, start + count);
  // ป้ายสัปดาห์บอกเดือนด้วย — "15 – 21" เฉย ๆ อ่านแล้วไม่รู้ว่าเดือนไหน
  const wkLabel = visible.length
    ? `${dnum(visible[0].date)} – ${dnum(visible[visible.length - 1].date)} ${thaiMonthShort(visible[visible.length - 1].date)}`
    : '';

  return (
    <div className="card !p-3">
      <div className="mb-2 flex items-center gap-2">
        <button onClick={() => setWeekStart(Math.max(0, start - 7))} disabled={start <= 0} className="btn-outline !px-2 !py-1 disabled:opacity-40" title={t('สัปดาห์ก่อนหน้า')} aria-label={t('สัปดาห์ก่อนหน้า')}><Icon name="arrowLeft" className="h-4 w-4" /></button>
        <span className="text-xs text-slate-400">{t('สัปดาห์')}</span>
        <span className="text-sm font-semibold text-slate-700">{wkLabel}</span>
        <button onClick={() => setWeekStart(Math.min(Math.max(0, d.days.length - 1), start + 7))} disabled={start + 7 >= d.days.length} className="btn-outline !px-2 !py-1 disabled:opacity-40" title={t('สัปดาห์ถัดไป')} aria-label={t('สัปดาห์ถัดไป')}><Icon name="arrowRight" className="h-4 w-4" /></button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate" style={{ borderSpacing: '3px' }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-2 text-left text-xs font-semibold text-slate-500">{t('พนักงาน (')}{d.employees.length})</th>
              {visible.map((day) => (
                <th key={day.date} className={`min-w-[92px] rounded-t px-1 py-1 text-center text-xs ${day.weekend ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-600'} ${day.date === today ? 'ring-1 ring-brand' : ''}`}>
                  {dnum(day.date)} <span className="text-[10px] font-normal">{DOW[day.dow]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.employees.map((e) => {
              const op = e.kind === 'operation';
              // ช่องงานหลักใช้คนละคอลัมน์ตามสายงาน: สายปฏิบัติการเก็บที่ team
              // สายสนับสนุนเก็บที่ detail — ตามข้อกำหนดฟังก์ชัน §3.2.2 (primaryField(kind))
              // ไม่ใช่การใช้ผิดคอลัมน์อย่างที่เคยเข้าใจ ชื่อคอลัมน์มาจากสเปรดชีตเดิม
              const primaryField = op ? 'team' : 'detail';
              const awaySet = new Set(e.away);
              return (
                <tr key={e.eid} className={focus && focus.eid === e.eid ? 'bg-brand-tint/40' : ''}>
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1 align-top text-xs text-slate-700">
                    <div><span className={`mr-1 rounded px-1 py-0.5 text-[9px] font-bold ${op ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>{op ? 'OP' : 'SUP'}</span>{e.name}</div>
                    {(e.emp_id || e.department) && <div className="pl-1 text-[10px] text-slate-400">{[e.emp_id, e.department].filter(Boolean).join(' · ')}</div>}
                    {/* ย้ายไซต์กลางเดือน — บอกว่ามาจากไหน/ไปไหน เหมือนระบบจริง */}
                    {e.moved_in && <div className="pl-1 text-[10px] font-medium text-emerald-700" title={`${t('ย้ายเข้าจาก')} ${e.moved_in_from} ${e.moved_in}`}>→ {e.moved_in_from}</div>}
                    {e.moved_out && <div className="pl-1 text-[10px] font-medium text-amber-700" title={`${t('ย้ายออกไป')} ${e.moved_out_to} ${e.moved_out}`}>{e.moved_out_to} →</div>}
                  </td>
                  {visible.map((day) => {
                    if (awaySet.has(day.date)) {
                      // วันที่คนนี้ไม่ได้สังกัดไซต์นี้ (ย้ายเข้า/ออก) หรือลาที่อนุมัติแล้ว
                      const isOut = day.date === e.moved_out;
                      const why = e.leave?.[day.date]
                        || `${t('ไม่ได้สังกัดหน่วยงานนี้')}${isOut ? ` · ${t('ย้ายออกไป')} ${e.moved_out_to}` : e.moved_in_from ? ` · ${t('ย้ายเข้าจาก')} ${e.moved_in_from}` : ''}`;
                      return (
                        <td key={day.date} title={why} className="rounded bg-slate-50 align-top">
                          {isOut && <div className="truncate px-1 text-[9px] font-bold text-slate-400">{e.moved_out_to} →</div>}
                        </td>
                      );
                    }
                    const v = (d.entries[e.eid] || {})[day.date] || {};
                    const amVal = (op ? v.team : v.detail) || '';
                    const lv = leaveNote(v.note);
                    // อดีตที่เลยกำหนด กับ อนาคตที่ยังไม่ถึงกำหนด ต้องแยกกัน — โหมดแก้
                    // ย้อนหลังของผู้ดูแลระบบปลดได้แค่อดีต เซิร์ฟเวอร์ปฏิเสธอนาคตกับทุกคน
                    // เดิมเปิดโหมดแล้วช่องของวันข้างหน้ากดได้ด้วย เลือกงานเสร็จก็เจอ
                    // ข้อความผิดพลาดเด้งขึ้นมา — ให้กดไม่ได้ตั้งแต่ต้นแล้วบอกเหตุผล
                    const future = day.date > ahead;
                    const pastLocked = day.date < cutoff;
                    const locked = pastLocked || future;
                    const canUnlock = isAdmin && unlocked && pastLocked && !future;
                    const isFocus = focus && focus.eid === e.eid && focus.date === day.date;
                    // a locked cell opened by an admin is an unlock edit — flag it so the save bypasses the window
                    const onOpen = (field, rect) => openPicker(e.eid, day.date, field, rect, canUnlock);
                    return (
                      <td key={day.date} data-cell={day.date} className={`relative rounded border align-top ${day.weekend ? 'bg-amber-50/40 dark:bg-amber-500/10' : 'bg-white'} ${locked && !canUnlock ? 'opacity-60' : ''} ${isFocus ? 'border-brand ring-1 ring-brand' : 'border-slate-100'}`}>
                        {/* กุญแจเล็ก ๆ มุมขวาบน บอกว่าช่องนี้ล็อกแล้ว ไม่ใช่แค่จางเพราะว่าง */}
                        {locked && (
                          <Icon name={future ? 'clock' : 'lock'} className={`pointer-events-none absolute right-0.5 top-0.5 h-2.5 w-2.5 ${canUnlock ? 'text-amber-500' : 'text-slate-300'}`} />
                        )}
                        <Slot val={amVal} field={primaryField} isSecond={false} weekend={day.weekend} locked={locked}
                          unlocked={canUnlock} future={future} canEdit={canEdit} cellDisplay={cellDisplay} cellTitle={cellTitle} onOpen={onOpen} />
                        <Slot val={v.pm || ''} field="pm" isSecond weekend={day.weekend} locked={locked}
                          unlocked={canUnlock} future={future} canEdit={canEdit} cellDisplay={cellDisplay} cellTitle={cellTitle} onOpen={onOpen} />
                        {lv && (
                          <div title={`${t('บันทึกอัตโนมัติจากคำขอลาที่อนุมัติแล้ว')}${lv.ref ? ` · ${lv.ref}` : ''}`}
                            className="mt-0.5 truncate rounded bg-indigo-50 px-1 text-[9px] font-medium leading-4 text-indigo-700">
                            ✓ {t(lv.type, null, 'leave')}
                          </div>
                        )}
                        {day.date === e.moved_in && (
                          <div className="mt-0.5 truncate rounded bg-emerald-50 px-1 text-[9px] font-medium leading-4 text-emerald-700"
                            title={`${t('ย้ายเข้าจาก')} ${e.moved_in_from}`}>→ {t('ย้ายเข้า')}</div>
                        )}
                        {/* ช่องที่ถูกแก้หลังจากล็อกแล้ว — ระบบจริงทำเครื่องหมายไว้ให้ตรวจย้อนได้ */}
                        {/* ป้ายนี้ต้องบอกวันที่แก้บนตัวป้ายเลย ไม่ใช่ซ่อนใน tooltip —
                            คนตรวจย้อนหลังไล่ดูทีละช่องด้วยตา ไม่ได้เอาเมาส์จี้ทุกช่อง
                            (ระบบจริงพิมพ์ "แก้ไขย้อนหลัง <วันที่> · <ผู้แก้>" ใต้ช่อง) */}
                        {d.edits?.[`${e.eid}|${day.date}`] && (
                          <div className="mt-0.5 truncate rounded bg-amber-50 px-1 text-[9px] font-medium leading-4 text-amber-700"
                            title={`${t('แก้ไขย้อนหลัง')} ${d.edits[`${e.eid}|${day.date}`].date}${d.edits[`${e.eid}|${day.date}`].by ? ` · ${t('โดย')} ${d.edits[`${e.eid}|${day.date}`].by}` : ''}`}>
                            {t('แก้ย้อนหลัง')} {d.edits[`${e.eid}|${day.date}`].date.slice(5)}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* คำอธิบายใต้ตาราง: บอกให้ครบเหมือนระบบจริง ทั้งการล็อก การบันทึกอัตโนมัติ และการนับแรงงาน-วัน */}
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        {t('คลิกช่องเพื่อเลือกกิจกรรม → หมวดงาน · บันทึกให้อัตโนมัติทันทีที่เลือก · เซลล์ที่เกิน')} {lockDays} {t('วันจะล็อกอัตโนมัติ (ผู้ดูแลระบบเปิดโหมดแก้ย้อนหลังได้)')}
        {' · '}{t('ปกติหนึ่งวันเลือกงานเดียว ถ้าทำสองงานให้เพิ่มที่ช่อง “+ งานที่ 2” — หนึ่งวันเท่ากับหนึ่งวันทำงานเสมอ ถ้าทำสองงานจะนับงานละครึ่งวัน')}
      </p>
    </div>
  );
}
