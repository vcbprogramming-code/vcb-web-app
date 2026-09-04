/** Focus / linear-trace overlay.
 *
 *  Traces a node's full in/out pathway into a laid-out tree — columns are hop
 *  distance from the focus, rows are packed greedily — and paints it with a
 *  hand-written SVG edge overlay. No chart or graph library: TECH_STACK.md
 *  rules those out, and the routing here (orthogonal edges with per-gap lanes,
 *  plus a separate feedback-edge router) is specific enough that no library
 *  would have drawn it anyway.
 *
 *  The layout is pure data-derived geometry with no DOM dependency until the
 *  final paint, so it stays a plain function called from a layout effect that
 *  writes the computed SVG and node boxes into the canvas.
 *
 *  The source's renderFocusDetail() / .focus-detail side panel is NOT ported:
 *  it was never called from anywhere and the focus layer's markup had no
 *  container for it, so it could not render in the shipped app. See PORT_NOTES.
 */
import { useLayoutEffect } from 'react';
import { useI18n } from '@vcb/shared';
import { useStore } from '../store.jsx';
import { LANES, CROSS_CONNS, DEPTS, AI_OPPS } from '../data/index.js';
import { NODE_INDEX, isLaneNode } from '../lib/derived.js';
import { tNode } from '../lib/mapLang.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Adjacency for the trace: lane order plus non-feedback cross-connections,
 *  each ranked so the straightest path sorts first. */
function fEdges() {
  const out = {};
  const inn = {};
  const pseen = new Set();
  const allset = new Set();
  const rank = {};

  const addP = (a, b, r) => {
    const k = a + '>' + b;
    if (pseen.has(k)) return;
    pseen.add(k);
    rank[k] = r;
    (out[a] = out[a] || []).push(b);
    (inn[b] = inn[b] || []).push(a);
  };
  const addAll = (a, b) => {
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
    if (!c.feedback) {
      // Dashboard/finance sinks rank last so they never hijack the spine.
      const r =
        c.to === 'n-pm-dash' || c.to === 'n-fin'
          ? 2
          : c.type === 'conditional' || c.type === 'deferred'
            ? 1
            : 0;
      addP(c.from, c.to, r);
    }
  });

  const byRank = (arr, key) =>
    arr
      .map((x, i) => [x, i])
      .sort((p, q) => rank[key(p[0])] - rank[key(q[0])] || p[1] - q[1])
      .map((p) => p[0]);

  Object.keys(out).forEach((a) => {
    out[a] = byRank(out[a], (b) => a + '>' + b);
  });
  Object.keys(inn).forEach((b) => {
    inn[b] = byRank(inn[b], (a) => a + '>' + b);
  });

  return { out, inn, edges: [...allset].map((k) => k.split('>')) };
}

