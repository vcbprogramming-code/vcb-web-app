import { useI18n } from '@vcb/shared';
import { MEET_OUR_TEAM } from '../data/gallery.js';
import { useContentText } from '../lib/contentText.js';
import { CtaLink, Eyebrow, Page, PageTitle, Section } from '../components/ui.jsx';

// Ported from the original app's PAGES['meet-our-team'] (content.html), one of
// the two pages the completion screen's feature cards link to. Neither had
// been ported, so both cards were text with nowhere to go.
//
// The reels are type: 'trackrecord' in the original - the same carousel Home
// uses for Our Track Record, so they get the same treatment here: a flex row
// that scrolls rather than a grid that wraps.

export default function MeetOurTeamPage() {
  const { t } = useI18n();
  const tc = useContentText();

  return (
    <Page>
      <div>
        <Eyebrow>{tc(MEET_OUR_TEAM.eyebrow)}</Eyebrow>
        <PageTitle>{tc(MEET_OUR_TEAM.title)}</PageTitle>
      </div>

      <Section title={tc(MEET_OUR_TEAM.intro.heading)}>
        {MEET_OUR_TEAM.intro.body.map((p) => (
          <p key={p} className="mb-3 last:mb-0">
            {tc(p)}
          </p>
        ))}
      </Section>

      {MEET_OUR_TEAM.reels.map((reel) => (
        <Section key={reel.heading} title={tc(reel.heading)}>
          <p className="mb-3 text-sm text-ink-muted dark:text-ink-dark-muted">
            {tc(reel.subheading)}
          </p>
          <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
            {reel.slides.map((slide) => (
              <div
                key={slide.image}
                className="flex w-[320px] shrink-0 snap-start flex-col gap-2 sm:w-[360px]"
              >
                <img
                  src={slide.image}
                  alt={tc(slide.caption)}
                  loading="lazy"
                  className="h-[260px] w-full rounded-card object-cover"
                />
                <span className="text-sm text-ink-muted dark:text-ink-dark-muted">
                  {tc(slide.caption)}
                </span>
              </div>
            ))}
          </div>
        </Section>
      ))}

      <div>
        <CtaLink to="/completion">{t('gallery.back')}</CtaLink>
      </div>
    </Page>
  );
}
