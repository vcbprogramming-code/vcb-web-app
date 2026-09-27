import { useEffect, useMemo, useState } from 'react';
import { perfApi } from '../../lib/performance.js';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { Modal } from '../../components/ui/index.js';
import Spinner, { BusyLabel } from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import IndexImport from './IndexImport.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * ดัชนีงาน — ทะเบียนสองชั้นที่ทุกช่องในตารางสัปดาห์เลือกมาจากที่นี่
 *   กิจกรรม (Activity)       ทำอะไร        A-1, B-2, Z-2 …
 *   หมวดงาน (Work Category)  ลงต้นทุนไหน   1, 5, 20 …
 *
 * หัวคอลัมน์ ปุ่ม และข้อความว่าง ใช้คำเดียวกับระบบที่ลูกค้าใช้อยู่ทุกวัน
 */

/** เรียงรหัสแบบธรรมชาติ: A-1 < A-2 < A-10 และ 1 < 2 < 10 < 20 (cmpCode_ ของเขา) */
const cmpCode = (a, b) => {
  const ma = /^(\D*)(\d*)/.exec(String(a || '')); const mb = /^(\D*)(\d*)/.exec(String(b || ''));
  if (ma[1] !== mb[1]) return ma[1] < mb[1] ? -1 : 1;
  const na = ma[2] ? parseInt(ma[2], 10) : 0; const nb = mb[2] ? parseInt(mb[2], 10) : 0;
  if (na !== nb) return na - nb;
  return String(a).localeCompare(String(b), 'th');
};

/**
 * หัวคอลัมน์ที่กดเรียงได้สามจังหวะ — กดครั้งแรกเรียงมาก→น้อย ครั้งที่สอง
 * น้อย→มาก ครั้งที่สามกลับไปลำดับเดิมของทะเบียน (จังหวะเดียวกับ miCycleSort)
 */
function SortTh({ col, label, width, sort, onSort }) {
  const on = sort.col === col && sort.dir !== 0;
  return (
    <th className={`tbl-th cursor-pointer select-none whitespace-nowrap hover:text-brand ${width || ''}`}
      onClick={() => onSort(col)} title={label}>
      <span className="inline-flex items-center gap-1">
        {label}
        {on && <Icon name="chevronDown" className={`h-3 w-3 ${sort.dir === 2 ? 'rotate-180' : ''}`} />}
      </span>
    </th>
  );
}

function ActivityModal({ item, categories, onClose, onSaved }) {
  const t = useT();
  const editing = Boolean(item);
  const [f, setF] = useState({
    code: item?.code || '', name: item?.name || '', desc: item?.desc || '',
    category: item?.category || '', mapping: item?.mapping || 'one-to-many', fixedCost: item?.fixed_cost || '',
  });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setErr(null);
    if (!f.name.trim()) { setErr(t('กรอกชื่อ')); return; }
    if (!f.category.trim()) { setErr(t('กรอกหมวดหมู่')); return; }
    setBusy(true);
    try {
      const body = {
        name: f.name.trim(), description: f.desc.trim() || null, category: f.category.trim(),
        mapping: f.mapping, fixedCost: f.mapping === 'one-to-one' ? (f.fixedCost.trim() || null) : null,
      };
      if (editing) await perfApi.updateActivity(item.code, body);
      // เว้นรหัสว่างได้ = ให้เซิร์ฟเวอร์ออกเลขให้ (กันสองคนกดพร้อมกันได้รหัสซ้ำ)
      else await perfApi.createActivity(f.code.trim() ? { code: f.code.trim(), ...body } : body);
      onSaved();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return (
    <Modal title={editing ? t('แก้ไขรายการ') : t('เพิ่มรายการใหม่')} onClose={onClose} size="xl"
      footer={<><button onClick={onClose} className="btn-outline">{t('ยกเลิก')}</button>
        <button type="submit" form="act-form" disabled={busy} className="btn-primary">
          <BusyLabel busy={busy} busyText="กำลังบันทึก…">{editing ? t('บันทึก') : t('เพิ่ม')}</BusyLabel></button></>}>
      <form id="act-form" onSubmit={submit} className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">
            {t('รหัสงาน')} <span className="font-normal text-slate-400">— {t('เว้นว่างเพื่อสร้างเลขลำดับอัตโนมัติ')}</span>
          </span>
          <input value={f.code} onChange={(e) => set('code', e.target.value)} disabled={editing}
            placeholder="A-1" className={`field ${editing ? 'bg-slate-100' : ''}`} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">{t('ชื่อ')} <span className="text-red-500">*</span></span>
          <input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder={t('เช่น งานผูก-ตัด-ดัดเหล็ก')} className="field" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">{t('คำอธิบาย')}</span>
          <textarea rows={3} value={f.desc} onChange={(e) => set('desc', e.target.value)} className="field" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">{t('หมวดหมู่')} <span className="text-red-500">*</span></span>
          {/* datalist = เลือกหมวดหมู่ที่มีอยู่แล้วได้ แต่ยังพิมพ์ใหม่ได้ — กันหมวดหมู่
              สะกดต่างกันเล็กน้อยแตกเป็นสองหมวด */}
          <input value={f.category} onChange={(e) => set('category', e.target.value)} list="wi-cat-list"
            autoComplete="off" placeholder={t('เลือกหรือพิมพ์หมวดหมู่ใหม่')} className="field" />
          <datalist id="wi-cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">{t('การจับคู่หมวดงาน')}</span>
          <select value={f.mapping} onChange={(e) => set('mapping', e.target.value)} className="field">
            <option value="one-to-many">{t('เลือกหมวดงานเอง (2 ขั้นตอน)')}</option>
            <option value="one-to-one">{t('กำหนดหมวดงานอัตโนมัติ (ขั้นตอนเดียว)')}</option>
          </select>
        </label>
        {f.mapping === 'one-to-one' && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">{t('รหัสหมวดงานอัตโนมัติ')}</span>
            <input value={f.fixedCost} onChange={(e) => set('fixedCost', e.target.value)} placeholder={t('เช่น 5')} className="field" />
          </label>
        )}
        {err && <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{err}</div>}
      </form>
    </Modal>
  );
}

