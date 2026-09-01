/**
 * Swimlane diagram: a CSS grid of boxes with hand-drawn SVG arrows between
 * them. No chart library, per TECH_STACK.md.
 *
 * Why the arrows are measured rather than computed: the boxes are laid out by
 * the grid, and their heights depend on how the Thai labels wrap, which depends
 * on the font and the viewport. So the only way to know where a box actually IS
 * is to ask the DOM after layout. That is what the old layoutFlowEdges() did by
 * writing innerHTML into an <svg>; here the same geometry is computed into
 * React state and rendered as ordinary JSX, so React owns the DOM throughout.
 *
 * Re-measured on resize, on font load (Sarabun arriving changes every box
 * height), and whenever the flow or the theme changes.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useI18n, useTheme } from '@vcb/shared';

const EDGE_COLORS = {
  light: { normal: '#8693a3', approve: '#2E75B6', yes: '#2e9e5b', reject: '#d9822b' },
  dark: { normal: '#62707f', approve: '#2E75B6', yes: '#2e9e5b', reject: '#d9822b' },
};

const NODE_STYLES = {
  start: 'rounded-pill bg-brand-700 text-white border-brand-700',
  end: 'rounded-pill bg-ink-subtle text-white border-ink-subtle',
  decision:
    'rounded-card bg-warn-bg text-warn-fg border-warn dark:bg-warn/15 dark:text-warn-dark dark:border-warn-dark/50',
  process:
    'rounded-control bg-surface-card text-ink border-line dark:bg-surface-dark-card dark:text-ink-dark dark:border-line-dark',
};

/**
 * Route one edge between two measured rectangles.
 *
 * Ported from layoutFlowEdges(): straight down when the boxes share a column,
 * straight across when they share a row, an S-bend otherwise, and a loop under
 * both boxes for a `reject` edge so a rejection is visibly a step backwards.
 */
function routeEdge(a, b, kind) {
  const sameCol = Math.abs(a.cx - b.cx) < 6;
  const sameRow = Math.abs(a.cy - b.cy) < 6;

  if (kind === 'reject') {
    const y = Math.max(a.bottom, b.bottom) + 17;
    return {
      d: `M ${a.cx} ${a.bottom} L ${a.cx} ${y} L ${b.cx} ${y} L ${b.cx} ${b.bottom}`,
      lx: (a.cx + b.cx) / 2,
      ly: y + 9,
    };
  }
  if (sameCol && b.top >= a.bottom) {
    return {
      d: `M ${a.cx} ${a.bottom} L ${b.cx} ${b.top}`,
      lx: a.cx,
      ly: (a.bottom + b.top) / 2,
    };
  }
  if (sameRow) {
    const forward = b.left >= a.right;
    return {
      d: forward
        ? `M ${a.right} ${a.cy} L ${b.left} ${b.cy}`
        : `M ${a.left} ${a.cy} L ${b.right} ${b.cy}`,
      lx: forward ? (a.right + b.left) / 2 : (a.left + b.right) / 2,
      ly: a.cy - 9,
    };
  }
  if (b.top >= a.bottom) {
    const midY = (a.bottom + b.top) / 2;
    return {
      d: `M ${a.cx} ${a.bottom} L ${a.cx} ${midY} L ${b.cx} ${midY} L ${b.cx} ${b.top}`,
      lx: (a.cx + b.cx) / 2,
      ly: midY - 9,
    };
  }
  // b sits ABOVE a — a loop back up, routed over the top of the target.
  const y = b.top - 17;
  return {
    d: `M ${a.cx} ${a.top} L ${a.cx} ${y} L ${b.cx} ${y} L ${b.cx} ${b.top}`,
    lx: (a.cx + b.cx) / 2,
    ly: y - 9,
  };
}

