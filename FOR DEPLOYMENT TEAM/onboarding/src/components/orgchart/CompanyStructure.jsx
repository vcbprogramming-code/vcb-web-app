import { useState } from 'react';
import { useI18n } from '@vcb/shared';
import OrgChart from './OrgChart.jsx';
import GroupStructure from './GroupStructure.jsx';

// The Company Structure block: the chart/group toggle, the subheading that goes
// with whichever view is showing, and the tree itself.
//
// This is its own component because the original renders it inline on Home,
// directly beneath Our Track Record. content.html says why, in the section it
// replaced: "removed entirely per explicit request: embed it, don't navigate
// to it" - an employee reading Home should not have to click away and lose
// their place.
//
// The subheading is per-view rather than shared. content.html records that too:
// one shared subheading read wrong on Group Structure, because "click
// Leadership" means nothing where there is nothing to click.
export default function CompanyStructure() {
  const { t } = useI18n();
  const [view, setView] = useState('chart');

  const tabClass = (active) =>
    [
      'rounded-pill px-4 py-1.5 text-sm font-semibold transition-colors',
      active
        ? 'bg-accent text-white dark:bg-accent-dark dark:text-surface-dark'
        : 'text-ink-muted hover:text-ink dark:text-ink-dark-muted dark:hover:text-ink-dark',
    ].join(' ');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-fit gap-1 rounded-pill bg-surface-sunken p-1 dark:bg-surface-dark-sunken">
        <button type="button" className={tabClass(view === 'chart')} onClick={() => setView('chart')}>
          {t('org.chart')}
        </button>
        <button type="button" className={tabClass(view === 'group')} onClick={() => setView('group')}>
          {t('org.group')}
        </button>
      </div>

      <p className="text-sm text-ink-muted dark:text-ink-dark-muted">
        {view === 'chart' ? t('org.chartHint') : t('org.groupHint')}
      </p>

      {view === 'chart' ? <OrgChart /> : <GroupStructure />}
    </div>
  );
}
