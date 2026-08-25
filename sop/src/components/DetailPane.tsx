/** Right detail pane: welcome placeholder, scenario detail, reports table, or a
 *  process-flow diagram. Mirrors renderDetail(), placeholder(),
 *  renderFlowDetail(), and stepsHtml() in index.html. */
import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Store } from '../store';
import type { Scenario } from '../data/types';
import { Icon } from '../lib/icons';
import FlowDiagram from './FlowDiagram';
import { SOP_FLOWS } from '../data/flows';
import { classifyStep } from '../lib/steps';
import { copyText } from '../lib/copy';

/** Back button + (on mobile only) a slot the Share/Edit buttons portal into —
 *  mirrors `.mback-row` / `#mbackDetailActions` + moveDetailActionsMobile()
 *  in the canonical app. Desktop keeps Share/Edit in the title row instead
 *  (see ScenarioDetail/FlowDetail below), so the slot is simply absent there. */
function MBackDetail({ s, actionsSlotRef }: { s: Store; actionsSlotRef: (el: HTMLDivElement | null) => void }) {
  const label = s.nav.view === 'reports' ? s.t('backModules') : s.t('backList');
  return (
    <div className="mback-row">
      <button className="mback" type="button" onClick={s.mobileBack} aria-label="ย้อนกลับ">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span id="mbackDetailLabel">{label}</span>
      </button>
      <div id="mbackDetailActions" ref={actionsSlotRef}></div>
    </div>
  );
}

/** Copies a `?case=N` / `?flow=ID` deep link via copyText(), flashing a
 *  "Link copied" state on success. Mirrors shareCase()/shareFlow() (thin
 *  wrappers over shareLink()) in the canonical app. */
function ShareButton({ s, queryParam, value }: { s: Store; queryParam: 'case' | 'flow'; value: string | number }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onClick() {
    const url = s.buildShareUrl(queryParam, value);
    copyText(url).then((ok) => {
      if (!ok) return;
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button className={'d-edit' + (copied ? ' copied' : '')} type="button" onClick={onClick}>
      <span className="d-share-ico">
        <Icon name={copied ? 'check' : 'link'} />
      </span>
      <span className="d-share-label">{copied ? s.t('shareCopied') : s.t('shareBtn')}</span>
    </button>
  );
}

/** Renders Share/Edit-row children inline in the title row on desktop, or
 *  portals them into the sticky back-bar slot on mobile — mirrors
 *  moveDetailActionsMobile() relocating `.d-edit` buttons from `.d-head`
 *  into `#mbackDetailActions` on mobile only (a no-op on desktop). */
function DetailActions({
  s,
  slot,
  children,
}: {
  s: Store;
  slot: HTMLDivElement | null;
  children: React.ReactNode;
}) {
  if (s.isMobile && slot) return createPortal(children, slot);
  return <>{children}</>;
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

/** Ordered steps: numbered (auto-numbered by the CSS counter), '» '-depth
 *  sub-bullets, or '· ' plain captions with no marker (mirrors stepsHtml). */
function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="steps">
      {steps.map((line, i) => {
        const st = classifyStep(line);
        if (st.kind === 'caption') return <li key={i} className="cap">{st.text}</li>;
        if (st.kind === 'sub') {
          return (
            <li key={i} className={'sub sub-' + Math.min(st.depth, 3)}>
              <span className="stxt">{st.text}</span>
            </li>
          );
        }
        return <li key={i}>{st.text}</li>;
      })}
    </ol>
  );
}

/** Drive file id out of the usual link shapes; '' for a non-Drive URL. */
function driveFileId(url: string): string {
  const u = String(url || '');
  const m =
    u.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/) ||
    u.match(/[?&]id=([a-zA-Z0-9_-]{10,})/) ||
    u.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  return m ? m[1] : '';
}

/** Related Files rail — mirrors the Apps Script build. Renders on every case so
 * the layout never shifts; a case with no files shows the empty line instead. */
