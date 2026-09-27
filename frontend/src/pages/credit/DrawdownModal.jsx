import { useMemo, useState } from 'react';
import { creditApi, formatMoney } from '../../lib/modules.js';
import { Modal } from '../../components/ui/index.js';
import { useT } from '../../lib/i18n.jsx';
import { CostCategoryCombo, projectLabel } from './shared.jsx';

/**
 * บันทึกการใช้วงเงิน
 *
 * เปิดได้สองทาง เหมือนระบบจริง: จากแถวในตาราง (รู้อยู่แล้วว่าวงเงินก้อนไหน) หรือ
 * จากปุ่มบนแถบตัวกรองโดยยังไม่ได้เลือกอะไร — ทางหลังคือวิธีที่คนใช้จริงตอนมี
 * เอกสารอยู่ในมือ เขารู้ว่า "โครงการนี้ ประเภทนี้" ไม่ได้รู้ว่าเป็นวงเงินแถวที่เท่าไร
 * การบังคับให้ไปหาแถวก่อนจึงเป็นขั้นตอนที่ไม่มีอยู่ในงานจริง
 */
export default function DrawdownModal({ facility, facilities = [], projects = [], types = [], costCategories = [], onClose, onSaved }) {
  const t = useT();
  const fixed = Boolean(facility);
  const [pick, setPick] = useState({ projectId: '', facilityNo: '' });
  const [form, setForm] = useState({
    amount: '', startDate: '', dueDate: '', termDays: '', ref: '', note: '',
    counterparty: '', beneficiary: '', costCategory: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // โครงการที่มีวงเงินอยู่จริงเท่านั้น — เลือกโครงการที่ยังไม่มีวงเงินแล้วช่อง
  // ประเภทจะว่าง ซึ่งอ่านเหมือนระบบพัง ทั้งที่แค่ยังไม่ได้ตั้งวงเงินให้โครงการนั้น
  const projectsWithFacilities = useMemo(() => {
    const ids = new Set(facilities.map((f) => f.project_id));
    return projects.filter((p) => ids.has(p.id));
  }, [facilities, projects]);
  const ofProject = useMemo(
    () => facilities.filter((f) => f.project_id === pick.projectId),
    [facilities, pick.projectId]);
  const chosen = fixed ? facility
    : ofProject.find((f) => String(f.facility_no) === String(pick.facilityNo));

  const typeName = (no) => types.find((x) => String(x.no) === String(no))?.name_th || `#${no}`;

  const submit = async (e) => {
    e.preventDefault();
    if (!chosen) { setError(t('กรอกข้อมูลที่จำเป็น (*) ให้ครบ')); return; }
    setBusy(true);
    setError(null);
    try {
      await creditApi.addLedger({
        facilityId: chosen.id,
        amount: Number(form.amount),
        status: 'อนุมัติแล้ว',
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        termDays: form.termDays === '' ? null : Number(form.termDays),
        ref: form.ref || null,
        note: form.note || null,
        counterparty: form.counterparty || null,
        beneficiary: form.beneficiary || null,
        costCategory: form.costCategory || null,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={fixed ? `${t('บันทึกการใช้วงเงิน')} · ${facility.type}` : t('บันทึกการใช้วงเงิน')}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-outline">{t('ยกเลิก')}</button>
          <button onClick={submit} disabled={busy} className="btn-primary">{busy ? t('กำลังบันทึก…') : t('บันทึก')}</button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {!fixed && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">{t('โครงการ')} <span className="text-red-500">*</span></label>
              <select value={pick.projectId} title={t('โครงการ')} className="field"
                onChange={(e) => setPick({ projectId: e.target.value, facilityNo: '' })}>
                <option value="">{t('— เลือกโครงการ —')}</option>
                {projectsWithFacilities.map((p) => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">{t('ประเภทวงเงิน')} <span className="text-red-500">*</span></label>
              <select value={pick.facilityNo} title={t('ประเภทวงเงิน')} className="field"
                onChange={(e) => setPick((p) => ({ ...p, facilityNo: e.target.value }))}
                disabled={!pick.projectId}>
                <option value="">{t('— เลือกประเภท —')}</option>
                {ofProject.map((f) => (
                  <option key={f.id} value={f.facility_no}>{f.facility_no}. {typeName(f.facility_no)}</option>
                ))}
              </select>
              {/* บอกคงเหลือตรงนี้เลย คนกรอกจะได้ไม่ต้องเปิดอีกแท็บไปดู */}
              {chosen && (
                <p className="mt-1 text-xs text-slate-500">
                  {t('คงเหลือใช้ได้')} {formatMoney(chosen.available)}
                </p>
              )}
            </div>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">
            {t('จำนวนเงิน (บาท) — ใส่ค่าลบเมื่อปลด/คืนวงเงิน')} <span className="text-red-500">*</span>
          </label>
          <input type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="field" />
          {Number(form.amount) < 0 && (
            <p className="mt-1 text-xs text-amber-700">
              {t('ยอดติดลบคือการปลดวงเงินคืน — ยอดใช้ไปของวงเงินก้อนนี้จะลดลงเท่าที่ใส่')}
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('วันเริ่ม')}</label>
            <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} className="field" />
          </div>
          <div>
            {/* กรอกจำนวนวันแล้วได้วันครบกำหนดเลย แบบเดียวกับที่เขาทำกันอยู่ */}
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('จำนวนวัน')}</label>
            <input type="number" value={form.termDays} onChange={(e) => set('termDays', e.target.value)} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('ครบกำหนด')}</label>
            <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className="field" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('รายละเอียด / คู่ค้า')}</label>
            <input value={form.counterparty} onChange={(e) => set('counterparty', e.target.value)} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('ผู้รับผลประโยชน์')}</label>
            <input value={form.beneficiary} onChange={(e) => set('beneficiary', e.target.value)} className="field" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            {/* หมวดนี้เป็นตัวป้อนหน้าสรุปค่าใช้จ่าย ไม่ใส่ก็ยังบันทึกได้
                แต่รายการจะไปรวมอยู่กลุ่ม "ไม่ระบุหมวด" */}
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('หมวดค่าใช้จ่าย')}</label>
            <CostCategoryCombo value={form.costCategory} onChange={(v) => set('costCategory', v)} options={costCategories} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('เลขที่อ้างอิง')}</label>
            <input value={form.ref} onChange={(e) => set('ref', e.target.value)} className="field" placeholder={t('เช่น BT-001/69')} />
          </div>
        </div>
        <div>
          {/* เรื่องที่ต้องเล่าให้คนอ่านรายการรู้ทีหลัง ยาวกว่าหนึ่งบรรทัดเสมอ —
              ช่องบรรทัดเดียวทำให้คนย่อจนอ่านไม่รู้เรื่อง */}
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('หมายเหตุ')}</label>
          <textarea rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} className="field"
            placeholder={t('รายละเอียดเพิ่มเติม…')} />
        </div>
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
      </form>
    </Modal>
  );
}
