import mongoose from 'mongoose';

export const ROLES = ['admin', 'executive', 'hr'];

/** Login account. Email is unique case-insensitively (collation strength 2). */
const ProfileSchema = new mongoose.Schema(
  {
    fullName: { type: String, default: null },
    email: { type: String, required: true },
    passwordHash: { type: String, default: null },
    role: { type: String, enum: ROLES, default: 'hr' },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', default: null, index: true },
    isActive: { type: Boolean, default: true },
    // GridFS storage key of the user's saved signature image (optional).
    signatureUrl: { type: String, default: null },
  },
  { timestamps: true }
);

// Case-insensitive unique email — replaces the SQL `unique (lower(email))`.
// All email lookups MUST use the same collation so this index is used.
ProfileSchema.index(
  { email: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

export default mongoose.model('Profile', ProfileSchema);
