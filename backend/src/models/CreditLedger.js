import mongoose from 'mongoose';

// Statuses (keep these EXACT Thai values — business rules depend on them).
//   อนุมัติแล้ว  → counts toward Used
//   คำขอใหม่ / อยู่ระหว่างเสนออนุมัติ → recorded but does NOT consume the line
//   ชำระแล้ว    → releases the line (Used drops)
//   void        → ignored
export const LEDGER_STATUSES = [
  'คำขอใหม่',
  'อยู่ระหว่างเสนออนุมัติ',
  'อนุมัติแล้ว',
  'ชำระแล้ว',
  'void',
];

// Statuses that consume the facility line.
export const AUTHORIZED_STATUSES = ['อนุมัติแล้ว'];

/**
 * A credit ledger entry (drawdown / settle) against a facility — Module 3.
 * Only `อนุมัติแล้ว` items count toward a facility's Used amount.
 */
const CreditLedgerSchema = new mongoose.Schema(
  {
    facilityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: LEDGER_STATUSES, default: 'อนุมัติแล้ว', index: true },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null, index: true },
    settledDate: { type: Date, default: null },
    ref: { type: String, default: null },
    source: { type: String, default: null },
    docFrom: { type: String, default: null },
    docTo: { type: String, default: null },
    interestRate: { type: Number, default: null }, // overrides facility rate if set
    note: { type: String, default: null },
    // link back to the request that produced this row (if any)
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreditRequest', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
  },
  { timestamps: true }
);

export default mongoose.model('CreditLedger', CreditLedgerSchema);
