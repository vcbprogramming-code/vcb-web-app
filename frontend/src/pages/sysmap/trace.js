/**
 * ไล่เส้นทางของกล่องงานหนึ่ง (Trace / Focus) — กราฟและการวางผัง
 *
 * Port of fEdges() + the layout half of openFocus() in the client's own system
 * map (ORIGINAL CODE/system-map/Index.html, v8.86). Kept as a pure module with no
 * DOM in it: the numbers are the load-bearing part — a column is a hop away from
 * the focused box, and the cap of five hops each way is what makes the picture
 * readable at all — so they are testable on their own, and <FocusTrace/> only
 * paints what comes back.
 *
 * Two things here are easy to get wrong and are the reason this is a port rather
 * than a rewrite:
 *
 *  1. THE GRAPH IS NOT `conns`. Their trace walks the lane sequence too: inside a
 *     lane, each box feeds the next one to its right, and only a `standalone` box
 *     is exempt. Our 129 rows in sysmap_conns are the CROSS-lane edges alone, so
 *     tracing them by themselves loses the main line of the process — the very
 *     thing a reader opens this for. Deriving the lane edges here (never storing
 *     them) also keeps /sysmap/bootstrap's shape untouched for the other screens.
 *
 *  2. A FEEDBACK EDGE IS NOT A PATH. `feedback` rows are drawn — dashed, going
 *     back the way they came — but they never advance a hop, or "ส่งกลับแก้ไข"
 *     would make almost every box five hops from every other and the trace would
 *     come back as the whole map.
 */

/**
 * Both adjacency lists plus the undirected set of every drawable pair.
 *
 * `rank` orders each box's successors so the main line sits above the branches:
 * 0 = the lane sequence and the direct cross edges (ทริกเกอร์ / ป้อนข้อมูล),
 * 1 = เงื่อนไข / เลื่อน, and 2 = the two roll-up boxes everything reports into
 * (n-pm-dash, n-fin), which would otherwise pull the spine towards themselves.
 */
export function traceEdges({ lanes, nodes, conns }) {
  const out = {};
  const inn = {};
  const pseen = new Set();
  const allset = new Set();
  const rank = {};
  const addPath = (a, b, r) => {
    const k = `${a}>${b}`;
    if (pseen.has(k)) return;
    pseen.add(k);
    rank[k] = r;
    (out[a] = out[a] || []).push(b);
    (inn[b] = inn[b] || []).push(a);
  };
  const addAny = (a, b) => { if (a !== b) allset.add(`${a}>${b}`); };

  // ลำดับภายในเลน — กล่องหนึ่งส่งงานต่อให้กล่องถัดไปทางขวา ยกเว้นกล่องที่ตั้งเดี่ยว
  const byLane = new Map(lanes.map((l) => [l.id, []]));
  for (const n of nodes) if (byLane.has(n.lane_id)) byLane.get(n.lane_id).push(n);
  for (const arr of byLane.values()) arr.sort((a, b) => a.sort_order - b.sort_order);
  for (const l of lanes) {
    const ns = byLane.get(l.id) || [];
    for (let i = 0; i < ns.length - 1; i += 1) {
      if (!ns[i].standalone && !ns[i + 1].standalone) {
        addPath(ns[i].id, ns[i + 1].id, 0);
        addAny(ns[i].id, ns[i + 1].id);
      }
    }
  }
  for (const c of conns) {
    addAny(c.from_node, c.to_node);
    if (c.feedback) continue;
    const r = (c.to_node === 'n-pm-dash' || c.to_node === 'n-fin') ? 2
      : (c.conn_type === 'conditional' || c.conn_type === 'deferred') ? 1 : 0;
    addPath(c.from_node, c.to_node, r);
  }

  const byRank = (arr, key) => arr
    .map((x, i) => [x, i])
    .sort((p, q) => (rank[key(p[0])] - rank[key(q[0])]) || (p[1] - q[1]))
    .map((p) => p[0]);
  for (const a of Object.keys(out)) out[a] = byRank(out[a], (b) => `${a}>${b}`);
  for (const b of Object.keys(inn)) inn[b] = byRank(inn[b], (a) => `${a}>${b}`);

  return { out, inn, pairs: [...allset].map((k) => k.split('>')) };
}

/** ห้าช่วงต่อข้าง — ค่าของระบบจริง ไม่ใช่ตัวเลขที่เราตั้งเอง */
export const MAX_HOPS = 5;

