import { useEffect, useState } from 'react';
import { creditApi } from '../../lib/modules.js';
import { Modal } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * ตั้งค่า / Settings — จอเดียวกับปุ่มเฟืองของระบบจริง
 *
 * สองเรื่องที่คนละธรรมชาติกันอยู่ในจอเดียว และต้องบันทึกไม่เหมือนกัน:
 *
 *   พาเนลแดชบอร์ด เป็นความชอบของคนที่นั่งอยู่ ไม่ใช่ข้อมูลของบริษัท — เก็บไว้ที่
 *   เครื่องและมีผลทันทีที่กด ไม่ต้องรอกดบันทึก
 *
 *   ทะเบียนหมวดค่าใช้จ่าย เป็นข้อมูลกลาง คนหนึ่งแก้แล้วทุกคนเห็น — แก้ในจอนี้
 *   เป็นร่างก่อน แล้วเขียนทั้งชุดครั้งเดียวตอนกดบันทึก
 *
 * หมวดที่กดลบแล้วยังถูกอ้างจากรายการที่เบิกไปจริง ฝั่งเซิร์ฟเวอร์จะปิดการใช้งาน
 * ให้แทนการลบ — หายจากเมนู แต่เงินก้อนเก่ายังกระทบยอดได้ จอนี้บอกผลนั้นกลับมา
 */
export default function SettingsModal({ prefs, onSetPanel, onClose, onCategoriesSaved }) {
  const t = useT();
  const toast = useToast();
  const [cats, setCats] = useState(null);       // null = ยังโหลดไม่เสร็จ
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    creditApi.costCategories().then((r) => setCats(r.data || [])).catch(() => setCats([]));
  }, []);

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    if ((cats || []).includes(name)) { toast.error(t('มีหมวดนี้อยู่แล้ว')); return; }
    setCats([...(cats || []), name]);
    setNewName('');
  };
  const move = (i, dir) => {
    const j = i + dir;
    if (!cats || j < 0 || j >= cats.length) return;
    const next = cats.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setCats(next);
  };
  const remove = (i) => setCats((list) => list.filter((_, k) => k !== i));

  const save = async () => {
    setBusy(true);
    try {
      const r = await creditApi.setCostCategories(cats || []);
      // หมวดที่ถูกปิดแทนการลบ ต้องบอก ไม่ใช่เงียบ ๆ แล้วให้คนไปเจอเองว่ายังอยู่
      const off = r.data?.deactivated || [];
      toast.success(off.length
        ? `${t('บันทึกการตั้งค่าแล้ว')} · ${t('หมวดที่ยังถูกใช้อยู่ถูกปิดไว้แทนการลบ')} ${off.length}`
        : `${t('บันทึกการตั้งค่าแล้ว')} (${r.data?.count ?? 0} ${t('หมวด')})`);
      onCategoriesSaved?.(r.data?.list || cats);
      onClose();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const Panel = ({ group, name, label, hint }) => (
    <label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-slate-700">
      <input type="checkbox" checked={prefs[group][name] !== false}
        onChange={(e) => onSetPanel(group, name, e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand" />
      <span>{label}{hint ? <span className="ml-1 text-xs font-normal text-slate-400">{hint}</span> : null}</span>
    </label>
  );

  return (
    <Modal
      title={t('ตั้งค่า / Settings')}
      onClose={onClose}
      size="2xl"
      footer={
        <>
          <button onClick={onClose} className="btn-outline">{t('ปิด')}</button>
          <button onClick={save} disabled={busy || cats == null} className="btn-primary">
            {busy ? t('กำลังบันทึก…') : t('บันทึก')}
          </button>
        </>
      }
    >
      <div>
        <h4 className="text-sm font-bold text-slate-800">{t('แดชบอร์ด / Dashboard')}</h4>
        <p className="mt-0.5 text-xs text-slate-500">{t('เลือกพาเนลที่ต้องการแสดงบนแดชบอร์ด · Choose which panels to show')}</p>
        <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{t('วงเงินสินเชื่อ / Credit lines')}</div>
            <Panel group="lines" name="tl" label="T/L" />
            <Panel group="lines" name="bg" label="BG" />
            <Panel group="lines" name="ml" label="M/L" />
            <Panel group="lines" name="be" label="B/E" hint={t('(รวม DLC)')} />
            <Panel group="lines" name="pn" label="P/N" />
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{t('ครบกำหนด / Due dates')}</div>
            <Panel group="due" name="week" label={t('ภายใน 1 สัปดาห์')} />
            <Panel group="due" name="this" label={t('เดือนนี้')} />
            <Panel group="due" name="next" label={t('เดือนหน้า')} />
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{t('สถานะ / Status')}</div>
            <Panel group="status" name="new" label={t('คำขอใหม่')} />
            <Panel group="status" name="proposed" label={t('เสนออนุมัติ')} />
            <Panel group="status" name="approved" label={t('อนุมัติแล้ว')} />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <h4 className="text-sm font-bold text-slate-800">{t('หมวดค่าใช้จ่าย / Cost categories')}</h4>
        <p className="mt-0.5 text-xs text-slate-500">
          {t('ลำดับในรายการ = ลำดับที่แสดงในเมนู · กดลูกศรขึ้น-ลงเพื่อย้าย · กดกากบาทเพื่อลบ')}
        </p>
        <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-2">
          {cats == null ? (
            <div className="px-2 py-2 text-xs text-slate-400">{t('กำลังโหลด…')}</div>
          ) : cats.length === 0 ? (
            <div className="px-2 py-2 text-xs text-slate-500">{t('ยังไม่มีหมวด — เพิ่มหมวดแรกได้เลย')}</div>
          ) : (
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {cats.map((name, i) => (
                <div key={name} className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 text-sm">
                  <span className="w-6 shrink-0 text-right text-xs tabular-nums text-slate-400">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate text-slate-700" title={name}>{name}</span>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                    title={t('ย้ายขึ้น')} aria-label={t('ย้ายขึ้น')}
                    className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">
                    <Icon name="chevronDown" className="h-3.5 w-3.5 rotate-180" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === cats.length - 1}
                    title={t('ย้ายลง')} aria-label={t('ย้ายลง')}
                    className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">
                    <Icon name="chevronDown" className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => remove(i)} title={t('ลบ')} aria-label={t('ลบ')}
                    className="rounded p-1 text-slate-400 hover:text-red-600">
                    <Icon name="x" className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            placeholder={t('พิมพ์ชื่อหมวดใหม่…')} className="field flex-1" />
          <button type="button" onClick={add} className="btn-outline whitespace-nowrap">
            <Icon name="plus" className="h-4 w-4" /> {t('เพิ่มหมวด')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
