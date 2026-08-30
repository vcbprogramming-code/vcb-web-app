import { useEffect, useState, useRef, useCallback } from 'react';
import { performanceApi } from '../../lib/modules.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import Icon from '../../components/Icon.jsx';
import EmployeesPanel from './EmployeesPanel.jsx';
import CoverageView from './CoverageView.jsx';

const DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

export default function PerformanceGrid({ site, month, onBack }) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [grid, setGrid] = useState(null);
  const [workTypes, setWorkTypes] = useState([]);
  const [error, setError] = useState(null);
  const [view, setView] = useState('edit'); // 'edit' | 'coverage'
  const [weekStart, setWeekStart] = useState(0); // index into days, multiples of 7
  const [adminUnlock, setAdminUnlock] = useState(false);
  const [showEmployees, setShowEmployees] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved

  // local edits: { `${empId}_${ymd}`: cell }
  const [edits, setEdits] = useState({});
  const dirtyRef = useRef({});
  const saveTimer = useRef(null);

  const load = useCallback(() => {
    performanceApi.grid(site.id, month).then((r) => {
      setGrid(r.data);
      // seed edits map from existing logs
      const map = {};
      for (const l of r.data.logs) map[`${l.employee_id}_${l.ymd}`] = l;
      setEdits(map);
    }).catch((e) => setError(e.message));
    performanceApi.workTypes().then((r) => setWorkTypes(r.data)).catch(() => {});
  }, [site.id, month]);

  useEffect(() => { load(); }, [load]);

  // auto-scroll the week to today
  useEffect(() => {
    if (!grid) return;
    const idx = grid.days.findIndex((d) => d.today);
    if (idx >= 0) setWeekStart(Math.floor(idx / 7) * 7);
  }, [grid]);

  const flush = useCallback(async () => {
    const dirty = dirtyRef.current;
    const keys = Object.keys(dirty);
    if (!keys.length) return;
    const cells = keys.map((k) => dirty[k]);
    dirtyRef.current = {};
    setSaveState('saving');
    try {
      await performanceApi.saveGrid(site.id, cells, isAdmin && adminUnlock);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1500);
    } catch (e) {
      setError(e.message);
      setSaveState('idle');
    }
  }, [site.id, isAdmin, adminUnlock]);

  const queueSave = useCallback((cell) => {
    dirtyRef.current[`${cell.employeeId}_${cell.ymd}`] = cell;
    setSaveState('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 1000);
  }, [flush]);

  const updateCell = (emp, day, patch) => {
    const key = `${emp.id}_${day.ymd}`;
    const cur = edits[key] || { employee_id: emp.id, ymd: day.ymd, kind: emp.kind };
    const next = { ...cur, ...patch };
    setEdits((e) => ({ ...e, [key]: next }));
    queueSave({
      employeeId: emp.id,
      ymd: day.ymd,
      kind: emp.kind,
      team: next.team ?? null,
      workTypeId: next.work_type_id ?? null,
      workTypeName: next.work_type_name ?? null,
      otHours: next.ot_hours != null && next.ot_hours !== '' ? Number(next.ot_hours) : null,
      reason: next.reason ?? null,
      detail: next.detail ?? null,
      note: next.note ?? null,
      status: next.status ?? '',
    });
  };

  if (error && !grid) return <div className="bg-red-50 text-red-700 rounded-xl px-4 py-3">{error}</div>;
  if (!grid) return <div className="text-slate-400">กำลังโหลด…</div>;

  const weekDays = grid.days.slice(weekStart, weekStart + 7);
  const totalWeeks = Math.ceil(grid.days.length / 7);
  const curWeek = Math.floor(weekStart / 7);

  return (
    <div className="space-y-4">
      {/* header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
            <Icon name="arrowLeft" className="h-4 w-4" /> กลับแดชบอร์ด
          </button>
          <h2 className="text-lg font-bold" style={{ color: site.color }}>{site.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-sm">
            <button onClick={() => setView('edit')} className={`rounded-md px-3 py-1.5 ${view === 'edit' ? 'bg-brand text-white' : 'text-slate-600'}`}>บันทึก</button>
            <button onClick={() => setView('coverage')} className={`rounded-md px-3 py-1.5 ${view === 'coverage' ? 'bg-brand text-white' : 'text-slate-600'}`}>ความครบถ้วน</button>
          </div>
          <button onClick={() => setShowEmployees(true)} className="btn-outline"><Icon name="people" className="h-4 w-4" /> พนักงาน</button>
          <button
            onClick={async () => { const url = await performanceApi.exportUrl(site.id, month); window.open(url, '_blank'); }}
            className="btn-outline"
          ><Icon name="download" className="h-4 w-4" /> Export</button>
        </div>
      </div>

      {view === 'coverage' ? (
        <CoverageView siteId={site.id} month={month} />
      ) : (
        <>
          {/* week nav + save state */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <button disabled={curWeek <= 0} onClick={() => setWeekStart(Math.max(0, weekStart - 7))} className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40 hover:bg-slate-50"><Icon name="arrowLeft" className="h-4 w-4" /></button>
              <span className="text-slate-500">สัปดาห์ {curWeek + 1}/{totalWeeks}</span>
              <button disabled={curWeek >= totalWeeks - 1} onClick={() => setWeekStart(Math.min((totalWeeks - 1) * 7, weekStart + 7))} className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40 hover:bg-slate-50"><Icon name="arrowRight" className="h-4 w-4" /></button>
              {isAdmin && (
                <label className="ml-3 inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <input type="checkbox" checked={adminUnlock} onChange={(e) => setAdminUnlock(e.target.checked)} /> ปลดล็อกแก้ย้อนหลัง
                </label>
              )}
            </div>
            <span className="text-xs text-slate-400">
              {saveState === 'saving' ? '💾 กำลังบันทึก…' : saveState === 'saved' ? '✓ บันทึกแล้ว' : ''}
            </span>
          </div>

          {/* grid */}
          <div className="card !p-0 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="tbl-head">
                  <th className="tbl-th sticky left-0 z-10 bg-slate-50 min-w-[180px]">พนักงาน</th>
                  {weekDays.map((d) => (
                    <th key={d.ymd} className={`px-2 py-2 text-center font-semibold ${d.today ? 'bg-brand/10 text-brand' : d.weekend ? 'text-slate-300' : 'text-slate-500'}`}>
                      <div>{DOW[new Date(d.ymd).getDay()]}</div>
                      <div className="text-base">{d.day}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grid.employees.map((emp) => (
                  <tr key={emp.id} className="align-top">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 border-r border-slate-100">
                      <div className="font-medium text-slate-800">{emp.full_name}</div>
                      <div className="text-[11px] text-slate-400">{emp.kind === 'operation' ? 'ปฏิบัติการ' : 'สนับสนุน'}{emp.team ? ` · ${emp.team}` : ''}</div>
                    </td>
                    {weekDays.map((d) => {
                      const cell = edits[`${emp.id}_${d.ymd}`] || {};
                      const locked = d.locked && !(isAdmin && adminUnlock);
                      return (
                        <td key={d.ymd} className={`p-1 ${d.today ? 'bg-brand/5' : d.weekend ? 'bg-slate-50/50' : ''}`}>
                          <CellEditor
                            emp={emp}
                            cell={cell}
                            locked={locked}
                            future={d.future}
                            workTypes={workTypes}
                            onChange={(patch) => updateCell(emp, d, patch)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {grid.employees.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400">ยังไม่มีพนักงานในหน่วยงานนี้ — กด "พนักงาน" เพื่อเพิ่ม</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showEmployees && (
        <EmployeesPanel site={site} workTypes={workTypes} onClose={() => setShowEmployees(false)} onChanged={load} />
      )}
    </div>
  );
}

/** One editable cell. Operation: OT + work-type. Support: diary detail. */
function CellEditor({ emp, cell, locked, future, workTypes, onChange }) {
  const [showPicker, setShowPicker] = useState(false);
  const isOff = cell.status === 'off';
  const isLeave = cell.status === 'leave';

  if (future) return <div className="h-12 rounded-md bg-slate-50/40" />;

  const cycleStatus = () => {
    const next = cell.status === '' ? 'leave' : cell.status === 'leave' ? 'off' : '';
    onChange({ status: next });
  };

  return (
    <div className={`relative min-w-[120px] rounded-md border p-1 ${locked ? 'border-slate-100 bg-slate-50' : 'border-slate-200'} ${isLeave ? 'bg-amber-50' : isOff ? 'bg-slate-100' : ''}`}>
      <button
        onClick={cycleStatus}
        disabled={locked}
        className="absolute right-1 top-1 text-[10px] text-slate-300 hover:text-slate-500"
        title="คลิกสลับ: ทำงาน → ลา → พัก"
      >
        {isLeave ? 'ลา' : isOff ? 'พัก' : '•'}
      </button>
      {isOff ? (
        <div className="py-2 text-center text-[11px] text-slate-400">พัก</div>
      ) : emp.kind === 'operation' ? (
        <div className="space-y-1">
          <button
            disabled={locked}
            onClick={() => setShowPicker((s) => !s)}
            className="w-full truncate rounded bg-slate-50 px-1.5 py-1 text-left text-[11px] text-slate-600 hover:bg-slate-100"
          >
            {cell.work_type_name || 'เลือกงาน…'}
          </button>
          {showPicker && (
            <WorkTypePicker
              workTypes={workTypes}
              onPick={(w) => { onChange({ work_type_id: w?.id || null, work_type_name: w?.name || null }); setShowPicker(false); }}
            />
          )}
          <input
            disabled={locked}
            type="number"
            step="0.5"
            placeholder="OT (ชม.)"
            value={cell.ot_hours ?? ''}
            onChange={(e) => onChange({ ot_hours: e.target.value })}
            className="w-full rounded border border-slate-200 px-1.5 py-0.5 text-[11px] disabled:bg-slate-50"
          />
        </div>
      ) : (
        <textarea
          disabled={locked}
          rows={2}
          placeholder="รายละเอียดงาน…"
          value={cell.detail ?? ''}
          onChange={(e) => onChange({ detail: e.target.value })}
          className="w-full resize-none rounded border border-slate-200 px-1.5 py-1 text-[11px] disabled:bg-slate-50"
        />
      )}
    </div>
  );
}

/** Searchable, category-grouped work-type popover. */
function WorkTypePicker({ workTypes, onPick }) {
  const [q, setQ] = useState('');
  const filtered = workTypes.filter((w) =>
    !q || w.name.toLowerCase().includes(q.toLowerCase()) || (w.code || '').toLowerCase().includes(q.toLowerCase())
  );
  const byCat = {};
  for (const w of filtered) (byCat[w.category] ||= []).push(w);
  return (
    <div className="absolute left-0 top-full z-20 mt-1 max-h-56 w-56 overflow-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหางาน…" className="mb-1 w-full rounded border border-slate-200 px-2 py-1 text-xs" />
      <button onClick={() => onPick(null)} className="block w-full rounded px-2 py-1 text-left text-xs text-slate-400 hover:bg-slate-50">— ล้าง —</button>
      {Object.entries(byCat).map(([cat, items]) => (
        <div key={cat}>
          <div className="px-2 pt-1 text-[10px] font-semibold uppercase text-slate-400">{cat}</div>
          {items.map((w) => (
            <button key={w.id} onClick={() => onPick(w)} className="block w-full truncate rounded px-2 py-1 text-left text-xs text-slate-700 hover:bg-brand/10 hover:text-brand">
              {w.name}
            </button>
          ))}
        </div>
      ))}
      {filtered.length === 0 && <div className="px-2 py-2 text-center text-xs text-slate-400">ไม่พบ</div>}
    </div>
  );
}
