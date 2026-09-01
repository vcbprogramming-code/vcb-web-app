/** Derived lookup structures built once from the data layer.
 *  Mirrors NODE_INDEX / CONN_FROM / CONN_TO in the canonical Index.html <script>.
 *
 *  Two node shapes flow through here:
 *    lane node — { id, type:'erp'|'manual', dept, label, sub, desc, module,
 *                  items[], unverified, dept2?, loc?, standalone?, routes? }
 *    doc node  — { id, code, dept, label, sub, desc, erp_style, erp_label, items[] }
 *  isLaneNode() below is the discriminator; a doc node has no `type`.
 */
import { LANES, DOC_NODES, CROSS_CONNS } from '../data/index.js';

// Build a flat node index (LANES nodes + DOC_NODES)
export const NODE_INDEX = {};
LANES.forEach((lane) => lane.nodes.forEach((n) => (NODE_INDEX[n.id] = n)));
DOC_NODES.forEach((n) => (NODE_INDEX[n.id] = n));

// Build adjacency from CROSS_CONNS
export const CONN_FROM = {};
export const CONN_TO = {};
CROSS_CONNS.forEach((c) => {
  if (!CONN_FROM[c.from]) CONN_FROM[c.from] = [];
  if (!CONN_TO[c.to]) CONN_TO[c.to] = [];
  CONN_FROM[c.from].push(c);
  CONN_TO[c.to].push(c);
});

export function isLaneNode(n) {
  return n?.type === 'erp' || n?.type === 'manual';
}

/** A doc node is the one carrying a document `code`. */
export function isDocNode(n) {
  return typeof n?.code === 'string';
}
