import { useEffect, useState, useCallback, useMemo } from 'react';
import { creditApi, formatMoney } from '../../lib/modules.js';
import { Modal } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useT } from '../../lib/i18n.jsx';
import DrawdownModal from './DrawdownModal.jsx';
import { TYPE_CHIP, SortTh, useSort, projectLabel, typeParams } from './shared.jsx';

function FacilityModal({ facility, projects, types, onClose, onSaved }) {
  const t = useT();
  const editing = Boolean(facility);
  const [form, setForm] = useState({
    projectId: facility?.project_id || projects[0]?.id || '',
    company: facility?.company || '',
    bank: facility?.bank || '',
    // ประเภทวงเงินคือเลขในทะเบียน ไม่ใช่ข้อความที่พิมพ์เอง — เลขนี้เป็นตัวบอกว่า
    // วงเงินก้อนนี้ไปรวมอยู่กล่องไหนบนหน้าภาพรวม
    facilityNo: facility?.facility_no ?? (types[0]?.no ?? 1),
    limit: facility?.limit ?? '',
    usedBaseline: '',
    // ยอดใช้ไปที่ปักเอง — ว่างไว้ = คำนวณจากรายการ (setUsedOverride ของระบบจริง)
    usedOverride: facility?.used_overridden ? String(facility.used) : '',
    // อัตราดอกเบี้ยตามหนังสือธนาคาร เป็นประโยค ไม่ใช่ตัวเลข
    interestNote: facility?.interest_note ?? (facility?.interest_rate != null ? `${facility.interest_rate} % ต่อปี` : ''),
    dueDate: facility?.due_date ? String(facility.due_date).slice(0, 10) : '',
    notes: facility?.notes || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        projectId: form.projectId,
        company: form.company || null,
        bank: form.bank || null,
        facilityNo: Number(form.facilityNo),
        limit: Number(form.limit) || 0,
        interestNote: form.interestNote.trim() || null,
        dueDate: form.dueDate || null,
        notes: form.notes || null,
      };
      if (!editing && form.usedBaseline !== '') body.usedBaseline = Number(form.usedBaseline);
      if (editing) {
        const raw = String(form.usedOverride).trim();
        const next = raw === '' ? null : Number(raw);
        if (next != null && (Number.isNaN(next) || next < 0)) throw new Error(t('กรอกยอดใช้ไปให้ถูกต้อง'));
        const prev = facility.used_overridden ? Number(facility.used) : null;
        if (next !== prev) body.usedOverride = next;
      }
      if (editing) await creditApi.updateFacility(facility.id, body);
      else await creditApi.addFacility(body);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // ตัวเลขที่ระบบจะใช้คำนวณดอกเบี้ยเกินกำหนดจากข้อความที่กรอก — กฎเดียวกับฝั่ง
  // เซิร์ฟเวอร์ ให้คนกรอกเห็นทันทีว่าประโยคที่พิมพ์คำนวณได้หรือไม่ได้
  const ratePreview = useMemo(() => {
    const m = String(form.interestNote || '').match(/(\d+(\.\d+)?)\s*%/);
    if (m) return `${t('คำนวณดอกเบี้ยที่')} ${m[1]}% ${t('ต่อปี')}`;
    return String(form.interestNote || '').trim() ? t('ระบุอัตราไม่ได้') : '';
  }, [form.interestNote, t]);

  return (
    <Modal
      title={editing ? t('แก้ไขวงเงินสินเชื่อ') : t('เพิ่มวงเงินสินเชื่อ')}
      onClose={onClose}
      size="2xl"
      footer={
        <>
          <button onClick={onClose} className="btn-outline">{t('ยกเลิก')}</button>
          <button onClick={submit} disabled={busy} className="btn-primary">{busy ? t('กำลังบันทึก…') : t('บันทึก')}</button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('โครงการ')} <span className="text-red-500">*</span></label>
            <select value={form.projectId} onChange={(e) => set('projectId', e.target.value)} className="field" title={t('โครงการ')}>
              {projects.map((p) => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('ประเภทวงเงิน')} <span className="text-red-500">*</span></label>
            <select value={form.facilityNo} onChange={(e) => set('facilityNo', e.target.value)} className="field" title={t('ประเภทวงเงิน')}>
              {types.map((ty) => (
                <option key={ty.no} value={ty.no}>{ty.no}. {ty.name_th}</option>
              ))}
            </select>
            {/* วงเงินหลายประเภทใช้ก้อนเดียวกับธนาคาร — บอกไว้ตรงนี้ ไม่ให้ไปเซอร์ไพรส์
                ตอนเห็นยอดรวมบนหน้าภาพรวม */}
            {(() => {
              const cur = types.find((x) => String(x.no) === String(form.facilityNo));
              if (!cur || cur.foldsInto === cur.no) return null;
              const box = types.find((x) => x.no === cur.foldsInto);
              return <p className="mt-1 text-xs text-amber-700">{t('ใช้วงเงินร่วมกับ')} {box?.doc_kind} — {t('หน้าภาพรวมจะรวมยอดไว้ในกล่องเดียวกัน')}</p>;
            })()}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('บริษัท')}</label>
            <input value={form.company} onChange={(e) => set('company', e.target.value)} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('ธนาคาร')}</label>
            <input value={form.bank} onChange={(e) => set('bank', e.target.value)} className="field" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('หมายเหตุ / เลขที่สัญญาธนาคาร')}</label>
            <input value={form.notes} onChange={(e) => set('notes', e.target.value)} className="field"
              placeholder={t('เช่น เลขที่วงเงินตามหนังสือธนาคาร')} />
          </div>
          <div>
            {/* หนังสือวงเงินของธนาคารเขียนเงื่อนไขเป็นประโยค ไม่ใช่ตัวเลขเดียว —
                ช่องตัวเลขบังคับให้คนกรอกตัดความจริงทิ้ง ("เรียกเก็บทุก 3 เดือน") */}
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('อัตราดอกเบี้ย')}</label>
            <input value={form.interestNote} onChange={(e) => set('interestNote', e.target.value)} className="field"
              placeholder={t('เช่น MLR ต่อปี / 1.25 % ต่อปีเรียกเก็บทุก 3 เดือน')} />
            {ratePreview && (
              <p className={`mt-1 text-xs ${ratePreview === t('ระบุอัตราไม่ได้') ? 'text-amber-700' : 'text-slate-500'}`}>
                {ratePreview}
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('วงเงินที่อนุมัติ')} <span className="text-red-500">*</span></label>
            <input type="number" value={form.limit} onChange={(e) => set('limit', e.target.value)} className="field" />
          </div>
          {!editing && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">{t('ยอดใช้ไปเริ่มต้น (baseline)')}</label>
              <input type="number" value={form.usedBaseline} onChange={(e) => set('usedBaseline', e.target.value)} className="field" />
            </div>
          )}
          {editing && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">{t('ยอดใช้ไป (ตั้งเอง)')}</label>
              <input type="number" value={form.usedOverride} onChange={(e) => set('usedOverride', e.target.value)} className="field"
                placeholder={`${t('คำนวณอัตโนมัติ')}: ${Number(facility.used_auto ?? facility.used ?? 0).toLocaleString('en-US')}`} />
              <p className="mt-1 text-xs text-slate-500">{t('เว้นว่างไว้ให้ระบบคำนวณจากรายการ — กรอกเมื่อยอดที่ธนาคารแจ้งไม่ตรงกับที่คำนวณได้')}</p>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('วันครบกำหนด')}</label>
            <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className="field" />
          </div>
        </div>
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
      </form>
    </Modal>
  );
}

