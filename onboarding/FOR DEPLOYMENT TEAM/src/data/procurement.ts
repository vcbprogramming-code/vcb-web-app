import type { DepartmentContent } from "./types";

// Ported verbatim from the original app's content.html (PAGES['procurement-team']
// via deptLanding + PAGES['procurement-day-1-30'|'31-60'|'61-90'] via phasePage).
export const PROCUREMENT: DepartmentContent = {
  eyebrow: "Procurement Team",
  title: "Procurement Team",
  supervisor:
    "Mrs. Thongthip Chavananand (Head of Procurement) and Mrs. Anongrak (Senior Procurement Officer) guide onboarding.",
  overview: [
    "The procurement function protects the company’s cost structure, liquidity timing, and supply reliability. Objective: ensure that all purchasing decisions align with project requirements, financial capacity, and governance standards.",
  ],
  bullets: [
    "Secure materials and services at optimal commercial terms",
    "Prevent cost escalation and over-purchasing",
    "Align delivery schedules with project timelines",
    "Evaluate supplier risk exposure",
    "Enforce structured approval workflows",
  ],
  footerQuote:
    "Procurement decisions directly affect project margin and cashflow stability. Cost control is not optional — it is structural protection.",
  workflow: [
    "Procurement operates through the Mango Anywhere ERP system, managing purchasing activities via modules: PO, PR, and IC. Requirements flow from Engineering and Project teams through the system as purchase requests and orders.",
  ],
  phases: [
    {
      dayRange: "day-1-30",
      page: {
        eyebrow: "Procurement · Phase 1 (Day 1–30)",
        title: "Foundation: Process Control & Approval Discipline",
        blocks: [
          {
            heading: "Required Reading",
            items: [
              { id: "proc-p1-read-1", text: "PR → PO → IC → AP Workflow" },
              {
                id: "proc-p1-read-2",
                text: "Authority Matrix (two-level PR approval)",
              },
              { id: "proc-p1-read-3", text: "Vendor Registration Process" },
              {
                id: "proc-p1-read-4",
                text: "Vendor & Subcontractor Pre-qualification (AVL) Guide",
                level: "senior",
              },
            ],
          },
          {
            heading: "Knowledge Requirements",
            items: [
              {
                id: "proc-p1-know-1",
                text: "Approval hierarchy (site PM → HQ Engineer)",
              },
              { id: "proc-p1-know-2", text: "Compare Price process" },
              { id: "proc-p1-know-3", text: "Budget validation vs BOQ" },
              {
                id: "proc-p1-know-4",
                text: "AVL capability/financial/safety pre-qualification criteria",
                level: "senior",
              },
            ],
          },
          {
            heading: "Required Outputs",
            items: [
              { id: "proc-p1-out-1", text: "5 compliant PR/PO cycles" },
              { id: "proc-p1-out-2", text: "Vendor comparison report" },
              {
                id: "proc-p1-out-3",
                text: "Documentation compliance checklist",
              },
              {
                id: "proc-p1-out-4",
                text: "1 draft vendor pre-qualification scorecard",
                level: "senior",
              },
            ],
          },
        ],
        nextPhasePage: "procurement-day-31-60",
      },
    },
    {
      dayRange: "day-31-60",
      page: {
        eyebrow: "Procurement · Phase 2 (Day 31–60)",
        title: "Control: Cost Efficiency & Supplier Risk Management",
        blocks: [
          {
            heading: "Required Reading",
            items: [
              { id: "proc-p2-read-1", text: "Cost Benchmarking Guidelines" },
              {
                id: "proc-p2-read-2",
                text: "Delivery Schedule Alignment Procedure",
              },
              {
                id: "proc-p2-read-3",
                text: "Supplier Risk Assessment Criteria",
              },
              {
                id: "proc-p2-read-4",
                text: "Supplier Tier Classification (Tier 1–4) Guide",
                level: "senior",
              },
            ],
          },
          {
            heading: "Knowledge Requirements",
            items: [
              { id: "proc-p2-know-1", text: "Cost benchmarking method" },
              { id: "proc-p2-know-2", text: "Delivery schedule alignment" },
              { id: "proc-p2-know-3", text: "Supplier risk assessment" },
              {
                id: "proc-p2-know-4",
                text: "Tier classification and market price database maintenance",
                level: "senior",
              },
            ],
          },
          {
            heading: "Required Outputs",
            items: [
              { id: "proc-p2-out-1", text: "Cost saving analysis" },
              { id: "proc-p2-out-2", text: "Supplier risk summary" },
              { id: "proc-p2-out-3", text: "Delivery alignment plan" },
              {
                id: "proc-p2-out-4",
                text: "1 supplier tier classification review",
                level: "senior",
              },
            ],
          },
        ],
        nextPhasePage: "procurement-day-61-90",
      },
    },
    {
      dayRange: "day-61-90",
      page: {
        eyebrow: "Procurement · Phase 3 (Day 61–90)",
        title: "Ownership: Strategic Procurement Planning & Liquidity Alignment",
        blocks: [
          {
            heading: "Required Reading",
            items: [
              {
                id: "proc-p3-read-1",
                text: "Procurement Liquidity Impact Guide",
              },
              { id: "proc-p3-read-2", text: "Inventory Overstock Risk Policy" },
              {
                id: "proc-p3-read-3",
                text: "Supplier Concentration Exposure Standard",
              },
              {
                id: "proc-p3-read-4",
                text: "Creditor Debt Restructuring & AVAL Offset Guide",
                level: "senior",
              },
            ],
          },
          {
            heading: "Knowledge Requirements",
            items: [
              {
                id: "proc-p3-know-1",
                text: "Procurement’s impact on liquidity",
              },
              { id: "proc-p3-know-2", text: "Inventory overstock risk" },
              {
                id: "proc-p3-know-3",
                text: "Supplier concentration exposure",
              },
              {
                id: "proc-p3-know-4",
                text: "Creditor debt restructuring and AVAL offset arrangements",
                level: "senior",
              },
            ],
          },
          {
            heading: "Required Outputs",
            items: [
              { id: "proc-p3-out-1", text: "Procurement phase forecast" },
              {
                id: "proc-p3-out-2",
                text: "Supplier concentration analysis",
              },
              {
                id: "proc-p3-out-3",
                text: "Over-purchase prevention memo",
              },
              {
                id: "proc-p3-out-4",
                text: "1 creditor debt restructuring proposal",
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
