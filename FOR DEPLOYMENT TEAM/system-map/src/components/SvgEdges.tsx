/** Cross-lane connection arrows. Verbatim-logic port of drawArrows() in Index.html:
 *  measures the already-rendered DOM node rects and draws SVG <path> elements into
 *  the absolutely-positioned #svgOverlay, exactly like the original. React only
 *  supplies the trigger (useLayoutEffect after each relevant state change) — the
 *  actual routing math (corridor routing for direct flows, top/bottom orthogonal
 *  routing for indirect flows, filter-awareness, highlight-on-select) is untouched.
 */
import { useLayoutEffect } from 'react';
import type { Store } from '../store';
import { CROSS_CONNS } from '../data';
import { connectedSet } from './Lanes';

const typeColor: Record<string, string> = { trigger: '#38bdf8', feeds: '#38bdf8', deferred: '#ffc233', conditional: '#ffc233' };
const typeDash: Record<string, string> = { trigger: 'none', feeds: 'none', deferred: '8 5', conditional: '8 5' };

function pt(el: Element, edge: 'top' | 'bottom' | 'left' | 'right', wrapRect: DOMRect): [number, number] {
  const r = el.getBoundingClientRect();
  const ox = r.left - wrapRect.left;
  const oy = r.top - wrapRect.top;
  if (edge === 'bottom') return [ox + r.width / 2, oy + r.height];
  if (edge === 'top') return [ox + r.width / 2, oy];
  if (edge === 'right') return [ox + r.width, oy + r.height / 2];
  return [ox, oy + r.height / 2];
}

export function drawArrows(selectedNodeId: string | null) {
  const svg = document.getElementById('svgOverlay') as unknown as SVGSVGElement | null;
  const wrap = document.getElementById('lanesWrap');
  if (!svg || !wrap) return;
  svg.innerHTML = '';
  svg.style.width = '0';
  svg.style.height = '0';
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  const W = wrap.scrollWidth,
    H = wrap.scrollHeight;
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.style.width = W + 'px';
  svg.style.height = H + 'px';
  const wrapRect = wrap.getBoundingClientRect();

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  Object.entries(typeColor).forEach(([t, col]) => {
    const m = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    m.setAttribute('id', `arr-${t}`);
    m.setAttribute('markerWidth', '10');
    m.setAttribute('markerHeight', '10');
    m.setAttribute('refX', '7');
    m.setAttribute('refY', '3.5');
    m.setAttribute('orient', 'auto');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M0,0 L0,7 L7,3.5 z');
    p.setAttribute('fill', col);
    m.appendChild(p);
    defs.appendChild(m);
  });
  svg.appendChild(defs);

  const connected = connectedSet(selectedNodeId);

  const _solid: SVGPathElement[] = [];
  const _dashed: SVGPathElement[] = [];
  const inCntByTarget: Record<string, number> = {};
  const inSeenTgt: Record<string, number> = {};
  CROSS_CONNS.forEach((c) => {
    if (c.type === 'conditional' || c.type === 'deferred') inCntByTarget[c.to] = (inCntByTarget[c.to] || 0) + 1;
  });

  CROSS_CONNS.forEach((conn, idx) => {
    const fromEl = document.getElementById(conn.from);
    const toEl = document.getElementById(conn.to);
    if (!fromEl || !toEl) return;

    const col = typeColor[conn.type] || '#64748b';
    const dash = typeDash[conn.type] || 'none';

    function isNodeFiltered(el: Element): boolean {
      if (document.body.classList.contains('layer-erp') && el.classList.contains('node-manual')) return true;
      if (document.body.classList.contains('layer-manual') && el.classList.contains('node-erp')) return true;
      const lw = document.getElementById('lanesWrap');
      if (lw && lw.classList.contains('dept-active') && !el.classList.contains('dept-show')) return true;
      return false;
    }
    const fromFiltered = isNodeFiltered(fromEl);
    const toFiltered = isNodeFiltered(toEl);
    if (fromFiltered && toFiltered) return;

    const fr = fromEl.getBoundingClientRect();
    const tr = toEl.getBoundingClientRect();
    const isIndirect = conn.type === 'conditional' || conn.type === 'deferred';

    let d: string;
    if (isIndirect) {
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
      const _sx = x2 >= x1 ? 1 : -1,
        _v1 = midY >= y1 ? 1 : -1,
        _v2 = y2 >= midY ? 1 : -1;
      const _cr = Math.max(0, Math.min(9, Math.abs(x2 - x1) / 2, Math.abs(midY - y1), Math.abs(y2 - midY)));
      d = `M${x1},${y1} L${x1},${midY - _v1 * _cr} Q${x1},${midY} ${x1 + _sx * _cr},${midY} L${x2 - _sx * _cr},${midY} Q${x2},${midY} ${x2},${midY + _v2 * _cr} L${x2},${y2}`;
    } else {
      const CORRIDOR = 50,
        cr = 9;
      const sameRow = Math.abs(tr.top - fr.bottom) < 40;
      if (sameRow) {
        const [x1, y1] = pt(fromEl, 'top', wrapRect);
        const [x2, y2] = pt(toEl, 'top', wrapRect);
        const arch = Math.min(y1, y2) - 28;
        d = `M${x1},${y1} L${x1},${arch} L${x2},${arch} L${x2},${y2}`;
      } else {
        const [x1, y1] = pt(fromEl, 'left', wrapRect);
        const [x2, y2] = pt(toEl, 'left', wrapRect);
        const vd = y2 > y1 ? 1 : -1;
        d = `M${x1},${y1} L${CORRIDOR + cr},${y1} Q${CORRIDOR},${y1} ${CORRIDOR},${y1 + vd * cr} L${CORRIDOR},${y2 - vd * cr} Q${CORRIDOR},${y2} ${CORRIDOR + cr},${y2} L${x2},${y2}`;
      }
    }

    const baseOpacity = fromFiltered || toFiltered ? 0.1 : 0.5;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', col);
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('stroke-dasharray', dash);
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('d', d);
    path.setAttribute('marker-end', `url(#arr-${conn.type})`);

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
    (path.dataset as any).connIdx = String(idx);
    path.classList.add('cross-arrow');
    path.classList.add('ca-' + conn.type);
    (dash === 'none' ? _solid : _dashed).push(path);
  });

  _solid.forEach((p) => svg.appendChild(p));
  _dashed.forEach((p) => svg.appendChild(p));
}

/** Redraws on every render-affecting state change, plus on window resize —
 *  mirrors the original's requestAnimationFrame(drawArrows) calls after
 *  renderLanes/applyDeptFilter/layer-filter/toggleFlows and the resize listener. */
export default function SvgEdges({ s }: { s: Store }) {
  useLayoutEffect(() => {
    const raf = requestAnimationFrame(() => drawArrows(s.selectedNodeId));
    const t = setTimeout(() => drawArrows(s.selectedNodeId), 250);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [s.selectedNodeId, s.activeDept, s.activeLayer, s.lang, s.hideDirect, s.hideIndirect, s.overviewOpen, s.focusShow]);

  useLayoutEffect(() => {
    const onResize = () => requestAnimationFrame(() => drawArrows(s.selectedNodeId));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [s.selectedNodeId]);

  return <svg className="svg-overlay" id="svgOverlay" />;
}