/**
 * ปรับวงเงิน / ใช้ไป — จอสั้นจอเดียวที่คนใช้ทุกเดือน
 *
 * ทุกต้นเดือนธนาคารส่งยอดมาให้กระทบ งานที่ทำคือแก้สองช่องนี้ ไม่ใช่แก้ทะเบียน
 * วงเงินทั้งใบ ระบบจริงจึงแยกจอนี้ออกมา (openLimit) และยิงเฉพาะช่องที่เปลี่ยน
 * — ช่องที่ไม่ได้แตะไม่ถูกเขียน ประวัติการแก้ไขจึงไม่มีรายการเปล่า ๆ ปนอยู่
 *
 * ช่อง "ใช้ไป" เว้นว่าง = กลับไปให้ระบบคำนวณจากรายการ ไม่ใช่ตั้งเป็นศูนย์ —
 * ศูนย์เป็นค่าที่ธนาคารแจ้งได้จริง จึงต้องแยกจากการไม่กรอก
 */
function AdjustLimitModal({ facility, label, onClose, onSaved }) {
  const t = useT();
  const toast = useToast();
  const auto = Number(facility.used_auto ?? facility.used ?? 0);
  const [limit, setLimit] = useState(String(Number(facility.limit || 0)));
  const [used, setUsed] = useState(facility.used_overridden ? String(Number(facility.used)) : '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const lim = Number(String(limit).replace(/,/g, ''));
    if (String(limit).trim() === '' || Number.isNaN(lim) || lim < 0) { toast.error(t('กรอกวงเงินให้ถูกต้อง')); return; }
    const raw = String(used).trim();
    const nextUsed = raw === '' ? null : Number(raw.replace(/,/g, ''));
    if (nextUsed != null && (Number.isNaN(nextUsed) || nextUsed < 0)) { toast.error(t('กรอกยอดใช้ไปให้ถูกต้อง')); return; }
    const prevUsed = facility.used_overridden ? Number(facility.used) : null;
    const limitChanged = lim !== Number(facility.limit || 0);
    const usedChanged = nextUsed !== prevUsed;
    if (!limitChanged && !usedChanged) { onClose(); return; }
    setBusy(true);
    try {
      if (limitChanged) await creditApi.setLimit(facility.id, lim);
      if (usedChanged) await creditApi.updateFacility(facility.id, { usedOverride: nextUsed });
      toast.success(t('ปรับเรียบร้อย'));
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title={t('ปรับวงเงิน / ใช้ไป')}
      onClose={onClose}
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-outline">{t('ยกเลิก')}</button>
          <button onClick={save} disabled={busy} className="btn-primary">{busy ? t('กำลังบันทึก…') : t('บันทึก')}</button>
        </>
      }
    >
      <p className="text-sm text-slate-500">{label}</p>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600">
          {t('วงเงิน (บาท)')} <span className="text-red-500">*</span>
        </label>
        <input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} className="field" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600">
          {t('ใช้ไป (บาท)')}{' '}
          <span className="text-xs font-normal text-slate-400">{t('— เว้นว่างเพื่อใช้ค่าที่คำนวณอัตโนมัติจากรายการ')}</span>
        </label>
        <input type="number" value={used} onChange={(e) => setUsed(e.target.value)} className="field"
          placeholder={`${t('คำนวณอัตโนมัติ')}: ${auto.toLocaleString('en-US')}`} />
      </div>
    </Modal>
  );
}

