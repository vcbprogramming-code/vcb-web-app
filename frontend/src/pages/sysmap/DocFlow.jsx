import { useState } from 'react';
import { pick, docRoute, deptOf, CANVAS } from '../../lib/sysmap.js';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * การไหลของเอกสารหน้างาน (Document Control) — the paper that still moves
 * between the site and head office.
 *
 * A layer of its own under the process map, as it is in their system: these
 * seven are forms, not steps, and mixing them into the swimlane would put a
 * signed piece of paper on the same footing as an ERP transaction. Each one says
 * whether it is keyed into Mango straight away, later, only under some condition,
 * or deliberately left as a manual form.
 */
export default function DocFlow({ rows, depts, lang }) {
  const t = useT();
  const [open, setOpen] = useState(null);      // doc id
  const [pane, setPane] = useState('about');

  const select = (id) => {
    setOpen(open === id ? null : id);
    setPane('about');
  };
  const doc = rows.find((r) => r.id === open);
  const items = doc ? ((lang === 'th' && doc.items_th?.length ? doc.items_th : doc.items_en) || []) : [];
  const route = doc ? docRoute(doc.erp_style) : null;

  const tabs = [
    { key: 'about', label: 'เกี่ยวกับ' },
    { key: 'erp', label: 'การส่งต่อ ERP' },
    { key: 'types', label: 'ประเภทเอกสาร' },
  ];

  return (
    <section className="space-y-3 border-t p-3" style={{ borderColor: CANVAS.border }}>
      <h3 className="flex items-center gap-1.5 px-1 text-xs font-semibold tracking-wide" style={{ color: CANVAS.muted }}>
        <Icon name="file" className="h-3.5 w-3.5" />
        {t('การไหลของเอกสารหน้างาน (Document Control)')}
        <span style={{ color: CANVAS.faint }}>{rows.length}</span>
      </h3>

      <div className="flex flex-wrap gap-2">
        {rows.map((r) => {
          const d = deptOf(depts, r.dept);
          const rt = docRoute(r.erp_style);
          const on = open === r.id;
          return (
            <button key={r.id} onClick={() => select(r.id)} aria-pressed={on}
              className={`w-[176px] shrink-0 rounded-xl border-2 p-2.5 text-left transition ${
                on ? 'ring-2 ring-white/70' : 'hover:brightness-125'}`}
              style={{
                background: CANVAS.panel,
                color: CANVAS.text,
                borderStyle: 'dashed',
                borderColor: on ? '#ffffff' : `${d?.color || '#475569'}aa`,
                ...(d?.color ? { borderLeftColor: d.color, borderLeftStyle: 'solid', borderLeftWidth: 5 } : {}),
              }}>
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-200">
                  {r.code}
                </span>
                <span className="truncate text-[10px] font-medium uppercase tracking-wide" style={{ color: CANVAS.faint }}>
                  {t('เอกสารหน้างาน')}
                </span>
              </div>
              <div className="mt-1 whitespace-pre-line text-[13px] font-semibold leading-snug" style={{ color: CANVAS.text }}>
                {pick(lang, r.label_th, r.label_en)}
              </div>
              {pick(lang, r.sub_th, r.sub_en) && (
                <div className="mt-0.5 truncate text-[11px]" style={{ color: CANVAS.muted }}>{pick(lang, r.sub_th, r.sub_en)}</div>
              )}
              <span className="mt-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ backgroundColor: `${rt.color}26`, color: rt.color }}>
                {rt.arrow} {t(rt.label)}
              </span>
            </button>
          );
        })}
      </div>

      {doc && (
        <div className="space-y-3 rounded-xl border p-4" style={{ borderColor: CANVAS.border, background: CANVAS.panelSoft }}>
          <header className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold" style={{ color: CANVAS.muted }}>
                {t('เอกสาร')} {doc.code}
              </div>
              <h4 className="whitespace-pre-line text-base font-bold leading-snug" style={{ color: CANVAS.text }}>
                {pick(lang, doc.label_th, doc.label_en)}
              </h4>
              {pick(lang, doc.sub_th, doc.sub_en) && (
                <p className="text-sm" style={{ color: CANVAS.muted }}>{pick(lang, doc.sub_th, doc.sub_en)}</p>
              )}
            </div>
            <button onClick={() => setOpen(null)}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/20 px-2.5 py-1 text-sm font-medium text-slate-300 transition hover:border-white/60 hover:text-white">
              <Icon name="x" className="h-3.5 w-3.5" /> {t('ปิด')}
            </button>
          </header>

          <div className="flex flex-wrap gap-1.5 border-b border-white/15">
            {tabs.map((x) => (
              <button key={x.key} onClick={() => setPane(x.key)}
                className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium transition ${
                  pane === x.key ? 'border-sky-400 text-sky-300' : 'border-transparent text-slate-400 hover:text-slate-100'}`}>
                {t(x.label)}
              </button>
            ))}
          </div>

          {pane === 'about' && (
            <p className="whitespace-pre-line text-sm leading-relaxed" style={{ color: CANVAS.text }}>
              {pick(lang, doc.desc_th, doc.desc_en)}
            </p>
          )}

          {pane === 'erp' && (
            <div className="space-y-2">
              <div className="rounded-lg border px-3 py-2"
                style={{ borderColor: `${route.color}66`, backgroundColor: `${route.color}1f` }}>
                <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: route.color }}>
                  {route.arrow} {t(route.label)}
                </div>
                <div className="mt-0.5 text-sm font-semibold" style={{ color: CANVAS.text }}>
                  {pick(lang, doc.erp_label_th, doc.erp_label_en) || '—'}
                </div>
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed" style={{ color: CANVAS.text }}>
                {pick(lang, doc.desc_th, doc.desc_en)}
              </p>
            </div>
          )}

          {pane === 'types' && (
            <ol className="space-y-1.5 text-sm" style={{ color: CANVAS.text }}>
              {items.length === 0 && <li style={{ color: CANVAS.faint }}>—</li>}
              {items.map((it, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-emerald-500/25 text-[10px] font-bold text-emerald-200">{i + 1}</span>
                  <span className="leading-relaxed">{it}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
