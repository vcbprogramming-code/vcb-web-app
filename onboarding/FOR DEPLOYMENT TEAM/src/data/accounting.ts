import type { DepartmentContent } from "./types";

// Ported verbatim from the original app's content.html (PAGES['accounting-team']
// via deptLanding + PAGES['accounting-day-1-30'|'31-60'|'61-90'] via phasePage).
export const ACCOUNTING: DepartmentContent = {
  eyebrow: "Accounting Team",
  title: "Accounting Team",
  supervisor:
    "Mrs. Wanpen Yamploy (Head of Accounting) and Mrs. Jirapon (Accounting Assistant) will guide new employees through onboarding.",
  overview: [
    "Objective: maintaining complete, transparent, and verifiable financial records that accurately reflect the company’s operations.",
  ],
  bullets: [
    "Recording transactions correctly and consistently",
    "Ensuring compliance with tax and regulatory requirements",
    "Maintaining audit readiness at all times",
    "Enforcing documentation discipline within ERP systems",
    "Supporting financial reporting integrity",
  ],
  footerQuote: "Accuracy is protection. Documentation is control.",
  workflow: [
    "Operations use the Mango Anywhere ERP system, which integrates project operations, procurement, asset management, and financial reporting through AP, AR, and GL modules. Operational departments initiate transactions; Accounting verifies, documents, and records them for General Ledger consolidation.",
  ],
  phases: [
    {
      dayRange: "day-1-30",
      page: {
        eyebrow: "Accounting · Phase 1 (Day 1–30)",
        title: "Foundation: Documentation & Recording Discipline",
        blocks: [
          {
            heading: "Required Reading",
            items: [
              { id: "acct-p1-read-1", text: "Chart of Accounts Structure" },
              {
                id: "acct-p1-read-2",
                text: "PR → PO → AP Recording Flow (ERP Posting Rules)",
              },
              { id: "acct-p1-read-3", text: "VAT & Withholding Tax Compliance" },
              {
                id: "acct-p1-read-4",
                text: "AP Credit Note (ลดหนี้) Procedure",
                level: "senior",
              },
            ],
          },
          {
            heading: "Knowledge Requirements",
            items: [
              {
                id: "acct-p1-know-1",
                text: "Debit/credit logic and expense vs asset classification",
              },
              { id: "acct-p1-know-2", text: "VAT calculation and recording" },
              {
                id: "acct-p1-know-3",
                text: "AP/AR posting and journal entries in Mango",
              },
              {
                id: "acct-p1-know-4",
                text: "Reversing a payable for returns, over-billing, or disputes",
                level: "senior",
              },
            ],
          },
          {
            heading: "Required Outputs",
            items: [
              { id: "acct-p1-out-1", text: "15 accurate ERP postings" },
              { id: "acct-p1-out-2", text: "1 sample journal entry set" },
              { id: "acct-p1-out-3", text: "VAT reconciliation example" },
              {
                id: "acct-p1-out-4",
                text: "1 reviewed AP credit note case",
                level: "senior",
              },
            ],
          },
        ],
        nextPhasePage: "accounting-day-31-60",
      },
    },
    {
      dayRange: "day-31-60",
      page: {
        eyebrow: "Accounting · Phase 2 (Day 31–60)",
        title: "Control: Reconciliation & Compliance",
        blocks: [
          {
            heading: "Required Reading",
            items: [
              { id: "acct-p2-read-1", text: "Bank Reconciliation Procedure" },
              { id: "acct-p2-read-2", text: "AP/AR Aging Review Standards" },
              {
                id: "acct-p2-read-3",
                text: "Monthly Accrual & Depreciation Policy",
              },
              {
                id: "acct-p2-read-4",
                text: "IC Inventory Accounting Standard",
                level: "senior",
              },
            ],
          },
          {
            heading: "Knowledge Requirements",
            items: [
              {
                id: "acct-p2-know-1",
                text: "Bank reconciliation structure (complements GL Reconcile)",
              },
              { id: "acct-p2-know-2", text: "AP/AR aging review" },
              {
                id: "acct-p2-know-3",
                text: "Accrual entry logic & depreciation recording",
              },
              {
                id: "acct-p2-know-4",
                text: "IC inventory accounting and cost-transfer postings to GL",
                level: "senior",
              },
            ],
          },
          {
            heading: "Required Outputs",
            items: [
              { id: "acct-p2-out-1", text: "Bank reconciliation report" },
              { id: "acct-p2-out-2", text: "Accrual journal summary" },
              { id: "acct-p2-out-3", text: "AR/AP aging summary" },
              {
                id: "acct-p2-out-4",
                text: "1 IC inventory accounting review memo",
                level: "senior",
              },
            ],
          },
        ],
        nextPhasePage: "accounting-day-61-90",
      },
    },
    {
      dayRange: "day-61-90",
      page: {
        eyebrow: "Accounting · Phase 3 (Day 61–90)",
        title: "Ownership: Reporting Accuracy & Audit Readiness",
        blocks: [
          {
            heading: "Required Reading",
            items: [
              { id: "acct-p3-read-1", text: "Financial Statement Structure" },
              { id: "acct-p3-read-2", text: "Revenue Recognition Standards" },
              { id: "acct-p3-read-3", text: "Audit Documentation Requirements" },
              {
                id: "acct-p3-read-4",
                text: "External Audit Coordination Guidelines",
                level: "senior",
              },
            ],
          },
          {
            heading: "Knowledge Requirements",
            items: [
              { id: "acct-p3-know-1", text: "Month-end GL closing procedure" },
              { id: "acct-p3-know-2", text: "Trial balance review" },
              { id: "acct-p3-know-3", text: "VAT/WHT/CIT filing requirements" },
              {
                id: "acct-p3-know-4",
                text: "External audit coordination and management cost-per-project reporting",
                level: "senior",
              },
            ],
          },
          {
            heading: "Required Outputs",
            items: [
              { id: "acct-p3-out-1", text: "Trial balance review sheet" },
              { id: "acct-p3-out-2", text: "Financial statement draft" },
              {
                id: "acct-p3-out-3",
                text: "Internal audit readiness checklist",
              },
              {
                id: "acct-p3-out-4",
                text: "1 management cost-per-project report",
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
