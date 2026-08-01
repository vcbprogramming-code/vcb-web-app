import type { DocNode } from './types';

/** Verbatim transcription of DOC_NODES from the canonical Index.html (v8.86). */
export const DOC_NODES: DocNode[] = [
  {
    "id": "doc-02a",
    "siteOrigin": true,
    "code": "02A",
    "label": "Engineering\nPlan Approval",
    "dept": "eng",
    "sub": "Site PM → HQ Engineering",
    "erp_style": "manual",
    "erp_label": "kept as manual form",
    "desc": "Engineering-work approvals to HQ Engineering — project name, construction (master) plan, personnel plan, machinery plan, and the revenue–expense estimate. Manual form (kept as-is).",
    "items": [
      "Approve project name",
      "Construction / master plan",
      "Personnel plan; machinery plan",
      "Revenue–expense estimate"
    ]
  },
  {
    "id": "doc-02b",
    "siteOrigin": true,
    "code": "02B",
    "label": "Purchase &\nSubcontract Approval",
    "dept": "eng",
    "sub": "Site PM → HQ Engineering",
    "erp_style": "manual",
    "erp_label": "→ PR (attach compare price)",
    "desc": "Approval required when a subcontract or material/equipment purchase has a unit price ABOVE the Master Plan, plus other construction works and price/quantity adjustments. Items at or below the Master Plan no longer need this memo — the PR is raised directly in Mango. Manual form; once approved it becomes a PR (→ PO/WO).",
    "items": [
      "Hire subcontractor — unit price ABOVE Master Plan",
      "Buy chargeable materials/equipment — ABOVE Master Plan",
      "Other construction works",
      "Price / quantity adjustment → then raise PR (attach compare-price)"
    ]
  },
  {
    "id": "doc-02c",
    "siteOrigin": true,
    "code": "02C",
    "label": "Engineering\nMisc Approval",
    "dept": "eng",
    "sub": "Site PM → HQ Engineering",
    "erp_style": "manual",
    "erp_label": "kept as manual form",
    "desc": "Assorted engineering approvals that remain manual — change of subcontractor name / machinery rental, problem & obstacle reports, hiring an engineer, and engineer meal-welfare. (Work-certification payment, subcontractor advance and retention refund have moved to ERP — OF / Billing — and the machine-usage report is discontinued.)",
    "items": [
      "Change subcontractor name / machinery rental",
      "Problem & obstacle reports",
      "Hire engineer",
      "Engineer meal-welfare allowance"
    ]
  },
  {
    "id": "doc-03",
    "siteOrigin": true,
    "code": "03",
    "label": "Subcontractor\nProgress Billing",
    "dept": "eng",
    "sub": "Site PM → HQ Engineering",
    "erp_style": "manual",
    "erp_label": "→ OF (รับวางบิล) → AP (APS)",
    "desc": "Subcontractor / machinery-rental / supplier progress-billing package, in the format set by HQ Engineering. Manual package; the รับวางบิล is then recorded in OF and pulled to AP (APS) for payment.",
    "items": [
      "Subcontractor / rental / supplier billing, per HQ Engineering format",
      "Work Order reference; installment & % complete",
      "Verified measurements and site photos",
      "→ recorded in OF (รับวางบิล) → AP (APS)"
    ]
  },
  {
    "id": "doc-08",
    "siteOrigin": true,
    "code": "08",
    "label": "HR / Personnel\nRequest",
    "dept": "hr",
    "sub": "Site PM → HQ Office (HR)",
    "erp_style": "manual",
    "erp_label": "kept as manual form",
    "desc": "Personnel & office-correspondence requests to HQ Office (HR & สารบรรณ): hiring (excluding engineers) / termination / dismissal, OT-work and accident reports, and visa / work-permit expense requests. Manual form.",
    "items": [
      "Hire (non-engineer) / terminate / dismiss staff",
      "OT-work report; accident report",
      "Visa / work-permit expense request",
      "PM signature → HQ Office (HR)"
    ]
  },
  {
    "id": "doc-09",
    "siteOrigin": true,
    "code": "09",
    "label": "Petty Cash / Advance\nClearing Evidence",
    "dept": "acc",
    "sub": "Site PM → HQ Accounting",
    "erp_style": "manual",
    "erp_label": "clears OF petty cash / advance",
    "desc": "Evidence pack the site submits to HQ Accounting to clear a petty-cash / advance drawdown (Petty Cash, Advance, Clear Advance or Other in OF) — the receipts and supporting documents that substantiate the disbursement. Manual form.",
    "items": [
      "Receipts / supporting documents for the disbursement",
      "References the OF petty cash / advance document",
      "PM signature",
      "Submitted by site to HQ Accounting to clear the drawdown"
    ]
  },
  {
    "id": "doc-10",
    "siteOrigin": true,
    "code": "10",
    "label": "Authorization /\nCertification Letter",
    "dept": "hr",
    "sub": "Site PM → HQ Office (via Engineering)",
    "erp_style": "manual",
    "erp_label": "kept as manual form",
    "desc": "Request for an official letter issued by HQ Office — power of attorney (หนังสือมอบอำนาจ) and certification letters (หนังสือรับรอง), plus bank-guarantee requests for retention release (moved here from form 05). Routed through Engineering. Manual form.",
    "items": [
      "Type: power of attorney / certification (หนังสือรับรอง) / bank guarantee",
      "Purpose and recipient",
      "Routed through Engineering",
      "HQ Office issues the letter"
    ]
  }
];
