import { useMemo, useState } from 'react';
import { pick } from '../../lib/sysmap.js';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/** ทะเบียนฟังก์ชัน — everything each department does, and whether ERP covers it. */
export default function FunctionsView({ rows, depts, lang, canEdit, onEdit, onNew }) {
  const t = useT();
  const [dept, setDept] = useState('');
  const [q, setQ] = useState('');
  const [onlySite, setOnlySite] = useState(false);
  const [onlyManual, setOnlyManual] = useState(false);

  const deptName = (k) => {
    const d = depts.find((x) => x.key === k);
    return d ? pick(lang, d.name_th, d.name_en) : k;
  };
  const isManual = (r) => /non-?erp|manual|—/i.test(r.erp_type || '') || !r.erp_type;

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (dept && r.dept !== dept) return false;
      if (onlySite && !r.at_site) return false;
      if (onlyManual && !isManual(r)) return false;
      if (!term) return true;
      return [r.code, r.name_en, r.name_th, r.notes_en, r.notes_th, r.module]
        .some((v) => (v || '').toLowerCase().includes(term));
    });
  }, [rows, dept, q, onlySite, onlyManual]);

  const inDept = (k) => rows.filter((r) => r.dept === k).length;
  const chip = (on) => `rounded-full border px-3 py-1.5 text-sm font-medium transition ${
    on ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setDept('')} className={chip(dept === '')}>{t('ทุกแผนก')} <span className="ml-1 text-xs opacity-70">{rows.length}</span></button>
        {depts.map((d) => (
          <button key={d.key} onClick={() => setDept(d.key)} className={chip(dept === d.key)}>
            {pick(lang, d.name_th, d.name_en)} <span className="ml-1 text-xs opacity-70">{inDept(d.key)}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('ค้นหาฟังก์ชัน')}
            placeholder={t('ค้นหารหัส ชื่องาน หรือหมายเหตุ…')} className="field !pl-9" />
        </div>
        <button onClick={() => setOnlySite((v) => !v)} className={chip(onlySite)}>{t('เฉพาะที่ทำหน้างาน')}</button>
        <button onClick={() => setOnlyManual((v) => !v)} className={chip(onlyManual)}>{t('เฉพาะที่ยังทำมือ')}</button>
        {canEdit && <button onClick={onNew} className="btn-primary !py-2 !text-sm"><Icon name="plus" className="h-4 w-4" /> {t('เพิ่มฟังก์ชัน')}</button>}
      </div>

      <p className="text-xs text-slate-500">{t('แสดง')} {list.length} {t('จาก')} {rows.length} {t('รายการ')}</p>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="tbl w-full min-w-[820px]">
          <thead>
            <tr>
              <th className="tbl-th w-24">{t('รหัส')}</th>
              <th className="tbl-th">{t('งานที่ทำ')}</th>
              <th className="tbl-th w-32">{t('แผนก')}</th>
              <th className="tbl-th w-36">{t('อยู่ใน ERP')}</th>
              <th className="tbl-th w-24">{t('โมดูล')}</th>
              {canEdit && <th className="tbl-th w-20 text-right">{t('จัดการ')}</th>}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={canEdit ? 6 : 5} className="py-10 text-center text-sm text-slate-500">{t('ไม่พบรายการที่ตรงกับที่กรอง')}</td></tr>
            )}
            {list.map((r) => (
              <tr key={r.code} className="align-top">
                <td className="tbl-td font-mono text-xs text-slate-500">{r.code}</td>
                <td className="tbl-td">
                  <div className="font-medium text-slate-800">{pick(lang, r.name_th, r.name_en)}</div>
                  {pick(lang, r.notes_th, r.notes_en) && (
                    <div className="mt-0.5 text-xs leading-relaxed text-slate-500">{pick(lang, r.notes_th, r.notes_en)}</div>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.at_site && <span className="chip bg-sky-50 text-sky-700">{t('ทำที่หน้างาน')}</span>}
                    {r.external_entry && <span className="chip bg-violet-50 text-violet-700">{t('คนนอกเป็นผู้กรอก')}</span>}
                  </div>
                </td>
                <td className="tbl-td text-sm text-slate-600">{deptName(r.dept)}</td>
                <td className="tbl-td">
                  <span className={`chip ${isManual(r) ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>
                    {r.erp_type || 'ยังไม่ระบุ'}
                  </span>
                </td>
                <td className="tbl-td text-sm text-slate-600">{r.module || '—'}</td>
                {canEdit && (
                  <td className="tbl-td text-right">
                    <button onClick={() => onEdit(r)} className="text-sm font-medium text-brand hover:underline">{t('แก้ไข')}</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
