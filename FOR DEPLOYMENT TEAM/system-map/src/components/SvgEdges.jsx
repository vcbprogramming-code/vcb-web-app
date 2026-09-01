/** Cross-lane connection arrows — hand-written SVG, no chart library
 *  (TECH_STACK.md rules those out; nothing here ever used one).
 *
 *  Measures the already-rendered DOM node rects and draws SVG <path> elements
 *  into the absolutely-positioned overlay. React supplies the trigger (a layout
 *  effect after each relevant state change); the routing math — corridor routing
 *  for direct flows, top/bottom orthogonal routing with fan-out for indirect
 *  flows, filter awareness, highlight-on-select — is unchanged.
 *
 *  It stays imperative because it is a measure-then-paint pass: the geometry is
 *  only knowable after the nodes have laid out, so it cannot be expressed as
 *  JSX rendered in the same commit.
 */
import { useLayoutEffect } from 'react';
import { useI18n } from '@vcb/shared';
import { useStore } from '../store.jsx';
import { CROSS_CONNS } from '../data/index.js';
import { connectedSet } from './Lanes.jsx';

const SVG_NS = 'http://www.w3.org/2000/svg';

const typeColor = {
  trigger: '#38bdf8',
  feeds: '#38bdf8',
  deferred: '#ffc233',
  conditional: '#ffc233',
};
const typeDash = { trigger: 'none', feeds: 'none', deferred: '8 5', conditional: '8 5' };

/** Anchor point on one edge of an element, in wrapper-local coordinates. */
function pt(el, edge, wrapRect) {
  const r = el.getBoundingClientRect();
  const ox = r.left - wrapRect.left;
  const oy = r.top - wrapRect.top;
  if (edge === 'bottom') return [ox + r.width / 2, oy + r.height];
  if (edge === 'top') return [ox + r.width / 2, oy];
  if (edge === 'right') return [ox + r.width, oy + r.height / 2];
  return [ox, oy + r.height / 2];
}