/** ขนาดกล่องและระยะห่าง — ตัวเลขชุดเดียวกับของเขา ผังจึงอ่านเหมือนกัน */
export const GEO = { COLW: 212, ROWH: 86, CW: 158, CH: 66, PAD: 34 };

/**
 * วางผังเชิงเส้นรอบกล่องที่กำลังไล่
 *
 * คืนค่าเป็นตัวเลขล้วน: กล่องแต่ละกล่องอยู่คอลัมน์ไหน (ระยะห่างเป็นช่วงจากกล่อง
 * ที่ไล่ ติดลบคือทางเข้า) แถวไหน พิกัดอะไร และเส้นแต่ละเส้นลากอย่างไร
 */
export function layoutTrace({ lanes, nodes, conns, focusId }) {
  const index = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const { out, inn, pairs } = traceEdges({ lanes, nodes, conns });
  const fid = focusId;
  if (!index[fid]) return null;

  const col = { [fid]: 0 };
  const seen = new Set([fid]);
  const treeSet = new Set();

  // กล่องที่ป้อนเข้ากล่องนี้ แต่ตัวมันเองก็อยู่ปลายน้ำของกล่องนี้ด้วย ให้แสดงที่
  // คอลัมน์ -1 เฉย ๆ โดยไม่กางสายของมันต่อ — ไม่งั้นวงรอบจะดันกล่องที่ไล่ไปขวาสุด
  const downReach = new Set();
  {
    let q = [fid];
    const sr = new Set([fid]);
    let dd = 0;
    while (q.length && dd < MAX_HOPS) {
      const nx = [];
      for (const id of q) for (const t of (out[id] || [])) {
        if (!sr.has(t)) { sr.add(t); downReach.add(t); nx.push(t); }
      }
      q = nx; dd += 1;
    }
  }
  const compactFeeders = new Set([...(inn[fid] || [])].filter((f) => downReach.has(f)));

  let fr = [fid];
  let d = 0;
  while (fr.length && d < MAX_HOPS) {
    const nx = [];
    for (const id of fr) for (const t of (out[id] || [])) {
      if (!seen.has(t) && !compactFeeders.has(t)) {
        seen.add(t); col[t] = col[id] + 1; nx.push(t); treeSet.add(`${id}>${t}`);
      }
    }
    fr = nx; d += 1;
  }
  let frU = [fid];
  d = 0;
  const seenU = new Set([fid]);
  while (frU.length && d < MAX_HOPS) {
    const nx = [];
    for (const id of frU) for (const sc of (inn[id] || [])) {
      if (!seen.has(sc) && !seenU.has(sc)) {
        seenU.add(sc); col[sc] = col[id] - 1; treeSet.add(`${sc}>${id}`);
        if (!compactFeeders.has(sc)) nx.push(sc);
      }
    }
    frU = nx; d += 1;
  }

  const feedbackSet = new Set(conns.filter((c) => c.feedback).map((c) => `${c.from_node}>${c.to_node}`));
  const condSet = new Set(conns
    .filter((c) => !c.feedback && (c.conn_type === 'conditional' || c.conn_type === 'deferred'))
    .map((c) => `${c.from_node}>${c.to_node}`));

  const rendered = [...new Set([...seen, ...seenU])].filter((id) => index[id]);
  const byCol = {};
  for (const id of rendered) (byCol[col[id]] = byCol[col[id]] || []).push(id);
  const cols = Object.keys(byCol).map(Number).sort((a, b) => a - b);

  const { COLW, ROWH, CW, CH, PAD } = GEO;
  const GAP = COLW - CW;
  const ciOf = {};
  cols.forEach((c, ci) => byCol[c].forEach((id) => { ciOf[id] = ci; }));

  const drawPairs = pairs.filter(([a, b]) => ciOf[a] !== undefined && ciOf[b] !== undefined
    && (treeSet.has(`${a}>${b}`) || feedbackSet.has(`${a}>${b}`)));
  const nFb = drawPairs.filter(([a, b]) => feedbackSet.has(`${a}>${b}`)
    && Math.abs(ciOf[a] - ciOf[b]) !== 1).length;
  // แถบว่างด้านบนให้เส้นย้อนกลับที่ต้องอ้อมข้ามหลายคอลัมน์เดินได้ ไม่ทับหัวกล่อง
  const TOPBAND = nFb ? Math.min(nFb, 6) * 9 + 22 : 0;

  // ต้นไม้ — กล่องที่อยู่ใกล้กล่องที่ไล่กว่าเป็นพ่อ ไม่ว่าเส้นจะชี้ทางไหน
  const childrenOf = {};
  for (const k of treeSet) {
    const j = k.indexOf('>');
    const a = k.slice(0, j);
    const b = k.slice(j + 1);
    if (col[a] === undefined || col[b] === undefined) continue;
    const par = Math.abs(col[a]) <= Math.abs(col[b]) ? a : b;
    const ch = par === a ? b : a;
    (childrenOf[par] = childrenOf[par] || []).push(ch);
  }

  // สันหลัง — กล่องที่ไล่ กับสายปลายน้ำสายแรกและสายต้นน้ำสายแรก อยู่แถว 0 ทั้งหมด
  // เพื่อให้ A → กล่องที่ไล่ → C อ่านเป็นเส้นตรง ไม่ใช่ขั้นบันได
  const spine = new Set([fid]);
  for (let c = fid; ;) {
    const nx = (childrenOf[c] || []).find((k) => col[k] > col[c]);
    if (nx === undefined || spine.has(nx)) break;
    spine.add(nx); c = nx;
  }
  for (let c = fid; ;) {
    const nx = (childrenOf[c] || []).find((k) => col[k] < col[c]);
    if (nx === undefined || spine.has(nx)) break;
    spine.add(nx); c = nx;
  }

  // จัดแถวแบบกินที่ต่ำสุดในคอลัมน์ของตัวเอง แต่ไม่สูงกว่าแถวของพ่อ — กล่องปลายทาง
  // จึงแนบใต้พ่อของมัน ไม่จองแถบแถวลึก ๆ ทิ้งไว้
  const rowOf = {};
  const occ = {};
  const put = (id, r) => {
    rowOf[id] = r;
    (occ[ciOf[id]] = occ[ciOf[id]] || new Set()).add(r);
  };
  for (const id of spine) put(id, 0);
  const bfs = [fid];
  const vis = new Set([fid]);
  for (let i = 0; i < bfs.length; i += 1) {
    for (const ch of (childrenOf[bfs[i]] || [])) if (!vis.has(ch)) { vis.add(ch); bfs.push(ch); }
  }
  for (const n of bfs) {
    for (const ch of (childrenOf[n] || [])) {
      if (rowOf[ch] !== undefined) continue;
      const used = (occ[ciOf[ch]] = occ[ciOf[ch]] || new Set());
      let r = rowOf[n] || 0;
      while (used.has(r)) r += 1;
      put(ch, r);
    }
  }
  for (const id of rendered) {
    if (rowOf[id] !== undefined) continue;
    const used = (occ[ciOf[id]] = occ[ciOf[id]] || new Set());
    let r = 0;
    while (used.has(r)) r += 1;
    put(id, r);
  }

  const pos = {};
  for (const id of rendered) {
    pos[id] = { x: PAD + ciOf[id] * COLW, y: PAD + TOPBAND + rowOf[id] * ROWH };
  }
  const maxRows = Math.max(1, ...Object.values(rowOf).map((r) => r + 1));
  const W = PAD * 2 + (cols.length - 1) * COLW + CW;
  const H = PAD + TOPBAND + (maxRows - 1) * ROWH + CH + PAD + 10;

  // เลนเดินเส้นในช่องว่างระหว่างคอลัมน์ — เส้นตรงกับเส้นเงื่อนไขที่ออกจาก
  // คอลัมน์เดียวกันแยกเลนกัน ไม่ทับกันเป็นเส้นเดียว
  const typeByGap = {};
  for (const [a, b] of drawPairs) {
    if (feedbackSet.has(`${a}>${b}`) || !pos[a] || !pos[b]) continue;
    if (Math.abs(pos[a].y - pos[b].y) < 3) continue;
    const g = ciOf[a];
    const ty = condSet.has(`${a}>${b}`) ? 'i' : 'd';
    (typeByGap[g] = typeByGap[g] || new Set()).add(ty);
  }
  const laneFrac = {};
  for (const gk of Object.keys(typeByGap)) {
    const arr = [...typeByGap[gk]].sort();
    arr.forEach((ty, i) => { laneFrac[`${gk}|${ty}`] = (i + 1) / (arr.length + 1); });
  }

  let fbN = 0;
  const edges = [];
  for (const [a, b] of drawPairs) {
    if (!pos[a] || !pos[b]) continue;
    const hot = a === fid || b === fid;
    const ax = pos[a].x; const ay = pos[a].y; const bx = pos[b].x; const by = pos[b].y;
    const r = 8;
    const fb = feedbackSet.has(`${a}>${b}`);
    const cond = condSet.has(`${a}>${b}`);
    let path;
    if (!fb) {
      const x1 = ax + CW; const y1 = ay + CH / 2; const x2 = bx; const y2 = by + CH / 2;
      const f = laneFrac[`${ciOf[a]}|${cond ? 'i' : 'd'}`];
      let vx = x1 + (f !== undefined ? GAP * f : GAP / 2);
      vx = Math.max(x1 + r + 2, Math.min(x2 - r - 2, vx));
      const sg = y2 > y1 ? 1 : -1;
      path = Math.abs(y2 - y1) < 3
        ? `M${x1},${y1} H${x2}`
        : `M${x1},${y1} H${vx - r} Q${vx},${y1} ${vx},${y1 + sg * r} V${y2 - sg * r} Q${vx},${y2} ${vx + r},${y2} H${x2}`;
    } else {
      const above = by < ay;
      const sy = above ? ay : ay + CH;
      const ty = above ? by + CH : by;
      const sx = ax + CW / 2; const tx = bx + CW / 2;
      const toLeft = bx <= ax;
      const sameCol = Math.abs(ax - bx) < 2;
      const adjacent = Math.abs(ay - by) <= ROWH * 1.3;
      if (sameCol) {
        fbN += 1;
        path = `M${sx},${sy} L${tx},${ty}`;
      } else if (adjacent) {
        fbN += 1;
        if (Math.abs(ay - by) < 3) {
          const yb = Math.max(ay, by) + CH + 12;
          path = `M${sx},${ay + CH} V${yb} H${tx} V${by + CH}`;
        } else {
          const ymid = (sy + ty) / 2;
          path = `M${sx},${sy} V${ymid} H${tx} V${ty}`;
        }
      } else {
        const gx = (toLeft ? ax - GAP / 2 : ax + CW + GAP / 2) + (toLeft ? -8 : 8) + (fbN % 2 ? 3 : -3);
        const yb1 = above ? sy - 12 : sy + 12;
        const yb2 = above ? ty + 12 : ty - 12;
        fbN += 1;
        path = `M${sx},${sy} V${yb1} H${gx} V${yb2} H${tx} V${ty}`;
      }
    }
    edges.push({ a, b, d: path, hot, fb, cond, width: fb ? 1.8 : (hot ? 2.3 : 1.6) });
  }

  const boxes = rendered.map((id) => ({
    id,
    node: index[id],
    hop: col[id],
    colIndex: ciOf[id],
    row: rowOf[id],
    x: pos[id].x,
    y: pos[id].y,
    isFocus: id === fid,
  })).sort((p, q) => (p.colIndex - q.colIndex) || (p.row - q.row));

  return {
    focusId: fid,
    boxes,
    edges,
    W,
    H,
    colCount: cols.length,
    /** ช่วงที่ไกลสุดทางเข้าและทางออก — ใช้บอกว่าเส้นทางตันด้านไหน */
    minHop: cols.length ? cols[0] : 0,
    maxHop: cols.length ? cols[cols.length - 1] : 0,
    /** กล่องที่ไม่มีเส้นเชื่อมเข้าหรือออกเลย — ไล่ต่อไม่ได้ */
    isolated: boxes.length <= 1,
  };
}

/**
 * ประวัติการกด (breadcrumb) — เก็บเจ็ดขั้นล่าสุด
 *
 * ของเขาไม่ใช่กองซ้อน (stack) แต่เป็นลำดับตามเวลาที่กด: กดกล่องที่เคยอยู่ในแถว
 * แล้ว มันจะถูกย้ายมาไว้ท้ายสุด ไม่ใช่ตัดแถวที่เหลือทิ้ง ขั้นขวาสุดคือกล่องที่
 * กำลังไล่อยู่เสมอ พอร์ตตามนั้น ไม่แก้ให้เป็น stack เพราะสองระบบอ่านคู่กันในที่ประชุม
 */
export const TRAIL_MAX = 7;
export function pushTrail(trail, id) {
  const next = trail.filter((x) => x !== id);
  next.push(id);
  return next.length > TRAIL_MAX ? next.slice(-TRAIL_MAX) : next;
}
