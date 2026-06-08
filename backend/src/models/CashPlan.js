import mongoose from 'mongoose';

/**
 * Monthly cash plan row (Module 3) — per (project, month, period).
 * Lets the team forecast a project's cash position period by period.
 */
const CashPlanSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    month: { type: String, required: true }, // "2026-06"
    period: { type: String, default: '1' }, // งวด within the month
    income: { type: Number, default: 0 },
    // ledger items to pay off this period
    paidIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CreditLedger' }],
    newPN: { type: Number, default: 0 }, // new P/N amount issued
    deductions: { type: Number, default: 0 },
    incomeBreakdown: { type: String, default: null },
    available: { type: Number, default: 0 },
    note: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
  },
  { timestamps: true }
);

CashPlanSchema.index({ projectId: 1, month: 1, period: 1 });

export default mongoose.model('CashPlan', CashPlanSchema);
