import type { AiOpps } from './types';

/** Verbatim transcription of AI_OPPS from the canonical Index.html (v8.86). */
export const AI_OPPS: AiOpps = {
  "n-m-cf-forecast": {
    "title": "Cash-Flow Forecast Builder",
    "impact": "High",
    "effort": "Low",
    "desc": "Refresh the consolidated and per-project cash-flow forecast from AP, AR, progress and the master plan — the work your cashflow skills already do; flag liquidity gaps ahead.",
    "tool": "Cowork + n8n"
  },
  "n-m-facility": {
    "title": "Facility, Guarantee & Bond Register",
    "impact": "High",
    "effort": "Low",
    "desc": "Maintain the credit-facility / guarantee / bond register: drawdown vs headroom, cost per facility, and auto-remind on bond and facility expiries.",
    "tool": "Cowork + n8n"
  },
  "n-fuel": {
    "title": "Fuel & Fleet Anomaly Monitor",
    "impact": "High",
    "effort": "Low",
    "desc": "Reconcile fuel issued against machine-hours / GPS utilisation per vehicle, flag abnormal consumption or possible theft, and compile the fleet usage report.",
    "tool": "Cowork + n8n"
  },
  "n-m-petty": {
    "title": "Petty-Cash & Receipt OCR",
    "impact": "High",
    "effort": "Low",
    "desc": "Read site receipts (vendor, amount, VAT, cost code), auto-fill the clear-advance batch and flag duplicates or out-of-policy spend — replacing manual keying of slips.",
    "tool": "Cowork + n8n"
  },
  "n-m-chase": {
    "title": "AR Follow-up Drafting",
    "impact": "High",
    "effort": "Low",
    "desc": "Rank overdue client claims by age and amount and draft the follow-up per งวด for finance to review and send — a prepared, managed dunning cycle.",
    "tool": "Claude Cowork"
  },
  "n-m-recon": {
    "title": "Bank Reconciliation",
    "impact": "High",
    "effort": "Low",
    "desc": "Auto-match GL/Mango cash entries to the bank statement (incl. bank facility accounts), clear timing differences and surface only true exceptions.",
    "tool": "Cowork + n8n"
  },
  "n-m-pay-v": {
    "title": "Payment Pack & Approval Brief",
    "impact": "Medium",
    "effort": "Low",
    "desc": "Assemble the director payment pack — every cheque/transfer/B-E with payee, amount, due date and funding source, plus an approval summary.",
    "tool": "Claude Cowork"
  },
  "n-m-ap-v": {
    "title": "Subcontractor Claim Verification",
    "impact": "High",
    "effort": "Low",
    "desc": "Check each subcontractor claim against the WO, recorded progress and issued-materials contra, then prepare the AP entry — catching over-claims before payment.",
    "tool": "Claude Cowork"
  },
  "n-m-ar": {
    "title": "Billing Package & Tax-Invoice Prep",
    "impact": "High",
    "effort": "Low",
    "desc": "Assemble the client billing package and draft the tax invoice from the certified งวด claim, ready for AR posting.",
    "tool": "Claude Cowork"
  },
  "n-m-prog": {
    "title": "Progress Claim Assembly",
    "impact": "Medium",
    "effort": "Low",
    "desc": "Compile the งวด progress-claim package from the joint site-measurement records and certified quantities.",
    "tool": "Claude Cowork"
  },
  "n-m-insp": {
    "title": "Asset & Stock Audit Reconciliation",
    "impact": "High",
    "effort": "Low",
    "desc": "Match the HQ physical count of inventory and fixed assets against the ERP and monthly reports and surface only the exceptions (missing, surplus, mislocated).",
    "tool": "Claude Cowork"
  },
  "n-m-hr-ot": {
    "title": "Site Attendance & OT Capture",
    "impact": "High",
    "effort": "Low",
    "desc": "Parse daily site attendance and OT sign-off sheets into man-days per site/team/work-type for payroll — your site-work-summary workflow, extended.",
    "tool": "Cowork + n8n"
  },
  "n-m-eng-mp": {
    "title": "Master Plan Builder & ERP Import Mapping",
    "impact": "High",
    "effort": "Medium",
    "desc": "Draft the project master schedule and cost S-curve from the BOQ and standard durations, then map it to the Mango import format (work systems, cost codes, งวด, budget lines) so it loads cleanly — removing days of manual planning and re-keying, and firming the rough bid budget toward ~99%.",
    "tool": "Claude Code + Cowork"
  },
  "n-m-vat-compile": {
    "title": "VAT Compilation & PP.30 Prep",
    "impact": "High",
    "effort": "Low",
    "desc": "Compile input/output VAT from GL and the tax invoices and draft the PP.30 return for review — removing manual monthly compilation.",
    "tool": "Cowork + n8n"
  },
  "n-wht-filing": {
    "title": "WHT Cert & Return Prep",
    "impact": "High",
    "effort": "Low",
    "desc": "Generate withholding-tax certificates and draft the PND.1/3/53 return from booked payments and reconcile to GL — high-volume manual prep removed.",
    "tool": "Cowork + n8n"
  },
  "n-m-cit": {
    "title": "CIT Computation & Schedule Prep",
    "impact": "Medium",
    "effort": "Medium",
    "desc": "Assemble the corporate-income-tax computation and supporting schedules (PND.50/51) from GL, with add-back/deduction working papers.",
    "tool": "Claude Cowork"
  },
  "n-m-final-account": {
    "title": "Final Account Reconciliation",
    "impact": "High",
    "effort": "Low",
    "desc": "Reconcile the project final account against the original contract, variation orders and certified claims, and assemble the closeout statement.",
    "tool": "Claude Cowork"
  },
  "n-m-vend": {
    "title": "Quotation Compile & Compare",
    "impact": "Medium",
    "effort": "Low",
    "desc": "Collect vendor quotations, normalise them into a comparison sheet against the BOQ rate and recommend, ready for the price-comparison approval.",
    "tool": "Cowork + n8n"
  },
  "n-m-neg": {
    "title": "Contract Draft & Clause Check",
    "impact": "Medium",
    "effort": "Medium",
    "desc": "Draft the vendor purchase contract from the agreed terms and check clauses against a standard playbook before signing.",
    "tool": "Claude Cowork"
  },
  "n-prequal": {
    "title": "Vendor Pre-qual & AVL Scoring",
    "impact": "Medium",
    "effort": "Medium",
    "desc": "Compile vendor/subcontractor capability, financial and safety documents, maintain an Approved Vendor List and score post-job performance.",
    "tool": "Cowork + n8n"
  },
  "n-insurance": {
    "title": "Insurance Renewal & Claim Prep",
    "impact": "Medium",
    "effort": "Low",
    "desc": "Track CAR policy coverage and expiries, remind on renewals, and assemble the documentation pack when a claim is needed.",
    "tool": "Cowork + n8n"
  },
  "n-m-defect": {
    "title": "Defect Log & DLP Tracking",
    "impact": "Medium",
    "effort": "Low",
    "desc": "Track defect items through the defect-liability period, remind on due dates and assemble the closeout / retention-release evidence.",
    "tool": "Cowork + n8n"
  },
  "n-m-retention-claim": {
    "title": "Retention Release Tracking",
    "impact": "Medium",
    "effort": "Low",
    "desc": "Track retention amounts and release milestones across projects and prepare the release claim documents on schedule.",
    "tool": "Cowork + n8n"
  },
  "n-m-hr-soc": {
    "title": "SSO Filing Prep",
    "impact": "Medium",
    "effort": "Low",
    "desc": "Prepare the monthly Social Security filing and payment schedule and generate the supporting forms from payroll.",
    "tool": "Claude Cowork"
  },
  "n-m-super": {
    "title": "Site Report & NCR Drafting",
    "impact": "Medium",
    "effort": "Low",
    "desc": "Draft daily site / inspection reports, ITP and NCR records and safety logs from field notes and photos for HQ review.",
    "tool": "Claude Cowork"
  },
  "n-m-sub-sel": {
    "title": "Subcontract Draft & Stamp-Duty Calc",
    "impact": "Medium",
    "effort": "Low",
    "desc": "Draft the hire-of-work subcontract from the scope and compute the stamp duty (0.1%, capped ฿10,000) due on signing.",
    "tool": "Claude Cowork"
  },
  "n-doh-k": {
    "title": "K-factor Adjustment Calc",
    "impact": "High",
    "effort": "Medium",
    "desc": "Pull the government-published price indices, compute the ค่า K escalation adjustment per งวด vs the base month, and apply it to the certified claim — replacing manual formula calculation.",
    "tool": "Cowork + n8n"
  },
  "n-ap": {
    "title": "AP Auto-Match & Anomaly",
    "impact": "High",
    "effort": "Medium",
    "desc": "Three-way match each invoice to its PO receipt / subcontractor billing, auto-route clean items and flag duplicates, over-billing and out-of-policy payables.",
    "tool": "Cowork + n8n"
  },
  "n-receive": {
    "title": "Receipt OCR & 3-Way Match",
    "impact": "High",
    "effort": "Low",
    "desc": "Read the delivery note / tax invoice at site receipt, match to the PO line and quantity and pass a clean APV to AP.",
    "tool": "Cowork + n8n"
  },
  "n-gl": {
    "title": "GL Close & Variance Narrative",
    "impact": "High",
    "effort": "Medium",
    "desc": "Auto-draft the month-end management commentary (P&L and cost-per-project variances), flag unusual or duplicate journals and assemble the cost report.",
    "tool": "Claude Cowork"
  },
  "n-pm-dash": {
    "title": "Project Health Summary",
    "impact": "High",
    "effort": "Medium",
    "desc": "Auto-narrate project health across the seven module feeds — budget vs committed vs actual, progress, AP/AR and stock — and flag projects trending to loss.",
    "tool": "Claude Cowork"
  },
  "n-pr": {
    "title": "PR Auto-Draft & Budget Check",
    "impact": "Medium",
    "effort": "Low",
    "desc": "Draft the purchase request from the BOQ / master-plan shortfall and check it against remaining budget by cost code before approval.",
    "tool": "Claude Cowork"
  },
  "n-hr-payroll": {
    "title": "Payroll Prep & Reconciliation",
    "impact": "Medium",
    "effort": "Low",
    "desc": "Prepare the payroll run from captured attendance/OT, generate payslips and reconcile to the AP payment and SSO/WHT entries.",
    "tool": "Cowork + n8n"
  },
  "n-fin": {
    "title": "Finance Insight Summary",
    "impact": "Medium",
    "effort": "Medium",
    "desc": "Turn the read-only finance dashboards (cash on hand, ratios, revenue vs collection) into a written weekly insight brief for management.",
    "tool": "Cowork + n8n"
  },
  "n-interjv": {
    "title": "Inter-JV Netting & Reconciliation",
    "impact": "Medium",
    "effort": "Low",
    "desc": "Net and reconcile inter-company / JV group balances and flag transfers that haven't posted to GL for both entities.",
    "tool": "Claude Cowork"
  }
};
