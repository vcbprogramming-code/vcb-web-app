// Ported from the original app's PAGES['home'] (content.html) — every
// text field is verbatim from the source. Embedded images
// (EMBEDDED_IMAGES.* — base64 data URIs baked into the original's
// images.html, ~7MB) are NOT ported here; see React/README.md's "Images"
// section for why that's a deliberate separate step, not an oversight.

export const HOME_HERO = {
  title: "VCB 90-Day Onboarding Portal",
  lead: "This portal defines the required knowledge, system mastery, execution standards, and governance expectations for all new employees during their first 90 days.",
  note: "Confirmation of employment is based on competency, documentation accuracy, system discipline, and risk awareness.",
};

export const CEO_QUOTE = {
  heading: "Welcome Message from our CEO",
  quote:
    "We're thrilled to have you onboard. We believe that every person here contributes to our success, and we're committed to helping you thrive. Let's build something great together.",
  attribution: "Mr. Voravith Chavananand",
};

export const CULTURE_VALUES = [
  {
    name: "Discipline",
    body: "We follow structured systems, documented processes, and approval hierarchies.",
    bullets: ["No shortcuts", "No undocumented commitments", "No uncontrolled decisions"],
    footer: "Discipline protects our liquidity, reputation, and long-term stability.",
  },
  {
    name: "Responsibility",
    body: "Every action has operational and financial impact. We take ownership of:",
    bullets: ["Our decisions", "Our documentation", "Our deadlines", "Our results"],
    footer: "Responsibility is not transferred — it is upheld.",
  },
  {
    name: "Integrity",
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
    body: "We execute with precision, coordination, and continuous improvement.",
    bullets: ["Accurate quantities", "Controlled costs", "Timely delivery", "Risk awareness"],
    footer: "Excellence is achieved through consistency, not chance.",
  },
];

export const TRACK_RECORD_SLIDES = [
  { caption: "Infrastructure project" },
  { caption: "Power House Unit" },
  { caption: "Navigation Lock" },
  { caption: "Spillway" },
];
