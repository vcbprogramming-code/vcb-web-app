
// Ported verbatim from the original app's content.html (engineeringLanding +
// PAGES['engineering-day-1-30'|'31-60'|'61-90']).
export const ENGINEERING = {
  eyebrow: "Engineering Team",
  title: "Engineering Team",
  supervisor:
    "Mr. Vivat Chavananand (Head of Engineering) and Mrs. Romanee Karunchadit (Senior Engineer Officer) guide onboarding.",
  overview: [
    "Mission: revenue realization through accurate measurement, controlled execution, and disciplined documentation. Engineering must ensure project progress converts to certified revenue while maintaining cost efficiency and contractual compliance through:",
  ],
  bullets: [
    "Executing work per specifications and approved drawings",
    "Maintaining accurate quantity measurement",
    "Controlling material and labor efficiency",
    "Preventing schedule delays",
    "Preparing documentation supporting progress claims",
  ],
  footerQuote: "Execution accuracy safeguards revenue.",
  workflow: [
    "The Mango Anywhere ERP System integrates project planning, resource allocation, procurement, and financial management. Engineering initiates operational activities through Business Development (BD) and Project Management (PM) modules that connect with other departments.",
  ],
  phases: [
    {
      dayRange: "day-1-30",
      page: {
        eyebrow: "Engineering · Phase 1 (Day 1–30)",
        title: "Foundation: Measurement Accuracy & Site Reporting Discipline",
        blocks: [
          {
            heading: "Required Reading",
            items: [
              { id: "eng-p1-read-1", text: "Engineering Operations Manual with document examples" },
              {
                id: "eng-p1-read-2",
                text: "Mango Module Study — BD/PM modules relevant to role",
              },
              {
                id: "eng-p1-read-3",
                text: "Company Organization Chart, Departments & Projects",
              },
              {
                id: "eng-p1-read-4",
                text: "BD Tender Pipeline & e-Bidding Overview",
                level: "senior",
              },
            ],
          },
          {
            heading: "Knowledge Requirements",
            items: [
              {
                id: "eng-p1-know-1",
                text: "Position responsibilities and Engineering department overview",
              },
              {
                id: "eng-p1-know-2",
                text: "Standard software operation (Microsoft suite, PDF, email)",
              },
              {
                id: "eng-p1-know-3",
                text: "Mango module use within responsibility area (New Project Registration, Budget Control)",
              },
              {
                id: "eng-p1-know-4",
                text: "e-GP tender screening and bid/no-bid decision criteria",
                level: "senior",
              },
            ],
          },
          {
            heading: "Required Outputs",
            items: [
              { id: "eng-p1-out-1", text: "Execute Doc 02/03 flow within job scope" },
              { id: "eng-p1-out-2", text: "Enter data into Mango system" },
              {
                id: "eng-p1-out-3",
                text: "Answer master plan questions across departments",
              },
              {
                id: "eng-p1-out-4",
                text: "1 draft e-GP tender screening note",
                level: "senior",
              },
            ],
          },
        ],
        nextPhasePage: "engineering-day-31-60",
      },
    },
    {
      dayRange: "day-31-60",
      page: {
        eyebrow: "Engineering · Phase 2 (Day 31–60)",
        title: "Control: Productivity Monitoring & Revenue Documentation",
        blocks: [
          {
            heading: "Required Reading",
            items: [
              { id: "eng-p2-read-1", text: "Mango Manual — relevant module complete" },
              {
                id: "eng-p2-read-2",
                text: "Master Plans of various projects (progress to 80%)",
              },
              { id: "eng-p2-read-3", text: "Branch-submission documents" },
              {
                id: "eng-p2-read-4",
                text: "Additional Work (Variation Order · BD) Processing Guide",
                level: "senior",
              },
            ],
          },
          {
            heading: "Knowledge Requirements",
            items: [
              { id: "eng-p2-know-1", text: "Project bidding submission documents" },
              { id: "eng-p2-know-2", text: "Branch-submission document study" },
              { id: "eng-p2-know-3", text: "Variation Order (VO) processing basics" },
              {
                id: "eng-p2-know-4",
                text: "Linking a VO to the main BOQ and merging cost codes",
                level: "senior",
              },
            ],
          },
          {
            heading: "Required Outputs",
            items: [
              { id: "eng-p2-out-1", text: "Perform Phase 1 tasks at 80% accuracy" },
              { id: "eng-p2-out-2", text: "Draft one bidding submission package" },
              { id: "eng-p2-out-3", text: "Track one Variation Order end to end" },
              {
                id: "eng-p2-out-4",
                text: "1 VO cost-code merge processed end to end",
                level: "senior",
              },
            ],
          },
        ],
        nextPhasePage: "engineering-day-61-90",
      },
    },
    {
      dayRange: "day-61-90",
      page: {
        eyebrow: "Engineering · Phase 3 (Day 61–90)",
        title: "Ownership: Section Performance & Cost Variance Control",
        blocks: [
          {
            heading: "Required Reading",
            items: [
              {
                id: "eng-p3-read-1",
                text: "Master Plans of various projects (complete 100%)",
              },
              { id: "eng-p3-read-2", text: "Project bidding documents (complete study)" },
              {
                id: "eng-p3-read-3",
                text: "Project Closure requirements (final budget revision, reports)",
              },
              {
                id: "eng-p3-read-4",
                text: "PM Module Dashboard — Project Status Overview Guide",
                level: "senior",
              },
            ],
          },
          {
            heading: "Knowledge Requirements",
            items: [
              { id: "eng-p3-know-1", text: "Project bidding documents — full command" },
              {
                id: "eng-p3-know-2",
                text: "Contractor grade/PQ renewal evidence requirements",
              },
              { id: "eng-p3-know-3", text: "Project Closure process" },
              {
                id: "eng-p3-know-4",
                text: "Reading the PM Dashboard across BD/PO/OF/AR/AP/GL/IC convergence",
                level: "senior",
              },
            ],
          },
          {
            heading: "Required Outputs",
            items: [
              {
                id: "eng-p3-out-1",
                text: "Perform Phase 1 tasks at 100% accuracy (minor errors acceptable)",
              },
              { id: "eng-p3-out-2", text: "Complete one Project Status Overview review" },
              {
                id: "eng-p3-out-3",
                text: "Prepare one Project Closure documentation set",
              },
              {
                id: "eng-p3-out-4",
                text: "1 independent PM Dashboard health summary",
                level: "senior",
              },
            ],
          },
        ],
        closing: "You have completed all three onboarding phases for this department.",
      },
    },
  ],
};
