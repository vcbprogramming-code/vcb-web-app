import { useId, useState } from 'react';
import { useT } from '../lib/i18n.jsx';

/**
 * Hand-drawn SVG charts for the E-Memo dashboard.
 *
 * No charting library on purpose: the app ships React and react-router and
 * nothing else, the bundle is already ~520 KB, and every chart here is a few
 * rectangles and one path. A library would cost more than it saves and would
 * fight the app's own styling.
 *
 * Palette rules these follow (validated with the dataviz colour checks):
 *  · one series → one hue, no legend; the title names it
 *  · ordered buckets → emphasis, not a rainbow: the bucket that matters is the
 *    accent, the rest recede
 *  · categorical (projects) → each project's own colour, and ALWAYS a text label,
 *    so colour is never the only cue (two projects share a colour in the client's
 *    own data, and several are close under colour blindness)
 *  · status → the reserved status colours, always beside a written label
 */

export const CHART = {
  accent: '#2563eb',
  accentDark: '#3b82f6',
  critical: '#be123c',
  criticalDark: '#f43f5e',
  muted: '#94a3b8',
  grid: '#e2e8f0',
};

/** Wraps a value in a tooltip that follows the pointer inside the chart card. */
function Tip({ tip }) {
  if (!tip) return null;
  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
      style={{ left: tip.x, top: tip.y - 8 }}
    >
      <div className="font-bold">{tip.value}</div>
      <div className="text-slate-300">{tip.label}</div>
    </div>
  );
}

/**
 * Volume over time. Single series → area + line in one hue, no legend.
 * A crosshair snaps to the nearest month so the reader aims at a month, never at
 * a 2px line.
 */
export function TrendChart({ data, onPick }) {
  const t = useT();
  const gid = useId().replace(/:/g, '');
  const [tip, setTip] = useState(null);
  const [hover, setHover] = useState(null);
  const W = 720; const H = 200; const P = { t: 12, r: 12, b: 26, l: 34 };
  const pts = data || [];
  if (pts.length < 2) return <div className="py-10 text-center text-sm text-slate-400">{t('ยังไม่มีข้อมูลพอจะแสดงแนวโน้ม')}</div>;

  const max = Math.max(1, ...pts.map((p) => p.count));
  const x = (i) => P.l + (i * (W - P.l - P.r)) / (pts.length - 1);
  const y = (v) => P.t + (1 - v / max) * (H - P.t - P.b);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.count)}`).join(' ');
  const area = `${line} L${x(pts.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const label = (m) => {
    const [yy, mm] = m.split('-');
    return `${['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][Number(mm) - 1]} ${String(Number(yy) + 543).slice(-2)}`;
  };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t('แนวโน้มจำนวนเอกสารรายเดือน')}>
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.accent} stopOpacity="0.22" />
            <stop offset="100%" stopColor={CHART.accent} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* recessive grid — 3 lines is enough to read a level against */}
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={P.l} x2={W - P.r} y1={y(max * f)} y2={y(max * f)} stroke={CHART.grid} strokeWidth="1" />
            <text x={P.l - 6} y={y(max * f) + 4} textAnchor="end" className="fill-slate-400" style={{ fontSize: 10 }}>
              {Math.round(max * f)}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#g${gid})`} />
        <path d={line} fill="none" stroke={CHART.accent} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke={CHART.accent} strokeWidth="1" strokeDasharray="3 3" />}
        {pts.map((p, i) => (
          <circle key={p.month} cx={x(i)} cy={y(p.count)} r={hover === i ? 5 : 3}
            fill="#fff" stroke={CHART.accent} strokeWidth="2" />
        ))}
        {/* month labels, thinned so they never collide */}
        {pts.map((p, i) => (
          (pts.length <= 8 || i % 2 === 0) && (
            <text key={`l${p.month}`} x={x(i)} y={H - 8} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10 }}>
              {label(p.month)}
            </text>
          )
        ))}
        {/* hit bands — the reader only has to be nearest, not dead-on */}
        {pts.map((p, i) => (
          <rect
            key={`h${p.month}`}
            x={x(i) - (W - P.l - P.r) / (pts.length - 1) / 2}
            y={P.t}
            width={(W - P.l - P.r) / (pts.length - 1)}
            height={H - P.t - P.b}
            fill="transparent"
            className={onPick ? 'cursor-pointer' : ''}
            onMouseEnter={(e) => {
              setHover(i);
              const r = e.currentTarget.ownerSVGElement.getBoundingClientRect();
              setTip({ x: (x(i) / W) * r.width, y: (y(p.count) / H) * r.height, value: `${p.count} ฉบับ`, label: `${label(p.month)} · อนุมัติแล้ว ${p.approved}` });
            }}
            onMouseLeave={() => { setHover(null); setTip(null); }}
            onClick={() => onPick?.(p.month)}
          />
        ))}
      </svg>
      <Tip tip={tip} />
    </div>
  );
}

/**
 * Horizontal bars. `emphasis` marks the row that matters (overdue, slowest);
 * everything else recedes so the eye lands on the point, not on a rainbow.
 */
export function BarList({ rows, onPick, unit = '', emphasisKey = null }) {
  const t = useT();
  const [tip, setTip] = useState(null);
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <div className="py-8 text-center text-sm text-slate-400">{t('ไม่มีข้อมูลในช่วงที่เลือก')}</div>;
  return (
    <div className="relative space-y-2.5">
      {rows.map((r) => {
        const hot = emphasisKey && r.key === emphasisKey && r.value > 0;
        const colour = r.color || (hot ? CHART.critical : CHART.accent);
        const pct = (r.value / max) * 100;
        return (
          <button
            key={r.key}
            type="button"
            disabled={!onPick || r.value === 0}
            onClick={() => onPick?.(r)}
            onMouseMove={(e) => setTip({ x: e.nativeEvent.offsetX + e.currentTarget.offsetLeft, y: e.currentTarget.offsetTop, value: `${r.value}${unit}`, label: r.label })}
            onMouseLeave={() => setTip(null)}
            className="group block w-full text-left disabled:cursor-default"
          >
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              {/* label always present — colour is never the only cue */}
              <span className="flex min-w-0 items-center gap-2">
                {r.chip && (
                  <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: r.color || CHART.muted }}>
                    {r.chip}
                  </span>
                )}
                <span className="truncate text-slate-600 group-enabled:group-hover:text-slate-900">{r.label}</span>
              </span>
              <span className={`shrink-0 tabular-nums font-semibold ${hot ? 'text-rose-700' : 'text-slate-700'}`}>
                {r.value}{unit}{r.hint ? <span className="ml-1 font-normal text-slate-400">{r.hint}</span> : null}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(pct, r.value ? 3 : 0)}%`, backgroundColor: colour }} />
            </div>
          </button>
        );
      })}
      <Tip tip={tip} />
    </div>
  );
}
