import { useState } from 'react';
import { Modal } from '../../components/ui/index.js';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { sysmapApi } from '../../lib/sysmap.js';
import { useT } from '../../lib/i18n.jsx';

/**
 * One form for every kind of row on the map.
 *
 * The client asked to maintain this themselves rather than call a developer, and
 * a form over the data does that. The shapes differ only in their fields, so one
 * component drives them from a field list instead of five near-identical modals.
 */
const FIELDS = {
  lane: [
    { k: 'id', label: 'รหัสเลน', required: true, newOnly: true, hint: 'ตัวอักษรอังกฤษ ตัวเลข . _ - เช่น lane-a' },
    { k: 'label_en', label: 'ชื่อ (อังกฤษ)', required: true, multiline: true },
    { k: 'label_th', label: 'ชื่อ (ไทย)', multiline: true },
  ],
  node: [
    { k: 'id', label: 'รหัสกล่องงาน', required: true, newOnly: true, hint: 'เช่น n-bd-pipeline' },
    { k: 'lane_id', label: 'อยู่ในเลน', required: true, type: 'lane' },
    { k: 'node_type', label: 'ประเภท', type: 'select', options: [['manual', 'ทำมือ'], ['erp', 'อยู่ใน ERP']] },
    { k: 'dept', label: 'แผนกหลัก', type: 'dept' },
    { k: 'dept2', label: 'แผนกร่วม', type: 'dept' },
    { k: 'label_en', label: 'ชื่องาน (อังกฤษ)', required: true, multiline: true },
    { k: 'label_th', label: 'ชื่องาน (ไทย)', multiline: true },
    { k: 'sub_en', label: 'คำขยาย (อังกฤษ)' },
    { k: 'sub_th', label: 'คำขยาย (ไทย)' },
    { k: 'module', label: 'โมดูล ERP', type: 'module' },
    { k: 'desc_en', label: 'คำอธิบาย (อังกฤษ)', multiline: true, rows: 4 },
    { k: 'desc_th', label: 'คำอธิบาย (ไทย)', multiline: true, rows: 4 },
    { k: 'items_en', label: 'สิ่งที่ทำในขั้นนี้ (อังกฤษ) — บรรทัดละข้อ', type: 'list', rows: 4 },
    { k: 'items_th', label: 'สิ่งที่ทำในขั้นนี้ (ไทย) — บรรทัดละข้อ', type: 'list', rows: 4 },
    { k: 'at_site', label: 'ทำที่หน้างาน', type: 'bool' },
    { k: 'unverified', label: 'ยังไม่ยืนยันข้อมูล', type: 'bool' },
  ],
  fn: [
    { k: 'code', label: 'รหัสฟังก์ชัน', required: true, newOnly: true, hint: 'เช่น ENG-01' },
    { k: 'dept', label: 'แผนก', type: 'dept' },
    { k: 'name_en', label: 'ชื่องาน (อังกฤษ)', required: true },
    { k: 'name_th', label: 'ชื่องาน (ไทย)' },
    { k: 'erp_type', label: 'สถานะใน ERP', hint: 'เช่น ERP, Non-ERP, Partial' },
    { k: 'module', label: 'โมดูล' },
    { k: 'notes_en', label: 'หมายเหตุ (อังกฤษ)', multiline: true, rows: 3 },
    { k: 'notes_th', label: 'หมายเหตุ (ไทย)', multiline: true, rows: 3 },
    { k: 'at_site', label: 'ทำที่หน้างาน', type: 'bool' },
    { k: 'external_entry', label: 'คนนอกเป็นผู้กรอกข้อมูล', type: 'bool' },
  ],
  ai: [
    { k: 'key', label: 'รหัสรายการ', required: true, newOnly: true },
    { k: 'title_en', label: 'หัวข้อ (อังกฤษ)', required: true },
    { k: 'title_th', label: 'หัวข้อ (ไทย)' },
    { k: 'impact', label: 'ผลกระทบ', type: 'select', options: [['High', 'สูง'], ['Medium', 'ปานกลาง'], ['Low', 'ต่ำ']] },
    { k: 'effort', label: 'แรงที่ต้องลง', type: 'select', options: [['High', 'สูง'], ['Medium', 'ปานกลาง'], ['Low', 'ต่ำ']] },
    { k: 'tool', label: 'เครื่องมือที่เสนอ' },
    { k: 'desc_en', label: 'รายละเอียด (อังกฤษ)', multiline: true, rows: 4 },
    { k: 'desc_th', label: 'รายละเอียด (ไทย)', multiline: true, rows: 4 },
  ],
};

const TITLE = { lane: 'เลน', node: 'กล่องงาน', fn: 'ฟังก์ชัน', ai: 'โอกาสใช้ AI' };
const KEY_OF = { lane: 'id', node: 'id', fn: 'code', ai: 'key' };

