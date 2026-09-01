import type { DepartmentContent } from "./types";

// Ported verbatim from the original app's content.html (financeLanding +
// PAGES['finance-day-1-30'|'31-60'|'61-90']). This is the one department
// fully wired up in the scaffold, to prove the port end-to-end.
export const FINANCE: DepartmentContent = {
  eyebrow: "Finance Team",
  title: "Finance Team",
  supervisor:
    "Mr. Vivich Chavananand (Head of Finance) and Mrs. Sirirat (Senior Finance Officer) will guide you through the onboarding process and help you understand the systems, responsibilities, and standards of the Finance Department.",
  overview: [
    "The Finance Department safeguards the company's liquidity, financial stability, and long-term sustainability.",
    "Primary objective: ensuring controlled cashflow, responsible debt management, and early identification of funding gaps before operational risks emerge.",
    "Finance safeguards liquidity through:",
  ],
  bullets: [
    "Monitoring cash inflows and outflows",
    "Forecasting short- and medium-term funding requirements",
    "Managing banking facilities and financing instruments",
    "Evaluating debt servicing capacity",
    "Protecting the company from liquidity exposure",
  ],
  footerQuote: "Finance protects the liquidity that makes profitability sustainable.",
  workflow: [
    "The Finance Department operates within the Mango Anywhere Enterprise Resource Planning (ERP) system, utilizing modules FIN, AP, and PM to manage resources, funding structure, and cash flow. The department monitors transactions across operational areas to maintain financial stability and enable strategic decision-making.",
  ],
  phases: [
    {
      dayRange: "day-1-30",
      page: {
        eyebrow: "Finance · Phase 1 (Day 1–30)",
        title: "Foundation: Liquidity Awareness & Cashflow Discipline",
        blocks: [
          {
            heading: "Required Reading",
            items: [
              {
                id: "fin-p1-read-1",
                text: "Company Cash Cycle Structure — project-based cashflow model driven by certified progress payments from government projects.",
              },
              {
                id: "fin-p1-read-2",
                text: "Advance & Retention Mechanism — advance payments are progressively deducted from claims; retention is withheld until completion milestones.",
              },
              {
                id: "fin-p1-read-3",
                text: "ERP Documentation Flow — all payments must follow PR → PO → AP → Approval → Payment.",
              },
              {
                id: "fin-p1-read-4",
                text: "Inter-JV Group Transfers Guide (VCB/CVE/VN JV)",
                level: "senior",
              },
            ],
          },
          {
            heading: "Knowledge Requirements",
            items: [
              { id: "fin-p1-know-1", text: "Operating vs financing cashflow" },
              { id: "fin-p1-know-2", text: "Retention's impact on liquidity" },
              { id: "fin-p1-know-3", text: "Advance deduction process" },
              {
                id: "fin-p1-know-4",
                text: "Inter-JV fund transfers and AR-Without-Invoice postings",
                level: "senior",
              },
            ],
          },
          {
            heading: "Required Outputs",
            items: [
              { id: "fin-p1-out-1", text: "10 accurate PL postings" },
              { id: "fin-p1-out-2", text: "1 complete bank reconciliation" },
              { id: "fin-p1-out-3", text: "Identification of 3 liquidity risks" },
              {
                id: "fin-p1-out-4",
                text: "1 reviewed inter-JV transfer entry",
                level: "senior",
              },
            ],
          },
        ],
        nextPhasePage: "finance-day-31-60",
      },
    },
    {
      dayRange: "day-31-60",
      page: {
        eyebrow: "Finance · Phase 2 (Day 31–60)",
        title: "Control: Forecasting Accuracy & Funding Risk Monitoring",
        blocks: [
          {
            heading: "Required Reading",
            items: [
              { id: "fin-p2-read-1", text: "Loan Amortization Structure" },
              { id: "fin-p2-read-2", text: "Promissory Note Interest Calculation" },
              { id: "fin-p2-read-3", text: "Retention Ledger Monitoring Procedure" },
              {
                id: "fin-p2-read-4",
                text: "AVAL Discounting (B/E Sale) Guide",
                level: "senior",
              },
            ],
          },
          {
            heading: "Knowledge Requirements",
            items: [
              { id: "fin-p2-know-1", text: "Project-level cashflow tracking" },
              { id: "fin-p2-know-2", text: "Liquidity forecasting method" },
              {
                id: "fin-p2-know-3",
                text: "Credit Facility register basics (P/N, AVAL, BG, LC)",
              },
              {
                id: "fin-p2-know-4",
                text: "Shopping AVAL bills across banks for best discount rate",
                level: "senior",
              },
            ],
          },
          {
            heading: "Required Outputs",
            items: [
              { id: "fin-p2-out-1", text: "3-month cash projection" },
              { id: "fin-p2-out-2", text: "Retention tracking sheet" },
              { id: "fin-p2-out-3", text: "Cost variance analysis" },
              {
                id: "fin-p2-out-4",
                text: "1 AVAL discounting rate comparison",
                level: "senior",
              },
            ],
          },
        ],
        nextPhasePage: "finance-day-61-90",
      },
    },
    {
      dayRange: "day-61-90",
      page: {
        eyebrow: "Finance · Phase 3 (Day 61–90)",
        title: "Ownership: Financial Stability & Strategic Liquidity Control",
        blocks: [
          {
            heading: "Required Reading",
            items: [
              { id: "fin-p3-read-1", text: "Break-Even Analysis Method" },
              { id: "fin-p3-read-2", text: "Debt Servicing Capacity Guidelines" },
              { id: "fin-p3-read-3", text: "Liquidity Stress Testing Procedure" },
              {
                id: "fin-p3-read-4",
                text: "Credit Facility Management & Bank Account Inquiry Guide",
                level: "senior",
              },
            ],
          },
          {
            heading: "Knowledge Requirements",
            items: [
              { id: "fin-p3-know-1", text: "Debt servicing capacity" },
              { id: "fin-p3-know-2", text: "Liquidity stress testing" },
              { id: "fin-p3-know-3", text: "Margin sensitivity" },
              {
                id: "fin-p3-know-4",
                text: "Selecting which facility to draw per payment batch",
                level: "senior",
              },
            ],
          },
          {
            heading: "Required Outputs",
            items: [
              { id: "fin-p3-out-1", text: "Independent monthly financial report" },
              { id: "fin-p3-out-2", text: "Liquidity stress scenario" },
              { id: "fin-p3-out-3", text: "Financial risk memo" },
              {
                id: "fin-p3-out-4",
                text: "1 credit facility utilisation review",
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
