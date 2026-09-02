import { useI18n } from '@vcb/shared';
import CompanyStructure from '../components/orgchart/CompanyStructure.jsx';
import { Page, PageTitle } from '../components/ui.jsx';

// Company Structure on a page of its own.
//
// The original has no such page and no navigation to one - the section is
// embedded on Home, and Home is where a reader meets it. This route is kept
// only so a direct link to /company-structure still resolves; nothing in the
// app links here. Both render the same component, so the two cannot drift.

export default function OrgChartPage() {
  const { t } = useI18n();

  return (
    <Page>
      <PageTitle>{t('nav.companyStructure')}</PageTitle>
      <CompanyStructure />
    </Page>
  );
}
