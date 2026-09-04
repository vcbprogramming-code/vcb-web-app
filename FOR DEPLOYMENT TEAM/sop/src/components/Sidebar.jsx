/**
 * Left nav: the three branches (Process Flows · Case Studies · Reports) with
 * their module submenus and counts.
 *
 * The old version tracked `navCollapsed` in the store and toggled `active`
 * classes by hand. Here the open branch is simply the one the URL is under, and
 * NavLink supplies the active state — the same behaviour with no state to keep
 * in sync.
 */

import { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useI18n } from '@vcb/shared';

import { Icon } from '../lib/icons.jsx';
import { MODULE_INFO, MODULE_ORDER, APP_VERSION, moduleColor, moduleLabel } from '../data/config.js';
import { SOP_FLOWS } from '../data/flows.js';
import { useStore } from '../store.jsx';

// Only these modules have flows; the order is the one the canonical app used.
const FLOW_MOD_ORDER = ['BD', 'PO', 'IC', 'OF', 'AP', 'AR', 'FA', 'GL'];

function branchClass({ isActive }) {
  return [
    'flex w-full items-center gap-2.5 rounded-card px-3 py-2.5 text-left transition-colors',
    isActive
      ? 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200'
      : 'text-ink hover:bg-surface-sunken dark:text-ink-dark dark:hover:bg-surface-dark-sunken',
  ].join(' ');
}

/** A top-level branch: icon, two-line label, count. */
function Branch({ to, end, icon, title, desc, count }) {
  return (
    <NavLink to={to} end={end} className={branchClass}>
      <span className="shrink-0 text-brand-700 dark:text-brand-300">
        <Icon name={icon} className="h-[18px] w-[18px]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="truncate text-sm font-bold">{title}</b>
        <small className="truncate text-xs text-ink-muted dark:text-ink-dark-muted">{desc}</small>
      </span>
      <span className="shrink-0 rounded-pill bg-surface-sunken px-2 py-0.5 text-xs font-semibold text-ink-muted dark:bg-surface-dark-sunken dark:text-ink-dark-muted">
        {count}
      </span>
    </NavLink>
  );
}

/** A module row inside an open branch. The dot carries the module's colour. */
function ModuleRow({ to, code, label, count, title, dimmed }) {
  return (
    <NavLink
      to={to}
      title={title}
      style={{ '--mc': moduleColor(code) }}
      className={({ isActive }) =>
        [
          'flex w-full items-center gap-2 rounded-control px-2.5 py-2 text-left transition-colors',
          dimmed ? 'opacity-55' : '',
          isActive
            ? 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200'
            : 'text-ink hover:bg-surface-sunken dark:text-ink-dark dark:hover:bg-surface-dark-sunken',
        ].join(' ')
      }
    >
      <span className="mc-bg h-2 w-2 shrink-0 rounded-full" aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="text-[13px] font-bold">{code}</b>
        <small className="truncate text-[11px] text-ink-muted dark:text-ink-dark-muted">{label}</small>
      </span>
      <span className="shrink-0 text-[11px] font-semibold text-ink-muted dark:text-ink-dark-muted">
        {count}
      </span>
    </NavLink>
  );
}

export default function Sidebar() {
  const { t, lang } = useI18n();
  const { scenarios, reports, meta } = useStore();
  const { pathname } = useLocation();

  // A case tagged into a module only via extraModules must still count there
  // — buildSidebar() in the original increments every extra module too, and
  // CaseListPane's own caseInModule() already matches on primary OR extra.
  // Counting primary only undercounted the badge and could show count===0
  // (dimmed/"empty") for a module that in fact had visible, filterable cases.
  const scenarioCounts = useMemo(() => {
    const n = {};
    for (const s of scenarios) {
      n[s.module] = (n[s.module] || 0) + 1;
      for (const m of s.extraModules || []) n[m] = (n[m] || 0) + 1;
    }
    return n;
  }, [scenarios]);

  const flowCounts = useMemo(() => {
    const n = {};
    for (const f of SOP_FLOWS) n[f.module] = (n[f.module] || 0) + 1;
    return n;
  }, []);

  const flowsOpen = pathname.startsWith('/flows');
  const casesOpen = pathname.startsWith('/cases');

  return (
    <nav className="flex flex-col gap-1 p-3" aria-label={t('label.module')}>
      {/* On a narrow screen this pane is the home screen, so it leads with the
          heading the canonical app showed there. */}
      <div className="mb-2 px-1 lg:hidden">
        <h2 className="text-lg font-extrabold text-brand-900 dark:text-brand-200">
          {t('welcome.heading')}
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted dark:text-ink-dark-muted">
          {t('welcome.lead')}
        </p>
      </div>

      {/* 1 — Process Flows */}
      <Branch
        to="/flows"
        end
        icon="workflow"
        title={t('flows.title')}
        desc={t('flows.desc')}
        count={SOP_FLOWS.length}
      />
      {flowsOpen && (
        <div className="mb-1 ml-3 flex flex-col gap-0.5 border-l border-line pl-2 dark:border-line-dark">
          {FLOW_MOD_ORDER.filter((m) => flowCounts[m]).map((m) => (
            <ModuleRow
              key={m}
              to={`/flows/module/${m}`}
              code={m}
              label={moduleLabel(m, lang)}
              count={flowCounts[m]}
            />
          ))}
        </div>
      )}

      {/* 2 — Case Studies */}
      <Branch
        to="/cases"
        end
        icon="clipboard"
        title={t('cases.title')}
        desc={t('cases.desc')}
        count={scenarios.length}
      />
      {casesOpen && (
        <div className="mb-1 ml-3 flex flex-col gap-0.5 border-l border-line pl-2 dark:border-line-dark">
          {MODULE_ORDER.map((m) => {
            const count = scenarioCounts[m] || 0;
            const info = MODULE_INFO[m];
            // The hero copy doubles as the row's tooltip, exactly as before.
            const tip = info
              ? `${lang === 'en' ? info.nameEN : info.nameTH} · ${
                  lang === 'en' ? info.nameTH : info.nameEN
                }\n${lang === 'en' ? info.descEN : info.descTH}`
              : undefined;
            return (
              <ModuleRow
                key={m}
                to={`/cases/module/${m}`}
                code={m}
                label={moduleLabel(m, lang)}
                count={count}
                title={tip}
                dimmed={count === 0}
              />
            );
          })}
        </div>
      )}

      {/* 3 — Reports (leaf) */}
      <Branch
        to="/reports"
        icon="barchart"
        title={t('reports.title')}
        desc={t('reports.desc')}
        count={reports.length}
      />

      <footer className="mt-4 border-t border-line px-2 pt-3 text-[11px] leading-relaxed text-ink-muted dark:border-line-dark dark:text-ink-dark-muted">
        {meta.version && (
          <div>
            {t('welcome.version')}
            {meta.version} · {t('welcome.effective')}
            {meta.effective}
          </div>
        )}
        {meta.scope && (
          <div>
            {lang === 'en' ? 'Scope' : 'ขอบเขต'}: {meta.scope}
          </div>
        )}
        {meta.manual && <div>{meta.manual}</div>}
        <div className="mt-1 opacity-60">{APP_VERSION}</div>
      </footer>
    </nav>
  );
}
