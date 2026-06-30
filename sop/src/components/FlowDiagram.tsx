/** Process-flow swimlane diagram + SVG edge router.
 *  Mirrors diagramHtml(), flowLegendHtml(), narrativeHtml(), and
 *  layoutFlowEdges() in index.html. The grid lays out the boxes; arrows are
 *  measured from the laid-out DOM and drawn into an absolutely-positioned <svg>.
 */
import { useEffect, useRef } from 'react';
import type { Store } from '../store';
import type { Flow } from '../data/types';

function esc(s: string): string {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string);
}

/* Verbatim port of layoutFlowEdges(f). Reads node rects by id, draws into #fe-<id>. */
function layoutFlowEdges(f: Flow) {
  const svg = document.getElementById('fe-' + f.id);
  const body = document.getElementById('fb-' + f.id);
  if (!svg || !body) return;
  const br = body.getBoundingClientRect();
  const W = body.scrollWidth || body.clientWidth;
  const H = body.scrollHeight || body.clientHeight;
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

  const dark = document.documentElement.classList.contains('dark');
  const KIND: Record<string, string> = {
    normal: dark ? '#62707f' : '#8693a3',
    approve: '#2E75B6',
    yes: '#2e9e5b',
    reject: '#d9822b',
  };
  const chipFill = dark ? '#161b22' : '#ffffff';
  const chipStroke = dark ? '#283039' : '#e7ecf1';
  const chipText = dark ? '#9ba6b2' : '#5b6672';

  function R(nid: string) {
    const el = document.getElementById('fn-' + f.id + '-' + nid);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = r.left - br.left;
    const y = r.top - br.top;
    return {
      w: r.width,
      h: r.height,
      cx: x + r.width / 2,
      cy: y + r.height / 2,
      top: y,
      bottom: y + r.height,
      left: x,
      right: x + r.width,
    };
  }

  let defs = '<defs>';
  ['normal', 'approve', 'yes', 'reject'].forEach((k) => {
    defs +=
      '<marker id="ar-' + f.id + '-' + k + '" markerWidth="9" markerHeight="9" refX="7.5" refY="4" ' +
      'orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,4 L0,8 Z" fill="' + KIND[k] + '"/></marker>';
  });
  defs += '</defs>';

  let paths = '';
  let labels = '';
  f.edges.forEach((e) => {
    const a = R(e.from);
    const b = R(e.to);
    if (!a || !b) return;
    const kind = e.kind || 'normal';
    const col = KIND[kind] || KIND.normal;
    let d: string, lx: number, ly: number;
    const sameCol = Math.abs(a.cx - b.cx) < 6;
    const sameRow = Math.abs(a.cy - b.cy) < 6;
    if (kind === 'reject') {
      const chY = Math.max(a.bottom, b.bottom) + 17;
      d = 'M ' + a.cx + ' ' + a.bottom + ' L ' + a.cx + ' ' + chY + ' L ' + b.cx + ' ' + chY + ' L ' + b.cx + ' ' + b.bottom;
      lx = (a.cx + b.cx) / 2;
      ly = chY + 9;
    } else if (sameCol && b.top >= a.bottom) {
      d = 'M ' + a.cx + ' ' + a.bottom + ' L ' + b.cx + ' ' + b.top;
      lx = a.cx;
      ly = (a.bottom + b.top) / 2;
    } else if (sameRow) {
      if (b.left >= a.right) {
        d = 'M ' + a.right + ' ' + a.cy + ' L ' + b.left + ' ' + b.cy;
        lx = (a.right + b.left) / 2;
      } else {
        d = 'M ' + a.left + ' ' + a.cy + ' L ' + b.right + ' ' + b.cy;
        lx = (a.left + b.right) / 2;
      }
      ly = a.cy - 9;
    } else if (b.top >= a.bottom) {
      const midY = (a.bottom + b.top) / 2;
      d = 'M ' + a.cx + ' ' + a.bottom + ' L ' + a.cx + ' ' + midY + ' L ' + b.cx + ' ' + midY + ' L ' + b.cx + ' ' + b.top;
      lx = (a.cx + b.cx) / 2;
      ly = midY - 9;
    } else {
      const chY2 = b.top - 17;
      d = 'M ' + a.cx + ' ' + a.top + ' L ' + a.cx + ' ' + chY2 + ' L ' + b.cx + ' ' + chY2 + ' L ' + b.cx + ' ' + b.top;
      lx = (a.cx + b.cx) / 2;
      ly = chY2 - 9;
    }
    paths +=
      '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="1.7"' +
      (kind === 'reject' ? ' stroke-dasharray="5 4"' : '') +
      ' marker-end="url(#ar-' + f.id + '-' + kind + ')"/>';
    if (e.label) {
      const wl = e.label.length * 6.4 + 12;
      labels +=
        '<g><rect x="' + (lx - wl / 2) + '" y="' + (ly - 8) + '" width="' + wl + '" height="16" rx="5" ' +
        'fill="' + chipFill + '" stroke="' + chipStroke + '"/>' +
        '<text x="' + lx + '" y="' + (ly + 3.6) + '" text-anchor="middle" font-size="10.5" ' +
        'font-family="Sarabun,sans-serif" fill="' + chipText + '">' + esc(e.label) + '</text></g>';
    }
  });
  svg.innerHTML = defs + paths + labels;
}

