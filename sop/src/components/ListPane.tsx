/** Middle list pane: scenario cards (Case Studies) or the grouped flow list
 *  (Process Flows). Hidden in Reports view via body.reports-mode CSS.
 *  Mirrors renderList() + renderFlowList() in index.html. */
import { useMemo } from 'react';
import type { Store } from '../store';
import { MODULES, MODULES_EN, MODULE_INFO } from '../data/config';
import { SOP_FLOWS } from '../data/flows';
import { Icon } from '../lib/icons';

const FLOW_GROUP_ORDER = ['BD', 'PO', 'IC', 'OF', 'AP', 'AR', 'FA', 'GL'];

// True if a case belongs to `mod` — either as its primary module or one of
// its extra tags. Numbering/color/badge still come only from the primary
// module; this only affects list membership.
function caseInModule(sc: { module: string; extraModules?: string[] }, mod: string): boolean {
  return sc.module === mod || (sc.extraModules || []).indexOf(mod) >= 0;
}

function MBack({ s }: { s: Store }) {
  return (
    <button className="mback" type="button" onClick={s.mobileBack} aria-label="ย้อนกลับ">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      <span>{s.t('backModules')}</span>
    </button>
  );
}

function ScenarioList({ s }: { s: Store }) {
  const { nav } = s;
  const q = nav.q.toLowerCase();

  const rows = useMemo(() => {
    const filtered = s.scenarios.filter((sc) => {
      if (nav.mod !== 'ALL' && !caseInModule(sc, nav.mod)) return false;
      if (!q) return true;
      const hay = (
        sc.titleTH +
        ' ' +
        sc.titleEN +
        ' ' +
        sc.when +
        ' ' +
        sc.steps.join(' ') +
        ' ' +
        sc.module +
        ' ' +
        sc.ref +
        ' ' +
        (sc.displayNo || '') +
        ' ' +
        (sc.extraModules || []).join(' ')
      ).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    // When viewing a specific module, cases whose PRIMARY module matches come
    // first (in their normal order); cases only present via an extra tag are
    // pushed after — otherwise a tagged-in case interleaves with real PO-N
    // cases by row position, which reads as broken numbering (Array.sort is
    // stable, so relative order within each group is preserved).
    if (nav.mod !== 'ALL') {
      return filtered
        .slice()
        .sort((a, b) => (a.module === nav.mod ? 0 : 1) - (b.module === nav.mod ? 0 : 1));
    }
    return filtered;
  }, [s.scenarios, nav.mod, q]);

  const modLbl =
    s.lang === 'en'
      ? MODULES_EN[nav.mod as keyof typeof MODULES_EN] || MODULES[nav.mod as keyof typeof MODULES]
      : MODULES[nav.mod as keyof typeof MODULES];
  const label = nav.mod === 'ALL' ? s.t('allTitle') : nav.mod + ' · ' + modLbl;
  const headText = label + ' · ' + s.t('showingFmt')(rows.length, s.scenarios.length);

  const mi = nav.mod !== 'ALL' ? MODULE_INFO[nav.mod as keyof typeof MODULE_INFO] : undefined;

  const emptyMsg = nav.q
    ? s.t('noResults')
    : nav.mod !== 'ALL'
      ? s.t('noScenarios')
      : s.t('noResults');

  return (
    <>
      <div className="list-head" id="listHead">
        {s.isAdmin ? (
          <>
            <span className="lh-text">{headText}</span>
            <button type="button" className="lh-new" onClick={s.openNewScenarioModal}>
              <Icon name="plus" />
              <span>{s.t('newCaseBtn')}</span>
            </button>
          </>
        ) : (
          headText
        )}
      </div>
      <div id="cards">
        {mi && (
          <div className={'mhero m-' + nav.mod}>
            <div className="mhero-name">{s.lang === 'en' ? mi.nameEN : mi.nameTH}</div>
            <div className="mhero-en">{s.lang === 'en' ? mi.nameTH : mi.nameEN}</div>
            <div className="mhero-desc">{s.lang === 'en' ? mi.descEN : mi.descTH}</div>
          </div>
        )}
        {rows.length === 0 ? (
          <div className="empty">{emptyMsg}</div>
        ) : (
          rows.map((sc) => {
            const title = s.lang === 'en' && sc.titleEN ? sc.titleEN : sc.titleTH;
            return (
              <div
                key={sc.no}
                className={'lcard m-' + sc.module + (nav.sel === sc.no ? ' active' : '')}
                data-key={sc.no}
                onClick={() => s.selectItem(sc.no)}
              >
                <div className="lc-top">
                  <span className="lc-no lc-no-mod">{sc.displayNo || sc.no}</span>
                </div>
                <div className="lc-title">{title}</div>
                <div className="lc-ex">{sc.when}</div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

function FlowList({ s }: { s: Store }) {
  const { nav, labels } = s;
  const q = nav.q.toLowerCase();

  const rows = useMemo(
    () =>
      SOP_FLOWS.filter((f) => {
        if (nav.flowMod !== 'ALL' && f.module !== nav.flowMod) return false;
        if (!q) return true;
        const hay = (
          f.id +
          ' ' +
          f.titleTH +
          ' ' +
          f.titleEN +
          ' ' +
          (f.narrative || []).join(' ') +
          ' ' +
          f.nodes.map((n) => n.label).join(' ')
        ).toLowerCase();
        return hay.indexOf(q) >= 0;
      }),
    [nav.flowMod, q],
  );

  const fmLbl = nav.flowMod === 'ALL' ? '' : ' · ' + nav.flowMod;
  const headText = s.t('flowsHeader') + fmLbl + ' · ' + s.t('showingFlowsFmt')(rows.length, SOP_FLOWS.length);

  // Group by module in fixed order, then any extras.
  const byMod: Record<string, typeof rows> = {};
  rows.forEach((f) => {
    (byMod[f.module] = byMod[f.module] || []).push(f);
  });
  const mods = FLOW_GROUP_ORDER.filter((m) => byMod[m]).concat(
    Object.keys(byMod).filter((m) => FLOW_GROUP_ORDER.indexOf(m) < 0),
  );

  return (
    <>
      <div className="list-head" id="listHead">
        {headText}
      </div>
      <div id="cards">
        {rows.length === 0 ? (
          <div className="empty">{s.t('noResults')}</div>
        ) : (
          mods.map((m) => (
            <div key={m}>
              <div className={'flow-group-h m-' + m}>
                <span className="fg-dot"></span>
                {m} · {labels[m] || m}
                <span className="fg-line"></span>
              </div>
              {byMod[m].map((f) => {
                const title = s.lang === 'en' && f.titleEN ? f.titleEN : f.titleTH;
                return (
                  <div
                    key={f.id}
                    className={'lcard m-' + f.module + (nav.selFlow === f.id ? ' active' : '')}
                    data-fkey={f.id}
                    onClick={() => s.selectFlow(f.id)}
                  >
                    <div className="lc-top">
                      <span className="lc-no" style={{ width: 'auto', padding: '0 6px' }}>
                        {f.id}
                      </span>
                      <span className="lc-badge">{f.module}</span>
                    </div>
                    <div className="lc-title">{title}</div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </>
  );
}

export default function ListPane({ s }: { s: Store }) {
  return (
    <section className="list">
      <MBack s={s} />
      {s.nav.view === 'flows' ? <FlowList s={s} /> : s.nav.view === 'sop' ? <ScenarioList s={s} /> : null}
    </section>
  );
}
