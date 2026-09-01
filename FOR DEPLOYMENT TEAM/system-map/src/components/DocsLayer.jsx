/** Site document flow strip — the panel of document nodes under the swimlane map. */
import { useI18n } from '@vcb/shared';
import { useStore } from '../store.jsx';
import { DOC_NODES } from '../data/index.js';
import { tDoc } from '../lib/mapLang.js';

const PILL_TONE = {
  direct: 'bg-green-500/15 text-green-500 border border-green-500/30',
  deferred: 'bg-alt/[.12] text-alt border border-alt/30',
  conditional: 'bg-orange-400/[.12] text-orange-400 border border-orange-400/30',
  manual: 'bg-slate-400/[.14] text-slate-300 border border-dashed border-slate-400/45',
};

function DocNodeBox({ node }) {
  const s = useStore();
  const { t, lang } = useI18n();
  const tone = PILL_TONE[node.erp_style] || PILL_TONE.manual;
  const pillKey = `doc.pill.${node.erp_style in PILL_TONE ? node.erp_style : 'manual'}`;
  const isSelected = s.selectedNodeId === node.id;

  return (
    <div
      className={
        'node-doc relative z-[3] min-w-[110px] flex-shrink-0 cursor-pointer rounded-[10px] ' +
        'border-2 border-flow/30 bg-map-doc px-2.5 pb-2 pt-2.5 text-center ' +
        'transition-transform duration-150 hover:-translate-y-0.5 ' +
        (isSelected ? 'outline outline-[3px] outline-offset-2 outline-flow' : '')
      }
      id={node.id}
      onClick={() => s.selectDocNode(node)}
    >
      <span className="mb-[3px] block text-lg font-black leading-none tracking-[.02em] text-flow">
        {node.code}
      </span>
      {node.siteOrigin ? (
        <span className="text-nano" title={t('doc.originAtSite')}>
          📍
        </span>
      ) : null}
      <div className="text-nano font-bold leading-[1.3] text-slate-200">
        {tDoc(lang, node, 'label')}
      </div>
      <div className="mt-0.5 text-tiny text-slate-500">{tDoc(lang, node, 'sub')}</div>
      <span
        className={`mt-[5px] inline-block rounded-pill px-[7px] py-0.5 text-2xs font-extrabold ${tone}`}
      >
        {t(pillKey)}
      </span>
    </div>
  );
}

export default function DocsLayer() {
  const { t } = useI18n();
  return (
    <div
      className="mt-1.5 rounded-xl border border-dashed border-flow/20 bg-flow/[.03] px-3.5 py-3"
      id="docsLayer"
    >
      <div className="mb-2 text-nano font-bold uppercase tracking-[.08em] text-flow">
        {t('doc.flowLabel')}
      </div>
      <div className="flex flex-nowrap gap-2.5" id="docsNodes">
        {DOC_NODES.map((n) => (
          <DocNodeBox key={n.id} node={n} />
        ))}
      </div>
    </div>
  );
}
