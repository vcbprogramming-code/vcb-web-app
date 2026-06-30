/** Right detail pane: welcome placeholder, scenario detail, reports table, or a
 *  process-flow diagram. Mirrors renderDetail(), placeholder(),
 *  renderFlowDetail(), and stepsHtml() in index.html. */
import { useMemo } from 'react';
import type { Store } from '../store';
import type { Scenario } from '../data/types';
import { Icon } from '../lib/icons';
import FlowDiagram from './FlowDiagram';
import { SOP_FLOWS } from '../data/flows';

function MBackDetail({ s }: { s: Store }) {
  const label = s.nav.view === 'reports' ? s.t('backModules') : s.t('backList');
  return (
    <button className="mback" type="button" onClick={s.mobileBack} aria-label="ย้อนกลับ">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      <span id="mbackDetailLabel">{label}</span>
    </button>
  );
}

/** The welcome / home page shown when nothing is selected (sop & flows views). */
function Welcome({ s }: { s: Store }) {
  const m = s.meta;
  return (
    <div className="welcome">
      <h2 className="w-title">{m.title}</h2>
      {m.subtitle && <p className="w-sub">{m.subtitle}</p>}
      <div className="w-stats">
        <span>
          {s.t('versionLbl')}
          {m.version}
        </span>
        <span>
          {s.t('effectiveLbl')}
          {m.effective}
        </span>
        <span>
          {s.scenarios.length}
          {s.t('casesSuffix')}
        </span>
        <span>
          {s.reports.length}
          {s.t('reportsSuffix')}
        </span>
        <span>{m.manual}</span>
      </div>
      {m.purpose && (
        <div className="w-box">
          <p className="w-lbl">{s.t('purposeHdr')}</p>
          <p className="w-txt">{m.purpose}</p>
        </div>
      )}
      <div className="howto">
        <div className="howto-card">
          <span className="ht-n">1</span>
          <div className="ht-t">{s.t('ht1Title')}</div>
          <div className="ht-d">{s.t('ht1Desc')}</div>
        </div>
        <div className="howto-card">
          <span className="ht-n">2</span>
          <div className="ht-t">{s.t('ht2Title')}</div>
          <div className="ht-d">{s.t('ht2Desc')}</div>
        </div>
        <div className="howto-card">
          <span className="ht-n">3</span>
          <div className="ht-t">{s.t('ht3Title')}</div>
          <div className="ht-d">{s.t('ht3Desc')}</div>
        </div>
      </div>
      {m.notes && m.notes.length > 0 && (
        <div className="w-notes">
          <p className="w-lbl">{s.t('notesHdr')}</p>
          <ul>
            {m.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Ordered steps; a leading "» " marks a sub-step (mirrors stepsHtml). */
function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="steps">
      {steps.map((line, i) =>
        line.indexOf('» ') === 0 ? (
          <li key={i} className="sub">
            <span className="stxt">{line.slice(2)}</span>
          </li>
        ) : (
          <li key={i}>{line}</li>
        ),
      )}
    </ol>
  );
}

function ScenarioDetail({ s, sc }: { s: Store; sc: Scenario }) {
  const primaryTitle = s.lang === 'en' && sc.titleEN ? sc.titleEN : sc.titleTH;
  const secondaryTitle = s.lang === 'en' && sc.titleEN ? sc.titleTH : sc.titleEN || '';
  return (
    <div className={'d-wrap m-' + sc.module}>
      <div className="d-head">
        <div className="d-num">{sc.no}</div>
        <div className="d-titles">
          <div className="d-th">{primaryTitle}</div>
          <div className="d-en">{secondaryTitle}</div>
        </div>
        <span className="d-badge">{sc.module}</span>
        {s.isAdmin && (
          <button className="d-edit" onClick={() => s.openEditModal(sc.no)}>
            <Icon name="edit" />
            <span>{s.t('editBtn')}</span>
          </button>
        )}
      </div>
      <div className="d-sec">
        <p className="lbl accent">{s.t('problemLbl')}</p>
        <div className="ptext">{sc.when}</div>
      </div>
      <div className="d-sec">
        <p className="lbl">{s.t('solutionLbl')}</p>
        <Steps steps={sc.steps} />
        {sc.note && (
          <div className="note">
            <Icon name="alert" extraCls="note-ico" />
            <div>
              <b>{s.t('noteLbl')}</b> {sc.note}
            </div>
          </div>
        )}
      </div>
      <div className="d-ref">
        <svg viewBox="0 0 24 24">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
        {sc.ref}
      </div>
    </div>
  );
}

function ReportsDetail({ s }: { s: Store }) {
  const q = s.nav.q.toLowerCase();
  const rows = useMemo(
    () =>
      s.reports.filter((r) => {
        if (!q) return true;
        return (r.case + ' ' + r.scenario + ' ' + r.path).toLowerCase().indexOf(q) >= 0;
      }),
    [s.reports, q],
  );

  return (
    <div className="d-wrap" style={{ maxWidth: 'none' }}>
      <div className="d-head" style={{ paddingBottom: '10px', marginBottom: '12px' }}>
        <span className="d-hicon">
          <Icon name="barchart" />
        </span>
        <div className="d-titles">
          <div className="d-th">{s.t('reportsHeader')}</div>
          <div className="d-en">{s.t('reportsSubFmt')(rows.length, s.reports.length)}</div>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="empty">{s.t('noResultsRep')}</div>
      ) : (
        <div className="rep-wrap">
          <table className="rep-table">
            <thead>
              <tr>
                <th>{s.t('reportsCol1')}</th>
                <th>{s.t('reportsCol2')}</th>
                <th>{s.t('reportsCol3')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="rt-no">{r.case}</td>
                  <td>{r.scenario}</td>
                  <td className="rt-path">{r.path}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FlowDetail({ s }: { s: Store }) {
  if (s.nav.selFlow == null) return <Welcome s={s} />;
  const f = SOP_FLOWS.find((x) => x.id === s.nav.selFlow);
  if (!f) return <Welcome s={s} />;
  const title = s.lang === 'en' && f.titleEN ? f.titleEN : f.titleTH;
  const sub = s.lang === 'en' && f.titleEN ? f.titleTH : f.titleEN || '';
  return (
    <div className={'d-wrap m-' + f.module} style={{ maxWidth: 'none' }}>
      <div className="d-head">
        <span className="flow-id-badge">{f.id}</span>
        <div className="d-titles">
          <div className="d-th">{title}</div>
          <div className="d-en">{sub}</div>
        </div>
        <span className="d-badge">{f.module}</span>
      </div>
      <FlowDiagram s={s} f={f} />
    </div>
  );
}

export default function DetailPane({ s }: { s: Store }) {
  let body: React.ReactNode;
  if (s.nav.view === 'reports') body = <ReportsDetail s={s} />;
  else if (s.nav.view === 'flows') body = <FlowDetail s={s} />;
  else if (s.nav.sel === null) body = <Welcome s={s} />;
  else {
    const sc = s.scenarios.find((x) => x.no === s.nav.sel);
    body = sc ? <ScenarioDetail s={s} sc={sc} /> : <Welcome s={s} />;
  }
  return (
    <main className="detail">
      <MBackDetail s={s} />
      <div id="detail">{body}</div>
    </main>
  );
}
