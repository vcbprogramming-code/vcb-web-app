import { useI18n } from '@vcb/shared';
import { LIFE_ON_SITE } from '../data/gallery.js';
import { useContentText } from '../lib/contentText.js';
import { CtaLink, Eyebrow, Page, PageTitle, Section } from '../components/ui.jsx';

// Ported from the original app's PAGES['life-on-site'] (content.html), the
// second of the two pages the completion screen links to.
//
// These sections are type: 'gallery', not 'trackrecord' - a grid rather than a
// carousel, at the original's .gallery-grid metrics: auto-fit tracks between
// 200px and 260px, centred, 12px gap, and square images so a landscape and a
// portrait photograph sit on the same line without one dictating the height.

export default function LifeOnSitePage() {
  const { t } = useI18n();
  const tc = useContentText();

  return (
    <Page>
      <div>
        <Eyebrow>{tc(LIFE_ON_SITE.eyebrow)}</Eyebrow>
        <PageTitle>{tc(LIFE_ON_SITE.title)}</PageTitle>
      </div>

      <Section>
        <p>{tc(LIFE_ON_SITE.intro)}</p>
      </Section>

      {LIFE_ON_SITE.galleries.map((gallery) => (
        <Section key={gallery.heading} title={tc(gallery.heading)}>
          {gallery.body && <p className="mb-3">{tc(gallery.body)}</p>}
          <div
            className="mt-3 grid justify-center gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 260px))' }}
          >
            {gallery.images.map((item) => (
              <figure key={item.image} className="m-0 flex flex-col gap-2">
                <img
                  src={item.image}
                  alt={item.caption ? tc(item.caption) : tc(gallery.heading)}
                  loading="lazy"
                  className="aspect-square w-full rounded-xl border border-line object-cover dark:border-line-dark"
                />
                {item.caption && (
                  <figcaption className="text-sm text-ink-muted dark:text-ink-dark-muted">
                    {tc(item.caption)}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </Section>
      ))}

      {/* The original's closing link goes back to Home, not to Completion. */}
      <div>
        <CtaLink to="/">{t('gallery.backToOnboarding')}</CtaLink>
      </div>
    </Page>
  );
}