export default function FlowDiagram({ s, f }: { s: Store; f: Flow }) {
  const laneIndex: Record<string, number> = {};
  f.lanes.forEach((l, i) => (laneIndex[l.key] = i));
  let maxRank = 0;
  f.nodes.forEach((n) => {
    if (n.rank > maxRank) maxRank = n.rank;
  });
  const cols = 'repeat(' + f.lanes.length + ',var(--flow-col))';

  const ranRef = useRef<Flow | null>(null);
  // Re-route arrows after layout, on font load, and whenever theme/lang/pane change.
  useEffect(() => {
    ranRef.current = f;
    const run = () => layoutFlowEdges(f);
    const raf = requestAnimationFrame(run);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run).catch(() => {});
    const onResize = () => run();
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [f, s.dark, s.lang, s.mobileView]);

  return (
    <>
      <div className="flow-wrap">
        <div className="flow-scroll">
          <div className="flow-canvas">
            <div className="flow-lanes" style={{ gridTemplateColumns: cols }}>
              {f.lanes.map((l, i) => (
                <div key={i} className={'flow-lane-h m-' + (l.module || '')}>
                  <b>{l.name}</b>
                  {l.sub && <small>{l.sub}</small>}
                </div>
              ))}
            </div>
            <div className="flow-body" id={'fb-' + f.id}>
              <svg className="flow-edges" id={'fe-' + f.id} xmlns="http://www.w3.org/2000/svg"></svg>
              <div
                className="flow-grid"
                style={{ gridTemplateColumns: cols, gridTemplateRows: 'repeat(' + (maxRank + 1) + ',auto)' }}
              >
                {f.nodes.map((n) => (
                  <div
                    key={n.id}
                    className={'flow-node fn-' + (n.type || 'process')}
                    id={'fn-' + f.id + '-' + n.id}
                    style={{ gridColumn: (laneIndex[n.lane] || 0) + 1, gridRow: n.rank + 1 }}
                  >
                    {n.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <FlowLegend s={s} />
      <FlowNarrative f={f} s={s} />
    </>
  );
}

function FlowLegend({ s }: { s: Store }) {
  return (
    <div className="flow-legend">
      <span>
        <i style={{ borderTopColor: '#8693a3' }}></i>
        {s.t('flowLegNormal')}
      </span>
      <span>
        <i style={{ borderTopColor: '#2E75B6' }}></i>
        {s.t('flowLegApprove')}
      </span>
      <span>
        <i style={{ borderTopColor: '#2e9e5b' }}></i>
        {s.t('flowLegYes')}
      </span>
      <span>
        <i style={{ borderTopColor: '#d9822b', borderTopStyle: 'dashed' }}></i>
        {s.t('flowLegReject')}
      </span>
    </div>
  );
}

function FlowNarrative({ f, s }: { f: Flow; s: Store }) {
  if (!f.narrative || !f.narrative.length) return null;
  return (
    <div className="d-sec" style={{ marginTop: '20px' }}>
      <p className="lbl">{s.t('flowStepsLbl')}</p>
      <ul className="flow-narr">
        {f.narrative.map((line, i) => {
          if (line.indexOf('» ') === 0) return <li key={i} className="fn-sub">{line.slice(2)}</li>;
          if (line.indexOf('! ') === 0) return <li key={i} className="fn-note">{line.slice(2)}</li>;
          return <li key={i} className="fn-main">{line}</li>;
        })}
      </ul>
    </div>
  );
}
