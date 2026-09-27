import { useRef, useState } from 'react';
import { perfApi, downloadAs } from '../../lib/performance.js';
import { Modal } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * นำเข้าทะเบียนจาก Excel — แบบเดียวกับระบบที่ลูกค้าใช้อยู่ (Code.gs · miImportOpen)
 *
 * สามขั้นตรง ๆ : ดาวน์โหลดเทมเพลตเปล่า → กรอก → เลือกไฟล์ที่กรอกแล้ว แล้วนำเข้า
 * ทันที ไม่ต้องกดยืนยันอีกชั้น เพราะแถวที่กรอกผิดถูกข้ามและนับให้ดูอยู่แล้ว
 * ("นำเข้าแล้ว: +N / อัปเดต N / ข้าม N")
 *
 * ลำดับคอลัมน์ขึ้นเป็นตัวเลขกำกับ ไม่ให้เดา — ของเขาก็ทำแบบนี้เพราะคนวางคอลัมน์
 * สลับกันบ่อยที่สุด
 */
const COLS = {
  activity: ['ชื่อ (Name)', 'คำอธิบาย (Description)', 'หมวดหมู่ (Category)', 'รหัส (Code)'],
  cost: ['รหัส (Code)', 'ชื่อ-ไทย (Name)', 'ชื่อ-อังกฤษ (English)'],
};
const STEPS = [
  'ดาวน์โหลดเทมเพลตเปล่าด้านล่าง',
  'กรอกข้อมูลลงในไฟล์ Excel ตามคอลัมน์ที่กำหนด (เขียนทับแถวตัวอย่างได้)',
  'กด “เลือกไฟล์ที่กรอกแล้ว” แล้วเลือกไฟล์ที่บันทึกไว้ — ระบบจะนำเข้าให้ทันที',
];

export default function IndexImport({ kind, onClose, onDone }) {
  const t = useT();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);      // { kind: 'ok' | 'error', text }
  const isCost = kind === 'cost';

  const template = async () => {
    try {
      await downloadAs(perfApi.indexTemplateUrl(kind), isCost ? 'เทมเพลตหมวดงาน.xlsx' : 'เทมเพลตดัชนีงาน.xlsx');
    } catch (e) { setMsg({ kind: 'error', text: `${t('อ่านไฟล์ไม่สำเร็จ')}: ${e.message}` }); }
  };

  const upload = async (file) => {
    setBusy(true);
    setMsg({ kind: 'ok', text: `${t('กำลังนำเข้า…')} ${file.name}` });
    try {
      const r = isCost ? await perfApi.importCostCategories(file) : await perfApi.importActivities(file);
      const d = r.data || {};
      const parts = [`${t('นำเข้าแล้ว')}: +${d.added ?? d.imported ?? 0}`, `${t('อัปเดต')} ${d.updated ?? 0}`];
      if (d.skipped) parts.push(`${t('ข้าม')} ${d.skipped}`);
      setMsg({ kind: 'ok', text: parts.join(' / ') });
      onDone?.(parts.join(' / '));
    } catch (e) {
      setMsg({ kind: 'error', text: `${t('นำเข้าไม่สำเร็จ')}: ${e.message}` });
    } finally { setBusy(false); }
  };

  return (
    <Modal title={t(isCost ? 'นำเข้าหมวดงาน' : 'นำเข้ารายการดัชนีงาน')} onClose={onClose} size="xl"
      footer={<button onClick={onClose} className="btn-outline">{t('ปิด')}</button>}>
      <div className="rounded-xl bg-slate-50 p-4">
        <div className="mb-1.5 font-bold text-slate-800">{t('วิธีนำเข้า')}</div>
        <ol className="space-y-1 text-sm text-slate-600">
          {STEPS.map((s, i) => <li key={s}>{i + 1}. {t(s)}</li>)}
        </ol>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-200 pt-2.5 text-xs text-slate-500">
          <span className="font-medium">{t('ลำดับคอลัมน์:')}</span>
          {COLS[isCost ? 'cost' : 'activity'].map((c, i) => (
            <span key={c} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5">
              <b className="text-brand">{i + 1}</b> {c}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={template} className="btn-outline">
          <Icon name="download" className="h-4 w-4" /> {t('ดาวน์โหลดเทมเพลตเปล่า')}
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn-primary disabled:opacity-50">
          <Icon name="paperclip" className="h-4 w-4" /> {busy ? t('กำลังนำเข้า…') : t('เลือกไฟล์ที่กรอกแล้ว')}
        </button>
        {/* value ถูกล้างทุกครั้ง เพื่อให้เลือกไฟล์ชื่อเดิมซ้ำได้ */}
        <input ref={fileRef} type="file" accept=".xlsx" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f); }} />
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-2.5 text-sm ${
          msg.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {msg.text}
        </div>
      )}
    </Modal>
  );
}
