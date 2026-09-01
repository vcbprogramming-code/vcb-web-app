
// Ported verbatim from the original app's content.html (PAGES['property-asset-management']
// deptLanding + PAGES['property-day-1-30'|'31-60'|'61-90']). Note this department's landing
// page key does NOT follow the "<id>-team" pattern the others use — it's "property-asset-management".
export const PROPERTY = {
  eyebrow: "Property & Asset Management",
  title: "Property & Asset Management",
  supervisor:
    "Mr. Watcharit Chavananand (Head of Asset Management) and Mr. Wichit (Head of Vehicles & Machinery) lead onboarding.",
  overview: [
    "Core function: protecting company-owned assets, inventory integrity, and operational traceability. Objective: ensure that all assets are properly registered, documented, traceable, and physically verified at all times.",
  ],
  bullets: [
    "Accurate asset registration and tagging",
    "Warehouse control and movement tracking",
    "Periodic physical verification",
    "Prevention of loss, misuse, or misstatement",
    "Supporting financial reporting through asset accuracy",
  ],
  footerQuote: "Control preserves value. Uncontrolled assets create financial and governance exposure.",
  workflow: [
    "Operates within the Mango Anywhere ERP system, managing asset tracking, utilization, and lifecycle across project sites and operational facilities through FA and IC modules. The system monitors machinery, equipment, materials, and facilities to ensure proper allocation, maintenance, and financial accountability, integrating with procurement, engineering, and accounting processes.",
  ],
  phases: [
    {
      dayRange: "day-1-30",
      page: {
        eyebrow: "Property & Asset Management · Phase 1 (Day 1–30)",
        title: "Foundation: Asset Registration & Control Discipline",
        blocks: [
          {
            heading: "Required Reading",
            items: [
              { id: "prop-p1-read-1", text: "Asset Classification Policy" },
              { id: "prop-p1-read-2", text: "Warehouse Coding Standard" },
              { id: "prop-p1-read-3", text: "Tagging & Serialization Guide" },
              {
                id: "prop-p1-read-4",
                text: "Fleet Management & GPS Monitoring Guide",
                level: "senior",
              },
            ],
          },
          {
            heading: "Knowledge Requirements",
            items: [
              {
                id: "prop-p1-know-1",
                text: "Asset classification logic (FA masters: Type/Depreciation/Location/Rate)",
              },
              { id: "prop-p1-know-2", text: "Warehouse coding structure" },
              { id: "prop-p1-know-3", text: "Transfer documentation requirements" },
              {
                id: "prop-p1-know-4",
                text: "Fleet/GPS monitoring and machine-hours utilisation tracking",
                level: "senior",
              },
            ],
          },
          {
            heading: "Required Outputs",
            items: [
              { id: "prop-p1-out-1", text: "10 registered assets" },
              { id: "prop-p1-out-2", text: "Asset transfer documentation" },
              { id: "prop-p1-out-3", text: "Serial verification checklist" },
              {
                id: "prop-p1-out-4",
                text: "1 fleet utilisation summary",
                level: "senior",
              },
            ],
          },
        ],
        nextPhasePage: "property-day-31-60",
      },
    },
    {
      dayRange: "day-31-60",
      page: {
        eyebrow: "Property & Asset Management · Phase 2 (Day 31–60)",
        title: "Control: Inventory Reconciliation & Traceability Enforcement",
        blocks: [
          {
            heading: "Required Reading",
            items: [
              { id: "prop-p2-read-1", text: "Physical vs ERP Reconciliation Procedure" },
              { id: "prop-p2-read-2", text: "Depreciation Basics" },
              { id: "prop-p2-read-3", text: "Site Allocation Control Policy" },
              {
                id: "prop-p2-read-4",
                text: "Preventive Maintenance (PM) Scheduling Guide",
                level: "senior",
              },
            ],
          },
          {
            heading: "Knowledge Requirements",
            items: [
              {
                id: "prop-p2-know-1",
                text: "Physical vs ERP reconciliation (month-end Count Asset)",
              },
              { id: "prop-p2-know-2", text: "Depreciation recording basics" },
              {
                id: "prop-p2-know-3",
                text: "Site allocation control (inter-project IC Transfer)",
              },
              {
                id: "prop-p2-know-4",
                text: "Preventive maintenance scheduling and repair-cost recording",
                level: "senior",
              },
            ],
          },
          {
            heading: "Required Outputs",
            items: [
              { id: "prop-p2-out-1", text: "Inventory audit report" },
              { id: "prop-p2-out-2", text: "Reconciliation sheet" },
              { id: "prop-p2-out-3", text: "Depreciation schedule review" },
              {
                id: "prop-p2-out-4",
                text: "1 preventive maintenance schedule",
                level: "senior",
              },
            ],
          },
        ],
        nextPhasePage: "property-day-61-90",
      },
    },
    {
      dayRange: "day-61-90",
      page: {
        eyebrow: "Property & Asset Management · Phase 3 (Day 61–90)",
        title: "Ownership: Asset Integrity & Governance Assurance",
        blocks: [
          {
            heading: "Required Reading",
            items: [
              { id: "prop-p3-read-1", text: "Asset Lifecycle Management Guide" },
              { id: "prop-p3-read-2", text: "Disposal Procedure" },
              { id: "prop-p3-read-3", text: "Audit Preparation Checklist" },
              {
                id: "prop-p3-read-4",
                text: "Project Insurance (CAR) Management Guide",
                level: "senior",
              },
            ],
          },
          {
            heading: "Knowledge Requirements",
            items: [
              {
                id: "prop-p3-know-1",
                text: "Asset lifecycle stages (registration → transfer → write-off)",
              },
              { id: "prop-p3-know-2", text: "Disposal/scrap sale procedure" },
              { id: "prop-p3-know-3", text: "Audit preparation standards" },
              {
                id: "prop-p3-know-4",
                text: "CAR insurance premium tracking, expiry/renewal, and claims handling",
                level: "senior",
              },
            ],
          },
          {
            heading: "Required Outputs",
            items: [
              { id: "prop-p3-out-1", text: "Warehouse audit report" },
              { id: "prop-p3-out-2", text: "Asset risk assessment memo" },
              { id: "prop-p3-out-3", text: "Surplus/scrap disposal summary" },
              {
                id: "prop-p3-out-4",
                text: "1 project insurance renewal review",
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
