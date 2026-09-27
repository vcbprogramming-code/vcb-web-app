import { useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import Spinner from '../../components/Spinner.jsx';
import { programApi, pick } from '../../lib/onboardingProgram.js';
import { useT } from '../../lib/i18n.jsx';
import ObImage from './ObImage.jsx';
import Section from './Sections.jsx';

/**
 * หน้าเนื้อหาหนึ่งหน้า — ดึงจาก /pages/:key แล้ววาด section ตามลำดับ
 *
 * ทำไมไม่มาพร้อม bootstrap: ผังองค์กรอันเดียวมีคน 184 คนพร้อมคำบรรยายตำแหน่ง
 * ทุกคน ไม่มีเหตุผลให้พนักงานที่เปิดมาติ๊กเช็กลิสต์ต้องโหลดก้อนนั้นทุกครั้ง
 *
 * จำหน้าที่โหลดแล้วไว้ใน CACHE ระดับโมดูล — เนื้อหาพวกนี้เปลี่ยนเฉพาะเมื่อ
 * ผู้ดูแลนำเข้าเนื้อหาใหม่ (ไม่ใช่ทุกคลิกของผู้ใช้) สลับหน้าไปมาจึงไม่ต้องยิงซ้ำ
 * และไม่เห็นตัวหมุนรอบสอง
 */
const CACHE = new Map();

export default function ContentPage({ pageKey, lang, ctx = {}, variant = 'main', header = true }) {
  const t = useT();
  const [page, setPage] = useState(() => CACHE.get(pageKey) || null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pageKey) return undefined;
    const cached = CACHE.get(pageKey);
    if (cached) { setPage(cached); setError(null); return undefined; }
    let alive = true;
    setPage(null);
    setError(null);
    programApi.page(pageKey)
      .then((r) => { CACHE.set(pageKey, r.data); if (alive) setPage(r.data); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [pageKey]);

  if (error) {
    return (
      <div className="card space-y-2 py-10 text-center">
        <Icon name="warning" className="mx-auto h-7 w-7 text-amber-500" />
        <h3 className="font-bold text-slate-700">{t('เปิดหน้านี้ไม่สำเร็จ')}</h3>
        <p className="text-sm text-slate-500">{error}</p>
      </div>
    );
  }
  if (!page) return <div className="flex justify-center py-12"><Spinner label={t('กำลังโหลด…')} /></div>;

  const sections = variant === 'notdone' ? (page.notCompleteSections || []) : (page.sections || []);
  const closing = page.closing || null;

  return (
    <div className="space-y-4" data-ob-page={page.key}>
      {header && (
        <div className="card space-y-2">
          {page.eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">
              {pick(lang, page.eyebrow, page.eyebrow_th)}
            </p>
          )}
          <h2 className="text-xl font-bold text-slate-800">{pick(lang, page.title, page.title_th)}</h2>
          {page.lead && <p className="text-sm text-slate-600">{pick(lang, page.lead, page.lead_th)}</p>}
          {page.note && <p className="text-sm text-slate-500">{pick(lang, page.note, page.note_th)}</p>}
          {page.hero_image && (
            <ObImage imageKey={page.hero_image} alt={pick(lang, page.title, page.title_th)}
              ratio="aspect-[21/9]" eager />
          )}
        </div>
      )}

      {sections.map((s) => <Section key={`${s.variant}-${s.sort_order}`} section={s} lang={lang} ctx={ctx} />)}

      {closing?.label && (
        <div className="flex justify-end">
          <button type="button" onClick={() => ctx.onNavigate?.(closing.page)} className="btn-primary">
            {pick(lang, closing.label, closing.label_th)} <Icon name="arrowRight" className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
