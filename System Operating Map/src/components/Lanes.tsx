/** Swimlane + node rendering. Mirrors renderLanes() / buildNode() in Index.html.
 *  DOM structure (ids, classes) matches the original 1:1 so styles.css (verbatim
 *  extract) applies unchanged and SvgEdges' getBoundingClientRect() measurement
 *  keeps working the same way.
 */
import type { Store } from '../store';
import { LANES, DEPTS, AI_OPPS, CROSS_CONNS } from '../data';
import type { LaneNode } from '../data/types';
import { CONN_FROM, CONN_TO } from '../lib/derived';
import { tLane, tNode } from '../lib/i18n';

const MANUAL_FONT_COLOR: Record<string, string> = { asset: '#607D8B', hr: '#5C6BC0', fin: '#AB47BC' };

// terminal nodes: last ERP node in each lane with no outgoing cross-connection
const crossFromSet = new Set(CROSS_CONNS.map((c) => c.from));
const terminalIds = new Set<string>();
LANES.forEach((lane) => {
  const erpNodes = lane.nodes.filter((n) => n.type === 'erp');
  if (erpNodes.length > 0) {
    const last = erpNodes[erpNodes.length - 1];
    if (!crossFromSet.has(last.id)) terminalIds.add(last.id);
  }
});

/** Mirrors highlightConnections(nodeId): nodes directly linked to the selection
 *  (via CONN_FROM/CONN_TO) get "highlighted"; everything else gets "dimmed".
 *  Only applies while a LANES/DOC node is selected (not during dept/layer filters). */
export function connectedSet(nodeId: string | null): Set<string> | null {
  if (!nodeId) return null;
  const connected = new Set<string>([nodeId]);
  const outs = CONN_FROM[nodeId] || [];
  const ins = CONN_TO[nodeId] || [];
  [...outs, ...ins].forEach((c) => {
    connected.add(c.from);
    connected.add(c.to);
  });
  return connected;
}

function NodeBox({ node, s, connected }: { node: LaneNode; s: Store; connected: Set<string> | null }) {
  const dept = DEPTS[node.dept] || ({ color: '#334155', name: node.dept } as any);
  const isErp = node.type === 'erp';
  const aiOpp = AI_OPPS[node.id];
  const hasConn = (CONN_FROM[node.id] || []).length + (CONN_TO[node.id] || []).length > 0;
  const dept2 = node.dept2 ? DEPTS[node.dept2] : null;

  const isSelected = s.selectedNodeId === node.id;
  const isHighlighted = connected ? connected.has(node.id) && !isSelected : false;
  const isDimmed = connected ? !connected.has(node.id) : false;

  const classes = [
    'node',
    isErp ? 'node-erp' : 'node-manual',
    isSelected ? 'selected' : '',
    isHighlighted ? 'highlighted' : '',
    isDimmed ? 'dimmed' : '',
    terminalIds.has(node.id) ? 'node-terminal' : '',
    aiOpp ? 'ai-opp' : '',
    node.loc === 'site' ? 'node-site' : '',
    s.activeDept && node.dept === s.activeDept ? 'dept-show' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const style: React.CSSProperties = isErp
    ? { background: dept.color }
    : { borderColor: dept.color, color: MANUAL_FONT_COLOR[node.dept] || dept.color };

  return (
    <div
      id={node.id}
      className={classes}
      data-dept={node.dept}
      style={style}
      onClick={() => (s.focusArmed ? s.openFocus(node) : s.selectNode(node))}
    >
      {isErp ? (
        <>
          <div className="node-type-badge">ERP</div>
          <div className="node-label">{tNode(s.lang, node, 'label')}</div>
          {tNode(s.lang, node, 'sub') ? <div className="node-sub">{tNode(s.lang, node, 'sub')}</div> : null}
        </>
      ) : (
        <>
          <div className="node-type-badge">✏️</div>
          <div className="node-label">{tNode(s.lang, node, 'label')}</div>
        </>
      )}
      {aiOpp ? <div className="ai-badge">🤖 AI</div> : null}
      {hasConn ? <div className="conn-dot" /> : null}
      {dept2 ? (
        <div
          className="node-dept2"
          style={{ background: dept2.color }}
          title={'Also: ' + (dept2.name || node.dept2) + ' (supports / checks)'}
        />
      ) : null}
      {node.loc === 'site' ? (
        <div className="node-loc" title="Done at the site (location)">
          📍
        </div>
      ) : null}
      {node.unverified ? (
        <div className="node-verify" title="Indicative — to be confirmed with the team">
          ⚠
        </div>
      ) : null}
    </div>
  );
}

export default function Lanes({ s, focusStageLaneIds }: { s: Store; focusStageLaneIds: Set<string> | null }) {
  // Mirrors highlightConnections(nodeId): only active while a node is selected
  // and the focus/trace layer is NOT showing (that has its own dedicated view).
  const connected = !s.focusShow ? connectedSet(s.selectedNodeId) : null;
  return (
    <div className={'lanes-wrap' + (s.activeDept ? ' dept-active' : '')} id="lanesWrap">
      {LANES.map((lane) => (
        <div
          className={'lane' + (focusStageLaneIds && !focusStageLaneIds.has(lane.id) ? ' lane-dim' : '')}
          id={lane.id}
          key={lane.id}
        >
          <div className="lane-label">{tLane(s.lang, lane)}</div>
          <div className="lane-nodes">
            {lane.nodes.map((node, i) => (
              <FragmentNode
                key={node.id}
                node={node}
                prev={i > 0 ? lane.nodes[i - 1] : null}
                s={s}
                connected={connected}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FragmentNode({
  node,
  prev,
  s,
  connected,
}: {
  node: LaneNode;
  prev: LaneNode | null;
  s: Store;
  connected: Set<string> | null;
}) {
  const isConnected = prev !== null && !node.standalone && !prev.standalone;
  return (
    <>
      {prev !== null ? <div className="lane-arrow">{isConnected ? '›' : ''}</div> : null}
      <NodeBox node={node} s={s} connected={connected} />
    </>
  );
}