function AttachmentsRail({ s, sc }: { s: Store; sc: Scenario }) {
  const atts = sc.attachments || [];
  return (
    <aside className={'d-att-rail' + (atts.length ? '' : ' is-empty')}>
      <div className="d-att-inner">
        <div className="d-att-h">{s.t('attachmentsLbl')}</div>
        {atts.length === 0 && <div className="d-att-empty">{s.t('attachmentsNone')}</div>}
        {atts.map((a, i) => {
          const id = driveFileId(a.url);
          const label = a.label && a.label !== a.url ? a.label : s.t('attachmentsFile');
          return (
            <a
              key={i}
              className="d-att-card"
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              title={label}
            >
              <div className={'d-att-thumb' + (id ? '' : ' no-thumb')}>
                {id && (
                  <img
                    className="d-att-img"
                    src={`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w600`}
                    alt={label}
                    loading="lazy"
                    onError={(ev) => ev.currentTarget.parentElement?.classList.add('no-thumb')}
                  />
                )}
                <svg className="d-att-ico" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
              </div>
              <div className="d-att-name">{label}</div>
            </a>
          );
        })}
      </div>
    </aside>
  );
}

function ScenarioDetail({ s, sc, actionsSlot }: { s: Store; sc: Scenario; actionsSlot: HTMLDivElement | null }) {
  const primaryTitle = s.lang === 'en' && sc.titleEN ? sc.titleEN : sc.titleTH;
  const secondaryTitle = s.lang === 'en' && sc.titleEN ? sc.titleTH : sc.titleEN || '';
  return (
    <div className={'d-wrap m-' + sc.module}>
      <div className="d-head">
        <div className="d-num">{sc.displayNo || sc.no}</div>
        <div className="d-titles">
          <div className="d-th">{primaryTitle}</div>
          <div className="d-en">{secondaryTitle}</div>
        </div>
        <DetailActions s={s} slot={actionsSlot}>
          <ShareButton s={s} queryParam="case" value={sc.no} />
          {s.isAdmin && (
            <button className="d-edit" onClick={() => s.openEditModal(sc.no)}>
              <Icon name="edit" />
              <span>{s.t('editBtn')}</span>
            </button>
          )}
        </DetailActions>
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
      {sc.dateAdded && (
        <div className="d-ref">
          <Icon name="calendar" />
          {s.t('dateAddedLbl')} {sc.dateAdded}
        </div>
      )}
    </div>
  );
}

/** Case body + the Related Files rail beside it. The rail always renders, so
 * the column widths are identical from case to case (see .d-cols in styles). */
function ScenarioDetailWithRail(props: { s: Store; sc: Scenario; actionsSlot: HTMLDivElement | null }) {
  return (
    <div className="d-cols">
      <div className="d-cols-main">
        <ScenarioDetail {...props} />
      </div>
      <AttachmentsRail s={props.s} sc={props.sc} />
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
        {s.isAdmin && (
          <button
            type="button"
            className="d-edit"
            style={{ marginLeft: 'auto' }}
            onClick={s.openNewReportModal}
          >
            <Icon name="plus" />
            <span>{s.t('newReportBtn')}</span>
          </button>
        )}
        <a
          className="d-edit"
          style={{ marginLeft: s.isAdmin ? '8px' : 'auto' }}
          href="https://notebooklm.google.com/notebook/17c8699a-9e2d-4d3b-8a74-51a3cf8ba64c"
          target="_blank"
          rel="noopener"
        >
          <Icon name="externalLink" />
          <span>{s.t('notebookLM')}</span>
        </a>
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

function FlowDetail({ s, actionsSlot }: { s: Store; actionsSlot: HTMLDivElement | null }) {
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
        <DetailActions s={s} slot={actionsSlot}>
          <ShareButton s={s} queryParam="flow" value={f.id} />
        </DetailActions>
        <span className="d-badge">{f.module}</span>
      </div>
      <FlowDiagram s={s} f={f} />
    </div>
  );
}

export default function DetailPane({ s }: { s: Store }) {
  // A plain ref wouldn't trigger a re-render when the slot div first mounts,
  // so the portal target would stay stale at null for that render — a state
  // + callback ref makes mounting the slot itself trigger the re-render that
  // lets Share/Edit portal into it.
  const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null);
  const actionsSlotRef = useCallback((el: HTMLDivElement | null) => setActionsSlot(el), []);
  let body: React.ReactNode;
  if (s.nav.view === 'reports') body = <ReportsDetail s={s} />;
  else if (s.nav.view === 'flows') body = <FlowDetail s={s} actionsSlot={actionsSlot} />;
  else if (s.nav.sel === null) body = <Welcome s={s} />;
  else {
    const sc = s.scenarios.find((x) => x.no === s.nav.sel);
    body = sc ? <ScenarioDetailWithRail s={s} sc={sc} actionsSlot={actionsSlot} /> : <Welcome s={s} />;
  }
  return (
    <main className="detail">
      <MBackDetail s={s} actionsSlotRef={actionsSlotRef} />
      <div id="detail">{body}</div>
    </main>
  );
}
