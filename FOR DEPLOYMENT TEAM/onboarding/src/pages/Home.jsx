import { useI18n } from '@vcb/shared';
import { CEO_QUOTE, CULTURE_VALUES, HOME_HERO, TRACK_RECORD_SLIDES } from '../data/home.js';
import { useContentText } from '../lib/contentText.js';
import { CtaLink, Page, PageTitle, Section } from '../components/ui.jsx';
import CompanyStructure from '../components/orgchart/CompanyStructure.jsx';

// Ported from the original app's PAGES['home'] (content.html) — hero, CEO
// quote, Culture & Values, Our Track Record, and the embedded Org Chart /
// Group Structure tree, in that order.
//
// Every content string goes through tc() rather than t(): these are the
// migrated English sentences from content.html, resolved to their dot key by
// value. See lib/contentText.js.

export default function Home() {
  const { t } = useI18n();
  const tc = useContentText();

  return (
    <Page>
      {/* .hero.has-photo: the photograph is a background behind a 55% dark
          overlay, not an <img>, and the block is centred white-on-dark at a
          260px minimum height. The port had a plain left-aligned heading.

          The note keeps a near-white card with dark text in BOTH themes.
          styles.html records that as a fixed bug: theming its text put
          near-white on near-white in dark mode. */}
      <header
        className="relative flex min-h-[260px] flex-col items-center justify-center gap-3.5 rounded-card bg-cover bg-center px-6 py-10 text-center text-white"
        style={{
          backgroundImage: `linear-gradient(rgba(5,7,15,0.55), rgba(5,7,15,0.55)), url(${HOME_HERO.photo})`,
        }}
      >
        <div className="max-w-[900px]">
          {/* PageTitle takes no className; the colour is inherited from the
              hero's text-white rather than set here. */}
          <PageTitle>{tc(HOME_HERO.title)}</PageTitle>
          <p className="mx-auto mt-3.5 max-w-[760px] text-base leading-relaxed text-[#dfe6ff]">
            {tc(HOME_HERO.lead)}
          </p>
          <p className="mx-auto mt-3.5 max-w-[760px] rounded-lg border-l-[3px] border-accent bg-white/95 px-3.5 py-2.5 text-left text-sm text-[#171b2e] shadow-[0_4px_14px_rgba(0,0,0,0.18)]">
            {tc(HOME_HERO.note)}
          </p>
        </div>
      </header>

      <Section title={tc(CEO_QUOTE.heading)}>
        {/* .quote-card: 760px, centred, portrait above the quote rather than a
            left rule beside it. The portrait is the first thing anyone notices
            missing when comparing the two. */}
        <div className="mx-auto max-w-[760px] rounded-card border border-line bg-surface-card p-6 text-center shadow-card dark:border-line-dark dark:bg-surface-dark-card">
          {CEO_QUOTE.portrait ? (
            <img
              src={CEO_QUOTE.portrait}
              alt=""
              aria-hidden="true"
              className="mx-auto mb-4 block h-[84px] w-[84px] rounded-full border-[3px] border-accent object-cover dark:border-accent-dark"
              loading="lazy"
            />
          ) : null}
          <blockquote className="m-0 text-[1.05rem] italic leading-[1.7] text-ink dark:text-ink-dark">
            “{tc(CEO_QUOTE.quote)}”
          </blockquote>
          <cite className="mt-3.5 block font-bold not-italic text-ink dark:text-ink-dark">
            — {tc(CEO_QUOTE.attribution)}
          </cite>
        </div>
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
              {/* .value-icon: 96px square, object-contain, 14px below.
                  Extracted from the original images.html into public/img
                  rather than left as base64 - four JPEGs at ~18KB each that
                  the browser can cache. */}
              {v.icon ? (
                <img
                  src={v.icon}
                  alt=""
                  aria-hidden="true"
                  className="mx-auto mb-3.5 block h-24 w-24 object-contain"
                  loading="lazy"
                />
              ) : null}
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
        {/* .carousel-static .carousel-track: a flex row with a 12px gap and
            260px slides, not a wrapping grid. Four equal columns wrapped 3+1
            and left a hole; the original shows them in one line that scrolls. */}
        <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
          {TRACK_RECORD_SLIDES.map((slide) => (
            <div
              key={slide.caption}
              className="flex w-[320px] shrink-0 snap-start flex-col gap-2 sm:w-[360px]"
            >
              {slide.image ? (
                <img
                  src={slide.image}
                  alt={tc(slide.caption)}
                  className="h-[260px] w-full rounded-card object-cover"
                  loading="lazy"
                />
              ) : (
                <div
                  className="h-[260px] rounded-card bg-gradient-to-br from-line to-surface-sunken dark:from-line-dark dark:to-surface-dark-sunken"
                  aria-hidden="true"
                />
              )}
              <span className="text-sm text-ink-muted dark:text-ink-dark-muted">
                {tc(slide.caption)}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* Company Structure sits here, directly beneath Our Track Record, which
          is where the original puts it. It had been moved to a route of its
          own; after the nav entry for that route was removed the section was
          reachable only by typing the URL, so on Home it was simply gone. */}
      {/* t(), not tc(): this heading has a real translation key, where the
          other headings on this page are migrated content strings resolved by
          their English text. tc() would have fallen through to raw English. */}
      <Section title={t('nav.companyStructure')}>
        <CompanyStructure />
      </Section>

      <div>
        <CtaLink to="/required-documents">{t('home.continueToDocuments')}</CtaLink>
      </div>
    </Page>
  );
}
