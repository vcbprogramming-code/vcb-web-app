/**
 * Middle pane in Process Flows: the flow list, grouped by module.
 *
 * Flows are bundled with the app (src/data/flows.js), not fetched — they are
 * drawn diagrams, not document content, and the API has no endpoint for them.
 * So this pane keeps working even while the SOP document is NOT_SEEDED.
 */

import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '@vcb/shared';

import { moduleColor, moduleLabel } from '../data/config.js';
import { SOP_FLOWS } from '../data/flows.js';
import { useStore } from '../store.jsx';
import { BackBar, Empty } from './ui.jsx';

const GROUP_ORDER = ['BD', 'PO', 'IC', 'OF', 'AP', 'AR', 'FA', 'GL'];

function haystack(f) {
  return [
    f.id,
    f.titleTH,
    f.titleEN,
    (f.narrative || []).join(' '),
    f.nodes.map((n) => n.label).join(' '),
  ]
    .join(' ')
    .toLowerCase();
}

export default function FlowListPane() {
  const { t, lang } = useI18n();
  const { mod } = useParams();
  const { query } = useStore();

  const activeMod = mod || 'ALL';
  const q = query.trim().toLowerCase();

  const rows = useMemo(
    () =>
      SOP_FLOWS.filter((f) => {
        if (activeMod !== 'ALL' && f.module !== activeMod) return false;
        return !q || haystack(f).includes(q);
      }),
    [activeMod, q]
  );

  // Group by module in the fixed order, then anything not in that list.
  const groups = useMemo(() => {
    const byMod = {};
    for (const f of rows) (byMod[f.module] = byMod[f.module] || []).push(f);
    const ordered = GROUP_ORDER.filter((m) => byMod[m]).concat(
      Object.keys(byMod).filter((m) => !GROUP_ORDER.includes(m))
    );
    return ordered.map((m) => ({ module: m, items: byMod[m] }));
  }, [rows]);

  return (
    <div className="flex min-h-full flex-col">
      <BackBar to="/flows" label={t('detail.backModules')} />

      <div className="border-b border-line px-3.5 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-ink-muted dark:border-line-dark dark:text-ink-dark-muted">
        {t('flows.header')}
        {activeMod !== 'ALL' ? ` · ${activeMod}` : ''} ·{' '}
        {t('flows.showing', { n: rows.length, t: SOP_FLOWS.length })}
      </div>

      <div className="flex-1 p-2.5">
        {rows.length === 0 ? (
          <Empty>{t('list.noResults')}</Empty>
        ) : (
          groups.map((g) => (
            <section key={g.module} className="mb-3">
              <h3
                style={{ '--mc': moduleColor(g.module) }}
                className="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted"
              >
                <span className="mc-bg h-2 w-2 shrink-0 rounded-full" aria-hidden="true" />
                {g.module} · {moduleLabel(g.module, lang)}
                <span className="h-px flex-1 bg-line dark:bg-line-dark" aria-hidden="true" />
              </h3>
              <ul className="flex flex-col gap-2">
                {g.items.map((f) => {
                  const title = lang === 'en' && f.titleEN ? f.titleEN : f.titleTH;
                  return (
                    <li key={f.id}>
                      <Link
                        to={`/flows/${encodeURIComponent(f.id)}`}
                        style={{ '--mc': moduleColor(f.module) }}
                        className="mc-border-l block rounded-card border border-l-4 border-line bg-surface-card p-3 shadow-card transition hover:shadow-card-hover dark:border-line-dark dark:bg-surface-dark-card dark:shadow-card-dark"
                      >
                        <span className="mc-text text-[11px] font-extrabold tracking-wide">
                          {f.id}
                        </span>
                        <div className="mt-1 text-sm font-semibold leading-snug break-thai">
                          {title}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
