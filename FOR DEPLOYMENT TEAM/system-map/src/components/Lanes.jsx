/** Swimlane + node rendering — the map itself.
 *
 *  The marker classes (.node, .node-erp, .node-manual, .dept-show, .ai-opp,
 *  .lanes-wrap, .dept-active, .conn-dot, .node-terminal) are NOT decoration and
 *  must stay: index.css's cross-tree body-class filters select on them, and
 *  SvgEdges reads them off the DOM to decide which connectors to dim. Visual
 *  styling is Tailwind utilities alongside them.
 */
import { useI18n } from '@vcb/shared';
import { useStore } from '../store.jsx';
import { LANES, DEPTS, AI_OPPS, CROSS_CONNS } from '../data/index.js';
import { CONN_FROM, CONN_TO } from '../lib/derived.js';
import { tLane, tNode, tDept } from '../lib/mapLang.js';

const MANUAL_FONT_COLOR = { asset: '#607D8B', hr: '#5C6BC0', fin: '#AB47BC' };

// Terminal nodes: the last ERP node in each lane with no outgoing cross-connection.
const crossFromSet = new Set(CROSS_CONNS.map((c) => c.from));
const terminalIds = new Set();
LANES.forEach((lane) => {
  const erpNodes = lane.nodes.filter((n) => n.type === 'erp');
  if (erpNodes.length > 0) {
    const last = erpNodes[erpNodes.length - 1];
    if (!crossFromSet.has(last.id)) terminalIds.add(last.id);
  }
});

/** Nodes directly linked to the selection get highlighted; everything else is
 *  dimmed. Only applies while a node is selected (not during dept/layer filters). */
export function connectedSet(nodeId) {
  if (!nodeId) return null;
  const connected = new Set([nodeId]);
  const outs = CONN_FROM[nodeId] || [];
  const ins = CONN_TO[nodeId] || [];
  [...outs, ...ins].forEach((c) => {
    connected.add(c.from);
    connected.add(c.to);
  });
  return connected;
}

const NODE_BASE =
  'node relative z-[3] flex h-nodeh w-node flex-shrink-0 cursor-pointer flex-col items-center ' +
  'justify-center overflow-hidden rounded-[10px] px-2.5 pb-2.5 pt-[18px] text-center ' +
  'transition-[transform,box-shadow,opacity] duration-150 hover:z-10 hover:-translate-y-0.5';

