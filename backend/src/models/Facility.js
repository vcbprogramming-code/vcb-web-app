import mongoose from 'mongoose';

// Facility types → the document label used by the bank.
export const FACILITY_TYPES = ['L/G (BG)', 'LGM (L/G)', 'T/L', 'B/E (AVAL)', 'P/N'];

/**
 * A credit facility (วงเงินสินเชื่อ) — Module 3. Multiple per project.
 * Available is computed (Limit − Used) where Used is derived from the ledger's
 * authorized items; we keep a `usedBaseline` for seeded opening balances.
 */
const FacilitySchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    company: { type: String, default: null }, // borrower / บริษัท
    bank: { type: String, default: null },
    facilityNo: { type: String, default: null },
    type: { type: String, enum: FACILITY_TYPES, required: true, index: true },
    limit: { type: Number, default: 0 },
    usedBaseline: { type: Number, default: 0 }, // opening used amount (seed)
    interestRate: { type: Number, default: null }, // %/year
    feeRate: { type: Number, default: null },
    approvedDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    notes: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Facility', FacilitySchema);
