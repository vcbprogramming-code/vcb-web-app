import { useCallback, useEffect, useState } from 'react';
import { perfApi } from '../../lib/performance.js';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import Spinner, { BusyLabel } from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * จัดการโครงการ — เหมือน "จัดการโครงการ" ของระบบจริง (ProjectsAdmin)
 *
 * เพิ่มโครงการได้โดยไม่ต้องพิมพ์รหัส (รหัสเป็นค่าถาวรที่ทุกบันทึกผูกอยู่ ระบบตั้งให้)
 * ปิดโครงการคือหยุดรับบันทึกใหม่ ไม่ใช่การลบ ประวัติยังอยู่และยังขึ้นในภาพรวม
 * ปิดโครงการที่ยังมีคนอยู่ได้ แต่เตือนก่อน — โครงการมักจบก่อนที่ฝ่ายบุคคลจะย้ายคน
 */
export default function ProjectsAdmin({ onChanged, onAdded }) {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState({ name: '', company: '' });
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState(null);

  const load = useCallback(() => {
    perfApi.listSites().then((r) => setRows(r.data || [])).catch((e) => { toast.error(e.message); setRows([]); });
  }, [toast]);
  useEffect(load, [load]);

  const add = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const r = await perfApi.addSite({ name: form.name.trim(), company: form.company.trim() || null });
      toast.success(t('เพิ่มโครงการแล้ว'));
      setForm({ name: '', company: '' });
      onAdded?.(r.data);
      load();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const toggle = async (s) => {
    if (s.active && s.emps > 0) {
      const ok = await confirm({
        title: t('ปิดโครงการ'),
        message: t('ยังมีพนักงาน {n} คนสังกัด "{name}" — ปิดแล้วจะบันทึกงานใหม่ในโครงการนี้ไม่ได้ ประวัติเดิมยังอยู่ครบ', { n: s.emps, name: s.name }),
        confirmLabel: t('ปิดโครงการ'), danger: true,
      });
      if (!ok) return;
    }
    setRowBusy(s.key);
    try {
      await perfApi.updateSite(s.key, { active: !s.active });
      toast.success(s.active ? t('ปิดโครงการแล้ว') : t('เปิดโครงการแล้ว'));
      onChanged?.(s.key, { active: !s.active });
      load();
    } catch (err) { toast.error(err.message); } finally { setRowBusy(null); }
  };

  return (
    <section className="card space-y-3">
      <div>
        <h3 className="font-bold text-slate-800">{t('จัดการโครงการ')}</h3>
        <p className="text-xs text-slate-400">{t('ปิดโครงการ = หยุดรับบันทึกใหม่ ประวัติยังอยู่และยังแสดงในภาพรวม')}</p>
      </div>
      <form onSubmit={add} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder={t('ชื่อโครงการ')} aria-label={t('ชื่อโครงการ')} className="field" />
        <input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
          placeholder={t('บริษัท (ถ้ามี)')} aria-label={t('บริษัท')} className="field" />
        <button type="submit" disabled={busy || !form.name.trim()} className="btn-primary disabled:opacity-50">
          <BusyLabel busy={busy} busyText="กำลังเพิ่ม…"><Icon name="plus" className="h-4 w-4" /> {t('เพิ่มโครงการ')}</BusyLabel>
        </button>
      </form>
      {!rows ? <div className="flex justify-center py-6"><Spinner label={t('กำลังโหลด…')} /></div> : (
        <div className="divide-y divide-slate-100">
          {rows.map((s) => (
            <div key={s.key} className="flex flex-wrap items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className={`truncate text-sm font-medium ${s.active ? 'text-slate-700' : 'text-slate-400 line-through'}`}>{s.name}</div>
                <div className="truncate text-[11px] text-slate-400">
                  {[s.key, s.company, `${s.emps} ${t('คน')}`].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span className={`chip ${s.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {s.active ? t('เปิดอยู่') : t('ปิดแล้ว')}
              </span>
              <button onClick={() => toggle(s)} disabled={rowBusy === s.key} className="btn-outline !py-1.5 !text-sm disabled:opacity-50">
                <BusyLabel busy={rowBusy === s.key} busyText="…">{s.active ? t('ปิดโครงการ') : t('เปิดโครงการ')}</BusyLabel>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
