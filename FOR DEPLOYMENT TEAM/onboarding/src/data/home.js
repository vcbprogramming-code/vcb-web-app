// Ported from the original app's PAGES['home'] (content.html) — every
// text field is verbatim from the source.
//
// The original bakes its images into images.html as base64 data URIs
// (EMBEDDED_IMAGES.*, ~7MB). The ones Home actually shows are extracted to
// files under public/img/ and referenced by path: a browser caches them
// separately and does not re-parse them with every page load.

export const HOME_HERO = {
  title: "VCB 90-Day Onboarding Portal",
  lead: "This portal defines the required knowledge, system mastery, execution standards, and governance expectations for all new employees during their first 90 days.",
  note: "Confirmation of employment is based on competency, documentation accuracy, system discipline, and risk awareness.",
  // EMBEDDED_IMAGES.homeHeroPhoto. The original uses it as a background
  // behind a dark overlay (.hero.has-photo), not as an <img>.
  photo: "/img/home-hero.jpg",
};

export const CEO_QUOTE = {
  // Extracted from the original images.html into public/img.
  portrait: "/img/ceo-portrait.jpg",
  heading: "Welcome Message from our CEO",
  quote:
    "We're thrilled to have you onboard. We believe that every person here contributes to our success, and we're committed to helping you thrive. Let's build something great together.",
  attribution: "Mr. Voravith Chavananand",
};

export const CULTURE_VALUES = [
  {
    name: "Discipline",
    icon: "/img/value-discipline.jpg",
    body: "We follow structured systems, documented processes, and approval hierarchies.",
    bullets: ["No shortcuts", "No undocumented commitments", "No uncontrolled decisions"],
    footer: "Discipline protects our liquidity, reputation, and long-term stability.",
  },
  {
    name: "Responsibility",
    icon: "/img/value-responsibility.jpg",
    body: "Every action has operational and financial impact. We take ownership of:",
    bullets: ["Our decisions", "Our documentation", "Our deadlines", "Our results"],
    footer: "Responsibility is not transferred — it is upheld.",
  },
  {
    name: "Integrity",
    icon: "/img/value-integrity.jpg",
    body: "We operate with transparency, honesty, and regulatory compliance.",
    bullets: [
      "Accurate reporting",
      "Honest measurement",
      "Proper documentation",
      "Respect for public trust",
    ],
    footer: "Integrity ensures sustainability.",
  },
  {
    name: "Excellence",
    icon: "/img/value-excellence.jpg",
    body: "We execute with precision, coordination, and continuous improvement.",
    bullets: ["Accurate quantities", "Controlled costs", "Timely delivery", "Risk awareness"],
    footer: "Excellence is achieved through consistency, not chance.",
  },
];

// The same four photographs the original shows, extracted from images.html.
// Real jobsite shots rather than stock: the section is called Our Track Record
// and a generic image would say nothing.
export const TRACK_RECORD_SLIDES = [
  { image: "/img/track-record-real.jpg", caption: "Infrastructure project" },
  { image: "/img/los-power-house-real.jpg", caption: "Power House Unit" },
  { image: "/img/los-navigation-lock-real.jpg", caption: "Navigation Lock" },
  { image: "/img/los-spillway.jpg", caption: "Spillway" },
];
