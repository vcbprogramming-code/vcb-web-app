import { useEffect, useRef, useState } from 'react';
import { programApi } from '../../lib/onboardingProgram.js';
import { useToast } from '../../components/Toast.jsx';
import { Modal } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * หน้าเฟสหนึ่งช่วง — หัวใจของโปรแกรม
 *
 * เฟสที่ยังไม่ปลดล็อก **ไม่ได้ซ่อนเนื้อหา** ช่องติ๊กเท่านั้นที่กดไม่ได้ พร้อม
 * แถบอธิบายว่าติดอะไร เพราะสองสาเหตุ (เอกสารไม่ครบ / เฟสก่อนยังไม่จบ) ต้องทำ
 * คนละอย่างเพื่อปลดล็อก บอกรวม ๆ ว่า "ยังล็อกอยู่" ไม่ช่วยใครเลย
 *
 * การติ๊กอัปเดตหน้าจอก่อนรอเซิร์ฟเวอร์ ล้มเหลวครั้งแรกลองซ้ำอัตโนมัติหนึ่งครั้ง
 * ล้มซ้ำจึงย้อนเครื่องหมายกลับ — ไม่ปล่อยให้เข้าใจผิดว่าบันทึกแล้วทั้งที่ไม่
 */
export default function Phase({ phase, status, isAdmin, onChanged, onReward, onNext }) {
  const t = useT();
  const toast = useToast();
  const unlocked = status.unlocked[phase.id];
  const reason = status.lockReason[phase.id];
  const track = status.track;
  const [local, setLocal] = useState(() => new Set(status.done));
  const [celebrate, setCelebrate] = useState(null);
  const wasComplete = useRef(null);

  useEffect(() => { setLocal(new Set(status.done)); }, [status.done]);

  const visible = (items) => items.filter((i) => i.level === 'junior' || track === 'senior');
  const all = phase.blocks.flatMap((b) => visible(b.items));
  const doneCount = all.filter((i) => local.has(i.id)).length;
  const complete = all.length > 0 && doneCount === all.length;

  // ป๊อปอัปฉลองขึ้นเฉพาะ "ตอนที่เพิ่งเปลี่ยนเป็นเสร็จ" ไม่ใช่ทุกครั้งที่เปิดหน้า
  useEffect(() => {
    if (wasComplete.current === null) { wasComplete.current = complete; return; }
    if (complete && !wasComplete.current) setCelebrate(status.allComplete ? 'all' : 'phase');
    wasComplete.current = complete;
  }, [complete, status.allComplete]);

  const toggle = async (item) => {
    if (!unlocked) return;
    const next = !local.has(item.id);
    setLocal((s) => { const n = new Set(s); if (next) n.add(item.id); else n.delete(item.id); return n; });
    if (next) onReward?.();
    const attempt = () => programApi.toggle(item.id, next);
    try {
      try { await attempt(); } catch { await attempt(); }   // ลองซ้ำอัตโนมัติหนึ่งครั้ง
      await onChanged();
    } catch (e) {
      setLocal((s) => { const n = new Set(s); if (next) n.delete(item.id); else n.add(item.id); return n; });
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card-sm">
        {phase.eyebrow && <div className="text-xs font-semibold uppercase tracking-wide text-brand">{phase.eyebrow}</div>}
        <h2 className="mt-0.5 text-lg font-bold text-slate-900">{phase.title}</h2>
        <div className="mt-1 text-sm text-slate-500">{doneCount}/{all.length} {t('รายการ')}</div>
      </div>

      {!unlocked && (
        <div className="card-sm border-l-4 border-amber-400 text-sm text-slate-700">
          {reason === 'documents'
            ? t('ส่งเอกสารให้ครบก่อน จึงจะเริ่มติ๊กรายการในเฟสนี้ได้ — เนื้อหาด้านล่างอ่านล่วงหน้าได้เลย')
            : t('ทำเฟสก่อนหน้าให้ครบก่อน จึงจะเริ่มติ๊กรายการในเฟสนี้ได้ — เนื้อหาด้านล่างอ่านล่วงหน้าได้เลย')}
        </div>
      )}

      {phase.blocks.map((b) => {
        const items = visible(b.items);
        if (!items.length) return null;
        return (
          <div key={b.id} className="card">
            <h3 className="mb-2 font-bold text-slate-800">{b.heading}</h3>
            <div className="divide-y divide-slate-100">
              {items.map((it) => {
                const on = local.has(it.id);
                return (
                  <label key={it.id}
                    className={`flex items-start gap-3 py-2.5 ${unlocked ? 'cursor-pointer' : 'cursor-default'}`}>
                    <input type="checkbox" checked={on} disabled={!unlocked}
                      onChange={() => toggle(it)}
                      className="mt-1 h-4 w-4 accent-emerald-600 disabled:opacity-40" />
                    <span className={`text-sm ${on ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                      {it.text}
                      {it.level === 'senior' && (
                        <span className="ml-2 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                          {t('ระดับอาวุโส')}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      {phase.closing && complete && (
        <div className="card-sm text-sm text-slate-600">{phase.closing}</div>
      )}

      {celebrate && (
        <Modal title={celebrate === 'all' ? t('ครบ 90 วันแล้ว') : t('จบเฟสนี้แล้ว')}
          onClose={() => setCelebrate(null)} size="sm"
          footer={(
            <>
              <button onClick={() => setCelebrate(null)} className="btn-outline">{t('อยู่หน้านี้ต่อ')}</button>
              <button onClick={() => { setCelebrate(null); onNext?.(); }} className="btn-primary">
                {celebrate === 'all' ? t('ไปหน้าจบโปรแกรม') : t('ไปเฟสถัดไป')}
              </button>
            </>
          )}>
          <div className="py-2 text-center">
            <Icon name="check" className="mx-auto h-10 w-10 text-emerald-500" />
            <p className="mt-2 text-slate-700">
              {celebrate === 'all'
                ? t('ยินดีต้อนรับเข้าสู่ทีมอย่างเป็นทางการ')
                : t('ทำครบทุกรายการของเฟสนี้แล้ว')}
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
