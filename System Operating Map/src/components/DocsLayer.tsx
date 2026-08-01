/** Site document flow strip. Mirrors the DOC_NODES rendering half of
 *  renderLanes() (buildDocNode()) in Index.html — the `.docs-layer` panel
 *  under the swimlane map.
 */
import { DOC_NODES } from '../data';
import type { DocNode } from '../data/types';
import type { Store } from '../store';
import { tDoc, tUI } from '../lib/i18n';

const PILL_CLASS: Record<string, string> = {
  direct: 'erp-pill-direct',
  deferred: 'erp-pill-deferred',
  conditional: 'erp-pill-conditional',
  manual: 'erp-pill-manual',
};
const PILL_LABEL: Record<string, string> = {
  direct: '→ Direct ERP',
  deferred: '⇢ Deferred',
  conditional: '⇨ Conditional',
  manual: '✎ Manual',
};

function DocNodeBox({ node, s }: { node: DocNode; s: Store }) {
  const pillCls = PILL_CLASS[node.erp_style] || 'erp-pill-manual';
  const pillLabel = PILL_LABEL[node.erp_style] || '✎ Manual';
  const isSelected = s.selectedNodeId === node.id;
  return (
    <div
      className={'node-doc' + (isSelected ? ' selected' : '')}
      id={node.id}
      onClick={() => s.selectDocNode(node)}
    >
      <span className="doc-code">{node.code}</span>
      {node.siteOrigin ? (
        <span className="doc-loc" title="Originates at site">
          📍
        </span>
      ) : null}
      <div className="doc-label">{tDoc(s.lang, node, 'label')}</div>
      <div className="doc-sub">{tDoc(s.lang, node, 'sub')}</div>
      <span className={'erp-pill ' + pillCls}>{pillLabel}</span>
    </div>
  );
}

export default function DocsLayer({ s }: { s: Store }) {
  return (
    <div className="docs-layer" id="docsLayer">
      <div className="docs-layer-label">{tUI(s.lang, 'docFlow', '📄 Site Document Flow (Document Control)')}</div>
      <div className="docs-nodes" id="docsNodes">
        {DOC_NODES.map((n) => (
          <DocNodeBox key={n.id} node={n} s={s} />
        ))}
      </div>
    </div>
  );
}
