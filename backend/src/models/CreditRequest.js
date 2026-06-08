import mongoose from 'mongoose';

export const REQUEST_STATUSES = ['อยู่ระหว่างเสนออนุมัติ', 'อนุมัติ', 'ไม่อนุมัติ'];

/**
 * A request to use a facility line — Module 3. On approval it AUTO-becomes a
 * live `อนุมัติแล้ว` ledger entry (linked via ledgerId, never double-counted).
 */
const CreditRequestSchema = new mongoose.Schema(
  {
    facilityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    amount: { type: Number, required: true },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    ref: { type: String, default: null },
    note: { type: String, default: null },
    status: { type: String, enum: REQUEST_STATUSES, default: 'อยู่ระหว่างเสนออนุมัติ', index: true },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, default: null },
    ledgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreditLedger', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
  },
  { timestamps: true }
);

export default mongoose.model('CreditRequest', CreditRequestSchema);