/** Build the tree layout around `node` and paint it into #focusCanvas. */
function layoutAndRenderFocus(node, lang, t, onNodeClick) {
  const { out, inn, edges } = fEdges();
  const fid = node.id;
  const MAXD = 5;

  const col = { [fid]: 0 };
  const seen = new Set([fid]);
  const treeSet = new Set();

  // A feeder that is also reachable downstream would otherwise be drawn twice,
  // once on each side; keep it on the downstream side only.
  const downReach = new Set();
  {
    let q = [fid];
    const sr = new Set([fid]);
    let dd = 0;
    while (q.length && dd < MAXD) {
      const nx = [];
      q.forEach((id) =>
        (out[id] || []).forEach((tgt) => {
          if (!sr.has(tgt)) {
            sr.add(tgt);
            downReach.add(tgt);
            nx.push(tgt);
          }
        }),
      );
      q = nx;
      dd++;
    }
  }
  const compactFeeders = new Set([...(inn[fid] || [])].filter((f) => downReach.has(f)));

  // Downstream columns.
  let fr = [fid];
  let d = 0;
  while (fr.length && d < MAXD) {
    const nx = [];
    fr.forEach((id) =>
      (out[id] || []).forEach((tgt) => {
        if (!seen.has(tgt) && !compactFeeders.has(tgt)) {
          seen.add(tgt);
          col[tgt] = col[id] + 1;
          nx.push(tgt);
          treeSet.add(id + '>' + tgt);
        }
      }),
    );
    fr = nx;
    d++;
  }

  // Upstream columns.
  let frU = [fid];
  d = 0;
  const seenU = new Set([fid]);
  while (frU.length && d < MAXD) {
    const nx = [];
    frU.forEach((id) =>
      (inn[id] || []).forEach((src) => {
        if (!seen.has(src) && !seenU.has(src)) {
          seenU.add(src);
          col[src] = col[id] - 1;
          treeSet.add(src + '>' + id);
          if (!compactFeeders.has(src)) nx.push(src);
        }
      }),
    );
    frU = nx;
    d++;
  }

  const feedbackSet = new Set(
    CROSS_CONNS.filter((c) => c.feedback).map((c) => c.from + '>' + c.to),
  );
  const condSet = new Set(
    CROSS_CONNS.filter(
      (c) => !c.feedback && (c.type === 'conditional' || c.type === 'deferred'),
    ).map((c) => c.from + '>' + c.to),
  );

  const rendered = [...new Set([...seen, ...seenU])].filter((id) => NODE_INDEX[id]);
  const byCol = {};
  rendered.forEach((id) => {
    (byCol[col[id]] = byCol[col[id]] || []).push(id);
  });
  const cols = Object.keys(byCol)
    .map(Number)
    .sort((a, b) => a - b);

  const COLW = 212;
  const ROWH = 86;
  const CW = 158;
  const CH = 66;
  const PAD = 34;
  const GAP = COLW - CW;

  const ciOf = {};
  cols.forEach((c, ci) =>
    byCol[c].forEach((id) => {
      ciOf[id] = ci;
    }),
  );

  const drawEdges = edges.filter(
    ([a, b]) =>
      ciOf[a] !== undefined &&
      ciOf[b] !== undefined &&
      (treeSet.has(a + '>' + b) || feedbackSet.has(a + '>' + b)),
  );
  // Long feedback edges need a reserved band above the tree to run through.
  const nFb = drawEdges.filter(
    ([a, b]) => feedbackSet.has(a + '>' + b) && Math.abs(ciOf[a] - ciOf[b]) !== 1,
  ).length;
  const TOPBAND = nFb ? Math.min(nFb, 6) * 9 + 22 : 0;

  // Parent is whichever endpoint is nearer the focus column.
  const childrenOf = {};
  treeSet.forEach((k) => {
    const j = k.indexOf('>');
    const a = k.slice(0, j);
    const b = k.slice(j + 1);
    if (col[a] === undefined || col[b] === undefined) return;
    const par = Math.abs(col[a]) <= Math.abs(col[b]) ? a : b;
    const ch = par === a ? b : a;
    (childrenOf[par] = childrenOf[par] || []).push(ch);
  });

  // The spine runs straight out from the focus in both directions on row 0.
  const spine = new Set([fid]);
  for (const dir of [1, -1]) {
    let c = fid;
    let nx;
    while (
      (nx = (childrenOf[c] || []).find((k) => (dir > 0 ? col[k] > col[c] : col[k] < col[c]))) !==
      undefined
    ) {
      spine.add(nx);
      c = nx;
    }
  }

  // Rows: spine first, then breadth-first greedy packing per column.
  const rowOf = {};
  const occ = {};
  const put = (id, r) => {
    rowOf[id] = r;
    (occ[ciOf[id]] = occ[ciOf[id]] || new Set()).add(r);
  };
  spine.forEach((id) => put(id, 0));

  const bfs = [fid];
  const vis = new Set([fid]);
  for (let i = 0; i < bfs.length; i++) {
    (childrenOf[bfs[i]] || []).forEach((ch) => {
      if (!vis.has(ch)) {
        vis.add(ch);
        bfs.push(ch);
      }
    });
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

  const pos = {};
  rendered.forEach((id) => {
    pos[id] = { x: PAD + ciOf[id] * COLW, y: PAD + TOPBAND + rowOf[id] * ROWH };
  });
  const maxRows = Math.max(1, ...Object.values(rowOf).map((r) => r + 1));
  const bottomY = PAD + TOPBAND + (maxRows - 1) * ROWH + CH;
  const W = PAD * 2 + (cols.length - 1) * COLW + CW;
  const H = bottomY + PAD + 10;

  const canvas = document.getElementById('focusCanvas');
  if (!canvas) return;
  canvas.innerHTML = '';
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'focus-svg absolute left-0 top-0 pointer-events-none overflow-visible');
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.innerHTML =
    '<defs>' +
    '<marker id="fma" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#475569"/></marker>' +
    '<marker id="fmaH" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#38bdf8"/></marker>' +
    '<marker id="fmaBack" markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#a3895c"/></marker>' +
    '</defs>';

  // Direct and conditional edges crossing the same gap get their own vertical
  // lane, so they do not overlap on the way across.
  const typeByGap = {};
  drawEdges.forEach(([a, b]) => {
    if (feedbackSet.has(a + '>' + b) || !pos[a] || !pos[b]) return;
    if (Math.abs(pos[a].y - pos[b].y) < 3) return;
    const g = ciOf[a];
    const type = condSet.has(a + '>' + b) ? 'i' : 'd';
    (typeByGap[g] = typeByGap[g] || new Set()).add(type);
  });
  const laneFrac = {};
  Object.keys(typeByGap).forEach((gk) => {
    const arr = [...typeByGap[gk]].sort();
    arr.forEach((type, i) => {
      laneFrac[gk + '|' + type] = (i + 1) / (arr.length + 1);
    });
  });

  let fbN = 0;
  drawEdges.forEach(([a, b]) => {
    if (!pos[a] || !pos[b]) return;
    const hot = a === fid || b === fid;
    const ax = pos[a].x;
    const ay = pos[a].y;
    const bx = pos[b].x;
    const by = pos[b].y;
    const r = 8;
    const fb = feedbackSet.has(a + '>' + b);
    const cond = condSet.has(a + '>' + b);

    let dd;
    if (!fb) {
      // Forward edge: out the right face, across a lane, into the left face.
      const x1 = ax + CW;
      const y1 = ay + CH / 2;
      const x2 = bx;
      const y2 = by + CH / 2;
      const f = laneFrac[ciOf[a] + '|' + (cond ? 'i' : 'd')];
      let vx = x1 + (f !== undefined ? GAP * f : GAP / 2);
      vx = Math.max(x1 + r + 2, Math.min(x2 - r - 2, vx));
      const sg = y2 > y1 ? 1 : -1;
      dd =
        Math.abs(y2 - y1) < 3
          ? `M${x1},${y1} H${x2}`
          : `M${x1},${y1} H${vx - r} Q${vx},${y1} ${vx},${y1 + sg * r} ` +
            `V${y2 - sg * r} Q${vx},${y2} ${vx + r},${y2} H${x2}`;
    } else {
      // Feedback edge: leaves and re-enters vertically, routed around the tree.
      const above = by < ay;
      const sy = above ? ay : ay + CH;
      const ty = above ? by + CH : by;
      const sx = ax + CW / 2;
      const tx = bx + CW / 2;
      const toLeft = bx <= ax;
      const sameCol = Math.abs(ax - bx) < 2;
      const adjacent = Math.abs(ay - by) <= ROWH * 1.3;

      if (sameCol) {
        fbN++;
        dd = `M${sx},${sy} L${tx},${ty}`;
      } else if (adjacent) {
        fbN++;
        if (Math.abs(ay - by) < 3) {
          const yb = Math.max(ay, by) + CH + 12;
          dd = `M${ax + CW / 2},${ay + CH} V${yb} H${bx + CW / 2} V${by + CH}`;
        } else {
          const ymid = (sy + ty) / 2;
          dd = `M${sx},${sy} V${ymid} H${tx} V${ty}`;
        }
      } else {
        // Long haul: run out to a side gutter, jog, and come back.
        const gx =
          (toLeft ? ax - GAP / 2 : ax + CW + GAP / 2) + (toLeft ? -8 : 8) + (fbN % 2 ? 3 : -3);
        const yb1 = above ? sy - 12 : sy + 12;
        const yb2 = above ? ty + 12 : ty - 12;
        fbN++;
        dd = `M${sx},${sy} V${yb1} H${gx} V${yb2} H${tx} V${ty}`;
      }
    }

    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('fill', 'none');
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
    el.className =
      'fnode ' +
      (n.type === 'erp' ? 'fnode-erp' : 'fnode-manual') +
      (id === fid ? ' is-focus' : '') +
      (AI_OPPS[id] ? ' ai-opp' : '');
    if (n.type === 'erp') {
      el.style.background = dept.color;
    } else {
      el.style.color = dept.color;
      el.style.borderColor = dept.color + '66';
    }
    el.style.left = pos[id].x + 'px';
    el.style.top = pos[id].y + 'px';

    // Built with DOM nodes rather than innerHTML so label text is never parsed
    // as markup.
    const lblEl = document.createElement('div');
    lblEl.className = 'fnode-lbl';
    lblEl.textContent = (tNode(lang, n, 'label') || '').replace(/\n/g, ' ');
    el.appendChild(lblEl);

    if (n.sub) {
      const subEl = document.createElement('div');
      subEl.className = 'fnode-sub';
      subEl.textContent = tNode(lang, n, 'sub') || n.sub;
      el.appendChild(subEl);
    }
    if (AI_OPPS[id]) {
      const badge = document.createElement('span');
      badge.className = 'ai-badge';
      badge.textContent = t('ai.badge');
      el.appendChild(badge);
    }

    el.dataset.nid = id;
    el.addEventListener('mouseenter', () => hlFocusEdges(id));
    el.addEventListener('mouseleave', () => clrFocusEdges());
    el.addEventListener('click', () => onNodeClick(id));
    canvas.appendChild(el);
  });

  // Scroll the focus into view, keeping one upstream column visible on the left.
  requestAnimationFrame(() => {
    const fsc = document.querySelector('.focus-scroll');
    if (!fsc) return;
    const LEFTGAP = COLW + 24;
    const AY = 24;
    canvas.style.width = Math.max(W, pos[fid].x - LEFTGAP + fsc.clientWidth) + 'px';
    canvas.style.height = Math.max(H, pos[fid].y - AY + fsc.clientHeight) + 'px';
    fsc.scrollLeft = Math.max(0, pos[fid].x - LEFTGAP);
    fsc.scrollTop = Math.max(0, pos[fid].y - AY);
  });
}

