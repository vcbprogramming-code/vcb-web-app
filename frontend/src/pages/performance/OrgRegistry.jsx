import { useCallback, useEffect, useState } from 'react';
import { perfApi } from '../../lib/performance.js';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * ทะเบียนแผนกและตำแหน่ง — §2 master data.
 *
 * Two lists side by side because they are one hierarchy: a department belongs to
 * a site, a position belongs to a department. Picking a department on the left
 * is what fills the right, so the relationship is visible rather than something
 * you have to remember while switching screens.
 *
 * Nothing that has been used is deleted. §2 asks for a change to apply going
 * forward without rewriting what is already filed, so a department with people
 * under it can only be switched off — the API refuses the delete and the button
 * says so before you press it.
 */
export default function OrgRegistry({ sites }) {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const [site, setSite] = useState(() => sites?.[0]?.key || '');
  const [depts, setDepts] = useState(null);
  const [positions, setPositions] = useState([]);
  const [deptId, setDeptId] = useState(null); // which department the right-hand list belongs to
  const [showRetired, setShowRetired] = useState(false);
  const [newDept, setNewDept] = useState('');
  const [newPos, setNewPos] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    if (!site) { setDepts([]); return; }
    perfApi.departments({ site, all: showRetired ? '1' : undefined })
      .then((r) => setDepts(r.data || []))
      .catch((e) => { toast.error(e.message); setDepts([]); });
  }, [site, showRetired, toast]);
  useEffect(load, [load]);

  useEffect(() => {
    if (!deptId) { setPositions([]); return; }
    perfApi.positions({ departmentId: deptId, all: showRetired ? '1' : undefined })
      .then((r) => setPositions(r.data || []))
      .catch(() => setPositions([]));
  }, [deptId, showRetired, busy]);

  const run = async (key, fn, okMsg) => {
    setBusy(key);
    try { await fn(); if (okMsg) toast.success(okMsg); load(); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(''); }
  };

  const addDept = () => {
    if (!newDept.trim()) { toast.error(t('กรุณากรอกชื่อแผนก')); return; }
    run('dept', async () => { await perfApi.createDepartment({ site, name: newDept.trim() }); setNewDept(''); }, t('เพิ่มแผนกแล้ว'));
  };
  const addPos = () => {
    if (!deptId) { toast.error(t('เลือกแผนกทางซ้ายก่อน')); return; }
    if (!newPos.trim()) { toast.error(t('กรุณากรอกชื่อตำแหน่ง')); return; }
    run('pos', async () => { await perfApi.createPosition({ departmentId: deptId, name: newPos.trim() }); setNewPos(''); }, t('เพิ่มตำแหน่งแล้ว'));
  };

  const removeDept = async (d) => {
    if (d.people > 0) {
      toast.error(t('แผนกนี้มีพนักงานผูกอยู่ {n} คน — ปิดใช้งานแทนการลบ', { n: d.people }));
      return;
    }
    const ok = await confirm({ title: t('ลบแผนก'), message: `${d.name}`, confirmLabel: t('ลบ'), danger: true });
    if (ok) run(`d:${d.id}`, () => perfApi.deleteDepartment(d.id), t('ลบแผนกแล้ว'));
  };
  const removePos = async (p) => {
    if (p.people > 0) {
      toast.error(t('ตำแหน่งนี้มีพนักงานผูกอยู่ {n} คน — ปิดใช้งานแทนการลบ', { n: p.people }));
      return;
    }
    const ok = await confirm({ title: t('ลบตำแหน่ง'), message: `${p.name}`, confirmLabel: t('ลบ'), danger: true });
    if (ok) run(`p:${p.id}`, () => perfApi.deletePosition(p.id), t('ลบตำแหน่งแล้ว'));
  };

  const rename = async (kind, row) => {
    const name = window.prompt(kind === 'dept' ? t('ชื่อแผนกใหม่') : t('ชื่อตำแหน่งใหม่'), row.name);
    if (!name || name.trim() === row.name) return;
    const fn = kind === 'dept' ? perfApi.updateDepartment : perfApi.updatePosition;
    run(`${kind}:${row.id}`, () => fn(row.id, { name: name.trim() }), t('เปลี่ยนชื่อแล้ว'));
  };
  const toggle = (kind, row) => {
    const fn = kind === 'dept' ? perfApi.updateDepartment : perfApi.updatePosition;
    run(`${kind}:${row.id}`, () => fn(row.id, { isActive: !row.is_active }),
      row.is_active ? t('ปิดใช้งานแล้ว') : t('เปิดใช้งานแล้ว'));
  };

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-800">{t('ทะเบียนแผนกและตำแหน่ง')}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {t('แผนกสังกัดไซต์งาน · ตำแหน่งสังกัดแผนก — ที่เคยมีพนักงานผูกอยู่จะปิดใช้งานได้ แต่ลบไม่ได้ เพื่อไม่ให้ข้อมูลเดิมเปลี่ยนไป')}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">{t('ไซต์งาน')}</label>
            <select value={site} onChange={(e) => { setSite(e.target.value); setDeptId(null); }} className="field !w-56">
              {(sites || []).map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          </div>
          <label className="flex h-10 cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} />
            {t('แสดงที่ปิดใช้งานแล้ว')}
          </label>
        </div>
      </div>

      {depts === null ? <div className="flex justify-center py-10"><Spinner label={t('กำลังโหลด…')} /></div> : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* ── แผนก ── */}
          <div className="rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-100 p-3">
              <input value={newDept} onChange={(e) => setNewDept(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addDept()}
                placeholder={t('ชื่อแผนกใหม่ เช่น ฝ่ายบุคคล')} className="field flex-1" />
              <button onClick={addDept} disabled={busy === 'dept'} className="btn-primary shrink-0 disabled:opacity-40">
                <Icon name="plus" className="h-4 w-4" /> {t('เพิ่ม')}
              </button>
            </div>
            {depts.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-400">{t('ยังไม่มีแผนกในไซต์นี้')}</p>
            )}
            {depts.map((d) => (
              <div key={d.id}
                className={`flex items-center gap-2 border-b border-slate-50 px-3 py-2.5 last:border-0 ${deptId === d.id ? 'bg-brand/5' : ''}`}>
                <button onClick={() => setDeptId(d.id)} className="min-w-0 flex-1 text-left">
                  <span className={`font-medium ${d.is_active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{d.name}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {t('{p} ตำแหน่ง · {n} คน', { p: d.positions, n: d.people })}
                  </span>
                </button>
                <button onClick={() => rename('dept', d)} className="text-sm text-blue-600 hover:underline">{t('แก้ไข')}</button>
                <button onClick={() => toggle('dept', d)} className="text-sm text-slate-500 hover:underline">
                  {d.is_active ? t('ปิดใช้งาน') : t('เปิดใช้งาน', null, 'admin')}
                </button>
                <button onClick={() => removeDept(d)} className="text-sm text-red-500 hover:underline">{t('ลบ')}</button>
              </div>
            ))}
          </div>

          {/* ── ตำแหน่ง ── */}
          <div className="rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-100 p-3">
              <input value={newPos} onChange={(e) => setNewPos(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPos()}
                disabled={!deptId}
                placeholder={deptId ? t('ชื่อตำแหน่งใหม่ เช่น หัวหน้าชุด') : t('เลือกแผนกทางซ้ายก่อน')}
                className="field flex-1 disabled:bg-slate-50" />
              <button onClick={addPos} disabled={!deptId || busy === 'pos'} className="btn-primary shrink-0 disabled:opacity-40">
                <Icon name="plus" className="h-4 w-4" /> {t('เพิ่ม')}
              </button>
            </div>
            {!deptId && <p className="py-10 text-center text-sm text-slate-400">{t('เลือกแผนกทางซ้ายเพื่อดูตำแหน่ง')}</p>}
            {deptId && positions.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-400">{t('ยังไม่มีตำแหน่งในแผนกนี้')}</p>
            )}
            {positions.map((p) => (
              <div key={p.id} className="flex items-center gap-2 border-b border-slate-50 px-3 py-2.5 last:border-0">
                <span className={`min-w-0 flex-1 ${p.is_active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                  {p.name}
                  {p.people > 0 && <span className="ml-2 text-xs text-slate-400">{t('{n} คน', { n: p.people })}</span>}
                </span>
                <button onClick={() => rename('pos', p)} className="text-sm text-blue-600 hover:underline">{t('แก้ไข')}</button>
                <button onClick={() => toggle('pos', p)} className="text-sm text-slate-500 hover:underline">
                  {p.is_active ? t('ปิดใช้งาน') : t('เปิดใช้งาน', null, 'admin')}
                </button>
                <button onClick={() => removePos(p)} className="text-sm text-red-500 hover:underline">{t('ลบ')}</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
