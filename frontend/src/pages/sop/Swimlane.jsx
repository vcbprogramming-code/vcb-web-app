import { useMemo, useState } from 'react';
import { toneOf } from '../../lib/sop.js';
import Icon from '../../components/Icon.jsx';

// ── geometry ────────────────────────────────────────────────────────────────
// Lanes are rows (one per department/module), `rank` is the column. The data
// has no two nodes sharing a lane+rank, so each lane row is exactly one node
// tall; edges are routed orthogonally on an SVG layer under the node divs.
const HEAD_W = 150;   // lane-title column
const COL_W = 214;    // one rank
const NODE_W = 172;
const NODE_H = 66;
const DEC_W = 196;    // decision diamonds need more width than they use
const DEC_H = 96;
const LANE_H = 124;
const PAD_TOP = 26;   // room above the first lane for the rank ruler

const EDGE_STYLE = {
  approve: { color: '#16a34a', label: 'อนุมัติ' },
  yes: { color: '#16a34a', label: null },
  reject: { color: '#e11d48', label: 'ไม่อนุมัติ' },
  default: { color: '#94a3b8', label: null },
};
const styleOf = (kind) => EDGE_STYLE[kind] || EDGE_STYLE.default;

/** Places every node, then resolves each edge into an orthogonal SVG path. */
function layout(flow) {
  const lanes = flow.lanes || [];
  const nodes = flow.nodes || [];
  const laneIdx = new Map(lanes.map((l, i) => [l.key, i]));
  const ranks = [...new Set(nodes.map((n) => n.rank ?? 0))].sort((a, b) => a - b);
  const colIdx = new Map(ranks.map((r, i) => [r, i]));

  const placed = new Map();
  for (const n of nodes) {
    const li = laneIdx.get(n.lane) ?? 0;
    const ci = colIdx.get(n.rank ?? 0) ?? 0;
    const dec = n.type === 'decision';
    const w = dec ? DEC_W : NODE_W;
    const h = dec ? DEC_H : NODE_H;
    const x = HEAD_W + ci * COL_W + (COL_W - w) / 2;
    const y = PAD_TOP + li * LANE_H + (LANE_H - h) / 2;
    placed.set(n.id, {
      ...n, li, ci, x, y, w, h,
      l: x, r: x + w, t: y, b: y + h, cx: x + w / 2, cy: y + h / 2,
      laneBottom: PAD_TOP + li * LANE_H + LANE_H,
      laneTop: PAD_TOP + li * LANE_H,
    });
  }

  const ABOVE = 'translate(-50%,-100%)'; // label sits on top of the connector
  const edges = (flow.edges || []).map((e, i) => {
    const s = placed.get(e.from);
    const t = placed.get(e.to);
    if (!s || !t) return null; // tolerate a dangling reference rather than crash
    const forward = t.cx > s.cx;
    const down = t.li > s.li;
    let d;
    let lx;
    let ly;
    let tf = ABOVE;
    if (s.li === t.li) {
      if (forward) { d = `M${s.r},${s.cy} L${t.l},${t.cy}`; lx = (s.r + t.l) / 2; ly = s.t - 4; }
      else {
        const y = s.laneBottom - 10;
        d = `M${s.cx},${s.b} V${y} H${t.cx} V${t.b}`; lx = (s.cx + t.cx) / 2; ly = y - 3;
      }
    } else if (Math.abs(t.cx - s.cx) < 2) {
      // A pair of nodes often has both a down and an up connector (submit /
      // reject). Offset each by direction so the two lines — and their labels —
      // don't land on top of each other.
      const off = down ? 9 : -9;
      d = down ? `M${s.cx + off},${s.b} L${t.cx + off},${t.t}` : `M${s.cx + off},${s.t} L${t.cx + off},${t.b}`;
      lx = s.cx + off + (down ? 7 : -7);
      ly = (down ? s.b + t.t : t.b + s.t) / 2;
      tf = down ? 'translate(0,-50%)' : 'translate(-100%,-50%)';
    } else if (forward) {
      d = `M${s.r},${s.cy} H${t.cx} V${down ? t.t : t.b}`;
      // label the vertical drop, not the horizontal run: a decision that fans
      // out to two lanes at the same rank shares the run but not the drop.
      lx = t.cx + 7; ly = (s.cy + (down ? t.t : t.b)) / 2; tf = 'translate(0,-50%)';
    } else {
      d = `M${s.cx},${down ? s.b : s.t} V${t.cy} H${t.r}`;
      lx = (s.cx + t.r) / 2; ly = t.t - 4;
    }
    const st = styleOf(e.kind);
    return { key: `${e.from}->${e.to}-${i}`, d, lx, ly, tf, color: st.color, label: e.label || st.label };
  }).filter(Boolean);

  // last resort: two labels that still land on the same spot get stacked
  const taken = new Set();
  for (const e of edges) {
    if (!e.label) continue;
    let slot = `${Math.round(e.lx / 12)}:${Math.round(e.ly / 12)}`;
    while (taken.has(slot)) { e.ly -= 14; slot = `${Math.round(e.lx / 12)}:${Math.round(e.ly / 12)}`; }
    taken.add(slot);
  }

  return {
    lanes, ranks, nodes: [...placed.values()], edges,
    width: HEAD_W + Math.max(ranks.length, 1) * COL_W + 20,
    height: PAD_TOP + Math.max(lanes.length, 1) * LANE_H + 12,
  };
}

