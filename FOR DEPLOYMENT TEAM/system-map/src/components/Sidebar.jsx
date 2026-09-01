/** Right sidebar — node detail (Steps/Tasks, Connections, AI Opps tabs) and the
 *  document-node variant (About / ERP Routing / Document Types tabs).
 *
 *  The original passed node text through an esc() helper into innerHTML. React
 *  escapes text children by default, so the text is rendered directly and the
 *  helper is gone — same output, one less way to inject markup.
 */
import { useI18n } from '@vcb/shared';
import { useStore } from '../store.jsx';
import {
  DEPTS,
  MODULES,
  AI_OPPS,
  DOC_NODES,
  FUNCTION_REGISTRY,
  NODE_FN,
  FUNCTION_AI,
  LANG_TH,
} from '../data/index.js';
import { CONN_FROM, CONN_TO, NODE_INDEX, isDocNode } from '../lib/derived.js';
import { tNode, tDept } from '../lib/mapLang.js';

const SECTION_TITLE =
  'mb-[9px] border-b border-map-head pb-[5px] text-tiny font-extrabold uppercase tracking-[.08em] text-slate-600';
const TAG = 'whitespace-nowrap rounded-pill px-2 py-0.5 text-tiny font-extrabold tracking-[.04em]';
const CLOSE_BTN =
  'cursor-pointer rounded-md border-[1.5px] border-map-rail bg-transparent px-2.5 py-1 text-nano text-slate-500 hover:bg-map-head hover:text-slate-200';