export default function FlowDiagram({ flow }) {
  const { t } = useI18n();
  const { isDark } = useTheme();

  const bodyRef = useRef(null);
  const nodeRefs = useRef({});
  const [geom, setGeom] = useState({ w: 0, h: 0, edges: [] });

  const laneIndex = {};
  flow.lanes.forEach((l, i) => (laneIndex[l.key] = i));
  const maxRank = flow.nodes.reduce((m, n) => Math.max(m, n.rank), 0);

  const measure = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    const br = body.getBoundingClientRect();
    const w = body.scrollWidth || body.clientWidth;
    const h = body.scrollHeight || body.clientHeight;

    const rect = (id) => {
      const el = nodeRefs.current[id];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const x = r.left - br.left;
      const y = r.top - br.top;
      return {
        cx: x + r.width / 2,
        cy: y + r.height / 2,
        top: y,
        bottom: y + r.height,
        left: x,
        right: x + r.width,
      };
    };

    const edges = [];
    for (const e of flow.edges) {
      const a = rect(e.from);
      const b = rect(e.to);
      // A node id that does not exist is a data error in flows.js, not a crash:
      // draw the rest of the diagram and skip this arrow.
      if (!a || !b) continue;
      const kind = e.kind || 'normal';
      edges.push({ ...routeEdge(a, b, kind), kind, label: e.label, key: `${e.from}->${e.to}` });
    }
    setGeom({ w, h, edges });
  }, [flow]);

  // Layout effect so the first paint that shows boxes also shows arrows,
  // instead of flashing a diagram with nothing connecting it.
  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });

    // Sarabun landing after first paint changes every box height.
    if (document.fonts?.ready) document.fonts.ready.then(measure).catch(() => {});

    // The pane itself can resize without the window doing so (the list pane
    // appearing at the lg breakpoint), which a window resize listener misses.
    let ro;
    if (typeof ResizeObserver !== 'undefined' && bodyRef.current) {
      ro = new ResizeObserver(() => measure());
      ro.observe(bodyRef.current);
    }
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      ro?.disconnect();
    };
  }, [measure]);

  const colors = EDGE_COLORS[isDark ? 'dark' : 'light'];
  const chip = isDark
    ? { fill: '#161b22', stroke: '#283039', text: '#9ba6b2' }
    : { fill: '#ffffff', stroke: '#e7ecf1', text: '#5b6672' };

  const tracks = { '--flow-lanes': flow.lanes.length };

  return (
    <>
      <div className="overflow-x-auto rounded-card border border-line bg-surface-alt p-3 dark:border-line-dark dark:bg-surface-dark-alt">
        <div className="flow-canvas inline-block min-w-full">
          {/* lane headers — same tracks as the node grid below */}
          <div className="flow-tracks grid gap-3" style={tracks}>
            {flow.lanes.map((l, i) => (
              <div
                key={i}
                className="rounded-control border border-line bg-surface-card px-2 py-1.5 text-center dark:border-line-dark dark:bg-surface-dark-card"
              >
                <b className="block text-[12px] font-bold break-thai">{l.name}</b>
                {l.sub && (
                  <small className="block text-[10px] text-ink-muted dark:text-ink-dark-muted">
                    {l.sub}
                  </small>
                )}
              </div>
            ))}
          </div>

          <div ref={bodyRef} className="relative mt-3">
            <svg
              className="pointer-events-none absolute inset-0"
              width={geom.w}
              height={geom.h}
              viewBox={`0 0 ${geom.w} ${geom.h}`}
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <defs>
                {Object.keys(colors).map((k) => (
                  <marker
                    key={k}
                    id={`ar-${flow.id}-${k}`}
                    markerWidth="9"
                    markerHeight="9"
                    refX="7.5"
                    refY="4"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <path d="M0,0 L8,4 L0,8 Z" fill={colors[k]} />
                  </marker>
                ))}
              </defs>

              {geom.edges.map((e) => (
                <path
                  key={e.key}
                  d={e.d}
                  fill="none"
                  stroke={colors[e.kind] || colors.normal}
                  strokeWidth="1.7"
                  strokeDasharray={e.kind === 'reject' ? '5 4' : undefined}
                  markerEnd={`url(#ar-${flow.id}-${e.kind})`}
                />
              ))}

              {geom.edges
                .filter((e) => e.label)
                .map((e) => {
                  // Width from the character count: measuring text properly
                  // needs a canvas, and the chip only has to not clip.
                  const w = e.label.length * 6.4 + 12;
                  return (
                    <g key={`${e.key}-label`}>
                      <rect
                        x={e.lx - w / 2}
                        y={e.ly - 8}
                        width={w}
                        height="16"
                        rx="5"
                        fill={chip.fill}
                        stroke={chip.stroke}
                      />
                      <text
                        x={e.lx}
                        y={e.ly + 3.6}
                        textAnchor="middle"
                        fontSize="10.5"
                        fontFamily="Sarabun, sans-serif"
                        fill={chip.text}
                      >
                        {e.label}
                      </text>
                    </g>
                  );
                })}
            </svg>

            <div
              className="flow-tracks relative grid gap-x-3 gap-y-8"
              style={{ ...tracks, gridTemplateRows: `repeat(${maxRank + 1}, auto)` }}
            >
              {flow.nodes.map((n) => (
                <div
                  key={n.id}
                  ref={(el) => {
                    nodeRefs.current[n.id] = el;
                  }}
                  style={{ gridColumn: (laneIndex[n.lane] || 0) + 1, gridRow: n.rank + 1 }}
                  className={`self-center border px-2.5 py-2 text-center text-[12px] font-medium leading-snug break-thai shadow-card ${
                    NODE_STYLES[n.type || 'process']
                  }`}
                >
                  {n.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-ink-muted dark:text-ink-dark-muted">
        {[
          ['normal', 'flows.legNormal', false],
          ['approve', 'flows.legApprove', false],
          ['yes', 'flows.legYes', false],
          ['reject', 'flows.legReject', true],
        ].map(([kind, key, dashed]) => (
          <span key={kind} className="inline-flex items-center gap-1.5">
            <svg width="22" height="6" aria-hidden="true">
              <line
                x1="0"
                y1="3"
                x2="22"
                y2="3"
                stroke={colors[kind]}
                strokeWidth="2"
                strokeDasharray={dashed ? '4 3' : undefined}
              />
            </svg>
            {t(key)}
          </span>
        ))}
      </div>

      {/* narrative — '» ' is a sub-step, '! ' a caveat */}
      {flow.narrative?.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">
            {t('flows.stepsLbl')}
          </h2>
          <ul className="flex flex-col gap-1.5">
            {flow.narrative.map((line, i) => {
              if (line.startsWith('» ')) {
                return (
                  <li
                    key={i}
                    className="ml-5 text-[13px] leading-relaxed text-ink-muted break-thai dark:text-ink-dark-muted"
                  >
                    {line.slice(2)}
                  </li>
                );
              }
              if (line.startsWith('! ')) {
                return (
                  <li
                    key={i}
                    className="rounded-card border-l-4 border-danger bg-danger-bg px-3 py-2 text-[13px] text-danger-fg break-thai dark:border-danger-dark dark:bg-danger/15 dark:text-danger-dark"
                  >
                    {line.slice(2)}
                  </li>
                );
              }
              return (
                <li key={i} className="text-[13px] leading-relaxed break-thai">
                  {line}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
