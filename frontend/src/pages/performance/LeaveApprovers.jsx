import { useEffect, useMemo, useState } from 'react';
import { perfApi } from '../../lib/performance.js';
import { useToast } from '../../components/Toast.jsx';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * ใครอนุมัติการลาของใคร.
 *
 * Laid out the way the client described it — "หัวหน้ามีลูกน้องเป็นใครบ้าง" — so
 * you pick the supervisor and tick their people, rather than opening 40 employees
 * one at a time to say who their boss is.
 *
 * An employee nobody is assigned to is called out plainly: their requests still
 * work, they just land on the admins, which is a fallback and not a plan.
 */
export default function LeaveApprovers() {
  const t = useT();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [who, setWho] = useState('');
  const [picked, setPicked] = useState(new Set());
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => perfApi.leaveApprovers().then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!data || !who) { setPicked(new Set()); return; }
    setPicked(new Set(data.pairs.filter((p) => p.approver_id === who).map((p) => p.employee_id)));
  }, [who, data]);

  const teamSize = useMemo(() => {
    const m = new Map();
    (data?.pairs || []).forEach((p) => m.set(p.approver_id, (m.get(p.approver_id) || 0) + 1));
    return m;
  }, [data]);

  const unassigned = useMemo(() => new Set(data?.unassigned || []), [data]);

  if (error) return <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!data) return <div className="flex justify-center py-12"><Spinner label={t('กำลังโหลด…')} /></div>;

  const term = q.trim().toLowerCase();
  const list = data.employees.filter((e) => !term
    || e.full_name.toLowerCase().includes(term)
    || (e.site_name || '').toLowerCase().includes(term)
    || (e.employee_code || '').toLowerCase().includes(term));

  const toggle = (id) => setPicked((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const save = async () => {
    setBusy(true);
    try {
      await perfApi.setLeaveApprover(who, [...picked]);
      toast.success(t('บันทึกผู้อนุมัติแล้ว'));
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-800">{t('ผู้อนุมัติการลา')}</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          {t('เลือกหัวหน้าหนึ่งคน แล้วติ๊กว่าใครเป็นลูกน้อง — หัวหน้าจะเห็นเฉพาะคำขอลาของคนที่ติ๊กไว้ · พนักงานหนึ่งคนมีหัวหน้าได้มากกว่าหนึ่ง เผื่อหัวหน้าลาแล้วงานไม่ค้าง')}
        </p>
      </div>

      {data.employees.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
          {t('ยังไม่มีพนักงานในระบบ — เพิ่มพนักงานในไซต์งานก่อน แล้วจึงกลับมาผูกหัวหน้า')}
        </p>
      ) : (
        <>
          {unassigned.size > 0 && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <b>{t('ยังไม่มีหัวหน้า')} {unassigned.size} {t('คน')}</b> {t('— คำขอลาของคนเหล่านี้จะไปที่ผู้ดูแลระบบแทน ซึ่งใช้งานได้ แต่ไม่ใช่สิ่งที่ตั้งใจไว้')}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('หัวหน้า')}</label>
            <select value={who} onChange={(e) => setWho(e.target.value)} className="field">
              <option value="">{t('— เลือกผู้อนุมัติ —')}</option>
              {data.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.email}){teamSize.get(p.id) ? ` · ลูกน้อง ${teamSize.get(p.id)} คน` : ''}
                </option>
              ))}
            </select>
          </div>

          {who && (
            <>
              <div className="relative">
                <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('ค้นหาพนักงาน')}
                  placeholder={t('ค้นหาชื่อพนักงานหรือไซต์งาน…')} className="field !pl-9" />
              </div>

              <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                {list.length === 0 && <p className="py-8 text-center text-sm text-slate-500">{t('ไม่พบพนักงานที่ค้นหา')}</p>}
                {list.map((e) => (
                  <label key={e.id} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 hover:bg-slate-50">
                    <input type="checkbox" checked={picked.has(e.id)} onChange={() => toggle(e.id)}
                      className="h-4 w-4 rounded border-slate-300" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-800">{e.full_name}</span>
                      <span className="block text-xs text-slate-500">
                        {e.site_name || 'ยังไม่ระบุไซต์'}{e.employee_code ? ` · ${e.employee_code}` : ''}
                      </span>
                    </span>
                    {unassigned.has(e.id) && !picked.has(e.id) && (
                      <span className="chip bg-amber-50 text-amber-700">{t('ยังไม่มีหัวหน้า')}</span>
                    )}
                  </label>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button onClick={save} disabled={busy} className="btn-primary">
                  {busy ? 'กำลังบันทึก…' : `บันทึก (${picked.size} คน)`}
                </button>
                {picked.size > 0 && (
                  <button onClick={() => setPicked(new Set())} className="text-sm text-slate-500 hover:text-slate-800">{t('ล้างทั้งหมด')}</button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
