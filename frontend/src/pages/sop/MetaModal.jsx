import { useState } from 'react';
import { sopApi } from '../../lib/sop.js';
import { Modal } from '../../components/ui/index.js';
import { useToast } from '../../components/Toast.jsx';
import { BusyLabel } from '../../components/Spinner.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * แก้ไขหัวเอกสาร — ระบบจริงของลูกค้าเรียกหน้าต่างนี้ว่า "แก้ไขหัวเอกสาร ·
 * Edit document header" ใช้แก้ชื่อคู่มือ ฉบับ วันมีผล ขอบเขต วัตถุประสงค์ และ
 * หมายเหตุท้ายเล่ม ซึ่งเป็นข้อความที่โผล่ทั้งบนแถบหัว เมนูซ้าย และกล่องวัตถุประสงค์
 *
 * หมายเหตุฝั่งเซิร์ฟเวอร์เก็บเป็น text[] ที่นี่จึงรับเป็นกล่องข้อความบรรทัดละข้อ
 * แล้วตัดบรรทัดว่างทิ้งตอนบันทึก ผู้ใช้ไม่ต้องรู้ว่าข้างในเก็บเป็นอาเรย์
 */
export default function MetaModal({ meta, onClose, onSaved }) {
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: meta?.title || '',
    subtitle: meta?.subtitle || '',
    manual: meta?.manual || '',
    version: meta?.version || '',
    effective: meta?.effective || '',
    scope: meta?.scope || '',
    purpose: meta?.purpose || '',
    notes: Array.isArray(meta?.notes) ? meta.notes.join('\n') : '',
  });
  const set = (k, v) => setForm((x) => ({ ...x, [k]: v }));

  const save = async (e) => {
    e?.preventDefault?.();
    if (!form.title.trim()) { toast.error(t('กรุณากรอกชื่อเอกสาร')); return; }
    setBusy(true);
    try {
      await sopApi.updateMeta({
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        manual: form.manual.trim() || null,
        version: form.version.trim() || null,
        effective: form.effective.trim() || null,
        scope: form.scope.trim() || null,
        purpose: form.purpose.trim() || null,
        notes: form.notes.split('\n').map((s) => s.trim()).filter(Boolean),
      });
      toast.success(t('บันทึกหัวเอกสารแล้ว'));
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err?.message || t('บันทึกไม่สำเร็จ'));
    } finally {
      setBusy(false);
    }
  };

  const Text = ({ k, label, placeholder, rows }) => (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-600">{t(label)}</label>
      {rows
        ? <textarea value={form[k]} onChange={(e) => set(k, e.target.value)} rows={rows} className="field resize-y" />
        : <input value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder={placeholder ? t(placeholder) : ''} className="field" />}
    </div>
  );

  return (
    <Modal title={t('แก้ไขหัวเอกสาร · Edit document header')} onClose={onClose} size="2xl"
      footer={<>
        <button onClick={onClose} className="btn-outline">{t('ยกเลิก')}</button>
        <button onClick={save} disabled={busy} className="btn-primary">
          <BusyLabel busy={busy} busyText="กำลังบันทึก…">{t('บันทึก')}</BusyLabel>
        </button>
      </>}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('ชื่อเอกสาร *')}</label>
          <input value={form.title} onChange={(e) => set('title', e.target.value)} className="field" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('คำบรรยาย')}</label>
          <input value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} className="field" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('เวอร์ชัน')}</label>
            <input value={form.version} onChange={(e) => set('version', e.target.value)} placeholder="v1.0 (Revised)" className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('มีผล')}</label>
            <input value={form.effective} onChange={(e) => set('effective', e.target.value)} placeholder={t('เช่น เมษายน 2569')} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('ระบบอ้างอิง')}</label>
            <input value={form.manual} onChange={(e) => set('manual', e.target.value)} placeholder="Mango ERP Manual 14.3.68" className="field" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('ขอบเขต')}</label>
          <textarea value={form.scope} onChange={(e) => set('scope', e.target.value)} rows={2} className="field resize-y" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('วัตถุประสงค์')}</label>
          <textarea value={form.purpose} onChange={(e) => set('purpose', e.target.value)} rows={6} className="field resize-y" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('หมายเหตุ')}</label>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={4} className="field resize-y" />
          <p className="mt-1 text-xs text-slate-400">{t('บรรทัดละหนึ่งข้อ')}</p>
        </div>
      </form>
    </Modal>
  );
}
