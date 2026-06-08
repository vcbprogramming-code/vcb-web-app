import mongoose from 'mongoose';

/**
 * Detailed audit trail for Module 3. A snapshot+diff is written on every
 * mutation. Audit failures must never block the underlying write (callers
 * wrap writeAudit in try/catch).
 */
const CreditAuditSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
    actorLabel: { type: String, default: null },
    action: { type: String, required: true }, // create/update/delete/approve/reject/settle...
    target: { type: String, required: true }, // 'facility' | 'ledger' | 'request' | 'cashplan' | 'limit'
    targetId: { type: String, default: null },
    changes: { type: mongoose.Schema.Types.Mixed, default: null }, // {field:{before,after}}
    note: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

CreditAuditSchema.index({ target: 1, targetId: 1, createdAt: -1 });

export default mongoose.model('CreditAudit', CreditAuditSchema);
