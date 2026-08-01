/** Right sidebar — node detail (Steps/Tasks, Connections, AI Opps tabs) and the
 *  doc-node variant (About / ERP Routing / Document Types tabs). Mirrors
 *  showSidebar()/buildConnectionsPane()/showDocSidebar()/closeSidebar() in
 *  Index.html.
 */
import type { Store, SbTab, DocTab } from '../store';
import { DEPTS, MODULES, AI_OPPS, LANG_TH, DOC_NODES, FUNCTION_REGISTRY, NODE_FN, FUNCTION_AI } from '../data';
import type { LaneNode, DocNode } from '../data/types';
import { CONN_FROM, CONN_TO, NODE_INDEX, isLaneNode } from '../lib/derived';
import { tNode, tUI, esc } from '../lib/i18n';

function isDocNode(n: any): n is DocNode {
  return typeof n?.code === 'string';
}

export default function Sidebar({ s }: { s: Store }) {
  const node = s.selectedNode;
  const open = !!node;
  return (
    <div className={'sidebar' + (open ? '' : ' closed')} id="sidebar">
      <div className="sb-empty" id="sbEmpty" style={{ display: open ? 'none' : undefined }}>
        <div className="sb-empty-icon">🗺️</div>
        <div className="sb-empty-title">Click any node</div>
        <div className="sb-empty-hint">
          ERP steps show module detail and connections.
          <br />
          Manual gaps show the work that bridges ERP steps.
        </div>
      </div>
      <div className={'sb-content' + (open ? ' visible' : '')} id="sbContent">
        {node && isDocNode(node) ? <DocSidebarBody node={node} s={s} /> : node ? <NodeSidebarBody node={node as LaneNode} s={s} /> : null}
      </div>
    </div>
  );
}