/** Hovering a box isolates its own edges and dims unrelated boxes. */
function hlFocusEdges(id) {
  const svg = document.querySelector('.focus-svg');
  if (!svg) return;
  svg.querySelectorAll('.fedge').forEach((p) => {
    const on = p.dataset.ea === id || p.dataset.eb === id;
    p.style.opacity = on ? '1' : '0.07';
    p.style.strokeWidth = on ? String(parseFloat(p.dataset.w || '0') + 1.4) : p.dataset.w || '';
  });
  document.querySelectorAll('#focusCanvas .fnode').forEach((el) => {
    const nid = el.dataset.nid;
    const conn =
      nid === id ||
      !!svg.querySelector(
        `.fedge[data-ea="${id}"][data-eb="${nid}"],.fedge[data-eb="${id}"][data-ea="${nid}"]`,
      );
    el.style.opacity = conn ? '1' : '0.4';
  });
}

function clrFocusEdges() {
  const svg = document.querySelector('.focus-svg');
  if (!svg) return;
  svg.querySelectorAll('.fedge').forEach((p) => {
    p.style.opacity = '';
    p.style.strokeWidth = p.dataset.w || '';
  });
  document.querySelectorAll('#focusCanvas .fnode').forEach((el) => {
    el.style.opacity = '';
  });
}

