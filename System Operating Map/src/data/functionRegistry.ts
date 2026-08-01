import type { FunctionRegistry } from './types';

/** Verbatim transcription of FUNCTION_REGISTRY from the canonical Index.html (v8.86). */
export const FUNCTION_REGISTRY: FunctionRegistry = {
  "eng": [
    [
      "ENG-01",
      "Business Development & DOH Relations",
      "Non-ERP",
      "—",
      "Tracks tender opportunities (e-GP and private), screens for fit and decides bid/no-bid, and maintains relationships with senior DOH officials to win and coordinate work"
    ],
    [
      "ENG-02",
      "Contractor Grade Maintenance",
      "Non-ERP",
      "—",
      "Maintains the company contractor class/grade with government owners — DOH, EXAT (การทางพิเศษ) and RID (กรมชลประทาน): keeps financial, equipment, personnel and past-performance records current and renews on time to stay eligible to bid"
    ],
    [
      "ENG-03",
      "Estimation & Bid Submission",
      "ERP",
      "BD module",
      "Prepares the BOQ and price estimate and submits the bid documents to the DOH/client"
    ],
    [
      "ENG-04",
      "Competitive Bidding Document Preparation",
      "Non-ERP",
      "—",
      "Prepares tender packages, qualifications, bonds and pre-qualification documents for new bids"
    ],
    [
      "ENG-06",
      "New Project Registration",
      "ERP",
      "BD module",
      "Registers the awarded contract and creates the project master record and cost centre"
    ],
    [
      "ENG-07",
      "Master Plan Entry & Revision",
      "ERP",
      "PM module",
      "Enters project scope, milestones, budget and work types before start, and revises them on approved change orders"
    ],
    [
      "ENG-08",
      "BOQ & Budget Control",
      "ERP",
      "PM module",
      "Sets and maintains the BOQ cost baseline, approves scope changes and tracks budget against commitment"
    ],
    [
      "ENG-09",
      "Detailed Design & Calculations",
      "Non-ERP",
      "—",
      "Produces and reviews detailed design, structural calculations and temporary-works design (formwork, shoring) for the works"
    ],
    [
      "ENG-10",
      "Value Engineering / Cost Optimisation",
      "Non-ERP",
      "—",
      "Proposes alternative methods or materials that cut cost or time while still meeting specification"
    ],
    [
      "ENG-11",
      "Shop Drawings & Submittals",
      "Non-ERP",
      "—",
      "Prepares and submits shop drawings, method statements and as-built drawings for DOH review and approval during and after construction"
    ],
    [
      "ENG-12",
      "Engineering Document & Drawing Control",
      "Non-ERP",
      "—",
      "Maintains the drawing and document register — revisions, distribution and latest-version control across site and HQ"
    ],
    [
      "ENG-13",
      "Technical Queries (RFI) & Site Support",
      "Non-ERP",
      "—",
      "Answers site and DOH technical queries (RFIs), resolves design clashes, and issues technical instructions to site"
    ],
    [
      "ENG-14",
      "Variation Order (VO) Processing",
      "ERP",
      "BD module",
      "Records added or reduced scope (Additional Work), creates the VO and links it to the BOQ, then re-approves the project budget"
    ],
    [
      "ENG-15",
      "PR Approval — Engineer Level",
      "ERP",
      "OF module",
      "Approves Purchase Requests at HQ level (Warisa = purchase, Sahawut = contract) before the PO/WO is issued"
    ],
    [
      "ENG-16",
      "Work Order / PO Coordination",
      "ERP",
      "PO module",
      "Issues the PO (materials) or WO (subcontract) after approval and tracks delivery against the BOQ commitment"
    ],
    [
      "ENG-17",
      "Subcontractor Billing Entry",
      "ERP",
      "OF module",
      "Records the subcontractor billing (รับวางบิล: advance, progress or retention) against the Work Order and installment period"
    ],
    [
      "ENG-18",
      "Engineering Department Expenses (OF)",
      "Non-ERP → ERP",
      "OF module",
      "Opens OF to pay HQ Engineering department expenses — consultation fees, entertainment and other engineering overheads",
      true
    ],
    [
      "ENG-19",
      "Project Closure in ERP",
      "ERP",
      "PM module",
      "Locks the project cost centre, runs the final profitability report, archives records and releases the BG and advance"
    ]
  ],
  "pm": [
    [
      "PM-01",
      "Site Kick-off & Mobilisation",
      "Non-ERP",
      "—",
      "Executes the site handover, assigns site-team roles, sets up the site office and briefs all departments on scope"
    ],
    [
      "PM-02",
      "Land Lease & Site Camp",
      "Non-ERP",
      "—",
      "Leases land near the site, builds and maintains the temporary worker and staff camp for the project, and reinstates the land at closeout"
    ],
    [
      "PM-03",
      "Surveying (งานสำรวจ)",
      "Non-ERP",
      "—",
      "Surveys and sets out the works and measures quantities for billing and quality"
    ],
    [
      "PM-04",
      "Site Document Approval (PM gate — all forms)",
      "Non-ERP → ERP",
      "—",
      "Approves every site-originated form (02A, 02B, 02C, 03, 08, 09, 10) before it leaves for HQ",
      true
    ],
    [
      "PM-05",
      "PR Approval — Site PM Level",
      "ERP",
      "OF module",
      "Reviews and approves site Purchase Requests before forwarding to the HQ Engineer for final approval"
    ],
    [
      "PM-06",
      "Utility Relocation & Right-of-Way Coordination",
      "Non-ERP",
      "—",
      "Coordinates utility relocation (power, water, telecom) and right-of-way access with owners and the DOH to clear work fronts"
    ],
    [
      "PM-07",
      "Traffic Management & Work-Zone Safety",
      "Non-ERP",
      "—",
      "Plans and maintains traffic diversions, signage and barriers for road work zones per DOH requirements"
    ],
    [
      "PM-08",
      "Environmental Compliance & Community Relations",
      "Non-ERP",
      "—",
      "Meets EIA/environmental conditions and manages community relations and public complaints during construction"
    ],
    [
      "PM-09",
      "Safety Officer Functions",
      "Non-ERP",
      "—",
      "Runs daily safety inspections, incident reporting, safety training and regulatory compliance"
    ],
    [
      "PM-10",
      "Foreman — Work Supervision",
      "Non-ERP",
      "—",
      "Directs daily labour and subcontractor work and enforces quality and schedule"
    ],
    [
      "PM-11",
      "Machinery Operation Supervision",
      "Non-ERP",
      "—",
      "Supervises plant and heavy-equipment operation on site — deployment, operator scheduling and safe use; the machine itself is an Asset (FA) item"
    ],
    [
      "PM-12",
      "QA/QC Material & Lab Testing",
      "Non-ERP",
      "—",
      "Samples and tests construction materials (concrete, asphalt, soil compaction) and submits results for DOH approval, logging non-conformances and re-tests"
    ],
    [
      "PM-13",
      "Subcontractor Supervision & Verification",
      "Non-ERP",
      "—",
      "Inspects the site daily and measures completed quantities against the WO scope before authorising billing"
    ],
    [
      "PM-14",
      "Subcontractor Progress Claim Verification",
      "Non-ERP",
      "—",
      "Verifies subcontractor work quantities before approving the progress billing"
    ],
    [
      "PM-15",
      "Subcontractor Advance / Retention Request",
      "Non-ERP",
      "—",
      "Manually prepares and sends the subcontractor advance or retention release request to head office; head office records the billing (รับวางบิล) and processes payment",
      true
    ],
    [
      "PM-16",
      "Daily Work Log & Progress Report",
      "Non-ERP",
      "—",
      "Records daily weather, manpower, equipment hours and progress, and submits weekly summaries"
    ],
    [
      "PM-17",
      "Site Progress Monitoring & Reporting",
      "ERP",
      "PM module",
      "Monitors actual-versus-planned progress via the Mango PM module dashboard, which is automatically compiled from all ERP departments feeding the system; PM uses this view to report site progress to head office each งวด period"
    ],
    [
      "PM-18",
      "Work Submission to DOH (Owner Progress Claim)",
      "Non-ERP",
      "—",
      "Jointly measures completed work with the DOH committee and certifies it; PM hands over the document package and sends it to head office for AR processing — no ERP use at site",
      true
    ],
    [
      "PM-19",
      "DOH Contract & K-factor Monitoring",
      "Non-ERP",
      "—",
      "Tracks K-factor, retention %, installment conditions, extension clauses and late-payment interest per project"
    ],
    [
      "PM-20",
      "DOH Meetings & Negotiations",
      "Non-ERP",
      "—",
      "Attends DOH meetings, site walk-downs and negotiations — progress, variations, claims, K-factor, time extensions and disputes — representing VCB and relaying outcomes to the team"
    ],
    [
      "PM-21",
      "5S / Quality Control & Defect Review",
      "Non-ERP",
      "—",
      "Inspects site quality, maintains the defect/punch list and signs off resolution before billing or handover"
    ],
    [
      "PM-22",
      "Final Work Measurement & Handover",
      "Non-ERP",
      "—",
      "Measures 100% completion, prepares the final progress certificate and coordinates DOH inspection and handover"
    ],
    [
      "PM-23",
      "Defect Liability Period Management",
      "Non-ERP",
      "—",
      "Resolves all DOH defect notices during the liability period and obtains clearance for retention release"
    ]
  ],
  "fin": [
    [
      "FIN-01",
      "Project Cash Flow for Bank Credit Facility",
      "Non-ERP",
      "Excel",
      "Builds the per-project cash flow from the Master Plan (งวด schedule) and submits it to the bank as the official basis for securing the project credit facility (P/N, BG, advance) — an external submission, not an internal T-bar"
    ],
    [
      "FIN-02",
      "Monthly Cash Expense Planning (T-bar)",
      "Non-ERP",
      "Excel",
      "Plans monthly cash-out / expense as a consolidated T-bar across VCB, CVE and the VN JV (one of the two core Finance T-bars)"
    ],
    [
      "FIN-03",
      "Credit Facility Planning (T-bar)",
      "Non-ERP",
      "Excel",
      "Plans bank credit-facility drawdown and headroom (P/N, AVAL, BG, LC, ML) as a T-bar over the plan horizon"
    ],
    [
      "FIN-04",
      "Fund Allocation Optimisation",
      "Non-ERP",
      "Excel",
      "Decides which credit facility (P/N, AVAL, ML) to draw for each payment"
    ],
    [
      "FIN-05",
      "P/N (Promissory Note) Management",
      "Non-ERP",
      "Excel",
      "Sources discount rates, prepares P/N drawdowns per installment and tracks maturity"
    ],
    [
      "FIN-06",
      "AVAL / B/E Preparation",
      "Non-ERP",
      "Bank form",
      "Prepares the AVAL / B/E bank form per payee (beneficiary, amount, maturity days), obtains CEO signature and submits to the bank for authorisation"
    ],
    [
      "FIN-07",
      "Bank Guarantee (BG) Management",
      "Non-ERP",
      "Excel",
      "Manages bank-guarantee contracts (retention, advance) and tracks expiry and renewal"
    ],
    [
      "FIN-08",
      "Letter of Credit (LC) & L/G Management",
      "Non-ERP",
      "Excel",
      "Manages LC and L/G credit lines and coordinates with Procurement for material imports"
    ],
    [
      "FIN-09",
      "Mortgage Loan (ML) Revolver Management",
      "Non-ERP",
      "Excel",
      "Monitors the mortgage-loan revolver drawdown, repayment schedule and interest accrual"
    ],
    [
      "FIN-10",
      "Budget Analysis",
      "Non-ERP",
      "Excel",
      "Compares planned versus actual budget per project and company-wide"
    ],
    [
      "FIN-11",
      "Payment Processing (Cheque/Transfer)",
      "ERP",
      "AP module",
      "Executes approved outbound payments by cheque or transfer (Preparing Cheque, Txn 5)"
    ],
    [
      "FIN-12",
      "Cheque Preparation & Register",
      "ERP → Non-ERP",
      "AP module",
      "Prepares the cheque/transfer (Txn 5) and prints and manages the cheque register"
    ],
    [
      "FIN-13",
      "Post-dated Cheque (PDC) Register",
      "ERP",
      "AP module",
      "Issues and tracks post-dated cheques and their due dates in the PDC register (AP Txn 7.3)"
    ],
    [
      "FIN-14",
      "iCash Electronic Payment",
      "Non-ERP",
      "iCash",
      "Authorises and processes bulk payments via the iCash platform"
    ],
    [
      "FIN-15",
      "DOH Contract Terms Monitoring",
      "Non-ERP",
      "Excel",
      "Monitors retention-release conditions, payment terms and late-payment interest"
    ],
    [
      "FIN-16",
      "Informal Debt Grace Period Negotiation",
      "Non-ERP",
      "—",
      "Negotiates payment extensions with suppliers"
    ],
    [
      "FIN-17",
      "Actual Expense Recording (P&L)",
      "ERP",
      "GL module",
      "Posts actual expense entries for P&L reporting"
    ],
    [
      "FIN-18",
      "Inter-JV Group Transfers (via AP)",
      "ERP",
      "AP module",
      "Transfers funds between group JV entities directly in AP, bypassing the normal AP set-up, and posts to GL"
    ],
    [
      "FIN-19",
      "Bank Charges & Interest Payment (own dept)",
      "Non-ERP → ERP",
      "OF module",
      "Pays own-department bank expenses — transfer fees, bill-discounting fees and bank interest — by opening OF",
      true
    ],
    [
      "FIN-20",
      "Bank Reconciliation",
      "ERP + Non-ERP",
      "Excel",
      "Reconciles the ERP ledger and FN balances against bank statements and resolves differences"
    ],
    [
      "FIN-21",
      "AVAL Discounting / B/E Sale",
      "Non-ERP",
      "Excel",
      "Shops the lowest discount rate across financial institutions, prepares the internal CEO use-of-proceeds memo, and sells the AVAL to receive immediate cash at a discount instead of waiting for maturity"
    ],
    [
      "FIN-23",
      "Non-Invoice Receipt (AR-1.2)",
      "ERP",
      "AR module",
      "Finance books non-invoice cash receipts in Mango AR (AR-1.2) for bank loan drawdowns, AVAL sale proceeds, inter-JV transfers, and borrowed funds. System issues RL number immediately; Finance completes without Accounting involvement."
    ],
    [
      "FIN-22",
      "P/N Preparation",
      "Non-ERP",
      "Bank form",
      "Prepares the Promissory Note (P/N) bank form in three variants: against work done (50% of certified value), against retention (80%), and against งวดงาน progress installment (80%). Obtains CEO signature and submits to bank for issuance. Feeds P/N into Credit Facility register and Cash Flow Forecast."
    ]
  ],
  "acc": [
    [
      "ACC-01",
      "Accounts Payable Recording (APV / APS / APO)",
      "ERP",
      "AP module",
      "Records all three AP document types: APV (vendor invoice from PO Receive), APS (subcontractor billing from รับวางบิล), APO (OF/petty cash non-PO disbursement)"
    ],
    [
      "ACC-02",
      "Pre-Payment Voucher (APP)",
      "ERP",
      "AP module",
      "Prepares the payment voucher (ใบสำคัญเตรียมจ่าย) from posted AP — APV, APS or APO — consolidating the net amount due and routing to Finance for cheque/transfer execution"
    ],
    [
      "ACC-03",
      "Transfer Slip & Document Processing",
      "Non-ERP → ERP",
      "GL module",
      "Records incoming bank-transfer slips, matches them to expected receipts and posts to GL",
      true
    ],
    [
      "ACC-04",
      "AR Invoice Issuance to DOH/Client",
      "ERP",
      "AR module",
      "Issues and posts the AR tax invoice to the client on an approved work claim"
    ],
    [
      "ACC-05",
      "AR Trading / Inter-company Sales",
      "ERP",
      "AR module",
      "Books cross-entity and trading material sales (AR Invoice Other / Trading), separate from DOH/client progress billing"
    ],
    [
      "ACC-06",
      "AR Receipt Recording",
      "ERP",
      "AR module",
      "Records incoming DOH/client payments against open AR invoices"
    ],
    [
      "ACC-07",
      "Receivables Collection & Client Follow-up",
      "Non-ERP",
      "—",
      "Chases client/DOH payment on or before due date, resolves billing discrepancies and tracks receipt status"
    ],
    [
      "ACC-08",
      "Site Petty Cash Entry",
      "ERP",
      "OF module",
      "Records site petty-cash and non-PO disbursements (Txn 1)"
    ],
    [
      "ACC-09",
      "Advance Payment Report (Project / JV / Unit / Other)",
      "ERP → Non-ERP",
      "OF / GL module",
      "Tracks and reports outstanding advances (เงินทดรองจ่าย) by category — Project, Joint Venture (JV), Unit/Department and Other — monitoring advanced-vs-cleared balances so uncleared advances are followed up and cleared"
    ],
    [
      "ACC-10",
      "Site Monthly Cost Report",
      "Non-ERP",
      "Excel",
      "Reports the monthly site cost summary (labour, materials, equipment)"
    ],
    [
      "ACC-11",
      "Month-End GL Closing",
      "ERP",
      "GL module",
      "Runs period-end journal entries, accruals and depreciation and locks the period"
    ],
    [
      "ACC-12",
      "Financial Statements",
      "ERP",
      "GL module",
      "Produces the monthly P&L, balance sheet and cash-flow statement from ERP data"
    ],
    [
      "ACC-13",
      "Management Reporting (Cost by Project)",
      "Non-ERP",
      "Excel",
      "Allocates cost per project and entity and produces the management-version reports"
    ],
    [
      "ACC-14",
      "IC Inventory Accounting",
      "ERP",
      "IC module",
      "Maintains stock valuation, write-offs and inventory adjustments"
    ],
    [
      "ACC-15",
      "Fixed Asset Accounting",
      "ERP",
      "FA module",
      "Records asset additions, disposals and depreciation schedules"
    ],
    [
      "ACC-16",
      "Real-Time Account Monitoring & Alerts",
      "ERP + Non-ERP",
      "GL module",
      "Monitors unposted documents, pending approvals and overdue entries"
    ],
    [
      "ACC-17",
      "VAT Return PP.30",
      "ERP + Non-ERP",
      "RD e-filing",
      "Files the monthly VAT return (PP.30) on the RD e-filing portal from GL data"
    ],
    [
      "ACC-18",
      "Withholding Tax (WHT) Filing",
      "ERP + Non-ERP",
      "RD e-filing",
      "Files the withholding-tax returns (PND.1/3/53) on the RD e-filing portal from GL/OF data"
    ],
    [
      "ACC-19",
      "Corporate Income Tax (CIT) Filing",
      "ERP + Non-ERP",
      "RD e-filing",
      "Files the mid-year (PND.51) and annual (PND.50) corporate income tax from audited GL data, coordinating adjustments with the external auditor"
    ],
    [
      "ACC-20",
      "External Audit Coordination",
      "Non-ERP",
      "—",
      "Coordinates the annual statutory audit with the external auditor — prepares schedules, answers queries and finalises the audited financial statements"
    ]
  ],
  "proc": [
    [
      "PO-01",
      "PR Review",
      "ERP",
      "OF module",
      "Reviews the approved Purchase Request — specs, quantities, cost code and budget — before sourcing"
    ],
    [
      "PO-02",
      "Site Parcel (พัสดุ) — PR Review",
      "ERP",
      "OF module",
      "Reviews site-parcel Purchase Requests — checks details and specification — before forwarding to HQ Procurement"
    ],
    [
      "PO-03",
      "Vendor Sourcing & Quotation",
      "Non-ERP",
      "—",
      "Sources qualified vendors and obtains quotations (min. 3) for the quotation comparison"
    ],
    [
      "PO-04",
      "Quotation Comparison & Selection",
      "ERP",
      "PO module",
      "Compares quotations, selects the lowest compliant bidder and documents the rationale"
    ],
    [
      "PO-05",
      "Vendor Approval & Contract Signing",
      "Non-ERP",
      "—",
      "Presents the price comparison for director approval, negotiates final terms, and signs the vendor contract or LOI"
    ],
    [
      "PO-06",
      "Subcontractor Selection & Subcontract",
      "Non-ERP",
      "—",
      "Selects the subcontractor, issues scope and invites quotations, and signs the subcontract (with stamp duty)"
    ],
    [
      "PO-07",
      "PO / WO Issuance",
      "ERP",
      "PO module",
      "Issues the Purchase Order (materials) or Work Order (services) to the selected supplier"
    ],
    [
      "PO-08",
      "Delivery Coordination & Expediting",
      "Non-ERP",
      "—",
      "Confirms delivery dates with vendors, notifies site and store, prepares receiving, and expedites late deliveries"
    ],
    [
      "PO-09",
      "Import & Customs Clearance",
      "Non-ERP",
      "—",
      "Handles imported materials and equipment — shipping, customs clearance and duty, coordinating the LC with Finance"
    ],
    [
      "PO-10",
      "Credit Term Negotiation (Supplier)",
      "Non-ERP",
      "—",
      "Negotiates supplier payment terms (30/45/60 days) aligned to project cash flow"
    ],
    [
      "PO-11",
      "Material Lead Time Planning",
      "Non-ERP",
      "—",
      "Plans material ordering against the Engineering Master Plan lead times"
    ],
    [
      "PO-12",
      "Bulk Buying Planning",
      "Non-ERP",
      "—",
      "Identifies volume-discount opportunities and coordinates them with Finance"
    ],
    [
      "PO-13",
      "AVAL Offset Arrangement",
      "Non-ERP",
      "—",
      "Coordinates with Finance to pay suppliers by AVAL bill of exchange (current or overdue) instead of cash"
    ],
    [
      "PO-14",
      "Creditor Debt Restructuring",
      "Non-ERP",
      "—",
      "Negotiates extended payment plans, coordinating AVAL/P/N support with Finance"
    ],
    [
      "PO-15",
      "Vendor & Subcontractor Pre-qualification (AVL)",
      "Non-ERP",
      "—",
      "Maintains the approved vendor/subcontractor list, vetting capability, finance, safety and past performance"
    ],
    [
      "PO-16",
      "Supplier Tier Classification (Tier 1–4)",
      "Non-ERP",
      "Excel",
      "Classifies and maintains suppliers by tier (1–4) and reviews them annually"
    ],
    [
      "PO-17",
      "Market Price Database Maintenance",
      "Non-ERP → ERP",
      "Excel",
      "Maintains the weekly material price database that feeds PO benchmark pricing"
    ],
    [
      "PO-18",
      "Anti-Monopoly Enforcement",
      "Non-ERP",
      "—",
      "Enforces Tier 1–4 supplier rotation to prevent single-supplier dependency"
    ],
    [
      "PO-19",
      "Supplier Blacklist Management",
      "Non-ERP",
      "Excel",
      "Maintains the blacklist of non-performing suppliers and enforces it across all PRs"
    ]
  ],
  "asset": [
    [
      "ASSET-FA-01",
      "Fixed Asset Registration",
      "ERP",
      "FA module",
      "Registers new equipment/vehicles with cost, useful life and depreciation method"
    ],
    [
      "ASSET-FA-02",
      "Fleet Management & Tracking",
      "ERP",
      "FA module",
      "Registers and tracks all company vehicles and machinery"
    ],
    [
      "ASSET-FA-03",
      "GPS & Fleet Monitoring",
      "Non-ERP",
      "GPS system",
      "Monitors real-time vehicle/fleet location and usage and flags unauthorised use or anomalies (HQ central; sites flag issues upward)"
    ],
    [
      "ASSET-FA-04",
      "Preventive Maintenance (PM) Scheduling",
      "ERP + Non-ERP",
      "FA module",
      "Schedules and records preventive-maintenance services per asset and tracks service history"
    ],
    [
      "ASSET-FA-05",
      "Workshop Coordination (ศูนย์ซ่อมสาย 5)",
      "Non-ERP",
      "—",
      "Coordinates equipment repairs with the Line 5 workshop using job cards"
    ],
    [
      "ASSET-FA-06",
      "Machinery / Repair & Rental PR Review",
      "ERP",
      "OF module",
      "Reviews machinery, repair and external-rental Purchase Requests — checks spec, supplier and the buy-vs-repair-vs-rent decision — before procurement proceeds"
    ],
    [
      "ASSET-FA-07",
      "Vehicle Insurance Renewal",
      "Non-ERP → ERP",
      "OF module",
      "Tracks vehicle-insurance expiry and pays the premium by opening OF; downgrades cover from Class 1 to Class 2+/3 for vehicles 3+ years old",
      true
    ],
    [
      "ASSET-FA-08",
      "Vehicle Road Tax (ภาษีรถ) Renewal",
      "Non-ERP → ERP",
      "OF module",
      "Tracks vehicle road-tax due dates and pays by opening OF",
      true
    ],
    [
      "ASSET-FA-09",
      "Fleet Right-Sizing & Disposal",
      "Non-ERP",
      "—",
      "Identifies underutilised vehicles and executes their write-off and sale"
    ],
    [
      "ASSET-FA-10",
      "Asset Transfer & Gate Pass",
      "Non-ERP",
      "—",
      "Raises the asset-transfer request, issues the gate pass, arranges transport, and hands paperwork to Accounting to record the FA transfer",
      true
    ],
    [
      "ASSET-FA-12",
      "PQ Documentation (กรมบัญชีกลาง)",
      "Non-ERP",
      "—",
      "Prepares pre-qualification documents for the Government Comptroller listing"
    ],
    [
      "ASSET-FA-13",
      "Monthly Asset & Cost Reports",
      "Non-ERP",
      "Excel",
      "Reports monthly fuel cost, maintenance cost and asset utilisation per project"
    ],
    [
      "ASSET-IC-01",
      "IC Inventory Management (Materials)",
      "ERP",
      "IC module",
      "Receives, stores and issues site materials and records the stock movements"
    ],
    [
      "ASSET-IC-02",
      "PO Receipt Entry (Site)",
      "ERP",
      "PO module",
      "Confirms goods received against the PO at site so AP can pay; IC stock-in is the next step"
    ],
    [
      "ASSET-IC-03",
      "Segment Factory Output — IC Recording",
      "ERP",
      "IC module",
      "Records approved finished segments into IC as finished goods; rejects post as IC write-off"
    ],
    [
      "ASSET-IC-04",
      "Fuel Quota Monitoring",
      "ERP",
      "IC module",
      "Sets and monitors the fuel quota per vehicle/machine and tracks and reports monthly consumption"
    ],
    [
      "ASSET-IC-05",
      "Site Security & Guarding",
      "Non-ERP",
      "—",
      "Arranges site security guards and access control to protect materials, equipment and property"
    ],
    [
      "ASSET-IC-06",
      "Surplus Material / Scrap Auction",
      "Non-ERP → ERP",
      "FA module",
      "Counts and auctions surplus materials and assets; Accounting books the AR sale and Asset does the FA write-off",
      true
    ],
    [
      "ASSET-IC-07",
      "Project Insurance (CAR)",
      "Non-ERP → ERP",
      "OF module",
      "Arranges Contractor All-Risk/liability cover on award and tracks premium, expiry and claims",
      true
    ],
    [
      "ASSET-IC-08",
      "Asset & Stock Audit",
      "Non-ERP",
      "—",
      "HQ asset team physically counts IC stock and fixed assets at site and reconciles against ERP records",
      true
    ]
  ],
  "hr": [
    [
      "HR-01",
      "Headcount Planning & Authorisation",
      "Non-ERP",
      "Excel",
      "Plans headcount per project/department and controls new-hire approvals"
    ],
    [
      "HR-02",
      "Recruitment & Onboarding",
      "Non-ERP",
      "—",
      "Sources, screens and hires candidates and runs the 90-day onboarding"
    ],
    [
      "HR-03",
      "Employment Contract Management",
      "Non-ERP",
      "—",
      "Drafts, executes and maintains employment contracts per role"
    ],
    [
      "HR-04",
      "Payroll Processing (Month-End)",
      "ERP",
      "OF module",
      "Compiles payroll and executes the month-end payroll payment"
    ],
    [
      "HR-05",
      "OT Management (Deferred)",
      "Non-ERP → ERP",
      "OF module",
      "Collects Doc 08 OT authorisations and batch-processes them into month-end payroll"
    ],
    [
      "HR-06",
      "Attendance & Leave Tracking",
      "Non-ERP",
      "Excel",
      "Maintains attendance records and manages annual, sick and other leave"
    ],
    [
      "HR-07",
      "Performance Evaluation & KPI",
      "Non-ERP",
      "—",
      "Runs the KPI and performance-review system and links it to salary"
    ],
    [
      "HR-08",
      "Salary Benchmarking",
      "Non-ERP",
      "—",
      "Researches market salary data and recommends adjustments"
    ],
    [
      "HR-09",
      "Disciplinary Proceedings",
      "Non-ERP",
      "—",
      "Handles misconduct investigations, warning letters and termination"
    ],
    [
      "HR-10",
      "PDPA Compliance",
      "Non-ERP",
      "—",
      "Manages employee-data privacy — consent, access and breach procedures"
    ],
    [
      "HR-11",
      "Funeral / Bereavement Benefit",
      "Non-ERP → ERP",
      "OF module",
      "Pays the funeral/bereavement benefit by opening OF",
      true
    ],
    [
      "HR-12",
      "Org Chart & Reporting Structure Management",
      "Non-ERP",
      "—",
      "Maintains the official org chart and reporting-line changes"
    ],
    [
      "HR-13",
      "Social Security (SSO) Filing & Registration",
      "Non-ERP → ERP",
      "SSO e-Service",
      "Registers joiners/leavers and files the monthly SSO contribution (สปส.1-10), paying via OF",
      true
    ],
    [
      "HR-14",
      "Foreign / Migrant Labour Management",
      "Non-ERP",
      "—",
      "Manages migrant-worker permits, visas, quota and 90-day reporting and tracks renewals"
    ],
    [
      "HR-15",
      "Provident Fund & Benefits Administration",
      "Non-ERP",
      "Excel",
      "Administers the provident fund and employee benefits and reconciles contributions"
    ],
    [
      "HR-16",
      "Site HR / Admin — Employee Records",
      "ERP",
      "OF module",
      "Maintains site employee records and processes personnel documents with HQ HR"
    ],
    [
      "HR-17",
      "Site OT Entry (Doc 08)",
      "Non-ERP → ERP",
      "OF module",
      "Records daily OT hours and submits Doc 08 to HQ HR for payroll",
      true
    ]
  ],
  "site": [
    [
      "SITE-01",
      "Site HR / Admin — Employee Records",
      "ERP",
      "OF module",
      "Maintain site employee records; process personnel documents; coordinate with HQ HR"
    ],
    [
      "SITE-02",
      "Site OT Entry (Doc 02A)",
      "Non-ERP → ERP",
      "OF (deferred)",
      "Record daily OT hours; submit Doc 02A to HQ HR for month-end payroll processing",
      true
    ],
    [
      "SITE-03",
      "Site Petty Cash Entry",
      "ERP",
      "OF module",
      "Record and submit site petty cash expenditures in Mango OF (Petty Cash / non-PO disbursement, Txn 1)"
    ],
    [
      "SITE-04",
      "Site Monthly Cost Report",
      "Non-ERP",
      "Excel",
      "Monthly site cost summary (labour, materials, equipment) for management"
    ],
    [
      "SITE-05",
      "Site Parcel (พัสดุ) — PR Review",
      "ERP",
      "OF module",
      "Check PR details; verify specification before forwarding to HQ Procurement"
    ],
    [
      "SITE-06",
      "PO Receipt Entry (Site)",
      "ERP",
      "PO module",
      "Site confirms goods received against the PO in real time (PO Receive) so AP can pay; forward physical docs; stock-in via IC is the next step"
    ],
    [
      "SITE-07",
      "GPS & Vehicle Monitoring (Site)",
      "Non-ERP",
      "GPS system",
      "Monitor site vehicles; report fuel usage; flag anomalies to HQ Property & Asset"
    ],
    [
      "SITE-08",
      "Site Fuel & Material Monthly Report",
      "Non-ERP",
      "Excel",
      "Monthly report on fuel consumption, material usage, machinery hours"
    ],
    [
      "SITE-09",
      "Surveying (งานสำรวจ)",
      "Non-ERP",
      "—",
      "Site surveying, setting-out, quantity measurement for billing and quality"
    ],
    [
      "SITE-10",
      "Safety Officer Functions",
      "Non-ERP",
      "—",
      "Daily safety inspections, incident reporting, safety training, regulatory compliance"
    ],
    [
      "SITE-11",
      "Foreman — Work Supervision",
      "Non-ERP",
      "—",
      "Direct daily labour and subcontractor work; enforce quality and schedule"
    ],
    [
      "SITE-12",
      "Machinery Operation",
      "Non-ERP",
      "—",
      "Operate cranes, excavators, compactors, concrete mixers, and heavy equipment"
    ],
    [
      "SITE-13",
      "Site Workshop Repair (ศูนย์ซ่อม)",
      "Non-ERP",
      "—",
      "On-site machinery repair; liaises with Line 5 workshop HQ"
    ],
    [
      "SITE-14",
      "Segment Factory Output — IC Recording",
      "ERP",
      "IC module",
      "Record approved finished segments into Mango IC as finished goods; rejects posted as IC write-off to GL"
    ],
    [
      "SITE-17",
      "Doc 02C — PM Payment Request (Site)",
      "Non-ERP → ERP",
      "OF / FN module",
      "PM submits payment request to HQ Finance; triggers P/N or bank payment",
      true
    ],
    [
      "SITE-18",
      "Doc 03 — Work Submission to DOH",
      "Non-ERP → ERP",
      "AR module",
      "Site submits certified work to DOH; triggers AR billing at HQ",
      true
    ],
    [
      "SITE-19",
      "Subcontractor Progress Claim Verification",
      "Non-ERP",
      "—",
      "Verify subcontractor work quantities before PM approves progress billing"
    ],
    [
      "SITE-20",
      "Daily Work Log & Progress Report",
      "Non-ERP",
      "—",
      "Record daily weather, manpower, equipment, progress; submit weekly summaries"
    ]
  ]
};
