/** Middle list pane: scenario cards (Case Studies) or the grouped flow list
 *  (Process Flows). Hidden in Reports view via body.reports-mode CSS.
 *  Mirrors renderList() + renderFlowList() in index.html. */
import { useMemo } from 'react';
import type { Store } from '../store';
import { MODULES, MODULES_EN, MODULE_INFO } from '../data/config';
import { SOP_FLOWS } from '../data/flows';

const FLOW_GROUP_ORDER = ['BD', 'PO', 'IC', 'OF', 'AP', 'AR', 'FA', 'GL'];

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

  const rows = useMemo(
    () =>
      s.scenarios.filter((sc) => {
        if (nav.mod !== 'ALL' && sc.module !== nav.mod) return false;
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
          sc.ref
        ).toLowerCase();
        return hay.indexOf(q) >= 0;
      }),
    [s.scenarios, nav.mod, q],
  );

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
        {headText}
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
                  <span className="lc-no">{sc.no}</span>
                  <span className="lc-badge">{sc.module}</span>
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
