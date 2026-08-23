import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { pick, connMeta } from '../../lib/sysmap.js';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * The process map: one row per lane, boxes left to right in sequence.
 *
 * All 129 connections drawn at once is a hairball nobody can read — which is why
 * the source app hides them behind a "click a box to trace it" mode too. So the
 * lines appear for the SELECTED box only: what feeds it, and what it feeds. That
 * is the question people actually bring to this diagram.
 */
export default function LaneMap({ lanes, nodes, conns, depts, lang, selected, onSelect, filterDept, layer }) {
  const t = useT();
  const wrapRef = useRef(null);
  const boxRefs = useRef(new Map());
  const [edges, setEdges] = useState([]);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const deptOf = useMemo(() => new Map(depts.map((d) => [d.key, d])), [depts]);
  const byLane = useMemo(() => {
    const m = new Map(lanes.map((l) => [l.id, []]));
    for (const n of nodes) if (m.has(n.lane_id)) m.get(n.lane_id).push(n);
    for (const arr of m.values()) arr.sort((a, b) => a.sort_order - b.sort_order);
    return m;
  }, [lanes, nodes]);

  const dimmed = (n) => (filterDept && n.dept !== filterDept && n.dept2 !== filterDept)
    || (layer !== 'all' && n.node_type !== layer);

  // which boxes are on the selected box's path — used to keep them lit while
  // everything else fades back
  const related = useMemo(() => {
    if (!selected) return null;
    const inn = conns.filter((c) => c.to_node === selected);
    const out = conns.filter((c) => c.from_node === selected);
    return {
      inn, out,
      ids: new Set([selected, ...inn.map((c) => c.from_node), ...out.map((c) => c.to_node)]),
    };
  }, [selected, conns]);

  // Measure after paint: the boxes are laid out by flexbox, so their positions
  // are only known once the browser has done it.
  useLayoutEffect(() => {
    if (!selected || !related) { setEdges([]); return undefined; }
    const draw = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const w = wrap.getBoundingClientRect();
      setBox({ w: wrap.scrollWidth, h: wrap.scrollHeight });
      const at = (id) => {
        const el = boxRefs.current.get(id);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          left: r.left - w.left + wrap.scrollLeft,
          right: r.right - w.left + wrap.scrollLeft,
          mid: r.top - w.top + wrap.scrollTop + r.height / 2,
        };
      };
      const me = at(selected);
      if (!me) return;
      const made = [];
      for (const c of [...related.inn, ...related.out]) {
        const incoming = c.to_node === selected;
        const other = at(incoming ? c.from_node : c.to_node);
        if (!other) continue;
        const from = incoming ? other : me;
        const to = incoming ? me : other;
        // leave from whichever side faces the target so lines don't cross the box
        const x1 = from.right <= to.left ? from.right : from.left;
        const x2 = from.right <= to.left ? to.left : to.right;
        const midX = (x1 + x2) / 2;
        made.push({
          id: c.id,
          d: `M ${x1} ${from.mid} C ${midX} ${from.mid}, ${midX} ${to.mid}, ${x2} ${to.mid}`,
          ...connMeta(c.conn_type),
          label: c.label,
        });
      }
      setEdges(made);
    };
    draw();
    const ro = new ResizeObserver(draw);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener('resize', draw);
    return () => { ro.disconnect(); window.removeEventListener('resize', draw); };
  }, [selected, related, lanes, nodes, filterDept, layer, lang]);

  return (
    <div ref={wrapRef} className="relative overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3">
      {edges.length > 0 && (
        <svg className="pointer-events-none absolute left-0 top-0" width={box.w} height={box.h} aria-hidden="true">
          {edges.map((e) => (
            <path key={e.id} d={e.d} fill="none" stroke={e.color} strokeWidth="2"
              strokeDasharray={e.label === 'ทำภายหลัง' ? '5 4' : undefined} opacity="0.85" />
          ))}
        </svg>
      )}

      <div className="relative flex min-w-max flex-col gap-2">
        {lanes.map((lane) => {
          const list = byLane.get(lane.id) || [];
          return (
            <div key={lane.id} className="flex items-stretch gap-3">
              <div className="sticky left-0 z-10 flex w-[132px] shrink-0 items-center rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                <span className="whitespace-pre-line leading-tight">{pick(lang, lane.label_th, lane.label_en)}</span>
              </div>
              <div className="flex gap-3">
                {list.length === 0 && (
                  <span className="self-center text-xs text-slate-400">{t('ยังไม่มีกล่องงานในเลนนี้')}</span>
                )}
                {list.map((n) => {
                  const d = deptOf.get(n.dept);
                  const off = dimmed(n) || (related && !related.ids.has(n.id));
                  const isSel = selected === n.id;
                  return (
                    <button
                      key={n.id}
                      ref={(el) => { if (el) boxRefs.current.set(n.id, el); else boxRefs.current.delete(n.id); }}
                      onClick={() => onSelect(isSel ? null : n.id)}
                      aria-pressed={isSel}
                      className={`relative w-[176px] shrink-0 rounded-xl border-2 p-2.5 text-left transition ${
                        isSel ? 'border-brand bg-brand-tint shadow-md'
                          : 'border-slate-200 bg-white hover:border-slate-400'
                      } ${off ? 'opacity-25' : ''}`}
                      style={!isSel && d?.color ? { borderLeftColor: d.color, borderLeftWidth: 5 } : undefined}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${n.node_type === 'erp' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          {n.node_type === 'erp' ? (n.module || 'ERP') : 'ทำมือ'}
                        </span>
                        {n.at_site && <Icon name="building" className="ml-auto h-3 w-3 text-slate-400" title={t('ทำที่หน้างาน')} />}
                      </div>
                      <div className="mt-1 whitespace-pre-line text-[13px] font-semibold leading-snug text-slate-800">
                        {pick(lang, n.label_th, n.label_en)}
                      </div>
                      {pick(lang, n.sub_th, n.sub_en) && (
                        <div className="mt-0.5 truncate text-[11px] text-slate-500">{pick(lang, n.sub_th, n.sub_en)}</div>
                      )}
                      {n.unverified && (
                        <span className="mt-1 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          {t('ยังไม่ยืนยัน')}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
