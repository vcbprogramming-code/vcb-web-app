/** Focus / linear-trace overlay. Verbatim-logic port of fEdges()/openFocus()/
 *  renderFocusDetail()/hlFocusEdges()/clrFocusEdges() in Index.html — traces a
 *  node's full in/out pathway into a laid-out tree (columns = hop distance from
 *  the focus, rows packed greedily) with an SVG edge overlay, and a detail pane.
 *  The tree-layout math (columns/rows/edge routing) is complex, data-derived
 *  geometry with no DOM dependency until the final paint step, so it's kept as
 *  a pure function + a thin useLayoutEffect that writes the computed SVG/DOM,
 *  matching the imperative-innerHTML convention used by the sibling `sop` port's
 *  FlowDiagram.tsx for its own SVG edge router.
 */
import { useLayoutEffect, useRef } from 'react';
import type { Store } from '../store';
import { LANES, CROSS_CONNS, DEPTS, MODULES, AI_OPPS } from '../data';
import { NODE_INDEX, isLaneNode } from '../lib/derived';
import type { LaneNode } from '../data/types';
import { tNode } from '../lib/i18n';
import { LANG_TH } from '../data/langTh';

interface FEdges {
  out: Record<string, string[]>;
  inn: Record<string, string[]>;
  edges: [string, string][];
}

/** Verbatim port of fEdges(). */
function fEdges(): FEdges {
  const out: Record<string, string[]> = {};
  const inn: Record<string, string[]> = {};
  const pseen = new Set<string>();
  const allset = new Set<string>();
  const rank: Record<string, number> = {};
  const addP = (a: string, b: string, r: number) => {
    const k = a + '>' + b;
    if (pseen.has(k)) return;
    pseen.add(k);
    rank[k] = r;
    (out[a] = out[a] || []).push(b);
    (inn[b] = inn[b] || []).push(a);
  };
  const addAll = (a: string, b: string) => {
    if (a !== b) allset.add(a + '>' + b);
  };
  LANES.forEach((l) => {
    const ns = l.nodes;
    for (let i = 0; i < ns.length - 1; i++) {
      if (!ns[i].standalone && !ns[i + 1].standalone) {
        addP(ns[i].id, ns[i + 1].id, 0);
        addAll(ns[i].id, ns[i + 1].id);
      }
    }
  });
  CROSS_CONNS.forEach((c) => {
    addAll(c.from, c.to);
    if (!c.feedback) addP(c.from, c.to, c.to === 'n-pm-dash' || c.to === 'n-fin' ? 2 : c.type === 'conditional' || c.type === 'deferred' ? 1 : 0);
  });
  const byRank = (arr: string[], key: (x: string) => string): string[] =>
    arr
      .map((x, i): [string, number] => [x, i])
      .sort((p, q) => (rank[key(p[0])] - rank[key(q[0])]) || p[1] - q[1])
      .map((p) => p[0]);
  Object.keys(out).forEach((a) => {
    out[a] = byRank(out[a], (b) => a + '>' + b);
  });
  Object.keys(inn).forEach((b) => {
    inn[b] = byRank(inn[b], (a) => a + '>' + b);
  });
  return { out, inn, edges: [...allset].map((k) => k.split('>') as [string, string]) };
}

function esc(s: string | undefined | null): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Verbatim port of openFocus()'s tree-layout + SVG/DOM-node build, minus the
 *  bits that read/write global mutable state (those live in the store now). */