export default function Sidebar() {
  const s = useStore();
  const { t } = useI18n();
  const node = s.selectedNode;
  const open = !!node;

  return (
    <div
      className={
        'fixed right-0 top-[var(--header-h)] z-[200] flex h-[calc(100vh-var(--header-h))] w-sidebar flex-col overflow-hidden border-l border-map-hair2 bg-map-panel shadow-sidebar transition-transform duration-[280ms] ease-sidebar ' +
        (open ? 'translate-x-0' : 'translate-x-[105%]')
      }
      id="sidebar"
    >
      {!open ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-map-rail">
          <div className="mb-3.5 text-[40px] opacity-50">🗺️</div>
          <div className="mb-1.5 text-sm font-semibold text-slate-600">{t('sb.clickHint')}</div>
          <div className="text-base2 leading-[1.5] text-map-rail">
            {t('sb.hintErp')}
            <br />
            {t('sb.hintManual')}
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col overflow-hidden" id="sbContent">
          {isDocNode(node) ? <DocSidebarBody node={node} /> : <NodeSidebarBody node={node} />}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── lane node ─────────────────────────────────── */

function NodeSidebarBody({ node }) {
  const s = useStore();
  const { t, lang } = useI18n();

  const dept = DEPTS[node.dept] || { color: '#334155', name: node.dept, icon: '' };
  const mod = node.module ? MODULES[node.module] : null;
  const aiOpp = AI_OPPS[node.id];

  const tabs = [
    {
      id: 'tasks',
      label: `${node.type === 'erp' ? t('sb.steps') : t('sb.tasks')} (${node.items.length})`,
    },
    { id: 'conns', label: t('sb.connections') },
  ];
  if (aiOpp) tabs.push({ id: 'ai', label: t('sb.aiTab') });

  const activeTab = tabs.find((x) => x.id === s.sbTab) ? s.sbTab : 'tasks';
  const dept2 = node.dept2 ? DEPTS[node.dept2] : null;

  return (
    <>
      <div
        className="flex flex-shrink-0 items-center gap-2.5 px-[18px] pb-3 pt-3.5"
        style={{ background: dept.color + '22', borderBottom: `2px solid ${dept.color}44` }}
      >
        <div>
          <div className="text-sm font-bold text-white">{tNode(lang, node, 'label')}</div>
          <div className="mt-0.5 text-nano text-slate-500">{mod ? mod.name : node.sub || ''}</div>
        </div>
        <button
          className={`${CLOSE_BTN} ml-auto mr-1.5`}
          onClick={s.traceCurrent}
          title={t('sb.traceTitle')}
        >
          {s.focusShow ? t('sb.backToMap') : t('sb.trace')}
        </button>
        <button className={CLOSE_BTN} onClick={s.closeSidebar}>
          {t('sb.close')}
        </button>
      </div>

      <div className="flex flex-shrink-0 flex-wrap gap-1.5 px-[18px] pb-2.5">
        <span
          className={
            `${TAG} ` +
            (node.type === 'erp'
              ? 'border border-green-500/30 bg-green-500/15 text-green-500'
              : 'border border-alt/30 bg-alt/[.12] text-alt')
          }
        >
          {node.type === 'erp' ? t('sb.erpStep') : t('sb.manualWork')}
        </span>
        {node.module ? (
          <span className={`${TAG} border border-ai/30 bg-ai/[.12] text-ai`}>
            {t('sb.moduleTag', { module: node.module })}
          </span>
        ) : null}
        <span className={`${TAG} text-white`} style={{ background: dept.color }}>
          {dept.icon} {tDept(lang, node.dept, dept.name)}
        </span>
        {dept2 ? (
          <span className={`${TAG} text-white`} style={{ background: dept2.color }}>
            {dept2.icon || ''} {tDept(lang, node.dept2, dept2.name)} {t('sb.supportsChecks')}
          </span>
        ) : null}
        {node.loc === 'site' ? (
          <span className={`${TAG} text-white`} style={{ background: '#E65100' }}>
            {t('sb.atSite')}
          </span>
        ) : null}
        <span
          className={`${TAG} text-white`}
          style={{ background: node.unverified ? '#b45309' : '#15803d' }}
        >
          {node.unverified ? t('sb.toConfirm') : t('sb.verified')}
        </span>
      </div>

      <div className="flex flex-shrink-0 border-b border-map-head">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={
              'flex-1 cursor-pointer border-none border-b-2 bg-transparent px-1 py-[9px] text-nano font-bold transition-all duration-150 ' +
              (activeTab === tab.id
                ? 'border-b-flow text-flow'
                : 'border-b-transparent text-slate-500 hover:text-slate-200')
            }
            onClick={() => s.setSbTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {activeTab === 'tasks' ? <TasksPane node={node} dept={dept} mod={mod} /> : null}
        {activeTab === 'conns' ? <ConnectionsPane node={node} /> : null}
        {activeTab === 'ai' && aiOpp ? <AiPane aiOpp={aiOpp} /> : null}
      </div>
    </>
  );
}

function TasksPane({ node, dept, mod }) {
  const s = useStore();
  const { t, lang } = useI18n();

  const thNodeData = LANG_TH.nodes[node.id] || {};
  const descText =
    node.type === 'erp' && mod
      ? (lang === 'th' && thNodeData.desc ? thNodeData.desc : node.desc || mod.purpose || '')
      : tNode(lang, node, 'desc') || '';

  const items = tNode(lang, node, 'items') || node.items;

  // Related functions: the node's own mapping if it has one, else its dept's.
  const flat = Object.values(FUNCTION_REGISTRY).flat();
  const map = NODE_FN[node.id];
  const regFns = map
    ? map.map((cd) => flat.find((f) => f[0] === cd)).filter(Boolean)
    : FUNCTION_REGISTRY[node.dept] || [];
  const forms = DOC_NODES.filter((d) => d.dept === node.dept);

  return (
    <div>
      <p className="mb-3.5 text-note leading-[1.6] text-slate-400">{descText}</p>

      {node.type === 'erp' && mod ? (
        <>
          <div className="mb-3.5 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-map-head px-3 py-2.5">
              <div className="mb-[3px] text-tiny font-extrabold uppercase tracking-[.07em] text-slate-600">
                {t('sb.module')}
              </div>
              <div className="text-body2 font-bold text-slate-200">{node.module}</div>
            </div>
            <div className="rounded-lg bg-map-head px-3 py-2.5">
              <div className="mb-[3px] text-tiny font-extrabold uppercase tracking-[.07em] text-slate-600">
                {t('sb.department')}
              </div>
              <div className="text-body2 font-bold text-slate-200">
                {tDept(lang, node.dept, dept.name)}
              </div>
            </div>
          </div>
          <div className={SECTION_TITLE}>{t('sb.steps')}</div>
        </>
      ) : null}

      {items && items.length ? (
        <ul className="flex list-none flex-col gap-1.5">
          {items.map((item, i) => (
            <li
              className="flex items-start gap-2.5 text-base2 leading-[1.4] text-slate-400"
              key={i}
            >
              <div
                className="mt-px flex h-5 min-w-[20px] flex-shrink-0 items-center justify-center rounded-[5px] text-tiny font-extrabold text-white"
                style={{ background: dept.color }}
              >
                {i + 1}
              </div>
              <div>{item}</div>
            </li>
          ))}
        </ul>
      ) : null}

      {node.routes && node.routes.length ? (
        <>
          <div className={`${SECTION_TITLE} mt-3.5`}>{t('sb.routeOptions')}</div>
          {node.routes.map((r, i) => (
            <div
              className="mb-[7px] rounded-lg border border-map-hair border-l-[3px] border-l-alt bg-map-card px-[11px] py-[9px]"
              key={i}
            >
              <div className="mb-[3px] text-base2 font-extrabold text-amber-200">{r.n}</div>
              <div className="text-nano leading-[1.5] text-slate-400">{r.d}</div>
            </div>
          ))}
        </>
      ) : null}

      {regFns.length ? (
        <>
          <div className={`${SECTION_TITLE} mt-3.5`}>{t('sb.relatedFunctions')}</div>
          <div className="flex flex-wrap gap-[5px]">
            {regFns.map((f) => {
              const aiO = FUNCTION_AI[f[0]];
              const aiText = aiO ? (lang === 'th' && aiO.th ? aiO.th : aiO.en) : '';
              return (
                <button
                  key={f[0]}
                  type="button"
                  className={`${TAG} cursor-pointer font-bold transition-[filter,box-shadow] duration-100 hover:brightness-[1.35] hover:shadow-[0_0_0_1px_rgba(56,189,248,.6)]`}
                  style={{
                    background: aiO ? '#0c4a6e' : '#1e293b',
                    color: aiO ? '#bae6fd' : '#cbd5e1',
                  }}
                  title={
                    (aiO ? `${f[1]} — ${t('fn.aiPrefix')} ${aiText}` : f[1]) +
                    t('sb.openInRegistry')
                  }
                  onClick={() => s.openRegistryToFunction(f[0])}
                >
                  {f[0]}
                  {aiO ? ' ✨' : ''}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {forms.length ? (
        <>
          <div className={`${SECTION_TITLE} mt-3.5`}>{t('sb.relatedForms')}</div>
          <div className="flex flex-wrap gap-[5px]">
            {forms.map((d) => (
              <span
                key={d.id}
                className={`${TAG} font-bold text-white`}
                style={{ background: '#0e7490' }}
                title={(d.label || '').replace(/\n/g, ' ')}
              >
                {t('sb.docChip', { code: d.code })}
              </span>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ConnectionsPane({ node }) {
  const s = useStore();
  const { t, lang } = useI18n();

  const outs = CONN_FROM[node.id] || [];
  const ins = CONN_TO[node.id] || [];

  if (!outs.length && !ins.length) {
    return <p className="mb-3.5 text-note leading-[1.6] text-slate-400">{t('conn.none')}</p>;
  }

  const renderItem = (conn, dir) => {
    const peerId = dir === 'out' ? conn.to : conn.from;
    const peer = NODE_INDEX[peerId];
    if (!peer) return null;
    const peerDept = DEPTS[peer.dept] || { color: '#334155', name: peer.dept, icon: '' };
    const isIndirect = conn.type === 'deferred' || conn.type === 'conditional';

    return (
      <div
        className={
          'flex cursor-pointer items-start gap-2.5 rounded-lg border-l-[3px] bg-map-head px-3 py-2.5 transition-colors duration-100 hover:bg-[#253348] ' +
          (dir === 'out' ? 'border-l-green-500' : 'border-l-flow')
        }
        key={conn.from + '>' + conn.to + (conn.label || '')}
        onClick={() => s.selectNode(peer)}
      >
        <div className="mt-px text-sm" style={{ color: peerDept.color }}>
          {dir === 'out' ? '→' : '←'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 text-base2 font-bold text-slate-200">
            {peer.label}{' '}
            <span className="text-4xs" style={{ color: peerDept.color }}>
              {peerDept.icon} {tDept(lang, peer.dept, peerDept.name)}
            </span>
          </div>
          <div className="text-mini text-slate-500">{conn.label || ''}</div>
          <div>
            <span
              className={
                'mt-1 inline-block whitespace-nowrap rounded-pill px-1.5 py-px text-3xs font-extrabold ' +
                (isIndirect
                  ? 'border border-alt/30 bg-alt/[.12] text-alt'
                  : 'border border-flow/30 bg-flow/[.12] text-flow')
              }
            >
              {t(`conn.type.${conn.type}`)}
            </span>
            <span
              className={
                'ml-1 mt-1 inline-block rounded-pill px-1.5 py-px text-3xs font-extrabold tracking-[.06em] ' +
                (dir === 'out' ? 'bg-green-500/10 text-green-500' : 'bg-flow/10 text-flow')
              }
            >
              {dir === 'out' ? t('conn.dirOut') : t('conn.dirIn')}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {outs.length ? (
        <>
          <div className={`${SECTION_TITLE} mb-2`}>
            {t('conn.out')} ({outs.length})
          </div>
          {outs.map((c) => renderItem(c, 'out'))}
        </>
      ) : null}
      {ins.length ? (
        <>
          <div className={`${SECTION_TITLE} mb-2 mt-3.5`}>
            {t('conn.in')} ({ins.length})
          </div>
          {ins.map((c) => renderItem(c, 'in'))}
        </>
      ) : null}
    </div>
  );
}

function AiPane({ aiOpp }) {
  const { t } = useI18n();

  // Impact reads high-is-good, effort reads low-is-good — hence the flip.
  const toneFor = (level) =>
    ({
      High: 'border border-green-500/30 bg-green-500/15 text-green-500',
      Medium: 'border border-alt/30 bg-alt/[.12] text-alt',
      Low: 'border border-map-rail bg-slate-400/[.12] text-slate-400',
    })[level] || 'border border-map-rail bg-slate-400/[.12] text-slate-400';

  const impactClass = toneFor(aiOpp.impact);
  const effortClass = toneFor(
    aiOpp.effort === 'Low' ? 'High' : aiOpp.effort === 'High' ? 'Low' : 'Medium',
  );
  const PILL = 'mt-1.5 inline-block rounded-pill px-2 py-0.5 text-3xs font-extrabold tracking-[.04em]';

  return (
    <div>
      <div className="mb-3 rounded-[9px] border border-ai/35 bg-ai/[.08] px-[15px] py-[13px]">
        <div className="mb-[7px] text-tiny font-extrabold uppercase tracking-[.08em] text-ai">
          🤖 {aiOpp.title}
        </div>
        <div className="text-note leading-[1.65] text-ai-soft">{aiOpp.desc}</div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <span className={`${PILL} ${impactClass}`}>
            {t('ai.impact')}: {t(`ai.level.${aiOpp.impact}`)}
          </span>
          <span className={`${PILL} ${effortClass}`}>
            {t('ai.effort')}: {t(`ai.level.${aiOpp.effort}`)}
          </span>
          {aiOpp.tool ? (
            <span
              className={`${PILL} border border-ai/40 bg-ai/15 text-ai-soft`}
            >
              🛠 {aiOpp.tool}
            </span>
          ) : null}
        </div>
      </div>
      <div className="mb-3.5 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-map-head px-3 py-2.5">
          <div className="mb-[3px] text-tiny font-extrabold uppercase tracking-[.07em] text-slate-600">
            {t('ai.bizImpact')}
          </div>
          <div className="text-body2 font-bold text-ai">{t(`ai.level.${aiOpp.impact}`)}</div>
        </div>
        <div className="rounded-lg bg-map-head px-3 py-2.5">
          <div className="mb-[3px] text-tiny font-extrabold uppercase tracking-[.07em] text-slate-600">
            {t('ai.implEffort')}
          </div>
          <div className="text-body2 font-bold text-slate-500">
            {t(`ai.level.${aiOpp.effort}`)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── document node ───────────────────────────────── */

function DocSidebarBody({ node }) {
  const s = useStore();
  const { t, lang } = useI18n();

  const dept = DEPTS[node.dept] || { color: '#38bdf8', name: node.dept, icon: '📄' };
  const docTabs = [t('doc.about'), t('doc.erpRouting'), t('doc.types')];
  const styleColors = { direct: '#22c55e', deferred: '#fbbf24', conditional: '#fb923c' };
  const col = styleColors[node.erp_style] || '#38bdf8';
  const activeTab = s.docTab;

  return (
    <>
      <div className="flex flex-shrink-0 items-center gap-2.5 border-b-2 border-flow/30 bg-map-doc px-[18px] pb-3 pt-3.5">
        <div>
          <div className="text-sm font-bold text-white">
            {t('doc.heading', { code: node.code, label: node.label })}
          </div>
          <div className="mt-0.5 text-nano text-slate-500">{node.sub || ''}</div>
        </div>
        <button className={`${CLOSE_BTN} ml-auto`} onClick={s.closeSidebar}>
          {t('sb.close')}
        </button>
      </div>

      <div className="flex flex-shrink-0 flex-wrap gap-1.5 px-[18px] pb-2.5">
        <span className={`${TAG} border border-flow/30 bg-flow/[.12] text-flow`}>
          {t('doc.siteDoc')}
        </span>
        <span className={`${TAG} text-white`} style={{ background: dept.color }}>
          {dept.icon} {tDept(lang, node.dept, dept.name)}
        </span>
      </div>

      <div className="flex flex-shrink-0 border-b border-map-head">
        {docTabs.map((label, i) => (
          <button
            key={i}
            className={
              'flex-1 cursor-pointer border-none border-b-2 bg-transparent px-1 py-[9px] text-nano font-bold transition-all duration-150 ' +
              (activeTab === i
                ? 'border-b-flow text-flow'
                : 'border-b-transparent text-slate-500 hover:text-slate-200')
            }
            onClick={() => s.setDocTab(i)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {activeTab === 0 ? (
          <p className="mb-3.5 text-note leading-[1.6] text-slate-400">{node.desc || ''}</p>
        ) : null}

        {activeTab === 1 ? (
          <>
            <div
              className="mb-3 rounded-lg px-3.5 py-3"
              style={{ background: col + '18', border: `1px solid ${col}44` }}
            >
              <div
                className="mb-1 text-4xs font-extrabold tracking-[.07em]"
                style={{ color: col }}
              >
                {node.erp_style in styleColors ? t(`doc.style.${node.erp_style}`) : ''}
              </div>
              <div className="text-body2 font-bold text-slate-200">{node.erp_label || ''}</div>
            </div>
            <p className="mb-3.5 text-note leading-[1.6] text-slate-400">{node.desc || ''}</p>
          </>
        ) : null}

        {activeTab === 2 ? (
          <ul className="flex list-none flex-col gap-1.5">
            {(node.items || []).map((item, i) => (
              <li
                className="flex items-start gap-2.5 text-base2 leading-[1.4] text-slate-400"
                key={i}
              >
                <div
                  className="mt-px flex h-5 min-w-[20px] flex-shrink-0 items-center justify-center rounded-[5px] text-tiny font-extrabold text-white"
                  style={{ background: '#0e7490' }}
                >
                  {i + 1}
                </div>
                <div>{item}</div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </>
  );
}
