# VCB — Company Operating Model & System Map

> Source of truth: extracted from the **VCB System Operating Map** app (canonical
> `Index.html`, v8.86, in `ORIGINAL CODE/`; React port in
> `FOR DEPLOYMENT TEAM/`). This document
> describes how the company **actually runs its business**, end to end — the
> real-world workflow, who does what, and exactly which parts live in the
> company's ERP (Mango) versus which are manual/off-ERP today. It is written so
> any coding assistant or analyst can understand the company's operating
> structure without needing to open the app itself.
>
> **Company**: VCB (Vichitphan / "VCB"), a Thai heavy-civil / infrastructure
> contractor doing government (DOH — Department of Highways — and other
> government owners: EXAT, RID) and private construction work, operating
> alongside JV/affiliate entities **CVE** and a **VN JV**, plus inter-entity
> trading. Long-cycle projects (~3 years), site-based delivery, HQ-based
> back office.
>
> **ERP**: "Mango" — a Thai construction-ERP suite. Its modules (referenced
> throughout as codes) are: **BD** (Business Development/tender-to-project),
> **PM** (Project Management/budget & control), **OF** (Office Service System —
> requisition/disbursement origination), **PO** (Purchase/Work Order + goods
> receipt), **IC** (Inventory Control), **AP** (Accounts Payable), **AR**
> (Accounts Receivable), **GL** (General Ledger), **FN** (Finance dashboards,
> read-only), **FA** (Fixed Assets). "MG_STD" references in node descriptions
> are pointers into the internal Mango standard-operating-procedure manual
> (page numbers as น.NN).
>
> **Repo layout**: this working folder holds two independent codebases for the
> same app, kept deliberately separate — **`ORIGINAL CODE/`** is the canonical
> Google Apps Script project (plain JavaScript/HTML, deployed via `clasp`;
> this is what's actually live today) and **`FOR DEPLOYMENT TEAM/`** is the
> React/TypeScript rebuild (for GitHub/Vercel/Supabase-based deployment). They
> must never be mixed — see each folder's own README/STATUS/PORT_NOTES for
> how they relate.

---

## 1. How to read this document

The company's operating model is mapped as **10 swimlanes** (major process
stages, left to right = roughly chronological through a project's life),
containing **79 process nodes** (individual steps/functions), connected by
**129 cross-lane relationships** (trigger / conditional / feeds / deferred —
see §2.3), plus a **158-row function registry** across **7 departments** (plus
a site-role view) that catalogs every job function irrespective of lane.

Each node below is tagged:
- **[ERP: <module>]** — a real transaction inside Mango, with a specific
  screen/transaction reference where known.
- **[MANUAL]** — happens outside the ERP today (Excel, paper forms, verbal,
  bank forms, physical action). Many of these are flagged in the source data
  as candidates for AI-assisted automation (§5) or future ERP adoption.

Thai terms are preserved from the source where they are the actual system/user
vocabulary (e.g. งวด = billing installment/milestone; ตั้งหนี้ = booking a
payable; รับวางบิล = receiving a subcontractor's billing).

---

## 2. The 10 operating lanes (end-to-end project lifecycle)

### Lane ① Project Setup — win the work, register it, plan it
| Node | Type | Dept | Summary |
|---|---|---|---|
| BD / Tender Pipeline | MANUAL | Eng | Track e-GP (government) & private tender invitations; screen fit (type/size/location/PQ grade); bid/no-bid decision. Off-ERP tracking sheet. |
| Estimation & Budgeting | MANUAL | PM | First rough (~80%) cost estimate/budget, mostly Excel, done jointly by PM + HQ engineer straight from tender drawings/TOR. Go/no-go on margin. |
| e-Bidding | MANUAL | Eng | Assemble tender package (using company PQ/grade), get director approval, submit via DOH e-GP portal, attend bid. Win → Master Plan → Project Registration. |
| Engineering Master Plan | MANUAL | PM | Post-award master construction schedule + งวด/milestone plan, built by hand; firms the budget ~80%→~99%; reviews IFC drawings + site survey. Feeds BD Registration AND Finance's cash-flow/credit-facility request. |
| **New Project Registration** | **ERP: BD** | Eng | *First ERP step.* Create Tender, create Project, link awarded Tender; import BOQ/Budget; Init Summary Cost Code. Sets up milestone (งวด) billing schedule. Ref: MG_STD BD-1.0/1.1 |
| Land Lease & Site Camp | MANUAL | PM (site) | Lease land (~3 yrs), build/fit out worker camp & housing before mobilisation; reinstated at closeout. |
| Mobilisation & Site Kick-off | MANUAL | PM (site) | Site handover, assign roles, set up site office, brief departments, appoint safety officer (จป.). |
| **Project Forecast** | **ERP: PM** | Eng | Forecast Income (งวด receipts, Adv/Progress/Retention %, น.7) + Monthly Project Forecast (น.45). Planning/evaluation baseline compared vs actuals — does not itself trigger downstream flows. |
| **Project Budget Control** | **ERP: PM** | Eng | Initial Project Budget (Txn 3) ← BOQ from BD; Control Budget; Approve Budget (Txn 4) locks the baseline all PRs/WOs reference. Revise Budget for corrections; Additional Work (VO) for scope change. |
| **Additional Work (Variation · BD)** | **ERP: BD** | Eng | Record added/reduced scope items, Save & Submit Approve, Create VO linked to main BOQ, Init Summary Cost Code merges cost codes → feeds back into PM Init/Control/Approve Budget. |
| **PM Module Dashboard** | **ERP: PM** | PM | Project Status Overview — the single real-time convergence screen: BD (BOQ/budget) vs PO (purchase cost, pending commitments) vs OF/AR (progress, billing) vs AP (payables/retention) vs GL (actual cost/P&L) vs IC (material usage/on-site). |

### Lane ② Materials & Procurement — buy what's needed
| Node | Type | Dept | Summary |
|---|---|---|---|
| Vendor & Subcon Pre-qualification | MANUAL *(not yet formalised)* | Proc | Target state: maintained Approved Vendor List (AVL) with capability/financial/safety checks + post-job scoring. Today mostly ad-hoc. |
| **Purchase Request (PR)** | **ERP: OF** | Proc (site) | Site admin (พัสดุ) opens on behalf of site PM. Types: PR For PO/WO, PO Only, WO Only; references BOQ or not. Two-level approval: site PM (PM-05) → HQ Engineer (ENG-15). Ref: PR-1.1/1.2/1.3 |
| Vendor Sourcing & Quotation | MANUAL | Proc | Contact ≥3 qualified vendors, collect samples for Engineering review, check certifications, prepare comparison. |
| **Compare Price** | **ERP: PO** | Proc | Price-request doc referencing the PR; enter vendor quotes; flag BOQ-budget deviations; authoriser approves. Ref: PO-1.1 |
| Vendor Approval & Contract | MANUAL | Proc | Director sign-off, negotiate terms, sign vendor contract/LOI. |
| **Purchase Order (PO)** | **ERP: PO** | Proc | Issued from approved Compare Price; type = Cost/Asset/Stock; locks price/qty/delivery. Down-payment/cash POs go straight to AP. Cross-project blanket PO (คลุมยอด) for shared fuel at stock-issue cost +1%. Ref: PO-1.2 |
| Delivery Coordination | MANUAL | Proc | Confirm delivery date, notify site/store, prepare receiving, chase late deliveries. |
| **PO Receive** | **ERP: PO** | Asset (site) | Site confirms goods received vs PO in real time; physical inspection (count/damage/spec); generates receipt → Accounting books payable (APV). Ref: PO Txn 1.3 / น.83 |
| **IC Receive (Stock-in)** | **ERP: IC · Txn 1** | Asset (site) | Warehouse stock-in from PO Receive, cash/petty Receive Other, or leftover repair parts at ฿0. Landed cost add-on (Txn 6). Casting-yard finished segments also received here. |
| **IC Issue (Draw-down)** | **ERP: IC · Txn 2** | Asset (site) | Withdraw stock for project use (permanently deducted, cost → project Cost Code → GL); variants: issue to repair, issue to subcontractor (contra-deducted on their claim), cross-entity billable sale (→ AR Trading). |
| **IC Transfer (Inter-site)** | **ERP: IC · Txn 3** | Asset (site) | Move stock to a DIFFERENT project's warehouse; sending side cuts stock, receiving side must do IC Receive Transfer to complete. |

### Lane ③ Subcontractor & Payables
| Node | Type | Dept | Summary |
|---|---|---|---|
| Subcon Selection & Contract | MANUAL | Proc | Identify candidates, invite quotes, evaluate, sign subcontract + affix stamp duty (0.1%, capped ฿10,000). |
| **Work Order (WO)** | **ERP: PO** | Proc | Issued from PR For WO; linked to BOQ subcontract scope; payment milestones (Adv/Progress/Retention); tracks budget vs commitment. Ref: PO-1.2 |
| Site Supervision & Verification | MANUAL | PM (site) | Daily inspection, QA/QC (ITP, material testing), NCRs, measure/sign-off completed work, safety (SHE, จป., PPE), incident logs. |
| **Subcontractor Progress** | **ERP: OF (รับวางบิล)** | Eng | Subcontractor claims work; site measures; HQ Eng records รับวางบิล (Adv/Progress/Retention); nets off any VCB materials issued (AR Trading receivable) before AP; retention released at end of defect-liability period. |
| Verify Claim & Prepare AP | MANUAL | Acc | Cross-check claim vs WO qty & site verification; apply retention; prepare net payment voucher; PM sign-off. |
| **Accounts Payable (AP)** | **ERP: AP** | Acc | Books payable: **APV** (PO receipt, incl. deposits), **APS** (subcontractor billing — Normal/Advance/Retention), **APO** (OF petty-cash/other). Approves Pre-Payment, routes to Finance. Ref: AP-1.1/1.2/1.3 |
| **AP Credit Note (ลดหนี้)** | **ERP: AP · Txn 2** | Acc | Reverses a payable for returns/over-billing/disputes before payment. Ref: น.57 |
| Director Approval & Payment Prep | MANUAL | Fin | Print payment summary, obtain director/MD signature, submit to bank, compile cheque/B-E register for management notification. |
| **Payment Execution** | **ERP: AP** | Fin | Prepare cheque/transfer (ใบสำคัญจ่าย), bulk batches via iCash (dual director approval), record WHT, confirm payment (ยืนยันการจ่าย / PV), Clear AP (ตัดเจ้าหนี้), PDC register, posts to GL. |

### Lane ④ Petty Cash & Advances
| Node | Type | Dept | Summary |
|---|---|---|---|
| **Petty Cash & Advances** | **ERP: OF · Txn 1** | Acc (site) | Non-PO/WO disbursement types: **Petty Cash** (reimburse), **Advance** (prepay employee), **Clear Advance** (reconcile), **Other** (external creditor). → Accounting books APO in AP → Payment → GL. Shared module: also used by HR (payroll/welfare/SSO), Finance (bank charges), Asset (insurance/road tax/CAR). Ref: OF-1.1–1.4 → AP-1.3 |
| Float Top-up & Receipts | MANUAL | Acc (site) | Collect/sort receipts, reconcile float, attach over-limit approvals, submit reimbursement request — paid via OF→AP→Payment, which tops up the float (a closed cycle). |

### Lane ⑤ Progress & Revenue
| Node | Type | Dept | Summary |
|---|---|---|---|
| Site Measurement & Progress Docs | MANUAL | PM (site) | For DOH/government work: JOINT measurement with owner's inspection committee (คณะกรรมการตรวจการจ้าง); jointly-agreed quantities become the certified basis for billing. |
| **Progress Submit** | **ERP: OF** | Eng | Owner-facing progress claim (ใบเบิกผลงาน): enter claim (by งวด/Job or BOQ %), then Submit Certificate with owner-approved amount + certification date → releases to AR. Ref: OF Txn 3 → AR-1.1 |
| DOH Contract & K-factor | MANUAL | PM | Monitor contract terms, retention %, installment conditions; compute ค่า K (price-escalation factor) from government indices vs base month; apply ± to certified claim before billing. |
| Billing Package & Tax Invoice | MANUAL | Acc | Compile progress cert + Eng sign-off + photos + measurement sheet; calculate billing amount; prepare tax invoice; deliver to client. |
| **AR Invoice** | **ERP: AR-1.1** | Acc | Client invoice by type: down-payment/deposit, progress (งวดงาน), retention release, Trading/Service-Others; sets up receivable (ตั้งบัญชีลูกหนี้). |
| **AR Credit Note (ใบลดหนี้)** | **ERP: AR · Txn 2** | Acc | Reduces receivable/revenue/output VAT for qty reduction, billing error, or discount/retention adjustment. |
| Client Follow-up & Payment Chase | MANUAL | Acc | Email/call before due date, resolve discrepancies, track cheque/transfer status, update cash-flow forecast. |
| **Receipt Voucher** | **ERP: AR** | Acc | Issue receipt/tax invoice → record RL/RV (bank + paid type, incl. post-dated cheques) → Clear AR (ตัดลูกหนี้). No-invoice receipts use AR-1.2. |
| **GL Close & Report** | **ERP: GL** | Acc | Manual JV + automatic postings (FA depreciation, IC, Rental, Retention/PO write-off, Cost Sheet, revenue recognition, MA); period close; P&L/BS/Cash Flow; management cost-per-project report; feeds all tax filings + external audit. |
| Bank Reconciliation | MANUAL | Fin | AFTER GL close: match book/GL cash vs bank statement (incl. credit-facility accounts), post correcting entries. Complements native GL Reconcile (Txn 3). |

### Lane ⑥ Asset Management
| Node | Type | Dept | Summary |
|---|---|---|---|
| Asset Tagging | MANUAL | Asset | Barcode/serial/useful-life before FA registration. |
| **Fixed Asset (FA)** | **ERP: FA** | Asset | Masters (Type/Depreciation/Location/Rate); record asset (key/Import/Copy); status checks; month-end Count Asset; monthly depreciation JV → GL; Transfer; Write-off. Ref: FA-1.1/1.2/1.3 |
| **Maintenance** | **ERP: FA · Txn 4** | Asset | Schedule service, record cost (vendor/VAT/WHT) — no separate Maintenance module. Repair history + tax/insurance reminders. Cross-entity repairs use "Z…" asset-code group (no depreciation). Leftover parts → IC stock at ฿0. |
| Asset Transfer & Gate Pass | MANUAL | Asset | Physical inter-site move: transfer request → approval → gate pass/transport → receiving-site inspection/sign-off → paperwork to Accounting. |
| **FA Transfer** | **ERP: FA · Txn 2** | Asset | Transfer voucher (transport/driver/dates), reassign holder & Location, switch depreciation to new project from document date. Also reconciles physical-count mismatches. Ref: น.62-69 |
| Surplus & Scrap Disposal Sale | MANUAL | Asset | Count leftover materials/surplus assets → bidding/auction → sell → proceeds as income (AR Trading for materials; FA Write-off/Sale for assets). |
| Fuel, GPS & Fleet Monitoring | MANUAL *(off-ERP)* | Asset | Machine-hours/utilisation, fuel issue/consumption/reconciliation, GPS/vehicle monitoring (57+ vehicles+machinery). Candidate for future MA/Rental module adoption. |
| Project Insurance (CAR) | MANUAL | Asset | Contractor All-Risk/liability/equipment cover on award; track premiums/expiry/renewal; handle claims. |
| Site Security & Guarding | MANUAL | Asset | Guards on duty, access control, incident logging (approval via Property & Asset form 06). |
| Asset & Stock Audit (HQ) | MANUAL | Asset | Periodic HQ physical count of IC stock + FA register at each site; reconcile vs ERP; investigate/adjust discrepancies. |

### Lane ⑦ HR & Payroll
| Node | Type | Dept | Summary |
|---|---|---|---|
| Site & PM OT Sign-off | MANUAL | PM (site) | Record each OT (Doc 08), PM signs every authorisation, reconcile month's OT per worker, forward batch to HQ HR. |
| Attendance & OT Collection | MANUAL | HR | Collect Doc 08 batches + attendance/leave from all sites; reconcile absences; prepare payroll input summary. |
| **Payroll Processing** | **ERP: OF** | HR | Compute gross pay (base+OT+allowances) − deductions (WHT/SSO/advances); requisition via OF; Accounting books net pay as payable (APO) → AP → Payment/iCash → GL; payslips. |
| SSO & WHT Filing | MANUAL | HR | Monthly SSO contribution filing; compile payroll WHT (PND.1) for Accounting's RD filing; archive receipts. |
| Performance Evaluation | MANUAL | HR | KPI review → satisfactory: salary adjustment feeds Payroll; unsatisfactory/misconduct: disciplinary → termination, final pay via Payroll, severance via AP. |

### Lane ⑧ Treasury & Facilities
| Node | Type | Dept | Summary |
|---|---|---|---|
| **Finance Dashboards** | **ERP: FN (read-only)** | Fin | Pulls from AP/AR/OF/GL — Cash on Hand, Cash Flow & Credit Line Facility, Financial Statement & Ratio, revenue projection vs collection. No data entry. Ref: FN น.3-44 |
| Cash Flow Forecast | MANUAL | Fin | (1) Full S-curve forecast from the master plan — inflows/outflows over the whole project timeline, submitted to the bank to secure the credit facility. (2) Monthly T-bar (FIN-01 expense plan / FIN-02 allocation declaration) across VCB/CVE/VN JV. |
| P/N Preparation | MANUAL | Fin | Four Promissory Note types, each CEO-signed: against Work Done (50%, from DOH progress cert), against Payment (80%, forecast installment), against Retention (80%), against K-factor (80%). |
| AVAL / B/E Preparation | MANUAL | Fin | Bill of Exchange as alternative to cash payment: beneficiary/amount/maturity (30/60/90d) on approved PO/WO, CEO-signed, bank-authorised → books to AP or routes to discounting. |
| AVAL Discounting (B/E Sale) | MANUAL | Fin | Sell issued AVAL early at a discount for immediate cash; shop multiple banks for best rate; CEO memo + approval; proceeds → company account. |
| Credit Facility Management | MANUAL | Fin | Single register for P/N, AVAL, Bank Guarantees (performance/advance/retention — doubles as bond register), LC/L-G; tracks drawdown/rate/maturity/utilisation/renewal; selects which facility to draw per payment batch. |
| **Bank Account Management** | **ERP: PM (inquiry)** | Fin | Draws from recorded receipts/payments: income vs expense per account, outstanding/PDC cheques, due dates, cheques on hand → liquidity planning. |
| **Inter-JV Group Transfers** | **ERP: AP** | Fin | Move funds between VCB/CVE/VN JV directly in AP (bypasses normal ตั้งหนี้ steps); posts to GL both sides. |
| **AR Without Invoice** | **ERP: AR-1.2** | Fin | Books non-invoice cash receipts (bank drawdowns, AVAL proceeds, inter-JV transfers, borrowed funds) directly — system issues RL number immediately, no Accounting involvement needed. |

### Lane ⑨ Compliance & Tax
| Node | Type | Dept | Summary |
|---|---|---|---|
| VAT Data Compilation | MANUAL | Acc | Extract output VAT (AR) + input VAT (AP/vendor/subcon) monthly; reconcile vs GL VAT control accounts; net position. |
| VAT Return (PP.30) | MANUAL *(data from ERP)* | Acc | Monthly return from Mango GL data, filed via RD e-filing (external to ERP); due 15th of following month. |
| WHT Compilation | MANUAL | Acc | Extract WHT from OF payment records (PND.1 payroll / PND.3 services / PND.53 companies); match to AP/payroll lines. |
| WHT Returns (PND.1/3/53) | MANUAL *(data from ERP)* | Acc | Filed via RD e-filing; paid via OF; archived. |
| Corporate Income Tax (PND.50/51) | MANUAL | Acc | Mid-year estimate (Aug) + annual (May, from audited GL) coordinated with external auditor. |
| Contractor Grade & PQ Status | MANUAL | Eng | Maintain DOH "ชั้นพิเศษ" (Special Grade) + EXAT/RID equivalents. Renewal needs 5 evidence packages: machinery register, completed-contracts record, HR roster, audited balance sheet, bank confirmation letter. Determines bid eligibility. |

### Lane ⑩ Project Close-Out
| Node | Type | Dept | Summary |
|---|---|---|---|
| Final Claim & Handover | MANUAL | PM (site) | Final งวด at 100% completion; joint final measurement + handover (ส่งมอบงาน) with DOH; billed through normal Progress Submit→AR; acceptance starts Defect Liability Period + retention clock. |
| Defect Liability Period | MANUAL | PM (site) | Log/resolve DOH defect notices; document corrections with photos; obtain DOH sign-off before retention release. |
| Retention Release Claim | MANUAL | Fin | On DLP expiry + DOH clearance: prepare and submit formal retention release claim. |
| **Retention AR Release** | **ERP: AR (เบิกคืนเงินประกัน)** | Acc | Invoice-style release (not a bare receipt): open invoice → set up receivable → issue receipt/RL → Clear AR → GL. Ref: น.25/78/127/143 |
| Final Account Reconciliation | MANUAL | Acc | Reconcile all project actuals vs BOQ/contract; final gross margin/overhead recovery; profitability report for MD. |
| **Project Closure** | **ERP: PM** | Eng | No single "close" transaction — closure = final approved Revise Budget + final Inquiry/Reports (Project Status Overview, Summary Cost, Budget Revision Report). BG/advance release with the bank is manual, outside PM. |

---

## 3. Departments

| Code | Department | Icon |
|---|---|---|
| `eng` | HQ Engineering | 🏗️ |
| `pm` | Project Manager (site) | 🧱 |
| `proc` | Procurement | 📦 |
| `fin` | Finance | 💰 |
| `acc` | Accounting | 📊 |
| `asset` | Property & Asset | 🏛️ |
| `hr` | Human Resources | 👥 |

(A `site` pseudo-department also exists in the function registry purely to
group site-level execution of otherwise HQ-owned functions.)

---

## 4. Five-stage view (the L0 summary)

The 10 lanes roll up into 5 high-level stages (used for the app's
progressive-disclosure overview):

1. **Win & Plan** (`BD`, `PM` modules) — Bid for work, register the awarded
   project, set the BOQ/budget and the forecast.
2. **Buy & Build** (`OF`, `PO`, `IC`) — Raise purchase requests, compare
   price, issue POs, receive goods, manage stock.
3. **Subcontract & Pay** (`OF`, `PO`, `AP`) — Issue work orders, record
   subcontractor billing, set up payables, pay (incl. petty cash).
4. **Bill & Collect** (`OF`, `AR`) — Submit progress to the client, issue
   invoices, receive payment, clear the receivable.
5. **Account & Close** (`GL`, `FN`, `PM`) — Post to GL, run period close and
   reports/dashboards, close out projects.

Four cross-cutting **support functions** run alongside every stage rather than
sitting in the main sequence: **Assets** (FA), **HR & Payroll** (OF),
**Treasury & Facilities** (FN), **Compliance & Tax** (no dedicated module —
manual RD filings from ERP data).

---

## 5. The master money/goods flow (plain-English narrative)

1. **Win the work.** A tender is spotted (BD pipeline) → rough Excel budget
   (Estimation & Budgeting) → if profitable, submit via e-GP e-Bidding → win.
2. **Set it up.** PM builds the manual Master Plan (firms budget to ~99%,
   surveys site) → this triggers **New Project Registration** in Mango BD
   (creates Project + imports BOQ/Budget) → which in turn spins up two ERP
   siblings in PM: **Project Forecast** (the งวด billing schedule) and
   **Project Budget Control** (the locked budget baseline everything else
   references) → and separately feeds Finance's Cash Flow Forecast for the
   bank credit facility. Land lease/camp and mobilisation happen in parallel.
3. **Buy materials.** Site raises a **PR** in OF → Procurement runs **Compare
   Price** in PO → issues the **PO** → vendor delivers → site does **PO
   Receive** (triggers AP payable) → then **IC Receive** (stocks it into the
   warehouse) → later **IC Issue** draws it down to the job (or transfers it
   to another project, or sells it cross-entity).
4. **Subcontract work.** A PR-For-WO routes to subcontractor selection →
   **Work Order** issued in PO → site supervises/QA's the work → subcontractor
   claims are recorded as **Subcontractor Progress** in OF (materials issued to
   them are netted off here) → Accounting verifies and books **AP** (APS) →
   Director approves → **Payment Execution** (cheque/transfer/iCash) → GL.
5. **Bill the client.** Site does a **joint measurement** with the DOH
   committee → **Progress Submit** in OF (owner-certified amount + K-factor
   escalation applied) → **AR Invoice** issued → client chased → **Receipt
   Voucher** clears the receivable → **GL Close**.
6. **Finance runs alongside continuously**, drawing bank facilities
   (Promissory Notes against certified work/payment/retention/K-factor, AVAL
   bills of exchange, discounting, Bank Guarantees, LC) to bridge the gap
   between paying subcontractors/suppliers now and collecting from the
   client/DOH later — all tracked in the Credit Facility register and rolled
   up into the Cash Flow Forecast and Bank Account Management.
7. **Compliance** (VAT/WHT/CIT) is compiled monthly from GL/OF data and filed
   externally via the Revenue Department e-filing portal — the ERP is the
   source of the numbers, not the filing system itself.
8. **Close-out**: final งวด at 100% complete → Defect Liability Period →
   retention released (as an AR invoice, not a bare receipt) → final account
   reconciliation → Project Closure in PM (final budget revision + reports;
   bank BG/advance release is a manual bank-side step).

---

## 6. Notable structural facts worth preserving

- **PR is the single requisition gateway** — nothing becomes a PO or WO
  without an approved PR first, and every PR references a BOQ line.
- **BOQ/Budget import is a BD function, carried into PM** for Control/Approve
  — not done directly in PM.
- **PO Receive (PO module) ≠ IC Receive (IC module)**: confirming goods
  arrived against the PO (which triggers AP) is a separate step/module from
  actually stocking them into the warehouse.
- **Materials issued to a subcontractor are billed internally**: IC Issue to a
  subcontractor becomes an AR Trading receivable that is *netted off* on that
  subcontractor's own Subcontractor Progress claim, before AP — not a
  separate cash transaction.
- **Retention behaves differently in AP vs AR**: on the payable side it's
  released as an AP-Retention type; on the receivable side it's released as a
  proper AR invoice (เบิกคืนเงินประกัน), not a bare receipt.
- **Finance can post directly without Accounting** for two specific cases:
  Inter-JV Group Transfers (AP) and AR Without Invoice (AR-1.2) — both
  bypass Accounting's normal ตั้งหนี้/invoice set-up steps.
- **GL is the hub**: FA depreciation/write-off, IC cost transfers, Rental,
  Retention/PO write-off, Cost Sheet, revenue recognition all auto-post to GL,
  which then feeds Bank Reconciliation, all three tax compilations (VAT/WHT/
  CIT), and the FN dashboards.
- **The PM Module Dashboard is the single-pane-of-glass**: it's fed in real
  time by BD (budget baseline), PO (purchase cost + pending commitments), OF/
  AR (progress + billing), AP (payables + retention), GL (actual cost/P&L),
  and IC (material usage) — seven modules converging on one screen.
- **Contractor grade (PQ) renewal is itself fed by ERP data**: the machinery
  register (FA), completed-contracts record (Project Closure), HR roster
  (Payroll), and balance sheet (GL) all serve as evidence packages for
  maintaining DOH/EXAT/RID bid eligibility — a good example of a compliance
  requirement threading back through nearly every other lane.
- **Two intentionally dead code paths exist in the canonical app** (per
  STATUS.md): the L0 progressive-disclosure overview screen and the
  focus-layer detail panel are both unreachable in the *original* Google Apps
  Script app too — not a porting bug.

---

## 7. Full function registry (158 functions, by department)

Each row: **Code — Name — ERP status — Module — What it does.** "ERP" =
transacted in Mango; "Non-ERP" = manual/Excel/paper/external; "Non-ERP → ERP"
= a manual step that culminates in an ERP entry (typically an OF payment
request). A `*` marks functions currently expected to be performed physically
at the **project site** rather than HQ (per the app's location filter).

### HQ Engineering (`eng`) — 19 functions
| Code | Name | Status | Module |
|---|---|---|---|
| ENG-01 | Business Development & DOH Relations | Non-ERP | — |
| ENG-02 | Contractor Grade Maintenance | Non-ERP | — |
| ENG-03 | Estimation & Bid Submission | ERP | BD |
| ENG-04 | Competitive Bidding Document Preparation | Non-ERP | — |
| ENG-06 | New Project Registration | ERP | BD |
| ENG-07 | Master Plan Entry & Revision | ERP | PM |
| ENG-08 | BOQ & Budget Control | ERP | PM |
| ENG-09 | Detailed Design & Calculations | Non-ERP | — |
| ENG-10 | Value Engineering / Cost Optimisation | Non-ERP | — |
| ENG-11 | Shop Drawings & Submittals | Non-ERP | — |
| ENG-12 | Engineering Document & Drawing Control | Non-ERP | — |
| ENG-13 | Technical Queries (RFI) & Site Support | Non-ERP | — |
| ENG-14 | Variation Order (VO) Processing | ERP | BD |
| ENG-15 | PR Approval — Engineer Level | ERP | OF |
| ENG-16 | Work Order / PO Coordination | ERP | PO |
| ENG-17 | Subcontractor Billing Entry | ERP | OF |
| ENG-18 | Engineering Department Expenses (OF) | Non-ERP → ERP | OF |
| ENG-19 | Project Closure in ERP | ERP | PM |

*(ENG-05 is not present in the source registry — codes are non-sequential.)*

### Project Manager / site (`pm`) — 23 functions
| Code | Name | Status | Module |
|---|---|---|---|
| PM-01 | Site Kick-off & Mobilisation | Non-ERP | — |
| PM-02 | Land Lease & Site Camp | Non-ERP | — |
| PM-03 | Surveying (งานสำรวจ) | Non-ERP | — |
| PM-04 | Site Document Approval (gate for all site forms) | Non-ERP → ERP | — |
| PM-05 | PR Approval — Site PM Level | ERP | OF |
| PM-06 | Utility Relocation & Right-of-Way Coordination | Non-ERP | — |
| PM-07 | Traffic Management & Work-Zone Safety | Non-ERP | — |
| PM-08 | Environmental Compliance & Community Relations | Non-ERP | — |
| PM-09 | Safety Officer Functions | Non-ERP | — |
| PM-10 | Foreman — Work Supervision | Non-ERP | — |
| PM-11 | Machinery Operation Supervision | Non-ERP | — |
| PM-12 | QA/QC Material & Lab Testing | Non-ERP | — |
| PM-13 | Subcontractor Supervision & Verification | Non-ERP | — |
| PM-14 | Subcontractor Progress Claim Verification | Non-ERP | — |
| PM-15 | Subcontractor Advance / Retention Request | Non-ERP | — |
| PM-16 | Daily Work Log & Progress Report | Non-ERP | — |
| PM-17 | Site Progress Monitoring & Reporting | ERP | PM |
| PM-18 | Work Submission to DOH (Owner Progress Claim) | Non-ERP | — |
| PM-19 | DOH Contract & K-factor Monitoring | Non-ERP | — |
| PM-20 | DOH Meetings & Negotiations | Non-ERP | — |
| PM-21 | 5S / Quality Control & Defect Review | Non-ERP | — |
| PM-22 | Final Work Measurement & Handover | Non-ERP | — |
| PM-23 | Defect Liability Period Management | Non-ERP | — |

### Finance (`fin`) — 22 functions
| Code | Name | Status | Module |
|---|---|---|---|
| FIN-01 | Project Cash Flow for Bank Credit Facility | Non-ERP | Excel |
| FIN-02 | Monthly Cash Expense Planning (T-bar) | Non-ERP | Excel |
| FIN-03 | Credit Facility Planning (T-bar) | Non-ERP | Excel |
| FIN-04 | Fund Allocation Optimisation | Non-ERP | Excel |
| FIN-05 | P/N (Promissory Note) Management | Non-ERP | Excel |
| FIN-06 | AVAL / B/E Preparation | Non-ERP | Bank form |
| FIN-07 | Bank Guarantee (BG) Management | Non-ERP | Excel |
| FIN-08 | Letter of Credit (LC) & L/G Management | Non-ERP | Excel |
| FIN-09 | Mortgage Loan (ML) Revolver Management | Non-ERP | Excel |
| FIN-10 | Budget Analysis | Non-ERP | Excel |
| FIN-11 | Payment Processing (Cheque/Transfer) | ERP | AP |
| FIN-12 | Cheque Preparation & Register | ERP → Non-ERP | AP |
| FIN-13 | Post-dated Cheque (PDC) Register | ERP | AP |
| FIN-14 | iCash Electronic Payment | Non-ERP | iCash |
| FIN-15 | DOH Contract Terms Monitoring | Non-ERP | Excel |
| FIN-16 | Informal Debt Grace Period Negotiation | Non-ERP | — |
| FIN-17 | Actual Expense Recording (P&L) | ERP | GL |
| FIN-18 | Inter-JV Group Transfers (via AP) | ERP | AP |
| FIN-19 | Bank Charges & Interest Payment (own dept) | Non-ERP → ERP | OF |
| FIN-20 | Bank Reconciliation | ERP + Non-ERP | Excel |
| FIN-21 | AVAL Discounting / B/E Sale | Non-ERP | Excel |
| FIN-22 | P/N Preparation | Non-ERP | Bank form |
| FIN-23 | Non-Invoice Receipt (AR-1.2) | ERP | AR |

### Accounting (`acc`) — 20 functions
| Code | Name | Status | Module |
|---|---|---|---|
| ACC-01 | Accounts Payable Recording (APV/APS/APO) | ERP | AP |
| ACC-02 | Pre-Payment Voucher (APP) | ERP | AP |
| ACC-03 | Transfer Slip & Document Processing | Non-ERP → ERP | GL |
| ACC-04 | AR Invoice Issuance to DOH/Client | ERP | AR |
| ACC-05 | AR Trading / Inter-company Sales | ERP | AR |
| ACC-06 | AR Receipt Recording | ERP | AR |
| ACC-07 | Receivables Collection & Client Follow-up | Non-ERP | — |
| ACC-08 | Site Petty Cash Entry | ERP | OF |
| ACC-09 | Advance Payment Report (Project/JV/Unit/Other) | ERP → Non-ERP | OF / GL |
| ACC-10 | Site Monthly Cost Report | Non-ERP | Excel |
| ACC-11 | Month-End GL Closing | ERP | GL |
| ACC-12 | Financial Statements | ERP | GL |
| ACC-13 | Management Reporting (Cost by Project) | Non-ERP | Excel |
| ACC-14 | IC Inventory Accounting | ERP | IC |
| ACC-15 | Fixed Asset Accounting | ERP | FA |
| ACC-16 | Real-Time Account Monitoring & Alerts | ERP + Non-ERP | GL |
| ACC-17 | VAT Return PP.30 | ERP + Non-ERP | RD e-filing |
| ACC-18 | Withholding Tax (WHT) Filing | ERP + Non-ERP | RD e-filing |
| ACC-19 | Corporate Income Tax (CIT) Filing | ERP + Non-ERP | RD e-filing |
| ACC-20 | External Audit Coordination | Non-ERP | — |

### Procurement (`proc`) — 19 functions
| Code | Name | Status | Module |
|---|---|---|---|
| PO-01 | PR Review | ERP | OF |
| PO-02 | Site Parcel (พัสดุ) — PR Review | ERP | OF |
| PO-03 | Vendor Sourcing & Quotation | Non-ERP | — |
| PO-04 | Quotation Comparison & Selection | ERP | PO |
| PO-05 | Vendor Approval & Contract Signing | Non-ERP | — |
| PO-06 | Subcontractor Selection & Subcontract | Non-ERP | — |
| PO-07 | PO / WO Issuance | ERP | PO |
| PO-08 | Delivery Coordination & Expediting | Non-ERP | — |
| PO-09 | Import & Customs Clearance | Non-ERP | — |
| PO-10 | Credit Term Negotiation (Supplier) | Non-ERP | — |
| PO-11 | Material Lead Time Planning | Non-ERP | — |
| PO-12 | Bulk Buying Planning | Non-ERP | — |
| PO-13 | AVAL Offset Arrangement | Non-ERP | — |
| PO-14 | Creditor Debt Restructuring | Non-ERP | — |
| PO-15 | Vendor & Subcontractor Pre-qualification (AVL) | Non-ERP | — |
| PO-16 | Supplier Tier Classification (Tier 1–4) | Non-ERP | Excel |
| PO-17 | Market Price Database Maintenance | Non-ERP → ERP | Excel |
| PO-18 | Anti-Monopoly Enforcement | Non-ERP | — |
| PO-19 | Supplier Blacklist Management | Non-ERP | Excel |

### Property & Asset (`asset`) — 21 functions (FA + IC sub-groups)
| Code | Name | Status | Module |
|---|---|---|---|
| ASSET-FA-01 | Fixed Asset Registration | ERP | FA |
| ASSET-FA-02 | Fleet Management & Tracking | ERP | FA |
| ASSET-FA-03 | GPS & Fleet Monitoring | Non-ERP | GPS system |
| ASSET-FA-04 | Preventive Maintenance (PM) Scheduling | ERP + Non-ERP | FA |
| ASSET-FA-05 | Workshop Coordination (ศูนย์ซ่อมสาย 5) | Non-ERP | — |
| ASSET-FA-06 | Machinery / Repair & Rental PR Review | ERP | OF |
| ASSET-FA-07 | Vehicle Insurance Renewal | Non-ERP → ERP | OF |
| ASSET-FA-08 | Vehicle Road Tax (ภาษีรถ) Renewal | Non-ERP → ERP | OF |
| ASSET-FA-09 | Fleet Right-Sizing & Disposal | Non-ERP | — |
| ASSET-FA-10 | Asset Transfer & Gate Pass | Non-ERP | — |
| ASSET-FA-12 | PQ Documentation (กรมบัญชีกลาง) | Non-ERP | — |
| ASSET-FA-13 | Monthly Asset & Cost Reports | Non-ERP | Excel |
| ASSET-IC-01 | IC Inventory Management (Materials) | ERP | IC |
| ASSET-IC-02 | PO Receipt Entry (Site) | ERP | PO |
| ASSET-IC-03 | Segment Factory Output — IC Recording | ERP | IC |
| ASSET-IC-04 | Fuel Quota Monitoring | ERP | IC |
| ASSET-IC-05 | Site Security & Guarding | Non-ERP | — |
| ASSET-IC-06 | Surplus Material / Scrap Auction | Non-ERP → ERP | FA |
| ASSET-IC-07 | Project Insurance (CAR) | Non-ERP → ERP | OF |
| ASSET-IC-08 | Asset & Stock Audit | Non-ERP | — |

*(ASSET-FA-11 is not present in the source registry.)*

### Human Resources (`hr`) — 17 functions
| Code | Name | Status | Module |
|---|---|---|---|
| HR-01 | Headcount Planning & Authorisation | Non-ERP | Excel |
| HR-02 | Recruitment & Onboarding | Non-ERP | — |
| HR-03 | Employment Contract Management | Non-ERP | — |
| HR-04 | Payroll Processing (Month-End) | ERP | OF |
| HR-05 | OT Management (Deferred) | Non-ERP → ERP | OF |
| HR-06 | Attendance & Leave Tracking | Non-ERP | Excel |
| HR-07 | Performance Evaluation & KPI | Non-ERP | — |
| HR-08 | Salary Benchmarking | Non-ERP | — |
| HR-09 | Disciplinary Proceedings | Non-ERP | — |
| HR-10 | PDPA Compliance | Non-ERP | — |
| HR-11 | Funeral / Bereavement Benefit | Non-ERP → ERP | OF |
| HR-12 | Org Chart & Reporting Structure Management | Non-ERP | — |
| HR-13 | Social Security (SSO) Filing & Registration | Non-ERP → ERP | SSO e-Service |
| HR-14 | Foreign / Migrant Labour Management | Non-ERP | — |
| HR-15 | Provident Fund & Benefits Administration | Non-ERP | Excel |
| HR-16 | Site HR / Admin — Employee Records | ERP | OF |
| HR-17 | Site OT Entry (Doc 08) | Non-ERP → ERP | OF |

### Site-role view (`site`) — 20 functions
A cross-department "what happens physically at the project site" view (largely
duplicates/re-groups HR/PM/Asset codes above under a site-execution lens):
SITE-01 Site HR/Admin · SITE-02 Site OT Entry · SITE-03 Site Petty Cash Entry ·
SITE-04 Site Monthly Cost Report · SITE-05 Site Parcel PR Review · SITE-06 PO
Receipt Entry · SITE-07 GPS & Vehicle Monitoring · SITE-08 Site Fuel & Material
Monthly Report · SITE-09 Surveying · SITE-10 Safety Officer Functions ·
SITE-11 Foreman Work Supervision · SITE-12 Machinery Operation · SITE-13 Site
Workshop Repair · SITE-14 Segment Factory Output (IC) · SITE-17 Doc 02C PM
Payment Request · SITE-18 Doc 03 Work Submission to DOH · SITE-19 Subcontractor
Progress Claim Verification · SITE-20 Daily Work Log & Progress Report.

---

## 8. Site → HQ paper forms (still manual by design)

These are physical/manual documents that travel from the project site to HQ
and are **intentionally kept as forms** rather than digitized directly (though
several trigger a downstream ERP entry at HQ):

| Doc | Name | Route | Outcome |
|---|---|---|---|
| 02A | Engineering Plan Approval | Site PM → HQ Engineering | Kept manual (project name, master plan, personnel/machinery plan, revenue-expense estimate) |
| 02B | Purchase & Subcontract Approval | Site PM → HQ Engineering | Required only when unit price is ABOVE Master Plan; approved → becomes a PR |
| 02C | Engineering Misc Approval | Site PM → HQ Engineering | Subcontractor/machinery-rental name changes, problem reports, engineer hiring, meal-welfare |
| 03 | Subcontractor Progress Billing | Site PM → HQ Engineering | → recorded in OF (รับวางบิล) → AP (APS) |
| 08 | HR / Personnel Request | Site PM → HQ HR | Hiring (non-engineer)/termination, OT & accident reports, visa/permit expenses |
| 09 | Petty Cash / Advance Clearing Evidence | Site PM → HQ Accounting | Clears an OF petty-cash/advance drawdown |
| 10 | Authorization / Certification Letter | Site PM → HQ Office (via Engineering) | Power of attorney, certification letters, BG requests for retention release |

---

## 9. Cross-lane relationship types (how nodes connect)

The map's 129 connections are typed:
- **trigger** — completing A directly starts B (e.g. Registration → Land
  Lease & Site Camp).
- **conditional** — A *may* lead to B depending on circumstance (e.g. Asset
  received with PO type=Asset → tag the asset).
- **feeds** — A supplies data/value into B without necessarily "starting" it
  (e.g. AP Payment → GL).
- **deferred** — A's effect on B happens later/in batch (e.g. GL → month-end
  VAT compilation).
- Several connections are marked **feedback** — a cycle back to an earlier
  node (e.g. Float Top-up reimbursement → back into Petty Cash & Advances;
  Bank Reconciliation corrections → back into GL; FA Transfer recorded →
  updates the FA register it came from).

The single most-connected hub node is the **PM Module Dashboard**
(`n-pm-dash`) and **GL Close & Report** (`n-gl`) — both receive feeds from
nearly every other module, confirming they are the company's two central
"everything converges here" points (operational vs. financial).

---

## 10. AI / automation opportunity map

The source data also tags ~35 of the manual nodes with a recommended AI
automation angle (impact/effort/tool), reflecting where the company sees the
biggest near-term win from AI-assisted work. High-impact, low-effort
candidates include: Cash-Flow Forecast Builder, Facility/Guarantee/Bond
Register, Fuel & Fleet Anomaly Monitor, Petty-Cash Receipt OCR, AR Follow-up
Drafting, Bank Reconciliation, Subcontractor Claim Verification, Billing
Package & Tax-Invoice Prep, Asset & Stock Audit Reconciliation, Site
Attendance & OT Capture, VAT/WHT Compilation & Filing Prep, Final Account
Reconciliation, K-factor Adjustment Calculation, AP Auto-Match & Anomaly
Detection, Receipt OCR & 3-Way Match, and Project Health Summary narration off
the PM Dashboard. These are documented per-node in
`FOR DEPLOYMENT TEAM/src/data/aiOpps.ts` and `functionAi.ts` (English + Thai
descriptions) if deeper detail is needed later.

---

## 11. Where this data actually lives (for future edits)

This document is a snapshot. The living source of truth is the typed data
layer in the React app:

```
FOR DEPLOYMENT TEAM/src/data/
  lanes.ts            10 lanes / 79 nodes — the full node detail (verbatim)
  crossConns.ts        129 cross-lane connections
  depts.ts / deptMeta.ts   7 departments (name/color/icon)
  stages.ts             5-stage L0 rollup
  support.ts            4 cross-cutting support functions
  modules.ts            10 ERP module definitions (BD/PM/OF/AP/PO/IC/AR/GL/FN/FA)
  docNodes.ts           7 site→HQ paper forms
  functionRegistry.ts    158-row function catalog by department
  aiOpps.ts / functionAi.ts   AI-automation opportunity annotations
  langTh.ts             Thai translations for everything above
  nodeFn.ts, functionOwner.ts, functionDept2.ts, functionHide.ts,
  functionLoc.ts, aiRegistryFns.ts, fieldActCodes.ts   cross-reference /
                        override tables used only to render the app's filters
```

If the underlying business process ever changes (new step, new department,
re-scoped ERP module), that source is where it gets updated — this Markdown
file should be regenerated from it, not hand-edited to diverge.