function CategoryModal({ item, onClose, onSaved }) {
  const t = useT();
  const editing = Boolean(item);
  const [f, setF] = useState({ code: item?.code || '', name: item?.name || '', nameEn: item?.name_en || '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setErr(null);
    if (!f.name.trim()) { setErr(t('กรอกชื่อ')); return; }
    setBusy(true);
    try {
      const body = { name: f.name.trim(), nameEn: f.nameEn.trim() || null };
      if (editing) await perfApi.updateCostCategory(item.code, body);
      else await perfApi.createCostCategory(f.code.trim() ? { code: f.code.trim(), ...body } : body);
      onSaved();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return (
    <Modal title={editing ? t('แก้ไขหมวดงาน') : t('เพิ่มหมวดงาน')} onClose={onClose} size="lg"
      footer={<><button onClick={onClose} className="btn-outline">{t('ยกเลิก')}</button>
        <button type="submit" form="cat-form" disabled={busy} className="btn-primary">
          <BusyLabel busy={busy} busyText="กำลังบันทึก…">{editing ? t('บันทึก') : t('เพิ่ม')}</BusyLabel></button></>}>
      <form id="cat-form" onSubmit={submit} className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">
            {t('รหัส')} <span className="font-normal text-slate-400">— {t('เว้นว่างเพื่อสร้างเลขถัดไปอัตโนมัติ')}</span>
          </span>
          <input value={f.code} onChange={(e) => set('code', e.target.value)} disabled={editing}
            placeholder="21" className={`field ${editing ? 'bg-slate-100' : ''}`} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">{t('หมวดงาน (ไทย)')} <span className="text-red-500">*</span></span>
          <input value={f.name} onChange={(e) => set('name', e.target.value)} className="field" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">Work Category (English)</span>
          <input value={f.nameEn} onChange={(e) => set('nameEn', e.target.value)} className="field" />
        </label>
        {err && <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{err}</div>}
      </form>
    </Modal>
  );
}

export default function WorkIndex() {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('activities');
  const [acts, setActs] = useState(null);
  const [cats, setCats] = useState(null);
  const [error, setError] = useState(null);
  const [editAct, setEditAct] = useState(undefined); // undefined=ปิด, null=เพิ่มใหม่, obj=แก้ไข
  const [editCat, setEditCat] = useState(undefined);
  const [importing, setImporting] = useState(null);  // 'activity' | 'cost' | null
  const [busyDel, setBusyDel] = useState('');
  // จังหวะการเรียง: 0 = ลำดับเดิมของทะเบียน · 1 = มาก→น้อย · 2 = น้อย→มาก
  const [sortA, setSortA] = useState({ col: null, dir: 0 });
  const [sortC, setSortC] = useState({ col: null, dir: 0 });

  const load = () => {
    perfApi.activities().then((r) => setActs(r.data)).catch((e) => setError(e.message));
    perfApi.costCategories().then((r) => setCats(r.data)).catch((e) => setError(e.message));
  };
  useEffect(() => { load(); }, []);

  const cycle = (setter) => (col) => setter((s) => (s.col === col
    ? { col: s.dir === 2 ? null : col, dir: (s.dir + 1) % 3 }
    : { col, dir: 1 }));

  const sortRows = (rows, sort) => {
    if (!sort.col || sort.dir === 0) return rows;
    const mul = sort.dir === 1 ? -1 : 1;   // จังหวะแรก = มาก→น้อย เหมือนของเขา
    return [...rows].sort((a, b) => {
      const av = String(a[sort.col] ?? '').trim(); const bv = String(b[sort.col] ?? '').trim();
      if (sort.col === 'code') return cmpCode(av, bv) * mul;
      if (av === '' && bv !== '') return 1;   // ค่าว่างอยู่ท้ายเสมอ ไม่ว่าเรียงทางไหน
      if (bv === '' && av !== '') return -1;
      return av.localeCompare(bv, 'th') * mul;
    });
  };

  const shownActs = useMemo(() => sortRows(acts || [], sortA), [acts, sortA]);
  const shownCats = useMemo(() => sortRows(cats || [], sortC), [cats, sortC]);
  // หมวดหมู่ที่มีอยู่แล้วในทะเบียน — ป้อนให้ datalist ของ modal
  const categories = useMemo(() => [...new Set((acts || []).map((a) => String(a.category || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'th')), [acts]);

  if (error) return <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!acts || !cats) return <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลด…')} /></div>;

  /**
   * ลบรายการออกจากทะเบียน
   *
   * ฝั่งเซิร์ฟเวอร์เป็นคนตัดสินว่าลบจริงได้ไหม: ถ้ามีบันทึกงานอ้างอิงอยู่จะปิด
   * ใช้งานแทน แล้วส่งข้อความกลับมาบอกว่าเพราะอะไร — เราต้องแสดงข้อความนั้น
   * ตรง ๆ ไม่ใช่ขึ้น "ลบแล้ว" ทั้งที่รายการยังอยู่
   */
  const remove = async (row, isCost) => {
    const ok = await confirm({
      title: t('ลบรายการ'),
      message: `${t('ลบ')} "${row.name || '?'}" ${t('ออกจากดัชนี?')}`,
      confirmLabel: t('ลบ'), danger: true,
    });
    if (!ok) return;
    setBusyDel(row.code);
    try {
      const r = isCost ? await perfApi.deleteCostCategory(row.code) : await perfApi.deleteActivity(row.code);
      if (r.data?.deactivated) toast.info(r.data.message || t('ปิดใช้งานแทนการลบ เพราะมีบันทึกงานอ้างอิงอยู่'));
      else toast.success(t('ลบแล้ว'));
      load();
    } catch (e) { toast.error(e.message || t('ลบไม่สำเร็จ')); }
    finally { setBusyDel(''); }
  };

  const isAct = tab === 'activities';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {/* ชื่อแท็บตรงกับระบบที่ลูกค้าใช้อยู่ — "กิจกรรม (Activity)" และ "หมวดงาน (Work Category)"
              จำนวนแถวย้ายไปเป็นตัวเลขจาง ๆ ต่อท้าย ยังเห็นได้แต่ไม่แย่งชื่อทางการของหมวด */}
          {[['activities', 'กิจกรรม (Activity)', acts.length], ['categories', 'หมวดงาน (Work Category)', cats.length]].map(([k, label, n]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${tab === k ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              {t(label)} <span className={tab === k ? 'text-white/70' : 'text-slate-400'}>{n}</span>
            </button>
          ))}
        </div>
        <span className="hidden text-xs text-slate-400 sm:inline">{t('คลิกหัวคอลัมน์เพื่อจัดเรียง')}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* ทะเบียนนี้แก้กันทีละหลายสิบแถว — ออกเป็นไฟล์ไปแก้แล้วนำกลับเข้ามา */}
          <a href={isAct ? perfApi.activitiesXlsxUrl() : perfApi.costCategoriesXlsxUrl()}
            className="btn-outline !py-1.5 !text-sm"
            title={t('ส่งออกดัชนีงานทั้งหมดเป็นไฟล์ Excel (.xlsx) โดยคงรูปแบบเดิมไว้')}>
            <Icon name="download" className="h-4 w-4" /> Excel
          </a>
          {/* นำเข้าได้ทั้งสองแท็บ — เดิมมีแต่แท็บกิจกรรม */}
          <button onClick={() => setImporting(isAct ? 'activity' : 'cost')} className="btn-outline !py-1.5 !text-sm">
            <Icon name="arrowUpRight" className="h-4 w-4" /> {t('นำเข้า')}
          </button>
          {/* ป้ายปุ่มเป็นคำของเขาเป๊ะ ๆ รวมเครื่องหมาย + ข้างหน้า จึงไม่ใส่ไอคอนบวกซ้ำ */}
          <button onClick={() => (isAct ? setEditAct(null) : setEditCat(null))} className="btn-primary !py-1.5">
            {t(isAct ? '+ เพิ่มกิจกรรม' : '+ เพิ่มหมวดงาน')}
          </button>
        </div>
      </div>

      <div className="card !p-0 overflow-x-auto">
        {isAct ? (
          <table className="tbl min-w-[720px]">
            <thead>
              <tr className="tbl-head">
                <SortTh col="code" label={t('รหัสงาน')} width="w-24" sort={sortA} onSort={cycle(setSortA)} />
                <SortTh col="name" label={t('ชื่อ')} width="w-64" sort={sortA} onSort={cycle(setSortA)} />
                <SortTh col="desc" label={t('คำอธิบาย')} sort={sortA} onSort={cycle(setSortA)} />
                <SortTh col="category" label={t('หมวดหมู่')} width="w-52" sort={sortA} onSort={cycle(setSortA)} />
                <th className="tbl-th">{t('การจับคู่')}</th>
                <th className="tbl-th text-right">{t('จัดการ')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shownActs.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">{t('ยังไม่มีรายการ')}</td></tr>
              )}
              {shownActs.map((a) => (
                <tr key={a.code} className="tbl-row align-top">
                  <td className="tbl-td"><span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-brand">{a.code}</span></td>
                  <td className="tbl-td font-medium text-slate-800">{a.name}</td>
                  <td className="tbl-td text-xs text-slate-500">{a.desc || '—'}</td>
                  <td className="tbl-td text-slate-500">{a.category}</td>
                  <td className="tbl-td">
                    {a.mapping === 'one-to-one'
                      ? <span className="chip bg-emerald-50 text-emerald-700">{t('อัตโนมัติ')} → {a.fixed_cost || '—'}</span>
                      : <span className="chip bg-amber-50 text-amber-700">{t('เลือกเอง')}</span>}
                  </td>
                  <td className="tbl-td whitespace-nowrap text-right">
                    <button onClick={() => setEditAct(a)} className="text-sm text-blue-600 hover:underline">{t('แก้ไข')}</button>
                    <button onClick={() => remove(a, false)} disabled={busyDel === a.code}
                      className="ml-3 text-sm text-red-600 hover:underline disabled:opacity-50">
                      {busyDel === a.code ? t('กำลังลบ…') : t('ลบ')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="tbl min-w-[560px]">
            <thead>
              <tr className="tbl-head">
                <SortTh col="code" label={t('รหัส')} width="w-24" sort={sortC} onSort={cycle(setSortC)} />
                <SortTh col="name" label={t('หมวดงาน (ไทย)')} width="w-80" sort={sortC} onSort={cycle(setSortC)} />
                <SortTh col="name_en" label="Work Category (English)" sort={sortC} onSort={cycle(setSortC)} />
                <th className="tbl-th text-right">{t('จัดการ')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shownCats.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-400">{t('ยังไม่มีรายการ')}</td></tr>
              )}
              {shownCats.map((c) => (
                <tr key={c.code} className="tbl-row">
                  <td className="tbl-td"><span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-brand">{c.code}</span></td>
                  <td className="tbl-td font-medium text-slate-800">{c.name}</td>
                  <td className="tbl-td text-xs text-slate-500">{c.name_en || '—'}</td>
                  <td className="tbl-td whitespace-nowrap text-right">
                    <button onClick={() => setEditCat(c)} className="text-sm text-blue-600 hover:underline">{t('แก้ไข')}</button>
                    <button onClick={() => remove(c, true)} disabled={busyDel === c.code}
                      className="ml-3 text-sm text-red-600 hover:underline disabled:opacity-50">
                      {busyDel === c.code ? t('กำลังลบ…') : t('ลบ')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {importing && (
        <IndexImport kind={importing} onClose={() => setImporting(null)}
          onDone={(summary) => { toast.success(summary); load(); }} />
      )}
      {editAct !== undefined && (
        <ActivityModal item={editAct} categories={categories} onClose={() => setEditAct(undefined)}
          onSaved={() => { setEditAct(undefined); toast.success(t('บันทึกแล้ว')); load(); }} />
      )}
      {editCat !== undefined && (
        <CategoryModal item={editCat} onClose={() => setEditCat(undefined)}
          onSaved={() => { setEditCat(undefined); toast.success(t('บันทึกแล้ว')); load(); }} />
      )}
    </div>
  );
}
