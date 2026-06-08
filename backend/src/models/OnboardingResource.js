import mongoose from 'mongoose';

export const RESOURCE_CATEGORIES = ['นโยบาย', 'สวัสดิการ', 'คู่มือ', 'เอกสารลงนาม', 'สื่อแนะนำ'];

/**
 * A new-hire knowledge-base item (Module 4): policy, benefit, manual,
 * sign-off document, or intro media. File bytes (if any) live in GridFS.
 */
const OnboardingResourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: { type: String, enum: RESOURCE_CATEGORIES, default: 'คู่มือ', index: true },
    description: { type: String, default: null },
    link: { type: String, default: null }, // external URL (optional)
    storageKey: { type: String, default: null }, // GridFS key (optional)
    fileName: { type: String, default: null },
    contentType: { type: String, default: null },
    requiresSignature: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
  },
  { timestamps: true }
);

export default mongoose.model('OnboardingResource', OnboardingResourceSchema);
