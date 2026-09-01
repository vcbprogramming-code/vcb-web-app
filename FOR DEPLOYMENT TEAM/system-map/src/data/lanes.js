
/** Verbatim transcription of LANES from the canonical Index.html (v8.86).
 *  10 lanes / 79 nodes total. */
export const LANES = [
  {
    "id": "lane-a",
    "label": "① Project\nSetup",
    "nodes": [
      {
        "id": "n-bd-pipeline",
        "type": "manual",
        "dept": "eng",
        "label": "BD / Tender\nPipeline",
        "sub": "",
        "desc": "Business-development pipeline BEFORE estimation — tracking tender opportunities and the bid/no-bid decision. Identify invitations to bid (government e-GP and private), screen for fit (project type, size, location, owner, our PQ grade), and decide go / no-go. Qualified opportunities pass to Estimation & Budgeting. Off-ERP (typically a tracking sheet).",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Capture tender invitations / leads (e-GP & private)",
          "Screen for fit: type, size, location, owner, PQ grade",
          "Bid / no-bid decision (capacity, margin, risk)",
          "Qualified opportunities → Estimation & Budgeting"
        ]
      },
      {
        "id": "n-bid",
        "type": "manual",
        "dept": "pm",
        "label": "Estimation\n& Budgeting",
        "sub": "",
        "desc": "The first study — done OUTSIDE the ERP, jointly by the PM and an HQ engineer (mainly the PM). They read the tender drawings & TOR and build a first cost estimate and rough budget (usually in Excel). It is necessarily VAGUE (~80%) because tender information is limited; the point is a go / no-go on profitability. If the budget shows acceptable margin the job proceeds to e-Bidding; if not, it is dropped. The numbers are firmed up later in the post-award Master Plan (~80% → ~99%). Not in Mango.",
        "module": "",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Prepared jointly by the PM and an HQ engineer — mainly the PM",
          "Study the tender drawings, specifications and TOR",
          "Prepare a first cost estimate / rough budget — usually in Excel; vague (~80%) due to limited info",
          "Assess profitability / margin at this rough budget",
          "Go / no-go: if profitable → e-Bidding; otherwise drop the tender",
          "Numbers are firmed up later in the Master Plan (→ ~99%)"
        ]
      },
      {
        "id": "n-ebid",
        "type": "manual",
        "standalone": true,
        "dept": "eng",
        "label": "e-Bidding",
        "sub": "",
        "desc": "Pursued ONLY if Estimation & Budgeting shows the job is profitable. Engineering/BD assemble the tender package using the company’s contractor grade (PQ), obtain director approval, and submit through the government e-bidding system (e.g. DOH e-GP); then attend the bid. Win/loss is a real-world outcome — a won project enters the ERP at Project Registration. Not in Mango.",
        "module": "",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Proceed only when the rough budget shows acceptable profit",
          "Assemble the tender package using the contractor-grade / PQ standing",
          "Obtain director approval to submit",
          "Submit the tender via the e-bidding system (DOH e-GP) and attend the bid",
          "Record win/loss — a won project goes to the Master Plan, then Project Registration"
        ]
      },
      {
        "id": "n-m-eng-mp",
        "type": "manual",
        "dept": "pm",
        "label": "Engineering\nMaster Plan",
        "sub": "",
        "desc": "The PM produces the project master construction plan and schedule (the งวด / milestone plan) by hand (firming the rough bid budget from ~80% to ~99%), after award and before anything is entered into the ERP — including reviewing the issued-for-construction drawings and running a site dimension survey to confirm specs before the BOQ is locked. This manual master plan is the single source feeding (1) BD New Project Registration — the prerequisite ERP entry point (project + cost-code structure), which then sets up BOTH PM activities as siblings: Project Forecast (งวด schedule / billing timing) and Project Budget Control (values, Control & Approve, PM Txn 3/4) — and (2) the Finance project cash flow for the bank credit facility. Registration is the single gateway; Forecast and BOQ follow in PM. Manual — not in the ERP.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "PM builds the master construction schedule and งวด / milestone plan — firms the budget ~80% → ~99%",
          "Define the work sequence, durations and progress-measurement method",
          "Review the issued-for-construction drawings and run a site dimension survey; confirm specs are current before the BOQ is locked",
          "One source → BD Registration (prerequisite) → then PM Forecast + PM Budget/BOQ (siblings); plus Finance cash flow",
          "Feeds Finance: the basis for the project cash flow → bank credit-facility request",
          "Created manually, outside the ERP"
        ]
      },
      {
        "id": "n-open",
        "type": "erp",
        "dept": "eng",
        "label": "New Project\nRegistration",
        "sub": "BD module (Setup Project)",
        "desc": "THE FIRST ERP STEP (BD Module). When a tender is pursued, the project-budget team creates a new Tender (named after the bid), creates the Project and links the Award-status Tender. The Budget is defined in the BOQ template and IMPORTED (BOQ/Budget) into the system here in BD, then Init Summary Cost Code (Initial Budget). BOQ/Budget import is a BD function — not PM. The project budget is then carried into PM for Initial Project Budget → Control → Approve (PM Txn 3/4). [Reference: MG_STD BD-1.0/1.1]",
        "module": "BD",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Create Tender for the bid (BD Module)",
          "Create Project; link the Award-status Tender (น.20)",
          "Define Budget in the BOQ template, then Import BOQ/Budget into the system (BD)",
          "เริ่มต้น Summary Cost Code → งบประมาณเริ่มต้น (BD)",
          "For milestone (งวด) contracts: set up the billing milestones / งวด schedule used by progress claims",
          "Carry into PM: Initial Project Budget → Control → Approve"
        ]
      },
      {
        "id": "n-m-landcamp",
        "type": "manual",
        "dept": "pm",
        "loc": "site",
        "label": "Land Lease &\nSite Camp",
        "sub": "",
        "desc": "Securing the project’s temporary base for the ~3-year build. The PM / site team identify suitable land near the site, negotiate and sign the multi-year lease, then build / fit-out the temporary camp — worker quarters and staff housing with utilities (power, water, sanitation) — so staff can move in before work starts. Maintained through the project and reinstated / handed back at closeout. Manual / off-ERP.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Identify suitable land near the site; negotiate the multi-year lease (~3 yrs)",
          "Sign the lease contract; arrange lease payments (via OF)",
          "Build / fit-out the temporary camp — worker quarters, staff housing, utilities",
          "Staff move in before work starts; maintain the camp through the project",
          "Reinstate / hand the land back at project closeout"
        ]
      },
      {
        "id": "n-m-open",
        "type": "manual",
        "dept": "pm",
        "loc": "site",
        "label": "Mobilisation &\nSite Kick-off",
        "sub": "",
        "desc": "Physical site set-up before work begins.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Conduct formal site handover",
          "Assign site manager and key roles",
          "Brief all departments on scope",
          "Set up site office and facilities",
          "Establish site safety: assign safety officer (จป.) and set up the safety plan"
        ]
      },
      {
        "id": "n-plan",
        "type": "erp",
        "standalone": true,
        "dept": "eng",
        "label": "Project Forecast",
        "sub": "Forecast Income + Monthly Forecast",
        "desc": "In Mango PM there is no single \"master plan\" transaction; the plan is set via Project Forecast Income (งวด receipts: Advance/Progress/Retention, %Adv/Ret/VAT/WHT, น.7) and Monthly Project Forecast (per-Job Start/End + monthly budget, น.45). This is a planning / evaluation node: it sets the งวด receipt and monthly-budget baseline, then sits and is compared against actuals (Budget vs PU / Actual / Progress) as work happens — it does not trigger downstream flows; Materials, Subcontractor and Progress flows stem from the BOQ. [Reference: MG_STD BD-1.0 / PM Txn 2 & 7]",
        "module": "PM",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "PM → Project Forecast Income: set งวด, Payment Type (Adv/Progress/Retention), %Adv/Ret/VAT/WHT (น.7)",
          "PM → Monthly Project Forecast: set per-Job Start/End dates (น.45)",
          "Enter monthly Budget amounts; Material QTY forecast (น.46/52)",
          "Compare Budget vs PU/Actual/Progress (น.46)",
          "Evaluation only — compared against actuals as events occur; does not trigger downstream flows (those stem from the BOQ)"
        ]
      },
      {
        "id": "n-boq",
        "type": "erp",
        "dept": "eng",
        "label": "Project Budget\nControl",
        "sub": "PM module",
        "desc": "The project budget inside Mango PM. The BOQ/Budget imported in BD is brought in via Initial Project Budget (PM Txn 3); set Control Budget where budget control is required, then Approve Project Budget (PM Txn 4) to lock the version. All PRs and WOs reference the locked baseline. Maintained via Revise Budget; scope changes via Additional Work (VO). BOQ/Budget import itself happens in BD, not here. [Reference: MG_STD PM Txn 3-4]",
        "module": "PM",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Initial Project Budget (PM) — bring in the BOQ/Budget imported in BD",
          "Set Control Budget (where budget control is required)",
          "Approve Project Budget (PM Txn 4) to lock the version — all PRs/WOs reference it",
          "Revise Budget for corrections; Additional Work → Create VO for added/reduced scope"
        ]
      },
      {
        "id": "n-vo-bd",
        "type": "erp",
        "standalone": true,
        "dept": "eng",
        "label": "Additional Work\n(Variation · BD)",
        "sub": "BD module",
        "desc": "Additional / reduced (variation) work on the EXISTING project in Mango BD. The project unit records the change items — Import via Excel or key line by line (Material Code if BOQ-controlled, Cost Code, Qty/Unit, Unit Price for material/labour) — then Save & Submit Approve. In the Bill of Quantity window, select the Tender No. of the same project, Create VO and link Ref.VO (the approved Additional Work document) to the main BOQ; Init Summary Cost Code merges the cost codes of the same work. The updated BOQ feeds PM — Init Budget Cost, set Control Budget, then Approve Budget to lock the revision. Same project — no new registration. [Reference: MG_STD BD-1.x · PM Txn 3/4]",
        "module": "BD",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Project unit records the change items (add/reduce) — Import (Excel) or key line by line: Material Code (if BOQ-controlled), Cost Code, Qty/Unit, Unit Price (material/labour)",
          "Save & Submit Approve",
          "Bill of Quantity window: select the Tender No. of the same project code",
          "Create VO; link Ref.VO (the approved Additional Work doc) to the main BOQ",
          "Init Summary Cost Code — system merges cost codes used in the same work",
          "PM: Init Budget Cost to receive the updated BOQ",
          "Set Control Budget (if budget control is required)",
          "Approve Budget to lock the project-budget edits"
        ]
      },
      {
        "id": "n-pm-dash",
        "type": "erp",
        "standalone": true,
        "dept": "pm",
        "label": "PM Module\nDashboard",
        "sub": "Project Status Overview",
        "desc": "The PM module’s Project Status Overview — the single screen where all project-control data converges. Seven ERP modules feed it in real time so the PM can compare the planned budget (BD) against committed purchases (PO), actual booked cost (GL), and progress & billed revenue (OF, AR), alongside payable/receivable and inventory positions. [Reference: MG_STD PM — Inquiry/Dashboard]",
        "module": "PM",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "BD → BOQ & original Budget (budget-control baseline)",
          "PO → Purchase Cost (PO/WO) + Pending P/O & Pending Subcontractor",
          "OF → Actual Progress (Progress Submit) & Progress Payment",
          "AP → A/P Aging & A/P Retention",
          "AR → Invoiced, A/R Aging & A/R Retention",
          "GL → Actual Cost (Cost by Account) & booked P/L",
          "IC → Material usage & Material on Site"
        ]
      }
    ]
  },
  {
    "id": "lane-b",
    "label": "② Materials &\nProcurement",
    "nodes": [
      {
        "id": "n-prequal",
        "type": "manual",
        "dept": "proc",
        "label": "Vendor & Subcon\nPre-qualification",
        "sub": "",
        "desc": "NOT YET FORMALISED — a target to build out. A maintained list of pre-qualified vendors and subcontractors with capability, financial, safety and past-performance checks, feeding selection so sourcing starts from an approved pool. Today selection is largely ad-hoc; this would add an Approved Vendor List (AVL) and post-job performance scoring.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Register vendors / subcontractors with documents (capability, financials, safety)",
          "Maintain an Approved Vendor List (AVL) by trade",
          "Score performance after each job (quality, schedule, safety)",
          "Feed approved pool into Vendor Sourcing & Subcon Selection"
        ]
      },
      {
        "id": "n-pr",
        "type": "erp",
        "dept": "proc",
        "loc": "site",
        "label": "Purchase\nRequest",
        "sub": "OF → APPROVE",
        "desc": "Purchase Request opened in Mango OF by the site admin (พัสดุ) on behalf of the site PM — the PR is the demand signal, so the site decides what and when to order (call-off timing is controlled here, not in a separate planning step). Choose doc type: PR For PO/WO, PR For PO Only, or PR For WO Only — referencing BOQ (PR-1.1) or not (PR-1.2); buying materials for a subcontractor uses PR For PO Only with Cost + subcontractor name + WO ref (PR-1.3). Two-level approval: site PM (PM-05), then HQ Engineer (ENG-15: Warisa purchase / Sahawut contract), before the approved PR can be pulled into a PO/WO. [Reference: MG_STD PR-1.1/1.2/1.3]",
        "module": "OF",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Site admin (พัสดุ) opens the PR in OF on behalf of the PM; select type (PR For PO/WO, PO Only, or WO Only)",
          "Select Material Code + Cost Code (M/S/L) + qty/unit price, referencing the BOQ (or open without BOQ)",
          "Site PM approves (PM-05), then HQ Engineer approves (ENG-15: Warisa purchase / Sahawut contract)",
          "Approved PR is pulled by Procurement to open the PO (materials) or WO (subcontract)",
          "Cross-project buy (different entity): buyer project opens a PR at the source project's stock-issue cost and routes it to HQ Procurement",
          "Machinery / heavy-equipment repair & external machinery rental PRs are reviewed and handled by Asset Management (spec, supplier, buy-vs-repair-vs-rent)"
        ]
      },
      {
        "id": "n-m-vend",
        "type": "manual",
        "dept": "proc",
        "label": "Vendor Sourcing\n& Quotation",
        "sub": "",
        "desc": "Procurement sources vendors and collects quotations before ERP entry.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Contact qualified vendors (min. 3 quotes required)",
          "Collect samples for Engineering review",
          "Check vendor certifications",
          "Prepare quotation comparison"
        ]
      },
      {
        "id": "n-compare",
        "type": "erp",
        "dept": "proc",
        "label": "Compare\nPrice",
        "sub": "PO module",
        "desc": "Procurement compares price in Mango PO: record a price-request document referencing the PR, then enter each vendor quotation for comparison and selection. [Reference: MG_STD PO-1.1]",
        "module": "PO",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Record the price-request document referencing the approved PR",
          "Enter vendor quotation prices for comparison",
          "Flag deviations vs. BOQ budget; recommend vendor",
          "Authoriser approves in the system",
          "Proceeds to open the PO"
        ]
      },
      {
        "id": "n-m-neg",
        "type": "manual",
        "dept": "proc",
        "label": "Vendor Approval\n& Contract",
        "sub": "",
        "desc": "Management sign-off and contract execution.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Present comparison to director",
          "Obtain signed approval",
          "Negotiate final terms",
          "Sign physical vendor contract / LOI (Letter of Intent) where no full purchase contract is made"
        ]
      },
      {
        "id": "n-po",
        "type": "erp",
        "dept": "proc",
        "label": "Purchase\nOrder",
        "sub": "PO module",
        "desc": "PO issued to vendor in Mango PO (PO from approved Compare Price). Specify project/Job and purchase type — Cost, Asset, or Stock. Locks price, quantity, delivery terms. [Reference: MG_STD PO-1.2]",
        "module": "PO",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Pull the approved PR to open the PO",
          "Specify project/Job and purchase type: Cost / Asset / Stock",
          "Authoriser approves and signs in the system",
          "Send the PO to the vendor (vendor receives and prepares delivery)",
          "Down-payment or cash PO: booked and paid via AP immediately (direct to AP, bypassing PO Receive)",
          "Cross-project / shared fuel: open a blanket PO (PO คลุมยอด) for the month at a fixed monthly price (per engineer estimate) so stock is received real-time; price the PO at the source's stock-issue cost + 1% (never below cost)"
        ]
      },
      {
        "id": "n-m-del",
        "type": "manual",
        "dept": "proc",
        "label": "Delivery\nCoordination",
        "sub": "",
        "desc": "Coordinate delivery with vendor and prepare site to receive.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Confirm delivery date with vendor",
          "Notify site and store",
          "Prepare receiving area",
          "Follow up on late deliveries"
        ]
      },
      {
        "id": "n-receive",
        "type": "erp",
        "dept": "asset",
        "loc": "site",
        "label": "PO\nReceive",
        "sub": "PO module — PO Receive",
        "desc": "PO Receive is a PO-module function: the site admin confirms goods received against the PO in real time (PO น.83) so Accounting can set up the payable (ตั้งหนี้ APV) and AP can pay for the goods received. The site admin does the receiving and physically inspects the goods in real time as they arrive (count vs delivery note, check for damage / wrong spec, reject non-conforming). Receiving those goods into a warehouse — Stock Receive into IC — is the next step (IC น.31). [Reference: MG_STD PO Txn 1.3 · PO น.83]",
        "module": "PO",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Site confirms goods received against the PO in real time — PO Receive (PO น.83)",
          "Physically inspect on arrival — count, quality check, reject non-conforming (real-time at receipt)",
          "Pick the PO; enter receive date, tax-invoice & D/O no./date, quantities",
          "Receive in full or in part (Receive QTY / แบ่งรับ)",
          "Generates the receipt → Accounting pulls it to ตั้งหนี้ APV in AP → payment",
          "Next step (separate): Stock Receive into the IC warehouse (IC น.31)",
          "No-PO cash purchase: Receive Other"
        ]
      },
      {
        "id": "n-ic-recv",
        "type": "erp",
        "standalone": true,
        "dept": "asset",
        "loc": "site",
        "label": "IC Receive\n(Stock-in)",
        "sub": "IC module · Txn 1",
        "desc": "IC Receive (Document IC Receive, IC Txn 1) — receives accepted deliverables into the warehouse stock at site. Goods come from a PO Receive (stock buys go through PO/PR, not a blind advance receipt), a cash/petty Receive Other, or leftover repair parts returned at ฿0. Landed/other cost can be added to the material value (Enter Cost Material Other). Casting-yard finished segments are also received as IC finished goods. [Reference: MG_STD IC Txn 1/6 · IC น.18/98]",
        "module": "IC",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Record stock-in by item, warehouse and location (IC Receive, IC Txn 1)",
          "Sources: PO Receive (stock buys via PO/PR), cash/petty Receive Other, leftover repair parts at ฿0",
          "Enter Cost Material Other — add landed / other cost (freight, duty) onto the material value (IC Txn 6, น.98)",
          "Records casting-yard finished segments as IC finished goods (rejects → GL write-off)"
        ]
      },
      {
        "id": "n-ic-issue",
        "type": "erp",
        "standalone": true,
        "dept": "asset",
        "loc": "site",
        "label": "IC Issue\n(Draw-down)",
        "sub": "IC module · Txn 2",
        "desc": "IC Issue (การเบิกวัสดุ, IC Txn 2) — withdraw materials from the warehouse to be consumed / used directly within the CURRENT project: prepare the issue document (ใบเตรียมเบิก), specify the Area Code (สถานที่เบิกวัสดุไปใช้) where the materials are used, then IC Issue (ตัดสต๊อก). Stock is permanently deducted to reflect actual project usage; cost flows to the project Cost Code → GL. Variants: issue to a repair (Maintenance); to a subcontractor under a WO (value deducted on their progress claim); or a cross-entity sale (Area Code = คิดเงิน → AR Trading, น.34). [Reference: MG_STD IC Txn 2 · IC น.48; AR น.34]",
        "module": "IC",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Prepare the issue document (ใบเตรียมเบิก); specify the Area Code where materials are used (IC Txn 2)",
          "IC Issue (ตัดสต๊อก) — stock permanently deducted to reflect actual project usage",
          "Cost flows to the project Cost Code → GL; low stock → new PR",
          "Variant: issue to a repair (Maintenance)",
          "Issue to a subcontractor (under a WO) → value contra-deducted on their Subcontractor Progress (รับวางบิล) claim, before AP; if no price is agreed in the contract, charge the month's highest pump price",
          "Cross-entity sale (Vichitphan ↔ JV affiliates): IC Issue with Area Code = 'คิดเงิน' (billable) → sells across projects → AR Trading tax invoice (same day or ≤1 business day back)"
        ]
      },
      {
        "id": "n-ic-xfer",
        "type": "erp",
        "standalone": true,
        "dept": "asset",
        "loc": "site",
        "label": "IC Transfer\n(Inter-site)",
        "sub": "IC module · Txn 3",
        "desc": "IC Transfer (การโอนย้ายวัสดุ, IC Txn 3) — relocate materials from this project's warehouse to a DIFFERENT project. Select the destination project (To Project); IC Transfer cuts the stock from the sending project's warehouse. The move is not complete until the destination project performs an IC Receive Transfer (การรับโอนวัสดุ) to accept the materials into its own warehouse. Used to move leftover or requested stock between project sites; same item value. [Reference: MG_STD IC Txn 3 · IC น.81]",
        "module": "IC",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Select the destination project (To Project), not a usage area (IC Txn 3)",
          "IC Transfer cuts stock from the sending project's warehouse",
          "Destination project performs IC Receive Transfer (การรับโอนวัสดุ) to accept the stock — required to complete",
          "Used to move leftover / requested stock between project sites; same item value",
          "Same-entity shared fuel / materials (e.g. received at Bangtoey–Banprao, used at Bangwua–Bangcholong) → cost transferred to the using project's books; not a sale"
        ]
      }
    ]
  },
  {
    "id": "lane-c",
    "label": "③ Subcontractor\n& Payables",
    "nodes": [
      {
        "id": "n-m-sub-sel",
        "type": "manual",
        "dept": "proc",
        "label": "Subcon Selection\n& Contract",
        "sub": "",
        "desc": "Subcontractor selected and contracted before any ERP Work Order is issued.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Identify candidate subcontractors",
          "Issue scope-of-work and invite quotations",
          "Evaluate proposals",
          "Sign subcontract agreement",
          "Affix stamp duty (อากรแสตมป์) on the signed hire-of-work contract — 0.1% of contract value (capped ฿10,000)"
        ]
      },
      {
        "id": "n-wo",
        "type": "erp",
        "dept": "proc",
        "label": "Work\nOrder",
        "sub": "PO module",
        "desc": "Work Order (หนังสือสั่งจ้าง) issued to a subcontractor in Mango PO, from a PR For WO. Linked to the BOQ subcontract scope. [Reference: MG_STD PO-1.2]",
        "module": "PO",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Open WO from the approved PR For WO",
          "Link to the BOQ subcontractor scope; set start/end dates",
          "Define payment milestones (Advance / Progress / Retention)",
          "Authoriser approves; issue WO to the subcontractor",
          "System tracks budget vs. commitment"
        ]
      },
      {
        "id": "n-m-super",
        "type": "manual",
        "dept": "pm",
        "loc": "site",
        "label": "Site Supervision\n& Verification",
        "sub": "",
        "desc": "Engineering’s day-to-day site oversight: monitor and verify the subcontractor’s work, run quality control (QA/QC — inspections, material testing, ITP hold-points and NCRs), oversee site safety / SHE (จป., toolbox, PPE, permit-to-work), and certify completed work before progress billing.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Daily site inspections; verify subcontractor work",
          "QA/QC: Inspection & Test Plans (ITP); material tests (concrete cube/slump, soil compaction)",
          "Raise Non-Conformance Reports (NCR) + corrective action",
          "Measure completed quantities; sign off completed sections",
          "Oversee site safety / SHE: จป., toolbox, PPE, permit-to-work",
          "Record & investigate incidents / accidents"
        ]
      },
      {
        "id": "n-sub-prog",
        "type": "erp",
        "dept": "eng",
        "label": "Subcontractor\nProgress",
        "sub": "OF module (รับวางบิล)",
        "desc": "Subcontractor submits work/claim; the site measures & verifies it, then the docs are sent from site to HQ Engineering, who records the รับวางบิล in Mango OF — เบิกตามใบสั่งจ้าง, selecting Advance / Progress / Retention payment. After approval, Accounting pulls it into AP to ตั้งหนี้ APS (by Bill No.) and schedules payment. Materials issued to this subcontractor from VCB IC are raised as an AR Trading receivable (น.34) and netted off on this same รับวางบิล page (before AP), which settles that receivable; any unrecovered balance carries to the next cycle. Retention withheld from each claim is released and paid back to the subcontractor at the end of their defect-liability period (clear the AP retention). [Reference: MG_STD Billing-1.1/1.2/1.3 → AP-1.2 · AR น.34]",
        "module": "OF",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Subcontractor submits work / billing request against the WO",
          "Site measures; docs sent to HQ Engineering, who records รับวางบิล in OF — select Advance / Progress / Retention",
          "Enter claim amount, delivery/billing dates and remarks",
          "Net off any VCB materials issued to this subcontractor (IC issue) — raised as an AR Trading receivable (น.34), settled here before AP",
          "Authoriser approves the OF billing document",
          "Accounting pulls it to AP — ตั้งหนี้ APS by Bill No. → payment",
          "Retention release: at the end of the subcontractor's defect-liability period, release the withheld retention (clear AP retention) → pay back to the subcontractor"
        ]
      },
      {
        "id": "n-m-ap-v",
        "type": "manual",
        "dept": "acc",
        "label": "Verify Claim &\nPrepare AP",
        "sub": "",
        "desc": "Accounting verifies the subcontractor claim and prepares the net AP entry. The materials issued from VCB IC were already netted off on the Subcontractor Progress page; Accounting verifies the net claim and any carried-forward balance.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Cross-check claim against Work Order quantities and site verification",
          "Check the IC materials already netted off at the progress page (and any carried-forward balance)",
          "Carry forward any unrecovered material balance to next billing cycle",
          "Apply retention deduction per contract terms",
          "Prepare net payment voucher (claim minus materials issued minus retention)",
          "Obtain project manager sign-off before posting AP"
        ]
      },
      {
        "id": "n-ap",
        "type": "erp",
        "dept": "acc",
        "label": "Accounts\nPayable",
        "sub": "AP module",
        "desc": "Accounting sets up the payable (ตั้งหนี้) in Mango AP by source: APV from PO goods receipt (incl. advance/deposit, Txn 1.2), APS from subcontractor OF billing (by Bill No.) — Normal, Advance or Retention, matching the Payment Type chosen at Subcontractor Progress — APO from OF petty-cash/other. Then approves payment (Pre-Payment) and routes to Finance. [Reference: MG_STD AP-1.1 APV / AP-1.2 APS / AP-1.3 APO]",
        "module": "AP",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "APV — set up payable from PO goods receipt (incl. down-payment/deposit, Txn 1.2)",
          "APS — set up payable from the subcontractor OF billing, by Bill No., in one of three forms: Normal (back-to-back progress payment), Advance, or Retention (release of the balance withheld across prior claims, once the subcontractor's defect-liability period is cleared)",
          "APO — set up payable from OF petty-cash / advance / other documents",
          "Approve payment — Pre-Payment (APV/APS/APO)",
          "Route to Finance for cheque / bank transfer"
        ]
      },
      {
        "id": "n-ap-cn",
        "type": "erp",
        "standalone": true,
        "dept": "acc",
        "label": "AP Credit Note\n(ลดหนี้)",
        "sub": "AP module · Txn 2",
        "desc": "Accounting issues a payable credit note (ลดหนี้) against an existing APV/APS/APO when goods are returned, a subcontractor is over-billed, or a price/qty dispute reduces the amount owed — reversing the payable before payment. [Reference: MG_STD AP Txn 2 · AP น.57]",
        "module": "AP",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Open ลดหนี้ referencing the original APV / APS / APO",
          "Reasons: returned goods, over-billing, price/qty dispute, retention adjustment",
          "Reverses the payable (Dr A/P, Cr expense/asset) before payment",
          "Net the reduced balance into the next payment batch"
        ]
      },
      {
        "id": "n-m-pay-v",
        "type": "manual",
        "dept": "fin",
        "label": "Director Approval\n& Payment Prep",
        "sub": "",
        "desc": "Physical authorisation and bank submission.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Print payment summary for director",
          "Obtain director / MD signature",
          "Submit to bank and confirm reference number",
          "Compile every cheque / B/E / transaction (payee, amount, and where the funds go) into a management notification, in conjunction with the approval"
        ]
      },
      {
        "id": "n-payments",
        "type": "erp",
        "dept": "fin",
        "label": "Payment\nExecution",
        "sub": "AP module (Cheque / Transfer / iCash)",
        "desc": "Finance executes the payment in Mango AP: prepare the cheque or bank transfer — ใบสำคัญจ่าย (F), then confirm payment (PV). Accounting records ตัดเจ้าหนี้ (Clear AP). Posts to GL. Bulk batches (payroll, subcontractors, large supplier runs) are pushed through the iCash platform with director dual-approval, then matched back to the ERP entries. [Reference: MG_STD AP-1.1/1.2/1.3 — Finance side]",
        "module": "AP",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Finance prepares cheque / bank transfer — ใบสำคัญจ่าย (F)",
          "Bulk batches → iCash platform (payroll / subcontractors / suppliers): director dual-approval, then matched back to ERP",
          "Record withholding tax (WHT) deducted",
          "Confirm the payment — ยืนยันการจ่าย (PV)",
          "Accounting records ตัดเจ้าหนี้ (Clear AP)",
          "Post-dated cheque (PDC) register — issue & track due dates (AP Txn 7.3, น.207)",
          "Retroactive / late tax-invoice handling (AP Txn 7.2, น.202)",
          "Posts to General Ledger"
        ]
      }
    ]
  },
  {
    "id": "lane-k",
    "label": "④ Petty Cash\n& Advances",
    "nodes": [
      {
        "id": "n-petty",
        "type": "erp",
        "dept": "acc",
        "loc": "site",
        "label": "Petty Cash\n& Advances",
        "sub": "OF module (Txn 1)",
        "desc": "Open an OF None-PO/WO disbursement in Mango OF — Type: Petty Cash, Advance, Clear Advance, or Other. After approval, Accounting pulls it into AP to ตั้งหนี้ APO, then it is paid like any other payable (AP → Payment → GL). It does NOT post straight to GL. [Reference: MG_STD OF-1.1/1.2/1.3/1.4 → AP-1.3 APO] · Petty-cash / advance purchases — including machine-repair parts — go into IC stock first (IC Receive Other), then are issued to the repair. Machine repairs normally run PR → PO; but the Asset team also draws an OF advance / petty cash when a repair needs immediate cash or grows mid-job (a one-part fix turns into several) — most repairs are still PO.",
        "module": "OF",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Open OF; select Type: Petty Cash / Advance / Clear Advance / Other",
          "Set Vendor Type (Employee; External for Other), project, Expense Code",
          "Enter amount, VAT and WHT, and the receipt document number",
          "Clear Advance references the original advance document",
          "Shared OF module — other departments also open OF: HR (payroll, funeral/welfare, SSO), Finance (bank charges & interest), Property & Asset (vehicle insurance, road tax, CAR)",
          "Approve → Accounting ตั้งหนี้ APO in AP → Payment (cheque/transfer) → GL"
        ],
        "routes": [
          {
            "n": "Petty Cash (เงินสดย่อยในมือ)",
            "d": "Reimburse small cash expenses already paid. Vendor Type = Employee; with VAT/WHT where applicable. Books payable APO. [OF น.4]"
          },
          {
            "n": "Advance (เงินทดรองจ่าย)",
            "d": "Cash advanced to an employee BEFORE spending — a prepayment that must be cleared later. Vendor Type = Employee. [OF น.31]"
          },
          {
            "n": "Clear Advance (เคลียร์เงินทดรองจ่าย)",
            "d": "Reconcile the advance against actual receipts — refund the unused balance or top up an overspend; references the original advance document. [OF น.37]"
          },
          {
            "n": "Other (จ่ายอื่น ๆ)",
            "d": "Direct payment to an EXTERNAL creditor (electricity, Revenue Dept / tax). Vendor Type = External; books APO to that vendor. [OF น.76]"
          }
        ]
      },
      {
        "id": "n-m-petty",
        "type": "manual",
        "standalone": true,
        "dept": "acc",
        "loc": "site",
        "label": "Float Top-up\n& Receipts",
        "sub": "",
        "desc": "Site collects petty-cash receipts and supporting documents and reconciles the cash float before submitting a reimbursement or advance request to HQ. The reimbursement is keyed as an OF (Clear Advance / Petty Cash) at Petty Cash & Advances, booked in AP, and paid via Payment Execution — that payment is what tops up the float.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Collect and sort receipts by expense type",
          "Reconcile remaining float against the cash book",
          "Attach approvals for any item over the petty-cash limit",
          "Prepare the reimbursement / advance request for HQ",
          "Reimbursement is paid through OF → AP → Payment — that is what tops up the float"
        ]
      }
    ]
  },
  {
    "id": "lane-d",
    "label": "⑤ Progress &\nRevenue",
    "nodes": [
      {
        "id": "n-m-prog",
        "type": "manual",
        "dept": "pm",
        "loc": "site",
        "label": "Site Measurement\n& Progress Docs",
        "sub": "",
        "desc": "Measuring the actual completed work to certify progress for the งวด claim, before entry in Mango. For government / Department of Highways (DOH) projects this is a JOINT site measurement — the owner’s inspection committee (คณะกรรมการตรวจการจ้าง) / DOH officials come to measure on site TOGETHER with the site PM and team, and the jointly-agreed quantities become the certified basis for the progress payment.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Internal pre-measurement of completed work vs the BOQ, with photo evidence",
          "Joint site measurement with the owner / DOH inspection committee (คณะกรรมการตรวจการจ้าง) + site PM & team",
          "Agree certified quantities / % complete per cost code for the งวด",
          "Owner-signed measurement sheet → basis for the Progress Submit / certificate"
        ]
      },
      {
        "id": "n-progress",
        "type": "erp",
        "dept": "eng",
        "label": "Progress\nSubmit",
        "sub": "OF module (ใบเบิกผลงาน)",
        "desc": "Owner-facing progress claim (ส่งมอบงานโครงการ / Progress Submit) in Mango OF — a two-step cycle: enter the claim (by งวด/Job or by BOQ %), then Submit Certificate with the owner-approved Amount Certification and Certification Date, which releases it to AR. [Reference: MG_STD OF Txn 3 → AR-1.1]",
        "module": "OF",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Open ส่งมอบงานโครงการ / Progress Submit; project & debtor auto-fill (น.124)",
          "Select Payment Type: Progress / Advance / Retention (น.123)",
          "Enter amount per Job, or % / QTY by BOQ + VO No. (น.125/143)",
          "Submit Certificate: confirm Amount Certification (editable to owner-approved) (น.127)",
          "Enter Certification Date → releases to Accounting to open the AR invoice (น.130)"
        ]
      },
      {
        "id": "n-doh-k",
        "type": "manual",
        "standalone": true,
        "dept": "pm",
        "label": "DOH Contract &\nK-factor",
        "sub": "Contract monitoring",
        "desc": "Monitors the DOH contract terms and the ค่า K (K-factor) price-escalation formula. Each progress payment (งวด) is adjusted up or down by the K-factor, computed from the government-published material / fuel / labour price indices vs the base month, then applied to the certified claim before AR billing. Also tracks retention %, installment conditions and interest dates.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Track DOH contract terms: retention %, installment (งวด) conditions, interest dates",
          "Compute the ค่า K (K-factor) adjustment per งวด from the published price indices vs the base month",
          "Apply the K-factor adjustment (±) to the certified งวด claim",
          "Flag changes that affect the progress claim before AR billing"
        ]
      },
      {
        "id": "n-m-ar",
        "type": "manual",
        "dept": "acc",
        "label": "Billing Package\n& Tax Invoice",
        "sub": "",
        "desc": "Accounting assembles the progress claim package for the client.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Compile progress certificate with Engineering sign-off",
          "Attach photos and measurement sheet",
          "Calculate billing amount per contract formula",
          "Prepare tax invoice with VAT",
          "Deliver to client"
        ]
      },
      {
        "id": "n-ar",
        "type": "erp",
        "dept": "acc",
        "label": "AR\nInvoice",
        "sub": "AR module · AR-1.1",
        "desc": "Accounting issues the client invoice in Mango AR from the certified OF claim — types: down-payment/deposit, progress (งวดงาน), or retention release — then sets up the receivable (ตั้งบัญชีลูกหนี้-รายได้, Create Voucher Invoice). [Reference: MG_STD AR-1.1 · AR น.5/15/25/78]",
        "module": "AR",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Open ใบแจ้งหนี้ by type: down/deposit (น.5), Progress (น.15), Retention (น.25)",
          "Reference the OF certification no., or select the project directly (น.16)",
          "Other invoices: Trading / Service-Others (น.34/42)",
          "Open as tax invoice; assign project + งวด (น.18)",
          "Set up receivable — ตั้งบัญชีลูกหนี้ รายได้, Voucher + Due Date (น.80)"
        ]
      },
      {
        "id": "n-ar-cn",
        "type": "erp",
        "standalone": true,
        "dept": "acc",
        "label": "AR Credit Note\n(ใบลดหนี้)",
        "sub": "AR module · Txn 2",
        "desc": "Accounting issues a receivable credit note (ใบลดหนี้) against an existing client invoice when the certified quantity is reduced, a billing error is corrected, or a retention/discount adjustment lowers the billed amount — reducing the receivable and the recognised revenue + output VAT. [Reference: MG_STD AR Txn 2 · AR น.61]",
        "module": "AR",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Open ใบลดหนี้ referencing the original client invoice",
          "Reasons: qty reduction after joint measurement, billing correction, discount/retention adjustment",
          "Reduces the receivable and reverses over-recognised revenue + output VAT",
          "Re-issue a corrected tax invoice if required"
        ]
      },
      {
        "id": "n-m-chase",
        "type": "manual",
        "dept": "acc",
        "label": "Client Follow-up\n& Payment Chase",
        "sub": "",
        "desc": "Accounting follows up with client and tracks incoming payment against the AR ledger.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Email / call client on or before due date",
          "Resolve billing discrepancies",
          "Track cheque or bank transfer status",
          "Update cash flow forecast"
        ]
      },
      {
        "id": "n-receipt",
        "type": "erp",
        "dept": "acc",
        "label": "Receipt\nVoucher",
        "sub": "AR module",
        "desc": "Three steps in Mango AR: issue the receipt/tax invoice from the invoice (น.99), record the receipt RL/RV with bank + Paid Type (น.127), then ตัดลูกหนี้ Clear AR (น.141). Post-dated cheques supported; receipts with no invoice use AR-1.2. [Reference: MG_STD AR-1.1 / 1.2]",
        "module": "AR",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Issue ใบเสร็จ/ใบกำกับภาษี from the invoice; set Receipt Date (น.99)",
          "Record receipt RL/RV: bank account + Paid Type (cheque/cash/transfer) (น.128)",
          "Post-dated cheque supported; clear when it clears (น.132/150)",
          "ตัดลูกหนี้ Clear AR by RL/RV No.; check GL (น.143)",
          "Other receipts with no invoice: AR-1.2 (น.170)"
        ]
      },
      {
        "id": "n-gl",
        "type": "erp",
        "dept": "acc",
        "label": "GL Close\n& Report",
        "sub": "GL module",
        "desc": "General Ledger in Mango — manual JV adjustments plus automatic postings from other modules: FA depreciation & write-off, IC cost transfers, Rental, Retention/PO write-off, Cost Sheet, revenue recognition, and MA. Period close then financial reports. [Reference: MG_STD GL-1.1 / 1.2 + close]",
        "module": "GL",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Post manual adjusting entries — สมุดรายวัน / JV",
          "Book recurring JV templates and month-end accruals — auto-reversed next period",
          "Receive automatic postings: FA depreciation/write-off, IC, Rental, Retention/PO write-off, Cost Sheet, revenue recognition, MA",
          "Lock the accounting period (close)",
          "Generate P&L, Balance Sheet, Cash Flow",
          "Produce the management cost-per-project report",
          "Tax filings (VAT PP.30, WHT PND.1/3/53, CIT) and the external audit are all compiled from GL data — filed/submitted externally (RD e-filing / external auditor)"
        ]
      },
      {
        "id": "n-m-recon",
        "type": "manual",
        "dept": "fin",
        "label": "Bank\nReconciliation",
        "sub": "",
        "desc": "AFTER the period’s transactions are posted to GL, Finance reconciles the book / GL cash balance against the bank statement and posts any correcting entries. GL is the system record of all ERP transactions; bank reconciliation is the manual check of GL vs the statement, so it comes AFTER GL. Covers ALL bank accounts incl. the bank credit-facility accounts (vs bank statements / credit-limit certificates, in Excel).",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Download the bank statement",
          "Match GL / Mango cash entries to the statement",
          "Identify unmatched / timing differences",
          "Post correcting journal entries back to GL",
          "Native Mango GL Reconcile (งบกระทบยอด, GL Txn 3) complements this manual Excel check",
          "Reconcile bank facility accounts vs bank statements & credit-limit certificates"
        ]
      }
    ]
  },
  {
    "id": "lane-e",
    "label": "⑥ Asset\nManagement",
    "nodes": [
      {
        "id": "n-m-tag",
        "type": "manual",
        "standalone": true,
        "dept": "asset",
        "label": "Asset Tagging",
        "sub": "",
        "desc": "Physically tag and label the asset — barcode, serial, useful life — before it is entered into the FA register.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Assign unique asset tag / barcode",
          "Photograph and record serial number",
          "Determine useful life for depreciation",
          "Note initial custodian — deployment is handled separately via Asset Transfer & Gate Pass"
        ]
      },
      {
        "id": "n-fa",
        "type": "erp",
        "standalone": true,
        "dept": "asset",
        "label": "Fixed\nAsset",
        "sub": "FA module",
        "desc": "Fixed-asset register in Mango FA. Set up masters (Asset Type, Depreciation Method, Location, Rental Rate), record assets (key/Import/Copy), check machine status / condition, count, depreciate → GL, transfer, write off, and record maintenance + reminders. [Reference: MG_STD FA-1.1/1.2/1.3]",
        "module": "FA",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Set up masters: Asset Type, Depreciation Method, Location, Rental Rate (น.5)",
          "Record asset — Entry Asset (key / Import / Copy) (น.34)",
          "Check & record machine status / condition — functional check on receipt; condition at the month-end count",
          "Month-end physical count — Count Asset, via app (น.78)",
          "Depreciation computed monthly (FA Txn 5): posts a JV → GL — Dr Depreciation (admin) or Cost (project), Cr Accumulated Depreciation; project machinery/vehicles depreciate into that project's cost",
          "Transfer (FA Transfer, น.64); Write off — Sale/Expired/Loss → GL (น.117)"
        ]
      },
      {
        "id": "n-maint",
        "type": "erp",
        "standalone": true,
        "dept": "asset",
        "label": "Maintenance",
        "sub": "FA · Transaction 4",
        "desc": "Schedule and record asset maintenance. The asset team identifies assets due for service, coordinates providers and downtime, and supervises the work; the cost is then booked in Mango — there is NO separate Maintenance module, so it is FA Transaction 4 (ค่าบำรุงรักษาและค่าใช้จ่าย, FA น.89), recorded with vendor/VAT/WHT, with repair history and tax/insurance/maintenance reminders; the cost flows to GL. [Reference: MG_STD FA-1.1] · Every repair carries its asset reference so the cost lands on that machine’s history. Cross-entity repairs use a “Z…” asset-code group (no depreciation). Leftover spare parts after a repair go back to IC stock via a Manual receive at ฿0.",
        "module": "FA",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Schedule service: identify assets due, contact providers, arrange downtime, supervise the work",
          "Record maintenance/expense: Maintenance code, Vendor, Amount, VAT, WHT (น.89)",
          "View repair & expense history pulled from FA and other modules (น.96)",
          "Set alerts: maintenance / tax / insurance — Alert Date + Status (น.99)",
          "Cost flows to GL",
          "Leftover spare parts → back to IC stock via Manual receive at ฿0"
        ]
      },
      {
        "id": "n-m-fa-xfer",
        "type": "manual",
        "standalone": true,
        "dept": "asset",
        "label": "Asset Transfer\n& Gate Pass",
        "sub": "",
        "desc": "Physical inter-site move of a machine / vehicle / asset. The holding site raises a transfer request, gets approval, issues a gate pass and arranges transport; the receiving site inspects and signs for the asset on arrival, then the paperwork goes to Accounting to record the FA Transfer in the ERP.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Originating site raises an asset-transfer request (asset, reason, destination site)",
          "Obtain approval (PM / asset owner)",
          "Issue gate pass; arrange transport / logistics",
          "Receiving site inspects and signs for the asset on arrival",
          "Hand the paperwork to Accounting to record the FA Transfer in Mango"
        ]
      },
      {
        "id": "n-fa-xfer",
        "type": "erp",
        "standalone": true,
        "dept": "asset",
        "label": "FA Transfer",
        "sub": "FA · Transfer (น.64)",
        "desc": "FA Transaction 2 — the Asset Transfer document (น.62-69), distinct from the FA register itself. Raises the transfer voucher (optionally referencing an approved transfer-request), records the transport details — driver, vehicle registration, transported-by, due date and receive-asset date — then reassigns the holder (Employee Code) and Location to a new Project / Department. The document date is what switches the next depreciation onto the new project’s cost. Also used to reconcile the physical count: an asset found under a project that does not own it is transferred to the counting one. The asset stays on the register (no write-off); the system generates the ใบโอนทรัพย์สิน transfer form. [Reference: MG_STD FA Txn 2 · FA น.62-69]",
        "module": "FA",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Raise the transfer voucher — optionally ref. an approved transfer-request (น.64)",
          "Record transport: driver, vehicle registration, transported-by, due / receive-asset dates (น.65)",
          "Select the asset(s); reassign holder (Employee Code) and new Location",
          "Set To Project / Department — the document date switches depreciation to the new project’s cost",
          "Reconcile the count: move an asset found under the wrong project to the counting one (น.66)",
          "System generates the ใบโอนทรัพย์สิน transfer form (น.68)"
        ]
      },
      {
        "id": "n-disposal",
        "type": "manual",
        "standalone": true,
        "dept": "asset",
        "label": "Surplus & Scrap\nDisposal Sale",
        "sub": "",
        "desc": "At / after site work the asset-management team disposes of leftover materials and surplus items — count all leftover materials (sand, soil, scrap metal, etc.) and surplus / idle assets on site, then hold a bidding / auction to find the highest bidder, sell, and receive the proceeds back into the company as income. Fixed / surplus assets sold this way are written off in FA (FA-1.3 Sale); leftover materials & scrap are billed via AR (Invoice Other / Trading) → receipt. Manual.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Count leftover materials (sand, soil, scrap metal) & surplus assets on site",
          "Hold a bidding / auction → select the highest bidder",
          "Sell & hand over; collect payment",
          "Proceeds received back to the company — AR (Invoice Other/Trading) for materials; FA Write Off (Sale) for assets"
        ]
      },
      {
        "id": "n-fuel",
        "type": "manual",
        "standalone": true,
        "dept": "asset",
        "label": "Fuel, GPS &\nFleet Monitoring",
        "sub": "",
        "desc": "Fleet, plant & equipment management by the asset team — currently OUTSIDE the ERP (the MA Maintenance & Rental modules are not in use yet). Covers machine-hours / utilization per site, fuel issue & consumption (น้ำมัน) and reconciliation, and GPS / vehicle monitoring (real-time location, usage reports, unauthorised-use alerts) across the fleet (57+ vehicles + machinery). A candidate to bring into the ERP (MA / Rental) later.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Deploy equipment to site; log machine-hours / utilization",
          "Fuel issue & consumption (น้ำมัน) recording & reconciliation",
          "GPS & vehicle monitoring — real-time location, usage reports, unauthorised-use alerts",
          "Off-ERP today — MA / Rental modules not yet adopted",
          "Shared fuel tank across projects: allocate fuel in/out per project per the covering PO — for cost control, usage audit & reporting (same-entity → IC Transfer; cross-entity → IC Issue billable sale)"
        ]
      },
      {
        "id": "n-insurance",
        "type": "manual",
        "standalone": true,
        "dept": "asset",
        "label": "Project\nInsurance (CAR)",
        "sub": "",
        "desc": "Arrange and manage project insurance once the job is awarded — Contractor All-Risk (CAR), third-party liability, and equipment/plant cover. The asset-management team obtains quotes, binds the policy for the contract period, tracks premiums and expiry/renewal, and handles claims for site damage or loss. Off-ERP. (Project & accident insurance is also referenced in approval form 01.)",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Obtain CAR / liability / equipment insurance quotes on award",
          "Bind policy for the contract period; record sum insured & premium",
          "Track expiry / renewal vs project duration",
          "Handle claims for site damage, theft or loss"
        ]
      },
      {
        "id": "n-security",
        "type": "manual",
        "standalone": true,
        "dept": "asset",
        "label": "Site Security\n& Guarding",
        "sub": "",
        "desc": "Physical security of project sites — distinct from insurance (which transfers financial risk). The asset-management team arranges security guards on duty to protect materials, equipment and company/owner property against theft, vandalism and trespass, controls site access, and logs incidents. Hiring guards is approved via Property & Asset form 06. Manual / off-ERP.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Arrange security guards on duty (deploy / roster) per site",
          "Protect materials, equipment & property from theft / vandalism",
          "Control site access; gate & perimeter checks",
          "Log security incidents; coordinate with safety / police if needed"
        ]
      },
      {
        "id": "n-m-insp",
        "type": "manual",
        "standalone": true,
        "dept": "asset",
        "loc": "site",
        "label": "Asset & Stock\nAudit (HQ)",
        "sub": "",
        "desc": "Periodic on-site audit by the HQ Asset Management team — they visit each site to physically count inventory (IC stock) and fixed assets (FA register) and reconcile the counts against the ERP records and the monthly reports. Discrepancies are investigated and adjusted.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "HQ Asset team visits the site to physically count",
          "Count inventory (IC stock) and fixed assets (FA register)",
          "Reconcile physical counts vs ERP records & monthly reports",
          "Investigate & adjust discrepancies"
        ]
      }
    ]
  },
  {
    "id": "lane-f",
    "label": "⑦ HR &\nPayroll",
    "nodes": [
      {
        "id": "n-m-ot-site",
        "type": "manual",
        "dept": "pm",
        "loc": "site",
        "label": "Site & PM\nOT Sign-off",
        "sub": "",
        "desc": "Before HR can run payroll, the site team and the Project Manager accumulate every OT issued during the month, sign each OT authorisation (Doc 08), and forward the signed batch to HQ HR. This is the upstream source of the OT data.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Record each OT issued on site (Doc 08)",
          "PM / site manager signs every OT authorisation",
          "Accumulate and reconcile the month’s OT per worker",
          "Forward the signed Doc 08 batch to HQ HR"
        ]
      },
      {
        "id": "n-m-hr-ot",
        "type": "manual",
        "dept": "hr",
        "label": "Attendance &\nOT Collection",
        "sub": "",
        "desc": "HR and site teams collect attendance records, leave applications, and OT authorisations (Doc 08) for month-end payroll processing.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Collect Doc 08 OT authorisations from all project sites",
          "Compile daily attendance sheets and leave applications",
          "Reconcile absences, late arrivals, and unauthorised leave",
          "Prepare consolidated payroll input summary for HQ"
        ]
      },
      {
        "id": "n-hr-payroll",
        "type": "erp",
        "dept": "hr",
        "label": "Payroll\nProcessing",
        "sub": "OF module",
        "desc": "Month-end payroll computed and requisitioned via Mango OF (non-PO/WO disbursement). The net pay is then set up as a payable in AP (ตั้งหนี้) and paid like any other disbursement — AP → Payment (cheque/transfer or iCash) → GL. Covers base salary, OT, allowances, deductions and WHT. [Reference: MG_STD OF Txn 1 → AP-1.3 APO (payroll calc off-ERP)]",
        "module": "OF",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Calculate gross pay: base salary + OT + allowances",
          "Apply deductions: WHT, social security, advances",
          "Requisition the payroll batch via Mango OF",
          "Accounting sets up the net pay as a payable in AP — ตั้งหนี้",
          "AP pays via cheque/transfer or iCash, then posts to GL",
          "Generate payroll summary and payslips"
        ]
      },
      {
        "id": "n-m-hr-soc",
        "type": "manual",
        "dept": "hr",
        "label": "SSO & WHT\nFiling",
        "sub": "",
        "desc": "HR files monthly social security (SSO) contributions and withholding tax (PND.1) returns with government agencies.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Compile social security contribution summary",
          "Submit the monthly SSO filing and payment to the Social Security Office",
          "Compile payroll WHT data (PND.1) and pass to Accounting for the RD filing",
          "File and archive all submission receipts"
        ]
      },
      {
        "id": "n-m-hr-eval",
        "type": "manual",
        "dept": "hr",
        "label": "Performance\nEvaluation",
        "sub": "",
        "desc": "Periodic KPI-based performance review for all employees. Outcomes: (1) pass with satisfactory score → salary adjustment fed back into Payroll; (2) fail to meet performance standards or violate code of conduct → disciplinary action or termination — final pay processed through Payroll, severance (if applicable) raised as an AP entry through the standard payables lane.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Set KPI targets per role and department",
          "Conduct mid-year and annual review sessions",
          "Assess performance score against standard: satisfactory → propose salary adjustment; unsatisfactory or code-of-conduct violation → escalate to disciplinary process",
          "Disciplinary outcome: warning / PIP / termination — document decision and obtain management sign-off",
          "Termination: calculate final pay → process through Payroll; raise severance payment (if applicable) as AP entry",
          "Document all results and update HR records"
        ]
      }
    ]
  },
  {
    "id": "lane-h",
    "label": "⑧ Treasury\n& Facilities",
    "nodes": [
      {
        "id": "n-fin",
        "type": "erp",
        "standalone": true,
        "dept": "fin",
        "label": "Finance\nDashboards",
        "sub": "FN module (read-only)",
        "desc": "Mango FN (Finance System) — read-only dashboards to monitor the company’s cash and credit position. Pulls already-posted data from AP, AR, OF and GL (no data entry): Cash on Hand incl. AP & AR (all status), Cash Flow & Credit Line Facility, Financial Statement & Ratio, and revenue projection vs collection. [Reference: MG_STD FN — read-only · FN น.3–44]",
        "module": "FN",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Cash on Hand incl. AP & AR — usable vs pledged cash, AR/AP aging by grade (น.4)",
          "Cash Flow & Credit Line Facility — monthly in/out, liquidity, bank facilities (น.17)",
          "Financial Statement & Financial Ratio — P&L, balance sheet, 3-yr, % growth (น.28)",
          "Revenue projection vs actual collection, by project / credit term (น.39)",
          "Read-only — all entries originate in AP/AR/OF/GL; FN only visualises them"
        ]
      },
      {
        "id": "n-m-cf-forecast",
        "type": "manual",
        "standalone": true,
        "dept": "fin",
        "label": "Cash Flow\nForecast",
        "sub": "",
        "desc": "This panel covers two related Finance functions that share the same workspace. (1) Full-scale S-curve Cash Flow Forecast: built from the approved master plan, mapping inflows and outflows across the entire project timeline to identify the timing, amount, and type of credit facility required — the primary document submitted to the bank to secure the project credit facility. (2) Monthly T-bar (FIN-01 / FIN-02): a consolidated monthly cash expense plan and declaration of how reimbursed cash is allocated, maintained across VCB, CVE, and the VN JV as an ongoing operational tool.",
        "module": "",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "S-curve forecast: take the approved master plan (งวด schedule, milestones) and map all project inflows (งวด receipts) and outflows (PO/WO/payroll/overhead) across the full project timeline",
          "Plot the S-curve — identify timing and magnitude of cash shortfalls, the peak funding gap, and the repayment profile on client receipt",
          "Determine the timing, amount, and type of credit facility required at each stage (P/N, BG, advance payment facility, LC)",
          "Submit the completed S-curve forecast to the bank as the official basis for securing the project credit facility",
          "Update the forecast against actual progress, AR receipts, and AP commitments as the project runs — feeds Credit Facility Management decisions",
          "Monthly T-bar (FIN-01): plan monthly cash expense needs — consolidated across VCB, CVE, and VN JV",
          "Monthly T-bar (FIN-02): declare how reimbursed cash is allocated and spent for the month"
        ]
      },
      {
        "id": "n-m-pn-prep",
        "type": "manual",
        "standalone": true,
        "dept": "fin",
        "label": "P/N\nPreparation",
        "sub": "Bank form · CEO signature required",
        "desc": "Finance prepares and submits four types of Promissory Notes (P/N / ตั๋วสัญญาใช้เงิน) to the bank, each backed by a different document and carrying a different advance rate. All types require CEO signature on the bank form before submission. Manual, off-ERP.",
        "module": "",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "P/N against Work Done (50%) — backed by DOH progress certificate received during joint site measurement; bank advances 50% of the certified งวด amount",
          "P/N against Payment (80%) — backed by draft payment documents received at the start of each month, representing the forecast installment to be billed in the coming period; bank advances 80%",
          "P/N against Retention (80%) — backed by retention receivable per contract; bank advances 80% of the retention amount due on release",
          "P/N against K-factor (80%) — backed by K-factor price adjustment receivable; bank advances 80% of the K-factor amount",
          "Calculate draw amount for the selected P/N type based on the applicable percentage",
          "Complete the bank's P/N form: amount, maturity date, project reference; obtain CEO signature",
          "Submit to bank for issuance; record issued P/N in the Credit Facility register and update Cash Flow Forecast"
        ]
      },
      {
        "id": "n-m-aval-prep",
        "type": "manual",
        "standalone": true,
        "dept": "fin",
        "label": "AVAL / B/E\nPreparation",
        "sub": "",
        "desc": "Finance admin prepares the AVAL (ตั๋วแลกเงิน / Bill of Exchange) as an alternative payment method instead of immediate cash. Using the approved PO/WO as the source, they complete the official bank form listing the beneficiary (supplier or subcontractor), the amount and the maturity period (typically 30, 60 or 90 days until the payee can cash it). The completed form is submitted to the CEO for signature and then to the bank for authorisation of issuance. Once the bank issues the AVAL it can either be booked in AP as a normal payable or routed for discounting. Manual, off-ERP.",
        "module": "",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Use the approved PO/WO as the source document",
          "Complete the bank's official AVAL / B/E form: beneficiary name, amount, maturity days (30 / 60 / 90)",
          "Obtain CEO signature on the bank form",
          "Submit to the bank for authorisation and issuance",
          "Bank-authorised AVAL routes to AP (book as payable) OR to AVAL Discounting for immediate cash"
        ]
      },
      {
        "id": "n-m-aval-disc",
        "type": "manual",
        "standalone": true,
        "dept": "fin",
        "label": "AVAL Discounting\n(B/E Sale)",
        "sub": "",
        "desc": "Once the AVAL is issued, Finance may sell it to a financial institution at a discount to receive cash immediately rather than waiting for the maturity date. Finance shops the market for the lowest discount (อัตราดอกเบี้ยซื้อลด) rate across multiple banks, then prepares an internal memo for the CEO stating which AVAL tickets are being discounted, at what rate, and exactly what the cash proceeds will be used for (e.g. supplier payment, working capital). After CEO approval the tickets are sold and the proceeds flow back into the company. Manual, off-ERP.",
        "module": "",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Identify AVAL tickets eligible for early discounting (maturity not yet reached)",
          "Contact multiple financial institutions to obtain discount (อัตราดอกเบี้ยซื้อลด) rate quotes",
          "Select the institution offering the lowest discount rate",
          "Prepare internal CEO notification memo: AVAL details, rate, proceeds amount and intended use of funds",
          "Obtain CEO approval and sign-off on the discounting decision",
          "Execute the sale — endorse and deliver the tickets to the bank",
          "Receive cash proceeds back into the company account → update Cash Flow Forecast"
        ]
      },
      {
        "id": "n-m-facility",
        "type": "manual",
        "standalone": true,
        "dept": "fin",
        "label": "Credit Facility\nManagement",
        "sub": "",
        "desc": "Finance manages all bank credit facilities in one place — Promissory Notes (P/N), AVAL bills of exchange, Bank Guarantees (performance / advance / retention) and LC / L-G — doubling as the guarantee/bond register (every bond tracked per contract from issuance through expiry to return). Tracks drawdown, discount/interest rates, maturity & expiry, utilisation against limit, rollover and renewal. Per payment batch it also selects which facility to draw on (P/N / AVAL / ML revolver / direct balance) by comparing headroom, cost (rate, interest, fees) and tenor, then confirms the drawdown instruction to the bank.",
        "module": "",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "P/N: source bank discount rate, prepare per installment/payment batch, track maturity, roll over or repay on client receipt",
          "AVAL / B/E (ตั๋วแลกเงิน): list each payee; a payee may endorse the B/E so it can be discounted / sold to a bank for instant cash instead of waiting for maturity; track where the proceeds actually go (not always the full amount to the same party)",
          "Guarantee / bond register — bid bond, performance, advance-payment & retention guarantees tracked per contract: issuance → validity/expiry → return/release (advance-BG release tied to client repayment)",
          "LC / L-G for imported materials; coordinate drawdown with Procurement",
          "Track utilisation vs limit; submit renewals to the bank ≥30 days before expiry",
          "Per payment batch: choose the facility (P/N / AVAL / ML / direct) by headroom, cost and tenor; confirm the drawdown to the bank"
        ]
      },
      {
        "id": "n-bank-mgmt",
        "type": "erp",
        "standalone": true,
        "dept": "fin",
        "label": "Bank Account\nManagement",
        "sub": "PM module · inquiry",
        "desc": "A PM-module inquiry/monitoring tool for the financial status and movements of the company’s bank accounts. It draws directly from recorded receipt (money in) and payment (money out) transactions across the system — reflected in the Debit/Credit columns — to show, per bank account: total income vs expenses, outstanding and post-dated (advance) cheques, payment due dates, and cheques on hand. Consolidating this lets you compare available funds against pending obligations to plan future liquidity. [Reference: MG_STD PM — Inquiry/Bank Status]",
        "module": "PM",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Total income & expenses per bank account (Debit / Credit)",
          "Outstanding cheques & post-dated (advance) cheques",
          "Payment due dates & cheques on hand",
          "Available funds vs pending obligations → liquidity planning"
        ]
      },
      {
        "id": "n-interjv",
        "type": "erp",
        "standalone": true,
        "dept": "fin",
        "label": "Inter-JV Group\nTransfers",
        "sub": "AP module",
        "desc": "Finance moves funds between the group’s JV entities (VCB / CVE / VN JV) directly in the AP module — a finance-managed transfer that BYPASSES Accounting’s usual AP set-up (ตั้งหนี้) steps. Each transfer is recorded and posted to GL. [Reference: MG_STD AP-1.1 · AP น.14 (inter-JV — bypasses standard ตั้งหนี้)]",
        "module": "AP",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Identify the inter-JV transfer (from which entity → which, amount, purpose)",
          "Record directly in the AP module (Finance) — not via Accounting’s normal ตั้งหนี้ steps",
          "Execute the transfer (cheque / bank transfer / iCash)",
          "Posts to GL for both entities"
        ]
      },
      {
        "id": "n-ar-recv-ni",
        "type": "erp",
        "standalone": true,
        "dept": "fin",
        "label": "AR Without\nInvoice",
        "sub": "AR module · AR-1.2",
        "desc": "Finance books non-invoice cash receipts directly in the AR module (AR-1.2: Receive Without Invoice) — used for any money entering the company account that has no client invoice attached: bank loan drawdowns, AVAL/B/E sale proceeds, inter-JV entity transfers, and borrowed funds from external parties. Finance enters the receipt, selects the bank account, and the system immediately issues an RL number, keeping the bank statement current. Accounting intervention is not required for this step. [Reference: MG_STD AR-1.2 (น.170)]",
        "module": "AR",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Open AR module → Receive Without Invoice (AR-1.2)",
          "Select bank account and Paid Type (transfer / bank credit)",
          "Enter the amount and source of funds (bank drawdown, AVAL proceeds, inter-JV transfer, borrowed funds)",
          "System issues RL number on save — no client invoice reference required",
          "Finance completes without Accounting involvement",
          "Cash position reflects immediately in Bank Account Management"
        ]
      }
    ]
  },
  {
    "id": "lane-i",
    "label": "⑨ Compliance\n& Tax",
    "nodes": [
      {
        "id": "n-m-vat-compile",
        "type": "manual",
        "dept": "acc",
        "label": "VAT Data\nCompilation",
        "sub": "",
        "desc": "Accounting compiles all input and output VAT from project invoices and vendor payables each month, in preparation for the PP.30 filing.",
        "module": "",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Extract output VAT from all AR invoices issued to clients",
          "Extract input VAT from all vendor and subcontractor AP invoices",
          "Reconcile totals against GL VAT control accounts",
          "Calculate net VAT payable position or refund claim"
        ]
      },
      {
        "id": "n-vat-filing",
        "type": "manual",
        "dept": "acc",
        "label": "VAT Return\n(PP.30)",
        "sub": "",
        "desc": "Monthly VAT return (ภ.พ.30) prepared using data extracted from Mango GL, then submitted via the Revenue Department e-filing portal — external to ERP. Mango provides source data only; submission and payment are outside the system.",
        "module": "",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Generate VAT summary report from Mango GL module",
          "Verify output and input tax totals against the compiled schedule",
          "Submit PP.30 by 15th of following month via RD e-filing portal",
          "Record VAT payment in Mango OF after submission; post to GL"
        ]
      },
      {
        "id": "n-m-wht-compile",
        "type": "manual",
        "dept": "acc",
        "label": "WHT\nCompilation",
        "sub": "",
        "desc": "Compile all withholding tax deducted from vendor, subcontractor, and employee payments during the month for PND.1/3/53 returns.",
        "module": "",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Extract WHT from all OF payment records (PND.1 payroll, PND.3 services, PND.53 companies)",
          "Match each WHT entry to the original AP or payroll line",
          "Prepare supporting schedules by recipient and tax ID",
          "Flag any missing tax IDs before submission deadline"
        ]
      },
      {
        "id": "n-wht-filing",
        "type": "manual",
        "dept": "acc",
        "label": "WHT Returns\n(PND.1/3/53)",
        "sub": "",
        "desc": "Monthly WHT returns (PND.1/3/53) prepared from data extracted from Mango GL and OF, then submitted via the Revenue Department e-filing portal — external to ERP. The accounting team uses ERP data but the filing is done outside Mango.",
        "module": "",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Submit PND.1 (employees), PND.3 (individuals), PND.53 (companies) via RD e-filing portal",
          "Pay WHT liability via Mango OF module after filing; record in GL",
          "File and archive all submission receipts and tax certificates",
          "Reconcile WHT payable GL account to zero after filing confirmation"
        ]
      },
      {
        "id": "n-m-cit",
        "type": "manual",
        "dept": "acc",
        "label": "Corporate Income Tax\n(PND.50/51)",
        "sub": "",
        "desc": "Annual and mid-year corporate income tax preparation. Accounting coordinates with the external auditor for audit-aligned CIT computation and government filing.",
        "module": "",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Prepare mid-year CIT estimate (PND.51) — due August each year",
          "Compile annual taxable income from audited GL statements",
          "Coordinate tax adjustments and allowable deductions with the external auditor",
          "File PND.50 by end of May following the fiscal year-end"
        ]
      },
      {
        "id": "n-m-pq",
        "type": "manual",
        "standalone": true,
        "dept": "eng",
        "label": "Contractor Grade\n& PQ Status",
        "sub": "",
        "desc": "HQ Engineering maintains the company contractor grade with the DOH (ชั้นพิเศษ / Special Grade) and equivalent grades with EXAT and RID. Grade renewal requires assembling five evidence packages: (1) machinery register meeting the DOH machinery threshold; (2) completed contracts record meeting the project-value threshold; (3) HR staff roster meeting the personnel threshold; (4) audited balance sheet confirming asset > liability; (5) bank confirmation letter of credit standing. All five are submitted to the relevant authority for annual or periodic renewal. The active grade determines which tenders the company is eligible to bid.",
        "module": "",
        "unverified": true,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Track contractor-grade / PQ requirements and renewal dates for DOH and กรมบัญชีกลาง",
          "Prepare & submit the qualification package — financials, track record, equipment, key personnel",
          "Maintain the Special grade / contractor-class registration to stay eligible to bid",
          "Respond to agency queries; keep certifications and registrations current",
          "Standing requirement to be eligible to bid — maintained continuously, manual, outside the ERP"
        ]
      }
    ]
  },
  {
    "id": "lane-g",
    "label": "⑩ Project\nClose-Out",
    "nodes": [
      {
        "id": "n-m-final-claim",
        "type": "manual",
        "dept": "pm",
        "loc": "site",
        "label": "Final Claim\n& Handover",
        "sub": "",
        "desc": "The last งวด — the same Progress Submit → AR cycle as every interim claim, run at 100% completion. The distinctive step is the final joint measurement and site handover (ส่งมอบงาน): once the owner accepts it, the works are closed and the Defect Liability Period and retention-release clock both start. Accounting books the final invoice through the normal AR.",
        "module": "",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Walk the whole site for 100% completion measurement vs the BOQ",
          "Joint final measurement & handover (ส่งมอบงาน) with the DOH inspection committee",
          "Final progress certificate with engineering sign-off",
          "Bill the final งวด through the normal Progress Submit → AR cycle — final tax invoice, retention deducted",
          "Handover accepted → starts the Defect Liability Period & retention-release clock"
        ]
      },
      {
        "id": "n-m-defect",
        "type": "manual",
        "dept": "pm",
        "loc": "site",
        "label": "Defect Liability\nPeriod",
        "sub": "",
        "desc": "PM manages the defect liability period after handover. Resolves punch-list items and responds to DOH defect notices before retention is released.",
        "module": "",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Monitor and log defect notices received from DOH",
          "Dispatch repair crews and track each defect to resolution",
          "Document all corrections with dated photographs",
          "Obtain DOH written sign-off on each resolved defect"
        ]
      },
      {
        "id": "n-m-retention-claim",
        "type": "manual",
        "dept": "fin",
        "label": "Retention\nRelease Claim",
        "sub": "",
        "desc": "Finance prepares and submits the retention release claim once the defect liability period expires and DOH issues clearance.",
        "module": "",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Confirm defect liability expiry date per contract",
          "Obtain final DOH clearance certificate",
          "Prepare formal retention release claim letter",
          "Submit to DOH and track against contracted payment schedule"
        ]
      },
      {
        "id": "n-retention-ar",
        "type": "erp",
        "dept": "acc",
        "label": "Retention AR\nRelease",
        "sub": "AR module (เบิกคืนเงินประกัน)",
        "desc": "Retention release in Mango AR is an invoice, not a bare receipt: open ใบแจ้งหนี้ เบิกคืนเงินประกันผลงาน (น.25), set up the receivable, issue receipt + record RL, then ตัดลูกหนี้ to clear the retention balance; posts to GL. [Reference: MG_STD AR น.25/78/127/143]",
        "module": "AR",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Open ใบแจ้งหนี้ — เบิกคืนเงินประกันผลงาน, set Retention Amount (น.25)",
          "Set up the retention receivable — ตั้งบัญชีลูกหนี้ (น.78)",
          "Issue receipt and record receipt RL (น.99/127)",
          "ตัดลูกหนี้ Clear AR — clears the retention balance (น.143)",
          "Posts to GL (AR Post, น.176)"
        ]
      },
      {
        "id": "n-m-final-account",
        "type": "manual",
        "dept": "acc",
        "label": "Final Account\nReconciliation",
        "sub": "",
        "desc": "Accounting reconciles all project actuals against BOQ and contract value. Produces the definitive project profitability report for management.",
        "module": "",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Extract all project cost entries from ERP (GL, PO, WO, payroll)",
          "Compare actuals vs. BOQ by trade and cost code",
          "Calculate final gross margin and overhead recovery",
          "Prepare final project profitability report for MD review"
        ]
      },
      {
        "id": "n-project-close",
        "type": "erp",
        "dept": "eng",
        "label": "Project\nClosure",
        "sub": "PM — final budget + reports",
        "desc": "Mango PM has no single \"close/lock project\" transaction. Closure = the final approved Revise Budget plus the final Inquiry/Reports (Project Status Overview น.61, Summary Cost น.111, Budget Revision Report น.125). BG/advance release is a bank/manual step outside Mango. [Reference: MG_STD — PM Inquiry/Report]",
        "module": "PM",
        "unverified": false,
        "erp_style": "",
        "erp_label": "",
        "items": [
          "Confirm the final Revise Budget is approved (น.32)",
          "Final Project Status Overview review (น.61)",
          "Run Summary Cost / Actual Cost report (น.111)",
          "Budget Revision Report for the record (น.125)",
          "Release performance BG and advance facility with the bank — manual, outside PM"
        ]
      }
    ]
  }
];