export default function FocusTrace() {
  const s = useStore();
  const { t, lang } = useI18n();
  const node = s.focusId ? NODE_INDEX[s.focusId] : null;
  const active = s.focusShow && node && isLaneNode(node);

  useLayoutEffect(() => {
    if (!active) return;
    layoutAndRenderFocus(node, lang, t, (id) => {
      const n = NODE_INDEX[id];
      if (n && isLaneNode(n)) s.openFocus(n);
    });
    // s.openFocus is stable (useCallback); re-running on identity alone would
    // repaint the canvas on every unrelated store change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, s.focusId, lang, t]);

  if (!active) return null;

  const label = (tNode(lang, node, 'label') || '').replace(/\n/g, ' ');

  return (
    <div className="fixed inset-x-0 bottom-0 top-[var(--header-h)] z-[65] flex flex-col bg-map-bg">
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-map-head bg-map-panel px-[18px] py-[11px]">
        <div className="text-[15px] font-extrabold text-map-ink">
          🎯 {label}{' '}
          <span className="ml-2 text-base2 font-normal text-map-rail2">{t('focus.subtitle')}</span>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            className="cursor-pointer rounded-[7px] border-[1.5px] border-map-rail bg-transparent px-3 py-1.5 text-base2 font-bold text-map-rail2 hover:border-flow hover:text-map-ink"
            onClick={s.showOnBigMap}
          >
            {t('focus.showOnMap')}
          </button>
          <button
            className="cursor-pointer rounded-[7px] border-[1.5px] border-map-rail bg-transparent px-3 py-1.5 text-base2 font-bold text-map-rail2 hover:border-flow hover:text-map-ink"
            onClick={s.closeFocus}
          >
            {t('focus.close')}
          </button>
        </div>
      </div>

      <div className="focus-trail flex flex-shrink-0 flex-nowrap items-center gap-0.5 overflow-x-auto whitespace-nowrap border-b border-map-head bg-map-panel px-[18px] py-1.5 text-cap">
        {s.focusTrail.map((id, i) => {
          const n = NODE_INDEX[id];
          if (!n || !isLaneNode(n)) return null;
          const lab = (tNode(lang, n, 'label') || '').replace(/\n/g, ' ');
          const cur = id === s.focusId;
          return (
            <span key={id}>
              {i > 0 ? <span className="flex-shrink-0 px-px text-map-rail2">›</span> : null}
              <span
                className={
                  'whitespace-nowrap rounded-md border px-2 py-[3px] ' +
                  (cur
                    ? 'cursor-default border-transparent font-bold text-alt'
                    : 'cursor-pointer border-transparent text-map-rail2 hover:border-map-rail hover:bg-map-card hover:text-map-ink')
                }
                onClick={() => s.openFocus(n)}
              >
                {lab}
              </span>
            </span>
          );
        })}
      </div>

      <div className="focus-scroll relative flex-1 overflow-auto pr-sidebar">
        <div className="relative" id="focusCanvas" />
      </div>

      <div className="flex-shrink-0 border-t border-map-head bg-map-panel px-[18px] py-1.5 text-nano text-map-rail2">
        {t('focus.hint')}
      </div>
    </div>
  );
}
