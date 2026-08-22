import { useMemo, useState } from 'react';
import { pick } from '../../lib/sysmap.js';
import Icon from '../../components/Icon.jsx';

const TONE = {
  High:   'bg-emerald-50 text-emerald-700',
  Medium: 'bg-amber-50 text-amber-700',
  Low:    'bg-slate-100 text-slate-600',
};
const TH = { High: 'สูง', Medium: 'ปานกลาง', Low: 'ต่ำ' };

/** โอกาสใช้ AI — where automation was judged to pay off, and how hard it is.
 *  Sorted so the obvious wins (high impact, low effort) come first. */
export default function AiView({ rows, lang, canEdit, onEdit, onNew }) {
  const [impact, setImpact] = useState('');
  const rank = (r) => (r.impact === 'High' ? 0 : r.impact === 'Medium' ? 1 : 2) * 3
    + (r.effort === 'Low' ? 0 : r.effort === 'Medium' ? 1 : 2);

  const list = useMemo(() => {
    const f = impact ? rows.filter((r) => r.impact === impact) : rows;
    return [...f].sort((a, b) => rank(a) - rank(b));
  }, [rows, impact]);

  const chip = (on) => `rounded-full border px-3 py-1.5 text-sm font-medium transition ${
    on ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setImpact('')} className={chip(impact === '')}>ทั้งหมด <span className="ml-1 text-xs opacity-70">{rows.length}</span></button>
        {['High', 'Medium', 'Low'].map((k) => (
          <button key={k} onClick={() => setImpact(k)} className={chip(impact === k)}>
            ผลกระทบ{TH[k]} <span className="ml-1 text-xs opacity-70">{rows.filter((r) => r.impact === k).length}</span>
          </button>
        ))}
        {canEdit && <button onClick={onNew} className="btn-primary ml-auto !py-2 !text-sm"><Icon name="plus" className="h-4 w-4" /> เพิ่มรายการ</button>}
      </div>

      <p className="text-xs text-slate-500">เรียงจากคุ้มที่สุด — ผลกระทบสูงและทำได้ง่ายมาก่อน</p>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {list.map((r) => (
          <article key={r.key} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
            <header className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-800">{pick(lang, r.title_th, r.title_en)}</h3>
              {canEdit && <button onClick={() => onEdit(r)} className="shrink-0 text-sm font-medium text-brand hover:underline">แก้ไข</button>}
            </header>
            <div className="flex flex-wrap gap-1.5">
              <span className={`chip ${TONE[r.impact] || TONE.Low}`}>ผลกระทบ {TH[r.impact] || r.impact}</span>
              <span className={`chip ${r.effort === 'Low' ? 'bg-emerald-50 text-emerald-700' : r.effort === 'High' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                แรงที่ต้องลง {TH[r.effort] || r.effort}
              </span>
              {r.tool && <span className="chip bg-slate-100 text-slate-600">{r.tool}</span>}
            </div>
            {pick(lang, r.desc_th, r.desc_en) && (
              <p className="text-sm leading-relaxed text-slate-600">{pick(lang, r.desc_th, r.desc_en)}</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
