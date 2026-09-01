import { useState } from 'react';
import { useI18n } from '@vcb/shared';
import OrgChart from '../components/orgchart/OrgChart.jsx';
import GroupStructure from '../components/orgchart/GroupStructure.jsx';
import { Page, PageTitle } from '../components/ui.jsx';

// Company Structure. In the original this lived inline on Home, below Our
// Track Record; here it also has its own route, which makes it directly
// linkable. Nothing stops embedding <OrgChart /> on Home as well.

export default function OrgChartPage() {
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
    <Page>
      <PageTitle>{t('nav.companyStructure')}</PageTitle>

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
    </Page>
  );
}