function NodeBox({ node, connected }) {
  const s = useStore();
  const { t, lang } = useI18n();

  const dept = DEPTS[node.dept] || { color: '#334155', name: node.dept, icon: '' };
  const isErp = node.type === 'erp';
  const aiOpp = AI_OPPS[node.id];
  const hasConn = (CONN_FROM[node.id] || []).length + (CONN_TO[node.id] || []).length > 0;
  const dept2 = node.dept2 ? DEPTS[node.dept2] : null;

  const isSelected = s.selectedNodeId === node.id;
  const isHighlighted = connected ? connected.has(node.id) && !isSelected : false;
  const isDimmed = connected ? !connected.has(node.id) : false;

  const classes = [
    NODE_BASE,
    isErp
      ? 'node-erp border-t-[3px] border-white/20 shadow-node'
      : 'node-manual border-2 border-dashed bg-map-manual',
    isSelected ? 'selected z-20 outline outline-[3px] outline-offset-2 outline-white' : '',
    isHighlighted ? 'highlighted z-20 outline outline-[3px] outline-offset-2 outline-alt' : '',
    isDimmed ? 'dimmed pointer-events-none opacity-[.18] grayscale-[.7]' : '',
    terminalIds.has(node.id) ? 'node-terminal' : '',
    aiOpp ? 'ai-opp' : '',
    node.loc === 'site' ? 'node-site' : '',
    s.activeDept && node.dept === s.activeDept ? 'dept-show' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const style = isErp
    ? { background: dept.color }
    : { borderColor: dept.color, color: MANUAL_FONT_COLOR[node.dept] || dept.color };

  const label = tNode(lang, node, 'label');
  const sub = tNode(lang, node, 'sub');

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
          <div className="absolute right-[5px] top-1 text-micro font-extrabold tracking-[.06em] text-white/40">
            {t('node.erpBadge')}
          </div>
          <div className="w-full whitespace-pre-line break-words text-base2 font-bold leading-[1.4] text-white">
            {label}
          </div>
          {sub ? (
            <div className="mt-[5px] max-w-[155px] break-words text-2xs leading-[1.35] text-white/60">
              {sub}
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="absolute right-[5px] top-1 text-3xs opacity-40">✏️</div>
          <div className="whitespace-pre-line break-words text-base2 font-extrabold leading-[1.4] text-inherit">
            {label}
          </div>
        </>
      )}

      {aiOpp ? <div className="ai-badge">{t('ai.badge')}</div> : null}

      {hasConn ? (
        <div className="conn-dot pointer-events-none absolute left-[-7px] top-1/2 z-[5] h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-map-bg bg-flow opacity-[.55] transition-[opacity,transform] duration-150" />
      ) : null}

      {dept2 ? (
        <div
          className="pointer-events-none absolute left-[5px] top-[5px] z-[6] h-[11px] w-[11px] rounded-full border-2 border-black/50 shadow-[0_0_0_1px_rgba(255,255,255,.35)]"
          style={{ background: dept2.color }}
          title={t('node.alsoDept', { name: tDept(lang, node.dept2, dept2.name || node.dept2) })}
        />
      ) : null}

      {node.loc === 'site' ? (
        <div
          className="pointer-events-none absolute bottom-[3px] right-[5px] z-[6] text-3xs opacity-75"
          title={t('node.atSiteTitle')}
        >
          📍
        </div>
      ) : null}

      {node.unverified ? (
        <div
          className="pointer-events-none absolute bottom-[3px] left-1.5 z-[6] text-3xs opacity-[.85]"
          title={t('node.unverifiedTitle')}
        >
          ⚠
        </div>
      ) : null}
    </div>
  );
}

export default function Lanes({ focusStageLaneIds }) {
  const s = useStore();
  const { lang } = useI18n();

  // Only active while a node is selected and the trace overlay is NOT showing
  // (that view does its own highlighting).
  const connected = !s.focusShow ? connectedSet(s.selectedNodeId) : null;

  return (
    <div
      className={
        'lanes-wrap relative flex min-w-max flex-col gap-4 ' +
        (s.activeDept ? 'dept-active' : '')
      }
      id="lanesWrap"
    >
      {LANES.map((lane) => (
        <div
          className={
            'flex min-h-[120px] items-start transition-[opacity,filter] duration-300 ' +
            (focusStageLaneIds && !focusStageLaneIds.has(lane.id)
              ? 'pointer-events-none opacity-10 grayscale-[.7]'
              : '')
          }
          id={lane.id}
          key={lane.id}
        >
          <div className="w-lane flex-shrink-0 whitespace-pre-line border-r-2 border-map-head pr-3.5 pt-4 text-right text-tiny font-bold uppercase leading-[1.45] tracking-[.06em] text-slate-500">
            {tLane(lang, lane)}
          </div>
          <div className="flex flex-nowrap items-center px-4 py-2">
            {lane.nodes.map((node, i) => {
              const prev = i > 0 ? lane.nodes[i - 1] : null;
              const isConnected = prev !== null && !node.standalone && !prev.standalone;
              return (
                <div className="contents" key={node.id}>
                  {prev !== null ? (
                    <div className="flex w-6 flex-shrink-0 items-center justify-center text-flow">
                      {/* Drawn, not typed. The original sets Segoe UI on the
                          body, where "›" renders as a solid arrowhead; this port
                          uses Sarabun (it has to, for Thai), whose "›" is a thin
                          chevron. Same character, quarter the ink — the arrows
                          between boxes all but vanished. An SVG looks the same
                          in any font. */}
                      {isConnected ? (
                        <svg viewBox="0 0 24 14" width="24" height="14" aria-hidden="true">
                          <line x1="0" y1="7" x2="15" y2="7" stroke="currentColor" strokeWidth="3" />
                          <path d="M13 1 L23 7 L13 13 Z" fill="currentColor" />
                        </svg>
                      ) : null}
                    </div>
                  ) : null}
                  <NodeBox node={node} connected={connected} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