const API = {
  lane: { create: sysmapApi.createLane, update: sysmapApi.updateLane, remove: sysmapApi.deleteLane },
  node: { create: sysmapApi.createNode, update: sysmapApi.updateNode, remove: sysmapApi.deleteNode },
  fn: { create: sysmapApi.createFunction, update: sysmapApi.updateFunction, remove: sysmapApi.deleteFunction },
  ai: { create: sysmapApi.createAi, update: sysmapApi.updateAi, remove: sysmapApi.deleteAi },
};

export default function EditModal({ kind, row, lanes = [], depts = [], modules = [], onClose, onSaved }) {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const editing = Boolean(row);
  const fields = FIELDS[kind];
  const [form, setForm] = useState(() => {
    const f = {};
    for (const x of fields) {
      const v = row?.[x.k];
      f[x.k] = x.type === 'list' ? (Array.isArray(v) ? v.join('\n') : '') : (v ?? (x.type === 'bool' ? false : ''));
    }
    return f;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    for (const f of fields) {
      if (f.required && !String(form[f.k] ?? '').trim() && !(editing && f.newOnly)) {
        setError(`กรุณากรอก "${f.label}"`); return;
      }
    }
    const body = {};
    for (const f of fields) {
      if (editing && f.newOnly) continue;
      body[f.k] = f.type === 'list'
        ? String(form[f.k] || '').split('\n').map((s) => s.trim()).filter(Boolean)
        : f.type === 'bool' ? Boolean(form[f.k]) : String(form[f.k] ?? '').trim();
    }
    setBusy(true);
    try {
      if (editing) await API[kind].update(row[KEY_OF[kind]], body);
      else await API[kind].create(body);
      toast.success(editing ? 'บันทึกแล้ว' : `เพิ่ม${TITLE[kind]}แล้ว`);
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    const ok = await confirm({
      title: `ลบ${TITLE[kind]}`,
      message: kind === 'node'
        ? 'เส้นเชื่อมที่ต่อกับกล่องนี้จะถูกลบไปด้วย เพราะเส้นที่ปลายทางหายไปจะกลายเป็นเส้นชี้ไปที่ว่าง'
        : `ลบ "${row[KEY_OF[kind]]}" ออกจากแผนผัง?`,
      confirmLabel: t('ลบ'), danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await API[kind].remove(row[KEY_OF[kind]]);
      toast.success(r?.data?.removedConns ? `ลบแล้ว · เส้นเชื่อมที่ถูกลบด้วย ${r.data.removedConns} เส้น` : 'ลบแล้ว');
      onSaved();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  const Field = ({ f }) => {
    if (editing && f.newOnly) return null;
    const common = 'field';
    if (f.type === 'bool') {
      return (
        <label className="flex cursor-pointer items-center gap-2 py-1">
          <input type="checkbox" checked={Boolean(form[f.k])} onChange={(e) => set(f.k, e.target.checked)}
            className="h-4 w-4 rounded border-slate-300" />
          <span className="text-sm text-slate-700">{f.label}</span>
        </label>
      );
    }
    const opts = f.type === 'lane' ? lanes.map((l) => [l.id, `${l.id} · ${(l.label_th || l.label_en).replace(/\n/g, ' ')}`])
      : f.type === 'dept' ? [['', '— ไม่ระบุ —'], ...depts.map((d) => [d.key, d.name_th || d.name_en])]
        : f.type === 'module' ? [['', '— ไม่ระบุ —'], ...modules.map((m) => [m.code, `${m.code} · ${m.name}`])]
          : f.options;
    return (
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600">
          {f.label} {f.required && <span className="text-red-500">*</span>}
        </label>
        {opts ? (
          <select value={form[f.k] ?? ''} onChange={(e) => set(f.k, e.target.value)} className={common}>
            {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ) : (f.multiline || f.type === 'list') ? (
          <textarea value={form[f.k] ?? ''} onChange={(e) => set(f.k, e.target.value)} rows={f.rows || 2} className={common} />
        ) : (
          <input value={form[f.k] ?? ''} onChange={(e) => set(f.k, e.target.value)} className={common} />
        )}
        {f.hint && <p className="mt-1 text-xs text-slate-400">{f.hint}</p>}
      </div>
    );
  };

  return (
    <Modal
      title={`${editing ? 'แก้ไข' : 'เพิ่ม'}${TITLE[kind]}`}
      onClose={busy ? undefined : onClose}
      size="md"
      footer={
        <>
          {editing && <button type="button" onClick={remove} disabled={busy} className="mr-auto text-sm font-medium text-rose-600 hover:underline disabled:opacity-50">{t('ลบ')}</button>}
          <button type="button" onClick={onClose} className="btn-outline">{t('ยกเลิก')}</button>
          <button type="submit" form="sysmap-form" disabled={busy} className="btn-primary">{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
        </>
      }
    >
      <form id="sysmap-form" onSubmit={submit} className="space-y-3">
        {fields.map((f) => <Field key={f.k} f={f} />)}
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      </form>
    </Modal>
  );
}
