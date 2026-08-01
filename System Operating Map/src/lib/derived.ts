/** Derived lookup structures built once from the data layer.
 *  Mirrors NODE_INDEX / CONN_FROM / CONN_TO in the canonical Index.html <script>.
 */
import { LANES, DOC_NODES, CROSS_CONNS } from '../data';
import type { LaneNode, DocNode, CrossConn } from '../data/types';

export type AnyNode = LaneNode | DocNode;

// Build a flat node index (LANES nodes + DOC_NODES)
export const NODE_INDEX: Record<string, AnyNode> = {};
LANES.forEach((lane) => lane.nodes.forEach((n) => (NODE_INDEX[n.id] = n)));
DOC_NODES.forEach((n) => (NODE_INDEX[n.id] = n));

// Build adjacency from CROSS_CONNS
export const CONN_FROM: Record<string, CrossConn[]> = {};
export const CONN_TO: Record<string, CrossConn[]> = {};
CROSS_CONNS.forEach((c) => {
  if (!CONN_FROM[c.from]) CONN_FROM[c.from] = [];
  if (!CONN_TO[c.to]) CONN_TO[c.to] = [];
  CONN_FROM[c.from].push(c);
  CONN_TO[c.to].push(c);
});

export function isLaneNode(n: AnyNode): n is LaneNode {
  return (n as LaneNode).type === 'erp' || (n as LaneNode).type === 'manual';
}
