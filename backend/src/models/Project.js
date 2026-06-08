import mongoose from 'mongoose';

/**
 * Per-project letterhead config — embedded 1:1 in the project.
 * Note: logoUrl / signatureUrl are LOCAL filesystem paths consumed by
 * letterhead.js via existsSync (not GridFS keys).
 */
const LetterheadSchema = new mongoose.Schema(
  {
    companyName: { type: String, default: null },
    companyNameEn: { type: String, default: null },
    address: { type: String, default: null },
    logoUrl: { type: String, default: null },
    phone: { type: String, default: null },
    telex: { type: String, default: null },
    fax: { type: String, default: null },
    signatoryName: { type: String, default: null },
    signatoryTitle: { type: String, default: null },
    signatureUrl: { type: String, default: null },
    closingLine: { type: String, default: null },
    defaultRecipient: { type: String, default: null },
  },
  { _id: false }
);

/** โครงการ — the register "chips". */
const ProjectSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
    docPrefix: { type: String, required: true },
    color: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    letterhead: { type: LetterheadSchema, default: null },
  },
  { timestamps: true }
);

// Case-insensitive unique code — replaces SQL `unique (lower(code))`.
ProjectSchema.index(
  { code: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

export default mongoose.model('Project', ProjectSchema);
