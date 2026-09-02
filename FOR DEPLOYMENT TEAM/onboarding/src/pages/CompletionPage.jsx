import { useI18n } from '@vcb/shared';
import { useProgress } from '../lib/useProgress.js';
import { ALL_DEPARTMENTS } from '../data/allDepartments.js';
import CompletionCertificate from '../components/CompletionCertificate.jsx';
import { useContentText } from '../lib/contentText.js';
import { CtaButton, CtaLink, Eyebrow, Page, PageTitle } from '../components/ui.jsx';

// Ported from the original app's PAGES['completion'] (content.html) — a real
// dedicated page, gated by isEmployeeOnboardingComplete(). Shows the two
// feature cards if — and only if — every phase in the employee's department is
// fully complete; otherwise a "not finished yet" message, same as the original.

function isItemVisible(item, level) {
  return item.level !== 'senior' || level === 'senior';
}

export default function CompletionPage() {
  const { name, department, level, loaded, isTaskDone } = useProgress();
  const { t } = useI18n();
  const tc = useContentText();

  if (!loaded) {
    return (
      <Page>
        <p className="text-ink-muted dark:text-ink-dark-muted">{t('progress.loading')}</p>
      </Page>
    );
  }

  const dept = department ? ALL_DEPARTMENTS.find((d) => d.id === department) : undefined;

  const complete =
    !!name &&
    !!dept &&
    dept.content.phases.every((phase) =>
      phase.page.blocks
        .flatMap((b) => b.items)
        .filter((item) => isItemVisible(item, level))
        .every((item) => isTaskDone(item.id))
    );

  if (!complete || !dept) {
    return (
      <Page>
        <PageTitle>{t('completion.notFinished')}</PageTitle>
        <p className="text-ink-subtle dark:text-ink-dark-muted">
          {t('completion.notFinishedBody')}
        </p>
        <div>
          <CtaLink to="/required-documents">{t('completion.returnToChecklist')}</CtaLink>
        </div>
      </Page>
    );
  }

  return (
    <>
      {/* print:hidden — the on-screen page is suppressed when printing so the
          certificate below is the only thing on the paper. */}
      <Page className="print:hidden">
        <div>
          <Eyebrow>{t('completion.eyebrow')}</Eyebrow>
          <PageTitle>{t('completion.welcome')}</PageTitle>
        </div>

        {/* Each card carries its photograph and its "Learn more" link, as in
            the original. Both were text-only here because the two pages they
            lead to had not been ported, so the links had nowhere to go. */}
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              to: '/meet-our-team',
              image: '/img/meet-team-nyp2019-award.jpg',
              title: 'Meet Our Team',
              body: 'Explore the infrastructure works that define our execution standards. Each project reflects coordination, discipline, and long-term durability.',
            },
            {
              to: '/life-on-site',
              image: '/img/los-toolbox-real.jpg',
              title: 'Check Out Life on Site',
              body: 'From early morning briefings to milestone handovers, our teams operate in dynamic environments where teamwork and structure drive results.',
            },
          ].map((card) => (
            <div
              key={card.to}
              className="flex flex-col overflow-hidden rounded-card border border-line bg-surface-card shadow-card dark:border-line-dark dark:bg-surface-dark-card"
            >
              <img
                src={card.image}
                alt={tc(card.title)}
                loading="lazy"
                className="h-[200px] w-full object-cover"
              />
              <div className="flex flex-1 flex-col gap-2 p-5">
                <h3 className="text-lg font-bold">{tc(card.title)}</h3>
                <p className="text-sm text-ink-muted dark:text-ink-dark-muted">{tc(card.body)}</p>
                <div className="mt-auto pt-3">
                  <CtaLink to={card.to}>{t('gallery.learnMore')}</CtaLink>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div>
          <CtaButton variant="secondary" onClick={() => window.print()}>
            {t('completion.print')}
          </CtaButton>
        </div>
      </Page>

      {/* hidden until print — the certificate is a paper form, not a screen. */}
      <div className="hidden print:block">
        <CompletionCertificate name={name} dept={dept} level={level} />
      </div>
    </>
  );
}
