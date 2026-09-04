// The shell: header, dashboard, tab bar, filter bar, and the routed view.
//
// The Apps Script app kept the current tab in a global and swapped innerHTML.
// Those tabs are now real routes, so a view is linkable, the back button works,
// and the finance team can bookmark "the ledger" rather than "the app, then
// click twice".

import React, { useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useT } from '@vcb/shared';

import { DataProvider, useData } from './lib/DataContext.jsx';
import { FilterProvider, useFilters } from './lib/FilterContext.jsx';
import { exportWorkbook } from './lib/exportExcel.js';
import { applyFilters as filterRows, filterFacilities } from './lib/lookups.js';

import Header from './components/Header.jsx';
import Dashboard from './components/Dashboard.jsx';
import FilterBar from './components/FilterBar.jsx';
import RequestDialog from './components/RequestDialog.jsx';
import TxnDialog from './components/TxnDialog.jsx';
import SettingsDialog from './components/SettingsDialog.jsx';
import { Empty, Spinner, Toast } from './components/ui.jsx';

import FacilitiesView from './views/FacilitiesView.jsx';
import LedgerView from './views/LedgerView.jsx';
import RequestsView from './views/RequestsView.jsx';
import CostView from './views/CostView.jsx';
import PlanView from './views/PlanView.jsx';
import VarianceView from './views/VarianceView.jsx';

const TABS = [
  { to: '/facilities', key: 'tab.facilities', hint: 'tab.facilitiesHint' },
  { to: '/ledger', key: 'tab.ledger', hint: 'tab.ledgerHint' },
  { to: '/requests', key: 'req.add', hint: null },
  { to: '/cost', key: 'tab.cost', hint: null },
  { to: '/plan', key: 'tab.plan', hint: 'tab.planHint', divider: true, devNote: 'tab.planDevNote' },
  { to: '/actual', key: 'tab.actual', hint: null, devNote: 'tab.planDevNote' },
  { to: '/variance', key: 'tab.variance', hint: 'tab.varianceHint', devNote: 'tab.planDevNote' },
];

export default function App() {

  // Not held behind authLoading — see hr-worklog. A failed /auth/me left the
  // app on a spinner forever; the shell renders and the data follows.
  // NOT gated - see hr-worklog. The portal authenticates and the API enforces
  // roles; this renders either way.

  return (
    <DataProvider>
      <FilterProvider>
        <Shell />
      </FilterProvider>
    </DataProvider>
  );
}

function Shell() {
  const t = useT();
  const navigate = useNavigate();
  const data = useData();
  const { filters, applyFilters, resetDrill } = useFilters();

  const [showSettings, setShowSettings] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [showTxn, setShowTxn] = useState(false);

  const { loading, error, toast, saving, projects, facTypes } = data;

  /** A dashboard card sets the filters and jumps to the table they describe. */
  const drill = (patch) => {
    resetDrill();
    applyFilters(patch);
    navigate(patch.type ? '/facilities' : '/ledger');
  };

  // The workbook covers exactly what the filter bar is currently showing —
  // "export what I am looking at". xlsx loads on demand; see lib/exportExcel.js.
  const onExport = async () => {
    const ctx = { projects, facTypes, filters };
    data.notify(t('misc.generating'));
    try {
      await exportWorkbook({
        facilities: filterFacilities(data.facilities, ctx),
        transactions: filterRows(data.transactions, ctx),
        requests: filterRows(data.requests, ctx),
        projects,
        facTypes,
      });
      data.notify(t('misc.exported'));
    } catch {
      data.notify(t('misc.failed'));
    }
  };

  return (
    <div className="min-h-screen bg-surface text-ink dark:bg-surface-dark dark:text-ink-dark">
      <Header onOpenSettings={() => setShowSettings(true)} />

      {loading ? (
        <Spinner label={t('app.loadingData')} />
      ) : error ? (
        <Empty>
          {t('app.loadDataFailed')} {t(`error.${error.code}`)}
        </Empty>
      ) : (
        <main className="mx-auto max-w-[1600px]">
          <Dashboard onDrill={drill} />

          <nav className="flex flex-wrap items-center gap-1 border-b border-line px-4 sm:px-6 dark:border-line-dark">
            {TABS.map((tab) => (
              <React.Fragment key={tab.to}>
                {tab.divider ? (
                  <span
                    aria-hidden="true"
                    className="mx-2 hidden h-5 w-px bg-line sm:inline-block dark:bg-line-dark"
                  />
                ) : null}
                <NavLink
                  to={tab.to}
                  title={tab.devNote ? t(tab.devNote) : undefined}
                  className={({ isActive }) =>
                    'focusable -mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ' +
                    (isActive
                      ? 'border-brand-700 text-brand-700 dark:border-accent-dark dark:text-accent-dark'
                      : 'border-transparent text-ink-muted hover:text-ink dark:text-ink-dark-muted dark:hover:text-ink-dark')
                  }
                >
                  {t(tab.key)}
                  {tab.hint && t(tab.hint) ? (
                    <span className="ml-1 font-normal opacity-70">{t(tab.hint)}</span>
                  ) : null}
                </NavLink>
              </React.Fragment>
            ))}
          </nav>

          <FilterBar
            onAddRequest={() => setShowRequest(true)}
            onAddTxn={() => setShowTxn(true)}
            onExport={onExport}
          />

          <Routes>
            <Route path="/" element={<Navigate to="/facilities" replace />} />
            <Route path="/facilities" element={<FacilitiesView />} />
            <Route path="/ledger" element={<LedgerView />} />
            <Route path="/requests" element={<RequestsView />} />
            <Route path="/cost" element={<CostView />} />
            {/* One component, two variants — see views/PlanView.jsx. */}
            <Route path="/plan" element={<PlanView variant="plan" />} />
            <Route path="/actual" element={<PlanView variant="actual" />} />
            <Route path="/variance" element={<VarianceView />} />
            <Route path="*" element={<Navigate to="/facilities" replace />} />
          </Routes>
        </main>
      )}

      <RequestDialog open={showRequest} request={null} onClose={() => setShowRequest(false)} />
      <TxnDialog open={showTxn} onClose={() => setShowTxn(false)} />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />

      <Toast message={saving ? t('misc.saving') : toast} />
    </div>
  );
}
