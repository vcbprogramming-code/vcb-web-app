import { Link } from "react-router-dom";
import { CEO_QUOTE, CULTURE_VALUES, HOME_HERO, TRACK_RECORD_SLIDES } from "../data/home";

// Ported from the original app's PAGES['home'] (content.html) — hero, CEO
// quote, Culture & Values, and Our Track Record. The embedded Org Chart /
// Group Structure tree section is NOT ported here — see
// React/README.md's "Org chart" section, that's tracked as a separate,
// dedicated piece of work given how much more complex it is than the
// rest of this page.
export function Home() {
  return (
    <div className="page">
      <header className="hero">
        <h1>{HOME_HERO.title}</h1>
        <p className="lead">{HOME_HERO.lead}</p>
        <p className="note">{HOME_HERO.note}</p>
      </header>

      <section className="content-section quote-section">
        <h2>{CEO_QUOTE.heading}</h2>
        <blockquote>“{CEO_QUOTE.quote}”</blockquote>
        <p className="attribution">— {CEO_QUOTE.attribution}</p>
      </section>

      <section className="content-section">
        <h2>VCB Culture & Values</h2>
        <p className="subheading">What we stand for — internalize these from Day 0</p>
        <div className="values-grid">
          {CULTURE_VALUES.map((v) => (
            <div className="value-card" key={v.name}>
              <h3>{v.name}</h3>
              <p>{v.body}</p>
              <ul>
                {v.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <p className="value-footer">{v.footer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="content-section">
        <h2>Our Track Record</h2>
        <div className="track-record-grid">
          {TRACK_RECORD_SLIDES.map((slide) => (
            <div className="track-record-slide" key={slide.caption}>
              <div className="track-record-placeholder" aria-hidden="true" />
              <span>{slide.caption}</span>
            </div>
          ))}
        </div>
      </section>

      <Link to="/required-documents" className="cta">
        Continue to Required Documents
      </Link>
    </div>
  );
}
