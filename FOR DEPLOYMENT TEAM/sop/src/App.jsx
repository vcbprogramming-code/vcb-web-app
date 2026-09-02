/**
 * Routes and the three-pane shell.
 *
 * The old app faked navigation with a `nav` object in the store and drove the
 * mobile panes by toggling body classes (m-list / m-detail / reports-mode).
 * React Router owns that now, which is what makes a case shareable: the deep
 * links the old app hand-rolled as `?case=N` / `?flow=ID` are simply routes.
 *
 *   /                              → the saved default branch
 *   /flows                         → flow list, welcome on the right
 *   /flows/module/:mod             → flow list filtered to one module
 *   /flows/:id                     → one swimlane diagram
 *   /cases                         → all cases
 *   /cases/module/:mod             → cases in one module
 *   /cases/:no                     → one case, detail on the right
 *   /reports                       → the report table (no list pane)
 *   /versions                      → editor-only version history
 *
 * Legacy `?case=N` / `?flow=ID` links from the Apps Script app still work —
 * LegacyQueryRedirect below translates them once, so links already pasted into
 * chats and emails do not break.
 *
 * The panes are laid out with Tailwind's responsive grid rather than the old
 * is-mobile class: below lg the three panes stack into one column and which one
 * shows is decided by the route, which is the same behaviour the body classes
 * used to produce, minus the imperative bookkeeping.
 */

import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useT } from '@vcb/shared';

import TopBar from './components/TopBar.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import Sidebar from './components/Sidebar.jsx';
import CaseListPane from './components/CaseListPane.jsx';
import FlowListPane from './components/FlowListPane.jsx';
import CaseDetail from './components/CaseDetail.jsx';
import FlowDetail from './components/FlowDetail.jsx';
import ReportsView from './components/ReportsView.jsx';
import VersionsView from './components/VersionsView.jsx';
import Welcome from './components/Welcome.jsx';
import NotSeeded from './components/NotSeeded.jsx';
import LoadError from './components/LoadError.jsx';
import { STATUS, defaultViewPath, useStore } from './store.jsx';

/* ------------------------------- legacy links ----------------------------- */

/**
 * `?case=N` and `?flow=ID` were the canonical app's share links. Translate them
 * to routes once, replacing the history entry so Back does not bounce.
 */
function LegacyQueryRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const caseNo = params.get('case');
    const flowId = params.get('flow');
    if (caseNo && /^\d+$/.test(caseNo)) {
      navigate(`/cases/${caseNo}`, { replace: true });
    } else if (flowId) {
      navigate(`/flows/${encodeURIComponent(flowId)}`, { replace: true });
    }
  }, [location.search, navigate]);

  return null;
}

/* ---------------------------------- panes --------------------------------- */

/**
 * One pane of the three-column layout.
 *
 * `show` decides which pane is visible on a narrow screen — exactly one is, and
 * the route decides which. On lg and up every pane is visible and `show` is
 * irrelevant, which is why the hidden/block pair is scoped to below lg.
 */
function Pane({ show, className = '', children }) {
  return (
    <div className={`${show ? 'block' : 'hidden'} lg:block min-h-0 overflow-y-auto ${className}`}>
      {children}
    </div>
  );
}

/** Turns /cases/:no into the detail pane, and remembers that a case is open so
 * the narrow layout shows detail rather than the list. */
function CaseRoute() {
  const { no } = useParams();
  return <CaseDetail no={Number(no)} />;
}

function FlowRoute() {
  const { id } = useParams();
  return <FlowDetail id={id} />;
}

/* ---------------------------------- shell --------------------------------- */

export default function App() {
  const t = useT();
  const { status } = useStore();
  const location = useLocation();

  const path = location.pathname;
  const isReports = path.startsWith('/reports');
  const isVersions = path.startsWith('/versions');
  const isFlows = path.startsWith('/flows');
  const isCases = path.startsWith('/cases');

  // Which pane a narrow screen shows. Detail wins when something is selected,
  // the list when a branch is open, otherwise the sidebar (the "home menu" the
  // canonical app opened phones to).
  const hasSelection =
    /^\/cases\/\d+$/.test(path) || (isFlows && /^\/flows\/[^/]+$/.test(path) && !path.startsWith('/flows/module'));
  const showDetail = hasSelection || isReports || isVersions;
  const showList = !showDetail && (isFlows || isCases);
  const showSidebar = !showDetail && !showList;

  // Reports and Versions are full-width: they have no list pane of their own,
  // which is what the old body.reports-mode rule expressed.
  const wide = isReports || isVersions;

  // The module-specific settings (default view, versions, about, contact) live
  // in this modal. The shared settings sheet owns theme and language; this
  // opens from a row inside it, so there is still one gear.
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-surface text-ink dark:bg-surface-dark dark:text-ink-dark">
      <LegacyQueryRedirect />
      <TopBar onSettings={() => setSettingsOpen(true)} />

      <div
        className={`grid min-h-0 flex-1 grid-cols-1 ${
          wide ? 'lg:grid-cols-panes-reports' : 'lg:grid-cols-panes'
        }`}
      >
        <Pane
          show={showSidebar}
          className="border-line bg-surface-alt lg:border-r dark:border-line-dark dark:bg-surface-dark-alt"
        >
          <Sidebar />
        </Pane>

        {!wide && (
          <Pane
            show={showList}
            className="border-line bg-surface-alt lg:border-r dark:border-line-dark dark:bg-surface-dark-alt"
          >
            <Routes>
              <Route path="/flows" element={<FlowListPane />} />
              <Route path="/flows/module/:mod" element={<FlowListPane />} />
              <Route path="/flows/:id" element={<FlowListPane />} />
              <Route path="/cases" element={<CaseListPane />} />
              <Route path="/cases/module/:mod" element={<CaseListPane />} />
              <Route path="/cases/:no" element={<CaseListPane />} />
              <Route path="*" element={null} />
            </Routes>
          </Pane>
        )}

        <Pane show={showDetail} className="bg-surface-card dark:bg-surface-dark-card">
          {status === STATUS.error ? (
            <LoadError />
          ) : (
            <Routes>
              <Route path="/" element={<Navigate to={defaultViewPath()} replace />} />

              <Route path="/flows" element={<Welcome />} />
              <Route path="/flows/module/:mod" element={<Welcome />} />
              <Route path="/flows/:id" element={<FlowRoute />} />

              <Route
                path="/cases"
                element={status === STATUS.notSeeded ? <NotSeeded /> : <Welcome />}
              />
              <Route
                path="/cases/module/:mod"
                element={status === STATUS.notSeeded ? <NotSeeded /> : <Welcome />}
              />
              <Route
                path="/cases/:no"
                element={status === STATUS.notSeeded ? <NotSeeded /> : <CaseRoute />}
              />

              <Route
                path="/reports"
                element={status === STATUS.notSeeded ? <NotSeeded /> : <ReportsView />}
              />
              <Route path="/versions" element={<VersionsView />} />

              {/* An unknown path lands on the default branch rather than a 404
                  screen — every route here is content, so there is nothing
                  useful to say about a wrong one. */}
              <Route path="*" element={<Navigate to={defaultViewPath()} replace />} />
            </Routes>
          )}
        </Pane>
      </div>

      {/* Screen-reader announcement of the load state; the panes above show it
          visually, but a status change is otherwise silent. */}
      <div className="sr-only" role="status" aria-live="polite">
        {status === STATUS.loading ? t('common.loading') : ''}
      </div>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
