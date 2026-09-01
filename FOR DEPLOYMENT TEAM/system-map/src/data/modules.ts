import type { Modules } from './types';

/** Verbatim transcription of MODULES from the canonical Index.html (v8.86). */
export const MODULES: Modules = {
  "BD": {
    "name": "Business Development",
    "purpose": "Manage tenders and record bid outcomes. Creates the project record on win."
  },
  "PM": {
    "name": "Project Management",
    "purpose": "Master plan, milestones, progress tracking, and BOQ. Central to all project cost control."
  },
  "OF": {
    "name": "Office Service System (OF)",
    "purpose": "Requisition-origination module (ระบบจัดทำใบขอซื้อ-ขอจ้าง). Creates Purchase Requests (PR), petty-cash & advance disbursements, and subcontractor payment requests against a Work Order. The originating document for company expenditure — OF raises the request; it does NOT execute the payment."
  },
  "AP": {
    "name": "Accounts Payable (AP)",
    "purpose": "Payables management (ระบบบริหารบัญชีเจ้าหนี้). Sets up the liability (ตั้งหนี้), receives vendor/subcontractor billing (รับวางบิล), approves payment (อนุมัติจ่าย), prepares the cheque or bank transfer (Preparing Cheque / Credit Line, Txn 5) and posts to GL (Txn 8). AP executes the actual outbound payment."
  },
  "PO": {
    "name": "Purchase Order / Work Order",
    "purpose": "Issue POs to suppliers and WOs to subcontractors, and record PO Receive — goods received against the PO in real time, which triggers AP (ตั้งหนี้ APV). Tracks commitments against budget. Receiving goods into stock is the IC step."
  },
  "IC": {
    "name": "Inventory Control (IC)",
    "purpose": "Stock Receive into the warehouse, issue (เตรียมเบิก→ตัดเบิก), transfer, stock counts and costing. PO Receive (confirming goods received against the PO) is a PO-module step that triggers AP; receiving those goods into stock is the IC step."
  },
  "AR": {
    "name": "Account Receivable",
    "purpose": "Record client billings (progress claims) and track payment receipt."
  },
  "GL": {
    "name": "General Ledger (GL)",
    "purpose": "Central accounting ledger. Receives postings from AP, AR, IC and FA; supports direct entries for adjustments, depreciation and revenue estimates. Period-end closing, financial statements and P&L reporting."
  },
  "FN": {
    "name": "Finance System (FN)",
    "purpose": "Finance dashboards and reports only — cash-in/cash-out analysis, cash flow & credit-line facility, financial statements, and revenue projections. No transaction entry; bank reconciliation is done manually in Excel against ERP data."
  },
  "FA": {
    "name": "Fixed Assets",
    "purpose": "Asset register, depreciation, maintenance records, and fleet tracking."
  }
};