function layoutAndRenderFocus(node: LaneNode, lang: Store['lang']) {
  const { out, inn, edges } = fEdges();
  const fid = node.id;
  const MAXD = 5;
  const col: Record<string, number> = { [fid]: 0 };
  const seen = new Set<string>([fid]);
  let fr = [fid];
  let d = 0;
  const treeSet = new Set<string>();

  const downReach = new Set<string>();
  {
    let q = [fid];
    const sr = new Set<string>([fid]);
    let dd = 0;
    while (q.length && dd < MAXD) {
      const nx: string[] = [];
      q.forEach((id) => (out[id] || []).forEach((t) => { if (!sr.has(t)) { sr.add(t); downReach.add(t); nx.push(t); } }));
      q = nx;
      dd++;
    }
  }
  const compactFeeders = new Set([...(inn[fid] || [])].filter((f) => downReach.has(f)));
  while (fr.length && d < MAXD) {
    const nx: string[] = [];
    fr.forEach((id) => (out[id] || []).forEach((t) => {
      if (!seen.has(t) && !compactFeeders.has(t)) {
        seen.add(t);
        col[t] = col[id] + 1;
        nx.push(t);
        treeSet.add(id + '>' + t);
      }
    }));
    fr = nx;
    d++;
  }
  let frU = [fid];
  d = 0;
  const seenU = new Set<string>([fid]);
  while (frU.length && d < MAXD) {
    const nx: string[] = [];
    frU.forEach((id) => (inn[id] || []).forEach((sc) => {
      if (!seen.has(sc) && !seenU.has(sc)) {
        seenU.add(sc);
        col[sc] = col[id] - 1;
        treeSet.add(sc + '>' + id);
        if (!compactFeeders.has(sc)) nx.push(sc);
      }
    }));
    frU = nx;
    d++;
  }
  const feedbackSet = new Set(CROSS_CONNS.filter((c) => c.feedback).map((c) => c.from + '>' + c.to));
  const condSet = new Set(
    CROSS_CONNS.filter((c) => !c.feedback && (c.type === 'conditional' || c.type === 'deferred')).map((c) => c.from + '>' + c.to),
  );
  const rendered = [...new Set([...seen, ...seenU])].filter((id) => NODE_INDEX[id]);
  const byCol: Record<number, string[]> = {};
  rendered.forEach((id) => {
    const c = col[id];
    (byCol[c] = byCol[c] || []).push(id);
  });
  const cols = Object.keys(byCol).map(Number).sort((a, b) => a - b);
  const COLW = 212, ROWH = 86, CW = 158, CH = 66, PAD = 34, GAP = COLW - CW;
  const ciOf: Record<string, number> = {};
  cols.forEach((c, ci) => byCol[c].forEach((id) => { ciOf[id] = ci; }));
  const drawEdges = edges.filter(([a, b]) => ciOf[a] !== undefined && ciOf[b] !== undefined && (treeSet.has(a + '>' + b) || feedbackSet.has(a + '>' + b)));
  const nFb = drawEdges.filter(([a, b]) => feedbackSet.has(a + '>' + b) && Math.abs(ciOf[a] - ciOf[b]) !== 1).length;
  const TOPBAND = nFb ? Math.min(nFb, 6) * 9 + 22 : 0;

  const childrenOf: Record<string, string[]> = {};
  treeSet.forEach((k) => {
    const j = k.indexOf('>');
    const a = k.slice(0, j);
    const b = k.slice(j + 1);
    if (col[a] === undefined || col[b] === undefined) return;
    const par = Math.abs(col[a]) <= Math.abs(col[b]) ? a : b;
    const ch = par === a ? b : a;
    (childrenOf[par] = childrenOf[par] || []).push(ch);
  });

  const spine = new Set<string>([fid]);
  (function () {
    let c = fid, nx: string | undefined;
    // eslint-disable-next-line no-cond-assign
    while ((nx = (childrenOf[c] || []).find((k) => col[k] > col[c])) !== undefined) { spine.add(nx); c = nx; }
  })();
  (function () {
    let c = fid, nx: string | undefined;
    // eslint-disable-next-line no-cond-assign
    while ((nx = (childrenOf[c] || []).find((k) => col[k] < col[c])) !== undefined) { spine.add(nx); c = nx; }
  })();

  const rowOf: Record<string, number> = {};
  const occ: Record<number, Set<number>> = {};
  const put = (id: string, r: number) => {
    rowOf[id] = r;
    (occ[ciOf[id]] = occ[ciOf[id]] || new Set()).add(r);
  };
  spine.forEach((id) => put(id, 0));
  const bfs = [fid];
  const vis = new Set<string>([fid]);
  for (let i = 0; i < bfs.length; i++) {
    (childrenOf[bfs[i]] || []).forEach((ch) => { if (!vis.has(ch)) { vis.add(ch); bfs.push(ch); } });
  }
  bfs.forEach((n) => {
    (childrenOf[n] || []).forEach((ch) => {
      if (rowOf[ch] !== undefined) return;
      const used = (occ[ciOf[ch]] = occ[ciOf[ch]] || new Set());
      let r = rowOf[n] || 0;
      while (used.has(r)) r++;
      put(ch, r);
    });
  });
  rendered.forEach((id) => {
    if (rowOf[id] === undefined) {
      const used = (occ[ciOf[id]] = occ[ciOf[id]] || new Set());
      let r = 0;
      while (used.has(r)) r++;
      put(id, r);
    }
  });
  const pos: Record<string, { x: number; y: number }> = {};
  rendered.forEach((id) => { pos[id] = { x: PAD + ciOf[id] * COLW, y: PAD + TOPBAND + rowOf[id] * ROWH }; });
  const maxRows = Math.max(1, ...Object.values(rowOf).map((r) => r + 1));
  const bottomY = PAD + TOPBAND + (maxRows - 1) * ROWH + CH;
  const svgNS = 'http://www.w3.org/2000/svg';
  const W = PAD * 2 + (cols.length - 1) * COLW + CW;
  const H = bottomY + PAD + 10;

  const canvas = document.getElementById('focusCanvas');
  if (!canvas) return;
  canvas.innerHTML = '';
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'focus-svg');
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.innerHTML =
    '<defs><marker id="fma" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#475569"/></marker><marker id="fmaH" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#38bdf8"/></marker><marker id="fmaBack" markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#a3895c"/></marker></defs>';

  const typeByGap: Record<number, Set<string>> = {};
  drawEdges.forEach(([a, b]) => {
    if (feedbackSet.has(a + '>' + b) || !pos[a] || !pos[b]) return;
    if (Math.abs(pos[a].y - pos[b].y) < 3) return;
    const g = ciOf[a];
    const t = condSet.has(a + '>' + b) ? 'i' : 'd';
    (typeByGap[g] = typeByGap[g] || new Set()).add(t);
  });
  const laneFrac: Record<string, number> = {};
  Object.keys(typeByGap).forEach((gk) => {
    const g = Number(gk);
    const arr = [...typeByGap[g]].sort();
    const n = arr.length;
    arr.forEach((t, i) => { laneFrac[g + '|' + t] = (i + 1) / (n + 1); });
  });
  let fbN = 0;
  drawEdges.forEach(([a, b]) => {
    if (!pos[a] || !pos[b]) return;
    const hot = a === fid || b === fid;
    const ax = pos[a].x, ay = pos[a].y, bx = pos[b].x, by = pos[b].y;
    const p = document.createElementNS(svgNS, 'path');
    p.setAttribute('fill', 'none');
    const r = 8;
    const fb = feedbackSet.has(a + '>' + b);
    const cond = condSet.has(a + '>' + b);
    let dd: string;
    if (!fb) {
      const x1 = ax + CW, y1 = ay + CH / 2, x2 = bx, y2 = by + CH / 2;
      const f = laneFrac[ciOf[a] + '|' + (cond ? 'i' : 'd')];
      let vx = x1 + (f !== undefined ? GAP * f : GAP / 2);
      vx = Math.max(x1 + r + 2, Math.min(x2 - r - 2, vx));
      const sg = y2 > y1 ? 1 : -1;
      dd = Math.abs(y2 - y1) < 3
        ? `M${x1},${y1} H${x2}`
        : `M${x1},${y1} H${vx - r} Q${vx},${y1} ${vx},${y1 + sg * r} V${y2 - sg * r} Q${vx},${y2} ${vx + r},${y2} H${x2}`;
    } else {
      const above = by < ay, sy = above ? ay : ay + CH, ty = above ? by + CH : by, sx = ax + CW / 2, tx = bx + CW / 2, toLeft = bx <= ax;
      const sameCol = Math.abs(ax - bx) < 2, adjacent = Math.abs(ay - by) <= ROWH * 1.3;
      if (sameCol) {
        fbN++;
        dd = `M${sx},${sy} L${tx},${ty}`;
      } else if (adjacent) {
        fbN++;
        if (Math.abs(ay - by) < 3) {
          const yb = Math.max(ay, by) + CH + 12, sxb = ax + CW / 2, txb = bx + CW / 2;
          dd = `M${sxb},${ay + CH} V${yb} H${txb} V${by + CH}`;
        } else {
          const ymid = (sy + ty) / 2;
          dd = `M${sx},${sy} V${ymid} H${tx} V${ty}`;
        }
      } else {
        const gx = (toLeft ? ax - GAP / 2 : ax + CW + GAP / 2) + (toLeft ? -8 : 8) + (fbN % 2 ? 3 : -3);
        const yb1 = above ? sy - 12 : sy + 12, yb2 = above ? ty + 12 : ty - 12;
        fbN++;
        dd = `M${sx},${sy} V${yb1} H${gx} V${yb2} H${tx} V${ty}`;
      }
    }
    p.setAttribute('d', dd);
    if (fb) {
      p.setAttribute('stroke', '#c9a14a');
      p.setAttribute('stroke-width', '1.8');
      p.setAttribute('stroke-dasharray', '5 4');
      p.setAttribute('marker-end', 'url(#fmaBack)');
    } else if (cond) {
      p.setAttribute('stroke', '#c9a14a');
      p.setAttribute('stroke-width', hot ? '2.3' : '1.6');
      p.setAttribute('stroke-dasharray', '6 4');
      p.setAttribute('marker-end', 'url(#fmaBack)');
    } else {
      p.setAttribute('stroke', hot ? '#38bdf8' : '#334155');
      p.setAttribute('stroke-width', hot ? '2.3' : '1.6');
      p.setAttribute('marker-end', hot ? 'url(#fmaH)' : 'url(#fma)');
    }
    p.classList.add('fedge');
    p.dataset.ea = a;
    p.dataset.eb = b;
    p.dataset.w = p.getAttribute('stroke-width') || '';
    if (!hot && !fb) p.classList.add('fedge-cold');
    svg.appendChild(p);
  });
  canvas.appendChild(svg);

  rendered.forEach((id) => {
    const n = NODE_INDEX[id];
    if (!n || !isLaneNode(n)) return;
    const dept = DEPTS[n.dept] || { color: '#334155', name: n.dept, icon: '' };
    const el = document.createElement('div');
    el.className = 'fnode ' + (n.type === 'erp' ? 'fnode-erp' : 'fnode-manual') + (id === fid ? ' is-focus' : '') + (AI_OPPS[id] ? ' ai-opp' : '');
    if (n.type === 'erp') el.style.background = dept.color;
    else {
      el.style.color = dept.color;
      el.style.borderColor = dept.color + '66';
    }
    el.style.left = pos[id].x + 'px';
    el.style.top = pos[id].y + 'px';
    const lbl = (tNode(lang, n, 'label') || '').replace(/\n/g, ' ');
    el.innerHTML = `<div class="fnode-lbl">${esc(lbl)}</div>${n.sub ? `<div class="fnode-sub">${esc(tNode(lang, n, 'sub') || n.sub)}</div>` : ''}${AI_OPPS[id] ? '<span class="ai-badge">🤖 AI</span>' : ''}`;
    el.dataset.nid = id;
    el.addEventListener('mouseenter', () => hlFocusEdges(id));
    el.addEventListener('mouseleave', () => clrFocusEdges());
    el.addEventListener('click', () => {
      const ev = new CustomEvent('focus-node-click', { detail: id });
      document.dispatchEvent(ev);
    });
    canvas.appendChild(el);
  });

  // scroll into view: keep one upstream column visible on the left
  requestAnimationFrame(() => {
    const fsc = document.querySelector<HTMLElement>('.focus-scroll');
    if (!fsc) return;
    const LEFTGAP = COLW + 24, AY = 24;
    canvas.style.width = Math.max(W, pos[fid].x - LEFTGAP + fsc.clientWidth) + 'px';
    canvas.style.height = Math.max(H, pos[fid].y - AY + fsc.clientHeight) + 'px';
    fsc.scrollLeft = Math.max(0, pos[fid].x - LEFTGAP);
    fsc.scrollTop = Math.max(0, pos[fid].y - AY);
  });
}

