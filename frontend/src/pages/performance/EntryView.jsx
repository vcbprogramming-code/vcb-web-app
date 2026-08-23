import { useState, useEffect, useMemo, useRef } from 'react';
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

/**
 * Entry screen — record what each employee did each day. Two sub-views:
 *  • ภาพรวม (Coverage): employee×day heatmap + per-day % strip; click a cell to jump.
 *  • รายสัปดาห์ (Weekly): 7-day grid, each cell = primary task (op→team / sup→detail)
 *    + optional 2nd task (pm). Click a slot → Picker. Autosaves per field.
 */
export default function EntryView({ siteKey, siteName, cur, canEdit, isAdmin }) {
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
  const [flash, setFlash] = useState('');
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

  const doFlash = (msg) => { setFlash(msg); clearTimeout(flashTimer.current); flashTimer.current = setTimeout(() => setFlash(''), 1400); };
  useEffect(() => () => clearTimeout(flashTimer.current), []); // clear pending flash on unmount

  // update one cell field locally + autosave. On failure revert ONLY this field
  // via a functional update — a whole-map snapshot revert would wipe any other
  // cell edited while this save was still in flight. Flash the "saved" toast only
  // after the server confirms, so a failed save can't show success + error at once.
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
    setEntries((prev) => applyField(prev, value));
    perfApi.saveCell({ site: siteKey, eid, date, field, value, adminUnlock: unlock })
      .then(() => doFlash(value ? 'บันทึกแล้ว ✓' : 'ล้างเซลล์'))
      .catch((e) => { toast.error(e.message || 'บันทึกไม่สำเร็จ'); setEntries((prev) => applyField(prev, prevValue)); });
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
  if (!siteKey) return <div className="card text-center text-sm text-slate-400">{t('เลือกไซต์งานด้านบนเพื่อเริ่มบันทึก')}</div>;
  if (!base) return null;

  const { today, lockDays, days } = base;
  const cutoff = isoAdd(today, -lockDays), ahead = isoAdd(today, 1);
  const d = { ...base, entries };
  const empPanel = showEmp && (
    <EmployeesPanel siteKey={siteKey} siteName={siteName} onClose={() => setShowEmp(false)} onChanged={() => setReloadKey((k) => k + 1)} />
  );

  return (
    <div className="space-y-3">
      {/* sub-view toggle + manage employees + flash */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {/* "ความครบถ้วน", not "ภาพรวม" — the page already carries a top-level
              ภาพรวม tab, and two tabs of the same name in one screen left no way to
              tell which view you were looking at. */}
          {[['coverage', 'ความครบถ้วน'], ['week', 'รายสัปดาห์']].map(([k, label]) => (
            <button key={k} onClick={() => setMode(k)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${mode === k ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              {label}
            </button>
          ))}
        </div>
        {canEdit && (
          <button onClick={() => setShowEmp(true)} className="btn-outline !py-1.5 !text-sm">
            <Icon name="people" className="h-4 w-4" /> {t('จัดการพนักงาน')}
          </button>
        )}
        {flash && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600">{flash}</span>}
        {!canEdit && <span className="text-xs text-slate-400">{t('· โหมดดูอย่างเดียว')}</span>}
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
            focus={focus} canEdit={canEdit} isAdmin={isAdmin} openPicker={(eid, date, field, anchor, unlock) => setPicker({ eid, date, field, anchor, unlock })}
            cellDisplay={cellDisplay} cellTitle={cellTitle} />}

      {picker && (
        <Picker anchor={picker.anchor} activities={base.teams} categories={base.costs}
          onApply={(value) => { setCell(picker.eid, picker.date, picker.field, value, picker.unlock); setPicker(null); }}
          onClose={() => setPicker(null)} />
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
                    if (awaySet.has(day.date)) return <td key={day.date}><div className="flex h-7 w-7 items-center justify-center rounded text-[10px] text-slate-400" style={{ background: '#e7ebf1' }}>—</div></td>;
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
function Weekly({ d, today, cutoff, ahead, lockDays, weekStart, setWeekStart, focus, canEdit, isAdmin, openPicker, cellDisplay, cellTitle }) {
  const t = useT();
  const start = Math.min(Math.max(0, weekStart), Math.max(0, d.days.length - 1));
  const count = Math.min(7, d.days.length - start);
  const visible = d.days.slice(start, start + count);
  const wkLabel = visible.length ? `${dnum(visible[0].date)}–${dnum(visible[visible.length - 1].date)}` : '';

  const Slot = ({ val, field, isSecond, weekend, locked, onOpen }) => {
    const ph = isSecond ? '+ งานที่ 2' : (weekend ? 'วันหยุด' : '');
    // admins may still edit locked (back-dated) cells — the save carries an
    // adminUnlock flag; everyone else can only touch cells inside the window.
    const clickable = (!locked || isAdmin) && canEdit;
    const hint = locked && isAdmin ? 'เลยกำหนดแก้ไข — ผู้ดูแลระบบแก้ได้ (ปลดล็อก)' : undefined;
    return (
      <div
        title={val ? cellTitle(val) : hint}
        onClick={clickable ? (ev) => onOpen(field, ev.currentTarget) : undefined}
        className={`min-h-[22px] rounded px-1 py-0.5 text-[11px] leading-tight ${isSecond ? 'mt-0.5 border-t border-dashed border-slate-200 pt-1' : ''} ${
          val ? 'font-medium text-slate-800' : 'text-slate-300'
        } ${clickable ? 'cursor-pointer hover:bg-brand-tint' : ''}`}>
        {val ? cellDisplay(val) : (clickable ? ph : '')}
      </div>
    );
  };

  return (
    <div className="card !p-3">
      <div className="mb-2 flex items-center gap-2">
        <button onClick={() => setWeekStart(Math.max(0, start - 7))} disabled={start <= 0} className="btn-outline !px-2 !py-1 disabled:opacity-40"><Icon name="arrowLeft" className="h-4 w-4" /></button>
        <span className="text-sm font-semibold text-slate-700">{t('วันที่')} {wkLabel}</span>
        <button onClick={() => setWeekStart(Math.min(Math.max(0, d.days.length - 1), start + 7))} disabled={start + 7 >= d.days.length} className="btn-outline !px-2 !py-1 disabled:opacity-40"><Icon name="arrowRight" className="h-4 w-4" /></button>
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
              const primaryField = op ? 'team' : 'detail';
              const awaySet = new Set(e.away);
              return (
                <tr key={e.eid} className={focus && focus.eid === e.eid ? 'bg-brand-tint/40' : ''}>
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1 align-top text-xs text-slate-700">
                    <div><span className={`mr-1 rounded px-1 py-0.5 text-[9px] font-bold ${op ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>{op ? 'OP' : 'SUP'}</span>{e.name}</div>
                    {(e.emp_id || e.department) && <div className="pl-1 text-[10px] text-slate-400">{[e.emp_id, e.department].filter(Boolean).join(' · ')}</div>}
                  </td>
                  {visible.map((day) => {
                    if (awaySet.has(day.date)) return <td key={day.date} className="rounded bg-slate-50" />;
                    const v = (d.entries[e.eid] || {})[day.date] || {};
                    const amVal = op ? (v.team || '') : (v.detail || '');
                    const locked = day.date < cutoff || day.date > ahead;
                    const isFocus = focus && focus.eid === e.eid && focus.date === day.date;
                    // a locked cell opened by an admin is an unlock edit — flag it so the save bypasses the window
                    const onOpen = (field, anchor) => openPicker(e.eid, day.date, field, anchor, locked && isAdmin);
                    return (
                      <td key={day.date} className={`rounded border align-top ${day.weekend ? 'bg-amber-50/40 dark:bg-amber-500/10' : 'bg-white'} ${locked ? 'opacity-60' : ''} ${isFocus ? 'border-brand ring-1 ring-brand' : 'border-slate-100'}`}>
                        <Slot val={amVal} field={primaryField} isSecond={false} weekend={day.weekend} locked={locked} onOpen={onOpen} />
                        <Slot val={v.pm || ''} field="pm" isSecond weekend={day.weekend} locked={locked} onOpen={onOpen} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">{t('คลิกช่องเพื่อเลือกกิจกรรม → หมวดต้นทุน · เซลล์ที่เกิน')} {lockDays} {t('วันจะล็อกอัตโนมัติ')}</p>
    </div>
  );
}