export default function FacilitiesTab({ projects, filters, types = [], costCategories = [], onChanged, openNew = 0 }) {
  const t = useT();
  const [facilities, setFacilities] = useState([]);
  const [error, setError] = useState(null);
  const [edit, setEdit] = useState(undefined); // undefined=closed, null=new, obj=edit
  const [adjust, setAdjust] = useState(null);
  const [drawdown, setDrawdown] = useState(null);
  const sort = useSort();
  useEffect(() => { if (openNew) setEdit(null); }, [openNew]);

  // ตัวกรองมาจากแถบชุดเดียวบนหน้าหลัก แท็บนี้แค่ใช้ค่าที่ได้มา
  const { projectId = '', company = '', search = '', type = '' } = filters || {};
  const load = useCallback(() => {
    creditApi.facilities({ projectId, search, company, ...typeParams(type) })
      .then((r) => setFacilities(r.data)).catch((e) => setError(e.message));
  }, [projectId, type, search, company]);
  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  /**
   * จำนวนวงเงินทั้งทะเบียน ไม่ขึ้นกับตัวกรอง — ใช้เทียบในบรรทัด "แสดง N / M"
   *
   * ตารางรายการสินเชื่อที่อยู่แท็บถัดไปบอกตัวเลขนี้อยู่แล้ว แต่ตารางวงเงินเงียบ
   * ทั้งที่ใช้แถบตัวกรองชุดเดียวกัน กรองแล้วตารางสั้นลงโดยไม่รู้ว่าจากทั้งหมดเท่าไร
   *
   * จำไว้จากรอบที่ยังไม่ได้กรอง ไม่ยิงถามเพิ่ม — เปิดแท็บมาครั้งแรกยังไม่มีตัวกรอง
   * อยู่แล้ว เลขจึงมีตั้งแต่วินาทีแรก · เคยยิง /facilities อีกครั้งเพื่อนับ ซึ่ง
   * ทำให้หน้านี้โหลดสองเท่าโดยไม่จำเป็น และแย่งคิวกับการโหลดทะเบียนประเภทวงเงิน
   * จนฟอร์ม "เพิ่มวงเงิน" เปิดมาโดยที่ช่องประเภทยังว่าง
   */
  const [total, setTotal] = useState(0);
  const unfiltered = !projectId && !company && !search && !type;

  const projById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const projName = (id) => (projById[id] ? (projById[id].name || projById[id].code) : '—');
  const projCode = (id) => projById[id]?.code || '';
  const refresh = () => { load(); onChanged?.(); setEdit(undefined); setDrawdown(null); setAdjust(null); };

  const rows = useMemo(() => {
    // ลำดับตั้งต้น: รหัสโครงการ แล้วเลขประเภท — ตรงกับ facTable() ของระบบจริง
    // ซึ่งเรียงด้วย x.project (รหัสโครงการ) ไม่ใช่ชื่อไทย การเรียงด้วยชื่อไทยดัน
    // โครงการที่ชื่อเป็นอักษรโรมัน (LPB) ขึ้นเป็นแถวแรกทั้งที่ยังไม่มีวงเงินสักบาท
    const base = facilities.slice().sort((a, b) => {
      const pa = projCode(a.project_id); const pb = projCode(b.project_id);
      if (pa !== pb) return pa < pb ? -1 : 1;
      return Number(a.facility_no || 0) - Number(b.facility_no || 0);
    });
    return sort.apply(base, {
      project: (f) => projCode(f.project_id),
      company: (f) => f.company || '',
      type: (f) => f.type || '',
      limit: (f) => Number(f.limit) || 0,
      used: (f) => Number(f.used) || 0,
      available: (f) => Number(f.available) || 0,
      pct: (f) => (Number(f.limit) > 0 ? Number(f.used) / Number(f.limit) : 0),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilities, sort, projById]);

  useEffect(() => { if (unfiltered) setTotal(rows.length); }, [unfiltered, rows.length]);

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {/* ถ้อยคำและตำแหน่งเดียวกับตารางรายการสินเชื่อ — สองตารางนี้อยู่ใต้แถบตัวกรอง
          ชุดเดียวกัน จะบอกผลคนละแบบไม่ได้ */}
      <div className="text-xs text-slate-400">
        {t('แสดง')} {rows.length} / {total || rows.length} {t('รายการ')}
      </div>

      <div className="card !p-0 overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr className="tbl-head">
              <th className="tbl-th w-10">#</th>
              <SortTh sort={sort} colKey="project">{t('โครงการ')}</SortTh>
              <SortTh sort={sort} colKey="company">{t('บริษัท')}</SortTh>
              <SortTh sort={sort} colKey="type">{t('ประเภท')}</SortTh>
              <SortTh sort={sort} colKey="limit" className="text-right">{t('วงเงิน')}</SortTh>
              <SortTh sort={sort} colKey="used" className="text-right">{t('ใช้ไป')}</SortTh>
              <SortTh sort={sort} colKey="available" className="text-right">{t('คงเหลือ')}</SortTh>
              <SortTh sort={sort} colKey="pct" className="w-40">{t('การใช้')}</SortTh>
              {/* หัวคอลัมน์ปุ่มเว้นว่างไว้ — "จัดการ" ไม่ได้บอกอะไรที่ไอคอนยังไม่บอก */}
              <th className="tbl-th text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="px-5 py-10 text-center text-slate-400">{t('ไม่มีข้อมูลวงเงินตามเงื่อนไข')}</td></tr>
            ) : rows.map((f, i) => (
              <tr key={f.id} className="tbl-row">
                <td className="tbl-td text-slate-400">{i + 1}</td>
                <td className="tbl-td">
                  <div className="font-medium text-slate-800">{projName(f.project_id)}</div>
                  {/* the bank's own facility number is how finance and the bank
                      refer to the same line — it has to be readable here, not
                      only inside the edit form. */}
                  {(f.bank || f.facility_no) && (
                    <div className="text-xs text-slate-400">
                      {[f.bank, f.facility_no].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </td>
                <td className="tbl-td text-slate-600">{f.company || '—'}</td>
                <td className="tbl-td"><span className={`chip ${TYPE_CHIP[f.type] || 'bg-slate-100 text-slate-600'}`}>{f.type}</span></td>
                <td className="tbl-td text-right tabular-nums">{formatMoney(f.limit)}</td>
                <td className="tbl-td text-right tabular-nums">
                  {formatMoney(f.used)}
                  {/* ยอดที่ปักเอง ไม่ได้มาจากรายการ — ต้องมองออกทันทีว่าตัวเลขนี้ไม่ได้คำนวณ */}
                  {f.used_overridden && (
                    <span className="ml-1 font-bold text-amber-600" title={t('ตั้งเอง (override) — ไม่ได้คำนวณจากรายการ')}>✱</span>
                  )}
                </td>
                <td className={`tbl-td text-right tabular-nums font-medium ${f.available < 0 ? 'text-red-600' : f.available === 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{formatMoney(f.available)}</td>
                <td className="tbl-td">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${f.pct >= 100 ? 'bg-red-500' : f.pct >= 80 ? 'bg-amber-400' : 'bg-brand'}`} style={{ width: `${Math.min(100, f.pct)}%` }} />
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    {f.pct}%
                    {f.available < 0 && (
                      <span className="ml-1 inline-flex items-center gap-0.5 font-semibold text-red-600">
                        <Icon name="warning" className="h-3 w-3" /> {t('เกินวงเงิน')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="tbl-td text-right whitespace-nowrap">
                  <button onClick={() => setDrawdown(f)} className="tap mr-2 text-sm text-brand hover:underline">{t('เบิกใช้')}</button>
                  <button onClick={() => setAdjust(f)} className="tap mr-1 text-slate-400 hover:text-slate-700"
                    title={t('ปรับวงเงิน / ใช้ไป')} aria-label={t('ปรับวงเงิน / ใช้ไป')}><Icon name="edit" className="inline h-4 w-4" /></button>
                  {/* ทะเบียนวงเงินทั้งใบ (ธนาคาร · เลขที่สัญญา · ดอกเบี้ย) แก้ไม่บ่อย
                      แต่ต้องแก้ได้ — แยกปุ่มไว้ ไม่ปนกับงานกระทบยอดรายเดือน */}
                  <button onClick={() => setEdit(f)} className="tap text-slate-400 hover:text-slate-700"
                    title={t('แก้ไขวงเงิน')} aria-label={t('แก้ไขวงเงิน')}><Icon name="card" className="inline h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit !== undefined && (
        <FacilityModal facility={edit} projects={projects} types={types} onClose={() => setEdit(undefined)} onSaved={refresh} />
      )}
      {adjust && (
        <AdjustLimitModal facility={adjust} label={`${projName(adjust.project_id)} · ${adjust.type}`}
          onClose={() => setAdjust(null)} onSaved={refresh} />
      )}
      {drawdown && (
        <DrawdownModal facility={drawdown} costCategories={costCategories} types={types}
          onClose={() => setDrawdown(null)} onSaved={refresh} />
      )}
    </div>
  );
}