const SHAPE = {
  start: 'rounded-full border-slate-300 bg-slate-50 font-semibold',
  end: 'rounded-full border-slate-300 bg-slate-50 font-semibold',
  process: 'rounded-xl border-slate-300 bg-white',
  decision: 'border-amber-300 bg-amber-50 text-amber-900',
};

/** Renders one flow document as a real swimlane chart. */
export default function Swimlane({ flow }) {
  const [zoom, setZoom] = useState(1);
  const g = useMemo(() => layout(flow), [flow]);
  const markers = [...new Set(g.edges.map((e) => e.color))];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-1 text-slate-500">
        <span className="mr-auto text-xs">เลื่อนดูแนวนอนได้ · ย่อ/ขยายได้</span>
        <button onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} title="ย่อ"
          className="rounded-lg border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50">−</button>
        <button onClick={() => setZoom(1)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50">
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))} title="ขยาย"
          className="rounded-lg border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50">+</button>
      </div>

      <div className="flow-canvas overflow-auto rounded-2xl border border-slate-200 bg-white p-3">
        <div style={{ width: g.width * zoom, height: g.height * zoom }}>
          <div className="relative" style={{ width: g.width, height: g.height, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            {/* lane bands + titles */}
            {g.lanes.map((lane, i) => (
              <div key={lane.key} className="absolute left-0 flex"
                style={{ top: PAD_TOP + i * LANE_H, width: g.width, height: LANE_H }}>
                <div className={`flex w-[150px] shrink-0 flex-col justify-center rounded-l-xl border border-slate-200 px-3 ${toneOf(lane.module)}`}>
                  <div className="text-xs font-bold leading-tight">{lane.name}</div>
                  {lane.sub && <div className="mt-0.5 text-[10px] opacity-75">{lane.sub}</div>}
                </div>
                {/* the odd-row tint is an opacity variant, which the global dark
                    remaps can't rewrite — so it carries its own dark value */}
                <div className={`flex-1 border-y border-r border-slate-200 ${i % 2 ? 'bg-slate-50/60 dark:bg-slate-800/40' : 'bg-white'}`} />
              </div>
            ))}

            {/* rank ruler */}
            {g.ranks.map((r, i) => (
              <div key={r} className="absolute text-center text-[10px] font-medium text-slate-400"
                style={{ left: HEAD_W + i * COL_W, top: 6, width: COL_W }}>
                ขั้นที่ {i + 1}
              </div>
            ))}

            {/* edges under the nodes */}
            <svg className="pointer-events-none absolute inset-0" width={g.width} height={g.height} aria-hidden="true">
              <defs>
                {markers.map((c) => (
                  <marker key={c} id={`ar-${c.replace('#', '')}`} viewBox="0 0 10 10" refX="9" refY="5"
                    markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" fill={c} />
                  </marker>
                ))}
              </defs>
              {g.edges.map((e) => (
                <path key={e.key} d={e.d} fill="none" stroke={e.color} strokeWidth="1.6"
                  markerEnd={`url(#ar-${e.color.replace('#', '')})`} />
              ))}
            </svg>

            {/* nodes */}
            {g.nodes.map((n) => {
              const dec = n.type === 'decision';
              return (
                <div key={n.id} title={n.label}
                  className={`absolute flex items-center justify-center border px-2 text-center text-[11px] leading-tight text-slate-700 shadow-sm ${SHAPE[n.type] || SHAPE.process}`}
                  style={{
                    left: n.x, top: n.y, width: n.w, height: n.h,
                    ...(dec ? { clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', paddingLeft: 34, paddingRight: 34 } : null),
                  }}>
                  <span className="line-clamp-4">{n.label}</span>
                </div>
              );
            })}

            {/* edge labels last so a node box can never clip them */}
            {g.edges.filter((e) => e.label).map((e) => (
              <span key={`${e.key}-l`} title={e.label}
                className="pointer-events-none absolute max-w-[150px] whitespace-nowrap overflow-hidden text-ellipsis rounded bg-white px-1 text-[10px] font-semibold"
                style={{ left: e.lx, top: e.ly, transform: e.tf, color: e.color }}>
                {e.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-3 w-5 rounded-full border border-slate-300 bg-slate-50" /> เริ่ม / จบ</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-3 w-5 rounded border border-slate-300 bg-white" /> ขั้นตอน</span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-3.5 w-3.5 border border-amber-300 bg-amber-50" style={{ clipPath: 'polygon(50% 0%,100% 50%,50% 100%,0% 50%)' }} /> จุดตัดสินใจ
        </span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-0.5 w-5" style={{ background: '#16a34a' }} /> อนุมัติ / ใช่</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-0.5 w-5" style={{ background: '#e11d48' }} /> ไม่อนุมัติ</span>
      </div>

      {Array.isArray(flow.narrative) && flow.narrative.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Icon name="document" className="h-4 w-4" /> คำอธิบายขั้นตอน
          </h4>
          <ul className="space-y-1.5">
            {flow.narrative.map((line, i) => {
              const sub = line.trim().startsWith('»');
              const warn = line.trim().startsWith('!');
              return (
                <li key={i} className={`text-sm leading-relaxed ${sub ? 'ml-6 text-slate-600' : warn ? 'rounded-lg bg-amber-50 px-3 py-2 text-amber-800' : 'text-slate-700'}`}>
                  {line}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