function hlFocusEdges(id: string) {
  const svg = document.querySelector('.focus-svg');
  if (!svg) return;
  svg.querySelectorAll<SVGPathElement>('.fedge').forEach((p) => {
    const on = p.dataset.ea === id || p.dataset.eb === id;
    p.style.opacity = on ? '1' : '0.07';
    p.style.strokeWidth = on ? String(parseFloat(p.dataset.w || '0') + 1.4) : p.dataset.w || '';
  });
  document.querySelectorAll<HTMLElement>('#focusCanvas .fnode').forEach((el) => {
    const nid = el.dataset.nid;
    const conn = nid === id || !!svg.querySelector(`.fedge[data-ea="${id}"][data-eb="${nid}"],.fedge[data-eb="${id}"][data-ea="${nid}"]`);
    el.style.opacity = conn ? '1' : '0.4';
  });
}
function clrFocusEdges() {
  const svg = document.querySelector('.focus-svg');
  if (!svg) return;
  svg.querySelectorAll<SVGPathElement>('.fedge').forEach((p) => {
    p.style.opacity = '';
    p.style.strokeWidth = p.dataset.w || '';
  });
  document.querySelectorAll<HTMLElement>('#focusCanvas .fnode').forEach((el) => { el.style.opacity = ''; });
}

