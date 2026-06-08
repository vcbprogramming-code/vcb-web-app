import mongoose from 'mongoose';

export const DOC_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'returned', 'cancelled'];
export const DOC_SOURCES = ['manual', 'email'];
export const ATTACHMENT_KINDS = ['upload', 'generated_pdf'];
export const APPROVAL_ACTIONS = ['pending', 'approved', 'rejected', 'returned'];

/** A file attached to a document. Bytes live in GridFS under storageKey. */
const AttachmentSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ATTACHMENT_KINDS, default: 'upload' },
    version: { type: String, enum: ['original', 'approved', null], default: null },
    fileName: { type: String, required: true },
    contentType: { type: String, default: null },
    sizeBytes: { type: Number, default: null },
    storageKey: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

/** One step in the sequential approval chain. */
const ApprovalStepSchema = new mongoose.Schema(
  {
    stepNo: { type: Number, required: true },
    approverName: { type: String, default: null },
    approverEmail: { type: String, required: true },
    approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
    action: { type: String, enum: APPROVAL_ACTIONS, default: 'pending' },
    comment: { type: String, default: null },
    signatureUrl: { type: String, default: null }, // GridFS key
    actionToken: { type: String, default: null }, // one-time link token
    tokenExpiresAt: { type: Date, default: null },
    actedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

/** Append-only audit entry. */
const AuditEntrySchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
    actorLabel: { type: String, default: null },
    action: { type: String, required: true },
    detail: { type: mongoose.Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/** A register entry (memo / letter) — the aggregate root for Module 1. */
const DocumentSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    docCode: { type: String, required: true },
    department: { type: String, required: true },
    runNo: { type: Number, required: true },
    docNumber: { type: String, required: true },
    docTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'DocumentType', default: null, index: true },
    subject: { type: String, required: true },
    recipient: { type: String, default: null },
    body: { type: String, default: null },
    remarks: { type: String, default: null },
    workUnit: { type: String, default: null },
    senderEmail: { type: String, default: null },
    dateReceived: { type: Date, default: () => new Date(), index: true },
    source: { type: String, enum: DOC_SOURCES, default: 'manual' },
    status: { type: String, enum: DOC_STATUSES, default: 'pending', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
    enclosures: [
      new mongoose.Schema(
        { name: String, qty: Number, unit: String },
        { _id: false }
      ),
    ],
    attachments: [AttachmentSchema],
    approvalSteps: [ApprovalStepSchema],
    audit: [AuditEntrySchema],
  },
  { timestamps: true }
);

// Preserve SQL `unique (project_id, run_no)`.
DocumentSchema.index({ projectId: 1, runNo: 1 }, { unique: true });
// One-time approval tokens must be globally unique; many are null (sparse).
DocumentSchema.index({ 'approvalSteps.actionToken': 1 }, { unique: true, sparse: true });

export default mongoose.model('Document', DocumentSchema);
