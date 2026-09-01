/** Left sidebar: 3-branch nav (Process Flows · Case Studies · Reports) with
 *  module submenus, counts, active states, and the mobile home intro / footer.
 *  Mirrors buildSidebar() + setActiveSidebar() in index.html. */
import { useMemo } from 'react';
import type { Store } from '../store';
import { Icon } from '../lib/icons';
import { MODULES, MODULE_INFO, APP_VERSION } from '../data/config';
import { SOP_FLOWS } from '../data/flows';

const FLOW_MOD_ORDER = ['BD', 'PO', 'IC', 'OF', 'AP', 'AR', 'FA', 'GL'];

function Chevron() {
  return (
    <svg className="cs-chevron" viewBox="0 0 24 24" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function Sidebar({ s }: { s: Store }) {
  const { nav, labels } = s;

  const scenarioCounts = useMemo(() => {
    const present: Record<string, number> = {};
    s.scenarios.forEach((x) => (present[x.module] = (present[x.module] || 0) + 1));
    return present;
  }, [s.scenarios]);

  const flowCounts = useMemo(() => {
    const present: Record<string, number> = {};
    SOP_FLOWS.forEach((f) => (present[f.module] = (present[f.module] || 0) + 1));
    return present;
  }, []);

  const flowsOpen = nav.view === 'flows' && !nav.navCollapsed;
  const csOpen = nav.view === 'sop' && !nav.navCollapsed;

  const sidebarCls =
    'sidebar' + (flowsOpen ? ' flows-open' : '') + (csOpen ? ' cs-open' : '');

  return (
    <aside className={sidebarCls}>
      <div className="m-home" id="mHome">
        <h2 className="mh-title">{s.t('homeHeading')}</h2>
        <p className="mh-lead">{s.t('homeLead')}</p>
      </div>

      {/* 1) Process Flows */}
      <button
        className={'mod cs-root' + (nav.view === 'flows' && nav.flowMod === 'ALL' ? ' active' : '')}
        id="flowsHeader"
        type="button"
        aria-expanded={flowsOpen}
        aria-controls="flowModules"
        onClick={s.selectFlows}
      >
        <span className="mod-ico">
          <Icon name="workflow" />
        </span>
        <span className="mn">
          <b>{s.t('flowsTitle')}</b>
          <small>{s.t('flowsDesc')}</small>
        </span>
        <span className="cnt" id="flowCount">
          {SOP_FLOWS.length}
        </span>
        <Chevron />
      </button>
      <div id="flowModules" className="cs-children">
        {FLOW_MOD_ORDER.filter((m) => flowCounts[m]).map((m) => (
          <button
            key={m}
            className={'mod m-' + m + (nav.view === 'flows' && nav.flowMod === m ? ' active' : '')}
            data-mod={m}
            onClick={() => s.selectFlowModule(m)}
          >
            <span className="dot"></span>
            <span className="mn">
              <b>{m}</b>
              <small>{labels[m] || MODULES[m as keyof typeof MODULES]}</small>
            </span>
            <span className="cnt">{flowCounts[m]}</span>
          </button>
        ))}
      </div>

      {/* 2) Case Studies */}
      <button
        className={'mod cs-root' + (nav.view === 'sop' && nav.mod === 'ALL' ? ' active' : '')}
        id="csHeader"
        type="button"
        aria-expanded={csOpen}
        aria-controls="modules"
        onClick={s.selectCaseStudies}
      >
        <span className="mod-ico">
          <Icon name="clipboard" />
        </span>
        <span className="mn">
          <b>{s.t('caseStudiesTitle')}</b>
          <small>{s.t('caseStudiesDesc')}</small>
        </span>
        <span className="cnt" id="csCount">
          {s.scenarios.length}
        </span>
        <Chevron />
      </button>
      <div id="modules" className="cs-children">
        {Object.keys(MODULES).map((m) => {
          const count = scenarioCounts[m] || 0;
          const info = MODULE_INFO[m as keyof typeof MODULE_INFO];
          let tip: string | undefined;
          if (info) {
            const primaryName = s.lang === 'en' ? info.nameEN : info.nameTH;
            const secondaryName = s.lang === 'en' ? info.nameTH : info.nameEN;
            const dsc = s.lang === 'en' ? info.descEN : info.descTH;
            tip = primaryName + ' · ' + secondaryName + '\n' + dsc;
          }
          return (
            <button
              key={m}
              className={
                'mod m-' + m + (count ? '' : ' is-empty') +
                (nav.view === 'sop' && nav.mod === m ? ' active' : '')
              }
              data-mod={m}
              title={tip}
              onClick={() => s.selectModule(m)}
            >
              <span className="dot"></span>
              <span className="mn">
                <b>{m}</b>
                <small>{labels[m] || MODULES[m as keyof typeof MODULES]}</small>
              </span>
              <span className="cnt">{count}</span>
            </button>
          );
        })}
      </div>

      {/* 3) Reports (leaf) */}
      <button
        className={'mod m-RP' + (nav.view === 'reports' ? ' active' : '')}
        data-view="reports"
        onClick={s.selectReports}
      >
        <span className="mod-ico">
          <Icon name="barchart" />
        </span>
        <span className="mn">
          <b>{s.t('reportsTitle')}</b>
          <small>{s.t('reportsDesc')}</small>
        </span>
        <span className="cnt" id="repCount">
          {s.reports.length}
        </span>
        <span className="cs-chevron-spacer" aria-hidden="true"></span>
      </button>

      <div className="side-foot" id="sideFoot">
        {s.t('versionLbl')}
        {s.meta.version} · {s.t('effectiveLbl')}
        {s.meta.effective}
        <br />
        {s.lang === 'en' ? 'Scope' : 'ขอบเขต'}: {s.meta.scope}
        <br />
        {s.meta.manual}
        <br />
        <span style={{ opacity: 0.6, fontSize: '10px' }}>{APP_VERSION}</span>
      </div>
    </aside>
  );
}