// NOTE (source-level dead code, ported faithfully but intentionally not
// rendered): the canonical Index.html defines renderFocusDetail() and a
// `.focus-detail` CSS rule, but renderFocusDetail() is never called from
// anywhere in the script, and the static markup for #focusLayer has no
// `.focus-main`/`#focusDetail` wrapper at all — only `.focus-scroll >
// .focus-canvas`. The shipped v8.86 app therefore never shows this side
// panel. Kept here (unused) for reference/fidelity rather than deleted, in
// case a future header/detail wiring wants it.
function FocusDetail({ node, lang }: { node: LaneNode; lang: Store['lang'] }) {
  const dept = DEPTS[node.dept] || { color: '#334155', name: node.dept, icon: '' };
  const mod = node.module ? MODULES[node.module] : null;
  const lbl = (tNode(lang, node, 'label') || '').replace(/\n/g, ' ');
  const thd = LANG_TH.nodes[node.id] || {};
  const desc = node.type === 'erp' && mod ? (lang === 'th' && thd.desc ? thd.desc : node.desc || mod.purpose || '') : tNode(lang, node, 'desc') || '';
  const items = tNode(lang, node, 'items') || node.items || [];
  const dept2 = node.dept2 ? DEPTS[node.dept2 as keyof typeof DEPTS] : null;
  return (
    <div className="focus-detail" id="focusDetail">
      <div className="fd-title">{lbl}</div>
      <div className="fd-sub">{mod ? mod.name : node.sub || ''}</div>
      <div className="fd-tags">
        <span className="fd-tag" style={{ background: node.type === 'erp' ? '#0e7490' : '#475569' }}>
          {node.type === 'erp' ? 'ERP' : 'Manual'}
        </span>
        {node.module ? (
          <span className="fd-tag" style={{ background: '#4338ca' }}>
            Module: {node.module}
          </span>
        ) : null}
        <span className="fd-tag" style={{ background: dept.color }}>
          {dept.icon || ''} {dept.name || node.dept}
        </span>
        {dept2 ? (
          <span className="fd-tag" style={{ background: dept2.color }}>
            {dept2.icon || ''} {dept2.name} (supports/checks)
          </span>
        ) : null}
        {node.loc === 'site' ? (
          <span className="fd-tag" style={{ background: '#E65100' }}>
            📍 Done at site
          </span>
        ) : null}
        <span className="fd-tag" style={{ background: node.unverified ? '#b45309' : '#15803d' }}>
          {node.unverified ? '⚠ To confirm' : '✓ Verified'}
        </span>
      </div>
      {desc ? <div className="fd-desc">{desc}</div> : null}
      {items.length ? (
        <>
          <div className="fd-sec">STEPS</div>
          <ol className="fd-steps">
            {items.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ol>
        </>
      ) : null}
      {node.routes && node.routes.length ? (
        <>
          <div className="fd-sec">TYPE OPTIONS</div>
          {node.routes.map((r, i) => (
            <div className="fd-route" key={i}>
              <b>{r.n}</b>
              <div>{r.d}</div>
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}

export default function FocusTrace({ s }: { s: Store }) {
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const node = s.focusId ? NODE_INDEX[s.focusId] : null;

  useLayoutEffect(() => {
    if (!s.focusShow || !node || !isLaneNode(node)) return;
    layoutAndRenderFocus(node, s.lang);
  }, [s.focusShow, s.focusId, s.lang]);

  useLayoutEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const n = NODE_INDEX[id];
      if (n && isLaneNode(n)) s.openFocus(n);
    };
    document.addEventListener('focus-node-click', handler);
    return () => document.removeEventListener('focus-node-click', handler);
  }, [s]);

  if (!s.focusShow || !node || !isLaneNode(node)) {
    return <div className="focus-layer" id="focusLayer"></div>;
  }

  const flbl = (tNode(s.lang, node, 'label') || '').replace(/\n/g, ' ');

  return (
    <div className="focus-layer show" id="focusLayer">
      <div className="focus-head">
        <div className="focus-title" id="focusTitle">
          🎯 {flbl} <span>full in/out pathways · click any box to re-trace</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="focus-btn" onClick={s.showOnBigMap}>
            🗺️ Show on big map
          </button>
          <button className="focus-btn" onClick={s.closeFocus}>
            ✕ Close
          </button>
        </div>
      </div>
      <div className="focus-trail" id="focusTrail">
        {s.focusTrail.map((id, i) => {
          const n = NODE_INDEX[id];
          if (!n || !isLaneNode(n)) return null;
          const lab = (tNode(s.lang, n, 'label') || '').replace(/\n/g, ' ');
          const cur = id === s.focusId;
          return (
            <span key={id}>
              {i > 0 ? <span className="fc-sep">›</span> : null}
              <span className={'fc-crumb' + (cur ? ' cur' : '')} onClick={() => s.openFocus(n)}>
                {lab}
              </span>
            </span>
          );
        })}
      </div>
      <div className="focus-scroll">
        <div className="focus-canvas" id="focusCanvas" ref={canvasWrapRef}></div>
      </div>
      <div className="focus-hint">
        Linear trace — the focused box (gold) with everything that flows IN (left) and OUT (right). Hover a box to
        highlight just its lines; click any box to re-trace from it.
      </div>
    </div>
  );
}