function NodeSidebarBody({ node, s }: { node: LaneNode; s: Store }) {
  const dept = DEPTS[node.dept] || ({ color: '#334155', name: node.dept, icon: '' } as any);
  const mod = node.module ? MODULES[node.module] : null;
  const aiOpp = AI_OPPS[node.id];
  const isTh = s.lang === 'th';
  const L = LANG_TH.ui;
  const sw = isTh ? (L.stepsHeader as string) || 'ขั้นตอน' : 'Steps';
  const tw = isTh ? (L.tasks as string) || 'งาน' : 'Tasks';
  const cw = isTh ? (L.connsLabel as string) || 'การเชื่อมต่อ' : 'Connections';

  const tabs: { id: SbTab; label: string }[] = [
    { id: 'tasks', label: node.type === 'erp' ? `${sw} (${node.items.length})` : `${tw} (${node.items.length})` },
    { id: 'conns', label: cw },
  ];
  if (aiOpp) tabs.push({ id: 'ai', label: isTh ? (L.aiTab as string) || '🤖 โอกาส AI' : '🤖 AI Opps' });

  const activeTab = tabs.find((t) => t.id === s.sbTab) ? s.sbTab : 'tasks';

  return (
    <>
      <div className="sb-dept-bar" id="sbDeptBar" style={{ background: dept.color + '22', borderBottom: `2px solid ${dept.color}44` }}>
        <div>
          <div id="sbTitle" style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
            {tNode(s.lang, node, 'label')}
          </div>
          <div id="sbSub" style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {mod ? mod.name : node.sub || ''}
          </div>
        </div>
        <button className="close-btn" id="btn-trace" onClick={s.traceCurrent} title="Toggle trace / map" style={{ marginRight: 6 }}>
          {s.focusShow ? '↩ Back to Map' : '⤢ Trace'}
        </button>
        <button className="close-btn" onClick={s.closeSidebar}>
          ✕ Close
        </button>
      </div>
      <div className="sb-tags" id="sbTags">
        <span className={'sb-tag ' + (node.type === 'erp' ? 'tag-erp' : 'tag-manual')}>
          {node.type === 'erp' ? 'ERP Step' : 'Manual Work'}
        </span>
        {node.module ? <span className="sb-tag tag-mod">Module: {node.module}</span> : null}
        <span className="sb-tag tag-dept" style={{ background: dept.color }}>
          {dept.icon} {dept.name}
        </span>
        {node.dept2
          ? (() => {
              const d2 = DEPTS[node.dept2] || ({ color: '#94a3b8', name: node.dept2, icon: '' } as any);
              return (
                <span className="sb-tag tag-dept" style={{ background: d2.color }}>
                  {d2.icon || ''} {d2.name} (supports/checks)
                </span>
              );
            })()
          : null}
        {node.loc === 'site' ? (
          <span className="sb-tag tag-dept" style={{ background: '#E65100' }}>
            📍 Done at site
          </span>
        ) : null}
        <span className="sb-tag tag-dept" style={{ background: node.unverified ? '#b45309' : '#15803d' }}>
          {node.unverified ? '⚠ To confirm' : '✓ Verified'}
        </span>
      </div>
      <div className="sb-tabs" id="sbTabs">
        {tabs.map((t) => (
          <button key={t.id} className={'sb-tab' + (activeTab === t.id ? ' active' : '')} onClick={() => s.setSbTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="sb-body" id="sbBody">
        {activeTab === 'tasks' ? <TasksPane node={node} s={s} dept={dept} mod={mod} /> : null}
        {activeTab === 'conns' ? <ConnectionsPane node={node} s={s} /> : null}
        {activeTab === 'ai' && aiOpp ? <AiPane aiOpp={aiOpp} /> : null}
      </div>
    </>
  );
}

function TasksPane({ node, s, dept, mod }: { node: LaneNode; s: Store; dept: any; mod: any }) {
  const isTh = s.lang === 'th';
  const thNodeData = LANG_TH.nodes[node.id] || {};
  let descText: string;
  if (node.type === 'erp' && mod) {
    descText = isTh && thNodeData.desc ? thNodeData.desc : node.desc || mod.purpose || '';
  } else {
    descText = tNode(s.lang, node, 'desc') || '';
  }
  const Lc = LANG_TH.ui;
  const dLn = isTh && LANG_TH.depts ? (LANG_TH.depts as any)[node.dept] || dept.name : dept.name;
  const items = tNode(s.lang, node, 'items') || node.items;

  // RELATED functions + forms
  const flat = Object.values(FUNCTION_REGISTRY).flat();
  const map = NODE_FN[node.id];
  const regFns = map ? (map.map((cd) => flat.find((f) => f[0] === cd)).filter(Boolean) as typeof flat) : FUNCTION_REGISTRY[node.dept] || [];
  const forms = DOC_NODES.filter((d) => d.dept === node.dept);

  return (
    <div className="pane" id="pane-tasks">
      <p className="sb-desc" dangerouslySetInnerHTML={{ __html: esc(descText) }} />
      {node.type === 'erp' && mod ? (
        <>
          <div className="info-grid">
            <div className="info-card">
              <div className="info-card-label">{isTh ? (Lc.moduleCard as string) || 'โมดูล' : 'Module'}</div>
              <div className="info-card-value">{node.module}</div>
            </div>
            <div className="info-card">
              <div className="info-card-label">{isTh ? (Lc.deptCard as string) || 'แผนก' : 'Department'}</div>
              <div className="info-card-value">{dLn}</div>
            </div>
          </div>
          <div className="section-title" style={{ marginBottom: 9 }}>
            {isTh ? (Lc.stepsHeader as string) || 'ขั้นตอน' : 'Steps'}
          </div>
        </>
      ) : null}
      {items && items.length ? (
        <ul className="task-list">
          {items.map((item, i) => (
            <li className="task-item" key={i}>
              <div className="task-num" style={{ background: dept.color }}>
                {i + 1}
              </div>
              <div dangerouslySetInnerHTML={{ __html: esc(item) }} />
            </li>
          ))}
        </ul>
      ) : null}
      {node.routes && node.routes.length ? (
        <>
          <div className="section-title" style={{ marginTop: 14 }}>
            {isTh
              ? 'ประเภทย่อยของรายการ OF เดียวกันนี้ (แสดงในแผง ไม่ใช่กล่องแยก)'
              : 'Type options of this one OF transaction (sidebar — not separate boxes)'}
          </div>
          {node.routes.map((r, i) => (
            <div className="route-card" key={i}>
              <div className="route-name">{r.n}</div>
              <div className="route-desc">{r.d}</div>
            </div>
          ))}
        </>
      ) : null}
      {regFns.length ? (
        <>
          <div className="section-title" style={{ marginTop: 14 }}>
            {isTh ? 'หน้าที่ที่เกี่ยวข้อง' : 'Related functions'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {regFns.map((f) => {
              const aiO = FUNCTION_AI[f[0]];
              return (
                <span
                  key={f[0]}
                  className="sb-tag sb-tag-fn"
                  role="button"
                  style={{ background: aiO ? '#0c4a6e' : '#1e293b', color: aiO ? '#bae6fd' : '#cbd5e1', fontWeight: 700, cursor: 'pointer' }}
                  title={
                    (aiO ? `${f[1]} — AI: ${isTh && aiO.th ? aiO.th : aiO.en}` : f[1]) +
                    (isTh ? ' · คลิกเพื่อเปิดในทะเบียนหน้าที่' : ' · click to open in Function Registry')
                  }
                  onClick={() => s.openRegistryToFunction(f[0])}
                >
                  {f[0]}
                  {aiO ? ' ✨' : ''}
                </span>
              );
            })}
          </div>
        </>
      ) : null}
      {forms.length ? (
        <>
          <div className="section-title" style={{ marginTop: 14 }}>
            {isTh ? 'แบบฟอร์มที่เกี่ยวข้อง' : 'Related forms'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {forms.map((d) => (
              <span
                key={d.id}
                className="sb-tag"
                style={{ background: '#0e7490', color: '#fff', fontWeight: 700 }}
                title={(d.label || '').replace(/\n/g, ' ')}
              >
                Doc {d.code}
              </span>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ConnectionsPane({ node, s }: { node: LaneNode; s: Store }) {
  const outs = CONN_FROM[node.id] || [];
  const ins = CONN_TO[node.id] || [];
  const isTh = s.lang === 'th';
  const L = LANG_TH.ui;

  if (!outs.length && !ins.length) {
    return (
      <div className="pane" id="pane-conns">
        <p className="sb-desc">{tUI(s.lang, 'noConn', 'No cross-flow connections defined for this node. It connects sequentially within its lane.')}</p>
      </div>
    );
  }

  const connTypeLabels = (isTh && (L.connTypeLabels as Record<string, string>)) || {};
  const outT = isTh ? (L.connOut as string) || 'ออก →' : 'OUT →';
  const inT = isTh ? (L.connIn as string) || '← เข้า' : '← IN';

  const renderItem = (conn: (typeof outs)[number], dir: 'out' | 'in') => {
    const peerId = dir === 'out' ? conn.to : conn.from;
    const peer = NODE_INDEX[peerId];
    if (!peer) return null;
    const peerDept = DEPTS[(peer as LaneNode).dept] || ({ color: '#334155', name: (peer as LaneNode).dept, icon: '' } as any);
    const ctL = connTypeLabels[conn.type] || conn.type;
    return (
      <div
        className={'conn-item conn-' + dir}
        key={conn.from + '>' + conn.to + conn.label}
        onClick={() => s.selectNode(peer)}
      >
        <div className="conn-arrow" style={{ color: peerDept.color }}>
          {dir === 'out' ? '→' : '←'}
        </div>
        <div className="conn-info">
          <div className="conn-name">
            {(peer as LaneNode).label}{' '}
            <span style={{ color: peerDept.color, fontSize: 10 }}>
              {peerDept.icon} {peerDept.name}
            </span>
          </div>
          <div className="conn-label">{conn.label || ''}</div>
          <div>
            <span className={'conn-type-badge ctype-' + conn.type}>{ctL}</span>
            <span className={'conn-dir conn-dir-' + dir}>{dir === 'out' ? outT : inT}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="pane" id="pane-conns">
      <div className="conn-list">
        {outs.length ? (
          <>
            <div className="section-title" style={{ marginBottom: 8 }}>
              {tUI(s.lang, 'outOf', 'This node triggers / feeds')} ({outs.length})
            </div>
            {outs.map((c) => renderItem(c, 'out'))}
          </>
        ) : null}
        {ins.length ? (
          <>
            <div className="section-title" style={{ marginTop: 14, marginBottom: 8 }}>
              {tUI(s.lang, 'inTo', 'What feeds into this node')} ({ins.length})
            </div>
            {ins.map((c) => renderItem(c, 'in'))}
          </>
        ) : null}
      </div>
    </div>
  );
}

function AiPane({ aiOpp }: { aiOpp: (typeof AI_OPPS)[string] }) {
  const impactClass = aiOpp.impact === 'High' ? 'ai-impact-high' : aiOpp.impact === 'Medium' ? 'ai-impact-med' : 'ai-impact-low';
  const effortClass = aiOpp.effort === 'Low' ? 'ai-impact-high' : aiOpp.effort === 'Medium' ? 'ai-impact-med' : 'ai-impact-low';
  return (
    <div className="pane" id="pane-ai">
      <div className="ai-card">
        <div className="ai-card-title">🤖 {aiOpp.title}</div>
        <div className="ai-card-body">{aiOpp.desc}</div>
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className={'ai-impact ' + impactClass}>Impact: {aiOpp.impact}</span>
          <span className={'ai-impact ' + effortClass}>Effort: {aiOpp.effort}</span>
          {aiOpp.tool ? <span className="ai-tool">🛠 {aiOpp.tool}</span> : null}
        </div>
      </div>
      <div className="info-grid">
        <div className="info-card">
          <div className="info-card-label">Business Impact</div>
          <div className="info-card-value" style={{ color: '#a78bfa' }}>
            {aiOpp.impact}
          </div>
        </div>
        <div className="info-card">
          <div className="info-card-label">Implementation Effort</div>
          <div className="info-card-value" style={{ color: '#64748b' }}>
            {aiOpp.effort}
          </div>
        </div>
      </div>
    </div>
  );
}

function DocSidebarBody({ node, s }: { node: DocNode; s: Store }) {
  const dept = DEPTS[node.dept] || ({ color: '#38bdf8', name: node.dept, icon: '📄' } as any);
  const isTh = s.lang === 'th';
  const L = LANG_TH.ui;
  const docTabs = isTh
    ? [(L.docTabAbout as string) || 'เกี่ยวกับ', (L.docTabErp as string) || 'การส่งต่อ ERP', (L.docTabTypes as string) || 'ประเภทเอกสาร']
    : ['About', 'ERP Routing', 'Document Types'];

  const styleLabels: Record<string, string> = { direct: '→ Direct ERP Entry', deferred: '⇢ Deferred', conditional: '⇨ Conditional' };
  const styleColors: Record<string, string> = { direct: '#22c55e', deferred: '#fbbf24', conditional: '#fb923c' };
  const col = styleColors[node.erp_style] || '#38bdf8';
  const activeTab: DocTab = s.docTab;

  return (
    <>
      <div className="sb-dept-bar" id="sbDeptBar" style={{ background: '#0d1b2a', borderBottom: '2px solid rgba(56,189,248,.3)' }}>
        <div>
          <div id="sbTitle" style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
            Document {node.code} — {node.label}
          </div>
          <div id="sbSub" style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {node.sub || ''}
          </div>
        </div>
        <button className="close-btn" onClick={s.closeSidebar}>
          ✕ Close
        </button>
      </div>
      <div className="sb-tags" id="sbTags">
        <span className="sb-tag tag-doc">Site Document</span>
        <span className="sb-tag tag-dept" style={{ background: dept.color }}>
          {dept.icon} {dept.name}
        </span>
      </div>
      <div className="sb-tabs" id="sbTabs">
        {docTabs.map((label, i) => (
          <button key={i} className={'sb-tab' + (activeTab === i ? ' active' : '')} onClick={() => s.setDocTab(i as DocTab)}>
            {label}
          </button>
        ))}
      </div>
      <div className="sb-body" id="sbBody">
        {activeTab === 0 ? (
          <div className="pane" id="pane-doc0">
            <p className="sb-desc">{node.desc || ''}</p>
          </div>
        ) : null}
        {activeTab === 1 ? (
          <div className="pane" id="pane-doc1">
            <div style={{ background: col + '18', border: `1px solid ${col}44`, borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: col, letterSpacing: '.07em', marginBottom: 4 }}>
                {styleLabels[node.erp_style] || ''}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{node.erp_label || ''}</div>
            </div>
            <p className="sb-desc">{node.desc || ''}</p>
          </div>
        ) : null}
        {activeTab === 2 ? (
          <div className="pane" id="pane-doc2">
            <ul className="task-list">
              {(node.items || []).map((item, i) => (
                <li className="task-item" key={i}>
                  <div className="task-num" style={{ background: '#0e7490' }}>
                    {i + 1}
                  </div>
                  <div>{item}</div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </>
  );
}
