import { Link, useParams } from 'react-router-dom';
import { useI18n } from '@vcb/shared';
import { getDepartmentByLandingKey } from '../data/allDepartments.js';
import { useContentText } from '../lib/contentText.js';
import { Page, PageTitle, Section } from '../components/ui.jsx';

// Ported from the original app's deptLanding() builder (content.html) —
// Meet Your Supervisor / Department Overview / Onboarding Phases.

export default function DepartmentLanding() {
  const { pageKey: deptSlug } = useParams();
  const { t } = useI18n();
  const tc = useContentText();
  const dept = deptSlug ? getDepartmentByLandingKey(deptSlug) : undefined;

  if (!dept) {
    return (
      <Page>
        <PageTitle>{t('dept.notFound')}</PageTitle>
        <Link
          to="/required-documents"
          className="font-semibold text-accent underline underline-offset-2 dark:text-accent-dark"
        >
          {t('dept.backToSelection')}
        </Link>
      </Page>
    );
  }

  const { content } = dept;

  return (
    <Page>
      <PageTitle>{tc(content.title)}</PageTitle>

      <Section title={t('dept.meetSupervisor')}>
        <p>{tc(content.supervisor)}</p>
      </Section>

      <Section title={t('dept.overview')}>
        {content.overview.map((p) => (
          <p key={p} className="mb-3 last:mb-0">
            {tc(p)}
          </p>
        ))}
        <ul className="my-3 list-disc space-y-1 pl-5">
          {content.bullets.map((b) => (
            <li key={b}>{tc(b)}</li>
          ))}
        </ul>
        <p className="mt-4 border-l-4 border-accent pl-4 font-semibold italic dark:border-accent-dark">
          {tc(content.footerQuote)}
        </p>
      </Section>

      <Section title={t('dept.workflow')}>
        {content.workflow.map((p) => (
          <p key={p} className="mb-3 last:mb-0">
            {tc(p)}
          </p>
        ))}
        {/* .erp-flow-photo. The original shows this diagram on every
            department landing page and it was absent here. object-contain,
            not cover: a cropped flowchart loses the boxes at its edges. The
            white plate is deliberate and unthemed - the diagram is drawn on
            white, so on a dark page it needs its own ground. */}
        <img
          src="/img/erp-flowchart.jpg"
          alt={t('dept.workflow')}
          loading="lazy"
          className="mt-4 max-h-[480px] w-full rounded-xl border border-line bg-white object-contain p-2 dark:border-line-dark"
        />
      </Section>

      <Section title={t('dept.phases')}>
        <div className="grid gap-4 sm:grid-cols-3">
          {content.phases.map((phase) => (
            <Link
              key={phase.dayRange}
              to={`/${dept.phasePrefix}-${phase.dayRange}`}
              className="rounded-card border border-line bg-surface-sunken p-4 font-semibold transition-colors hover:border-accent hover:text-accent dark:border-line-dark dark:bg-surface-dark-sunken dark:hover:border-accent-dark dark:hover:text-accent-dark"
            >
              {tc(phase.page.eyebrow)}
            </Link>
          ))}
        </div>
      </Section>
    </Page>
  );
}
