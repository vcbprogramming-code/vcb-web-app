import { useEffect, useRef, useState } from 'react';
import { programApi, pick } from '../../lib/onboardingProgram.js';
import { useToast } from '../../components/Toast.jsx';
import { Modal } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * หน้าเฟสหนึ่งช่วง — หัวใจของโปรแกรม
 *
 * ข้อความของหัวเฟส หัวบล็อก และข้อเช็กลิสต์ทุกข้อมาจากฐานข้อมูลเป็นคู่ภาษา
 * (text / text_th) แล้วเลือกตรงจุดที่วาด ไม่ได้ห่อด้วย t() — เนื้อหาเช็กลิสต์
 * เป็น *ข้อมูล* ไม่ใช่ข้อความบนหน้าจอ ถ้าห่อ t() พจนานุกรมจะไม่มีคีย์ให้เจอ
 * และหน้าไทยจะกลับไปเป็นอังกฤษล้วนเหมือนก่อนรอบนี้
 *
 * เฟสที่ยังไม่ปลดล็อก **ไม่ได้ซ่อนเนื้อหา** ช่องติ๊กเท่านั้นที่กดไม่ได้ พร้อม
 * แถบอธิบายว่าติดอะไร เพราะสองสาเหตุ (เอกสารไม่ครบ / เฟสก่อนยังไม่จบ) ต้องทำ
 * คนละอย่างเพื่อปลดล็อก บอกรวม ๆ ว่า "ยังล็อกอยู่" ไม่ช่วยใครเลย
 *
 * การติ๊กอัปเดตหน้าจอก่อนรอเซิร์ฟเวอร์ ล้มเหลวครั้งแรกลองซ้ำอัตโนมัติหนึ่งครั้ง
 * ล้มซ้ำจึงย้อนเครื่องหมายกลับ — ไม่ปล่อยให้เข้าใจผิดว่าบันทึกแล้วทั้งที่ไม่
 */
export default function Phase({ phase, status, lang, onChanged, onReward, onNext }) {
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

  const eyebrow = pick(lang, phase.eyebrow, phase.eyebrow_th);
  const title = pick(lang, phase.title, phase.title_th);
  const closing = pick(lang, phase.closing, phase.closing_th);

  return (
    <div className="space-y-4">
      <div className="card-sm">
        {eyebrow && <div className="text-xs font-semibold uppercase tracking-wide text-brand">{eyebrow}</div>}
        <h2 className="mt-0.5 text-lg font-bold text-slate-900">{title}</h2>
        <div className="mt-1 text-sm text-slate-500">{doneCount}/{all.length} {t('รายการ')}</div>
      </div>

      {!unlocked && (
        <div className="card-sm border-l-4 border-amber-400 text-sm text-slate-700">
          {reason === 'documents'
            ? t('กรอกเอกสารที่จำเป็นทั้งหมดให้ครบเพื่อปลดล็อกระยะนี้ คุณยังสามารถอ่านเนื้อหาด้านล่างได้ตามปกติ')
            : t('ทำเฟสก่อนหน้าให้เสร็จเพื่อปลดล็อกงานเหล่านี้ คุณยังสามารถอ่านเนื้อหาด้านล่างได้ตามปกติ')}
        </div>
      )}

      {phase.blocks.map((b) => {
        const items = visible(b.items);
        if (!items.length) return null;
        const bDone = items.filter((i) => local.has(i.id)).length;
        const bPct = Math.round((bDone / items.length) * 100);
        return (
          <div key={b.id} className="card">
            <h3 className="mb-2 font-bold text-slate-800">{pick(lang, b.heading, b.heading_th)}</h3>
            {/* แถบความคืบหน้าต่อบล็อก — ของเขามีแถบนี้เหนือทุกกลุ่มเช็กลิสต์ */}
            <div className="mb-3 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full transition-all ${bPct === 100 ? 'bg-emerald-500' : 'bg-brand'}`}
                  style={{ width: `${bPct}%` }} />
              </div>
              <span className="shrink-0 text-xs tabular-nums text-slate-500">{bPct}% {t('เสร็จสมบูรณ์')}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {items.map((it) => {
                const on = local.has(it.id);
                return (
                  <label key={it.id}
                    className={`flex items-start gap-3 py-2.5 ${unlocked ? 'cursor-pointer' : 'cursor-default'} ${
                      it.level === 'senior' ? '-ml-3 border-l-2 border-amber-400 pl-3' : ''}`}>
                    <input type="checkbox" checked={on} disabled={!unlocked}
                      onChange={() => toggle(it)}
                      className="mt-1 h-4 w-4 accent-emerald-600 disabled:opacity-40" />
                    <span className={`text-sm ${on ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                      {pick(lang, it.text, it.text_th)}
                      {it.level === 'senior' && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          {t('ซีเนียร์')}
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

      {closing && complete && (
        <div className="card-sm text-sm text-slate-600">{closing}</div>
      )}

      {/* 'จบเฟสนี้แล้ว' ไม่ใช่ 'ทำสำเร็จหนึ่งหมวดแล้ว' ของเขา — ป๊อปอัปนั้นของเขา
          ขึ้นตอนจบ *บล็อก* หนึ่ง ของเราขึ้นตอนจบทั้งเฟส คำเดียวกันจึงผิดความหมาย */}
      {celebrate && (
        <Modal title={celebrate === 'all' ? t('ครบ 90 วันแล้ว') : t('จบเฟสนี้แล้ว')}
          onClose={() => setCelebrate(null)} size="md"
          footer={(
            <>
              <button onClick={() => setCelebrate(null)} className="btn-outline">{t('อยู่หน้านี้ต่อ')}</button>
              <button onClick={() => { setCelebrate(null); onNext?.(); }} className="btn-primary">
                {celebrate === 'all' ? t('ไปหน้าสำเร็จการปฐมนิเทศ') : t('ไปเฟสถัดไป')}
              </button>
            </>
          )}>
          <div className="py-2 text-center">
            <Icon name="check" className="mx-auto h-10 w-10 text-emerald-500" />
            <p className="mt-2 text-slate-700">
              {celebrate === 'all'
                ? t('คุณผ่านโปรแกรมปฐมนิเทศ 90 วันเต็มรูปแบบเรียบร้อยแล้ว')
                : t('ทำครบทุกรายการของเฟสนี้แล้ว')}
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
