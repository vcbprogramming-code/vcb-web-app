import { useI18n } from '@vcb/shared';
import { CEO_QUOTE, CULTURE_VALUES, HOME_HERO, TRACK_RECORD_SLIDES } from '../data/home.js';
import { useContentText } from '../lib/contentText.js';
import { CtaLink, Page, PageTitle, Section } from '../components/ui.jsx';

// Ported from the original app's PAGES['home'] (content.html) — hero, CEO
// quote, Culture & Values, and Our Track Record. The embedded Org Chart /
// Group Structure tree lives at /company-structure instead of inline here.
//
// Every content string goes through tc() rather than t(): these are the
// migrated English sentences from content.html, resolved to their dot key by
// value. See lib/contentText.js.

export default function Home() {
  const { t } = useI18n();
  const tc = useContentText();

  return (
    <Page>
      <header className="flex flex-col gap-3">
        <PageTitle>{tc(HOME_HERO.title)}</PageTitle>
        <p className="text-lg text-ink-subtle dark:text-ink-dark-muted">{tc(HOME_HERO.lead)}</p>
        <p className="text-sm text-ink-muted dark:text-ink-dark-muted">{tc(HOME_HERO.note)}</p>
      </header>

      <Section title={tc(CEO_QUOTE.heading)}>
        <blockquote className="border-l-4 border-accent pl-4 text-lg italic dark:border-accent-dark">
          “{tc(CEO_QUOTE.quote)}”
        </blockquote>
        <p className="mt-3 text-sm font-semibold text-ink-muted dark:text-ink-dark-muted">
          — {tc(CEO_QUOTE.attribution)}
        </p>
      </Section>

      <Section title={tc('VCB Culture & Values')}>
        <p className="mb-4 text-sm text-ink-muted dark:text-ink-dark-muted">
          {tc('What we stand for — internalize these from Day 0')}
        </p>
        {/* Four across, as .values-grid is — two below 1100px, one below 560.
            Centred text with no bullet markers: that is what lets four narrow
            cards stay readable side by side, where a left-aligned disc list
            drags the eye to the left edge and wastes the width. */}
        <div className="grid gap-[18px] grid-cols-1 min-[560px]:grid-cols-2 min-[1100px]:grid-cols-4">
          {CULTURE_VALUES.map((v) => (
            <div
              key={v.name}
              className="rounded-card border border-line bg-surface-card p-5 text-center shadow-card transition-shadow hover:shadow-card-hover dark:border-line-dark dark:bg-surface-dark-card"
            >
              <h3 className="mb-2 text-[1.1rem] font-bold text-ink dark:text-ink-dark">
                {tc(v.name)}
              </h3>
              <p className="mb-2 text-[0.85rem] text-ink-muted dark:text-ink-dark-muted">
                {tc(v.body)}
              </p>
              <ul className="mb-2 list-none p-0 text-[0.85rem] leading-[1.5] text-ink dark:text-ink-dark">
                {v.bullets.map((b) => (
                  <li key={b} className="mb-1">
                    {tc(b)}
                  </li>
                ))}
              </ul>
              <p className="m-0 text-[0.85rem] text-ink dark:text-ink-dark">{tc(v.footer)}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title={tc('Our Track Record')}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRACK_RECORD_SLIDES.map((slide) => (
            <div key={slide.caption} className="flex flex-col gap-2">
              {/* The original's base64 project photos (~7MB, images.html) are
                  still not ported — this is the same placeholder the module
                  shipped with. */}
              <div
                className="aspect-video rounded-card bg-gradient-to-br from-line to-surface-sunken dark:from-line-dark dark:to-surface-dark-sunken"
                aria-hidden="true"
              />
              <span className="text-sm text-ink-muted dark:text-ink-dark-muted">
                {tc(slide.caption)}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <div>
        <CtaLink to="/required-documents">{t('home.continueToDocuments')}</CtaLink>
      </div>
    </Page>
  );
}
