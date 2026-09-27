import { useEffect, useMemo, useRef, useState } from 'react';
import { pick, SITE_DEPT, deptOf, fnTypeLabel, fnTypeIsErp } from '../../lib/sysmap.js';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * ทะเบียนฟังก์ชัน — everything each department does, and whether ERP covers it.
 *
 * Eight groups, not seven: ปฏิบัติการหน้างาน is a group here even though it is
 * not a department (see SITE_DEPT). Its eighteen rows used to be reachable only
 * by scrolling, under the raw word "site", because the filter chips were built
 * from the departments table and a site is not in it.
 *
 * หมายเหตุ has its own column, as it does in their register. Folded under the
 * name it read as part of the name, and the notes are long — they are where the
 * argument about scope actually happens.
 */
export default function FunctionsView({
  rows, depts, lang, canEdit, functionAi = [], focusCode = '', onFocusUsed, onEdit, onNew,
}) {
  const t = useT();
  const [dept, setDept] = useState('');
  const [q, setQ] = useState('');
  const [onlySite, setOnlySite] = useState(false);
  const [onlyManual, setOnlyManual] = useState(false);
  // แถวที่ถูกชี้มาจากชิปรหัสบนแผงกล่องงาน — เน้นไว้ชั่วครู่แล้วปล่อย
  const [hl, setHl] = useState('');
  const rowRefs = useRef(new Map());

  /**
   * มาจากชิปรหัสบนแผงกล่องงาน — ระบบจริงเปิดทะเบียนทั้งฉบับแล้วเลื่อนไปเน้นแถวนั้น
   * ไม่ได้กรองให้เหลือแถวเดียว ผู้อ่านจึงยังเห็นหน้าที่อื่นของแผนกเดียวกันอยู่รอบ ๆ
   * ซึ่งเป็นคำถามถัดไปเสมอ (ของเราเคยยัดรหัสลงช่องค้นหา เหลือแถวเดียวโดด ๆ)
   */
  useEffect(() => {
    if (!focusCode) return;
    setQ('');
    setDept('');
    setOnlySite(false);
    setOnlyManual(false);
    setHl(focusCode);
    onFocusUsed?.();
    const timer = setTimeout(() => setHl(''), 2800);
    return () => clearTimeout(timer);
  }, [focusCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // เลื่อนหาแถวหลังจากตารางวาดเสร็จแล้ว ไม่ใช่ตอนกด (ตอนนั้นแถวยังไม่มีในหน้า)
  useEffect(() => {
    if (!hl) return;
    const el = rowRefs.current.get(hl);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [hl]);

  const aiOf = useMemo(() => new Map(functionAi.map((a) => [a.code, a])), [functionAi]);
  // แผนกในทะเบียนมีหน้างานเพิ่มมาอีกกลุ่ม ต่อท้ายชุดแผนกจริง
  const groups = useMemo(() => {
    const extra = rows.some((r) => r.dept === SITE_DEPT.key) ? [SITE_DEPT] : [];
    return [...depts, ...extra];
  }, [depts, rows]);
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
  const siteCount = rows.filter((r) => r.at_site).length;
  const extCount = rows.filter((r) => r.external_entry).length;
  const aiCount = rows.filter((r) => aiOf.get(r.code)?.in_registry).length;
  const chip = (on) => `rounded-full border px-3 py-1.5 text-sm font-medium transition ${
    on ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`;
  const deptChip = (d, on) => ({
    className: `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
      on ? 'text-white' : 'bg-white hover:opacity-80'}`,
    style: on ? { backgroundColor: d.color, borderColor: d.color } : { color: d.color, borderColor: `${d.color}66` },
  });
  const cols = canEdit ? 6 : 5;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="shrink-0 text-xs font-semibold tracking-wide text-slate-400">{t('แผนก')}</span>
        <button onClick={() => setDept('')} className={chip(dept === '')}>
          {t('ทุกแผนก')} <span className="ml-1 text-xs opacity-70">{rows.length}</span>
        </button>
        {groups.map((d) => {
          const on = dept === d.key;
          const a = deptChip(d, on);
          return (
            <button key={d.key} onClick={() => setDept(on ? '' : d.key)} className={a.className} style={a.style}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: on ? '#fff' : d.color }} />
              {pick(lang, d.name_th, d.name_en)} <span className="text-xs opacity-70">{inDept(d.key)}</span>
            </button>
          );
        })}
        {(dept || onlySite || onlyManual || q) && (
          <button onClick={() => { setDept(''); setOnlySite(false); setOnlyManual(false); setQ(''); }}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:border-slate-400">
            <Icon name="x" className="h-3.5 w-3.5" /> {t('ล้างตัวกรอง')}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('ค้นหาฟังก์ชัน')}
            placeholder={t('ค้นหารหัสหรือชื่อ…')} className="field !pl-9" />
        </div>
        {(() => {
          const a = deptChip(SITE_DEPT, onlySite);
          return (
            <button onClick={() => setOnlySite((v) => !v)} className={a.className} style={a.style}>
              <Icon name="building" className="h-3.5 w-3.5" /> {t('เฉพาะหน้างาน')}
              <span className="text-xs opacity-70">{siteCount}</span>
            </button>
          );
        })()}
        <button onClick={() => setOnlyManual((v) => !v)} className={chip(onlyManual)}>{t('เฉพาะที่ยังทำมือ')}</button>
        {canEdit && <button onClick={onNew} className="btn-primary !py-2 !text-sm"><Icon name="plus" className="h-4 w-4" /> {t('เพิ่มฟังก์ชัน')}</button>}
      </div>

      {/* บรรทัดสรุปของระบบจริงบอกสามตัวเลข: จำนวนแถว จุดที่คนนอกเป็นผู้กรอก และงาน
          ที่ทำที่หน้างาน — สองตัวหลังเป็นข้อมูลที่ใช้เถียงเรื่องขอบเขตกันจริง ๆ */}
      <p className="text-xs text-slate-500">
        {t('แสดง')} {list.length} {t('จาก')} {rows.length} {t('รายการ')}
        {' · '}{extCount} {t('จุดที่คนนอกเป็นผู้กรอก')}
        {' · '}{siteCount} {t('งานที่ทำที่หน้างาน')}
        {aiCount > 0 && <> · {aiCount} {t('รายการมีเครื่องมือ AI รองรับ')}</>}
      </p>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="tbl w-full min-w-[980px]">
          <thead>
            <tr>
              <th className="tbl-th w-24">{t('รหัส')}</th>
              <th className="tbl-th w-[26%]">{t('ฟังก์ชัน')}</th>
              <th className="tbl-th w-32">{t('ประเภท')}</th>
              <th className="tbl-th w-28">{t('โมดูล')}</th>
              <th className="tbl-th">{t('หมายเหตุ', null, 'sysmap')}</th>
              {canEdit && <th className="tbl-th w-20 text-right">{t('จัดการ')}</th>}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={cols} className="py-10 text-center text-sm text-slate-500">{t('ไม่พบฟังก์ชันที่ตรงกับการค้นหา')}</td></tr>
            )}
            {list.map((r) => {
              const g = deptOf(depts, r.dept);
              const ai = aiOf.get(r.code);
              return (
                <tr key={r.code} ref={(el) => { if (el) rowRefs.current.set(r.code, el); else rowRefs.current.delete(r.code); }}
                  className={`align-top transition ${hl === r.code ? 'bg-brand-tint ring-2 ring-inset ring-brand/50' : ''}`}>
                  <td className="tbl-td font-mono text-xs text-slate-500">{r.code}</td>
                  <td className="tbl-td">
                    <div className="font-medium text-slate-800">{pick(lang, r.name_th, r.name_en)}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {g && (
                        <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: g.color }}>
                          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: g.color }} />
                          {pick(lang, g.name_th, g.name_en)}
                        </span>
                      )}
                      {r.at_site && (
                        <span className="chip inline-flex items-center gap-1 bg-orange-50 text-orange-700">
                          <Icon name="building" className="h-3 w-3" /> {t('ทำที่หน้างาน')}
                        </span>
                      )}
                      {r.external_entry && <span className="chip bg-violet-50 text-violet-700">{t('คนนอกเป็นผู้กรอก')}</span>}
                    </div>
                  </td>
                  <td className="tbl-td">
                    <span className={`chip ${fnTypeIsErp(r.erp_type) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {t(fnTypeLabel(r.erp_type))}
                    </span>
                  </td>
                  <td className="tbl-td text-sm text-slate-600">{r.module || '—'}</td>
                  <td className="tbl-td">
                    {pick(lang, r.notes_th, r.notes_en) && (
                      <div className="text-xs leading-relaxed text-slate-500">{pick(lang, r.notes_th, r.notes_en)}</div>
                    )}
                    {/* ชิปเครื่องมือ AI — แถวที่ระบบจริงชี้ว่ามี AI ช่วยได้แล้ว */}
                    {ai?.in_registry && (
                      <div className="mt-1.5 rounded-lg border-l-2 border-violet-400 bg-violet-50/60 px-2 py-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                            <Icon name="chart" className="h-2.5 w-2.5" /> {t('โอกาส AI')}
                          </span>
                          {ai.tool && <span className="text-[10px] font-semibold text-violet-600">{ai.tool}</span>}
                        </div>
                        {pick(lang, ai.desc_th, ai.desc_en) && (
                          <p className="mt-1 text-[11px] leading-relaxed text-violet-900/75">{pick(lang, ai.desc_th, ai.desc_en)}</p>
                        )}
                      </div>
                    )}
                  </td>
                  {canEdit && (
                    <td className="tbl-td text-right">
                      <button onClick={() => onEdit(r)} className="text-sm font-medium text-brand hover:underline">{t('แก้ไข')}</button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