export function drawArrows(selectedNodeId) {
  const svg = document.getElementById('svgOverlay');
  const wrap = document.getElementById('lanesWrap');
  if (!svg || !wrap) return;

  svg.innerHTML = '';
  svg.style.width = '0';
  svg.style.height = '0';
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  const W = wrap.scrollWidth;
  const H = wrap.scrollHeight;
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.style.width = W + 'px';
  svg.style.height = H + 'px';
  const wrapRect = wrap.getBoundingClientRect();

  // One arrowhead marker per connection type.
  const defs = document.createElementNS(SVG_NS, 'defs');
  Object.entries(typeColor).forEach(([type, col]) => {
    const m = document.createElementNS(SVG_NS, 'marker');
    m.setAttribute('id', `arr-${type}`);
    m.setAttribute('markerWidth', '10');
    m.setAttribute('markerHeight', '10');
    m.setAttribute('refX', '7');
    m.setAttribute('refY', '3.5');
    m.setAttribute('orient', 'auto');
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', 'M0,0 L0,7 L7,3.5 z');
    p.setAttribute('fill', col);
    m.appendChild(p);
    defs.appendChild(m);
  });
  svg.appendChild(defs);

  const connected = connectedSet(selectedNodeId);

  const solid = [];
  const dashed = [];

  // Multiple indirect arrows landing on one target fan out across its top edge.
  const inCntByTarget = {};
  const inSeenTgt = {};
  CROSS_CONNS.forEach((c) => {
    if (c.type === 'conditional' || c.type === 'deferred') {
      inCntByTarget[c.to] = (inCntByTarget[c.to] || 0) + 1;
    }
  });

  /** A node hidden by the layer or department filter. Read off the DOM because
   *  those filters are body/wrapper classes (see index.css). */
  function isNodeFiltered(el) {
    if (document.body.classList.contains('layer-erp') && el.classList.contains('node-manual')) {
      return true;
    }
    if (document.body.classList.contains('layer-manual') && el.classList.contains('node-erp')) {
      return true;
    }
    if (wrap.classList.contains('dept-active') && !el.classList.contains('dept-show')) {
      return true;
    }
    return false;
  }

  CROSS_CONNS.forEach((conn, idx) => {
    const fromEl = document.getElementById(conn.from);
    const toEl = document.getElementById(conn.to);
    if (!fromEl || !toEl) return;

    const col = typeColor[conn.type] || '#64748b';
    const dash = typeDash[conn.type] || 'none';

    const fromFiltered = isNodeFiltered(fromEl);
    const toFiltered = isNodeFiltered(toEl);
    if (fromFiltered && toFiltered) return;

    const fr = fromEl.getBoundingClientRect();
    const tr = toEl.getBoundingClientRect();
    const isIndirect = conn.type === 'conditional' || conn.type === 'deferred';

    let d;
    if (isIndirect) {
      // Orthogonal top/bottom route with a rounded mid-rail.
      const above = tr.top < fr.top;
      const [x1, y1] = pt(fromEl, above ? 'top' : 'bottom', wrapRect);
      let [x2, y2] = pt(toEl, above ? 'bottom' : 'top', wrapRect);
      const cnt = inCntByTarget[conn.to] || 1;
      if (cnt > 1) {
        const oi = (inSeenTgt[conn.to] = inSeenTgt[conn.to] || 0);
        inSeenTgt[conn.to]++;
        const half = tr.width / 2 - 14;
        let off = (oi - (cnt - 1) / 2) * 14;
        off = Math.max(-half, Math.min(half, off));
        x2 += off;
      }
      const midY = (y1 + y2) / 2;
      const sx = x2 >= x1 ? 1 : -1;
      const v1 = midY >= y1 ? 1 : -1;
      const v2 = y2 >= midY ? 1 : -1;
      const cr = Math.max(
        0,
        Math.min(9, Math.abs(x2 - x1) / 2, Math.abs(midY - y1), Math.abs(y2 - midY)),
      );
      d =
        `M${x1},${y1} L${x1},${midY - v1 * cr} Q${x1},${midY} ${x1 + sx * cr},${midY} ` +
        `L${x2 - sx * cr},${midY} Q${x2},${midY} ${x2},${midY + v2 * cr} L${x2},${y2}`;
    } else {
      const CORRIDOR = 50;
      const cr = 9;
      const sameRow = Math.abs(tr.top - fr.bottom) < 40;
      if (sameRow) {
        // Neighbours on the same row: arch over the top.
        const [x1, y1] = pt(fromEl, 'top', wrapRect);
        const [x2, y2] = pt(toEl, 'top', wrapRect);
        const arch = Math.min(y1, y2) - 28;
        d = `M${x1},${y1} L${x1},${arch} L${x2},${arch} L${x2},${y2}`;
      } else {
        // Otherwise run down the left-hand corridor.
        const [x1, y1] = pt(fromEl, 'left', wrapRect);
        const [x2, y2] = pt(toEl, 'left', wrapRect);
        const vd = y2 > y1 ? 1 : -1;
        d =
          `M${x1},${y1} L${CORRIDOR + cr},${y1} Q${CORRIDOR},${y1} ${CORRIDOR},${y1 + vd * cr} ` +
          `L${CORRIDOR},${y2 - vd * cr} Q${CORRIDOR},${y2} ${CORRIDOR + cr},${y2} L${x2},${y2}`;
      }
    }

    const baseOpacity = fromFiltered || toFiltered ? 0.1 : 0.5;

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', col);
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('stroke-dasharray', dash);
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('d', d);
    path.setAttribute('marker-end', `url(#arr-${conn.type})`);

    // With a node selected, only its own edges stay visible.
    let opacity = baseOpacity;
    let strokeWidth = '2.5';
    if (connected) {
      if (conn.from === selectedNodeId || conn.to === selectedNodeId) {
        opacity = 1;
        strokeWidth = '3';
      } else {
        opacity = 0;
      }
    }
    path.style.opacity = String(opacity);
    path.style.strokeWidth = strokeWidth;
    path.dataset.connIdx = String(idx);
    path.classList.add('cross-arrow', 'ca-' + conn.type);

    (dash === 'none' ? solid : dashed).push(path);
  });

  // Dashed on top of solid, so indirect routes read over direct ones.
  solid.forEach((p) => svg.appendChild(p));
  dashed.forEach((p) => svg.appendChild(p));
}

export default function SvgEdges() {
  const s = useStore();
  const { lang } = useI18n();

  // Redraw on every render-affecting change. The delayed second pass catches
  // late reflow (web fonts, wrapped labels) that shifts the measured rects.
  useLayoutEffect(() => {
    const raf = requestAnimationFrame(() => drawArrows(s.selectedNodeId));
    const t = setTimeout(() => drawArrows(s.selectedNodeId), 250);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [
    s.selectedNodeId,
    s.activeDept,
    s.activeLayer,
    lang,
    s.hideDirect,
    s.hideIndirect,
    s.overviewOpen,
    s.focusShow,
  ]);

  useLayoutEffect(() => {
    const onResize = () => requestAnimationFrame(() => drawArrows(s.selectedNodeId));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [s.selectedNodeId]);

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-[1] block overflow-visible"
      id="svgOverlay"
    />
  );
}
