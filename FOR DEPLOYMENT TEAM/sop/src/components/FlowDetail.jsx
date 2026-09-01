/**
 * Right pane for one process flow.
 *
 * Flows ship with the app rather than coming from the API, so this screen is
 * unaffected by the document's load state — it renders while the SOP is still
 * loading, and while it is NOT_SEEDED.
 */

import { useI18n } from '@vcb/shared';

import { moduleColor, moduleLabel } from '../data/config.js';
import { SOP_FLOWS } from '../data/flows.js';
import { BackBar } from './ui.jsx';
import FlowDiagram from './FlowDiagram.jsx';
import ShareButton from './ShareButton.jsx';
import Welcome from './Welcome.jsx';

export default function FlowDetail({ id }) {
  const { t, lang } = useI18n();
  const flow = SOP_FLOWS.find((f) => f.id === id);

  // A stale or mistyped flow id falls back to the welcome page rather than an
  // error — the same graceful degradation openInitialCase() had.
  if (!flow) return <Welcome />;

  const title = lang === 'en' && flow.titleEN ? flow.titleEN : flow.titleTH;
  const sub = lang === 'en' && flow.titleEN ? flow.titleTH : flow.titleEN || '';

  return (
    <div style={{ '--mc': moduleColor(flow.module) }}>
      <BackBar label={t('detail.backList')} />

      <article className="px-4 py-5 sm:px-6">
        <header className="mb-5 flex flex-wrap items-start gap-3 border-b border-line pb-4 dark:border-line-dark">
          <span className="mc-bg shrink-0 rounded-control px-2.5 py-1 text-sm font-extrabold text-white">
            {flow.id}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-snug break-thai">{title}</h1>
            {sub && (
              <p className="mt-0.5 text-[13px] text-ink-muted break-thai dark:text-ink-dark-muted">
                {sub}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ShareButton path={`/flows/${encodeURIComponent(flow.id)}`} />
            <span
              className="mc-text self-center rounded-pill border border-current px-2 py-0.5 text-[11px] font-bold"
              title={moduleLabel(flow.module, lang)}
            >
              {flow.module}
            </span>
          </div>
        </header>

        <FlowDiagram flow={flow} />
      </article>
    </div>
  );
}
