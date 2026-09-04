/**
 * Middle pane in Case Studies: the filtered list of case cards.
 *
 * The module filter is now the route (/cases/module/PO) rather than store
 * state, and the search box is the store's `query`.
 */

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '@vcb/shared';

import { Icon } from '../lib/icons.jsx';
import { MODULE_INFO, moduleColor, moduleLabel } from '../data/config.js';
import { STATUS, useStore } from '../store.jsx';
import { BackBar, Button, Empty, Spinner } from './ui.jsx';
import EditCaseModal from './EditCaseModal.jsx';

/**
 * Does this case belong to `mod` — as its primary module, or via an extra tag?
 *
 * Numbering, colour and badge still come only from the primary module; this
 * decides list membership alone. Ported from caseInModule() in the canonical
 * index.html.
 */
function caseInModule(sc, mod) {
  return sc.module === mod || (sc.extraModules || []).includes(mod);
}

function haystack(sc) {
  return [
    sc.titleTH,
    sc.titleEN,
    sc.when,
    (sc.steps || []).join(' '),
    sc.module,
    sc.ref,
    sc.displayNo || '',
    (sc.extraModules || []).join(' '),
  ]
    .join(' ')
    .toLowerCase();
}

export default function CaseListPane() {
  const { t, lang } = useI18n();
  const { mod } = useParams();
  const { scenarios, status, query, canEdit } = useStore();
  const [creating, setCreating] = useState(false);

  const activeMod = mod || 'ALL';
  const q = query.trim().toLowerCase();

  const rows = useMemo(() => {
    let list = scenarios.filter((sc) => {
      if (activeMod !== 'ALL' && !caseInModule(sc, activeMod)) return false;
      return !q || haystack(sc).includes(q);
    });
    // Within a module view, cases whose PRIMARY module matches come first;
    // those present only via an extra tag follow. Otherwise a tagged-in case
    // interleaves with the real PO-N cases by row position and the numbering
    // reads as broken. Stable sort keeps the order inside each group.
    if (activeMod !== 'ALL') {
      list = list
        .slice()
        .sort((a, b) => (a.module === activeMod ? 0 : 1) - (b.module === activeMod ? 0 : 1));
    }
    return list;
  }, [scenarios, activeMod, q]);

  const info = activeMod !== 'ALL' ? MODULE_INFO[activeMod] : null;
  const heading =
    activeMod === 'ALL' ? t('label.all') : `${activeMod} · ${moduleLabel(activeMod, lang)}`;

  return (
    <div className="flex min-h-full flex-col">
      <BackBar to="/cases" label={t('detail.backModules')} />

      <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5 dark:border-line-dark">
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted">
          {heading} · {t('list.showing', { n: rows.length, t: scenarios.length })}
        </span>
        {canEdit && (
          <Button variant="primary" onClick={() => setCreating(true)} className="shrink-0 px-2 py-1 text-xs">
            <Icon name="plus" className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('list.newCase')}</span>
          </Button>
        )}
      </div>

      <div className="flex-1 p-2.5">
        {/* Module hero — the bilingual description of what this ERP module is
            for. Shown only on a module view, as before. */}
        {info && (
          <div
            style={{ '--mc': moduleColor(activeMod) }}
            className="mc-border-l mb-2.5 rounded-card border border-l-4 border-line bg-surface-card p-3.5 shadow-card dark:border-line-dark dark:bg-surface-dark-card dark:shadow-card-dark"
          >
            <div className="mc-text text-sm font-bold">
              {lang === 'en' ? info.nameEN : info.nameTH}
            </div>
            <div className="text-xs text-ink-muted dark:text-ink-dark-muted">
              {lang === 'en' ? info.nameTH : info.nameEN}
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-subtle dark:text-ink-dark-muted">
              {lang === 'en' ? info.descEN : info.descTH}
            </p>
          </div>
        )}

        {status === STATUS.loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty>
            {query ? t('list.noResults') : activeMod !== 'ALL' ? t('list.noScenarios') : t('list.noResults')}
          </Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((sc) => {
              const title = lang === 'en' && sc.titleEN ? sc.titleEN : sc.titleTH;
              // Badge with the case's OWN extra tags regardless of which list
              // is open, so a PO case tagged AP always shows "AP" and never
              // flips to "PO" just because the AP list is open.
              const tags = sc.extraModules || [];
              return (
                <li key={sc.no}>
                  <Link
                    to={`/cases/${sc.no}`}
                    style={{ '--mc': moduleColor(sc.module) }}
                    className="mc-border-l block rounded-card border border-l-4 border-line bg-surface-card p-3 shadow-card transition hover:shadow-card-hover dark:border-line-dark dark:bg-surface-dark-card dark:shadow-card-dark"
                  >
                    {/* Matches the original's lc-top/lc-tags exactly: the case
                        number sits left, and margin-left:auto on the tag group
                        pushes extra-module chips to the right edge of the card
                        instead of crowding them right after the number. */}
                    <div className="flex items-center gap-2">
                      <span className="mc-text text-[11px] font-extrabold tracking-wide">
                        {sc.displayNo || sc.no}
                      </span>
                      {tags.length ? (
                        <span className="ml-auto flex flex-wrap gap-1">
                          {tags.map((m) => (
                            <span
                              key={m}
                              style={{ '--mc': moduleColor(m) }}
                              className="tag-chip rounded-pill px-2 py-0.5 text-[10.5px] font-bold tracking-wide"
                            >
                              {m}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-sm font-semibold leading-snug break-thai">{title}</div>
                    {sc.when && sc.when !== '-' && (
                      <div className="mt-1 line-clamp-2 text-xs text-ink-muted break-thai dark:text-ink-dark-muted">
                        {sc.when}
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {creating && <EditCaseModal mode="new" onClose={() => setCreating(false)} />}
    </div>
  );
}
