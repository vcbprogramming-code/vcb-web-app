
/** Verbatim transcription of CROSS_CONNS from the canonical Index.html (v8.86).
 *  129 edges total. */
export const CROSS_CONNS = [
  {
    "from": "n-wo",
    "to": "n-pm-dash",
    "type": "conditional",
    "label": "Work Order → PM Dashboard: subcontractor commitments — committed WO value & Pending Subcontractor (mirrors the PO commitment feed)"
  },
  {
    "from": "n-boq",
    "to": "n-pm-dash",
    "type": "conditional",
    "label": "Project Budget Control → PM Dashboard: the approved planned budget / BOQ baseline (originated in BD) — the line everything is compared against"
  },
  {
    "from": "n-plan",
    "to": "n-pm-dash",
    "type": "conditional",
    "label": "Project Forecast → PM Dashboard: forecast income & expense (PM Txn 2)"
  },
  {
    "from": "n-ic-recv",
    "to": "n-ic-issue",
    "type": "trigger",
    "label": "Stock on hand → IC Issue (เตรียมเบิก → ตัดสต๊อก) to draw down"
  },
  {
    "from": "n-ic-recv",
    "to": "n-ic-xfer",
    "type": "conditional",
    "label": "Surplus / leftover stock → IC Transfer to a DIFFERENT project (cut from this warehouse; destination does IC Receive Transfer)"
  },
  {
    "from": "n-ic-recv",
    "to": "n-m-insp",
    "type": "conditional",
    "label": "Inventory (IC stock) physically counted on-site by HQ Asset team & reconciled vs ERP"
  },
  {
    "from": "n-fa",
    "to": "n-m-insp",
    "type": "conditional",
    "label": "Fixed assets (FA register) physically counted on-site by HQ Asset team & reconciled vs ERP"
  },
  {
    "from": "n-m-cf-forecast",
    "to": "n-m-facility",
    "type": "feeds",
    "label": "Cash Flow Forecast submitted to the bank → Credit Facility Management (P/N / BG / advance) drawn — financing / reimbursement received back"
  },
  {
    "from": "n-open",
    "to": "n-m-landcamp",
    "type": "trigger",
    "label": "Project awarded / registered → secure the land lease & set up the temporary site camp / housing"
  },
  {
    "from": "n-m-landcamp",
    "to": "n-m-open",
    "type": "trigger",
    "label": "Camp & housing ready → Mobilisation & Site Kick-off (staff move in, work begins)"
  },
  {
    "from": "n-receipt",
    "to": "n-gl",
    "type": "deferred",
    "label": "Receipt Voucher (RL/RV) posts to GL — clears the receivable and records the cash receipt"
  },
  {
    "from": "n-interjv",
    "to": "n-gl",
    "type": "feeds",
    "label": "Inter-JV group transfer (Finance, via AP) → posts to GL for both entities"
  },
  {
    "from": "n-ic-issue",
    "to": "n-disposal",
    "type": "conditional",
    "label": "Leftover materials / scrap (sand, soil, metal) on site → Surplus & Scrap Disposal Sale"
  },
  {
    "from": "n-ic-issue",
    "to": "n-ar",
    "type": "conditional",
    "label": "Cross-entity sale (Area Code คิดเงิน, blanket PO) → AR Trading tax invoice (น.34) — billable, not normal within-project issuing"
  },
  {
    "from": "n-sub-prog",
    "to": "n-ar",
    "type": "conditional",
    "label": "Materials deducted on the subcontractor's claim → raised as an AR Trading receivable (น.34), settled by the deduction"
  },
  {
    "from": "n-insurance",
    "to": "n-ap",
    "type": "conditional",
    "label": "CAR / project-insurance premium → booked as a payable (AP, APO) → Payment & GL"
  },
  {
    "from": "n-security",
    "to": "n-ap",
    "type": "conditional",
    "label": "Security firm / guard service fee → booked as a payable (AP, APO) → Payment & GL"
  },
  {
    "from": "n-po",
    "to": "n-m-aval-prep",
    "type": "conditional",
    "label": "PO issued → Finance prepares AVAL / B/E as alternative payment (instead of immediate cash)"
  },
  {
    "from": "n-wo",
    "to": "n-m-aval-prep",
    "type": "conditional",
    "label": "WO issued → Finance prepares AVAL / B/E for subcontractor payment"
  },
  {
    "from": "n-m-aval-prep",
    "to": "n-ap",
    "type": "feeds",
    "label": "Bank-authorised AVAL → booked in AP as payable (APV) → normal payment execution"
  },
  {
    "from": "n-m-aval-prep",
    "to": "n-m-aval-disc",
    "type": "conditional",
    "label": "AVAL issued → Finance elects to sell/discount for immediate cash instead of waiting for maturity"
  },
  {
    "from": "n-m-aval-prep",
    "to": "n-m-cf-forecast",
    "type": "feeds",
    "label": "AVAL / B/E issued → update Cash Flow Forecast before bank facility actions"
  },
  {
    "from": "n-m-aval-disc",
    "to": "n-ap",
    "type": "feeds",
    "label": "Cash proceeds received → routed to AP for payment execution"
  },
  {
    "from": "n-m-aval-disc",
    "to": "n-m-cf-forecast",
    "type": "feeds",
    "label": "AVAL discounting proceeds received → update Cash Flow Forecast"
  },
  {
    "from": "n-gl",
    "to": "n-m-recon",
    "type": "conditional",
    "label": "After GL close → reconcile the book / GL cash balance vs the bank statement"
  },
  {
    "from": "n-m-recon",
    "to": "n-gl",
    "type": "deferred",
    "feedback": true,
    "label": "Correcting journal entries from the reconciliation → posted back to GL"
  },
  {
    "from": "n-open",
    "to": "n-doh-k",
    "type": "conditional",
    "label": "DOH contract awarded → monitor contract terms & the ค่า K (K-factor)"
  },
  {
    "from": "n-doh-k",
    "to": "n-m-ar",
    "type": "conditional",
    "label": "K-factor (ค่า K) adjustment applied to the certified งวด → revised billing amount"
  },
  {
    "from": "n-disposal",
    "to": "n-ar",
    "type": "trigger",
    "label": "Auction sale to highest bidder → AR (Invoice Other / Trading) → proceeds received back as income"
  },
  {
    "from": "n-fa",
    "to": "n-disposal",
    "type": "conditional",
    "label": "Surplus / idle fixed assets → Surplus & Scrap Disposal Sale (then FA Write Off / Sale, FA-1.3)"
  },
  {
    "from": "n-m-super",
    "to": "n-m-prog",
    "type": "trigger",
    "label": "Work supervised, quality-checked (QA/QC) & measured → Site Measurement & Progress claim"
  },
  {
    "from": "n-m-vend",
    "to": "n-prequal",
    "type": "conditional",
    "feedback": true,
    "label": "New / cheaper vendor found during sourcing → loop back to Pre-qualification to vet & re-test before it can be used"
  },
  {
    "from": "n-m-open",
    "to": "n-security",
    "type": "conditional",
    "label": "Site mobilised → deploy site security / guards (asset management) to protect materials, equipment & property from theft (conditional — not all sites require permanent guards)"
  },
  {
    "from": "n-m-open",
    "to": "n-m-fa-xfer",
    "type": "conditional",
    "label": "Site mobilised → deploy / transfer the requested machines & assets to the site (conditional — depends on project scope and equipment requirements)"
  },
  {
    "from": "n-bd-pipeline",
    "to": "n-bid",
    "type": "trigger",
    "label": "Qualified tender (bid/no-bid passed) → Estimation & Budgeting"
  },
  {
    "from": "n-open",
    "to": "n-insurance",
    "type": "trigger",
    "label": "Project awarded / registered → arrange CAR & project insurance for the contract period"
  },
  {
    "from": "n-prequal",
    "to": "n-m-vend",
    "type": "feeds",
    "label": "Pre-qualified vendor pool (AVL) → Vendor Sourcing & Quotation"
  },
  {
    "from": "n-prequal",
    "to": "n-m-sub-sel",
    "type": "feeds",
    "label": "Pre-qualified subcontractor pool → Subcon Selection & Contract"
  },
  {
    "from": "n-receive",
    "to": "n-m-tag",
    "type": "conditional",
    "label": "Asset-type goods received (PO type = Asset) → tag the new asset"
  },
  {
    "from": "n-receive",
    "to": "n-fa",
    "type": "conditional",
    "label": "Asset received → register in FA and check machine status / condition (acceptance)"
  },
  {
    "from": "n-m-tag",
    "to": "n-fa",
    "type": "trigger",
    "label": "Tagged asset → recorded in the Fixed Asset register (FA add asset)"
  },
  {
    "from": "n-m-insp",
    "to": "n-gl",
    "type": "deferred",
    "label": "Audit adjustments — stock write-offs & fixed-asset corrections → GL"
  },
  {
    "from": "n-m-fa-xfer",
    "to": "n-fuel",
    "type": "feeds",
    "label": "Equipment deployed to site → fuel & utilization tracking (off-ERP)"
  },
  {
    "from": "n-fuel",
    "to": "n-maint",
    "type": "conditional",
    "label": "Fuel consumption & GPS utilisation hours → triggers preventive maintenance scheduling"
  },
  {
    "from": "n-receipt",
    "to": "n-m-cf-forecast",
    "type": "feeds",
    "label": "AR Receipt → update Cash Flow Forecast before bank facility actions"
  },
  {
    "from": "n-receipt",
    "to": "n-bank-mgmt",
    "type": "conditional",
    "label": "Receipts (money in, RV) → Bank Account Management: income & post-dated cheques received, per bank account (Debit)"
  },
  {
    "from": "n-payments",
    "to": "n-bank-mgmt",
    "type": "conditional",
    "label": "Payments (money out, PV / cheques) → Bank Account Management: expenses, outstanding & post-dated cheques, due dates (Credit)"
  },
  {
    "from": "n-bank-mgmt",
    "to": "n-m-cf-forecast",
    "type": "conditional",
    "label": "Bank Account Management → Cash Flow Forecast: available funds vs pending obligations for liquidity planning"
  },
  {
    "from": "n-m-open",
    "to": "n-pr",
    "type": "trigger",
    "label": "Site mobilised → the site unit (Foreman / Admin Site) can raise Purchase Requests — PR is originated on-site once the site is running (alongside the approved Project Budget that authorises it)"
  },
  {
    "from": "n-po",
    "to": "n-pm-dash",
    "type": "conditional",
    "label": "PO → PM: Purchase Cost (PO/WO incurred) + real-time Pending P/O & Pending Subcontractor commitments"
  },
  {
    "from": "n-progress",
    "to": "n-pm-dash",
    "type": "conditional",
    "label": "OF → PM: Actual Progress (Progress Submit) & Progress Payment tracking"
  },
  {
    "from": "n-progress",
    "to": "n-ar",
    "type": "trigger",
    "label": "Certified progress claim (OF Submit) → AR invoice issued to DOH / client"
  },
  {
    "from": "n-progress",
    "to": "n-m-pn-prep",
    "type": "conditional",
    "label": "Certified OF claim → Finance prepares P/N to draw cash before DOH payment arrives"
  },
  {
    "from": "n-m-pn-prep",
    "to": "n-m-cf-forecast",
    "type": "feeds",
    "label": "P/N drawn → update Cash Flow Forecast"
  },
  {
    "from": "n-m-prog",
    "to": "n-m-pn-prep",
    "type": "conditional",
    "label": "Site measurement certified → Finance prepares P/N to draw cash before DOH payment arrives"
  },
  {
    "from": "n-ap",
    "to": "n-ap-cn",
    "type": "conditional",
    "label": "Return / over-billing / price dispute → AP Credit Note (ลดหนี้) reverses the payable"
  },
  {
    "from": "n-ap-cn",
    "to": "n-gl",
    "type": "deferred",
    "label": "AP credit note reverses the payable → posts to GL"
  },
  {
    "from": "n-ar",
    "to": "n-ar-cn",
    "type": "conditional",
    "label": "Qty reduced after joint measurement / billing error → AR Credit Note (ใบลดหนี้)"
  },
  {
    "from": "n-ar-cn",
    "to": "n-gl",
    "type": "deferred",
    "label": "AR credit note reduces receivable & revenue → posts to GL"
  },
  {
    "from": "n-ap",
    "to": "n-m-pay-v",
    "type": "feeds",
    "label": "Approved payable (ตั้งหนี้ / Pre-Payment) → Director Approval & Payment Prep → Payment Execution"
  },
  {
    "from": "n-ap",
    "to": "n-gl",
    "type": "deferred",
    "label": "AP ตั้งหนี้ accrual auto-posts to GL (Post-to-GL, AP Txn 8) — liability/cost recognised at booking, before payment (≠ the cash settlement, which posts via Payment Execution)"
  },
  {
    "from": "n-ar",
    "to": "n-gl",
    "type": "deferred",
    "label": "AR invoice / receivable posts to GL (Post-to-GL, AR Txn 9)"
  },
  {
    "from": "n-ap",
    "to": "n-pm-dash",
    "type": "conditional",
    "label": "AP → PM: A/P Aging (owed to vendors) & A/P Retention (held from subcontractors)"
  },
  {
    "from": "n-ar",
    "to": "n-pm-dash",
    "type": "conditional",
    "label": "AR → PM: Invoiced to client, A/R Aging & A/R Retention"
  },
  {
    "from": "n-gl",
    "to": "n-pm-dash",
    "type": "conditional",
    "label": "GL → PM: Actual Cost (Cost by Account) & booked P/L"
  },
  {
    "from": "n-ic-recv",
    "to": "n-pm-dash",
    "type": "conditional",
    "label": "IC → PM: Material usage & Material on Site (project inventory balances)"
  },
  {
    "from": "n-pr",
    "to": "n-m-sub-sel",
    "type": "trigger",
    "label": "PR (For WO) → Subcontractor Selection — same stage as Vendor Sourcing; selection & contract then issue the Work Order"
  },
  {
    "from": "n-m-eng-mp",
    "to": "n-open",
    "type": "trigger",
    "label": "Master Plan → BD New Project Registration (Init Summary Cost Code + BOQ-Budget import)"
  },
  {
    "from": "n-m-eng-mp",
    "to": "n-prequal",
    "type": "conditional",
    "label": "Pre-qualify vendors / subcontractors (AVL) up front — before procurement begins"
  },
  {
    "from": "n-m-super",
    "to": "n-m-ot-site",
    "type": "conditional",
    "label": "Work behind schedule / deadline pressure → PM/site manager approves OT"
  },
  {
    "from": "n-m-super",
    "to": "n-m-final-claim",
    "type": "trigger",
    "label": "Construction work completed & verified → final 100% work measurement"
  },
  {
    "from": "n-open",
    "to": "n-boq",
    "type": "trigger",
    "label": "Registration (BD, incl. BOQ/Budget import) → PM Initial Project Budget — Control & Approve (PM Txn 3/4)"
  },
  {
    "from": "n-open",
    "to": "n-plan",
    "type": "trigger",
    "label": "Registration (BD) → PM Project Forecast — set up in PM once the project exists (sibling of Budget/BOQ)"
  },
  {
    "from": "n-m-eng-mp",
    "to": "n-m-cf-forecast",
    "type": "trigger",
    "label": "Engineering master plan → Cash Flow Forecast: Finance builds per-project T-bar to secure bank credit facility"
  },
  {
    "from": "n-boq",
    "to": "n-pr",
    "type": "trigger",
    "label": "Project Budget / Control Budget → PR (OF) — the requisition gateway: nothing becomes a PO/WO without a PR first. Every PR references a BOQ line; PR → PO (materials) or WO (subcontract) [PR-1.1]"
  },
  {
    "from": "n-fa",
    "to": "n-m-pq",
    "type": "conditional",
    "label": "Machinery register (count & value) → evidence for DOH machinery threshold requirement"
  },
  {
    "from": "n-project-close",
    "to": "n-m-pq",
    "type": "conditional",
    "label": "Completed contracts record → evidence for DOH completed-contracts threshold requirement"
  },
  {
    "from": "n-hr-payroll",
    "to": "n-m-pq",
    "type": "conditional",
    "label": "Employee roster → evidence for DOH HR staffing threshold requirement"
  },
  {
    "from": "n-gl",
    "to": "n-m-pq",
    "type": "conditional",
    "label": "Balance sheet (asset > liability) → financial standing evidence for DOH grade renewal"
  },
  {
    "from": "n-m-facility",
    "to": "n-m-pq",
    "type": "conditional",
    "label": "Bank confirmation letter → credit standing evidence for DOH contractor grade renewal"
  },
  {
    "from": "n-m-pq",
    "to": "n-ebid",
    "type": "conditional",
    "label": "Contractor grade (ชั้นพิเศษ) — standing eligibility to submit a bid in e-Bidding (e-GP portal)"
  },
  {
    "from": "n-bid",
    "to": "n-ebid",
    "type": "trigger",
    "label": "Estimation & Budgeting → e-Bidding (proceed when the budget shows acceptable profit; otherwise the tender is dropped)"
  },
  {
    "from": "n-ebid",
    "to": "n-m-eng-mp",
    "type": "trigger",
    "label": "Tender won → PM produces the Engineering Master Plan (refines the budget ~80% → ~99%)"
  },
  {
    "from": "n-open",
    "to": "n-vo-bd",
    "type": "conditional",
    "label": "Same project (BD) → Additional Work / Variation: record change items (add/reduce), then Submit Approve"
  },
  {
    "from": "n-vo-bd",
    "to": "n-boq",
    "type": "trigger",
    "label": "VO linked to BOQ + Init Summary Cost Code → PM Init Budget Cost → Control Budget → Approve Budget (PM Txn 3/4)"
  },
  {
    "from": "n-petty",
    "to": "n-ic-recv",
    "type": "conditional",
    "label": "Cash / petty purchase → IC Receive Other, into stock (IC-1.2)"
  },
  {
    "from": "n-ic-issue",
    "to": "n-sub-prog",
    "type": "conditional",
    "label": "Materials issued to a subcontractor (under a WO) → value contra-deducted on their Subcontractor Progress (รับวางบิล) claim, before AP"
  },
  {
    "from": "n-ic-issue",
    "to": "n-maint",
    "type": "conditional",
    "label": "Stock parts (from PO receipt or petty-cash purchase) issued to a repair → Maintenance cost (FA Txn 4)"
  },
  {
    "from": "n-receive",
    "to": "n-ic-recv",
    "type": "trigger",
    "label": "PO Receive accepted → IC Receive: stock-in to the IC warehouse (IC Txn 1)"
  },
  {
    "from": "n-maint",
    "to": "n-ic-recv",
    "type": "conditional",
    "feedback": true,
    "label": "Leftover spare parts after a repair → returned to IC stock via Manual IC receive at ฿0 (Inventory Control)"
  },
  {
    "from": "n-fa",
    "to": "n-gl",
    "type": "deferred",
    "label": "FA monthly depreciation JV (Txn 5) + write-off (FA-1.3) → GL"
  },
  {
    "from": "n-fa",
    "to": "n-m-fa-xfer",
    "type": "trigger",
    "label": "Registered asset → deploy / transfer to the requesting site (gate pass)"
  },
  {
    "from": "n-m-fa-xfer",
    "to": "n-fa-xfer",
    "type": "trigger",
    "label": "After the physical move, Accounting records the FA Transfer (น.64) in Mango"
  },
  {
    "from": "n-fa-xfer",
    "to": "n-fa",
    "type": "conditional",
    "feedback": true,
    "label": "FA Transfer recorded → asset register updated (new site / cost center); future depreciation → the new project"
  },
  {
    "from": "n-boq",
    "to": "n-petty",
    "type": "trigger",
    "label": "Project Budget / Control Budget → Petty Cash & Advances (issue the advance / float, OF Txn 1) — budget-controlled, no PR"
  },
  {
    "from": "n-petty",
    "to": "n-m-petty",
    "type": "conditional",
    "label": "Petty-cash float case → spent on site, collect & reconcile receipts (Float Top-up); Advance / Clear Advance / Other OF cases take different paths"
  },
  {
    "from": "n-m-petty",
    "to": "n-petty",
    "type": "conditional",
    "feedback": true,
    "label": "Receipts reconciled → reimbursement raised as a new OF (Clear Advance / Petty Cash), then booked in AP and paid (AP → Payment) — that payment tops up the float (cycle)"
  },
  {
    "from": "n-receive",
    "to": "n-ap",
    "type": "feeds",
    "label": "PO Receive → AP (ตั้งหนี้ APV)"
  },
  {
    "from": "n-po",
    "to": "n-ap",
    "type": "conditional",
    "label": "PO down-payment / cash → AP (APV)"
  },
  {
    "from": "n-payments",
    "to": "n-gl",
    "type": "feeds",
    "label": "AP Payment → GL"
  },
  {
    "from": "n-hr-payroll",
    "to": "n-ap",
    "type": "feeds",
    "label": "Payroll → AP (ตั้งหนี้) → Pay"
  },
  {
    "from": "n-ic-issue",
    "to": "n-gl",
    "type": "deferred",
    "label": "IC Cost Transfer → GL"
  },
  {
    "from": "n-gl",
    "to": "n-m-vat-compile",
    "type": "deferred",
    "label": "GL data → VAT Data Compilation (→ PP.30)"
  },
  {
    "from": "n-gl",
    "to": "n-m-wht-compile",
    "type": "deferred",
    "label": "GL data → WHT Compilation (→ PND.1/3/53)"
  },
  {
    "from": "n-gl",
    "to": "n-m-cit",
    "type": "deferred",
    "label": "GL data → Corporate income tax PND.50/51"
  },
  {
    "from": "n-ap",
    "to": "n-fin",
    "type": "deferred",
    "label": "AP status → FN dashboard (cash/aging)"
  },
  {
    "from": "n-ar",
    "to": "n-fin",
    "type": "deferred",
    "label": "AR status → FN dashboard (cash/aging)"
  },
  {
    "from": "n-ar",
    "to": "n-m-chase",
    "type": "trigger",
    "label": "AR invoice issued → follow up and chase the client/DOH for payment"
  },
  {
    "from": "n-m-chase",
    "to": "n-receipt",
    "type": "trigger",
    "label": "Payment received → issue Receipt Voucher (RL/RV) and clear the receivable"
  },
  {
    "from": "n-gl",
    "to": "n-fin",
    "type": "deferred",
    "label": "GL → FN financial statements"
  },
  {
    "from": "n-fin",
    "to": "n-m-cf-forecast",
    "type": "feeds",
    "label": "FN actuals (cash position, AP/AR aging, credit line utilisation) → baseline for manual Cash Flow Forecast T-bar"
  },
  {
    "from": "n-maint",
    "to": "n-gl",
    "type": "feeds",
    "label": "Maintenance Cost → GL"
  },
  {
    "from": "n-m-hr-soc",
    "to": "n-gl",
    "type": "deferred",
    "label": "SSO/WHT Payment → GL"
  },
  {
    "from": "n-petty",
    "to": "n-ap",
    "type": "feeds",
    "label": "Petty Cash / OF Other / float top-up reimbursement → AP (ตั้งหนี้ APO) → Payment"
  },
  {
    "from": "n-m-cf-forecast",
    "to": "n-m-pay-v",
    "type": "conditional",
    "label": "payment timing guided by forecast"
  },
  {
    "from": "n-interjv",
    "to": "n-m-facility",
    "type": "conditional",
    "feedback": true,
    "label": "inter-entity funds available → credit facility drawdown"
  },
  {
    "from": "n-m-facility",
    "to": "n-interjv",
    "type": "conditional",
    "label": "Credit facility drawn at one entity → inter-JV transfer to deploy funds to the project entity"
  },
  {
    "from": "n-m-facility",
    "to": "n-bank-mgmt",
    "type": "feeds",
    "label": "Credit facility drawn down → cash deposited into company bank account (Credit Facility Management → Bank Account Management)"
  },
  {
    "from": "n-ic-xfer",
    "to": "n-ic-recv",
    "type": "conditional",
    "feedback": true,
    "label": "receiving site stocks in the transferred materials"
  },
  {
    "from": "n-m-aval-disc",
    "to": "n-ar-recv-ni",
    "type": "trigger",
    "label": "AVAL sale cash proceeds received → Finance books receipt in AR (Receive Without Invoice, AR-1.2); RL number issued"
  },
  {
    "from": "n-m-facility",
    "to": "n-ar-recv-ni",
    "type": "conditional",
    "label": "Bank loan / credit facility drawdown (P/N, ML) cash in → Finance books receipt in AR (Receive Without Invoice, AR-1.2)"
  },
  {
    "from": "n-interjv",
    "to": "n-ar-recv-ni",
    "type": "feeds",
    "label": "Inter-JV transfer received by this entity → Finance books receipt in AR (Receive Without Invoice, AR-1.2) — receiving side of the inter-entity transfer"
  },
  {
    "from": "n-ar-recv-ni",
    "to": "n-bank-mgmt",
    "type": "deferred",
    "label": "AR Receive Without Invoice (RL) → cash position updated immediately in Bank Account Management"
  },
  {
    "from": "n-ar-recv-ni",
    "to": "n-m-cf-forecast",
    "type": "deferred",
    "label": "Non-invoice cash receipt (RL) → update Cash Flow Forecast"
  },
  {
    "from": "n-ar-recv-ni",
    "to": "n-pm-dash",
    "type": "deferred"
  },
  {
    "from": "n-ar-recv-ni",
    "to": "n-fin",
    "type": "deferred"
  },
  {
    "from": "n-ar-recv-ni",
    "to": "n-gl",
    "type": "feeds"
  },
  {
    "from": "n-m-hr-eval",
    "to": "n-hr-payroll",
    "type": "conditional"
  },
  {
    "from": "n-m-hr-eval",
    "to": "n-ap",
    "type": "conditional"
  }
];
